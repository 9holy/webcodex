use super::*;

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
    validate_prepared(&original, &python, &adapter, &receipt).unwrap();
    let mut enabled = original.clone();
    enabled.profile.enabled = true;
    assert!(validate_prepared(&enabled, &python, &adapter, &receipt).is_err());
    let mut retargeted = original.clone();
    retargeted.profile.args[0] = root.join("other.py").to_string_lossy().into_owned();
    assert!(validate_prepared(&retargeted, &python, &adapter, &receipt).is_err());
    let mut secret = original.clone();
    secret
        .profile
        .env_from_env
        .insert("OPENAI_API_KEY".into(), "private-test-token".into());
    let error = validate_prepared(&secret, &python, &adapter, &receipt).unwrap_err();
    assert!(!error.to_string().contains("private-test-token"));
    let mut widened = original;
    widened
        .profile
        .allowed_config_options
        .push("sandbox".into());
    assert!(validate_prepared(&widened, &python, &adapter, &receipt).is_err());
}

#[test]
fn preparation_uses_bundled_resources_and_unique_receipts_without_enabling() {
    let Ok(python) = probe_python(None) else {
        eprintln!("skipping Codex preparation roundtrip: Python 3.10+ is unavailable");
        return;
    };
    let directory = tempfile::tempdir().unwrap();
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../integrations/codex_app_server/tests/fake_codex.py")
        .canonicalize()
        .unwrap();
    let options = PrepareCodexOptions {
        config_dir: directory.path().join("private"),
        python_bin: Some(python.clone()),
        codex_bin: Some(python),
        codex_args: vec![fixture.to_string_lossy().into_owned()],
        expected_version: Some("0.167.0-fixture.1".into()),
    };
    let first = prepare_codex(&options).unwrap();
    let original = std::fs::read(&first.receipt).unwrap();
    let second = prepare_codex(&options).unwrap();
    assert_ne!(first.receipt, second.receipt);
    assert_eq!(std::fs::read(&first.receipt).unwrap(), original);
    assert_eq!(first.profile.args[0], second.profile.args[0]);
    assert!(Path::new(&first.profile.args[0]).is_absolute());
    assert!(!first.profile.enabled);
    assert!(!options.config_dir.join("runner.toml").exists());
    assert!(!options.config_dir.join("coding-agents.json").exists());
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
