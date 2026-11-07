//! One-shot, identity-fenced decisions for live ACP permission callbacks.

use super::*;
use webcodex_core::coding_agent::{
    validate_pending_permission, CodingAgentPendingPermission, CodingAgentPermissionDecision,
    CodingAgentPermissionOption, CodingAgentPermissionOutcome, CodingAgentRespondPermissionRequest,
    CODING_AGENT_MAX_PERMISSION_DETAILS_BYTES, CODING_AGENT_MAX_PERMISSION_OPTIONS,
    CODING_AGENT_MAX_PERMISSION_RECEIPTS,
};

#[derive(Debug)]
pub(super) struct PendingPermission {
    pub(super) public: CodingAgentPendingPermission,
    pub(super) deadline: Instant,
    pub(super) decision: Option<CodingAgentPermissionDecision>,
}

#[derive(Debug)]
struct AcceptedPermission {
    request_id: String,
    decision: CodingAgentPermissionDecision,
}

#[derive(Debug, Default)]
pub(super) struct PermissionState {
    pub(super) pending: Option<PendingPermission>,
    accepted: VecDeque<AcceptedPermission>,
}

/// Only complete supported content becomes approvable. In particular, rawInput,
/// resource references, images and terminal ids are not silently abbreviated or
/// promoted into sufficient evidence for allowing an action.
pub(super) fn normalize_permission(
    params: &Value,
    session_id: &str,
    deadline: Instant,
) -> Result<CodingAgentPendingPermission, &'static str> {
    if params.get("sessionId").and_then(Value::as_str) != Some(session_id) {
        return Err("permission_session_mismatch");
    }
    let tool = params.get("toolCall").ok_or("permission_tool_missing")?;
    let label = tool
        .get("title")
        .and_then(Value::as_str)
        .ok_or("permission_title_missing")?;
    let content = tool
        .get("content")
        .and_then(Value::as_array)
        .ok_or("permission_details_missing")?;
    if content.is_empty() || content.len() > 32 {
        return Err("permission_details_unrepresentable");
    }
    let mut details = String::new();
    let mut append = |text: &str| -> Result<(), &'static str> {
        if details.len().saturating_add(text.len()).saturating_add(1)
            > CODING_AGENT_MAX_PERMISSION_DETAILS_BYTES
        {
            return Err("permission_details_oversized");
        }
        details.push_str(text);
        details.push('\n');
        Ok(())
    };
    for item in content {
        match item.get("type").and_then(Value::as_str) {
            Some("content") => {
                let block = item
                    .get("content")
                    .ok_or("permission_details_unrepresentable")?;
                if block.get("type").and_then(Value::as_str) != Some("text") {
                    return Err("permission_details_unrepresentable");
                }
                append(
                    block
                        .get("text")
                        .and_then(Value::as_str)
                        .ok_or("permission_details_unrepresentable")?,
                )?;
            }
            Some("diff") => {
                append("File:")?;
                append(
                    item.get("path")
                        .and_then(Value::as_str)
                        .ok_or("permission_details_unrepresentable")?,
                )?;
                append("Before:")?;
                match item.get("oldText") {
                    None | Some(Value::Null) => append("(new file)")?,
                    Some(Value::String(text)) => append(text)?,
                    _ => return Err("permission_details_unrepresentable"),
                }
                append("After:")?;
                append(
                    item.get("newText")
                        .and_then(Value::as_str)
                        .ok_or("permission_details_unrepresentable")?,
                )?;
            }
            _ => return Err("permission_details_unrepresentable"),
        }
    }
    if let Some(locations) = tool.get("locations") {
        let locations = locations.as_array().ok_or("permission_locations_invalid")?;
        if locations.len() > 32 {
            return Err("permission_locations_invalid");
        }
        for location in locations {
            append("Location:")?;
            append(
                location
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or("permission_locations_invalid")?,
            )?;
            if let Some(line) = location.get("line") {
                append(&format!(
                    "line {}",
                    line.as_u64().ok_or("permission_locations_invalid")?
                ))?;
            }
        }
    }
    let options = params
        .get("options")
        .and_then(Value::as_array)
        .ok_or("permission_options_invalid")?;
    if options.is_empty() || options.len() > CODING_AGENT_MAX_PERMISSION_OPTIONS {
        return Err("permission_options_invalid");
    }
    let options = options
        .iter()
        .map(|option| {
            Ok(CodingAgentPermissionOption {
                option_id: option
                    .get("optionId")
                    .and_then(Value::as_str)
                    .ok_or("permission_options_invalid")?
                    .to_owned(),
                name: option
                    .get("name")
                    .and_then(Value::as_str)
                    .ok_or("permission_options_invalid")?
                    .to_owned(),
                kind: serde_json::from_value(option.get("kind").cloned().unwrap_or(Value::Null))
                    .map_err(|_| "permission_options_invalid")?,
            })
        })
        .collect::<Result<Vec<_>, &'static str>>()?;
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        return Err("permission_deadline_expired");
    }
    let pending = CodingAgentPendingPermission {
        request_id: format!("wc_agent_permission_{}", Uuid::new_v4().simple()),
        label: label.to_owned(),
        details,
        expires_at: now().saturating_add(remaining.as_secs().saturating_add(1) as i64),
        options,
    };
    validate_pending_permission(&pending).map_err(|_| "permission_display_invalid")?;
    Ok(pending)
}

