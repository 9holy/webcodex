//! Desktop uses the same authorized, bounded product endpoints as the WebUI.
//! Plugin reload is an explicit action dispatched through the canonical Plugin gate.
//! The WebView never receives a credential or chooses a URL, header, or tool.
use crate::error::{DesktopError, DesktopResult};
use crate::models::StoredRuntime;
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;
use tokio::io::AsyncReadExt;

const MAX_RESPONSE_BYTES: usize = 1024 * 1024;

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum WorkspaceRequest {
    Overview {},
    Projects {},
    RunnerDetails {},
    BrowserStatus {},
    Windows {},
    CodingAgentRuns {
        expected: crate::webcodex::settings::SettingsTarget,
    },
    CodingAgentPermission {
        expected: crate::webcodex::settings::SettingsTarget,
        run_id: String,
        request_id: String,
        outcome: webcodex_core::coding_agent::CodingAgentPermissionOutcome,
        #[serde(default)]
        option_id: Option<String>,
    },
    Sessions {
        project: String,
    },
    Session {
        project: String,
        session_id: String,
    },
    Window {
        client_window_key: String,
    },
    Extensions {
        project: String,
    },
    ProjectGit {
        project: String,
    },
    Instruction {
        project: String,
        source_scope: String,
        path: String,
        fingerprint: String,
    },
    PluginReload {
        project: String,
        plugin: String,
    },
}

pub fn unavailable() -> DesktopError {
    DesktopError::new(
        "workspace_unavailable",
        "Workspace could not be refreshed",
        "Check the Server and Runner, then refresh.",
    )
}

fn authentication_required() -> DesktopError {
    DesktopError::new(
        "workspace_authentication_required",
        "Server authentication is missing or expired",
        "Restore the saved user credential, then refresh.",
    )
}

fn response_error(status: reqwest::StatusCode) -> DesktopError {
    match status {
        reqwest::StatusCode::UNAUTHORIZED => authentication_required(),
        reqwest::StatusCode::FORBIDDEN => DesktopError::new(
            "workspace_permission_denied",
            "The user cannot access this Server view",
            "Check the existing user's permissions on the Server.",
        ),
        reqwest::StatusCode::CONFLICT
        | reqwest::StatusCode::GONE
        | reqwest::StatusCode::NOT_FOUND => DesktopError::new(
            "workspace_request_changed",
            "The request changed or is no longer available",
            "Refresh the current state before choosing again.",
        ),
        _ => unavailable(),
    }
}

fn unreachable() -> DesktopError {
    DesktopError::new(
        "workspace_server_unreachable",
        "The Server could not be reached",
        "Check the Server address and connection, then refresh.",
    )
}

