//! The browser/Desktop approvals inventory is a typed projection over the same
//! owned Run lifecycle. It never stores action details, selects a decision, or
//! introduces a second execution path.

use super::*;
use futures_util::{stream, StreamExt};
use serde::Serialize;
use webcodex_core::coding_agent::CodingAgentPendingPermission;

const MAX_RUNS: usize = 32;
const MAX_LIVE_OBSERVATIONS: usize = 8;
const OBSERVATION_PARALLELISM: usize = 4;
const OBSERVATION_RESPONSE_SECS: u64 = 3;
// Desktop bounds one HTTP response to 1 MiB. JSON escaping can expand an
// otherwise valid 64 KiB request, so count encoded bytes across the inventory.
const MAX_RESPONSE_BYTES: usize = 768 * 1024;

#[derive(Serialize)]
pub(crate) struct CodingAgentOperatorInventory {
    runs: Vec<CodingAgentOperatorRun>,
    authorization: CodingAgentOperatorAuthorization,
    truncated: bool,
}

#[derive(Serialize)]
struct CodingAgentOperatorAuthorization {
    can_run: bool,
    can_approve: bool,
}

#[derive(Serialize)]
struct CodingAgentOperatorRun {
    run_id: String,
    client_id: String,
    runtime_project_id: String,
    provider_id: String,
    state: CodingAgentRunState,
    observation_revision: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pending_permission: Option<CodingAgentPendingPermission>,
}

fn priority(run: &CodingAgentRunSnapshot) -> (u8, i64) {
    (
        if run.state == CodingAgentRunState::WaitingPermission {
            2
        } else if !run.state.terminal() {
            1
        } else {
            0
        },
        run.updated_at,
    )
}

fn bound_response(inventory: &mut CodingAgentOperatorInventory) -> Result<(), ()> {
    while serde_json::to_vec(inventory).map_err(|_| ())?.len() > MAX_RESPONSE_BYTES {
        inventory.truncated = true;
        // Preserve every displayed request in full. Remove lower-priority
        // request cards before removing the compact Run summaries themselves.
        if let Some(run) = inventory
            .runs
            .iter_mut()
            .rev()
            .find(|run| run.pending_permission.is_some())
        {
            run.pending_permission = None;
        } else if inventory.runs.pop().is_none() {
            return Err(());
        }
    }
    Ok(())
}

