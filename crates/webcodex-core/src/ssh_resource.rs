//! Closed contracts for Runner-local managed SSH resource onboarding.
//!
//! The raw SSH target is intentionally request-only. Responses contain logical
//! names and lifecycle metadata, never host/user/port/authentication material.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

mod connection;
pub use connection::*;
mod verification;
pub use verification::*;

pub const SSH_RESOURCE_NAME_MAX_BYTES: usize = 80;
pub const SSH_RESOURCE_TARGET_MAX_BYTES: usize = 512;
pub const SSH_RESOURCE_DEFAULT_CWD_MAX_BYTES: usize = 4_096;
pub const MANAGED_SSH_RESOURCE_MAX_COUNT: usize = 64;
pub const MANAGED_SSH_REGISTRY_MAX_BYTES: usize = 64 * 1024;
pub const SSH_RESOURCE_REQUEST_MAX_BYTES: usize = 32 * 1024;
pub const SSH_RESOURCE_RESPONSE_MAX_BYTES: usize = 64 * 1024;
const SSH_RESOURCE_ERROR_MESSAGE_MAX_BYTES: usize = 512;

pub fn validate_ssh_resource_name(name: &str) -> Result<(), &'static str> {
    if name.is_empty() || name.len() > SSH_RESOURCE_NAME_MAX_BYTES {
        return Err("ssh_resource_invalid");
    }
    if name == "."
        || name.contains("..")
        || name.starts_with('-')
        || name.contains('/')
        || name.contains('\\')
        || !name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.'))
    {
        return Err("ssh_resource_invalid");
    }
    Ok(())
}

pub fn normalize_ssh_resource_target(target: &str) -> Result<String, &'static str> {
    let target = target.trim();
    if target.is_empty()
        || target.len() > SSH_RESOURCE_TARGET_MAX_BYTES
        || target.starts_with('-')
        || target.chars().any(char::is_control)
    {
        return Err("ssh_resource_invalid");
    }
    Ok(target.to_string())
}

pub fn normalize_ssh_resource_default_cwd(
    default_cwd: Option<&str>,
) -> Result<Option<String>, &'static str> {
    let Some(default_cwd) = default_cwd else {
        return Ok(None);
    };
    let default_cwd = default_cwd.trim();
    if default_cwd.is_empty()
        || default_cwd.len() > SSH_RESOURCE_DEFAULT_CWD_MAX_BYTES
        || default_cwd.chars().any(char::is_control)
    {
        return Err("ssh_resource_invalid");
    }
    Ok(Some(default_cwd.to_string()))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SshResourceSource {
    Static,
    Managed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SshResourceInventoryEntry {
    pub name: String,
    pub source: SshResourceSource,
    pub active: bool,
    pub pending_restart: bool,
}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum SshResourceRequest {
    List,
    Status,
    VerifySaved {
        expected_revision: u64,
        name: String,
    },
    Inspect {
        expected_revision: u64,
        endpoint: SshEndpoint,
    },
    Probe {
        expected_revision: u64,
        endpoint: SshEndpoint,
        authentication: SshAuthentication,
        host_key: SshHostKeyTrust,
    },
    RegisterConnection {
        expected_revision: u64,
        name: String,
        endpoint: SshEndpoint,
        authentication: SshAuthentication,
        host_key: SshHostKeyTrust,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        default_cwd: Option<String>,
    },
    Register {
        expected_revision: u64,
        name: String,
        target: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        default_cwd: Option<String>,
    },
    Remove {
        expected_revision: u64,
        name: String,
    },
}

impl std::fmt::Debug for SshResourceRequest {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let (action, name) = match self {
            Self::List => ("list", None),
            Self::Status => ("status", None),
            Self::VerifySaved { name, .. } => ("verify_saved", Some(name)),
            Self::Inspect { .. } => ("inspect", None),
            Self::Probe { .. } => ("probe", None),
            Self::RegisterConnection { name, .. } => ("register_connection", Some(name)),
            Self::Register { name, .. } => ("register", Some(name)),
            Self::Remove { name, .. } => ("remove", Some(name)),
        };
        formatter
            .debug_struct("SshResourceRequest")
            .field("action", &action)
            .field("resource_name", &name)
            .finish_non_exhaustive()
    }
}

