use super::*;
use crate::coding_agents::{CodingAgentRemove, CodingAgentStore, CodingAgentUpdate};

impl AppState {
    pub async fn save_coding_agent(
        &self,
        request: CodingAgentUpdate,
    ) -> DesktopResult<DesktopStateSnapshot> {
        self.mutate_coding_agents(request.target.clone(), move |store| {
            store.stage_update(request)
        })
        .await
    }

    pub async fn remove_coding_agent(
        &self,
        request: CodingAgentRemove,
    ) -> DesktopResult<DesktopStateSnapshot> {
        self.mutate_coding_agents(request.target.clone(), move |store| {
            store.stage_remove(&request.provider_id, request.expected_revision)
        })
        .await
    }

    async fn mutate_coding_agents<F>(
        &self,
        target: crate::webcodex::settings::SettingsTarget,
        change: F,
    ) -> DesktopResult<DesktopStateSnapshot>
    where
        F: FnOnce(&mut CodingAgentStore) -> DesktopResult<()> + Send + 'static,
    {
        let (operation, cancellation, mut core, baseline) = self
            .begin_operation(DesktopOperationKind::RunnerSettingsUpdate, false)
            .await?;
        let result = async {
            let runtime = core
                .config
                .runtime
                .clone()
                .ok_or_else(|| desktop_state_unavailable("Configure a Runner first"))?;
            crate::webcodex::settings::verify_target(&runtime, &target)?;
            let mut candidate = core.coding_agents.clone();
            let candidate = tokio::task::spawn_blocking(move || {
                change(&mut candidate)?;
                // Save is validation + desired-state commit, never a process restart.
                crate::webcodex::settings::reconcile_acp(&runtime, &candidate, true)?;
                candidate.commit()?;
                Ok::<_, DesktopError>(candidate)
            })
            .await
            .map_err(|_| desktop_state_unavailable("Coding Agent worker stopped"))??;
            core.coding_agents = candidate;
            core.get_state().await
        }
        .await;
        self.finish_operation(operation, cancellation, core, baseline, result)
            .await
    }
}

impl AppState {
    pub async fn prepare_codex_coding_agent(
        &self,
        request: crate::coding_agents::CodexPrepareRequest,
    ) -> DesktopResult<crate::coding_agents::PreparedCodexAgent> {
        let (operation, cancellation, core, baseline) = self
            .begin_operation(DesktopOperationKind::RunnerSettingsUpdate, false)
            .await?;
        let result = async {
            let runtime = core
                .config
                .runtime
                .as_ref()
                .ok_or_else(|| desktop_state_unavailable("Configure a Runner first"))?;
            crate::webcodex::settings::verify_target(runtime, &request.target)?;
            core.coding_agents
                .check_revision(request.expected_revision)?;
            cancellation.check()?;
            let options = webcodex_environment::codex_app_server::PrepareCodexOptions {
                config_dir: core.data_dir.clone(),
                python_bin: request.python_bin,
                codex_bin: request.codex_bin,
                codex_args: request.codex_args,
                expected_version: request.expected_version,
            };
            let prepared = tokio::task::spawn_blocking(move || {
                webcodex_environment::codex_app_server::prepare_codex(&options)
            })
            .await
            .map_err(|_| desktop_state_unavailable("Codex preparation worker stopped"))?
            .map_err(|error| DesktopError::new(error.code, error.message, error.recovery))?;
            cancellation.check()?;
            let generated = prepared.profile;
            let profile = crate::coding_agents::CodingAgentProfile {
                provider_id: generated.provider_id,
                name: generated.name,
                executable: generated.executable,
                args: generated.args,
                enabled: generated.enabled,
                env_from_env: generated.env_from_env,
                allowed_config_options: generated.allowed_config_options,
            };
            crate::coding_agents::validate_profile(&profile)?;
            if prepared.status != "ready" || profile.enabled {
                return Err(crate::coding_agents::invalid());
            }
            // Preparation only returns a reviewable disabled draft. Saving,
            // activation, Runner restart and capability grants remain explicit.
            Ok(crate::coding_agents::PreparedCodexAgent {
                target: request.target,
                expected_revision: request.expected_revision,
                codex_version: prepared.codex_version,
                profile,
            })
        }
        .await;
        let finished = result
            .as_ref()
            .map(|_| core.snapshot.clone())
            .map_err(Clone::clone);
        self.finish_operation(operation, cancellation, core, baseline, finished)
            .await?;
        result
    }
}

#[cfg(test)]
mod preparation_tests {
    use super::*;

    #[tokio::test]
    async fn stale_codex_preparation_does_not_install_resources_or_start_a_process() {
        let dir = crate::coding_agents::tests::Scratch::new();
        let runtime = StoredRuntime {
            server_url: "http://127.0.0.1:62645".into(),
            runner_config: Some(dir.0.join("runner.toml")),
            runner_client_id: Some("mini".into()),
            server_env_file: None,
            user_token_file: None,
            project_id: None,
            runtime_project_id: None,
        };
        let target = crate::webcodex::settings::target(&runtime).unwrap();
        let app = AppState::new(dir.0.clone(), dir.0.join("resources")).unwrap();
        app.core.lock().await.as_mut().unwrap().config.runtime = Some(runtime);
        let request = crate::coding_agents::CodexPrepareRequest {
            target,
            expected_revision: 1,
            python_bin: None,
            codex_bin: None,
            codex_args: Vec::new(),
            expected_version: None,
        };
        let error = app.prepare_codex_coding_agent(request).await.err().unwrap();
        assert_eq!(error.code, "coding_agent_state_changed");
        assert!(!dir.0.join("coding-agent-adapters").exists());
        assert!(app.get_state().current_operation.is_none());
        assert!(app
            .core
            .lock()
            .await
            .as_ref()
            .unwrap()
            .coding_agents
            .profiles()
            .unwrap()
            .is_empty());
    }
}
