use super::*;
use crate::runner_protocol::{RunnerPollRequest, RunnerResultPayload, RunnerResultRequest};
use webcodex_core::runner_operation::RunnerOperation;
use webcodex_core::ssh_resource::{
    SshEndpoint, SshHostKeyCandidate, SshResourceRequest, SshResourceResponse,
};

fn operator_auth() -> AuthContext {
    let mut auth = AuthContext::new(AuthKind::ApiToken);
    auth.user_id = Some("ssh-operator-user".into());
    auth.username = Some("alice".into());
    auth.api_key_id = Some("operator-token".into());
    auth.scopes = vec![crate::auth::SCOPE_SSH_LOCAL.into()];
    auth
}

fn service(runtime: Arc<ToolRuntime>, auth: AuthContext) -> Service {
    Service::new(
        Router::new()
            .hoop(affix_state::inject(runtime))
            .hoop(affix_state::inject(auth))
            .push(
                Router::with_path("api/runtime-console/ssh-resources/list")
                    .post(crate::runtime_console_http::ssh_resources::list),
            )
            .push(
                Router::with_path("api/runtime-console/ssh-resources/inspect")
                    .post(crate::runtime_console_http::ssh_resources::inspect),
            )
            .push(
                Router::with_path("api/runtime-console/ssh-resources/probe")
                    .post(crate::runtime_console_http::ssh_resources::probe),
            )
            .push(
                Router::with_path("api/runtime-console/ssh-resources/register")
                    .post(crate::runtime_console_http::ssh_resources::register),
            )
            .push(
                Router::with_path("api/runtime-console/ssh-resources/remove")
                    .post(crate::runtime_console_http::ssh_resources::remove),
            ),
    )
}

fn url(action: &str) -> String {
    format!("http://localhost/api/runtime-console/ssh-resources/{action}")
}

async fn register_runner(runtime: &ToolRuntime, setup: bool) {
    runtime
        .runner_registry
        .register(crate::test_support::current_runner_registration(
            RunnerRegisterRequest {
                client_id: "ssh-operator-runner".into(),
                runner_instance_id: "ssh-instance".into(),
                owner: Some("alice".into()),
                capabilities: RunnerCapabilities {
                    managed_ssh_resources: true,
                    ssh_connection_setup: setup,
                    ..Default::default()
                },
                runner_protocol_generation: crate::runner_protocol::RUNNER_PROTOCOL_GENERATION_V2,
                computer_control_epoch: None,
                computer_session_availability: None,
                display_name: None,
                hostname: None,
                host_context: None,
                policy: None,
                process_started_at: None,
                build: None,
                job_concurrency_limit: None,
                job_inventory: None,
                coding_agent_providers: None,
                coding_agent_inventory: None,
            },
        ))
        .await
        .unwrap();
}

async fn exchange(
    runtime: &ToolRuntime,
    service: &Service,
    action: &str,
    body: Value,
    answer: SshResourceResponse,
) -> (Value, SshResourceRequest) {
    let request = TestClient::post(url(action)).json(&body);
    let http = request.send(service);
    let runner_exchange = async {
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(3);
        let request = loop {
            if let Some(request) = runtime
                .runner_registry
                .poll(RunnerPollRequest {
                    client_id: "ssh-operator-runner".into(),
                    runner_instance_id: "ssh-instance".into(),
                })
                .await
                .unwrap()
            {
                break request;
            }
            assert!(
                tokio::time::Instant::now() < deadline,
                "operator request was not dispatched"
            );
            tokio::task::yield_now().await;
        };
        let RunnerOperation::SshResource(operation) = request.decode_operation().unwrap() else {
            panic!("unexpected Runner operation");
        };
        runtime
            .runner_registry
            .complete(RunnerResultPayload {
                result: RunnerResultRequest {
                    client_id: request.client_id,
                    runner_instance_id: "ssh-instance".into(),
                    request_id: request.request_id,
                    exit_code: Some(0),
                    stdout: Some(serde_json::to_string(&answer).unwrap()),
                    stderr: None,
                    stdout_truncated: false,
                    stderr_truncated: false,
                    duration_ms: Some(1),
                    error: None,
                },
                command_execution_state: Some(
                    crate::runner_protocol::ShellCommandExecutionState::Completed,
                ),
                mcp_gateway: None,
                plugin_gateway: None,
                coding_agent: None,
            })
            .await
            .unwrap();
        operation
    };
    let (mut response, operation) = tokio::join!(http, runner_exchange);
    assert_eq!(response.status_code, Some(StatusCode::OK));
    (response.take_json::<Value>().await.unwrap(), operation)
}

