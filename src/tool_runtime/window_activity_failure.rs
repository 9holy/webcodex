//! Human-facing failure evidence from existing, content-free ActionAudit facts.
//!
//! This projection never reads error_summary, tool output, exception text, or
//! subprocess logs. Runtime readers (including shared views) receive only a
//! closed vocabulary, not the privileged trace payload. It is descriptive, never
//! execution authority, a retry instruction, or proof of external deployment.
use serde::Serialize;
use webcodex_store::models::WindowActivityFailureMetadata;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CallFailureOutcome {
    Rejected,
    ExecutionFailed,
    OutcomeUnknown,
    CallFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CallFailureReason {
    MissingScope,
    AccessDenied,
    HostReviewRequired,
    SessionReadOnly,
    SessionClosed,
    SessionMissing,
    SessionExpired,
    SessionMismatch,
    SessionUnavailable,
    ProjectUnavailable,
    InvalidInput,
    RunnerUnavailable,
    UnsupportedResource,
    CapabilityUnavailable,
    RuntimeError,
    ApprovalChanged,
    SshAuthentication,
    SshHostKey,
    SshUnavailable,
    ProviderUnavailable,
    ExecutionError,
    Timeout,
    ResultUnconfirmed,
    StaleState,
    DetailsUnavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct CallFailure {
    pub(crate) outcome: CallFailureOutcome,
    pub(crate) reason: CallFailureReason,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error_kind: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) failure_kind: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) execution_state: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) recovery_kind: Option<&'static str>,
}

