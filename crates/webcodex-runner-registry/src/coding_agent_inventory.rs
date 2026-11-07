//! Bounded candidate discovery for the operator's Coding Agent approvals view.
//! Candidates are not authorization to observe or respond: the Server still
//! reconciles the exact Run/Runner/provider binding and current Project access.

use crate::access_control::runner_visible_to_access;
use crate::{RunnerAccess, RunnerRegistry};
use webcodex_core::coding_agent::{CodingAgentRunSnapshot, CodingAgentRunState};

impl RunnerRegistry {
    pub async fn coding_agent_runs_for_auth(
        &self,
        auth: Option<&RunnerAccess>,
        authority_fingerprint: &str,
        limit: usize,
    ) -> (Vec<(String, CodingAgentRunSnapshot)>, bool) {
        let limit = limit.clamp(1, 128);
        let mut inner = self.inner.lock().await;
        self.prune_expired_shared_key_runners_locked(&mut inner, crate::now_ts());
        let mut candidates = Vec::with_capacity(limit + 1);
        let mut truncated = false;
        for runner in inner.runners.values() {
            if !runner_visible_to_access(auth, runner) {
                continue;
            }
            for run in &runner.coding_agent_inventory.runs {
                if run.authority_fingerprint != authority_fingerprint {
                    continue;
                }
                candidates.push((runner.client_id.clone(), run.clone()));
                candidates.sort_by(|a, b| {
                    let rank = |run: &CodingAgentRunSnapshot| {
                        if run.state == CodingAgentRunState::WaitingPermission {
                            2
                        } else if !run.state.terminal() {
                            1
                        } else {
                            0
                        }
                    };
                    rank(&b.1)
                        .cmp(&rank(&a.1))
                        .then_with(|| b.1.updated_at.cmp(&a.1.updated_at))
                        .then_with(|| a.1.run_id.cmp(&b.1.run_id))
                        .then_with(|| a.0.cmp(&b.0))
                });
                if candidates.len() > limit {
                    candidates.pop();
                    truncated = true;
                }
            }
        }
        (candidates, truncated)
    }
}
