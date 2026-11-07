//! Narrow, explicit first-party operator approval for an existing local Desktop
//! connection. No credential or hash is projected into the WebView or logs.
use crate::error::{DesktopError, DesktopResult};
use crate::models::StoredRuntime;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::io::AsyncReadExt;

const CAPABILITY_STATUS_HEADER: &str = "x-webcodex-runner-capability-status";
const CAPABILITY_STATUS_DETACHED: &str = "detached-execution-v1";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GrantRequest {
    pub expected: crate::webcodex::settings::SettingsTarget,
    pub confirmed: bool,
    #[serde(default)]
    pub permission_approval: bool,
    #[serde(default)]
    pub detached_execution: bool,
}

#[derive(Clone, Serialize)]
pub struct AuthorizationSnapshot {
    pub target: crate::webcodex::settings::SettingsTarget,
    pub can_authorize: bool,
    pub coding_agents: bool,
    pub ssh_resources: bool,
    pub permission_approval_granted: bool,
    pub permission_approval_grant_available: bool,
    pub detached_execution_granted: bool,
    pub detached_execution_grant_available: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ScopeStatus {
    coding_agents: bool,
    ssh_resources: bool,
    #[serde(default)]
    permission_approval: Option<bool>,
    #[serde(default)]
    detached_execution: Option<bool>,
}

/// Read with the current user token, never operator authority. No Runner, SSH
/// inventory, project, configured provider or local form history determines scopes.
pub async fn observe(runtime: &StoredRuntime) -> DesktopResult<AuthorizationSnapshot> {
    let mut url = url::Url::parse(&runtime.server_url).map_err(|_| unavailable())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(unavailable());
    }
    url.set_path("/api/pairing/runner-capabilities/status");
    let mut builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(15));
    if matches!(
        url.host_str(),
        Some("localhost" | "127.0.0.1" | "[::1]" | "::1")
    ) {
        builder = builder.no_proxy();
    }
    let token = read_user_token(runtime).await?;
    let result = builder
        .build()
        .map_err(|_| unavailable())?
        .post(url)
        .bearer_auth(token.trim())
        .header(CAPABILITY_STATUS_HEADER, CAPABILITY_STATUS_DETACHED)
        .json(&serde_json::json!({}))
        .send()
        .await;
    drop(token);
    let status: ScopeStatus = bounded_response(result.map_err(|_| unavailable())?).await?;
    Ok(AuthorizationSnapshot {
        target: crate::webcodex::settings::target(runtime)?,
        can_authorize: can_authorize(runtime),
        coding_agents: status.coding_agents,
        ssh_resources: status.ssh_resources,
        permission_approval_granted: status.permission_approval.unwrap_or(false),
        permission_approval_grant_available: can_authorize(runtime)
            && status.permission_approval == Some(false),
        detached_execution_granted: status.detached_execution.unwrap_or(false),
        detached_execution_grant_available: can_authorize(runtime)
            && status.detached_execution == Some(false),
    })
}

async fn read_user_token(runtime: &StoredRuntime) -> DesktopResult<String> {
    let path = runtime.user_token_file.as_ref().ok_or_else(unavailable)?;
    let mut token = String::new();
    tokio::fs::File::open(path)
        .await
        .map_err(|_| unavailable())?
        .take(16385)
        .read_to_string(&mut token)
        .await
        .map_err(|_| unavailable())?;
    if token.len() > 16384 || token.trim().is_empty() {
        return Err(unavailable());
    }
    Ok(token)
}

async fn bounded_response<T: serde::de::DeserializeOwned>(
    mut response: reqwest::Response,
) -> DesktopResult<T> {
    if !response.status().is_success()
        || response
            .content_length()
            .is_some_and(|length| length > 4096)
    {
        return Err(unavailable());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| unavailable())? {
        if bytes.len().saturating_add(chunk.len()) > 4096 {
            return Err(unavailable());
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| unavailable())
}

pub fn can_authorize(runtime: &StoredRuntime) -> bool {
    runtime.server_env_file.is_some() && local_url(runtime).is_ok()
}

fn local_url(runtime: &StoredRuntime) -> DesktopResult<url::Url> {
    let url = url::Url::parse(&runtime.server_url).map_err(|_| unavailable())?;
    if url.scheme() != "http"
        || !matches!(url.host_str(), Some("127.0.0.1" | "[::1]" | "::1"))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_none()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(unavailable());
    }
    Ok(url)
}

/// Read only the generated operator assignment, not shell syntax. Reject
/// duplicate/interpolated/malformed values rather than evaluating an env file.
pub(crate) fn operator_token(content: &str) -> DesktopResult<String> {
    let mut token = None;
    for line in content.lines() {
        let line = line.trim_start();
        let line = line.strip_prefix("export ").unwrap_or(line).trim_start();
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        if key.trim() != "WEBCODEX_TOKEN" {
            continue;
        }
        if token.is_some() {
            return Err(unavailable());
        }
        let value = value.trim();
        let value = value
            .strip_prefix('"')
            .and_then(|v| v.strip_suffix('"'))
            .or_else(|| value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')))
            .unwrap_or(value);
        if value.is_empty()
            || value.len() > 16384
            || !value
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"_-.~+/=".contains(&b))
        {
            return Err(unavailable());
        }
        token = Some(value.to_owned());
    }
    token.ok_or_else(unavailable)
}

#[derive(Serialize)]
struct NativeGrant<'a> {
    client_id: &'a str,
    user_token_hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    permission_approval: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    detached_execution: Option<bool>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GrantResponse {
    success: bool,
    changed: bool,
    applied_scopes: Vec<String>,
}

pub async fn grant(
    runtime: &StoredRuntime,
    operator_token: String,
    permission_approval: bool,
    detached_execution: bool,
) -> DesktopResult<()> {
    if permission_approval && detached_execution {
        return Err(unavailable());
    }
    let mut url = local_url(runtime)?;
    url.set_path("/api/pairing/runner-capabilities");
    let runner = runtime
        .runner_client_id
        .as_deref()
        .filter(|id| !id.is_empty())
        .ok_or_else(unavailable)?;
    let token = read_user_token(runtime).await?;
    let user_token_hash = format!("{:x}", Sha256::digest(token.trim().as_bytes()));
    drop(token);
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|_| unavailable())?;
    let result = client
        .post(url)
        .bearer_auth(&operator_token)
        .json(&NativeGrant {
            client_id: runner,
            user_token_hash,
            permission_approval: permission_approval.then_some(true),
            detached_execution: detached_execution.then_some(true),
        })
        .send()
        .await;
    drop(operator_token);
    let response: GrantResponse = bounded_response(result.map_err(|_| unavailable())?).await?;
    let expected_scopes: &[&str] = if permission_approval {
        &["coding_agent:approve"]
    } else if detached_execution {
        &["job:detach"]
    } else {
        &["ssh:local", "coding_agent:run"]
    };
    if !response.success
        || response.applied_scopes.len() != expected_scopes.len()
        || !expected_scopes.iter().all(|expected| {
            response
                .applied_scopes
                .iter()
                .any(|actual| actual.as_str() == *expected)
        })
    {
        return Err(unavailable());
    }
    let _ = response.changed; // An already-applied operator grant is idempotent.
    Ok(())
}

pub fn unavailable() -> DesktopError {
    DesktopError::new("runner_capability_grant_unavailable", "Runner capability authorization was not confirmed",
        "Use the Desktop-owned local Server with operator authority, then refresh. Remote connections require a Server-operator-approved pairing code.")
}

#[cfg(test)]
mod tests;
