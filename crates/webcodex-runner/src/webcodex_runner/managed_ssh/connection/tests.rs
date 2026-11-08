use super::*;
use base64::Engine;
use webcodex_core::ssh_resource::{SshAuthentication, SshSecret};

fn fixture() -> (
    tempfile::TempDir,
    ManagedSshResourceStore,
    SshEndpoint,
    HostKey,
) {
    let temporary = tempfile::Builder::new()
        .tempdir_in(std::env::temp_dir().canonicalize().unwrap())
        .unwrap();
    let store =
        ManagedSshResourceStore::initialize_at_root(temporary.path(), &SshConfig::default());
    let endpoint = SshEndpoint {
        host: "127.0.0.1".into(),
        port: 2222,
        user: "fixture-user".into(),
    };
    let mut bytes = Vec::new();
    bytes.extend_from_slice(&11u32.to_be_bytes());
    bytes.extend_from_slice(b"ssh-ed25519");
    bytes.extend_from_slice(&32u32.to_be_bytes());
    bytes.extend_from_slice(&[17; 32]);
    let key = HostKey::parse(
        "ssh-ed25519",
        &base64::engine::general_purpose::STANDARD.encode(bytes),
    )
    .unwrap();
    (temporary, store, endpoint, key)
}

fn saved_fixture() -> (tempfile::TempDir, ManagedSshResourceStore) {
    let (temporary, store, endpoint, key) = fixture();
    let mut candidate = ConnectionCandidate::create(
        &store.private_root().unwrap(),
        endpoint.clone(),
        SshAuthentication::ExistingEnvironment,
        key,
    )
    .unwrap();
    let resource = ManagedResource {
        target: endpoint.host,
        default_cwd: None,
        connection: Some(candidate.connection.stored.clone()),
    };
    write_registry(
        store.path.as_ref().unwrap(),
        &ManagedRegistry {
            version: STORE_VERSION,
            revision: 1,
            resources: BTreeMap::from([("saved".into(), resource)]),
        },
    )
    .unwrap();
    candidate.retain();
    (temporary, store)
}