fn known(value: Option<&str>, allowed: &[&'static str]) -> Option<&'static str> {
    let value = value?;
    allowed.iter().copied().find(|allowed| *allowed == value)
}

fn safe_kind(value: Option<&str>) -> Option<&'static str> {
    known(
        value,
        &[
            "insufficient_scope",
            "permission_denied",
            "session_authority_denied",
            "direct_host_review_required",
            "session_guard_denied",
            "session_closed",
            "session_lifecycle_denied",
            "unknown_session_id",
            "session_retention_expired",
            "session_project_mismatch",
            "session_storage_unavailable",
            "unknown_project",
            "ambiguous_project",
            "invalid_arguments",
            "invalid_task_outputs",
            "invalid_params",
            "unknown_tool",
            "agent_offline",
            "agent_unavailable",
            "runner_unavailable",
            "runner_disconnected",
            "runner_unavailable_recovering",
            "coding_agent_runner_unavailable",
            "unsupported_resource",
            "capability_unavailable",
            "agent_capability_unavailable",
            "runtime_error",
            "stale_coding_agent_permission",
            "coding_agent_permission_not_pending",
            "coding_agent_permission_response_conflict",
            "coding_agent_permission_unavailable",
            "coding_agent_permission_response_uncertain",
            "invalid_coding_agent_permission_option",
            "ssh_authentication_failed",
            "ssh_credentials_unavailable",
            "ssh_host_key_unavailable",
            "ssh_host_key_stale",
            "ssh_host_key_changed",
            "ssh_connection_failed",
            "ssh_connection_timeout",
            "ssh_program_unavailable",
            "ssh_identity_file_invalid",
            "ssh_client_permission_denied",
            "ssh_connection_setup_unsupported",
            "coding_agent_provider_unavailable",
            "coding_agent_provider_disabled",
            "command_exit_nonzero",
            "timeout",
            "dispatch_hard_timeout",
            "outcome_unknown",
            "stale_file_revision",
            "stale_source",
            "stale_surface",
            "match_count_mismatch",
            "multiple_matches",
            "conflict",
            "not_started",
        ],
    )
}

fn reason(kind: Option<&str>) -> CallFailureReason {
    use CallFailureReason::*;
    match kind {
        Some("insufficient_scope") => MissingScope,
        Some("permission_denied" | "session_authority_denied") => AccessDenied,
        Some("direct_host_review_required") => HostReviewRequired,
        Some("session_guard_denied") => SessionReadOnly,
        Some("session_closed") => SessionClosed,
        Some("unknown_session_id") => SessionMissing,
        Some("session_retention_expired") => SessionExpired,
        Some("session_project_mismatch") => SessionMismatch,
        Some("session_storage_unavailable") => SessionUnavailable,
        Some("unknown_project" | "ambiguous_project") => ProjectUnavailable,
        Some(
            "invalid_arguments"
            | "invalid_task_outputs"
            | "invalid_params"
            | "unknown_tool"
            | "invalid_coding_agent_permission_option",
        ) => InvalidInput,
        Some(
            "agent_offline"
            | "agent_unavailable"
            | "runner_unavailable"
            | "runner_disconnected"
            | "runner_unavailable_recovering"
            | "coding_agent_runner_unavailable",
        ) => RunnerUnavailable,
        Some("unsupported_resource") => UnsupportedResource,
        Some("capability_unavailable" | "agent_capability_unavailable") => CapabilityUnavailable,
        Some("runtime_error") => RuntimeError,
        Some(
            "stale_coding_agent_permission"
            | "coding_agent_permission_not_pending"
            | "coding_agent_permission_response_conflict",
        ) => ApprovalChanged,
        Some(
            "ssh_authentication_failed"
            | "ssh_credentials_unavailable"
            | "ssh_identity_file_invalid",
        ) => SshAuthentication,
        Some("ssh_host_key_unavailable" | "ssh_host_key_stale" | "ssh_host_key_changed") => {
            SshHostKey
        }
        Some(
            "ssh_connection_failed"
            | "ssh_program_unavailable"
            | "ssh_client_permission_denied"
            | "ssh_connection_setup_unsupported",
        ) => SshUnavailable,
        Some("coding_agent_provider_unavailable" | "coding_agent_provider_disabled") => {
            ProviderUnavailable
        }
        Some("command_exit_nonzero") => ExecutionError,
        Some("timeout" | "dispatch_hard_timeout" | "ssh_connection_timeout") => Timeout,
        Some("outcome_unknown" | "coding_agent_permission_response_uncertain") => ResultUnconfirmed,
        Some(
            "stale_file_revision"
            | "stale_source"
            | "stale_surface"
            | "match_count_mismatch"
            | "multiple_matches"
            | "conflict",
        ) => StaleState,
        _ => DetailsUnavailable,
    }
}

pub(crate) fn project_call_failure(
    status: &str,
    metadata: &WindowActivityFailureMetadata,
) -> Option<CallFailure> {
    if !matches!(
        status,
        "failed" | "failure" | "error" | "timeout" | "timed_out"
    ) {
        return None;
    }
    let error_kind = safe_kind(metadata.error_kind.as_deref());
    let failure_kind = safe_kind(metadata.failure_kind.as_deref());
    let execution_state = known(
        metadata.execution_state.as_deref(),
        &[
            "not_started",
            "pending",
            "queued",
            "running",
            "started",
            "outcome_unknown",
            "completed",
            "cancelled",
            "timed_out",
        ],
    );
    let recovery_kind = known(
        metadata.recovery_kind.as_deref(),
        &[
            "fix_input",
            "retry_same",
            "reobserve",
            "reconcile",
            "wait",
            "user_action",
            "none",
        ],
    );
    let kind = error_kind.or(failure_kind);
    let uncertain = matches!(
        execution_state,
        Some("outcome_unknown" | "pending" | "queued" | "running" | "started" | "timed_out")
    ) || [error_kind, failure_kind].iter().any(|kind| {
        matches!(
            kind,
            Some(
                "outcome_unknown"
                    | "dispatch_hard_timeout"
                    | "coding_agent_permission_response_uncertain"
            )
        )
    });
    // No HTTP status, handler timing, raw error text, or missing result is proof
    // that execution did/did not happen. Only producer-owned lifecycle facts
    // support the stronger classifications; a failure code can also come from a
    // nested operation after an earlier effect in the same call.
    let outcome = if uncertain {
        CallFailureOutcome::OutcomeUnknown
    } else if execution_state == Some("not_started") {
        CallFailureOutcome::Rejected
    } else if execution_state == Some("completed") && failure_kind == Some("command_exit_nonzero") {
        CallFailureOutcome::ExecutionFailed
    } else {
        CallFailureOutcome::CallFailed
    };
    Some(CallFailure {
        outcome,
        reason: reason(kind),
        error_kind,
        failure_kind,
        execution_state,
        recovery_kind,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn metadata(kind: &str, state: Option<&str>) -> WindowActivityFailureMetadata {
        WindowActivityFailureMetadata {
            error_kind: Some(kind.into()),
            execution_state: state.map(str::to_string),
            ..Default::default()
        }
    }

    #[test]
    fn failure_projection_distinguishes_rejection_execution_and_uncertainty() {
        let denied = project_call_failure(
            "failed",
            &metadata("insufficient_scope", Some("not_started")),
        )
        .unwrap();
        assert_eq!(denied.outcome, CallFailureOutcome::Rejected);
        assert_eq!(denied.reason, CallFailureReason::MissingScope);
        let command = WindowActivityFailureMetadata {
            failure_kind: Some("command_exit_nonzero".into()),
            execution_state: Some("completed".into()),
            ..Default::default()
        };
        assert_eq!(
            project_call_failure("failed", &command).unwrap().outcome,
            CallFailureOutcome::ExecutionFailed
        );
        for metadata in [
            metadata("dispatch_hard_timeout", None),
            metadata("permission_denied", Some("outcome_unknown")),
            metadata("runner_disconnected", Some("running")),
        ] {
            assert_eq!(
                project_call_failure("failed", &metadata).unwrap().outcome,
                CallFailureOutcome::OutcomeUnknown
            );
        }
    }

    #[test]
    fn failure_projection_never_infers_execution_from_legacy_failure_or_completion_alone() {
        let legacy = project_call_failure("failed", &Default::default()).unwrap();
        assert_eq!(legacy.outcome, CallFailureOutcome::CallFailed);
        assert_eq!(legacy.reason, CallFailureReason::DetailsUnavailable);
        let post_execution =
            project_call_failure("failed", &metadata("permission_denied", Some("completed")))
                .unwrap();
        assert_eq!(post_execution.outcome, CallFailureOutcome::CallFailed);
        assert!(project_call_failure("success", &metadata("permission_denied", None)).is_none());
    }

    #[test]
    fn known_shell_rejection_codes_preserve_reason_without_changing_execution_evidence() {
        for (kind, expected) in [
            (
                "unsupported_resource",
                CallFailureReason::UnsupportedResource,
            ),
            (
                "capability_unavailable",
                CallFailureReason::CapabilityUnavailable,
            ),
            (
                "agent_capability_unavailable",
                CallFailureReason::CapabilityUnavailable,
            ),
            ("runtime_error", CallFailureReason::RuntimeError),
        ] {
            for (state, outcome) in [
                (Some("not_started"), CallFailureOutcome::Rejected),
                (Some("outcome_unknown"), CallFailureOutcome::OutcomeUnknown),
                (None, CallFailureOutcome::CallFailed),
            ] {
                let failure = project_call_failure(
                    "failed",
                    &WindowActivityFailureMetadata {
                        failure_kind: Some(kind.into()),
                        execution_state: state.map(str::to_string),
                        ..Default::default()
                    },
                )
                .unwrap();
                assert_eq!(failure.failure_kind, Some(kind));
                assert_eq!(failure.reason, expected);
                assert_eq!(failure.outcome, outcome);
            }
        }
        let unknown = project_call_failure(
            "failed",
            &metadata("private_unknown_failure", Some("not_started")),
        )
        .unwrap();
        assert_eq!(unknown.outcome, CallFailureOutcome::Rejected);
        assert_eq!(unknown.reason, CallFailureReason::DetailsUnavailable);
        assert_eq!(unknown.error_kind, None);
    }

    #[test]
    fn failure_projection_allows_only_closed_content_free_vocabulary() {
        let private = WindowActivityFailureMetadata {
            error_kind: Some("private_exception_or_password".into()),
            failure_kind: Some("Bearer PRIVATE".into()),
            execution_state: Some("private_path".into()),
            recovery_kind: Some("retry with private secret".into()),
        };
        let value =
            serde_json::to_value(project_call_failure("failed", &private).unwrap()).unwrap();
        assert_eq!(
            value,
            serde_json::json!({"outcome":"call_failed", "reason":"details_unavailable"})
        );
    }

    #[test]
    fn finish_call_preconditions_are_not_deployment_execution_failures() {
        for kind in [
            "invalid_task_outputs",
            "unknown_session_id",
            "session_project_mismatch",
            "session_guard_denied",
            "permission_denied",
            "invalid_arguments",
            "direct_host_review_required",
        ] {
            let failure = project_call_failure("failed", &metadata(kind, None)).unwrap();
            assert_eq!(failure.outcome, CallFailureOutcome::CallFailed);
            assert_ne!(failure.reason, CallFailureReason::ExecutionError);
        }
    }
}
