use super::*;
use crate::ssh_resources::{
    ConnectionCheck, ConnectionChecked, HttpGateway, Mutation, SshInspectRequest,
    SshInspectionResult, SshMutationResult, SshProbeRequest, SshProbeResult, SshRegisterRequest,
    SshRemoveRequest, SshResourceError, SshResourcesSnapshot,
};

impl AppState {
    async fn ssh_read_context(
        &self,
        expected: Option<&crate::webcodex::settings::SettingsTarget>,
    ) -> DesktopResult<(StoredRuntime, RunnerRuntimeIdentity)> {
        if self.shutdown_signal.is_cancelled() || self.operations.current().is_some() {
            return Err(crate::workspace::unavailable());
        }
        {
            let slot = self.core.lock().await;
            let core = slot.as_ref().ok_or_else(crate::workspace::unavailable)?;
            let runtime = core
                .config
                .runtime
                .clone()
                .ok_or_else(crate::workspace::unavailable)?;
            if let Some(expected) = expected {
                crate::webcodex::settings::verify_target(&runtime, expected)?;
            }
            Ok((
                runtime,
                runner_identity_from_config(&core.config)
                    .ok_or_else(crate::workspace::unavailable)?,
            ))
        }
    }

    async fn ssh_read_is_current(&self, identity: &RunnerRuntimeIdentity) -> bool {
        let slot = self.core.lock().await;
        !self.shutdown_signal.is_cancelled()
            && self.operations.current().is_none()
            && slot
                .as_ref()
                .and_then(|core| runner_identity_from_config(&core.config))
                .as_ref()
                == Some(identity)
    }

    pub async fn ssh_resource_list(&self) -> DesktopResult<SshResourcesSnapshot> {
        let (runtime, identity) = self.ssh_read_context(None).await?;
        // Serialize observations/mutations, but never hold the Desktop state
        // mutex across network I/O. A restart/re-pair invalidates late reads.
        let mut resources = self.ssh_resources.lock().await;
        let snapshot = resources.list(&runtime, &HttpGateway).await;
        if !self.ssh_read_is_current(&identity).await {
            resources.invalidate();
            return Err(crate::workspace::unavailable());
        }
        Ok(snapshot)
    }

    async fn check_ssh_connection(
        &self,
        expected: crate::webcodex::settings::SettingsTarget,
        observation_id: String,
        check: ConnectionCheck,
    ) -> DesktopResult<Result<ConnectionChecked, SshResourceError>> {
        let (runtime, identity) = self.ssh_read_context(Some(&expected)).await?;
        let mut resources = self.ssh_resources.lock().await;
        let result = resources
            .check(&runtime, &observation_id, check, &HttpGateway)
            .await;
        if !self.ssh_read_is_current(&identity).await {
            resources.invalidate();
            return Err(crate::workspace::unavailable());
        }
        Ok(result)
    }

    pub async fn ssh_connection_inspect(
        &self,
        request: SshInspectRequest,
    ) -> DesktopResult<SshInspectionResult> {
        let result = self
            .check_ssh_connection(
                request.expected,
                request.observation_id,
                ConnectionCheck::Inspect(request.endpoint),
            )
            .await?;
        Ok(match result {
            Ok(ConnectionChecked::Inspected(inspection)) => SshInspectionResult {
                success: true,
                error_kind: None,
                inspection: Some(inspection),
            },
            Ok(ConnectionChecked::Verified) => SshInspectionResult {
                success: false,
                error_kind: Some(SshResourceError::SshResourceRegistryUnavailable),
                inspection: None,
            },
            Err(error) => SshInspectionResult {
                success: false,
                error_kind: Some(error),
                inspection: None,
            },
        })
    }

    pub async fn ssh_connection_probe(
        &self,
        request: SshProbeRequest,
    ) -> DesktopResult<SshProbeResult> {
        let result = self
            .check_ssh_connection(
                request.expected,
                request.observation_id,
                ConnectionCheck::Probe {
                    endpoint: request.endpoint,
                    authentication: request.authentication,
                    host_key: request.host_key,
                },
            )
            .await?;
        Ok(match result {
            Ok(ConnectionChecked::Verified) => SshProbeResult {
                success: true,
                error_kind: None,
                verified: true,
            },
            Ok(ConnectionChecked::Inspected(_)) => SshProbeResult {
                success: false,
                error_kind: Some(SshResourceError::SshResourceRegistryUnavailable),
                verified: false,
            },
            Err(error) => SshProbeResult {
                success: false,
                error_kind: Some(error),
                verified: false,
            },
        })
    }

    pub async fn ssh_resource_register(
        &self,
        request: SshRegisterRequest,
    ) -> DesktopResult<SshMutationResult> {
        self.mutate_ssh_resource(
            request.expected,
            request.observation_id,
            Mutation::Register {
                name: request.name,
                connection: request.connection,
                default_cwd: request.default_cwd,
            },
        )
        .await
    }

    pub async fn ssh_resource_remove(
        &self,
        request: SshRemoveRequest,
    ) -> DesktopResult<SshMutationResult> {
        self.mutate_ssh_resource(
            request.expected,
            request.observation_id,
            Mutation::Remove { name: request.name },
        )
        .await
    }

    async fn mutate_ssh_resource(
        &self,
        expected: crate::webcodex::settings::SettingsTarget,
        observation_id: String,
        mutation: Mutation,
    ) -> DesktopResult<SshMutationResult> {
        let (operation, cancellation, core, baseline) = self
            .begin_operation(DesktopOperationKind::RunnerSettingsUpdate, false)
            .await?;
        let result = async {
            let mut resources = self.ssh_resources.lock().await;
            let runtime = core
                .config
                .runtime
                .as_ref()
                .ok_or_else(crate::workspace::unavailable)?;
            if let Err(error) = crate::webcodex::settings::verify_target(runtime, &expected) {
                resources.invalidate();
                return Err(error);
            }
            Ok(resources
                .mutate(runtime, &observation_id, mutation, &HttpGateway)
                .await)
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
