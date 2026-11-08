use super::*;
use crate::runner_protocol::{
    RunnerPollRequest, RunnerRegisterRequest, ShellCommandExecutionState,
};
use webcodex_core::ssh_resource::SshResourceRequest;

fn registration(instance: &str, managed_ssh_resources: bool) -> RunnerRegisterRequest {
    current_runner_registration(RunnerRegisterRequest {
        computer_session_availability: None,
        computer_control_epoch: None,
        client_id: "ssh-resource-runner".to_string(),
        runner_instance_id: instance.to_string(),
        runner_protocol_generation: crate::runner_protocol::RUNNER_PROTOCOL_GENERATION_V2,
        display_name: None,
        owner: Some("alice".to_string()),
        hostname: None,
        capabilities: RunnerCapabilities {
            managed_ssh_resources,
            ..Default::default()
        },
        host_context: None,
        policy: None,
        process_started_at: None,
        build: None,
        job_concurrency_limit: None,
        job_inventory: None,
        coding_agent_providers: None,
        coding_agent_inventory: None,
    })
}

fn alice() -> RunnerAccess {
    auth_context(Some("alice"), false)
}

#[tokio::test]
async fn managed_ssh_enqueue_requires_exact_instance_and_independent_capability() {
    let registry = RunnerRegistry::default();
    registry
        .register(registration("instance-a", false))
        .await
        .unwrap();
    let auth = alice();

    let unavailable = registry
        .enqueue_ssh_resource(
            "ssh-resource-runner",
            "instance-a",
            SshResourceRequest::List,
            Some(&auth),
            "test".to_string(),
        )
        .await
        .unwrap_err();
    assert!(unavailable.contains("ssh_resource_registry_unavailable"));

    registry
        .register(registration("instance-a", true))
        .await
        .unwrap();
    let replaced = registry
        .enqueue_ssh_resource(
            "ssh-resource-runner",
            "replacement-instance",
            SshResourceRequest::List,
            Some(&auth),
            "test".to_string(),
        )
        .await
        .unwrap_err();
    assert!(replaced.contains("runner_replaced"));

    let inner = registry.inner.lock().await;
    assert!(inner.pending_by_id.is_empty());
}

#[tokio::test]
async fn managed_ssh_dequeue_never_retargets_replacement_runner() {
    let registry = RunnerRegistry::default();
    registry
        .register(registration("instance-a", true))
        .await
        .unwrap();
    let auth = alice();
    let (_request_id, receiver) = registry
        .enqueue_ssh_resource(
            "ssh-resource-runner",
            "instance-a",
            SshResourceRequest::Register {
                expected_revision: 4,
                name: "w10".to_string(),
                target: "17724@w10".to_string(),
                default_cwd: None,
            },
            Some(&auth),
            "test".to_string(),
        )
        .await
        .unwrap();

    // Bypass normal registration draining to prove the dequeue fence itself
    // protects a stable client_id recycled by a later Runner process.
    {
        let mut inner = registry.inner.lock().await;
        inner
            .runners
            .get_mut("ssh-resource-runner")
            .unwrap()
            .runner_instance_id = "instance-b".to_string();
    }
    let polled = registry
        .poll(RunnerPollRequest {
            client_id: "ssh-resource-runner".to_string(),
            runner_instance_id: "instance-b".to_string(),
        })
        .await
        .unwrap();
    assert!(
        polled.is_none(),
        "replacement Runner must not receive host mutation"
    );
    let response = receiver.await.unwrap();
    assert!(!response.success);
    assert_eq!(response.request_dispatched, Some(false));
    assert_eq!(
        response.command_execution_state,
        Some(ShellCommandExecutionState::NotStarted)
    );
    assert!(response
        .error
        .as_deref()
        .is_some_and(|error| error.contains("runner_replaced")));

    let inner = registry.inner.lock().await;
    assert!(inner.pending_by_id.is_empty());
    assert!(inner
        .queues_by_runner
        .get("ssh-resource-runner")
        .is_none_or(|queue| queue.is_empty()));
}

