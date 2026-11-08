use super::*;
use std::collections::VecDeque;
use std::sync::Mutex;

struct MockGateway {
    expected: Mutex<VecDeque<(&'static str, Result<Value, SshResourceError>)>>,
    calls: Mutex<Vec<Value>>,
}
impl MockGateway {
    fn new(expected: Vec<(&'static str, Result<Value, SshResourceError>)>) -> Self {
        Self {
            expected: Mutex::new(expected.into()),
            calls: Mutex::new(Vec::new()),
        }
    }
    fn actions(&self) -> Vec<String> {
        assert!(
            self.expected.lock().unwrap().is_empty(),
            "expected gateway request was not issued"
        );
        self.calls
            .lock()
            .unwrap()
            .iter()
            .map(|call| call["action"].as_str().unwrap().into())
            .collect()
    }
}
impl Gateway for MockGateway {
    async fn call(&self, _: &StoredRuntime, arguments: Value) -> Result<Value, SshResourceError> {
        let (action, result) = self
            .expected
            .lock()
            .unwrap()
            .pop_front()
            .expect("unexpected retry or retarget");
        assert_eq!(arguments["action"], action);
        self.calls.lock().unwrap().push(arguments);
        result
    }
}
fn runtime() -> StoredRuntime {
    StoredRuntime {
        server_url: "http://127.0.0.1:1".into(),
        server_env_file: None,
        runner_config: Some("/private/runner.toml".into()),
        user_token_file: Some("/private/user.token".into()),
        runner_client_id: Some("mini".into()),
        project_id: None,
        runtime_project_id: None,
    }
}
fn resource(name: &str, source: &str) -> Value {
    json!({"name":name,"source":source,"active":true,"pending_restart":false})
}
fn list(resources: Vec<Value>) -> Result<Value, SshResourceError> {
    Ok(
        json!({"runner":"mini", "binding":"wc_sbind_private-observation", "resources":resources,"setup_supported":true}),
    )
}
fn registered(name: &str) -> Result<Value, SshResourceError> {
    Ok(json!({"resource":name,"persisted":true,"active":true,"restart_required":false}))
}
fn register(name: &str) -> Mutation {
    Mutation::Register {
        name: name.into(),
        connection: SshOperatorConnection::Alias {
            target: "private-user@private-host".into(),
        },
        default_cwd: Some("/private/cwd".into()),
    }
}

fn verified_status(error: Option<&str>) -> Result<Value, SshResourceError> {
    Ok(
        json!({"runner":"mini","binding":"wc_sbind_private-observation","resources":[resource("saved","managed")],
        "setup_supported":true,"verification_supported":true,
        "verifications":[{"name":"saved","verification":{"checked_at":1700000000,"error_kind":error}}]}),
    )
}

#[tokio::test]
async fn ssh_status_falls_back_only_for_explicit_old_server_unsupported() {
    let gateway = MockGateway::new(vec![
        (
            "status",
            Err(SshResourceError::SshConnectionSetupUnsupported),
        ),
        ("list", list(vec![resource("legacy", "managed")])),
    ]);
    let result = SshResourcesManager::default()
        .list(&runtime(), &gateway)
        .await;
    assert!(result.available);
    assert!(!result.verification_supported && result.verifications.is_empty());
    assert_eq!(gateway.actions(), ["status", "list"]);
    for error in [
        SshResourceError::InsufficientScope,
        SshResourceError::AuthorizationUnavailable,
        SshResourceError::SshResourceRegistryUnavailable,
        SshResourceError::RunnerReplaced,
    ] {
        let gateway = MockGateway::new(vec![("status", Err(error))]);
        let result = SshResourcesManager::default()
            .list(&runtime(), &gateway)
            .await;
        assert_eq!(result.error_kind, Some(error));
        assert!(!result.available);
        assert_eq!(gateway.actions(), ["status"]);
    }
}

#[tokio::test]
async fn ssh_saved_check_consumes_observation_reobserves_failure_and_never_replays() {
    let gateway = MockGateway::new(vec![
        ("status", verified_status(None)),
        (
            "verify_saved",
            Ok(
                json!({"resource":"saved","persisted":true,"verification":{"checked_at":1700000001,"error_kind":"ssh_authentication_failed"}}),
            ),
        ),
        ("status", verified_status(Some("ssh_authentication_failed"))),
        ("status", verified_status(Some("ssh_authentication_failed"))),
    ]);
    let mut manager = SshResourcesManager::default();
    let first = manager.list(&runtime(), &gateway).await;
    let old = first.observation_id.unwrap();
    assert!(first.verifications[0]
        .verification
        .as_ref()
        .unwrap()
        .error_kind
        .is_none());
    let result = manager
        .mutate(
            &runtime(),
            &old,
            Mutation::VerifySaved {
                name: "saved".into(),
            },
            &gateway,
        )
        .await;
    assert_eq!(
        result.error_kind,
        Some(SshResourceError::SshAuthenticationFailed)
    );
    assert!(!result.success && !result.restart_required);
    assert_eq!(
        result.inventory.verifications[0]
            .verification
            .as_ref()
            .unwrap()
            .error_kind
            .unwrap()
            .code(),
        "ssh_authentication_failed"
    );
    let replay = manager
        .mutate(
            &runtime(),
            &old,
            Mutation::VerifySaved {
                name: "saved".into(),
            },
            &gateway,
        )
        .await;
    assert_eq!(
        replay.error_kind,
        Some(SshResourceError::SshResourceRegistryStale)
    );
    assert_eq!(
        gateway.actions(),
        ["status", "verify_saved", "status", "status"]
    );
    assert_eq!(
        gateway.calls.lock().unwrap()[1],
        json!({"action":"verify_saved","binding":"wc_sbind_private-observation","name":"saved"})
    );
}

#[tokio::test]
async fn ssh_saved_check_retains_unknown_outcome_even_when_history_can_be_read() {
    let gateway = MockGateway::new(vec![
        ("status", verified_status(None)),
        (
            "verify_saved",
            Err(SshResourceError::SshResourceOutcomeUnknown),
        ),
        ("status", verified_status(None)),
    ]);
    let mut manager = SshResourcesManager::default();
    let first = manager.list(&runtime(), &gateway).await;
    let result = manager
        .mutate(
            &runtime(),
            first.observation_id.as_deref().unwrap(),
            Mutation::VerifySaved {
                name: "saved".into(),
            },
            &gateway,
        )
        .await;
    assert!(!result.success && result.inventory.available);
    assert_eq!(
        result.error_kind,
        Some(SshResourceError::SshResourceOutcomeUnknown)
    );
    assert_eq!(gateway.actions(), ["status", "verify_saved", "status"]);
}

#[tokio::test]
async fn ssh_list_is_exact_and_public_inventory_has_no_binding_or_target() {
    let gateway = MockGateway::new(vec![(
        "status",
        list(vec![
            resource("managed", "managed"),
            resource("static", "static"),
        ]),
    )]);
    let mut manager = SshResourcesManager::default();
    let snapshot = manager.list(&runtime(), &gateway).await;
    assert!(snapshot.available);
    assert!(snapshot.observation_id.is_some());
    let public = serde_json::to_string(&snapshot).unwrap();
    for forbidden in [
        "wc_sbind_",
        "private",
        "target",
        "hostname",
        "username",
        "default_cwd",
        "config",
        "token",
    ] {
        assert!(!public.contains(forbidden));
    }
    assert_eq!(gateway.actions(), ["status"]);
    assert_eq!(
        gateway.calls.lock().unwrap()[0],
        json!({"action":"status","runner":"mini"})
    );
}

#[tokio::test]
async fn ssh_register_remove_each_consume_observation_then_relist() {
    let gateway = MockGateway::new(vec![
        ("status", list(vec![])),
        ("register", registered("test")),
        ("status", list(vec![resource("test", "managed")])),
        (
            "remove",
            Ok(json!({"resource":"test","persisted":true,"active":false,"restart_required":false})),
        ),
        ("status", list(vec![])),
    ]);
    let mut manager = SshResourcesManager::default();
    let first = manager.list(&runtime(), &gateway).await;
    let added = manager
        .mutate(
            &runtime(),
            first.observation_id.as_deref().unwrap(),
            register("test"),
            &gateway,
        )
        .await;
    assert!(added.success);
    assert_ne!(first.observation_id, added.inventory.observation_id);
    let public = serde_json::to_string(&added).unwrap();
    assert!(!public.contains("private-user") && !public.contains("/private/cwd"));
    let removed = manager
        .mutate(
            &runtime(),
            added.inventory.observation_id.as_deref().unwrap(),
            Mutation::Remove {
                name: "test".into(),
            },
            &gateway,
        )
        .await;
    assert!(removed.success);
    assert!(removed.inventory.resources.is_empty());
    assert_eq!(
        gateway.actions(),
        ["status", "register", "status", "remove", "status"]
    );
    let calls = gateway.calls.lock().unwrap();
    assert_eq!(calls[1]["binding"], "wc_sbind_private-observation");
    assert!(calls[1].get("runner").is_none());
    assert_eq!(
        calls[1]["connection"]["target"],
        "private-user@private-host"
    );
}

#[tokio::test]
async fn ssh_second_mutation_cannot_reuse_previous_observation() {
    let gateway = MockGateway::new(vec![
        ("status", list(vec![])),
        ("register", registered("test")),
        ("status", list(vec![resource("test", "managed")])),
        ("status", list(vec![resource("test", "managed")])),
    ]);
    let mut manager = SshResourcesManager::default();
    let first = manager.list(&runtime(), &gateway).await;
    let id = first.observation_id.unwrap();
    assert!(
        manager
            .mutate(&runtime(), &id, register("test"), &gateway)
            .await
            .success
    );
    let stale = manager
        .mutate(
            &runtime(),
            &id,
            Mutation::Remove {
                name: "test".into(),
            },
            &gateway,
        )
        .await;
    assert_eq!(
        stale.error_kind,
        Some(SshResourceError::SshResourceRegistryStale)
    );
    assert_eq!(
        gateway.actions(),
        ["status", "register", "status", "status"]
    );
}

#[tokio::test]
async fn ssh_static_resource_is_read_only_even_before_server_dispatch() {
    let gateway = MockGateway::new(vec![
        ("status", list(vec![resource("static", "static")])),
        ("status", list(vec![resource("static", "static")])),
    ]);
    let mut manager = SshResourcesManager::default();
    let first = manager.list(&runtime(), &gateway).await;
    let result = manager
        .mutate(
            &runtime(),
            first.observation_id.as_deref().unwrap(),
            Mutation::Remove {
                name: "static".into(),
            },
            &gateway,
        )
        .await;
    assert_eq!(
        result.error_kind,
        Some(SshResourceError::SshResourceStaticReadOnly)
    );
    assert_eq!(gateway.actions(), ["status", "status"]);
}

#[tokio::test]
async fn ssh_unknown_stale_replaced_and_conflict_never_retry_mutation() {
    for error in [
        SshResourceError::SshResourceOutcomeUnknown,
        SshResourceError::RunnerReplaced,
        SshResourceError::SshResourceRegistryStale,
        SshResourceError::SshResourceNameConflict,
        SshResourceError::SshResourceStaticConflict,
        SshResourceError::InsufficientScope,
    ] {
        let gateway = MockGateway::new(vec![
            ("status", list(vec![])),
            ("register", Err(error)),
            ("status", list(vec![])),
        ]);
        let mut manager = SshResourcesManager::default();
        let first = manager.list(&runtime(), &gateway).await;
        let result = manager
            .mutate(
                &runtime(),
                first.observation_id.as_deref().unwrap(),
                register("test"),
                &gateway,
            )
            .await;
        assert!(!result.success);
        assert_eq!(result.error_kind, Some(error));
        assert!(result.inventory.available);
        assert_ne!(first.observation_id, result.inventory.observation_id);
        assert_eq!(gateway.actions(), ["status", "register", "status"]);
    }
}

#[tokio::test]
async fn ssh_connection_or_credential_replacement_invalidates_observation() {
    let gateway = MockGateway::new(vec![("status", list(vec![])), ("status", list(vec![]))]);
    let mut manager = SshResourcesManager::default();
    let first = manager.list(&runtime(), &gateway).await;
    let mut replaced = runtime();
    replaced.user_token_file = Some("/new-enrollment/user.token".into());
    let result = manager
        .mutate(
            &replaced,
            first.observation_id.as_deref().unwrap(),
            register("test"),
            &gateway,
        )
        .await;
    assert_eq!(result.error_kind, Some(SshResourceError::RunnerReplaced));
    assert_eq!(gateway.actions(), ["status", "status"]);
}

#[tokio::test]
async fn ssh_missing_capability_offline_denied_and_invalid_inventory_are_not_empty_success() {
    for response in [
        Err(SshResourceError::SshResourceRegistryUnavailable), // offline/missing managed-SSH capability
        Err(SshResourceError::InsufficientScope),
        Err(SshResourceError::AuthorizationUnavailable),
        Ok(json!({"runner":"other", "binding":"wc_sbind_wrong", "resources":[]})),
        Ok(
            json!({"runner":"mini", "binding":"wc_sbind_private", "resources":[{"name":"leak", "source":"managed","active":true,"pending_restart":false,"target":"private"}]}),
        ),
    ] {
        let gateway = MockGateway::new(vec![("status", response)]);
        let mut manager = SshResourcesManager::default();
        let result = manager.list(&runtime(), &gateway).await;
        assert!(!result.available);
        assert!(result.observation_id.is_none());
        assert!(result.error_kind.is_some());
        assert!(manager.observation.is_none());
        assert!(!serde_json::to_string(&result).unwrap().contains("private"));
    }
}

#[tokio::test]
async fn ssh_pending_restart_is_runner_state_not_local_form_history() {
    let gateway = MockGateway::new(vec![(
        "status",
        list(vec![
            json!({"name":"pending","source":"managed","active":false,"pending_restart":true}),
        ]),
    )]);
    let result = SshResourcesManager::default()
        .list(&runtime(), &gateway)
        .await;
    assert!(result.available);
    assert!(!result.resources[0].active);
    assert!(result.resources[0].pending_restart);
}

#[test]
fn ssh_request_vocabulary_is_closed_and_ssh_alias_is_not_parsed() {
    let base = json!({"expected":{"config_path":"/runner.toml","client_id":"mini","server_url":"http://127.0.0.1:1"},
        "observation_id":"observed", "name":"special", "connection":{"kind":"alias","target":"special"}, "default_cwd":null});
    assert!(serde_json::from_value::<SshRegisterRequest>(base.clone()).is_ok());
    for (key, value) in [
        ("tool", json!("run_shell")),
        ("runner", json!("other")),
        ("url", json!("https://other.example")),
        ("binding", json!("wc_sbind_any")),
        ("env", json!({})),
    ] {
        let mut input = base.clone();
        input[key] = value;
        assert!(serde_json::from_value::<SshRegisterRequest>(input).is_err());
    }
    let args = Mutation::Register {
        name: "special".into(),
        connection: SshOperatorConnection::Alias {
            target: "special".into(),
        },
        default_cwd: None,
    }
    .arguments("binding".into())
    .unwrap();
    assert_eq!(args["connection"]["target"], "special");
    assert!(args.get("default_cwd").is_none());
    assert!(Mutation::Register {
        name: "special".into(),
        connection: SshOperatorConnection::Alias {
            target: "-oIdentityFile=secret".into()
        },
        default_cwd: None
    }
    .arguments("binding".into())
    .is_err());
}

#[tokio::test]
async fn ssh_http_transport_uses_operator_routes_and_native_token_only() {
    use tokio::io::AsyncWriteExt;
    let root = crate::coding_agents::tests::Scratch::new();
    let token_path = root.0.join("user.token");
    tokio::fs::write(&token_path, "fixture-native-token")
        .await
        .unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        let mut calls = Vec::new();
        for (action, response) in [
            (
                "status",
                Some(json!({"success":true,"output":list(vec![]).unwrap()})),
            ),
            ("register", None),
            (
                "status",
                Some(
                    json!({"success":true,"output":list(vec![resource("test","managed")]).unwrap()}),
                ),
            ),
        ] {
            let (mut stream, _) = tokio::time::timeout(Duration::from_secs(10), listener.accept())
                .await
                .unwrap()
                .unwrap();
            let mut bytes = Vec::new();
            let mut chunk = [0u8; 4096];
            let (header_end, length) = loop {
                let count = stream.read(&mut chunk).await.unwrap();
                assert!(count > 0);
                bytes.extend_from_slice(&chunk[..count]);
                assert!(bytes.len() <= 16384);
                if let Some(end) = bytes.windows(4).position(|part| part == b"\r\n\r\n") {
                    let header = std::str::from_utf8(&bytes[..end])
                        .unwrap()
                        .to_ascii_lowercase();
                    assert!(header.starts_with(&format!(
                        "post /api/runtime-console/ssh-resources/{action} http/1.1"
                    )));
                    assert!(header.contains("authorization: bearer fixture-native-token"));
                    let length: usize = header
                        .lines()
                        .find_map(|line| line.strip_prefix("content-length: "))
                        .unwrap()
                        .parse()
                        .unwrap();
                    break (end + 4, length);
                }
            };
            while bytes.len() < header_end + length {
                let count = stream.read(&mut chunk).await.unwrap();
                assert!(count > 0);
                bytes.extend_from_slice(&chunk[..count]);
                assert!(bytes.len() <= 16384);
            }
            let body: Value =
                serde_json::from_slice(&bytes[header_end..header_end + length]).unwrap();
            for key in ["tool", "params", "action", "url", "headers"] {
                assert!(body.get(key).is_none());
            }
            assert!(!body.to_string().contains("fixture-native-token"));
            calls.push(action.to_owned());
            if let Some(response) = response {
                let body = response.to_string();
                stream.write_all(format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{}", body.len(), body).as_bytes()).await.unwrap();
            }
            // None simulates a lost response after the Server received the mutation.
        }
        calls
    });
    let mut runtime = runtime();
    runtime.server_url = format!("http://127.0.0.1:{port}/ignored?not_forwarded=1");
    runtime.user_token_file = Some(token_path);
    let mut manager = SshResourcesManager::default();
    let first = manager.list(&runtime, &HttpGateway).await;
    assert!(first.available);
    let result = manager
        .mutate(
            &runtime,
            first.observation_id.as_deref().unwrap(),
            register("test"),
            &HttpGateway,
        )
        .await;
    assert_eq!(
        result.error_kind,
        Some(SshResourceError::SshResourceOutcomeUnknown)
    );
    assert!(result.inventory.available);
    assert_eq!(result.inventory.resources[0].name, "test");
    assert_eq!(server.await.unwrap(), ["status", "register", "status"]);
}

fn connection_endpoint() -> SshEndpoint {
    SshEndpoint {
        host: "192.0.2.10".into(),
        port: 2222,
        user: "fixture-user".into(),
    }
}

fn connection_trust() -> SshHostKeyTrust {
    SshHostKeyTrust {
        challenge_id: "fixture-challenge".into(),
        fingerprint: format!("SHA256:{}", "A".repeat(43)),
    }
}

fn connection_authentication() -> SshAuthentication {
    SshAuthentication::Password {
        password: webcodex_core::ssh_resource::SshSecret::new("fixture-write-only-password".into())
            .unwrap(),
    }
}

fn inspection_output() -> Value {
    json!({
        "action":"inspect", "revision":7, "challenge_id":connection_trust().challenge_id,
        "expires_at":2_000_000_000,
        "host_keys":[{"algorithm":"ssh-ed25519","fingerprint":connection_trust().fingerprint}]
    })
}

#[tokio::test]
async fn ssh_inspect_probe_preserve_one_save_observation_and_public_outputs_have_no_credentials() {
    let gateway = MockGateway::new(vec![
        ("status", list(vec![])),
        ("inspect", Ok(inspection_output())),
        (
            "probe",
            Ok(
                json!({"action":"probe","revision":7,"host_key_fingerprint":connection_trust().fingerprint}),
            ),
        ),
        (
            "register",
            Ok(
                json!({"resource":"production","persisted":true,"active":false,"restart_required":true}),
            ),
        ),
        (
            "status",
            list(vec![
                json!({"name":"production","source":"managed","active":false,"pending_restart":true}),
            ]),
        ),
    ]);
    let mut manager = SshResourcesManager::default();
    let first = manager.list(&runtime(), &gateway).await;
    let observation = first.observation_id.unwrap();
    let inspected = manager
        .check(
            &runtime(),
            &observation,
            ConnectionCheck::Inspect(connection_endpoint()),
            &gateway,
        )
        .await
        .unwrap();
    let ConnectionChecked::Inspected(inspection) = inspected else {
        panic!("expected inspection");
    };
    let public = serde_json::to_string(&inspection).unwrap();
    for forbidden in [
        "fixture-write-only-password",
        "192.0.2.10",
        "fixture-user",
        "binding",
        "revision",
    ] {
        assert!(!public.contains(forbidden));
    }
    assert!(matches!(
        manager
            .check(
                &runtime(),
                &observation,
                ConnectionCheck::Probe {
                    endpoint: connection_endpoint(),
                    authentication: connection_authentication(),
                    host_key: connection_trust(),
                },
                &gateway
            )
            .await,
        Ok(ConnectionChecked::Verified)
    ));
    let result = manager
        .mutate(
            &runtime(),
            &observation,
            Mutation::Register {
                name: "production".into(),
                connection: SshOperatorConnection::Direct {
                    endpoint: connection_endpoint(),
                    authentication: connection_authentication(),
                    host_key: connection_trust(),
                },
                default_cwd: None,
            },
            &gateway,
        )
        .await;
    assert!(result.success && result.restart_required);
    let public = serde_json::to_string(&result).unwrap();
    for forbidden in [
        "fixture-write-only-password",
        "192.0.2.10",
        "fixture-user",
        "authentication",
        "host_key",
    ] {
        assert!(!public.contains(forbidden));
    }
    assert_eq!(
        gateway.actions(),
        ["status", "inspect", "probe", "register", "status"]
    );
    let calls = gateway.calls.lock().unwrap();
    assert!(calls[1].get("authentication").is_none());
    assert_eq!(
        calls[2]["authentication"]["password"],
        "fixture-write-only-password"
    );
    assert_eq!(calls[3]["connection"]["kind"], "direct");
    assert_eq!(
        calls[3]["connection"]["host_key"]["fingerprint"],
        connection_trust().fingerprint
    );
}

#[tokio::test]
async fn ssh_probe_rejects_mismatched_fingerprint_and_unexpected_private_response_fields() {
    for response in [
        json!({"action":"probe","revision":1,"host_key_fingerprint":format!("SHA256:{}", "B".repeat(43))}),
        json!({"action":"probe","revision":1,"host_key_fingerprint":connection_trust().fingerprint,"password":"fixture-private"}),
        inspection_output(),
    ] {
        let gateway = MockGateway::new(vec![("status", list(vec![])), ("probe", Ok(response))]);
        let mut manager = SshResourcesManager::default();
        let observed = manager.list(&runtime(), &gateway).await;
        assert!(matches!(
            manager
                .check(
                    &runtime(),
                    observed.observation_id.as_deref().unwrap(),
                    ConnectionCheck::Probe {
                        endpoint: connection_endpoint(),
                        authentication: connection_authentication(),
                        host_key: connection_trust(),
                    },
                    &gateway
                )
                .await,
            Err(SshResourceError::SshResourceRegistryUnavailable)
        ));
        assert_eq!(gateway.actions(), ["status", "probe"]);
    }
}

#[tokio::test]
async fn ssh_inspection_uses_the_exact_connection_and_old_runner_support_fails_closed() {
    let gateway = MockGateway::new(vec![("status", list(vec![]))]);
    let mut manager = SshResourcesManager::default();
    let observed = manager.list(&runtime(), &gateway).await;
    let mut replacement = runtime();
    replacement.user_token_file = Some("/private/another-user.token".into());
    assert!(matches!(
        manager
            .check(
                &replacement,
                observed.observation_id.as_deref().unwrap(),
                ConnectionCheck::Inspect(connection_endpoint()),
                &gateway
            )
            .await,
        Err(SshResourceError::RunnerReplaced)
    ));
    assert!(matches!(
        manager
            .check(
                &runtime(),
                "stale-observation",
                ConnectionCheck::Inspect(connection_endpoint()),
                &gateway
            )
            .await,
        Err(SshResourceError::SshResourceRegistryStale)
    ));
    assert_eq!(gateway.actions(), ["status"]);

    let gateway = MockGateway::new(vec![(
        "status",
        Ok(json!({"runner":"mini","binding":"wc_sbind_legacy","resources":[]})),
    )]);
    let observed = manager.list(&runtime(), &gateway).await;
    assert!(!observed.setup_supported);
    assert!(matches!(
        manager
            .check(
                &runtime(),
                observed.observation_id.as_deref().unwrap(),
                ConnectionCheck::Inspect(connection_endpoint()),
                &gateway
            )
            .await,
        Err(SshResourceError::SshConnectionSetupUnsupported)
    ));
    assert_eq!(gateway.actions(), ["status"]);
}

#[test]
fn ssh_operator_inputs_are_closed_and_secret_debug_is_redacted() {
    let expected =
        json!({"config_path":"/runner.toml","client_id":"mini","server_url":"http://127.0.0.1:1"});
    let probe = json!({"expected":expected,"observation_id":"fresh","endpoint":connection_endpoint(),"authentication":connection_authentication(),"host_key":connection_trust()});
    assert!(serde_json::from_value::<SshProbeRequest>(probe.clone()).is_ok());
    for field in ["url", "tool", "runner", "headers", "credential_ref"] {
        let mut invalid = probe.clone();
        invalid[field] = json!("not-allowed");
        assert!(serde_json::from_value::<SshProbeRequest>(invalid).is_err());
    }
    let mut invalid = probe;
    invalid["authentication"]["secret_ref"] = json!("not-allowed");
    assert!(serde_json::from_value::<SshProbeRequest>(invalid).is_err());
    let inspect = json!({"expected":expected,"observation_id":"fresh","endpoint":connection_endpoint(),"authentication":connection_authentication()});
    assert!(serde_json::from_value::<SshInspectRequest>(inspect).is_err());
    assert!(!format!("{:?}", connection_authentication()).contains("fixture-write-only-password"));
}

#[tokio::test]
async fn ssh_old_server_returns_upgrade_required_without_retry_or_scope_claim() {
    use tokio::io::AsyncWriteExt;
    let root = crate::coding_agents::tests::Scratch::new();
    let token_path = root.0.join("user.token");
    tokio::fs::write(&token_path, "fixture-native-token")
        .await
        .unwrap();
    for (responses, expected_error) in [
        (
            vec![("status", 404), ("list", 404)],
            SshResourceError::SshConnectionSetupUnsupported,
        ),
        (
            vec![("status", 401)],
            SshResourceError::AuthorizationUnavailable,
        ),
        (vec![("status", 403)], SshResourceError::InsufficientScope),
        (
            vec![("status", 405)],
            SshResourceError::SshResourceRegistryUnavailable,
        ),
        (
            vec![("status", 500)],
            SshResourceError::SshResourceRegistryUnavailable,
        ),
        (
            vec![("status", 501)],
            SshResourceError::SshResourceRegistryUnavailable,
        ),
        (
            vec![("status", 503)],
            SshResourceError::SshResourceRegistryUnavailable,
        ),
        (
            vec![("status", 404), ("list", 401)],
            SshResourceError::AuthorizationUnavailable,
        ),
        (
            vec![("status", 404), ("list", 403)],
            SshResourceError::InsufficientScope,
        ),
        (
            vec![("status", 404), ("list", 500)],
            SshResourceError::SshResourceRegistryUnavailable,
        ),
    ] {
        let expected_actions: Vec<_> = responses.iter().map(|(action, _)| *action).collect();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let (finished, completion) = tokio::sync::oneshot::channel();
        let server = tokio::spawn(async move {
            let mut calls = Vec::new();
            for (action, status) in responses {
                let (mut stream, _) =
                    tokio::time::timeout(Duration::from_secs(10), listener.accept())
                        .await
                        .unwrap()
                        .unwrap();
                let body = tokio::time::timeout(Duration::from_secs(10), async {
                    let mut bytes = Vec::new();
                    let mut chunk = [0u8; 4096];
                    let (header_end, length) = loop {
                        let count = stream.read(&mut chunk).await.unwrap();
                        assert!(count > 0);
                        bytes.extend_from_slice(&chunk[..count]);
                        assert!(bytes.len() <= 16384);
                        if let Some(end) = bytes.windows(4).position(|part| part == b"\r\n\r\n") {
                            let header = std::str::from_utf8(&bytes[..end]).unwrap();
                            assert!(header.starts_with(&format!(
                                "POST /api/runtime-console/ssh-resources/{action} HTTP/1.1"
                            )));
                            let length: usize = header
                                .lines()
                                .find_map(|line| {
                                    line.to_ascii_lowercase()
                                        .strip_prefix("content-length: ")
                                        .map(|value| value.parse().unwrap())
                                })
                                .unwrap();
                            assert!(length <= 16384 - (end + 4));
                            break (end + 4, length);
                        }
                    };
                    while bytes.len() < header_end + length {
                        let count = stream.read(&mut chunk).await.unwrap();
                        assert!(count > 0);
                        bytes.extend_from_slice(&chunk[..count]);
                        assert!(bytes.len() <= 16384);
                    }
                    serde_json::from_slice::<Value>(&bytes[header_end..header_end + length])
                        .unwrap()
                })
                .await
                .unwrap();
                assert_eq!(body, json!({"runner":"mini"}));
                calls.push(action);
                stream
                    .write_all(format!("HTTP/1.1 {status} Fixture\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").as_bytes())
                    .await
                    .unwrap();
            }
            // Keep listening until the caller returns: an unexpected fallback
            // must fail this fixture, not look like another unavailable Server.
            tokio::select! {
                biased;
                _ = listener.accept() => panic!("unexpected SSH retry or probe"),
                result = completion => result.unwrap(),
            }
            calls
        });
        let mut runtime = runtime();
        runtime.server_url = format!("http://127.0.0.1:{port}");
        runtime.user_token_file = Some(token_path.clone());
        let mut manager = SshResourcesManager::default();
        let output = manager.list(&runtime, &HttpGateway).await;
        let _ = finished.send(());
        assert_eq!(server.await.unwrap(), expected_actions);
        assert!(!output.available && !output.setup_supported && !output.verification_supported);
        assert!(output.observation_id.is_none());
        assert_eq!(output.error_kind, Some(expected_error));
    }
}
