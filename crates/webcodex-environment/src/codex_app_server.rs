//! Install the exact bundled experimental Codex adapter without a download.
//!
//! Preparing a provider is separate from saving/enabling it and from granting
//! Runner or approval authority. Callers own executable selection and process
//! supervision; this module only materializes immutable, private source bytes.

use crate::process::CommandOutputExt;
use crate::storage::{
    ensure_private_directory, is_link, open_existing_private, open_private, read_private,
    validate_existing_private_directory,
};
use crate::{SetupDiagnostic, SetupResultValue};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

const SOURCES: &[(&str, &[u8])] = &[
    (
        "adapter.py",
        include_bytes!("../../../integrations/codex_app_server/adapter.py"),
    ),
    (
        "compatibility.py",
        include_bytes!("../../../integrations/codex_app_server/compatibility.py"),
    ),
    (
        "__main__.py",
        include_bytes!("../../../integrations/codex_app_server/__main__.py"),
    ),
];

fn changed() -> SetupDiagnostic {
    SetupDiagnostic::new(
        "codex_adapter_resources_changed",
        "The installed Codex adapter no longer matches this WebCodex build",
        "Restore the adapter from the same WebCodex installer before preparing it again",
    )
}

fn source_digest() -> String {
    let mut digest = Sha256::new();
    for (name, bytes) in SOURCES {
        digest.update(name.as_bytes());
        digest.update([0]);
        digest.update((bytes.len() as u64).to_be_bytes());
        digest.update(bytes);
    }
    format!("{:x}", digest.finalize())
}

fn verify_sources(directory: &Path) -> SetupResultValue<()> {
    validate_existing_private_directory(directory)?;
    for (name, expected) in SOURCES {
        if read_private(&directory.join(name))? != *expected {
            return Err(changed());
        }
    }
    Ok(())
}

/// Return an absolute path to the bundled `adapter.py`. Each content generation
/// has its own directory so an upgrade cannot replace code beneath a saved live
/// provider. Existing modified files are never repaired by overwriting them.
pub fn ensure_adapter_resources(config_root: &Path) -> SetupResultValue<PathBuf> {
    if !config_root.is_absolute() {
        return Err(SetupDiagnostic::new(
            "codex_adapter_path",
            "The Codex adapter requires an absolute configuration directory",
            "Use the selected WebCodex environment's private configuration directory",
        ));
    }
    let root = config_root.join("coding-agent-adapters");
    ensure_private_directory(&root)?;
    let lock_path = root.join("codex-app-server.lock");
    // A concurrent first preparation may win create_new. Reopening still uses
    // the shared ownership, no-link and private-permission validation.
    let lock =
        open_private(&lock_path, true).or_else(|_| open_existing_private(&lock_path, true))?;
    lock.try_lock_exclusive().map_err(|_| {
        SetupDiagnostic::new(
            "codex_adapter_preparation_busy",
            "Another Codex adapter preparation is in progress",
            "Wait for that preparation to finish, then retry",
        )
    })?;
    let directory = root.join(format!("codex-app-server-{}", source_digest()));
    match std::fs::symlink_metadata(&directory) {
        Ok(_) => verify_sources(&directory)?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let staging = root.join(format!(".codex-adapter-{}", uuid::Uuid::new_v4().simple()));
            ensure_private_directory(&staging)?;
            let installed: SetupResultValue<()> = (|| {
                for (name, bytes) in SOURCES {
                    let mut file = open_private(&staging.join(name), true)?;
                    file.write_all(bytes)
                        .and_then(|()| file.sync_all())
                        .map_err(|_| SetupDiagnostic::io())?;
                }
                verify_sources(&staging)?;
                std::fs::rename(&staging, &directory).map_err(|_| SetupDiagnostic::io())?;
                Ok(())
            })();
            if installed.is_err() {
                // This UUID directory is owned by this invocation and has never
                // been returned as a provider entry point.
                let _ = std::fs::remove_dir_all(&staging);
            }
            installed?;
        }
        Err(_) => return Err(SetupDiagnostic::io()),
    }
    verify_sources(&directory)?;
    Ok(directory.join("adapter.py"))
}

/// Local operator input. This does not grant ACP execution or approval scopes,
/// save a Desktop profile, change Runner TOML, or restart a service.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct PrepareCodexOptions {
    pub config_dir: PathBuf,
    pub python_bin: Option<PathBuf>,
    pub codex_bin: Option<PathBuf>,
    pub codex_args: Vec<String>,
    pub expected_version: Option<String>,
}

/// Exact adapter-produced profile, ready for a native configuration owner to
/// review and save through its normal revision/ownership checks.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct PreparedCodexProfile {
    pub provider_id: String,
    pub name: String,
    pub executable: String,
    pub args: Vec<String>,
    pub enabled: bool,
    pub env_from_env: BTreeMap<String, String>,
    pub allowed_config_options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct PreparedCodex {
    pub status: String,
    pub codex_version: String,
    pub receipt: String,
    pub profile: PreparedCodexProfile,
}

