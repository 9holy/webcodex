//! Real Runner -> bundled ACP adapter -> app-server stdio fixture roundtrip.
//! The fixture performs a file effect only inside the exact admitted Project.

use super::*;

#[test]
fn codex_app_server_adapter_completes_real_runner_roundtrip() {
    let Ok(python) = Command::new("python3")
        .args([
            "-I",
            "-c",
            "import sys; assert sys.version_info >= (3,10); print(sys.executable)",
        ])
        .stdin(Stdio::null())
        .output()
    else {
        eprintln!("skipping Codex app-server roundtrip: Python 3.10+ is unavailable");
        return;
    };
    if !python.status.success() {
        eprintln!("skipping Codex app-server roundtrip: Python 3.10+ is unavailable");
        return;
    }
    let executable = String::from_utf8(python.stdout).unwrap().trim().to_string();
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
    let projects = project_fixture(&temp);
    let root = temp.path().join("repo");
    let manager = CodingAgentManager::with_store(&config, temp.path().join("store")).unwrap();
    let run = "wc_agent_run_codexappserver0001";
    let request = start_request(&manager, &root, run, BTreeMap::new());
    let response = manager.handle(request, &projects);
    assert!(response.error.is_none(), "{:?}", response.error);
    let observation = wait_for_terminal_observation(&manager, run);
    assert_eq!(observation.run.state, CodingAgentRunState::Completed);
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