fn endpoint() -> SshEndpoint {
    SshEndpoint {
        host: "192.0.2.10".into(),
        port: 2222,
        user: "operator".into(),
    }
}

fn fingerprint() -> String {
    format!("SHA256:{}", "A".repeat(43))
}

#[tokio::test]
async fn ssh_operator_endpoints_reject_delegated_credentials_before_parsing_secrets() {
    let runtime = test_runtime();
    for kind in [
        AuthKind::OAuth2Token,
        AuthKind::AgentToken,
        AuthKind::SharedKey,
        AuthKind::ProjectCredential,
        AuthKind::AccountCredential,
        AuthKind::OpenAnonymous,
    ] {
        let mut auth = operator_auth();
        auth.kind = kind;
        let service = service(runtime.clone(), auth);
        for action in ["list", "inspect", "probe", "register", "remove"] {
            let mut response = TestClient::post(url(action))
                .json(&json!({"password":"private-secret-sentinel"}))
                .send(&service)
                .await;
            assert_eq!(response.status_code, Some(StatusCode::FORBIDDEN));
            assert!(!response
                .take_json::<Value>()
                .await
                .unwrap()
                .to_string()
                .contains("private-secret-sentinel"));
        }
    }
    let mut no_scope = operator_auth();
    no_scope.scopes.clear();
    let denied = service(runtime.clone(), no_scope);
    assert_eq!(
        TestClient::post(url("register"))
            .json(&json!({}))
            .send(&denied)
            .await
            .status_code,
        Some(StatusCode::FORBIDDEN)
    );
    let allowed = service(runtime, operator_auth());
    let response = TestClient::post(url("register"))
        .add_header("Origin", "https://foreign.example", true)
        .json(&json!({}))
        .send(&allowed)
        .await;
    assert_eq!(response.status_code, Some(StatusCode::FORBIDDEN));
}

#[tokio::test]
async fn ssh_operator_parse_failures_never_echo_secret_values_or_serde_errors() {
    let service = service(test_runtime(), operator_auth());
    for body in [
        json!({"binding":"missing","endpoint":"private-secret-sentinel","authentication":false,"host_key":null}),
        json!({"binding":"missing","endpoint":endpoint(),"authentication":{"type":"private-secret-sentinel"},"host_key":{}}),
        json!({"binding":"missing","endpoint":endpoint(),"authentication":{"type":"password","password":"private-secret-sentinel".repeat(3000)},"host_key":{}}),
    ] {
        let mut response = TestClient::post(url("probe"))
            .json(&body)
            .send(&service)
            .await;
        let result = response.take_json::<Value>().await.unwrap();
        assert_eq!(result["success"], false);
        assert_eq!(result["output"]["error_kind"], "ssh_resource_invalid");
        assert!(!result.to_string().contains("private-secret-sentinel"));
        assert!(!result.to_string().contains("unknown variant"));
    }
}