fn preparation_error(kind: &str) -> SetupDiagnostic {
    let (code, message, recovery) = match kind {
        "codex_not_found" | "codex_requires_native_executable" => (
            "codex_not_found", "A native Codex executable was not found",
            "Install Codex CLI or select its native executable; Windows command wrappers require the native executable or an explicit Node launcher"),
        "codex_version_mismatch" | "codex_changed_during_prepare" => (
            "codex_version_mismatch", "The installed Codex does not match the requested version",
            "Select the intended installation and prepare it again; no provider was enabled"),
        "codex_schema_incompatible" | "codex_schema_unavailable" => (
            "codex_schema_incompatible", "This Codex version does not expose the required app-server protocol",
            "Use a compatible Codex version and repeat preparation; changing a version string does not bypass protocol validation"),
        "codex_probe_timeout" => (
            "codex_probe_timeout", "Codex compatibility preparation exceeded its deadline",
            "Check that the selected executable can run locally, then prepare again"),
        _ => (
            "codex_prepare_failed", "Codex compatibility preparation failed",
            "Check the selected Codex executable and private configuration directory, then prepare again"),
    };
    SetupDiagnostic::new(code, message, recovery)
}

fn python_unavailable() -> SetupDiagnostic {
    SetupDiagnostic::new(
        "codex_python_unavailable",
        "The Codex adapter requires Python 3.10 or newer",
        "Install Python 3.10+ and make it available on PATH, or select its native executable",
    )
}

/// Probe an explicit interpreter, or Python on PATH. Every attempt uses the
/// existing bounded process-tree supervisor and absent stdin is always EOF.
pub fn probe_python(explicit: Option<&Path>) -> SetupResultValue<PathBuf> {
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Probe {
        executable: String,
        supported: bool,
    }
    let candidates = explicit
        .map(|path| vec![path.to_path_buf()])
        .unwrap_or_else(|| vec![PathBuf::from("python3"), PathBuf::from("python")]);
    for candidate in candidates {
        let output = Command::new(candidate)
            .args(["-I", "-c", "import json,sys; print(json.dumps({'executable':sys.executable,'supported':sys.version_info >= (3,10)}))"])
            .output_with_limits(Duration::from_secs(5), 8192);
        let Ok(output) = output else { continue };
        if !output.status.success() {
            continue;
        }
        let Ok(probe) = serde_json::from_slice::<Probe>(&output.stdout) else {
            continue;
        };
        if probe.supported
            && probe.executable.len() <= 4096
            && !probe.executable.chars().any(char::is_control)
            && Path::new(&probe.executable).is_absolute()
            && Path::new(&probe.executable).is_file()
        {
            return Ok(PathBuf::from(probe.executable));
        }
    }
    Err(python_unavailable())
}

fn validate_prepared(
    prepared: &PreparedCodex,
    python: &Path,
    adapter: &Path,
    receipt: &Path,
) -> SetupResultValue<()> {
    let profile = &prepared.profile;
    let expected_args = vec![
        adapter.to_string_lossy().into_owned(),
        "serve".into(),
        "--experimental".into(),
        "--receipt".into(),
        receipt.to_string_lossy().into_owned(),
    ];
    const ENV_NAMES: &[&str] = &[
        "PATH",
        "HOME",
        "USERPROFILE",
        "APPDATA",
        "LOCALAPPDATA",
        "SystemRoot",
        "CODEX_HOME",
        "OPENAI_API_KEY",
        "HTTPS_PROXY",
        "HTTP_PROXY",
        "NO_PROXY",
        "SSL_CERT_FILE",
        "SSL_CERT_DIR",
    ];
    if prepared.status != "ready"
        || prepared.codex_version.is_empty()
        || prepared.codex_version.len() > 96
        || !prepared
            .codex_version
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b".+-".contains(&byte))
        || Path::new(&prepared.receipt) != receipt
        || profile.provider_id != "codex-app-server"
        || profile.name != "Codex app-server (experimental)"
        || Path::new(&profile.executable) != python
        || profile.args != expected_args
        || profile.enabled
        || !profile.allowed_config_options.is_empty()
        || profile.env_from_env.len() > ENV_NAMES.len()
        || profile
            .env_from_env
            .iter()
            .any(|(key, value)| key != value || !ENV_NAMES.contains(&key.as_str()))
    {
        return Err(preparation_error("invalid_profile"));
    }
    Ok(())
}

/// A destination reserved by this preparation, never an existing provider's
/// receipt. Python atomically replaces this slot; the host then applies the
/// same private-file contract used for the bundled source files.
struct NewReceipt {
    path: PathBuf,
}

impl NewReceipt {
    fn reserve(directory: &Path) -> SetupResultValue<Self> {
        validate_existing_private_directory(directory)?;
        let path = directory.join(format!(
            "codex-compatibility-{}.json",
            uuid::Uuid::new_v4().simple()
        ));
        // A create_new failure returns before any child runs or cleanup owns
        // this name. Never adopt or remove a pre-existing file on collision.
        drop(open_private(&path, true)?);
        Ok(Self { path })
    }