fn request_body(
    request: WorkspaceRequest,
    runner: Option<&str>,
) -> DesktopResult<(&'static str, Value)> {
    // These selectors are identities, not paths. Authorization remains at the Server.
    let valid = |value: &str| {
        !value.is_empty() && value.len() <= 512 && !value.chars().any(char::is_control)
    };
    let own_project = |value: &str| {
        runner.is_some_and(|runner| valid(value) && value.starts_with(&format!("agent:{runner}:")))
    };
    Ok(match request {
        WorkspaceRequest::Overview {} => ("overview", json!({})),
        WorkspaceRequest::Projects {} => ("projects", json!({"limit": 200})),
        WorkspaceRequest::RunnerDetails {} if runner.is_some() => {
            ("runner", json!({"client_id": runner, "project_limit": 200}))
        }
        WorkspaceRequest::BrowserStatus {} if runner.is_some() => {
            ("browser-status", json!({"client_id": runner}))
        }
        WorkspaceRequest::Windows {} => ("windows", json!({"limit": 64})),
        WorkspaceRequest::CodingAgentRuns { .. } => ("coding-agent-runs", json!({})),
        WorkspaceRequest::CodingAgentPermission {
            run_id,
            request_id,
            outcome,
            option_id,
            ..
        } if webcodex_core::coding_agent::validate_run_id(&run_id).is_ok()
            && webcodex_core::coding_agent::validate_permission_request_id(&request_id).is_ok() =>
        {
            let decision =
                webcodex_core::coding_agent::CodingAgentPermissionDecision { outcome, option_id };
            webcodex_core::coding_agent::validate_permission_decision(&decision)
                .map_err(|_| unavailable())?;
            let mut params = serde_json::to_value(decision).map_err(|_| unavailable())?;
            params["run_id"] = run_id.into();
            params["request_id"] = request_id.into();
            (
                "coding-agent-permission",
                json!({"tool":"respond_coding_agent_permission", "params":params}),
            )
        }
        WorkspaceRequest::Sessions { project } if valid(&project) => (
            "workflow-sessions",
            json!({"project": project, "limit": 50}),
        ),
        WorkspaceRequest::Session {
            project,
            session_id,
        } if valid(&project) && valid(&session_id) => (
            "workflow-session",
            json!({"project": project, "session_id": session_id, "limit": 50}),
        ),
        WorkspaceRequest::Window { client_window_key } if valid(&client_window_key) => (
            "window",
            json!({"client_window_key": client_window_key, "activity_limit": 30, "session_limit": 20}),
        ),
        WorkspaceRequest::Extensions { project } if valid(&project) => {
            ("extensions", json!({"project": project}))
        }
        WorkspaceRequest::ProjectGit { project } if valid(&project) => {
            ("project-git", json!({"project": project}))
        }
        WorkspaceRequest::Instruction {
            project,
            source_scope,
            path,
            fingerprint,
        } if valid(&project)
            && matches!(source_scope.as_str(), "runner" | "project")
            && path.len() <= 4096
            && fingerprint.len() <= 128 =>
        {
            (
                "instruction",
                json!({"project":project,"source_scope":source_scope,"path":path,"fingerprint":fingerprint}),
            )
        }
        WorkspaceRequest::PluginReload { project, plugin }
            if own_project(&project) && valid(&plugin) && plugin.len() <= 64 =>
        {
            ("plugin-reload", json!({"project":project,"plugin":plugin}))
        }
        _ => return Err(unavailable()),
    })
}

pub async fn query(runtime: &StoredRuntime, request: WorkspaceRequest) -> DesktopResult<Value> {
    if let WorkspaceRequest::CodingAgentRuns { expected }
    | WorkspaceRequest::CodingAgentPermission { expected, .. } = &request
    {
        crate::webcodex::settings::verify_target(runtime, expected)?;
    }
    let (route, body) = request_body(request, runtime.runner_client_id.as_deref())?;
    let path = if route == "coding-agent-permission" {
        "/api/tools/call".to_owned()
    } else {
        format!("/api/runtime-console/{route}")
    };
    post(runtime, &path, body, Duration::from_secs(12)).await
}