#[test]
fn saved_verification_is_durable_safe_history_without_changing_published_registry() {
    use webcodex_environment::private_files::PrivateFileStore;
    let (temporary, store) = saved_fixture();
    let registry_path = store.path.as_ref().unwrap();
    let original_bytes = fs::read(registry_path).unwrap();
    let initial = store.handle(&SshConfig::default(), SshResourceRequest::Status);
    assert!(
        matches!(&initial, SshResourceResponse::Status { verifications, verification_unavailable: false, .. }
        if verifications.len() == 1 && verifications[0].verification.is_none())
    );
    let response = store
        .verify_saved(&SshConfig::default(), 1, "saved", None, &|| true, |_, _| {
            Ok(())
        })
        .unwrap();
    let SshResourceResponse::VerifySaved {
        verification,
        revision,
        ..
    } = response
    else {
        panic!("saved check result");
    };
    assert_eq!(revision, 1);
    assert!(verification.error_kind.is_none() && verification.checked_at > 0);
    assert_eq!(fs::read(registry_path).unwrap(), original_bytes);
    // These are the published strict record fields; history must not extend them.
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct PublishedResource {
        target: String,
        #[serde(default)]
        default_cwd: Option<String>,
        #[serde(default)]
        connection: Option<StoredSshConnection>,
    }
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct PublishedRegistry {
        version: u32,
        revision: u64,
        resources: BTreeMap<String, PublishedResource>,
    }
    let old: PublishedRegistry = serde_json::from_slice(&fs::read(registry_path).unwrap()).unwrap();
    assert_eq!((old.version, old.revision), (1, 1));
    assert_eq!(old.resources["saved"].target, "127.0.0.1");
    assert!(old.resources["saved"].default_cwd.is_none());
    assert!(old.resources["saved"].connection.is_some());
    let private = PrivateFileStore::existing(&store.private_root().unwrap()).unwrap();
    private
        .create(
            "verification-history.pending.json",
            b"interrupted observation",
        )
        .unwrap();
    assert!(store.startup_managed.resources.is_empty());
    // This invokes the unchanged old-prefix-only credential/askpass GC as well as
    // registry parsing: neither history nor its pending file affects activation.
    let restarted =
        ManagedSshResourceStore::initialize_at_root(temporary.path(), &SshConfig::default());
    let status = restarted.handle(&SshConfig::default(), SshResourceRequest::Status);
    assert!(
        matches!(&status, SshResourceResponse::Status { resources, verifications, verification_unavailable: false, .. }
        if resources[0].active && !resources[0].pending_restart && verifications[0].verification == Some(verification))
    );
    assert!(private
        .path("verification-history.pending.json")
        .unwrap()
        .exists());
    let encoded = serde_json::to_string(&status).unwrap();
    for secret in [
        "127.0.0.1",
        "fixture-user",
        "credential-",
        "known_hosts",
        "binding",
    ] {
        assert!(!encoded.contains(secret));
    }
    let legacy =
        serde_json::to_value(restarted.handle(&SshConfig::default(), SshResourceRequest::List))
            .unwrap();
    assert!(legacy.get("verifications").is_none());
    assert!(legacy["resources"][0].get("verification").is_none());
    let response = restarted
        .verify_saved(&SshConfig::default(), 1, "saved", None, &|| true, |_, _| {
            Err("ssh_authentication_failed")
        })
        .unwrap();
    assert!(matches!(
        response,
        SshResourceResponse::VerifySaved {
            revision: 1,
            verification: SshVerification {
                error_kind: Some(SshVerificationError::SshAuthenticationFailed),
                ..
            },
            ..
        }
    ));
    let registry = load_registry(registry_path).unwrap();
    let history = VerificationHistory::load(registry_path).unwrap();
    assert_eq!(
        history
            .get("saved", &registry.resources["saved"])
            .unwrap()
            .error_kind,
        Some(SshVerificationError::SshAuthenticationFailed)
    );
    assert_eq!(fs::read(registry_path).unwrap(), original_bytes);
    assert!(!private
        .path("verification-history.pending.json")
        .unwrap()
        .exists());
}

#[test]
fn verification_history_is_bound_to_resource_configuration_and_credential_uuid() {
    let (_temporary, store) = saved_fixture();
    let registry = load_registry(store.path.as_ref().unwrap()).unwrap();
    let resource = &registry.resources["saved"];
    let mut history = VerificationHistory::default();
    assert!(history.get("saved", resource).is_none());
    history
        .record(&registry, "saved", resource, Ok(()))
        .unwrap();
    assert!(history.get("saved", resource).is_some());
    assert!(history.get("another-name", resource).is_none());
    let mut changed = resource.clone();
    changed.default_cwd = Some("/another-directory".into());
    assert!(history.get("saved", &changed).is_none());
    let mut changed = resource.clone();
    changed.connection.as_mut().unwrap().endpoint.user = "another-user".into();
    assert!(history.get("saved", &changed).is_none());
    let mut changed = resource.clone();
    changed.connection.as_mut().unwrap().id = uuid::Uuid::new_v4().simple().to_string();
    assert!(history.get("saved", &changed).is_none());
    assert!(history.get("saved", resource).is_some());
}