#[tokio::test]
async fn ssh_connection_setup_requires_explicit_capability_at_enqueue_and_dequeue() {
    let registry = RunnerRegistry::default();
    let legacy = registration("instance-a", true);
    registry.register(legacy.clone()).await.unwrap();
    let request = SshResourceRequest::Inspect {
        expected_revision: 0,
        endpoint: webcodex_core::ssh_resource::SshEndpoint {
            host: "192.0.2.1".into(),
            port: 22,
            user: "operator".into(),
        },
    };
    let error = registry
        .enqueue_ssh_resource(
            "ssh-resource-runner",
            "instance-a",
            request.clone(),
            Some(&alice()),
            "test".into(),
        )
        .await
        .unwrap_err();
    assert!(error.starts_with("ssh_connection_setup_unsupported"));
    assert!(registry.inner.lock().await.pending_by_id.is_empty());

    let mut current = legacy.clone();
    current.capabilities.ssh_connection_setup = true;
    registry.register(current).await.unwrap();
    let (_, receiver) = registry
        .enqueue_ssh_resource(
            "ssh-resource-runner",
            "instance-a",
            request,
            Some(&alice()),
            "test".into(),
        )
        .await
        .unwrap();
    // Preserve the queued request while removing capability to prove the
    // independent dequeue fence never sends a new enum to an older receiver.
    registry
        .inner
        .lock()
        .await
        .runners
        .get_mut("ssh-resource-runner")
        .unwrap()
        .runner_features = RunnerFeatureSet::try_from_registration(&legacy.capabilities).unwrap();
    assert!(registry
        .poll(RunnerPollRequest {
            client_id: "ssh-resource-runner".into(),
            runner_instance_id: "instance-a".into()
        })
        .await
        .unwrap()
        .is_none());
    let result = receiver.await.unwrap();
    assert_eq!(result.request_dispatched, Some(false));
    assert!(result
        .error
        .as_deref()
        .is_some_and(|error| error.starts_with("ssh_connection_setup_unsupported")));
}

#[tokio::test]
async fn ssh_saved_verification_is_capability_fenced_at_enqueue_and_dequeue() {
    for request in [
        SshResourceRequest::Status,
        SshResourceRequest::VerifySaved {
            expected_revision: 0,
            name: "saved".into(),
        },
    ] {
        let registry = RunnerRegistry::default();
        let mut legacy = registration("instance-a", true);
        legacy.capabilities.ssh_connection_setup = true;
        registry.register(legacy.clone()).await.unwrap();
        let error = registry
            .enqueue_ssh_resource(
                "ssh-resource-runner",
                "instance-a",
                request.clone(),
                Some(&alice()),
                "test".into(),
            )
            .await
            .unwrap_err();
        assert!(error.starts_with("ssh_connection_setup_unsupported"));
        assert!(registry.inner.lock().await.pending_by_id.is_empty());
        let mut current = legacy.clone();
        current.capabilities.ssh_verification_history = true;
        registry.register(current).await.unwrap();
        let (_, receiver) = registry
            .enqueue_ssh_resource(
                "ssh-resource-runner",
                "instance-a",
                request,
                Some(&alice()),
                "test".into(),
            )
            .await
            .unwrap();
        registry
            .inner
            .lock()
            .await
            .runners
            .get_mut("ssh-resource-runner")
            .unwrap()
            .runner_features =
            RunnerFeatureSet::try_from_registration(&legacy.capabilities).unwrap();
        assert!(registry
            .poll(RunnerPollRequest {
                client_id: "ssh-resource-runner".into(),
                runner_instance_id: "instance-a".into()
            })
            .await
            .unwrap()
            .is_none());
        let result = receiver.await.unwrap();
        assert_eq!(result.request_dispatched, Some(false));
        assert!(result
            .error
            .as_deref()
            .is_some_and(|error| error.starts_with("ssh_connection_setup_unsupported")));
    }
}