impl RunEntry {
    pub(super) fn begin_permission(
        &self,
        public: CodingAgentPendingPermission,
        deadline: Instant,
    ) -> bool {
        let mut state = self.state.lock().unwrap();
        if state.snapshot.state.terminal()
            || state.permissions.pending.is_some()
            || self.cancel_requested.load(Ordering::Acquire)
            || Instant::now() >= deadline
        {
            return false;
        }
        state.permissions.pending = Some(PendingPermission {
            public,
            deadline,
            decision: None,
        });
        state.snapshot.state = CodingAgentRunState::WaitingPermission;
        state.snapshot.observation_revision = state.snapshot.observation_revision.saturating_add(1);
        state.snapshot.updated_at = now();
        self.changed.notify_all();
        true
    }

    pub(super) fn wait_permission_decision(&self, request_id: &str, accepting: &AtomicBool) {
        let mut state = self.state.lock().unwrap();
        loop {
            let Some(pending) = state
                .permissions
                .pending
                .as_ref()
                .filter(|pending| pending.public.request_id == request_id)
            else {
                return;
            };
            if pending.decision.is_some()
                || Instant::now() >= pending.deadline
                || self.cancel_requested.load(Ordering::Acquire)
                || !accepting.load(Ordering::Acquire)
            {
                return;
            }
            let remaining = pending
                .deadline
                .saturating_duration_since(Instant::now())
                .min(ACP_POLL);
            state = self.changed.wait_timeout(state, remaining).unwrap().0;
        }
    }

    /// Called while holding prompt_dispatch, the same fence as cancellation.
    /// Consuming removes the callback before any possible writer handoff; an
    /// uncertain write can therefore never make this decision executable twice.
    pub(super) fn take_permission_decision(
        &self,
        request_id: &str,
        accepting: bool,
        project_current: bool,
    ) -> CodingAgentPermissionDecision {
        let mut state = self.state.lock().unwrap();
        if !state
            .permissions
            .pending
            .as_ref()
            .is_some_and(|pending| pending.public.request_id == request_id)
        {
            return CodingAgentPermissionDecision::cancelled();
        }
        let Some(pending) = state.permissions.pending.take() else {
            return CodingAgentPermissionDecision::cancelled();
        };
        if !accepting
            || !project_current
            || self.cancel_requested.load(Ordering::Acquire)
            || Instant::now() >= pending.deadline
            || state.snapshot.state.terminal()
        {
            return CodingAgentPermissionDecision::cancelled();
        }
        pending
            .decision
            .unwrap_or_else(CodingAgentPermissionDecision::cancelled)
    }
}

