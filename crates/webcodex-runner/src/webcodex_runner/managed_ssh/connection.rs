use super::*;
use crate::webcodex_runner::shutdown::lock_unpoison;
use crate::webcodex_runner::ssh_credentials::{AskpassLease, ConnectionCandidate, HostKey};
use std::collections::BTreeMap;
use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::{atomic::Ordering, mpsc};
use std::time::{Duration, Instant};
use webcodex_core::ssh_resource::{
    SshEndpoint, SshHostKeyCandidate, SshHostKeyTrust, SSH_HOST_KEY_CHALLENGE_TTL_SECS,
    SSH_HOST_KEY_MAX_COUNT,
};
use webcodex_process::ManagedChild;

const CHALLENGE_LIMIT: usize = 64;
const SETUP_OUTPUT_LIMIT: usize = 32 * 1024;
const SETUP_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Default)]
pub(super) struct Challenges(BTreeMap<String, Challenge>);

#[derive(Debug)]
struct Challenge {
    endpoint: SshEndpoint,
    revision: u64,
    generation: u64,
    deadline: Instant,
    keys: Vec<HostKey>,
}

impl ManagedSshResourceStore {
    fn check_revision(&self, revision: u64, static_active: &SshConfig) -> Result<(), &'static str> {
        let path = self
            .path
            .as_deref()
            .ok_or("ssh_resource_registry_unavailable")?;
        let lock = self
            .lock_path
            .as_deref()
            .ok_or("ssh_resource_registry_unavailable")?;
        with_registry_lock(lock, || {
            let registry = load_registry(path)?;
            ensure_no_static_collision(&registry, static_active)?;
            if registry.revision != revision {
                return Err("ssh_resource_registry_stale");
            }
            Ok(())
        })
    }

    pub(super) fn handle_connection(
        &self,
        static_active: &SshConfig,
        request: SshResourceRequest,
        generation: u64,
        stop: Option<&AtomicBool>,
        still_current: &impl Fn() -> bool,
    ) -> Result<SshResourceResponse, &'static str> {
        if stop.is_some_and(|stop| stop.load(Ordering::SeqCst)) {
            return Err("ssh_connection_cancelled");
        }
        match request {
            SshResourceRequest::Inspect {
                expected_revision,
                endpoint,
            } => {
                self.check_revision(expected_revision, static_active)?;
                let keys = scan_host_keys(&endpoint, stop)?;
                self.check_revision(expected_revision, static_active)?;
                if !still_current() {
                    return Err("ssh_host_key_stale");
                }
                let now = Instant::now();
                let mut challenges = lock_unpoison(&self.challenges);
                challenges.0.retain(|_, challenge| challenge.deadline > now);
                if challenges.0.len() >= CHALLENGE_LIMIT {
                    if let Some(oldest) = challenges
                        .0
                        .iter()
                        .min_by_key(|(_, challenge)| challenge.deadline)
                        .map(|(id, _)| id.clone())
                    {
                        challenges.0.remove(&oldest);
                    }
                }
                let challenge_id = format!("wc_ssh_{}", uuid::Uuid::new_v4().simple());
                let host_keys = keys
                    .iter()
                    .map(|key| SshHostKeyCandidate {
                        algorithm: key.algorithm.clone(),
                        fingerprint: key.fingerprint.clone(),
                    })
                    .collect();
                challenges.0.insert(
                    challenge_id.clone(),
                    Challenge {
                        endpoint,
                        revision: expected_revision,
                        generation,
                        deadline: now + Duration::from_secs(SSH_HOST_KEY_CHALLENGE_TTL_SECS as u64),
                        keys,
                    },
                );
                Ok(SshResourceResponse::Inspect {
                    revision: expected_revision,
                    challenge_id,
                    expires_at: chrono::Utc::now()
                        .timestamp()
                        .saturating_add(SSH_HOST_KEY_CHALLENGE_TTL_SECS),
                    host_keys,
                })
            }
            SshResourceRequest::Probe {
                expected_revision,
                endpoint,
                authentication,
                host_key,
            } => {
                self.check_revision(expected_revision, static_active)?;
                let selected = self.select_host_key(
                    &endpoint,
                    expected_revision,
                    generation,
                    &host_key,
                    false,
                )?;
                let candidate = self.create_candidate(
                    expected_revision,
                    static_active,
                    endpoint,
                    authentication,
                    selected,
                )?;
                probe_connection(&candidate, stop)?;
                self.check_revision(expected_revision, static_active)?;
                if !still_current() {
                    return Err("ssh_host_key_stale");
                }
                Ok(SshResourceResponse::Probe {
                    revision: expected_revision,
                    host_key_fingerprint: host_key.fingerprint,
                })
            }
            SshResourceRequest::RegisterConnection {
                expected_revision,
                name,
                endpoint,
                authentication,
                host_key,
                default_cwd,
            } => {
                self.check_revision(expected_revision, static_active)?;
                if static_active.resources.contains_key(&name) {
                    return Err("ssh_resource_static_conflict");
                }
                let selected = self.select_host_key(
                    &endpoint,
                    expected_revision,
                    generation,
                    &host_key,
                    true,
                )?;
                let mut candidate = self.create_candidate(
                    expected_revision,
                    static_active,
                    endpoint,
                    authentication,
                    selected,
                )?;
                probe_connection(&candidate, stop)?;
                if !still_current() {
                    return Err("ssh_host_key_stale");
                }
                if stop.is_some_and(|stop| stop.load(Ordering::SeqCst)) {
                    return Err("ssh_connection_cancelled");
                }
                let path = self
                    .path
                    .as_deref()
                    .ok_or("ssh_resource_registry_unavailable")?;
                let lock = self
                    .lock_path
                    .as_deref()
                    .ok_or("ssh_resource_registry_unavailable")?;
                let result = with_registry_lock(lock, || {
                    let mut registry = load_registry(path)?;
                    ensure_no_static_collision(&registry, static_active)?;
                    if registry.revision != expected_revision {
                        return Err("ssh_resource_registry_stale");
                    }
                    if !still_current() {
                        return Err("ssh_host_key_stale");
                    }
                    if registry.resources.contains_key(&name) {
                        return Err("ssh_resource_name_conflict");
                    }
                    if registry.resources.len() >= MANAGED_SSH_RESOURCE_MAX_COUNT {
                        return Err("ssh_resource_invalid");
                    }
                    let desired = ManagedResource {
                        target: candidate.connection.stored.endpoint.host.clone(),
                        default_cwd: normalize_ssh_resource_default_cwd(default_cwd.as_deref())?,
                        connection: Some(candidate.connection.stored.clone()),
                    };
                    let active = self
                        .startup_managed
                        .resources
                        .get(&name)
                        .is_some_and(|current| managed_matches_config(&desired, current));
                    registry.resources.insert(name.clone(), desired);
                    registry.revision = registry
                        .revision
                        .checked_add(1)
                        .ok_or("ssh_resource_registry_unavailable")?;
                    // An uncertain rename/fsync must never leave a committed
                    // registry pointing at credentials deleted by Drop.
                    match write_registry(path, &registry) {
                        Ok(()) => candidate.retain(),
                        Err("ssh_resource_outcome_unknown") => {
                            candidate.retain();
                            return Err("ssh_resource_outcome_unknown");
                        }
                        Err(code) => return Err(code),
                    }
                    Ok(SshResourceResponse::Register {
                        revision: registry.revision,
                        resource: name,
                        persisted: true,
                        active,
                        restart_required: !active,
                    })
                });
                result
            }
            _ => Err("ssh_resource_invalid"),
        }
    }

    fn private_root(&self) -> Result<PathBuf, &'static str> {
        Ok(self
            .path
            .as_ref()
            .and_then(|path| path.parent())
            .ok_or("ssh_resource_registry_unavailable")?
            .join("private"))
    }

    fn create_candidate(
        &self,
        revision: u64,
        static_active: &SshConfig,
        endpoint: SshEndpoint,
        authentication: webcodex_core::ssh_resource::SshAuthentication,
        key: HostKey,
    ) -> Result<ConnectionCandidate, &'static str> {
        let path = self
            .path
            .as_deref()
            .ok_or("ssh_resource_registry_unavailable")?;
        let lock = self
            .lock_path
            .as_deref()
            .ok_or("ssh_resource_registry_unavailable")?;
        // Serialize only private file creation + lease acquisition with GC.
        // No registry or challenge lock is held during network operations.
        with_registry_lock(lock, || {
            let registry = load_registry(path)?;
            ensure_no_static_collision(&registry, static_active)?;
            if registry.revision != revision {
                return Err("ssh_resource_registry_stale");
            }
            ConnectionCandidate::create(&self.private_root()?, endpoint, authentication, key)
        })
    }

    fn select_host_key(
        &self,
        endpoint: &SshEndpoint,
        revision: u64,
        generation: u64,
        trust: &SshHostKeyTrust,
        consume: bool,
    ) -> Result<HostKey, &'static str> {
        let mut challenges = lock_unpoison(&self.challenges);
        let now = Instant::now();
        challenges.0.retain(|_, challenge| challenge.deadline > now);
        let challenge = challenges
            .0
            .get(&trust.challenge_id)
            .ok_or("ssh_host_key_stale")?;
        if &challenge.endpoint != endpoint
            || challenge.revision != revision
            || challenge.generation != generation
        {
            return Err("ssh_host_key_stale");
        }
        let selected = challenge
            .keys
            .iter()
            .find(|key| key.fingerprint == trust.fingerprint)
            .cloned()
            .ok_or("ssh_host_key_stale")?;
        if consume {
            challenges.0.remove(&trust.challenge_id);
        }
        Ok(selected)
    }
}

