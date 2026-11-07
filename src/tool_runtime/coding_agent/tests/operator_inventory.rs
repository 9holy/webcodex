use super::*;
use crate::runner_protocol::RunnerProjectSummary;

fn operator_auth() -> AuthContext {
    let mut auth = owner_auth();
    auth.scopes = vec![crate::auth::SCOPE_CODING_AGENT_RUN.to_string()];
    auth
}

async fn operator_runner(runtime: &ToolRuntime, runs: Vec<CodingAgentRunSnapshot>) {
    runtime
        .runner_registry
        .register(RunnerRegisterRequest {
            computer_session_availability: None,
            computer_control_epoch: None,
            process_started_at: None,
            build: None,
            job_concurrency_limit: None,
            job_inventory: None,
            coding_agent_providers: Some(vec![CodingAgentProvider {
                provider_id: "codex".into(),
                provider_instance_id: "provider".into(),
                name: "Codex".into(),
            }]),
            coding_agent_inventory: Some(CodingAgentRunInventory { runs }),
            client_id: "client".into(),
            runner_instance_id: "instance".into(),
            runner_protocol_generation: crate::runner_protocol::RUNNER_PROTOCOL_GENERATION_V2,
            display_name: None,
            owner: Some("owner-retained".into()),
            hostname: None,
            host_context: None,
            capabilities: current_runner_capabilities(RunnerCapabilities {
                coding_agent_runs: true,
                coding_agent_permission_responses: true,
                ..Default::default()
            }),
            policy: None,
        })
        .await
        .unwrap();
}

async fn operator_project(runtime: &ToolRuntime, disabled: bool) {
    crate::test_support::apply_project_inventory_snapshot(
        &runtime.runner_registry,
        "client",
        "instance",
        vec![RunnerProjectSummary {
            id: "demo".into(),
            name: Some("Demo".into()),
            path: "/private/operator-project".into(),
            allow_patch: true,
            kind: None,
            registration_source: None,
            description: None,
            hooks: vec![],
            disabled,
            revision: Some(format!("sha256:{}", "1".repeat(64))),
            root_fingerprint: None,
            lineage: None,
            git_branch: None,
            git_head: None,
            git_dirty: None,
            updated_at: 1,
            shell_profile: None,
        }],
    )
    .await;
}

fn operator_snapshot(
    id: &str,
    state: CodingAgentRunState,
    auth: &AuthContext,
) -> CodingAgentRunSnapshot {
    let mut run = owned_snapshot(id, state, Some(auth));
    run.runtime_project_id = "agent:client:demo".into();
    run
}

