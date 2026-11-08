//! Closed Desktop facade over the first-party SSH operator HTTP routes.
//! Only a short-lived observation is held here, never a second SSH registry.
//! Credentials, targets and canonical gateway bindings never enter public state.
use crate::models::StoredRuntime;
use crate::webcodex::settings::SettingsTarget;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::future::Future;
use std::path::PathBuf;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use webcodex_core::ssh_resource::{
    normalize_ssh_resource_default_cwd, normalize_ssh_resource_target,
    validate_response_for_request, validate_ssh_resource_name, SshAuthentication, SshEndpoint,
    SshHostKeyCandidate, SshHostKeyTrust, SshOperatorConnection, SshResourceInventoryEntry,
    SshResourceRequest, SshResourceResponse, SshResourceSource, SshResourceVerificationEntry,
    SshVerification, SSH_RESOURCE_REQUEST_MAX_BYTES, SSH_RESOURCE_RESPONSE_MAX_BYTES,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SshResourceError {
    InsufficientScope,
    AuthorizationUnavailable,
    RunnerReplaced,
    SshResourceRegistryStale,
    SshResourceOutcomeUnknown,
    SshResourceRegistryUnavailable,
    SshResourceInvalid,
    SshResourceStaticReadOnly,
    SshResourceStaticConflict,
    SshResourceNameConflict,
    SshResourceNotFound,
    SshConnectionSetupUnsupported,
    SshHostKeyUnavailable,
    SshHostKeyStale,
    SshHostKeyChanged,
    SshAuthenticationFailed,
    SshConnectionFailed,
    SshConnectionTimeout,
    SshProgramUnavailable,
    SshIdentityFileInvalid,
    SshCredentialsUnavailable,
    SshClientPermissionDenied,
    SshConnectionCancelled,
}

impl SshResourceError {
    fn from_code(code: Option<&str>, mutation: bool) -> Self {
        match code {
            Some("insufficient_scope") => Self::InsufficientScope,
            Some("runner_replaced") => Self::RunnerReplaced,
            Some("ssh_resource_registry_stale" | "ssh_resource_binding_required") => {
                Self::SshResourceRegistryStale
            }
            Some("ssh_resource_outcome_unknown") => Self::SshResourceOutcomeUnknown,
            Some("ssh_resource_static_read_only") => Self::SshResourceStaticReadOnly,
            Some("ssh_resource_static_conflict") => Self::SshResourceStaticConflict,
            Some("ssh_resource_name_conflict") => Self::SshResourceNameConflict,
            Some("ssh_resource_not_found") => Self::SshResourceNotFound,
            Some("ssh_resource_invalid") => Self::SshResourceInvalid,
            Some("ssh_resource_registry_unavailable") => Self::SshResourceRegistryUnavailable,
            Some("ssh_connection_setup_unsupported") => Self::SshConnectionSetupUnsupported,
            Some("ssh_host_key_unavailable") => Self::SshHostKeyUnavailable,
            Some("ssh_host_key_stale") => Self::SshHostKeyStale,
            Some("ssh_host_key_changed") => Self::SshHostKeyChanged,
            Some("ssh_authentication_failed") => Self::SshAuthenticationFailed,
            Some("ssh_connection_failed") => Self::SshConnectionFailed,
            Some("ssh_connection_timeout") => Self::SshConnectionTimeout,
            Some("ssh_program_unavailable") => Self::SshProgramUnavailable,
            Some("ssh_identity_file_invalid") => Self::SshIdentityFileInvalid,
            Some("ssh_credentials_unavailable") => Self::SshCredentialsUnavailable,
            Some("ssh_client_permission_denied") => Self::SshClientPermissionDenied,
            Some("ssh_connection_cancelled") => Self::SshConnectionCancelled,
            _ => Self::unconfirmed(mutation),
        }
    }
    fn unconfirmed(mutation: bool) -> Self {
        if mutation {
            Self::SshResourceOutcomeUnknown
        } else {
            Self::SshResourceRegistryUnavailable
        }
    }
}

#[derive(Clone, Serialize)]
pub struct SshResourcesSnapshot {
    pub runner: String,
    pub available: bool,
    pub setup_supported: bool,
    pub verification_supported: bool,
    pub verification_unavailable: bool,
    pub verifications: Vec<SshResourceVerificationEntry>,
    pub observation_id: Option<String>,
    pub resources: Vec<SshResourceInventoryEntry>,
    pub error_kind: Option<SshResourceError>,
}

#[derive(Serialize)]
pub struct SshMutationResult {
    pub success: bool,
    pub error_kind: Option<SshResourceError>,
    pub restart_required: bool,
    pub inventory: SshResourcesSnapshot,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SshRegisterRequest {
    pub expected: SettingsTarget,
    pub observation_id: String,
    pub name: String,
    pub connection: SshOperatorConnection,
    pub default_cwd: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SshInspectRequest {
    pub expected: SettingsTarget,
    pub observation_id: String,
    pub endpoint: SshEndpoint,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SshProbeRequest {
    pub expected: SettingsTarget,
    pub observation_id: String,
    pub endpoint: SshEndpoint,
    pub authentication: SshAuthentication,
    pub host_key: SshHostKeyTrust,
}

#[derive(Serialize)]
pub struct SshHostKeyInspection {
    pub challenge_id: String,
    pub expires_at: i64,
    pub host_keys: Vec<SshHostKeyCandidate>,
}

#[derive(Serialize)]
pub struct SshInspectionResult {
    pub success: bool,
    pub error_kind: Option<SshResourceError>,
    pub inspection: Option<SshHostKeyInspection>,
}

#[derive(Serialize)]
pub struct SshProbeResult {
    pub success: bool,
    pub error_kind: Option<SshResourceError>,
    pub verified: bool,
}

pub(crate) enum ConnectionCheck {
    Inspect(SshEndpoint),
    Probe {
        endpoint: SshEndpoint,
        authentication: SshAuthentication,
        host_key: SshHostKeyTrust,
    },
}

pub(crate) enum ConnectionChecked {
    Inspected(SshHostKeyInspection),
    Verified,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SshRemoveRequest {
    pub expected: SettingsTarget,
    pub observation_id: String,
    pub name: String,
}

pub(crate) enum Mutation {
    VerifySaved {
        name: String,
    },
    Register {
        name: String,
        connection: SshOperatorConnection,
        default_cwd: Option<String>,
    },
    Remove {
        name: String,
    },
}

impl Mutation {
    fn name(&self) -> &str {
        match self {
            Self::Register { name, .. } | Self::Remove { name } | Self::VerifySaved { name } => {
                name
            }
        }
    }
    fn arguments(self, binding: String) -> Result<Value, SshResourceError> {
        validate_ssh_resource_name(self.name())
            .map_err(|_| SshResourceError::SshResourceInvalid)?;
        Ok(match self {
            Self::VerifySaved { name } => {
                json!({"action":"verify_saved", "binding":binding, "name":name})
            }
            Self::Register {
                name,
                connection,
                default_cwd,
            } => {
                let connection = match connection {
                    SshOperatorConnection::Alias { target } => SshOperatorConnection::Alias {
                        target: normalize_ssh_resource_target(&target)
                            .map_err(|_| SshResourceError::SshResourceInvalid)?,
                    },
                    connection @ SshOperatorConnection::Direct { .. } => {
                        if let SshOperatorConnection::Direct {
                            endpoint,
                            authentication,
                            host_key,
                        } = &connection
                        {
                            endpoint
                                .validate()
                                .and_then(|()| authentication.validate())
                                .and_then(|()| host_key.validate())
                                .map_err(|_| SshResourceError::SshResourceInvalid)?;
                        }
                        connection
                    }
                };
                let mut arguments = json!({
                    "action":"register", "binding":binding, "name":name,
                    "connection":connection,
                });
                if let Some(cwd) = normalize_ssh_resource_default_cwd(default_cwd.as_deref())
                    .map_err(|_| SshResourceError::SshResourceInvalid)?
                {
                    arguments["default_cwd"] = json!(cwd);
                }
                arguments
            }
            Self::Remove { name } => json!({"action":"remove", "binding":binding, "name":name}),
        })
    }
}

#[derive(Clone, PartialEq, Eq)]
struct Identity {
    server_url: String,
    runner: String,
    config: Option<PathBuf>,
    credential_file: Option<PathBuf>,
}
impl Identity {
    fn new(runtime: &StoredRuntime) -> Self {
        Self {
            server_url: runtime.server_url.clone(),
            runner: runtime.runner_client_id.clone().unwrap_or_default(),
            config: runtime.runner_config.clone(),
            credential_file: runtime.user_token_file.clone(),
        }
    }
}

struct Observation {
    identity: Identity,
    id: String,
    binding: String,
    resources: Vec<SshResourceInventoryEntry>,
    setup_supported: bool,
    verification_supported: bool,
    verifications: Vec<SshResourceVerificationEntry>,
}

#[derive(Default)]
pub(crate) struct SshResourcesManager {
    observation: Option<Observation>,
}

pub(crate) trait Gateway {
    fn call(
        &self,
        runtime: &StoredRuntime,
        arguments: Value,
    ) -> impl Future<Output = Result<Value, SshResourceError>> + Send;
}

impl SshResourcesManager {
    pub fn invalidate(&mut self) {
        self.observation = None;
    }

    pub async fn list(
        &mut self,
        runtime: &StoredRuntime,
        gateway: &impl Gateway,
    ) -> SshResourcesSnapshot {
        self.invalidate();
        let identity = Identity::new(runtime);
        let result = if identity.runner.is_empty() || identity.runner.len() > 128 {
            Err(SshResourceError::SshResourceRegistryUnavailable)
        } else {
            let result = gateway
                .call(
                    runtime,
                    json!({"action":"status", "runner":identity.runner}),
                )
                .await;
            // A published older Server has no status route. Only an explicit
            // unsupported read permits the old list; auth and transient errors do not.
            let result = match result {
                Err(SshResourceError::SshConnectionSetupUnsupported) => {
                    gateway
                        .call(runtime, json!({"action":"list", "runner":identity.runner}))
                        .await
                }
                result => result,
            };
            result.and_then(|output| decode_list(output, &identity.runner))
        };
        match result {
            Ok(output) => {
                let id = uuid::Uuid::new_v4().to_string();
                let snapshot = SshResourcesSnapshot {
                    runner: identity.runner.clone(),
                    available: true,
                    setup_supported: output.setup_supported,
                    verification_supported: output.verification_supported,
                    verification_unavailable: output.verification_unavailable,
                    verifications: output.verifications.clone(),
                    observation_id: Some(id.clone()),
                    resources: output.resources.clone(),
                    error_kind: None,
                };
                self.observation = Some(Observation {
                    identity,
                    id,
                    binding: output.binding,
                    resources: output.resources,
                    setup_supported: output.setup_supported,
                    verification_supported: output.verification_supported,
                    verifications: output.verifications,
                });
                snapshot
            }
            Err(error) => SshResourcesSnapshot {
                runner: identity.runner,
                available: false,
                setup_supported: false,
                verification_supported: false,
                verification_unavailable: false,
                verifications: Vec::new(),
                observation_id: None,
                resources: Vec::new(),
                error_kind: Some(error),
            },
        }
    }

    pub async fn mutate(
        &mut self,
        runtime: &StoredRuntime,
        observation_id: &str,
        mutation: Mutation,
        gateway: &impl Gateway,
    ) -> SshMutationResult {
        // Single-use locally even when validation/transport fails. The Server
        // independently checks caller, exact Runner instance and registry revision.
        let observed = self.observation.take();
        let result = async {
            let observed = observed
                .filter(|observed| observed.id == observation_id)
                .ok_or(SshResourceError::SshResourceRegistryStale)?;
            if observed.identity != Identity::new(runtime) {
                return Err(SshResourceError::RunnerReplaced);
            }
            if matches!(
                mutation,
                Mutation::Register {
                    connection: SshOperatorConnection::Direct { .. },
                    ..
                }
            ) && !observed.setup_supported
            {
                return Err(SshResourceError::SshConnectionSetupUnsupported);
            }
            let name = mutation.name().to_owned();
            if matches!(
                mutation,
                Mutation::Remove { .. } | Mutation::VerifySaved { .. }
            ) {
                match observed
                    .resources
                    .iter()
                    .find(|resource| resource.name == name)
                {
                    Some(resource) if resource.source == SshResourceSource::Static => {
                        return Err(SshResourceError::SshResourceStaticReadOnly)
                    }
                    Some(_) => {}
                    None => return Err(SshResourceError::SshResourceNotFound),
                }
            }
            let verify_saved = matches!(mutation, Mutation::VerifySaved { .. });
            if verify_saved
                && (!observed.verification_supported
                    || !observed
                        .verifications
                        .iter()
                        .any(|entry| entry.name == name))
            {
                return Err(SshResourceError::SshConnectionSetupUnsupported);
            }
            let remove = matches!(mutation, Mutation::Remove { .. });
            let arguments = mutation.arguments(observed.binding)?;
            let output = gateway.call(runtime, arguments).await?;
            if verify_saved {
                let response: VerificationOutput = serde_json::from_value(output)
                    .map_err(|_| SshResourceError::SshResourceOutcomeUnknown)?;
                if response.resource != name
                    || !response.persisted
                    || response.verification.validate().is_err()
                {
                    return Err(SshResourceError::SshResourceOutcomeUnknown);
                }
                if let Some(error) = response.verification.error_kind {
                    return Err(SshResourceError::from_code(Some(error.code()), true));
                }
                return Ok(false);
            }
            let response: MutationOutput = serde_json::from_value(output)
                .map_err(|_| SshResourceError::SshResourceOutcomeUnknown)?;
            if response.resource != name
                || !response.persisted
                || response.restart_required
                    != if remove {
                        response.active
                    } else {
                        !response.active
                    }
            {
                return Err(SshResourceError::SshResourceOutcomeUnknown);
            }
            Ok(response.restart_required)
        }
        .await;
        // Observe after *every* attempt. Never repeat a register/remove request,
        // including timeout, outcome_unknown, stale revision and replacement.
        let inventory = self.list(runtime, gateway).await;
        SshMutationResult {
            success: result.is_ok(),
            error_kind: result.as_ref().err().copied(),
            restart_required: result.unwrap_or(false),
            inventory,
        }
    }

    pub async fn check(
        &self,
        runtime: &StoredRuntime,
        observation_id: &str,
        check: ConnectionCheck,
        gateway: &impl Gateway,
    ) -> Result<ConnectionChecked, SshResourceError> {
        let observed = self
            .observation
            .as_ref()
            .filter(|observed| observed.id == observation_id)
            .ok_or(SshResourceError::SshResourceRegistryStale)?;
        if observed.identity != Identity::new(runtime) {
            return Err(SshResourceError::RunnerReplaced);
        }
        if !observed.setup_supported {
            return Err(SshResourceError::SshConnectionSetupUnsupported);
        }
        // Inspect/probe are read-only and do not consume the save observation.
        // Canonical revision authorization stays in the Server's opaque binding.
        let mut request = match check {
            ConnectionCheck::Inspect(endpoint) => SshResourceRequest::Inspect {
                expected_revision: 0,
                endpoint,
            },
            ConnectionCheck::Probe {
                endpoint,
                authentication,
                host_key,
            } => SshResourceRequest::Probe {
                expected_revision: 0,
                endpoint,
                authentication,
                host_key,
            },
        };
        request
            .validate()
            .map_err(|_| SshResourceError::SshResourceInvalid)?;
        let arguments = match &request {
            SshResourceRequest::Inspect { endpoint, .. } => {
                json!({"action":"inspect","binding":observed.binding,"endpoint":endpoint})
            }
            SshResourceRequest::Probe {
                endpoint,
                authentication,
                host_key,
                ..
            } => {
                json!({"action":"probe","binding":observed.binding,"endpoint":endpoint,"authentication":authentication,"host_key":host_key})
            }
            _ => return Err(SshResourceError::SshResourceInvalid),
        };
        let response: SshResourceResponse =
            serde_json::from_value(gateway.call(runtime, arguments).await?)
                .map_err(|_| SshResourceError::SshResourceRegistryUnavailable)?;
        let revision = match &response {
            SshResourceResponse::Inspect { revision, .. }
            | SshResourceResponse::Probe { revision, .. } => *revision,
            _ => return Err(SshResourceError::SshResourceRegistryUnavailable),
        };
        // The Server checks the actual revision. Reuse its canonical shape,
        // fingerprint, and bounds validator without projecting the binding.
        match &mut request {
            SshResourceRequest::Inspect {
                expected_revision, ..
            }
            | SshResourceRequest::Probe {
                expected_revision, ..
            } => *expected_revision = revision,
            _ => return Err(SshResourceError::SshResourceInvalid),
        }
        validate_response_for_request(&request, &response)
            .map_err(|_| SshResourceError::SshResourceRegistryUnavailable)?;
        match response {
            SshResourceResponse::Inspect {
                challenge_id,
                expires_at,
                host_keys,
                ..
            } => Ok(ConnectionChecked::Inspected(SshHostKeyInspection {
                challenge_id,
                expires_at,
                host_keys,
            })),
            SshResourceResponse::Probe { .. } => Ok(ConnectionChecked::Verified),
            _ => Err(SshResourceError::SshResourceRegistryUnavailable),
        }
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ListOutput {
    runner: String,
    binding: String,
    resources: Vec<SshResourceInventoryEntry>,
    #[serde(default)]
    setup_supported: bool,
    #[serde(default)]
    verification_supported: bool,
    #[serde(default)]
    verification_unavailable: bool,
    #[serde(default)]
    verifications: Vec<SshResourceVerificationEntry>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct VerificationOutput {
    resource: String,
    persisted: bool,
    verification: SshVerification,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct MutationOutput {
    resource: String,
    persisted: bool,
    active: bool,
    restart_required: bool,
}

fn decode_list(output: Value, runner: &str) -> Result<ListOutput, SshResourceError> {
    let output: ListOutput = serde_json::from_value(output)
        .map_err(|_| SshResourceError::SshResourceRegistryUnavailable)?;
    if output.runner != runner
        || output.binding.len() > 128
        || !output.binding.starts_with("wc_sbind_")
    {
        return Err(SshResourceError::RunnerReplaced);
    }
    // Reuse the canonical inventory validator. The revision is a validation-only
    // placeholder; Desktop never sees or invents the binding's actual revision.
    if !output.verification_supported && !output.verifications.is_empty() {
        return Err(SshResourceError::SshResourceRegistryUnavailable);
    }
    validate_response_for_request(
        &SshResourceRequest::Status,
        &SshResourceResponse::Status {
            revision: 0,
            resources: output.resources.clone(),
            verifications: output.verifications.clone(),
            verification_unavailable: output.verification_unavailable,
        },
    )
    .map_err(|_| SshResourceError::SshResourceRegistryUnavailable)?;
    Ok(output)
}

pub(crate) struct HttpGateway;
impl Gateway for HttpGateway {
    async fn call(
        &self,
        runtime: &StoredRuntime,
        mut arguments: Value,
    ) -> Result<Value, SshResourceError> {
        let action = arguments
            .get("action")
            .and_then(Value::as_str)
            .filter(|action| {
                matches!(
                    *action,
                    "list"
                        | "status"
                        | "verify_saved"
                        | "inspect"
                        | "probe"
                        | "register"
                        | "remove"
                )
            })
            .ok_or(SshResourceError::SshResourceInvalid)?
            .to_owned();
        let mutation = matches!(action.as_str(), "register" | "remove" | "verify_saved");
        let unavailable = || SshResourceError::SshResourceRegistryUnavailable;
        let uncertain = || SshResourceError::unconfirmed(mutation);
        let mut url = url::Url::parse(&runtime.server_url).map_err(|_| unavailable())?;
        if !matches!(url.scheme(), "http" | "https")
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err(unavailable());
        }
        url.set_path(&format!("/api/runtime-console/ssh-resources/{action}"));
        url.set_query(None);
        url.set_fragment(None);
        let mut builder = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            // Canonical gateway waits up to 65s for an exact Runner response.
            .timeout(Duration::from_secs(75));
        if matches!(
            url.host_str(),
            Some("localhost" | "127.0.0.1" | "[::1]" | "::1")
        ) {
            builder = builder.no_proxy();
        }
        let path = runtime.user_token_file.as_ref().ok_or_else(unavailable)?;
        let mut token = String::new();
        tokio::fs::File::open(path)
            .await
            .map_err(|_| unavailable())?
            .take(16_385)
            .read_to_string(&mut token)
            .await
            .map_err(|_| unavailable())?;
        if token.len() > 16_384 || token.trim().is_empty() {
            return Err(unavailable());
        }
        let client = builder.build().map_err(|_| unavailable())?;
        arguments
            .as_object_mut()
            .ok_or(SshResourceError::SshResourceInvalid)?
            .remove("action");
        let body =
            serde_json::to_vec(&arguments).map_err(|_| SshResourceError::SshResourceInvalid)?;
        if body.len() > SSH_RESOURCE_REQUEST_MAX_BYTES {
            return Err(SshResourceError::SshResourceInvalid);
        }
        drop(arguments);
        // Closed first-party route. This body never enters model tool dispatch
        // or its full trace. URL, headers and native token are not WebView inputs.
        let response = client
            .post(url)
            .bearer_auth(token.trim())
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(body)
            .send()
            .await;
        drop(token);
        let mut response = response.map_err(|_| uncertain())?;
        let status = response.status().as_u16();
        if matches!(status, 404 | 405 | 501) {
            if action == "status" && status != 404 {
                return Err(unavailable());
            }
            return Err(SshResourceError::SshConnectionSetupUnsupported);
        }
        if status == 403 {
            return Err(SshResourceError::InsufficientScope);
        }
        if status == 401 {
            return Err(SshResourceError::AuthorizationUnavailable);
        }
        if !matches!(status, 200 | 400) {
            return Err(uncertain());
        }
        let max = SSH_RESOURCE_RESPONSE_MAX_BYTES + 4096;
        if response
            .content_length()
            .is_some_and(|size| size > max as u64)
        {
            return Err(uncertain());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| uncertain())? {
            if bytes.len().saturating_add(chunk.len()) > max {
                return Err(uncertain());
            }
            bytes.extend_from_slice(&chunk);
        }
        let envelope: Envelope = serde_json::from_slice(&bytes).map_err(|_| uncertain())?;
        if envelope.success && status == 200 {
            Ok(envelope.output)
        } else {
            Err(SshResourceError::from_code(
                envelope.output.get("error_kind").and_then(Value::as_str),
                mutation,
            ))
        }
    }
}

#[derive(Deserialize)]
struct Envelope {
    success: bool,
    output: Value,
}

#[cfg(test)]
mod tests;