impl SshResourceRequest {
    pub fn validate(&self) -> Result<(), &'static str> {
        match self {
            Self::List | Self::Status => Ok(()),
            Self::Inspect { endpoint, .. } => endpoint.validate(),
            Self::Probe {
                endpoint,
                authentication,
                host_key,
                ..
            } => {
                endpoint.validate()?;
                authentication.validate()?;
                host_key.validate()
            }
            Self::RegisterConnection {
                name,
                endpoint,
                authentication,
                host_key,
                default_cwd,
                ..
            } => {
                validate_ssh_resource_name(name)?;
                endpoint.validate()?;
                authentication.validate()?;
                host_key.validate()?;
                normalize_ssh_resource_default_cwd(default_cwd.as_deref())?;
                Ok(())
            }
            Self::Register {
                name,
                target,
                default_cwd,
                ..
            } => {
                validate_ssh_resource_name(name)?;
                normalize_ssh_resource_target(target)?;
                normalize_ssh_resource_default_cwd(default_cwd.as_deref())?;
                Ok(())
            }
            Self::Remove { name, .. } | Self::VerifySaved { name, .. } => {
                validate_ssh_resource_name(name)
            }
        }
    }

    pub fn requires_connection_setup(&self) -> bool {
        matches!(
            self,
            Self::Inspect { .. }
                | Self::Probe { .. }
                | Self::RegisterConnection { .. }
                | Self::VerifySaved { .. }
        )
    }

    pub fn requires_verification_history(&self) -> bool {
        matches!(self, Self::Status | Self::VerifySaved { .. })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum SshResourceResponse {
    Status {
        revision: u64,
        resources: Vec<SshResourceInventoryEntry>,
        verifications: Vec<SshResourceVerificationEntry>,
        verification_unavailable: bool,
    },
    VerifySaved {
        revision: u64,
        resource: String,
        persisted: bool,
        verification: SshVerification,
    },
    Inspect {
        revision: u64,
        challenge_id: String,
        expires_at: i64,
        host_keys: Vec<SshHostKeyCandidate>,
    },
    Probe {
        revision: u64,
        host_key_fingerprint: String,
    },
    List {
        revision: u64,
        resources: Vec<SshResourceInventoryEntry>,
    },
    Register {
        revision: u64,
        resource: String,
        persisted: bool,
        active: bool,
        restart_required: bool,
    },
    Remove {
        revision: u64,
        resource: String,
        persisted: bool,
        active: bool,
        restart_required: bool,
    },
    Error {
        code: String,
        message: String,
    },
}

impl SshResourceResponse {
    pub fn error(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Error {
            code: code.into(),
            message: message.into(),
        }
    }
}

/// Validate one Runner response against the exact managed-SSH operation that
/// produced it. A stale or buggy Runner response must not change the logical
/// resource, response kind, lifecycle state, or output bounds after dispatch.
pub fn validate_response_for_request(
    request: &SshResourceRequest,
    response: &SshResourceResponse,
) -> Result<(), &'static str> {
    let encoded = serde_json::to_vec(response).map_err(|_| "ssh_resource_invalid")?;
    if encoded.len() > SSH_RESOURCE_RESPONSE_MAX_BYTES {
        return Err("ssh_resource_invalid");
    }

    if let SshResourceResponse::Error { code, message } = response {
        if !matches!(
            code.as_str(),
            "ssh_resource_not_found"
                | "ssh_resource_static_conflict"
                | "ssh_resource_static_read_only"
                | "ssh_resource_name_conflict"
                | "ssh_resource_registry_stale"
                | "ssh_resource_registry_unavailable"
                | "ssh_resource_outcome_unknown"
                | "ssh_resource_invalid"
                | "ssh_connection_setup_unsupported"
                | "ssh_host_key_unavailable"
                | "ssh_host_key_stale"
                | "ssh_host_key_changed"
                | "ssh_authentication_failed"
                | "ssh_connection_failed"
                | "ssh_connection_timeout"
                | "ssh_program_unavailable"
                | "ssh_identity_file_invalid"
                | "ssh_credentials_unavailable"
                | "ssh_client_permission_denied"
                | "ssh_connection_cancelled"
        ) || message.is_empty()
            || message.len() > SSH_RESOURCE_ERROR_MESSAGE_MAX_BYTES
            || message.chars().any(char::is_control)
        {
            return Err("ssh_resource_invalid");
        }
        return Ok(());
    }

    match (request, response) {
        (
            SshResourceRequest::Status,
            SshResourceResponse::Status {
                resources,
                verifications,
                verification_unavailable,
                ..
            },
        ) => {
            validate_inventory(resources)?;
            if verifications.len() > resources.len() {
                return Err("ssh_resource_invalid");
            }
            let mut previous: Option<&str> = None;
            for entry in verifications {
                if previous.is_some_and(|name| name >= entry.name.as_str())
                    || !resources.iter().any(|resource| {
                        resource.name == entry.name && resource.source == SshResourceSource::Managed
                    })
                {
                    return Err("ssh_resource_invalid");
                }
                if let Some(verification) = &entry.verification {
                    if *verification_unavailable {
                        return Err("ssh_resource_invalid");
                    }
                    verification.validate()?;
                }
                previous = Some(&entry.name);
            }
            Ok(())
        }
        (
            SshResourceRequest::VerifySaved {
                expected_revision,
                name,
            },
            SshResourceResponse::VerifySaved {
                revision,
                resource,
                persisted,
                verification,
            },
        ) => {
            validate_ssh_resource_name(resource)?;
            if resource != name || !persisted || revision != expected_revision {
                return Err("ssh_resource_invalid");
            }
            verification.validate()
        }
        (
            SshResourceRequest::Inspect {
                expected_revision, ..
            },
            SshResourceResponse::Inspect {
                revision,
                challenge_id,
                expires_at,
                host_keys,
            },
        ) => {
            if revision != expected_revision
                || *expires_at <= 0
                || host_keys.is_empty()
                || host_keys.len() > SSH_HOST_KEY_MAX_COUNT
            {
                return Err("ssh_resource_invalid");
            }
            let mut fingerprints = HashSet::new();
            for key in host_keys {
                key.validate()?;
                SshHostKeyTrust {
                    challenge_id: challenge_id.clone(),
                    fingerprint: key.fingerprint.clone(),
                }
                .validate()?;
                if !fingerprints.insert(&key.fingerprint) {
                    return Err("ssh_resource_invalid");
                }
            }
            Ok(())
        }
        (
            SshResourceRequest::Probe {
                expected_revision,
                host_key,
                ..
            },
            SshResourceResponse::Probe {
                revision,
                host_key_fingerprint,
            },
        ) if revision == expected_revision && host_key_fingerprint == &host_key.fingerprint => {
            validate_fingerprint(host_key_fingerprint)
        }
        (SshResourceRequest::List, SshResourceResponse::List { resources, .. }) => {
            validate_inventory(resources)
        }
        (
            SshResourceRequest::Register {
                expected_revision,
                name,
                ..
            }
            | SshResourceRequest::RegisterConnection {
                expected_revision,
                name,
                ..
            },
            SshResourceResponse::Register {
                revision,
                resource,
                persisted,
                active,
                restart_required,
            },
        ) => {
            validate_ssh_resource_name(resource)?;
            if resource != name
                || !persisted
                || *restart_required != !*active
                || (*revision != *expected_revision
                    && expected_revision.checked_add(1) != Some(*revision))
            {
                return Err("ssh_resource_invalid");
            }
            Ok(())
        }
        (
            SshResourceRequest::Remove {
                expected_revision,
                name,
            },
            SshResourceResponse::Remove {
                revision,
                resource,
                persisted,
                active,
                restart_required,
            },
        ) => {
            validate_ssh_resource_name(resource)?;
            if resource != name
                || !persisted
                || *restart_required != *active
                || expected_revision.checked_add(1) != Some(*revision)
            {
                return Err("ssh_resource_invalid");
            }
            Ok(())
        }
        _ => Err("ssh_resource_invalid"),
    }
}