#[test]
fn saved_verification_rejects_late_revision_binding_credential_replacement_and_cancellation() {
    for changed in ["revision", "binding", "credential", "generation", "cancel"] {
        let (_temporary, store) = saved_fixture();
        let current = AtomicBool::new(true);
        let stop = AtomicBool::new(false);
        let result = store.verify_saved(
            &SshConfig::default(),
            1,
            "saved",
            Some(&stop),
            &|| current.load(Ordering::SeqCst),
            |_, _| {
                match changed {
                    "revision" | "binding" | "credential" => {
                        let mut registry = load_registry(store.path.as_ref().unwrap()).unwrap();
                        match changed {
                            "revision" => registry.revision += 1,
                            "binding" => {
                                registry.resources.get_mut("saved").unwrap().default_cwd =
                                    Some("/changed".into())
                            }
                            _ => {
                                registry
                                    .resources
                                    .get_mut("saved")
                                    .unwrap()
                                    .connection
                                    .as_mut()
                                    .unwrap()
                                    .id = uuid::Uuid::new_v4().simple().to_string()
                            }
                        }
                        write_registry(store.path.as_ref().unwrap(), &registry).unwrap();
                    }
                    "generation" => current.store(false, Ordering::SeqCst),
                    "cancel" => stop.store(true, Ordering::SeqCst),
                    _ => unreachable!(),
                }
                Ok(())
            },
        );
        assert_eq!(
            result,
            Err(if changed == "cancel" {
                "ssh_connection_cancelled"
            } else {
                "ssh_resource_registry_stale"
            })
        );
        let registry = load_registry(store.path.as_ref().unwrap()).unwrap();
        assert!(VerificationHistory::load(store.path.as_ref().unwrap())
            .unwrap()
            .get("saved", &registry.resources["saved"])
            .is_none());
    }
    let (_temporary, store) = saved_fixture();
    assert_eq!(
        store.verify_saved(
            &SshConfig::default(),
            0,
            "saved",
            None,
            &|| true,
            |_, _| panic!("stale request must not probe")
        ),
        Err("ssh_resource_registry_stale")
    );
}

#[test]
fn optional_history_corruption_and_orphans_do_not_change_resources_or_grow_unbounded() {
    use webcodex_environment::private_files::PrivateFileStore;
    let (temporary, store) = saved_fixture();
    let registry_path = store.path.as_ref().unwrap();
    let registry = load_registry(registry_path).unwrap();
    let original = fs::read(registry_path).unwrap();
    let mut history = VerificationHistory::default();
    for index in 0..128 {
        history
            .record(
                &registry,
                &format!("uncommitted-{index}"),
                &registry.resources["saved"],
                Ok(()),
            )
            .unwrap();
        assert_eq!(
            serde_json::to_value(&history).unwrap()["entries"]
                .as_object()
                .unwrap()
                .len(),
            1
        );
    }
    history.write(registry_path).unwrap();
    let status = store.handle(&SshConfig::default(), SshResourceRequest::Status);
    assert!(
        matches!(status, SshResourceResponse::Status { resources, verifications, verification_unavailable: false, .. }
        if resources.len() == 1 && resources[0].name == "saved" && verifications[0].verification.is_none())
    );
    let private = PrivateFileStore::existing(&store.private_root().unwrap()).unwrap();
    let path = private.path("verification-history.json").unwrap();
    fs::write(&path, b"not a valid history document").unwrap();
    let restarted =
        ManagedSshResourceStore::initialize_at_root(temporary.path(), &SshConfig::default());
    assert!(restarted.startup_managed.resources.contains_key("saved"));
    assert!(
        matches!(restarted.handle(&SshConfig::default(), SshResourceRequest::List), SshResourceResponse::List { resources, .. } if resources.len() == 1)
    );
    assert!(
        matches!(restarted.handle(&SshConfig::default(), SshResourceRequest::Status), SshResourceResponse::Status { verification_unavailable: true, resources, verifications, .. }
        if resources.len() == 1 && verifications[0].verification.is_none())
    );
    assert_eq!(
        restarted.verify_saved(
            &SshConfig::default(),
            1,
            "saved",
            None,
            &|| true,
            |_, _| panic!("unsafe history must be detected before network work")
        ),
        Err("ssh_resource_invalid")
    );
    assert_eq!(fs::read(registry_path).unwrap(), original);
    let mut oversized = serde_json::to_value(&history).unwrap();
    let record = oversized["entries"]["uncommitted-127"].clone();
    oversized["entries"] = serde_json::Value::Object(
        (0..=MANAGED_SSH_RESOURCE_MAX_COUNT)
            .map(|index| (format!("entry-{index}"), record.clone()))
            .collect(),
    );
    fs::write(&path, serde_json::to_vec(&oversized).unwrap()).unwrap();
    assert!(matches!(
        VerificationHistory::load(registry_path),
        Err("ssh_resource_invalid")
    ));
    private.remove("verification-history.json").unwrap();
    assert!(VerificationHistory::load(registry_path)
        .unwrap()
        .get("saved", &registry.resources["saved"])
        .is_none());
}

