//! Operator-only SSH connection inputs. Secret values are write-only on public
//! surfaces; serialization exists only for the authenticated native transport.

use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;

pub const SSH_CONNECTION_SECRET_MAX_BYTES: usize = 4_096;
pub const SSH_CONNECTION_PATH_MAX_BYTES: usize = 4_096;
pub const SSH_HOST_KEY_MAX_COUNT: usize = 8;
pub const SSH_HOST_KEY_CHALLENGE_MAX_BYTES: usize = 128;
pub const SSH_HOST_KEY_CHALLENGE_TTL_SECS: i64 = 300;

#[derive(Clone, PartialEq, Eq)]
pub struct SshSecret(String);

impl SshSecret {
    pub fn new(value: String) -> Result<Self, &'static str> {
        if value.is_empty()
            || value.len() > SSH_CONNECTION_SECRET_MAX_BYTES
            || value.contains(['\0', '\r', '\n'])
        {
            return Err("ssh_resource_invalid");
        }
        Ok(Self(value))
    }

    pub fn expose_secret(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for SshSecret {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("[redacted]")
    }
}

impl Serialize for SshSecret {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for SshSecret {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = String::deserialize(deserializer)?;
        Self::new(value).map_err(|_| serde::de::Error::custom("invalid SSH credential"))
    }
}

impl Drop for SshSecret {
    fn drop(&mut self) {
        // Clear this owned allocation. Transport serialization has separately
        // bounded transient buffers; no secret is placed in diagnostic state.
        unsafe {
            for byte in self.0.as_bytes_mut() {
                std::ptr::write_volatile(byte, 0);
            }
        }
        std::sync::atomic::compiler_fence(std::sync::atomic::Ordering::SeqCst);
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SshEndpoint {
    pub host: String,
    pub port: u16,
    pub user: String,
}

impl SshEndpoint {
    pub fn validate(&self) -> Result<(), &'static str> {
        let host = self.host.as_str();
        let dns = host.strip_suffix('.').unwrap_or(host);
        let valid_host = host.parse::<std::net::IpAddr>().is_ok()
            || (!dns.is_empty()
                && dns.len() <= 253
                && dns.split('.').all(|label| {
                    !label.is_empty()
                        && label.len() <= 63
                        && !label.starts_with('-')
                        && !label.ends_with('-')
                        && label
                            .bytes()
                            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
                }));
        if !valid_host
            || self.port == 0
            || self.user.is_empty()
            || self.user.len() > 128
            || self.user.starts_with('-')
            || !self.user.bytes().all(|byte| {
                byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.' | b'\\' | b'@')
            })
        {
            return Err("ssh_resource_invalid");
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum SshAuthentication {
    ExistingEnvironment,
    Password {
        password: SshSecret,
    },
    IdentityFile {
        path: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        passphrase: Option<SshSecret>,
    },
}

impl SshAuthentication {
    pub fn validate(&self) -> Result<(), &'static str> {
        if let Self::IdentityFile { path, .. } = self {
            // The Runner rechecks host-native absolute-path and private-file
            // semantics. This protocol accepts Unix and Windows absolute paths.
            let windows_drive = path.as_bytes().get(1) == Some(&b':')
                && path.as_bytes().first().is_some_and(u8::is_ascii_alphabetic)
                && path
                    .as_bytes()
                    .get(2)
                    .is_some_and(|byte| matches!(byte, b'/' | b'\\'));
            if path.is_empty()
                || path.len() > SSH_CONNECTION_PATH_MAX_BYTES
                || path.chars().any(char::is_control)
                || !(path.starts_with('/') || windows_drive)
            {
                return Err("ssh_resource_invalid");
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SshHostKeyCandidate {
    pub algorithm: String,
    pub fingerprint: String,
}

impl SshHostKeyCandidate {
    pub fn validate(&self) -> Result<(), &'static str> {
        if !matches!(
            self.algorithm.as_str(),
            "ssh-ed25519"
                | "ssh-rsa"
                | "ecdsa-sha2-nistp256"
                | "ecdsa-sha2-nistp384"
                | "ecdsa-sha2-nistp521"
        ) {
            return Err("ssh_resource_invalid");
        }
        validate_fingerprint(&self.fingerprint)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SshHostKeyTrust {
    pub challenge_id: String,
    pub fingerprint: String,
}

impl SshHostKeyTrust {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.challenge_id.is_empty()
            || self.challenge_id.len() > SSH_HOST_KEY_CHALLENGE_MAX_BYTES
            || !self
                .challenge_id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
        {
            return Err("ssh_resource_invalid");
        }
        validate_fingerprint(&self.fingerprint)
    }
}

pub fn validate_fingerprint(fingerprint: &str) -> Result<(), &'static str> {
    use base64::Engine;
    let Some(digest) = fingerprint.strip_prefix("SHA256:") else {
        return Err("ssh_resource_invalid");
    };
    if digest.len() != 43
        || base64::engine::general_purpose::STANDARD_NO_PAD
            .decode(digest)
            .map_or(true, |bytes| bytes.len() != 32)
    {
        return Err("ssh_resource_invalid");
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum SshOperatorConnection {
    Alias {
        target: String,
    },
    Direct {
        endpoint: SshEndpoint,
        authentication: SshAuthentication,
        host_key: SshHostKeyTrust,
    },
}

#[cfg(test)]
#[path = "connection_tests.rs"]
mod tests;
