use super::*;

#[test]
fn preparation_discovery_diagnostics_keep_fixed_distinct_codes() {
    for code in [
        "codex_not_found",
        "codex_requires_native_executable",
        "codex_npm_layout_invalid",
        "codex_node_not_found",
        "codex_launcher_arguments_invalid",
    ] {
        let diagnostic = preparation_error(code);
        assert_eq!(diagnostic.code, code);
        assert!(!diagnostic.message.is_empty());
        assert!(!diagnostic.recovery.is_empty());
    }
    let unknown = preparation_error("private-diagnostic-sentinel");
    assert_eq!(unknown.code, "codex_prepare_failed");
    assert!(!unknown.to_string().contains("private-diagnostic-sentinel"));
}

fn fixture_profile(python: &Path, adapter: &Path, receipt: &Path) -> PreparedCodex {
    PreparedCodex {
        status: "ready".into(),
        codex_version: "0.167.0-fixture.1".into(),
        receipt: receipt.to_string_lossy().into_owned(),
        profile: PreparedCodexProfile {
            provider_id: "codex-app-server".into(),
            name: "Codex app-server (experimental)".into(),
            executable: python.to_string_lossy().into_owned(),
            args: vec![
                adapter.to_string_lossy().into_owned(),
                "serve".into(),
                "--experimental".into(),
                "--receipt".into(),
                receipt.to_string_lossy().into_owned(),
            ],
            enabled: false,
            env_from_env: BTreeMap::from([("PATH".into(), "PATH".into())]),
            allowed_config_options: Vec::new(),
        },
    }
}

#[test]
fn preparation_rejects_enabled_retargeted_or_credential_bearing_profiles() {
    let root = std::env::temp_dir();
    let python = root.join("python");
    let adapter = root.join("adapter.py");
    let receipt = root.join("receipt.json");
    let original = fixture_profile(&python, &adapter, &receipt);
    validate_prepared(&original, &python, &adapter, &receipt, false).unwrap();
    let mut enabled = original.clone();
    enabled.profile.enabled = true;
    assert!(validate_prepared(&enabled, &python, &adapter, &receipt, false).is_err());
    let mut retargeted = original.clone();
    retargeted.profile.args[0] = root.join("other.py").to_string_lossy().into_owned();
    assert!(validate_prepared(&retargeted, &python, &adapter, &receipt, false).is_err());
    let mut secret = original.clone();
    secret
        .profile
        .env_from_env
        .insert("OPENAI_API_KEY".into(), "private-test-token".into());
    let error = validate_prepared(&secret, &python, &adapter, &receipt, false).unwrap_err();
    assert!(!error.to_string().contains("private-test-token"));
    let mut widened = original;
    widened
        .profile
        .allowed_config_options
        .push("sandbox".into());
    assert!(validate_prepared(&widened, &python, &adapter, &receipt, false).is_err());
}

#[test]
fn preparation_network_access_requires_the_exact_operator_choice() {
    let root = std::env::temp_dir();
    let python = root.join("python");
    let adapter = root.join("adapter.py");
    let receipt = root.join("receipt.json");
    let offline = fixture_profile(&python, &adapter, &receipt);
    assert!(!PrepareCodexOptions::default().allow_network);
    assert!(validate_prepared(&offline, &python, &adapter, &receipt, true).is_err());
    let mut online = offline;
    online.profile.args.push("--network".into());
    assert!(validate_prepared(&online, &python, &adapter, &receipt, false).is_err());
    validate_prepared(&online, &python, &adapter, &receipt, true).unwrap();
    let mut wider_sandbox = online.clone();
    wider_sandbox
        .profile
        .args
        .extend(["--sandbox".into(), "danger-full-access".into()]);
    assert!(validate_prepared(&wider_sandbox, &python, &adapter, &receipt, true).is_err());
    let mut extra_credentials = online;
    extra_credentials
        .profile
        .env_from_env
        .insert("GH_TOKEN".into(), "GH_TOKEN".into());
    assert!(validate_prepared(&extra_credentials, &python, &adapter, &receipt, true).is_err());
}