#[test]
fn trust_challenges_bind_endpoint_revision_generation_expiry_and_single_commit() {
    let (_temporary, store, endpoint, key) = fixture();
    let trust = SshHostKeyTrust {
        challenge_id: "fixture_challenge".into(),
        fingerprint: key.fingerprint.clone(),
    };
    lock_unpoison(&store.challenges).0.insert(
        trust.challenge_id.clone(),
        Challenge {
            endpoint: endpoint.clone(),
            revision: 4,
            generation: 8,
            deadline: Instant::now() + Duration::from_secs(300),
            keys: vec![key.clone()],
        },
    );
    let mut other = endpoint.clone();
    other.port += 1;
    assert_eq!(
        store.select_host_key(&other, 4, 8, &trust, true),
        Err("ssh_host_key_stale")
    );
    assert_eq!(
        store.select_host_key(&endpoint, 5, 8, &trust, true),
        Err("ssh_host_key_stale")
    );
    assert_eq!(
        store.select_host_key(&endpoint, 4, 9, &trust, true),
        Err("ssh_host_key_stale")
    );
    assert_eq!(
        store
            .select_host_key(&endpoint, 4, 8, &trust, false)
            .unwrap(),
        key
    );
    assert_eq!(
        store
            .select_host_key(&endpoint, 4, 8, &trust, true)
            .unwrap(),
        key
    );
    assert_eq!(
        store.select_host_key(&endpoint, 4, 8, &trust, true),
        Err("ssh_host_key_stale")
    );
    lock_unpoison(&store.challenges).0.insert(
        trust.challenge_id.clone(),
        Challenge {
            endpoint: endpoint.clone(),
            revision: 4,
            generation: 8,
            deadline: Instant::now() - Duration::from_secs(1),
            keys: vec![key],
        },
    );
    assert_eq!(
        store.select_host_key(&endpoint, 4, 8, &trust, false),
        Err("ssh_host_key_stale")
    );
}

#[test]
fn only_authentication_probe_disables_ssh_stdin() {
    let (_temporary, store, endpoint, key) = fixture();
    let candidate = ConnectionCandidate::create(
        &store.private_root().unwrap(),
        endpoint.clone(),
        SshAuthentication::ExistingEnvironment,
        key,
    )
    .unwrap();
    let (probe, lease) = probe_command(&candidate.connection).unwrap();
    assert!(lease.is_none());
    assert!(probe.get_envs().any(|(name, value)| {
        name == "WEBCODEX_SSH_PROBE_DIAGNOSTICS" && value == Some(std::ffi::OsStr::new("1"))
    }));
    let probe_args: Vec<_> = probe.get_args().collect();
    assert_eq!(probe.get_args().filter(|arg| *arg == "-n").count(), 1);
    assert_eq!(
        probe_args[probe_args.len() - 2],
        std::ffi::OsStr::new(&endpoint.host)
    );
    assert_eq!(
        *probe_args.last().unwrap(),
        std::ffi::OsStr::new("echo WEBCODEX_SSH_CONNECTION_OK")
    );

    // Applying the same authentication/host-key configuration to a normal
    // execution must preserve stdin for the Windows program frame and user input.
    let mut execution = Command::new(ssh_program("ssh"));
    execution.env("WEBCODEX_SSH_PROBE_DIAGNOSTICS", "1");
    assert!(candidate
        .connection
        .configure(&mut execution, true)
        .unwrap()
        .is_none());
    assert!(!execution
        .get_args()
        .any(|arg| arg == "-n" || arg == "StdinNull=yes"));
    assert!(execution
        .get_envs()
        .any(|(name, value)| { name == "WEBCODEX_SSH_PROBE_DIAGNOSTICS" && value.is_none() }));
}

