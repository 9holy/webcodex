//! First-party operator adapter over the canonical SSH registry and dispatch.
//! Only this closed input surface accepts credentials; no input is a model tool,
//! retained history, alternate registry, or arbitrary Runner transport command.

use super::*;
use serde::Deserialize;
use webcodex_core::ssh_resource::{
    SshAuthentication, SshEndpoint, SshHostKeyTrust, SshOperatorConnection,
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ListInput {
    runner: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct InspectInput {
    binding: String,
    endpoint: SshEndpoint,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ProbeInput {
    binding: String,
    endpoint: SshEndpoint,
    authentication: SshAuthentication,
    host_key: SshHostKeyTrust,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RegisterInput {
    binding: String,
    name: String,
    #[serde(default)]
    default_cwd: Option<String>,
    connection: SshOperatorConnection,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RemoveInput {
    binding: String,
    name: String,
}

pub(crate) enum OperatorRequest {
    List(ListInput),
    Inspect(InspectInput),
    Probe(ProbeInput),
    Register(RegisterInput),
    Remove(RemoveInput),
}

impl OperatorRequest {
    fn policy(&self) -> SpecializedOperationPolicy {
        match self {
            Self::List(_) => SshResourceOperation::List.policy(),
            Self::Inspect(_) => SpecializedOperationPolicy::read(
                SpecializedSource::SshResource,
                "inspect",
                SCOPE_SSH_LOCAL,
            ),
            Self::Probe(_) => SpecializedOperationPolicy::read(
                SpecializedSource::SshResource,
                "probe",
                SCOPE_SSH_LOCAL,
            ),
            Self::Register(_) => SshResourceOperation::Register.policy(),
            Self::Remove(_) => SshResourceOperation::Remove.policy(),
        }
    }

    fn audit_identity(&self) -> Value {
        match self {
            Self::List(input) => json!({"action":"list","runner":input.runner}),
            Self::Inspect(_) => json!({"action":"inspect","endpoint_present":true}),
            Self::Probe(_) => {
                json!({"action":"probe","endpoint_present":true,"authentication_present":true})
            }
            Self::Register(input) => {
                json!({"action":"register","resource_name":input.name,"direct":matches!(&input.connection, SshOperatorConnection::Direct { .. })})
            }
            Self::Remove(input) => json!({"action":"remove","resource_name":input.name}),
        }
    }
}

pub(crate) fn authorized(auth: &AuthContext) -> bool {
    matches!(auth.kind, AuthKind::Bootstrap | AuthKind::ApiToken) && super::authorized(Some(auth))
}

pub(crate) fn invalid_input() -> ToolResult {
    ToolResult::err_with_output(
        "SSH connection request is invalid",
        json!({"error_kind":"ssh_resource_invalid","dispatch_state":"not_started"}),
    )
}

pub(crate) async fn invoke(
    runtime: &ToolRuntime,
    request: OperatorRequest,
    auth: &AuthContext,
) -> ToolResult {
    if !authorized(auth) {
        return ToolResult::err_with_output(
            "A first-party credential with SSH access is required",
            json!({"error_kind":"insufficient_scope","dispatch_state":"not_started"}),
        );
    }
    let policy = request.policy();
    let permit = match runtime
        .govern_specialized_invocation(
            SSH_RESOURCE_TOOL_NAME,
            policy,
            SessionTransport::Api,
            None,
            Some(auth),
            &request.audit_identity(),
        )
        .await
    {
        Ok(permit) => permit,
        Err(SpecializedGovernanceDenial::Tool(result)) => return result,
        Err(SpecializedGovernanceDenial::Scope { .. }) => {
            return ToolResult::err_with_output(
                "SSH access is required",
                json!({"error_kind":"insufficient_scope","dispatch_state":"not_started"}),
            );
        }
    };
    let result = execute(runtime, request, auth).await;
    let success = result.is_ok();
    runtime.finish_specialized_invocation(
        permit,
        success,
        result
            .as_ref()
            .err()
            .map(|error| error.dispatch_state)
            .unwrap_or("completed"),
        result.as_ref().err().map(|error| error.code),
    );
    match result {
        Ok(value) => ToolResult::ok(value),
        Err(error) => {
            let mut output = json!({"error_kind":error.code,"dispatch_state":error.dispatch_state});
            if let Some(recovery) = error.recovery {
                output["recovery"] = json!(recovery);
            }
            ToolResult::err_with_output(error.message, output)
        }
    }
}

async fn execute(
    runtime: &ToolRuntime,
    request: OperatorRequest,
    auth: &AuthContext,
) -> Result<Value, GatewayError> {
    match request {
        OperatorRequest::List(input) => {
            let runner = resolve_runner(runtime, &input.runner, Some(auth)).await?;
            let mut value = list_resolved(runtime, &runner, Some(auth)).await?;
            value["setup_supported"] = json!(runner.connection_setup);
            Ok(value)
        }
        OperatorRequest::Inspect(input) => {
            execute_bound(runtime, input.binding, auth, false, |expected_revision| {
                SshResourceRequest::Inspect {
                    expected_revision,
                    endpoint: input.endpoint,
                }
            })
            .await
        }
        OperatorRequest::Probe(input) => {
            execute_bound(runtime, input.binding, auth, false, |expected_revision| {
                SshResourceRequest::Probe {
                    expected_revision,
                    endpoint: input.endpoint,
                    authentication: input.authentication,
                    host_key: input.host_key,
                }
            })
            .await
        }
        OperatorRequest::Register(input) => {
            execute_bound(
                runtime,
                input.binding,
                auth,
                true,
                |expected_revision| match input.connection {
                    SshOperatorConnection::Alias { target } => SshResourceRequest::Register {
                        expected_revision,
                        name: input.name,
                        target,
                        default_cwd: input.default_cwd,
                    },
                    SshOperatorConnection::Direct {
                        endpoint,
                        authentication,
                        host_key,
                    } => SshResourceRequest::RegisterConnection {
                        expected_revision,
                        name: input.name,
                        endpoint,
                        authentication,
                        host_key,
                        default_cwd: input.default_cwd,
                    },
                },
            )
            .await
        }
        OperatorRequest::Remove(input) => {
            execute_bound(runtime, input.binding, auth, true, |expected_revision| {
                SshResourceRequest::Remove {
                    expected_revision,
                    name: input.name,
                }
            })
            .await
        }
    }
}

async fn execute_bound(
    runtime: &ToolRuntime,
    binding: String,
    auth: &AuthContext,
    mutation: bool,
    build: impl FnOnce(u64) -> SshResourceRequest,
) -> Result<Value, GatewayError> {
    let (binding_id, observed, runner) =
        resolve_binding(runtime, Some(binding), Some(auth)).await?;
    let request = build(observed.revision);
    request.validate().map_err(|_| {
        GatewayError::new("ssh_resource_invalid", "SSH connection request is invalid")
    })?;
    if request.requires_connection_setup() && !runner.connection_setup {
        return Err(GatewayError::new(
            "ssh_connection_setup_unsupported",
            "Upgrade this Runner to configure SSH connection authentication",
        ));
    }
    // Read-only inspection/probes retain this exact observation for Save. A
    // mutation consumes it atomically, including concurrent requests, before
    // queue admission; uncertainty never authorizes a replay.
    if mutation && !runtime.ssh_resource_gateway.consume(&binding_id, &observed) {
        return Err(binding_required_error());
    }
    let response = execute_exact(runtime, &runner, request, Some(auth)).await?;
    if mutation {
        return render_mutation_response(runtime, &binding_id, response);
    }
    if let SshResourceResponse::Error { .. } = response {
        return response_to_error(response);
    }
    serde_json::to_value(response).map_err(|_| {
        GatewayError::new(
            "ssh_resource_registry_unavailable",
            "The SSH response could not be projected",
        )
    })
}