impl CodingAgentManager {
    pub(super) fn permission_project_current(&self, entry: &RunEntry) -> bool {
        let Some((root, registry)) = entry.permission_project.as_ref() else {
            return false;
        };
        let snapshot = entry.snapshot();
        project_binding_matches(
            registry,
            &self.client_id,
            &snapshot.runtime_project_id,
            &root.to_string_lossy(),
        )
    }

    pub(super) fn respond_permission(
        &self,
        request: CodingAgentRespondPermissionRequest,
        project_registry_dir: &Path,
    ) -> CodingAgentResponse {
        let denied = |code, message: &str| {
            response_error(
                CodingAgentDispatchState::NotStarted,
                code,
                message,
                "stale_state",
                "reobserve",
            )
        };
        let Some(entry) = self.runs.lock().unwrap().get(&request.run_id).cloned() else {
            return denied(
                "unknown_coding_agent_run",
                "CodingAgentRun is not retained by this Runner",
            );
        };
        let snapshot = entry.snapshot();
        let root_matches = entry
            .permission_project
            .as_ref()
            .is_some_and(|(root, registry)| {
                registry == project_registry_dir
                    && canonicalize_existing(Path::new(&request.project_root))
                        .ok()
                        .is_some_and(|requested| paths_equal(root, &requested))
            });
        if snapshot.authority_fingerprint != request.authority_fingerprint
            || snapshot.runtime_project_id != request.runtime_project_id
            || snapshot.provider_id != request.provider_id
            || snapshot.provider_instance_id != request.provider_instance_id
            || !self
                .providers
                .get(&request.provider_id)
                .is_some_and(|provider| provider.instance_id == request.provider_instance_id)
            || !root_matches
            || !self.permission_project_current(&entry)
        {
            return denied("stale_coding_agent_permission", "Permission response no longer matches the exact Run, provider and Project authority");
        }
        // A cancel that acquired this gate first wins. Never hold it across
        // provider I/O, a wait, or a network round trip.
        let _gate = entry.prompt_dispatch.lock().unwrap();
        let mut state = entry.state.lock().unwrap();
        if let Some(receipt) = state
            .permissions
            .accepted
            .iter()
            .find(|receipt| receipt.request_id == request.request_id)
        {
            if receipt.decision != request.decision {
                return denied(
                    "coding_agent_permission_response_conflict",
                    "The same permission request already received a different decision",
                );
            }
        } else {
            if !self.accepting.load(Ordering::Acquire)
                || entry.cancel_requested.load(Ordering::Acquire)
                || state.snapshot.state != CodingAgentRunState::WaitingPermission
            {
                return denied(
                    "coding_agent_permission_not_pending",
                    "This Run has no live permission callback accepting a decision",
                );
            }
            let Some(pending) = state.permissions.pending.as_mut().filter(|pending| {
                pending.public.request_id == request.request_id && Instant::now() < pending.deadline
            }) else {
                return denied(
                    "coding_agent_permission_not_pending",
                    "The exact permission callback expired, was consumed, or is no longer pending",
                );
            };
            if request.decision.outcome == CodingAgentPermissionOutcome::Selected
                && !pending.public.options.iter().any(|option| {
                    Some(option.option_id.as_str()) == request.decision.option_id.as_deref()
                })
            {
                return denied(
                    "invalid_coding_agent_permission_option",
                    "Select one exact option advertised by this pending callback",
                );
            }
            pending.decision = Some(request.decision.clone());
            state.permissions.accepted.push_back(AcceptedPermission {
                request_id: request.request_id.clone(),
                decision: request.decision.clone(),
            });
            while state.permissions.accepted.len() > CODING_AGENT_MAX_PERMISSION_RECEIPTS {
                state.permissions.accepted.pop_front();
            }
            state.snapshot.observation_revision =
                state.snapshot.observation_revision.saturating_add(1);
            state.snapshot.updated_at = now();
            entry.changed.notify_all();
        }
        CodingAgentResponse::success(CodingAgentResponsePayload::RespondPermission {
            run: state.snapshot.clone(),
            request_id: request.request_id,
            decision: request.decision,
        })
    }
}