#[test]
fn structured_registry_never_contains_credentials_and_activation_requires_restart() {
    let (temporary, first, endpoint, key) = fixture();
    let secret = "private-fixture-password";
    let mut candidate = ConnectionCandidate::create(
        &first.private_root().unwrap(),
        endpoint.clone(),
        SshAuthentication::Password {
            password: SshSecret::new(secret.into()).unwrap(),
        },
        key,
    )
    .unwrap();
    let credential_path = first.private_root().unwrap().join(
        candidate
            .connection
            .stored
            .credential_file
            .as_ref()
            .unwrap(),
    );
    let registry = ManagedRegistry {
        version: STORE_VERSION,
        revision: 1,
        resources: BTreeMap::from([(
            "target".into(),
            ManagedResource {
                target: endpoint.host,
                default_cwd: Some("/tmp".into()),
                connection: Some(candidate.connection.stored.clone()),
            },
        )]),
    };
    write_registry(first.path.as_ref().unwrap(), &registry).unwrap();
    candidate.retain();
    let encoded = std::fs::read_to_string(first.path.as_ref().unwrap()).unwrap();
    assert!(!encoded.contains(secret));
    assert!(!format!("{registry:?}").contains(secret));
    assert!(first.startup_managed.resources.is_empty());
    let second =
        ManagedSshResourceStore::initialize_at_root(temporary.path(), &SshConfig::default());
    assert_eq!(
        second.startup_managed.resources["target"]
            .connection
            .as_ref()
            .unwrap()
            .stored,
        candidate.connection.stored
    );
    drop(candidate);
    let inventory =
        serde_json::to_string(&second.handle(&SshConfig::default(), SshResourceRequest::List))
            .unwrap();
    assert!(!inventory.contains(secret));
    assert!(!inventory.contains("credential-"));
    assert!(!inventory.contains("127.0.0.1"));
    let removed = second.handle(
        &SshConfig::default(),
        SshResourceRequest::Remove {
            expected_revision: 1,
            name: "target".into(),
        },
    );
    assert!(matches!(
        removed,
        SshResourceResponse::Remove {
            active: true,
            restart_required: true,
            ..
        }
    ));
    assert!(credential_path.is_file());
    drop(second);
    assert!(!credential_path.exists());
    let third =
        ManagedSshResourceStore::initialize_at_root(temporary.path(), &SshConfig::default());
    assert!(third.startup_managed.resources.is_empty());
}