// Native callers choose fixed routes and schemas; never expose a generic WebView dispatch.
pub(crate) async fn post(
    runtime: &StoredRuntime,
    route: &str,
    body: Value,
    timeout: Duration,
) -> DesktopResult<Value> {
    let mut url = url::Url::parse(&runtime.server_url).map_err(|_| unavailable())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(unavailable());
    }
    url.set_path(route);
    url.set_query(None);
    url.set_fragment(None);
    let mut builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(timeout);
    if matches!(
        url.host_str(),
        Some("localhost" | "127.0.0.1" | "[::1]" | "::1")
    ) {
        builder = builder.no_proxy();
    }
    let token_path = runtime
        .user_token_file
        .as_ref()
        .ok_or_else(authentication_required)?;
    let mut token = String::new();
    tokio::fs::File::open(token_path)
        .await
        .map_err(|_| authentication_required())?
        .take(16_385)
        .read_to_string(&mut token)
        .await
        .map_err(|_| authentication_required())?;
    if token.len() > 16_384 || token.trim().is_empty() {
        return Err(authentication_required());
    }
    let client = builder.build().map_err(|_| unavailable())?;
    let mut response = client
        .post(url)
        .bearer_auth(token.trim())
        .json(&body)
        .send()
        .await
        .map_err(|_| unreachable())?;
    drop(token);
    if !response.status().is_success() {
        return Err(response_error(response.status()));
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_RESPONSE_BYTES as u64)
    {
        return Err(unavailable());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| unavailable())? {
        if bytes.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
            return Err(unavailable());
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| unavailable())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn response_failures_preserve_authentication_and_permission_boundaries() {
        assert_eq!(
            response_error(reqwest::StatusCode::UNAUTHORIZED).code,
            "workspace_authentication_required"
        );
        assert_eq!(
            response_error(reqwest::StatusCode::FORBIDDEN).code,
            "workspace_permission_denied"
        );
        assert_eq!(
            response_error(reqwest::StatusCode::INTERNAL_SERVER_ERROR).code,
            "workspace_unavailable"
        );
    }
    #[test]
    fn permission_bridge_uses_one_fixed_tool_and_exact_decision_schema() {
        let expected = json!({"config_path":"/fixture/runner.toml","client_id":"runner","server_url":"http://127.0.0.1:62645"});
        for decision in [
            json!({"outcome":"selected","option_id":"provider-option"}),
            json!({"outcome":"cancelled"}),
        ] {
            let mut request = decision.clone();
            request["kind"] = "coding_agent_permission".into();
            request["expected"] = expected.clone();
            request["run_id"] = "wc_agent_run_fixture".into();
            request["request_id"] = "wc_agent_permission_fixture".into();
            let request: WorkspaceRequest = serde_json::from_value(request).unwrap();
            let (route, body) = request_body(request, Some("runner")).unwrap();
            assert_eq!(route, "coding-agent-permission");
            assert_eq!(body["tool"], "respond_coding_agent_permission");
            assert_eq!(body["params"]["outcome"], decision["outcome"]);
            assert_eq!(body["params"]["run_id"], "wc_agent_run_fixture");
            assert_eq!(body["params"]["request_id"], "wc_agent_permission_fixture");
            assert_eq!(body["params"].get("option_id"), decision.get("option_id"));
            assert!(body["params"].get("expected").is_none());
        }
        for decision in [
            json!({"outcome":"selected"}),
            json!({"outcome":"cancelled","option_id":"provider-option"}),
        ] {
            let mut request = decision;
            request["kind"] = "coding_agent_permission".into();
            request["expected"] = expected.clone();
            request["run_id"] = "wc_agent_run_fixture".into();
            request["request_id"] = "wc_agent_permission_fixture".into();
            assert!(
                request_body(serde_json::from_value(request).unwrap(), Some("runner")).is_err()
            );
        }
    }

    #[tokio::test]
    async fn approval_bridge_rejects_a_replaced_connection_before_reading_credentials_or_sending() {
        let runtime = StoredRuntime {
            server_url: "http://127.0.0.1:62645".into(),
            runner_config: Some("/fixture/runner.toml".into()),
            runner_client_id: Some("runner".into()),
            server_env_file: None,
            user_token_file: None,
            project_id: None,
            runtime_project_id: None,
        };
        let mut expected = crate::webcodex::settings::target(&runtime).unwrap();
        expected.client_id = "replacement".into();
        let request = WorkspaceRequest::CodingAgentPermission {
            expected,
            run_id: "wc_agent_run_fixture".into(),
            request_id: "wc_agent_permission_fixture".into(),
            outcome: webcodex_core::coding_agent::CodingAgentPermissionOutcome::Cancelled,
            option_id: None,
        };
        let error = query(&runtime, request).await.unwrap_err();
        // A transport or credential error would mean the old connection escaped the fence.
        assert_eq!(
            error.code,
            crate::webcodex::settings::verify_target(
                &runtime,
                &crate::webcodex::settings::SettingsTarget {
                    config_path: "/fixture/runner.toml".into(),
                    client_id: "replacement".into(),
                    server_url: runtime.server_url.clone(),
                }
            )
            .unwrap_err()
            .code
        );
    }

    #[test]
    fn request_vocabulary_is_closed_and_selectors_are_bounded() {
        assert!(serde_json::from_value::<WorkspaceRequest>(
            json!({"kind":"overview","url":"https://other.example"})
        )
        .is_err());
        assert!(serde_json::from_value::<WorkspaceRequest>(json!({"kind":"run_shell"})).is_err());
        assert!(request_body(
            WorkspaceRequest::Sessions {
                project: "x".repeat(513)
            },
            Some("runner")
        )
        .is_err());
        assert_eq!(
            request_body(WorkspaceRequest::Overview {}, Some("mini"))
                .unwrap()
                .1,
            json!({})
        );
    }
}
