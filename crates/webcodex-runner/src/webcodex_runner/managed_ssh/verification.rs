//! Optional observation history, never an SSH resource or credential authority.
//! The published registry remains byte-format compatible with older Runners.

use super::*;
use webcodex_environment::private_files::{PrivateFileStore, PRIVATE_FILE_MAX_BYTES};

const HISTORY_FILE: &str = "verification-history.json";
const PENDING_FILE: &str = "verification-history.pending.json";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StoredVerification {
    binding: String,
    verification: SshVerification,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct VerificationHistory {
    version: u32,
    entries: BTreeMap<String, StoredVerification>,
}

impl Default for VerificationHistory {
    fn default() -> Self {
        Self {
            version: 1,
            entries: BTreeMap::new(),
        }
    }
}

impl VerificationHistory {
    fn root(registry_path: &Path) -> Result<PathBuf, &'static str> {
        Ok(registry_path
            .parent()
            .ok_or("ssh_resource_registry_unavailable")?
            .join("private"))
    }

    pub(super) fn binding(name: &str, resource: &ManagedResource) -> Result<String, &'static str> {
        // Includes the generated immutable credential UUID and selected host key,
        // not secret bytes. A history entry cannot redirect a saved connection.
        let bytes = serde_json::to_vec(&(
            name,
            &resource.target,
            &resource.default_cwd,
            &resource.connection,
        ))
        .map_err(|_| "ssh_resource_invalid")?;
        Ok(format!("{:x}", Sha256::digest(bytes)))
    }

    pub(super) fn get(&self, name: &str, resource: &ManagedResource) -> Option<SshVerification> {
        let record = self.entries.get(name)?;
        (resource.connection.is_some()
            && Self::binding(name, resource).ok().as_deref() == Some(record.binding.as_str()))
        .then(|| record.verification.clone())
    }

    pub(super) fn record(
        &mut self,
        registry: &ManagedRegistry,
        name: &str,
        resource: &ManagedResource,
        result: Result<(), &'static str>,
    ) -> Result<SshVerification, &'static str> {
        if resource.connection.is_none() {
            return Err("ssh_connection_setup_unsupported");
        }
        // Drop orphan/reconfigured records before admitting one new observation.
        // A failed register can leave evidence, but never unbounded history.
        self.entries.retain(|name, record| {
            registry.resources.get(name).is_some_and(|resource| {
                resource.connection.is_some()
                    && Self::binding(name, resource).ok().as_deref()
                        == Some(record.binding.as_str())
            })
        });
        let verification = SshVerification {
            checked_at: chrono::Utc::now().timestamp(),
            error_kind: match result {
                Ok(()) => None,
                Err(code) => Some(SshVerificationError::from_code(code).ok_or(code)?),
            },
        };
        verification.validate()?;
        self.entries.insert(
            name.to_string(),
            StoredVerification {
                binding: Self::binding(name, resource)?,
                verification: verification.clone(),
            },
        );
        self.validate()?;
        Ok(verification)
    }

    fn validate(&self) -> Result<(), &'static str> {
        if self.version != 1 || self.entries.len() > MANAGED_SSH_RESOURCE_MAX_COUNT {
            return Err("ssh_resource_invalid");
        }
        for (name, record) in &self.entries {
            validate_ssh_resource_name(name)?;
            if record.binding.len() != 64
                || !record.binding.bytes().all(|byte| byte.is_ascii_hexdigit())
            {
                return Err("ssh_resource_invalid");
            }
            record.verification.validate()?;
        }
        Ok(())
    }

    /// Call while holding the canonical registry lock. Missing history is unknown;
    /// every existing file is bounded and checked by the native private-file API.
    pub(super) fn load(registry_path: &Path) -> Result<Self, &'static str> {
        let root = Self::root(registry_path)?;
        if fs::symlink_metadata(&root)
            .is_err_and(|error| error.kind() == std::io::ErrorKind::NotFound)
        {
            return Ok(Self::default());
        }
        let store = PrivateFileStore::existing(&root).map_err(|_| "ssh_credentials_unavailable")?;
        let path = store
            .path(HISTORY_FILE)
            .map_err(|_| "ssh_credentials_unavailable")?;
        if fs::symlink_metadata(&path)
            .is_err_and(|error| error.kind() == std::io::ErrorKind::NotFound)
        {
            return Ok(Self::default());
        }
        let bytes = store
            .read(HISTORY_FILE, PRIVATE_FILE_MAX_BYTES)
            .map_err(|_| "ssh_credentials_unavailable")?;
        let history: Self = serde_json::from_slice(&bytes).map_err(|_| "ssh_resource_invalid")?;
        history.validate()?;
        Ok(history)
    }

    pub(super) fn write(&self, registry_path: &Path) -> Result<(), &'static str> {
        self.validate()?;
        let bytes = serde_json::to_vec(self).map_err(|_| "ssh_resource_invalid")?;
        if bytes.len() > PRIVATE_FILE_MAX_BYTES {
            return Err("ssh_resource_invalid");
        }
        // Validate the existing destination before replacement. Do not repair its
        // owner/ACL or overwrite an unsafe optional history file.
        Self::load(registry_path)?;
        let store = PrivateFileStore::open(&Self::root(registry_path)?)
            .map_err(|_| "ssh_credentials_unavailable")?;
        // One fixed, owner-checked staging name bounds crash leftovers. The same
        // registry lock serializes writers; this name never holds credentials.
        store
            .remove(PENDING_FILE)
            .map_err(|_| "ssh_credentials_unavailable")?;
        let temporary = store
            .create(PENDING_FILE, &bytes)
            .map_err(|_| "ssh_credentials_unavailable")?;
        let path = store
            .path(HISTORY_FILE)
            .map_err(|_| "ssh_credentials_unavailable")?;
        if replace_file_atomic(&temporary, &path).is_err() {
            let _ = store.remove(PENDING_FILE);
            return Err("ssh_resource_registry_unavailable");
        }
        sync_parent(&path).map_err(|_| "ssh_resource_outcome_unknown")?;
        Ok(())
    }
}