fn validate_inventory(resources: &[SshResourceInventoryEntry]) -> Result<(), &'static str> {
    let mut names = HashSet::with_capacity(resources.len());
    let mut previous: Option<&str> = None;
    for resource in resources {
        validate_ssh_resource_name(&resource.name)?;
        if !names.insert(resource.name.as_str())
            || previous.is_some_and(|previous| previous >= resource.name.as_str())
        {
            return Err("ssh_resource_invalid");
        }
        previous = Some(resource.name.as_str());
        match resource.source {
            SshResourceSource::Static if resource.active && !resource.pending_restart => {}
            SshResourceSource::Managed if resource.active || resource.pending_restart => {}
            _ => return Err("ssh_resource_invalid"),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_is_single_destination_not_ssh_argv() {
        assert_eq!(
            normalize_ssh_resource_target("17724@w10").unwrap(),
            "17724@w10"
        );
        for invalid in ["", "   ", "-oProxyJump=x", "-p", "host\nnext"] {
            assert!(
                normalize_ssh_resource_target(invalid).is_err(),
                "{invalid:?}"
            );
        }
    }

    #[test]
    fn resource_name_is_safe_atom_and_not_option_syntax() {
        for valid in ["spe", "w10", "team.prod_1"] {
            validate_ssh_resource_name(valid).unwrap();
        }
        for invalid in ["-o", "a/b", "a\\b", ".", "..", "white space"] {
            assert!(validate_ssh_resource_name(invalid).is_err(), "{invalid:?}");
        }
    }

    #[test]
    fn response_admission_is_request_correlated_bounded_and_semantic() {
        let register = SshResourceRequest::Register {
            expected_revision: 7,
            name: "w10".to_string(),
            target: "17724@w10".to_string(),
            default_cwd: None,
        };
        validate_response_for_request(
            &register,
            &SshResourceResponse::Register {
                revision: 8,
                resource: "w10".to_string(),
                persisted: true,
                active: false,
                restart_required: true,
            },
        )
        .unwrap();
        assert!(validate_response_for_request(
            &register,
            &SshResourceResponse::Register {
                revision: 8,
                resource: "other".to_string(),
                persisted: true,
                active: false,
                restart_required: true,
            },
        )
        .is_err());
        assert!(validate_response_for_request(
            &register,
            &SshResourceResponse::Register {
                revision: 8,
                resource: "w10".to_string(),
                persisted: true,
                active: true,
                restart_required: true,
            },
        )
        .is_err());

        let list = SshResourceRequest::List;
        validate_response_for_request(
            &list,
            &SshResourceResponse::List {
                revision: 9,
                resources: vec![
                    SshResourceInventoryEntry {
                        name: "spe".to_string(),
                        source: SshResourceSource::Static,
                        active: true,
                        pending_restart: false,
                    },
                    SshResourceInventoryEntry {
                        name: "w10".to_string(),
                        source: SshResourceSource::Managed,
                        active: false,
                        pending_restart: true,
                    },
                ],
            },
        )
        .unwrap();
        assert!(validate_response_for_request(
            &list,
            &SshResourceResponse::List {
                revision: 9,
                resources: vec![SshResourceInventoryEntry {
                    name: "w10".to_string(),
                    source: SshResourceSource::Managed,
                    active: false,
                    pending_restart: false,
                }],
            },
        )
        .is_err());
    }
}