fn ssh_program(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

fn scan_host_keys(
    endpoint: &SshEndpoint,
    stop: Option<&AtomicBool>,
) -> Result<Vec<HostKey>, &'static str> {
    endpoint.validate()?;
    let mut command = Command::new(ssh_program("ssh-keyscan"));
    command
        .arg("-T")
        .arg("5")
        .arg("-p")
        .arg(endpoint.port.to_string())
        .arg("-t")
        .arg("ed25519,ecdsa,rsa")
        .arg(&endpoint.host);
    let output = bounded_output(&mut command, stop)?;
    let mut keys = BTreeMap::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        if line.starts_with('#') {
            continue;
        }
        let fields = line.split_ascii_whitespace().collect::<Vec<_>>();
        if fields.len() != 3 {
            continue;
        }
        let Ok(key) = HostKey::parse(fields[1], fields[2]) else {
            continue;
        };
        keys.insert(key.fingerprint.clone(), key);
        if keys.len() > SSH_HOST_KEY_MAX_COUNT {
            return Err("ssh_host_key_unavailable");
        }
    }
    if keys.is_empty() {
        return Err("ssh_host_key_unavailable");
    }
    Ok(keys.into_values().collect())
}

fn probe_command(
    connection: &ManagedSshConnection,
) -> Result<(Command, Option<AskpassLease>), &'static str> {
    let mut command = Command::new(ssh_program("ssh"));
    let lease = connection.configure(&mut command, true)?;
    command
        // This fixed authentication probe never has program input. Tell SSH
        // explicitly, rather than relying on inherited Windows NUL semantics.
        // Actual remote execution keeps its stdin/program transport unchanged.
        .arg("-n")
        .arg("-T")
        .arg("-o")
        .arg("LogLevel=ERROR")
        .arg(&connection.stored.endpoint.host)
        .arg("echo WEBCODEX_SSH_CONNECTION_OK");
    Ok((command, lease))
}