#[tokio::test]
async fn operator_inventory_uses_current_scope_owner_project_and_safe_projection() {
    let runtime = ToolRuntime::new_for_tests();
    let mut auth = operator_auth();
    operator_runner(&runtime, vec![]).await;
    operator_project(&runtime, false).await;
    let id = "wc_agent_run_operator_owned";
    bind_snapshot(
        &runtime,
        operator_snapshot(id, CodingAgentRunState::Running, &auth),
    )
    .await;
    let mut other = auth.clone();
    other.user_id = Some("other-principal".into());
    bind_snapshot(
        &runtime,
        operator_snapshot(
            "wc_agent_run_other_principal",
            CodingAgentRunState::Running,
            &other,
        ),
    )
    .await;

    let output = serde_json::to_value(
        runtime
            .coding_agent_operator_inventory(&auth)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(output["runs"].as_array().unwrap().len(), 1);
    assert_eq!(output["runs"][0]["run_id"], id);
    assert_eq!(
        output["authorization"],
        json!({"can_run":true,"can_approve":false})
    );
    assert_eq!(output["truncated"], false);
    for private in [
        "authority_fingerprint",
        "intent_fingerprint",
        "provider_instance_id",
        "recording_session_id",
        "/private/",
    ] {
        assert!(!output.to_string().contains(private), "{private}");
    }

    auth.scopes
        .push(webcodex_core::authority::SCOPE_CODING_AGENT_APPROVE.into());
    let output = serde_json::to_value(
        runtime
            .coding_agent_operator_inventory(&auth)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(output["authorization"]["can_approve"], false);
    auth.scopes.push(crate::auth::SCOPE_PROJECT_WRITE.into());
    let output = serde_json::to_value(
        runtime
            .coding_agent_operator_inventory(&auth)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(output["authorization"]["can_approve"], true);
    auth.scopes = vec![crate::auth::SCOPE_RUNTIME_READ.into()];
    assert!(runtime
        .coding_agent_operator_inventory(&auth)
        .await
        .is_err());

    auth = operator_auth();
    operator_project(&runtime, true).await;
    let output = serde_json::to_value(
        runtime
            .coding_agent_operator_inventory(&auth)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(output["runs"], json!([]));
}

#[tokio::test]
async fn operator_inventory_bounds_results_without_returning_foreign_principals() {
    let runtime = ToolRuntime::new_for_tests();
    let auth = operator_auth();
    operator_runner(&runtime, vec![]).await;
    operator_project(&runtime, false).await;
    for index in 0..40 {
        let id = format!("wc_agent_run_operator_{index:03}");
        bind_snapshot(
            &runtime,
            operator_snapshot(&id, CodingAgentRunState::Running, &auth),
        )
        .await;
    }
    let output = serde_json::to_value(
        runtime
            .coding_agent_operator_inventory(&auth)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(output["runs"].as_array().unwrap().len(), 32);
    assert_eq!(output["truncated"], true);
    let mut other = operator_auth();
    other.user_id = Some("foreign-user".into());
    let output = serde_json::to_value(
        runtime
            .coding_agent_operator_inventory(&other)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(output["runs"], json!([]));
    assert_eq!(output["truncated"], false);
}

#[tokio::test]
async fn operator_inventory_observes_exact_pending_request_and_does_not_decide() {
    use webcodex_core::coding_agent::{
        CodingAgentPendingPermission, CodingAgentPermissionOption, CodingAgentPermissionOptionKind,
    };
    let runtime = ToolRuntime::new_for_tests();
    let auth = operator_auth();
    let run = operator_snapshot(
        "wc_agent_run_operator_pending",
        CodingAgentRunState::WaitingPermission,
        &auth,
    );
    // A restarted Server has no process-local Run binding. The same authorized
    // inventory must recover it without leaking another principal's Runs.
    operator_runner(&runtime, vec![run.clone()]).await;
    operator_project(&runtime, false).await;
    let permission = CodingAgentPendingPermission {
        request_id: "wc_agent_permission_operator".into(),
        label: "Write a file".into(),
        details: "Update the exact selected project file".into(),
        expires_at: Utc::now().timestamp() + 60,
        options: vec![CodingAgentPermissionOption {
            option_id: "once".into(),
            name: "Allow once".into(),
            kind: CodingAgentPermissionOptionKind::AllowOnce,
        }],
    };
    let expected = serde_json::to_value(&permission).unwrap();
    let observation = CodingAgentObserveResult {
        run,
        events: vec![],
        first_retained_sequence: 1,
        next_sequence: 0,
        has_more: false,
        history_lost: false,
        pending_permission: Some(permission),
    };
    let read = runtime.coding_agent_operator_inventory(&auth);
    let respond = answer_next_runner_request(
        &runtime,
        CodingAgentResponse::success(CodingAgentResponsePayload::Observe { observation }),
    );
    let (inventory, ()) = tokio::join!(read, respond);
    let output = serde_json::to_value(inventory.unwrap()).unwrap();
    assert_eq!(output["runs"][0]["pending_permission"], expected);
    assert_eq!(output["runs"][0]["state"], "waiting_permission");
    assert_eq!(output["authorization"]["can_approve"], false);
    assert!(runtime
        .runner_registry
        .poll(RunnerPollRequest {
            client_id: "client".into(),
            runner_instance_id: "instance".into()
        })
        .await
        .unwrap()
        .is_none());
}
