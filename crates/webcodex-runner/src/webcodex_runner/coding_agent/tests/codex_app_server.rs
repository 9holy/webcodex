//! Real Runner -> bundled ACP adapter -> app-server stdio fixture roundtrip.
//! The fixture performs a file effect only inside the exact admitted Project.

use super::*;

#[test]
fn codex_app_server_adapter_completes_real_runner_roundtrip() {
    let Ok(python) = webcodex_environment::codex_app_server::probe_python(None) else {
        eprintln!("skipping Codex app-server roundtrip: Python 3.10+ is unavailable");
        return;
    };
    let executable = python.to_string_lossy().into_owned();
    let temp = crate::tests::executable_tempdir();
    let directory = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../integrations/codex_app_server")
        .canonicalize()
        .unwrap();
    let adapter = directory.join("adapter.py");
    let fixture = directory.join("tests/fake_codex.py");
    let receipt = temp.path().join("codex-compatibility.json");
    let prepared = Command::new(&executable)
        .arg(&adapter)
        .args(["prepare", "--experimental", "--codex-bin"])
        .arg(&executable)
        .arg("--codex-arg")
        .arg(&fixture)
        .arg("--receipt")
        .arg(&receipt)
        .env("FAKE_CODEX_VERSION", "0.167.0-fixture.1")
        .env_remove("FAKE_CODEX_SCHEMA")
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(
        prepared.status.success(),
        "bounded fixture preparation failed"
    );
    let mut config = fake_config(
        executable,
        vec![
            adapter.to_string_lossy().into_owned(),
            "serve".into(),
            "--experimental".into(),
            "--receipt".into(),
            receipt.to_string_lossy().into_owned(),
        ],
    );
    config.agents[0].allowed_config_options.clear();
    #[cfg(windows)]
    // Match the prepared profile's explicit Windows OS environment without
    // inheriting unrelated configuration or credentials into the fixture.
    config.agents[0]
        .env_from_env
        .insert("SystemRoot".into(), "SystemRoot".into());
    let projects = project_fixture(&temp);
    let root = temp.path().join("repo");
    let manager = CodingAgentManager::with_store(&config, temp.path().join("store")).unwrap();
    let run = "wc_agent_run_codexappserver0001";
    let request = start_request(&manager, &root, run, BTreeMap::new());
    let response = manager.handle(request, &projects);
    assert!(response.error.is_none(), "{:?}", response.error);
    let observation = wait_for_terminal_observation(&manager, run);
    assert_eq!(
        observation.run.state,
        CodingAgentRunState::Completed,
        "run error code: {:?}",
        observation
            .run
            .terminal
            .as_ref()
            .and_then(|terminal| terminal.error_code.as_deref())
    );
    assert!(observation.events.iter().any(|event| {
        event.kind == CodingAgentEventKind::AgentMessage && event.text.as_deref() == Some("完成 🌎")
    }));
    assert!(observation
        .events
        .iter()
        .any(|event| event.kind == CodingAgentEventKind::TerminalActivity));
    assert_eq!(
        fs::read_to_string(root.join("native-result.txt")).unwrap(),
        "actual fixture execution\n"
    );
    assert!(!temp.path().join("native-result.txt").exists());
}
