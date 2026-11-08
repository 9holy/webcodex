//! Safe, bounded evidence about the most recent explicit connection check.
//! This is history for a saved configuration, never a live-connectivity lease.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SshVerificationError {
    SshHostKeyChanged,
    SshAuthenticationFailed,
    SshConnectionFailed,
    SshConnectionTimeout,
    SshProgramUnavailable,
    SshIdentityFileInvalid,
    SshCredentialsUnavailable,
    SshClientPermissionDenied,
}

impl SshVerificationError {
    pub fn from_code(code: &str) -> Option<Self> {
        Some(match code {
            "ssh_host_key_changed" => Self::SshHostKeyChanged,
            "ssh_authentication_failed" => Self::SshAuthenticationFailed,
            "ssh_connection_failed" => Self::SshConnectionFailed,
            "ssh_connection_timeout" => Self::SshConnectionTimeout,
            "ssh_program_unavailable" => Self::SshProgramUnavailable,
            "ssh_identity_file_invalid" => Self::SshIdentityFileInvalid,
            "ssh_credentials_unavailable" => Self::SshCredentialsUnavailable,
            "ssh_client_permission_denied" => Self::SshClientPermissionDenied,
            _ => return None,
        })
    }

    pub fn code(self) -> &'static str {
        match self {
            Self::SshHostKeyChanged => "ssh_host_key_changed",
            Self::SshAuthenticationFailed => "ssh_authentication_failed",
            Self::SshConnectionFailed => "ssh_connection_failed",
            Self::SshConnectionTimeout => "ssh_connection_timeout",
            Self::SshProgramUnavailable => "ssh_program_unavailable",
            Self::SshIdentityFileInvalid => "ssh_identity_file_invalid",
            Self::SshCredentialsUnavailable => "ssh_credentials_unavailable",
            Self::SshClientPermissionDenied => "ssh_client_permission_denied",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SshVerification {
    pub checked_at: i64,
    pub error_kind: Option<SshVerificationError>,
}

impl SshVerification {
    pub fn validate(&self) -> Result<(), &'static str> {
        // Unix seconds, bounded to the representable public calendar (year 9999).
        if !(1..=253_402_300_799).contains(&self.checked_at) {
            return Err("ssh_resource_invalid");
        }
        Ok(())
    }
}

/// Only durable direct connections are eligible for a saved-credential probe.
/// A missing record explicitly means this configuration has no recorded check.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SshResourceVerificationEntry {
    pub name: String,
    pub verification: Option<SshVerification>,
}