fn probe_connection(
    candidate: &ConnectionCandidate,
    stop: Option<&AtomicBool>,
) -> Result<(), &'static str> {
    let (mut command, _lease) = probe_command(&candidate.connection)?;
    let output = bounded_output(&mut command, stop)?;
    if output.success
        && String::from_utf8_lossy(&output.stdout)
            .lines()
            .any(|line| line.trim_end_matches('\r') == "WEBCODEX_SSH_CONNECTION_OK")
    {
        Ok(())
    } else {
        Err(classify_failure(&output.stderr))
    }
}

pub(crate) fn classify_failure(stderr: &[u8]) -> &'static str {
    let stderr = String::from_utf8_lossy(stderr).to_ascii_lowercase();
    if stderr.contains("host key verification failed")
        || stderr.contains("remote host identification has changed")
        || stderr.contains("no matching host key type found")
    {
        "ssh_host_key_changed"
    } else if stderr.contains("unprotected private key file")
        || stderr.contains("bad owner or permissions")
        || stderr.contains("load key") && stderr.contains("permission denied")
        || stderr.contains("unix_listener:")
            && (stderr.contains("permission denied") || stderr.contains("operation not permitted"))
    {
        "ssh_client_permission_denied"
    } else if stderr.contains("permission denied") || stderr.contains("authentication failed") {
        "ssh_authentication_failed"
    } else if stderr.contains("identity file") || stderr.contains("load key") {
        "ssh_identity_file_invalid"
    } else if stderr.contains("timed out") || stderr.contains("timeout") {
        "ssh_connection_timeout"
    } else {
        "ssh_connection_failed"
    }
}