#[tokio::test]
async fn ssh_operator_inspection_and_probe_reuse_observation_but_save_consumes_it() {
    let runtime = test_runtime();
    register_runner(&runtime, true).await;
    let service = service(runtime.clone(), operator_auth());
    let (list, _) = exchange(
        &runtime,
        &service,
        "list",
        json!({"runner":"ssh-operator-runner"}),
        SshResourceResponse::List {
            revision: 7,
            resources: Vec::new(),
        },
    )
    .await;
    assert_eq!(list["success"], true);
    assert_eq!(list["output"]["setup_supported"], true);
    let binding = list["output"]["binding"].as_str().unwrap();
    let (inspection, operation) = exchange(
        &runtime,
        &service,
        "inspect",
        json!({"binding":binding,"endpoint":endpoint()}),
        SshResourceResponse::Inspect {
            revision: 7,
            challenge_id: "challenge_1".into(),
            expires_at: 300,
            host_keys: vec![SshHostKeyCandidate {
                algorithm: "ssh-ed25519".into(),
                fingerprint: fingerprint(),
            }],
        },
    )
    .await;
    assert!(matches!(
        operation,
        SshResourceRequest::Inspect {
            expected_revision: 7,
            ..
        }
    ));
    assert_eq!(inspection["output"]["challenge_id"], "challenge_1");
    let credentials = json!({"type":"password","password":"private-password-sentinel"});
    let host_key = json!({"challenge_id":"challenge_1","fingerprint":fingerprint()});
    let (probe, operation) = exchange(&runtime, &service, "probe", json!({"binding":binding,"endpoint":endpoint(),"authentication":credentials,"host_key":host_key}), SshResourceResponse::Probe { revision: 7, host_key_fingerprint: fingerprint() }).await;
    assert!(matches!(
        operation,
        SshResourceRequest::Probe {
            expected_revision: 7,
            ..
        }
    ));
    assert_eq!(probe["success"], true);
    assert!(!probe.to_string().contains("private-password-sentinel"));
    let register = json!({"binding":binding,"name":"production","default_cwd":"/workspace","connection":{"kind":"direct","endpoint":endpoint(),"authentication":credentials,"host_key":host_key}});
    let (saved, operation) = exchange(
        &runtime,
        &service,
        "register",
        register.clone(),
        SshResourceResponse::Register {
            revision: 8,
            resource: "production".into(),
            persisted: true,
            active: false,
            restart_required: true,
        },
    )
    .await;
    assert!(matches!(
        operation,
        SshResourceRequest::RegisterConnection {
            expected_revision: 7,
            ..
        }
    ));
    assert_eq!(
        saved["output"],
        json!({"resource":"production","persisted":true,"active":false,"restart_required":true})
    );
    assert!(!saved.to_string().contains("private-password-sentinel"));
    let mut replay = TestClient::post(url("register"))
        .json(&register)
        .send(&service)
        .await;
    let result = replay.take_json::<Value>().await.unwrap();
    assert_eq!(result["success"], false);
    assert_eq!(
        result["output"]["error_kind"],
        "ssh_resource_binding_required"
    );
    assert!(runtime
        .runner_registry
        .poll(RunnerPollRequest {
            client_id: "ssh-operator-runner".into(),
            runner_instance_id: "ssh-instance".into()
        })
        .await
        .unwrap()
        .is_none());
}

#[tokio::test]
async fn ssh_operator_does_not_send_new_wire_actions_to_old_runners_or_foreign_callers() {
    let runtime = test_runtime();
    register_runner(&runtime, false).await;
    let owner = service(runtime.clone(), operator_auth());
    let (list, _) = exchange(
        &runtime,
        &owner,
        "list",
        json!({"runner":"ssh-operator-runner"}),
        SshResourceResponse::List {
            revision: 0,
            resources: Vec::new(),
        },
    )
    .await;
    assert_eq!(list["output"]["setup_supported"], false);
    let body = json!({"binding":list["output"]["binding"],"endpoint":endpoint()});
    let mut response = TestClient::post(url("inspect"))
        .json(&body)
        .send(&owner)
        .await;
    assert_eq!(
        response.take_json::<Value>().await.unwrap()["output"]["error_kind"],
        "ssh_connection_setup_unsupported"
    );
    let mut stranger = operator_auth();
    stranger.api_key_id = Some("different-operator-token".into());
    let stranger = service(runtime.clone(), stranger);
    let mut response = TestClient::post(url("inspect"))
        .json(&body)
        .send(&stranger)
        .await;
    assert_eq!(
        response.take_json::<Value>().await.unwrap()["output"]["error_kind"],
        "ssh_resource_binding_required"
    );
    assert!(runtime
        .runner_registry
        .poll(RunnerPollRequest {
            client_id: "ssh-operator-runner".into(),
            runner_instance_id: "ssh-instance".into()
        })
        .await
        .unwrap()
        .is_none());
}

#[test]
fn ssh_operator_route_metadata_preserves_first_party_and_independent_ssh_scope() {
    use crate::route_metadata::RouteId::*;
    for route in [
        RuntimeConsoleSshResourcesList,
        RuntimeConsoleSshResourcesInspect,
        RuntimeConsoleSshResourcesProbe,
        RuntimeConsoleSshResourcesRegister,
        RuntimeConsoleSshResourcesRemove,
    ] {
        assert_eq!(
            crate::route_metadata::spec(route).scope_policy,
            webcodex_core::authority::OAuthRouteScopePolicy::FirstPartyRequire(
                crate::auth::SCOPE_SSH_LOCAL
            )
        );
    }
}
