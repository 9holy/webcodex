//! Bounded human decisions for one live, Runner-owned ACP callback.
//!
//! These identities never contain ACP session ids or JSON-RPC request ids.
//! A decision selects only an option advertised by that exact callback; it is
//! not a standing grant, a provider configuration change, or Run admission.

use super::*;
use std::collections::HashSet;

pub const CODING_AGENT_MAX_PERMISSION_OPTIONS: usize = 8;
pub const CODING_AGENT_MAX_PERMISSION_ID_BYTES: usize = 96;
pub const CODING_AGENT_MAX_PERMISSION_OPTION_ID_BYTES: usize = 128;
pub const CODING_AGENT_MAX_PERMISSION_OPTION_NAME_BYTES: usize = 256;
pub const CODING_AGENT_MAX_PERMISSION_LABEL_BYTES: usize = 1024;
pub const CODING_AGENT_MAX_PERMISSION_DETAILS_BYTES: usize = 64 * 1024;
pub const CODING_AGENT_MAX_PERMISSION_RECEIPTS: usize = 64;
pub const CODING_AGENT_PERMISSION_TIMEOUT_DEFAULT_SECS: u64 = 300;
pub const CODING_AGENT_PERMISSION_TIMEOUT_MAX_SECS: u64 = 600;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum CodingAgentPermissionOptionKind {
    AllowOnce,
    AllowAlways,
    RejectOnce,
    RejectAlways,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CodingAgentPermissionOption {
    #[schemars(length(min = 1, max = CODING_AGENT_MAX_PERMISSION_OPTION_ID_BYTES))]
    pub option_id: String,
    #[schemars(length(min = 1, max = CODING_AGENT_MAX_PERMISSION_OPTION_NAME_BYTES))]
    pub name: String,
    pub kind: CodingAgentPermissionOptionKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CodingAgentPendingPermission {
    #[schemars(length(max = CODING_AGENT_MAX_PERMISSION_ID_BYTES))]
    #[schemars(regex(pattern = "^wc_agent_permission_[A-Za-z0-9_.-]+$"))]
    pub request_id: String,
    #[schemars(length(min = 1, max = CODING_AGENT_MAX_PERMISSION_LABEL_BYTES))]
    pub label: String,
    /// Complete bounded action details supplied by the provider. Untrusted
    /// display text, never instructions to the Host. Oversized or unsupported
    /// content is rejected rather than truncated into an approvable request.
    #[schemars(length(min = 1, max = CODING_AGENT_MAX_PERMISSION_DETAILS_BYTES))]
    pub details: String,
    /// UTC seconds; the Runner's monotonic deadline remains authoritative.
    pub expires_at: i64,
    #[schemars(length(min = 1, max = CODING_AGENT_MAX_PERMISSION_OPTIONS))]
    pub options: Vec<CodingAgentPermissionOption>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum CodingAgentPermissionOutcome {
    Selected,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CodingAgentPermissionDecision {
    pub outcome: CodingAgentPermissionOutcome,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schemars(length(min = 1, max = CODING_AGENT_MAX_PERMISSION_OPTION_ID_BYTES))]
    pub option_id: Option<String>,
}

impl CodingAgentPermissionDecision {
    pub fn cancelled() -> Self {
        Self {
            outcome: CodingAgentPermissionOutcome::Cancelled,
            option_id: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CodingAgentRespondPermissionRequest {
    pub run_id: String,
    pub request_id: String,
    pub decision: CodingAgentPermissionDecision,
    pub authority_fingerprint: String,
    pub runtime_project_id: String,
    pub project_root: String,
    pub provider_id: String,
    pub provider_instance_id: String,
}

pub fn validate_permission_request_id(value: &str) -> Result<(), String> {
    if !value.starts_with("wc_agent_permission_") {
        return Err("permission request_id must use the wc_agent_permission_ namespace".into());
    }
    validate_identifier(
        value,
        "permission request_id",
        CODING_AGENT_MAX_PERMISSION_ID_BYTES,
        false,
    )
}

fn bounded_permission_identity(value: &str, max: usize) -> bool {
    !value.is_empty() && value.len() <= max && !value.chars().any(char::is_control)
}

pub fn validate_permission_decision(value: &CodingAgentPermissionDecision) -> Result<(), String> {
    match (value.outcome, value.option_id.as_deref()) {
        (CodingAgentPermissionOutcome::Selected, Some(id))
            if bounded_permission_identity(id, CODING_AGENT_MAX_PERMISSION_OPTION_ID_BYTES) =>
        {
            Ok(())
        }
        (CodingAgentPermissionOutcome::Cancelled, None) => Ok(()),
        _ => Err("selected requires one exact option_id; cancelled forbids option_id".into()),
    }
}

pub fn validate_pending_permission(value: &CodingAgentPendingPermission) -> Result<(), String> {
    validate_permission_request_id(&value.request_id)?;
    if !bounded_permission_identity(&value.label, CODING_AGENT_MAX_PERMISSION_LABEL_BYTES)
        || value.details.trim().is_empty()
        || value.details.len() > CODING_AGENT_MAX_PERMISSION_DETAILS_BYTES
        || value
            .details
            .chars()
            .any(|ch| ch.is_control() && ch != '\n' && ch != '\t')
        || value.expires_at <= 0
        || value.options.is_empty()
        || value.options.len() > CODING_AGENT_MAX_PERMISSION_OPTIONS
    {
        return Err("ACP permission request exceeds its display or lifetime bounds".into());
    }
    let mut ids = HashSet::new();
    for option in &value.options {
        if !bounded_permission_identity(
            &option.option_id,
            CODING_AGENT_MAX_PERMISSION_OPTION_ID_BYTES,
        ) || !bounded_permission_identity(
            &option.name,
            CODING_AGENT_MAX_PERMISSION_OPTION_NAME_BYTES,
        ) || !ids.insert(&option.option_id)
        {
            return Err("ACP permission options are malformed, ambiguous, or oversized".into());
        }
    }
    Ok(())
}

pub fn validate_permission_response_request(
    value: &CodingAgentRespondPermissionRequest,
) -> Result<(), String> {
    validate_permission_request_id(&value.request_id)?;
    validate_permission_decision(&value.decision)?;
    validate_authority_fingerprint(&value.authority_fingerprint)?;
    validate_provider_id(&value.provider_id)?;
    validate_provider_instance_id(&value.provider_instance_id)?;
    if value.runtime_project_id.trim().is_empty()
        || value.runtime_project_id.len() > CODING_AGENT_MAX_PROJECT_ID_BYTES
        || value.project_root.is_empty()
        || value.project_root.len() > CODING_AGENT_MAX_PROJECT_ROOT_BYTES
        || value.project_root.contains('\0')
    {
        return Err("ACP permission response Project binding is invalid".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn pending() -> CodingAgentPendingPermission {
        CodingAgentPendingPermission {
            request_id: "wc_agent_permission_example".into(),
            label: "Run command".into(),
            details: "cwd: /project\ncommand: cargo test".into(),
            expires_at: 100,
            options: vec![CodingAgentPermissionOption {
                option_id: "allow-once".into(),
                name: "Allow once".into(),
                kind: CodingAgentPermissionOptionKind::AllowOnce,
            }],
        }
    }

    #[test]
    fn permission_decision_is_closed_and_cancel_cannot_smuggle_an_option() {
        let selected = CodingAgentPermissionDecision {
            outcome: CodingAgentPermissionOutcome::Selected,
            option_id: Some("allow-once".into()),
        };
        assert!(validate_permission_decision(&selected).is_ok());
        assert!(validate_permission_decision(&CodingAgentPermissionDecision::cancelled()).is_ok());
        for decision in [
            CodingAgentPermissionDecision {
                option_id: None,
                ..selected.clone()
            },
            CodingAgentPermissionDecision {
                option_id: Some(String::new()),
                ..selected.clone()
            },
            CodingAgentPermissionDecision {
                outcome: CodingAgentPermissionOutcome::Cancelled,
                ..selected
            },
        ] {
            assert!(validate_permission_decision(&decision).is_err());
        }
        for injected in [
            json!({"outcome":"selected","option_id":"allow","approve_all":true}),
            json!({"outcome":"automatic"}),
        ] {
            assert!(serde_json::from_value::<CodingAgentPermissionDecision>(injected).is_err());
        }
    }

    #[test]
    fn permission_display_bounds_reject_lossy_or_ambiguous_approval_inputs() {
        let valid = pending();
        assert!(validate_pending_permission(&valid).is_ok());
        let mut oversized = valid.clone();
        oversized.details = "x".repeat(CODING_AGENT_MAX_PERMISSION_DETAILS_BYTES + 1);
        assert!(validate_pending_permission(&oversized).is_err());
        let mut duplicate = valid.clone();
        duplicate.options.push(duplicate.options[0].clone());
        assert!(validate_pending_permission(&duplicate).is_err());
        let mut empty = valid.clone();
        empty.details.clear();
        assert!(validate_pending_permission(&empty).is_err());
        let mut injected = serde_json::to_value(valid).unwrap();
        injected["session_id"] = json!("provider-private-session");
        assert!(serde_json::from_value::<CodingAgentPendingPermission>(injected).is_err());
    }

    #[test]
    fn permission_projection_requires_additive_observe_negotiation() {
        let mut request = CodingAgentRequest::Observe(CodingAgentObserveRequest {
            run_id: "wc_agent_run_test".into(),
            after_sequence: None,
            limit: 1,
            wait_secs: 0,
            include_pending_permission: false,
        });
        assert!(serde_json::to_value(&request)
            .unwrap()
            .get("include_pending_permission")
            .is_none());
        let response = CodingAgentResponse::success(CodingAgentResponsePayload::Observe {
            observation: CodingAgentObserveResult {
                run: CodingAgentRunSnapshot {
                    run_id: "wc_agent_run_test".into(),
                    intent_fingerprint: "intent".into(),
                    authority_fingerprint: "auth_owner".into(),
                    runtime_project_id: "agent:test:project".into(),
                    provider_id: "codex".into(),
                    provider_instance_id: "instance".into(),
                    state: CodingAgentRunState::WaitingPermission,
                    execution_state: CodingAgentExecutionState::Started,
                    observation_revision: 2,
                    created_at: 1,
                    updated_at: 2,
                    terminal: None,
                },
                events: vec![],
                first_retained_sequence: 1,
                next_sequence: 0,
                has_more: false,
                history_lost: false,
                pending_permission: Some(pending()),
            },
        });
        assert!(validate_response_for_request(&request, &response).is_err());
        let CodingAgentRequest::Observe(observe) = &mut request else {
            unreachable!()
        };
        observe.include_pending_permission = true;
        assert!(validate_response_for_request(&request, &response).is_ok());
    }
}