struct SetupOutput {
    success: bool,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

fn bounded_output(
    command: &mut Command,
    stop: Option<&AtomicBool>,
) -> Result<SetupOutput, &'static str> {
    if stop.is_some_and(|stop| stop.load(Ordering::SeqCst)) {
        return Err("ssh_connection_cancelled");
    }
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = ManagedChild::spawn(command).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "ssh_program_unavailable"
        } else {
            "ssh_connection_failed"
        }
    })?;
    let stdout = child
        .child_mut()
        .stdout
        .take()
        .ok_or("ssh_connection_failed")?;
    let stderr = child
        .child_mut()
        .stderr
        .take()
        .ok_or("ssh_connection_failed")?;
    let read = |mut reader: Box<dyn Read + Send>| {
        let (sender, receiver) = mpsc::sync_channel(1);
        std::thread::spawn(move || {
            let mut bytes = Vec::new();
            let result = Read::by_ref(&mut reader)
                .take(SETUP_OUTPUT_LIMIT as u64 + 1)
                .read_to_end(&mut bytes);
            let _ = sender.send(if result.is_ok() && bytes.len() <= SETUP_OUTPUT_LIMIT {
                Ok(bytes)
            } else {
                Err("ssh_connection_failed")
            });
        });
        receiver
    };
    let stdout = read(Box::new(stdout));
    let stderr = read(Box::new(stderr));
    let deadline = Instant::now() + SETUP_TIMEOUT;
    let status = loop {
        if stop.is_some_and(|stop| stop.load(Ordering::SeqCst)) {
            return Err("ssh_connection_cancelled");
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(10)),
            Ok(None) => return Err("ssh_connection_timeout"),
            Err(_) => return Err("ssh_connection_failed"),
        }
    };
    // Reap/stop the complete owned tree before waiting for pipe drain. A child
    // that inherits a pipe cannot hold this administrative request open.
    drop(child);
    Ok(SetupOutput {
        success: status.success(),
        stdout: stdout
            .recv_timeout(Duration::from_secs(1))
            .map_err(|_| "ssh_connection_failed")??,
        stderr: stderr
            .recv_timeout(Duration::from_secs(1))
            .map_err(|_| "ssh_connection_failed")??,
    })
}

#[cfg(test)]
mod tests;