#[test]
fn preparation_uses_bundled_resources_and_unique_receipts_without_enabling() {
    let Ok(python) = probe_python(None) else {
        eprintln!("skipping Codex preparation roundtrip: Python 3.10+ is unavailable");
        return;
    };
    let directory = crate::test_tempdir().unwrap();
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../integrations/codex_app_server/tests/fake_codex.py")
        .canonicalize()
        .unwrap();
    let options = PrepareCodexOptions {
        config_dir: directory.path().join("private"),
        python_bin: Some(python.clone()),
        codex_bin: Some(python),
        codex_args: vec!["-u".into(), fixture.to_string_lossy().into_owned()],
        expected_version: Some("0.167.0-fixture.1".into()),
        allow_network: false,
    };
    let first = prepare_codex(&options).unwrap();
    let original = std::fs::read(&first.receipt).unwrap();
    let second = prepare_codex(&PrepareCodexOptions {
        allow_network: true,
        ..options.clone()
    })
    .unwrap();
    assert_ne!(first.receipt, second.receipt);
    assert_eq!(std::fs::read(&first.receipt).unwrap(), original);
    assert_eq!(first.profile.args[0], second.profile.args[0]);
    assert!(Path::new(&first.profile.args[0]).is_absolute());
    assert!(!first.profile.args.iter().any(|arg| arg == "--network"));
    assert_eq!(
        second.profile.args.last().map(String::as_str),
        Some("--network")
    );
    assert!(!first.profile.enabled);
    assert!(!second.profile.enabled);
    assert!(!options.config_dir.join("runner.toml").exists());
    assert!(!options.config_dir.join("coding-agents.json").exists());
    let failure = prepare_codex(&PrepareCodexOptions {
        expected_version: Some("999".into()),
        ..options
    })
    .unwrap_err();
    assert_eq!(failure.code, "codex_version_mismatch");
    let receipts = std::fs::read_dir(Path::new(&first.receipt).parent().unwrap())
        .unwrap()
        .filter(|entry| {
            entry
                .as_ref()
                .unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with("codex-compatibility-")
        })
        .count();
    assert_eq!(
        receipts, 2,
        "failed preparation must discard only its own reserved slot"
    );
    assert_eq!(std::fs::read(&first.receipt).unwrap(), original);
}

#[test]
fn preparation_rejects_linked_receipt_without_changing_the_target() {
    let directory = crate::test_tempdir().unwrap();
    let private = directory.path().join("private");
    ensure_private_directory(&private).unwrap();
    let receipt = NewReceipt::reserve(&private).unwrap();
    assert!(read_private(&receipt.path).unwrap().is_empty());
    assert!(
        open_private(&receipt.path, true).is_err(),
        "the slot is reserved with create_new"
    );
    let target = directory.path().join("original.json");
    let mut file = open_private(&target, true).unwrap();
    file.write_all(b"original receipt\n").unwrap();
    drop(file);
    #[cfg(windows)]
    let owner = crate::storage::windows_path_owner(&target).unwrap();
    std::fs::remove_file(&receipt.path).unwrap();
    std::fs::hard_link(&target, &receipt.path).unwrap();
    assert_eq!(receipt.finish().unwrap_err().code, "state_io");
    #[cfg(windows)]
    assert_eq!(crate::storage::windows_path_owner(&target).unwrap(), owner);
    receipt.discard();
    assert!(!receipt.path.exists());
    assert_eq!(read_private(&target).unwrap(), b"original receipt\n");
}

#[test]
fn preparation_refuses_relative_configuration_before_installation() {
    let error = prepare_codex(&PrepareCodexOptions {
        config_dir: "relative-codex-config".into(),
        ..Default::default()
    })
    .unwrap_err();
    assert_eq!(error.code, "codex_prepare_failed");
}
