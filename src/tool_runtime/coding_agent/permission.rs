//! Canonical authorization for explicit human ACP permission responses.

use super::*;
use webcodex_core::coding_agent::{
    validate_permission_decision, validate_permission_request_id, validate_run_id,
    CodingAgentPermissionDecision, CodingAgentRespondPermissionRequest,
};

impl ToolRuntime {
    pub(crate) async fn coding_agent_respond_permission(
        &self,
        run_id: String,
        request_id: String,
        decision: CodingAgentPermissionDecision,
        auth: Option<&AuthContext>,
    ) -> ToolResult {
        // Internal/operator adapters use the same independent scope boundary as
        // canonical tool dispatch. Auth-disabled operation is not an approval
        // principal; shared keys and project credentials do not gain this scope.
        if let Err(error) = crate::tool_runtime::kernel::check_runtime_tool_scope(
            auth,
            "respond_coding_agent_permission",
        ) {
            return ToolResult::err_with_output(
                format!("Explicit ACP approval authority is required: {error:?}"),
                json!({"error_kind":"permission_denied", "failure_kind":"policy_rejected", "state_changed":false}),
            ).with_recovery(RecoveryKind::UserAction);
        }
        if let Err(error) = validate_run_id(&run_id)
            .and_then(|()| validate_permission_request_id(&request_id))
            .and_then(|()| validate_permission_decision(&decision))
        {
            return coding_agent_error(
                "invalid_coding_agent_permission_response",
                error,
                "not_started",
                RecoveryKind::FixInput,
                Some(&run_id),
            );
        }
        let authority = match stable_principal(auth) {
            Ok(principal) => authority_fingerprint(&principal),
            Err(error) => {
                return coding_agent_error(
                    "coding_agent_identity_unavailable",
                    error,
                    "not_started",
                    RecoveryKind::UserAction,
                    Some(&run_id),
                )
            }
        };
        let binding = match self.reconcile_run(&run_id, &authority, auth).await {
            Ok(Some(binding)) if binding.authority_fingerprint == authority => binding,
            Ok(_) => {
                return coding_agent_error(
                    "unknown_coding_agent_run",
                    "CodingAgentRun is not visible to this caller",
                    "not_started",
                    RecoveryKind::Reobserve,
                    Some(&run_id),
                )
            }
            Err(error) => {
                return coding_agent_error(
                    "coding_agent_observation_conflict",
                    error,
                    "outcome_unknown",
                    RecoveryKind::Reconcile,
                    Some(&run_id),
                )
            }
        };
        // Run knowledge/ownership alone is insufficient. Reauthorize the exact
        // current Project and writable policy before asking its original Runner.
        let resolved = match self
            .resolve_project_input_for_auth(&binding.runtime_project_id, auth)
            .await
        {
            Ok(resolved) => resolved,
            Err(error) => return error.into_tool_result(),
        };
        if resolved.resolved_id != binding.runtime_project_id
            || resolved.config.client_id != binding.client_id
            || !resolved.config.allow_patch
        {
            return coding_agent_error(
                "stale_coding_agent_permission",
                "Permission response requires the original writable Project and Runner",
                retained_run_execution_state(&binding.snapshot),
                RecoveryKind::UserAction,
                Some(&run_id),
            );
        }
        let operation =
            CodingAgentRequest::RespondPermission(CodingAgentRespondPermissionRequest {
                run_id: run_id.clone(),
                request_id: request_id.clone(),
                decision: decision.clone(),
                authority_fingerprint: authority.clone(),
                runtime_project_id: binding.runtime_project_id.clone(),
                project_root: resolved.config.path,
                provider_id: binding.provider_id.clone(),
                provider_instance_id: binding.provider_instance_id.clone(),
            });
        let (dispatch_id, receiver) = match self
            .runner_registry
            .enqueue_coding_agent(
                &binding.client_id,
                &binding.runner_instance_id,
                &binding.provider_id,
                &binding.provider_instance_id,
                operation,
                crate::runner_http::runner_access_from_auth(auth).as_ref(),
                authority,
            )
            .await
        {
            Ok(value) => value,
            Err(error) => {
                return coding_agent_error(
                    "coding_agent_permission_unavailable",
                    error,
                    self.current_retained_execution_state(&binding).await,
                    RecoveryKind::Reobserve,
                    Some(&run_id),
                )
            }
        };
        let response = match tokio::time::timeout(
            Duration::from_secs(START_RESPONSE_WAIT_SECS),
            receiver,
        )
        .await
        {
            Ok(Ok(response)) => response,
            _ => {
                let _ = self
                    .runner_registry
                    .cancel_request_dispatch_state(&dispatch_id)
                    .await;
                return coding_agent_error("coding_agent_permission_response_uncertain", "Decision receipt is uncertain; observe the same Run. Never select a different option or start replacement work", self.current_retained_execution_state(&binding).await, RecoveryKind::Reobserve, Some(&run_id));
            }
        };
        match response.payload {
            Some(CodingAgentResponsePayload::RespondPermission {
                run,
                request_id: returned_id,
                decision: returned_decision,
            }) => {
                if !run_matches_binding_identity(&binding, &run)
                    || returned_id != request_id
                    || returned_decision != decision
                {
                    return coding_agent_error(
                        "invalid_runner_response",
                        "Runner returned a mismatched permission receipt",
                        self.current_retained_execution_state(&binding).await,
                        RecoveryKind::Reconcile,
                        Some(&run_id),
                    );
                }
                let current = self
                    .runner_registry
                    .get_runner_view_for_auth(
                        &binding.client_id,
                        crate::runner_http::runner_access_from_auth(auth).as_ref(),
                    )
                    .await;
                if !current.is_some_and(|client| {
                    client.runner_instance_id == binding.runner_instance_id
                        && client
                            .coding_agent_providers
                            .as_deref()
                            .unwrap_or_default()
                            .iter()
                            .any(|provider| {
                                provider.provider_id == binding.provider_id
                                    && provider.provider_instance_id == binding.provider_instance_id
                            })
                }) {
                    return coding_agent_error("coding_agent_permission_response_uncertain", "Owning Runner/provider changed while the decision was in flight; observe the original Run", self.current_retained_execution_state(&binding).await, RecoveryKind::Reconcile, Some(&run_id));
                }
                let merged = match self
                    .coding_agent_runs
                    .merge_bound_snapshot(&binding, run)
                    .await
                {
                    Ok(merged) => merged,
                    Err(error) => {
                        return coding_agent_error(
                            "coding_agent_observation_conflict",
                            error,
                            self.current_retained_execution_state(&binding).await,
                            RecoveryKind::Reconcile,
                            Some(&run_id),
                        )
                    }
                };
                self.record_coding_agent_lifecycle_if_needed(&run_id).await;
                let mut output = json!({
                    "run_id": run_id,
                    "project": merged.runtime_project_id,
                    "provider_id": merged.provider_id,
                    "state": merged.snapshot.state.as_str(),
                    "execution_state": merged.snapshot.execution_state.as_str(),
                    "terminal": terminal_projection(&merged.snapshot),
                    "request_id": request_id,
                    "outcome": decision.outcome,
                    "response_accepted": true,
                });
                if let Some(option_id) = decision.option_id {
                    output["option_id"] = json!(option_id);
                }
                ToolResult::ok(output)
            }
            _ => {
                let retained = self.current_retained_binding(&binding).await;
                response_to_tool_error(response, Some(&run_id), &retained.snapshot)
            }
        }
    }
}