#[test]
fn overlapping_runner_snapshots_and_pool_leases_survive_remove_and_old_runner_drop() {
    let (temporary, initial, endpoint, key) = fixture();
    let mut candidate = ConnectionCandidate::create(
        &initial.private_root().unwrap(),
        endpoint.clone(),
        SshAuthentication::Password {
            password: SshSecret::new("only-a-fixture".into()).unwrap(),
        },
        key,
    )
    .unwrap();
    let credential = initial.private_root().unwrap().join(
        candidate
            .connection
            .stored
            .credential_file
            .as_ref()
            .unwrap(),
    );
    let registry = ManagedRegistry {
        version: STORE_VERSION,
        revision: 1,
        resources: BTreeMap::from([(
            "target".into(),
            ManagedResource {
                target: endpoint.host,
                default_cwd: None,
                connection: Some(candidate.connection.stored.clone()),
            },
        )]),
    };
    write_registry(initial.path.as_ref().unwrap(), &registry).unwrap();
    candidate.retain();
    drop(candidate);
    let runner_a =
        ManagedSshResourceStore::initialize_at_root(temporary.path(), &SshConfig::default());
    let runner_b =
        ManagedSshResourceStore::initialize_at_root(temporary.path(), &SshConfig::default());
    let pooled_connection = runner_b.startup_managed.resources["target"]
        .connection
        .clone()
        .unwrap();
    let removed = runner_b.handle(
        &SshConfig::default(),
        SshResourceRequest::Remove {
            expected_revision: 1,
            name: "target".into(),
        },
    );
    assert!(matches!(
        removed,
        SshResourceResponse::Remove { active: true, .. }
    ));
    drop(runner_a);
    assert!(
        credential.is_file(),
        "replacement Runner still owns the credential lease"
    );
    drop(runner_b);
    assert!(
        credential.is_file(),
        "an in-flight pooled connection still owns the lease"
    );
    drop(pooled_connection);
    let next = ManagedSshResourceStore::initialize_at_root(temporary.path(), &SshConfig::default());
    assert!(next.startup_managed.resources.is_empty());
    assert!(
        !credential.exists(),
        "bounded startup GC retires unreferenced and unleased credentials"
    );
}

#[test]
fn shutdown_prevents_any_inspection_or_authentication_process() {
    let (_temporary, store, endpoint, _key) = fixture();
    let stop = AtomicBool::new(true);
    let response = store.handle_with_runtime(
        &SshConfig::default(),
        SshResourceRequest::Inspect {
            expected_revision: 0,
            endpoint,
        },
        1,
        Some(&stop),
        || true,
    );
    assert!(
        matches!(response, SshResourceResponse::Error { ref code, .. } if code == "ssh_connection_cancelled")
    );
}

#[test]
fn startup_collects_credential_left_by_crash_before_host_key_anchor_creation() {
    let (temporary, initial, _endpoint, _key) = fixture();
    let private = webcodex_environment::private_files::PrivateFileStore::open(
        &initial.private_root().unwrap(),
    )
    .unwrap();
    let name = format!("credential-{}.json", uuid::Uuid::new_v4().simple());
    let orphan = private.create(&name, b"synthetic private orphan").unwrap();
    let unrelated = private
        .create("operator-owned.json", b"unrelated private file")
        .unwrap();
    let next = ManagedSshResourceStore::initialize_at_root(temporary.path(), &SshConfig::default());
    assert!(next.startup_managed.resources.is_empty());
    assert!(!orphan.exists());
    assert!(
        unrelated.is_file(),
        "GC only owns generated credential names"
    );
}

#[test]
fn setup_errors_are_static_and_distinguish_host_keys_auth_and_local_key_permissions() {
    // Remote stderr can spoof a diagnostic marker. It never overrides the
    // existing failure classification or establishes successful execution.
    assert_eq!(
        classify_failure(
            b"webcodex_ssh_askpass:complete\nuser@host: Permission denied (publickey)."
        ),
        "ssh_authentication_failed"
    );
    assert_eq!(
        classify_failure(
            b"WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!\nHost key verification failed."
        ),
        "ssh_host_key_changed"
    );
    assert_eq!(
        classify_failure(b"user@host: Permission denied (password)."),
        "ssh_authentication_failed"
    );
    assert_eq!(
        classify_failure(b"WARNING: UNPROTECTED PRIVATE KEY FILE!"),
        "ssh_client_permission_denied"
    );
    assert_eq!(
        classify_failure(b"unix_listener: socket: Operation not permitted"),
        "ssh_client_permission_denied"
    );
    assert_eq!(
        classify_failure(b"unix_listener: cannot bind to private path: Permission denied"),
        "ssh_client_permission_denied"
    );
    assert_eq!(
        classify_failure(b"Connection timed out"),
        "ssh_connection_timeout"
    );
}