impl ToolRuntime {
    pub(crate) async fn coding_agent_operator_inventory(
        &self,
        auth: &AuthContext,
    ) -> Result<CodingAgentOperatorInventory, ()> {
        super::super::kernel::check_runtime_tool_scope(Some(auth), "observe_coding_agent")
            .map_err(|_| ())?;
        let principal = stable_principal(Some(auth)).map_err(|_| ())?;
        let authority = authority_fingerprint(&principal);
        let access = crate::runner_http::runner_access_from_auth(Some(auth));
        let (registry, mut truncated) = self
            .runner_registry
            .coding_agent_runs_for_auth(access.as_ref(), &authority, MAX_RUNS * 2)
            .await;
        let mut candidates = registry
            .into_iter()
            .map(|(_, run)| (run.run_id.clone(), run))
            .collect::<BTreeMap<_, _>>();
        {
            let mut retained = self.coding_agent_runs.runs.lock().await;
            prune_server_runs_locked(&mut retained, Utc::now().timestamp());
            let mut own = Vec::with_capacity(MAX_RUNS + 1);
            for binding in retained.values() {
                if binding.authority_fingerprint != authority {
                    continue;
                }
                own.push(binding.snapshot.clone());
                own.sort_by(|a, b| {
                    priority(b)
                        .cmp(&priority(a))
                        .then_with(|| a.run_id.cmp(&b.run_id))
                });
                if own.len() > MAX_RUNS {
                    own.pop();
                    truncated = true;
                }
            }
            for run in own {
                candidates.insert(run.run_id.clone(), run);
            }
        }
        let mut candidates = candidates.into_values().collect::<Vec<_>>();
        candidates.sort_by(|a, b| {
            priority(b)
                .cmp(&priority(a))
                .then_with(|| a.run_id.cmp(&b.run_id))
        });
        let mut runs = Vec::with_capacity(MAX_RUNS);
        for candidate in candidates {
            let Ok(Some(binding)) = self
                .reconcile_run(&candidate.run_id, &authority, Some(auth))
                .await
            else {
                continue;
            };
            // Recheck current owner/Project visibility even for retained terminal
            // bindings. A former Project grant never authorizes today's read.
            if self
                .runner_registry
                .get_runner_view_for_auth(&binding.client_id, access.as_ref())
                .await
                .is_none()
                || self
                    .resolve_project_input_for_auth(&binding.runtime_project_id, Some(auth))
                    .await
                    .is_err()
            {
                continue;
            }
            if runs.len() == MAX_RUNS {
                truncated = true;
                break;
            }
            runs.push(CodingAgentOperatorRun {
                run_id: binding.snapshot.run_id,
                client_id: binding.client_id,
                runtime_project_id: binding.runtime_project_id,
                provider_id: binding.provider_id,
                state: binding.snapshot.state,
                observation_revision: binding.snapshot.observation_revision,
                pending_permission: None,
            });
        }

        let waiting = runs
            .iter()
            .enumerate()
            .filter(|(_, run)| run.state == CodingAgentRunState::WaitingPermission)
            .map(|(index, run)| (index, run.run_id.clone()))
            .collect::<Vec<_>>();
        truncated |= waiting.len() > MAX_LIVE_OBSERVATIONS;
        let observations = stream::iter(waiting.into_iter().take(MAX_LIVE_OBSERVATIONS))
            .map(|(index, run_id)| async move {
                let result = self
                    .coding_agent_observe_typed(
                        run_id,
                        None,
                        Some(0),
                        Duration::from_secs(OBSERVATION_RESPONSE_SECS),
                        Some(auth),
                    )
                    .await;
                (index, result)
            })
            .buffer_unordered(OBSERVATION_PARALLELISM)
            .collect::<Vec<_>>()
            .await;
        for (index, observation) in observations {
            match observation {
                Ok((observation, _)) => {
                    let row = &mut runs[index];
                    row.state = observation.run.state;
                    row.observation_revision = observation.run.observation_revision;
                    row.pending_permission = observation.pending_permission.filter(|pending| {
                        row.state == CodingAgentRunState::WaitingPermission
                            && pending.expires_at > Utc::now().timestamp()
                    });
                }
                Err(_) => truncated = true,
            }
        }
        let mut inventory = CodingAgentOperatorInventory {
            runs,
            authorization: CodingAgentOperatorAuthorization {
                can_run: true,
                can_approve: super::super::kernel::check_runtime_tool_scope(
                    Some(auth),
                    "respond_coding_agent_permission",
                )
                .is_ok(),
            },
            truncated,
        };
        bound_response(&mut inventory)?;
        Ok(inventory)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use webcodex_core::coding_agent::{
        CodingAgentPermissionOption, CodingAgentPermissionOptionKind,
    };

    #[test]
    fn escaped_complete_requests_fit_the_desktop_response_limit() {
        let details = format!("Review this request\n{}", "\t".repeat(64 * 1024 - 32));
        let mut inventory = CodingAgentOperatorInventory {
            runs: (0..8)
                .map(|index| CodingAgentOperatorRun {
                    run_id: format!("wc_agent_run_budget_{index}"),
                    client_id: "client".into(),
                    runtime_project_id: "agent:client:project".into(),
                    provider_id: "codex".into(),
                    state: CodingAgentRunState::WaitingPermission,
                    observation_revision: 1,
                    pending_permission: Some(CodingAgentPendingPermission {
                        request_id: format!("wc_agent_permission_budget_{index}"),
                        label: "Review request".into(),
                        details: details.clone(),
                        expires_at: Utc::now().timestamp() + 60,
                        options: vec![CodingAgentPermissionOption {
                            option_id: "once".into(),
                            name: "Allow once".into(),
                            kind: CodingAgentPermissionOptionKind::AllowOnce,
                        }],
                    }),
                })
                .collect(),
            authorization: CodingAgentOperatorAuthorization {
                can_run: true,
                can_approve: false,
            },
            truncated: false,
        };
        for run in &inventory.runs {
            webcodex_core::coding_agent::validate_pending_permission(
                run.pending_permission.as_ref().unwrap(),
            )
            .unwrap();
        }
        assert!(serde_json::to_vec(&inventory).unwrap().len() > 1024 * 1024);
        bound_response(&mut inventory).unwrap();
        assert!(serde_json::to_vec(&inventory).unwrap().len() <= MAX_RESPONSE_BYTES);
        assert!(inventory.truncated);
        assert_eq!(inventory.runs.len(), 8);
        assert!(!inventory.authorization.can_approve);
        let displayed = inventory
            .runs
            .iter()
            .filter_map(|run| run.pending_permission.as_ref())
            .collect::<Vec<_>>();
        assert!(!displayed.is_empty() && displayed.len() < 8);
        for pending in displayed {
            assert_eq!(pending.details, details);
            assert_eq!(pending.options.len(), 1);
        }
    }
}