    fn finish(&self) -> SetupResultValue<()> {
        let parent = self.path.parent().ok_or_else(SetupDiagnostic::io)?;
        validate_existing_private_directory(parent)?;
        let metadata = std::fs::symlink_metadata(&self.path).map_err(|_| SetupDiagnostic::io())?;
        if !metadata.is_file()
            || is_link(&metadata)
            || metadata.len() == 0
            || metadata.len() > 16 * 1024
        {
            return Err(SetupDiagnostic::io());
        }
        #[cfg(windows)]
        let _guard = self.secure_windows_file()?;
        // Keep the Windows guard alive through the existing owner/ACL and
        // bounded-content validation; none of those checks are bypassed.
        let bytes = read_private(&self.path)?;
        if bytes.is_empty() || bytes.len() > 16 * 1024 {
            return Err(preparation_error("invalid_receipt"));
        }
        Ok(())
    }

    #[cfg(windows)]
    fn secure_windows_file(&self) -> SetupResultValue<std::fs::File> {
        use std::os::windows::fs::OpenOptionsExt;
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::Storage::FileSystem::{
            GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_DIRECTORY,
            FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_READ,
        };
        let file = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
            .open(&self.path)
            .map_err(|_| SetupDiagnostic::io())?;
        let mut information: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
        if unsafe { GetFileInformationByHandle(file.as_raw_handle().cast(), &mut information) } == 0
            || information.dwFileAttributes
                & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)
                != 0
            || information.nNumberOfLinks != 1
            || information.nFileSizeHigh != 0
            || information.nFileSizeLow == 0
            || information.nFileSizeLow > 16 * 1024
        {
            return Err(SetupDiagnostic::io());
        }
        // mkstemp inherits a DACL, but its default token owner may be a group.
        // Normalize only this fresh, single-link file while the guard denies
        // data writes, rename and deletion. Reuse the existing native policy.
        crate::storage::secure_windows_path(&self.path)?;
        Ok(file)
    }

    fn discard(&self) {
        // Do not follow a replaced directory during failure cleanup. The
        // supervisor has already stopped the entire preparation process tree.
        if self
            .path
            .parent()
            .is_some_and(|parent| validate_existing_private_directory(parent).is_ok())
        {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

/// Prepare the bundled adapter against the exact installed Codex. Compatibility
/// readiness does not prove account access, model availability, or OS sandbox
/// readiness. Those are checked when the independently authorized Run starts.
pub fn prepare_codex(options: &PrepareCodexOptions) -> SetupResultValue<PreparedCodex> {
    if !options.config_dir.is_absolute()
        || options.codex_args.len() > 8
        || options
            .codex_args
            .iter()
            .any(|arg| arg.len() > 4096 || arg.contains('\0'))
        || options.expected_version.as_deref().is_some_and(|value| {
            value.is_empty()
                || value.len() > 96
                || !value
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || b".+-".contains(&byte))
        })
    {
        return Err(preparation_error("invalid_options"));
    }
    let python = probe_python(options.python_bin.as_deref())?;
    let adapter = std::fs::canonicalize(ensure_adapter_resources(&options.config_dir)?)
        .map_err(|_| preparation_error("invalid_adapter"))?;
    let directory = adapter
        .parent()
        .ok_or_else(|| preparation_error("invalid_adapter"))?;
    let receipt = NewReceipt::reserve(directory)?;
    let mut command = Command::new(&python);
    command
        .arg("-E")
        .arg(&adapter)
        .args(["prepare", "--experimental", "--receipt"])
        .arg(&receipt.path)
        .arg("--codex-bin")
        .arg(
            options
                .codex_bin
                .as_deref()
                .unwrap_or_else(|| Path::new("codex")),
        );
    for arg in &options.codex_args {
        command.arg(format!("--codex-arg={arg}"));
    }
    if let Some(version) = &options.expected_version {
        command.arg("--expected-version").arg(version);
    }
    let result = (|| {
        let output = command
            .output_with_limits(Duration::from_secs(55), 128 * 1024)
            .map_err(|error| {
                preparation_error(if error.kind() == std::io::ErrorKind::TimedOut {
                    "codex_probe_timeout"
                } else {
                    "codex_prepare_failed"
                })
            })?;
        // Never relay stderr, raw Python output, paths in exceptions, or an
        // arbitrary provider-supplied error. Only controlled codes are public.
        if !output.status.success() {
            let value: serde_json::Value =
                serde_json::from_slice(&output.stdout).unwrap_or_default();
            return Err(preparation_error(
                value
                    .get("kind")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or(""),
            ));
        }
        let prepared: PreparedCodex = serde_json::from_slice(&output.stdout)
            .map_err(|_| preparation_error("invalid_profile"))?;
        validate_prepared(&prepared, &python, &adapter, &receipt.path)?;
        receipt.finish()?;
        Ok(prepared)
    })();
    if result.is_err() {
        // The UUID receipt belongs solely to this failed preparation; no saved
        // profile can reference it. The supervisor has already stopped its tree.
        receipt.discard();
    }
    result
}

#[cfg(test)]
mod tests;

#[cfg(test)]
mod preparation_tests;
