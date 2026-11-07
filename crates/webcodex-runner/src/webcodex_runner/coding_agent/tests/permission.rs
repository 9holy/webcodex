use super::*;
use webcodex_core::coding_agent::{
    CodingAgentPendingPermission, CodingAgentPermissionDecision, CodingAgentPermissionOutcome,
    CodingAgentRespondPermissionRequest, CODING_AGENT_MAX_PERMISSION_DETAILS_BYTES,
};

fn waiting_fixture_scenario(
    scenario: &str,
) -> (
    TempDir,
    Arc<CodingAgentManager>,
    PathBuf,
    PathBuf,
    String,
    AcpConfig,
) {
    let temp = crate::tests::executable_tempdir();
    let (exe, args) = fake_agent(&temp, scenario);
    let mut config = fake_config(exe, args);
    config.permission_timeout_secs = 30;
    let projects = project_fixture(&temp);
    let root = temp.path().join("repo");
    let manager = CodingAgentManager::with_store(&config, temp.path().join("store")).unwrap();
    let run = "wc_agent_run_permission".to_string();
    assert!(manager
        .handle(
            start_request(&manager, &root, &run, BTreeMap::new()),
            &projects
        )
        .error
        .is_none());
    (temp, manager, projects, root, run, config)
}

fn waiting_fixture() -> (
    TempDir,
    Arc<CodingAgentManager>,
    PathBuf,
    PathBuf,
    String,
    AcpConfig,
) {
    waiting_fixture_scenario("permission_select")
}

fn wait_pending(manager: &CodingAgentManager, run: &str) -> CodingAgentPendingPermission {
    let deadline = Instant::now() + Duration::from_secs(4);
    loop {
        let entry = manager.runs.lock().unwrap().get(run).cloned().unwrap();
        let observation = entry.observe(None, 64, 0).unwrap();
        if let Some(pending) = observation.pending_permission {
            return pending;
        }
        assert!(!observation.run.state.terminal(), "{:?}", observation.run);
        assert!(
            Instant::now() < deadline,
            "permission never became observable"
        );
        thread::sleep(Duration::from_millis(5));
    }
}

fn response_request(
    manager: &CodingAgentManager,
    run: &str,
    root: &Path,
    pending: &CodingAgentPendingPermission,
    option: Option<&str>,
) -> CodingAgentRequest {
    let snapshot = manager.runs.lock().unwrap().get(run).unwrap().snapshot();
    CodingAgentRequest::RespondPermission(CodingAgentRespondPermissionRequest {
        run_id: run.to_owned(),
        request_id: pending.request_id.clone(),
        decision: option
            .map(|id| CodingAgentPermissionDecision {
                outcome: CodingAgentPermissionOutcome::Selected,
                option_id: Some(id.to_owned()),
            })
            .unwrap_or_else(CodingAgentPermissionDecision::cancelled),
        authority_fingerprint: snapshot.authority_fingerprint,
        runtime_project_id: snapshot.runtime_project_id,
        project_root: root.to_string_lossy().into_owned(),
        provider_id: snapshot.provider_id,
        provider_instance_id: snapshot.provider_instance_id,
    })
}

fn permission_replies(temp: &TempDir) -> Vec<Value> {
    wire_log(temp)
        .into_iter()
        .filter_map(|entry| {
            let response = entry.get("recv")?;
            (response.get("id").and_then(Value::as_u64) == Some(99)
                || response.get("id").and_then(Value::as_str) == Some("private-permission-99"))
            .then(|| response.clone())
        })
        .collect()
}

#[test]
fn explicit_permission_selection_reaches_provider_once_and_recovers_without_replay() {
    for (scenario, option) in [
        ("permission_select", Some("allow")),
        ("permission_select", Some("reject")),
        ("permission_select", None),
        ("permission_select_string", Some("allow")),
    ] {
        let (temp, manager, projects, root, run, config) = waiting_fixture_scenario(scenario);
        let pending = wait_pending(&manager, &run);
        // The executable fixture root may retain `../..` components, while
        // the provider's getcwd() returns the canonical path. Verify the
        // complete displayed action, including that exact resolved cwd.
        assert_eq!(
            pending.details,
            format!(
                "command: inspect\ncwd: {}\n",
                root.canonicalize().unwrap().display()
            )
        );
        assert_eq!(pending.options.len(), 2);
        assert!(!serde_json::to_string(&pending)
            .unwrap()
            .contains("sessionId"));
        let request = response_request(&manager, &run, &root, &pending, option);
        // Exact concurrent retries consume one callback. Each response is a
        // receipt, never another provider selection or another prompt.
        let replies = (0..4)
            .map(|_| {
                let manager = Arc::clone(&manager);
                let request = request.clone();
                let projects = projects.clone();
                thread::spawn(move || manager.handle(request, &projects))
            })
            .collect::<Vec<_>>();
        for reply in replies {
            assert!(reply.join().unwrap().error.is_none());
        }
        let terminal = wait_for_terminal_observation(&manager, &run);
        assert_eq!(
            terminal.run.state,
            if option == Some("allow") {
                CodingAgentRunState::Completed
            } else {
                CodingAgentRunState::Cancelled
            }
        );
        assert!(terminal.pending_permission.is_none());
        let replies = permission_replies(&temp);
        assert_eq!(replies.len(), 1, "{replies:?}");
        assert_eq!(
            replies[0]["result"]["outcome"],
            option
                .map(|option| json!({"outcome":"selected","optionId":option}))
                .unwrap_or_else(|| json!({"outcome":"cancelled"}))
        );
        assert_eq!(prompt_count(&temp), 1);
        assert!(manager.handle(request.clone(), &projects).error.is_none());
        let mut changed = request.clone();
        let CodingAgentRequest::RespondPermission(changed) = &mut changed else {
            unreachable!()
        };
        changed.decision = if option.is_some() {
            CodingAgentPermissionDecision::cancelled()
        } else {
            CodingAgentPermissionDecision {
                outcome: CodingAgentPermissionOutcome::Selected,
                option_id: Some("allow".into()),
            }
        };
        assert_eq!(
            manager
                .handle(
                    CodingAgentRequest::RespondPermission(changed.clone()),
                    &projects
                )
                .error
                .unwrap()
                .code,
            "coding_agent_permission_response_conflict"
        );
        let durable = fs::read_to_string(manager.store.state_path(&run)).unwrap();
        assert!(!durable.contains(&pending.request_id));
        assert!(!durable.contains("command: inspect"));
        // Restart retains only Run certainty. Neither a pending callback nor
        // its accepted decision is reconstructed into new executable work.
        let recovered = CodingAgentManager::with_store(&config, temp.path().join("store")).unwrap();
        assert!(recovered.handle(request, &projects).error.is_some());
        assert_eq!(prompt_count(&temp), 1);
        assert_eq!(permission_replies(&temp).len(), 1);
    }
}

#[test]
fn permission_response_rejects_foreign_identity_unknown_option_and_stale_callback() {
    let (temp, manager, projects, root, run, _) = waiting_fixture();
    let pending = wait_pending(&manager, &run);
    let request = response_request(&manager, &run, &root, &pending, Some("allow"));
    let entry = manager.runs.lock().unwrap().get(&run).cloned().unwrap();
    {
        let _gate = entry.prompt_dispatch.lock().unwrap();
        assert_eq!(
            entry.take_permission_decision("wc_agent_permission_other", true, true),
            CodingAgentPermissionDecision::cancelled()
        );
    }
    assert_eq!(wait_pending(&manager, &run).request_id, pending.request_id);
    for change in 0..6 {
        let mut wrong = request.clone();
        let CodingAgentRequest::RespondPermission(value) = &mut wrong else {
            unreachable!()
        };
        match change {
            0 => value.authority_fingerprint = "auth_foreign".into(),
            1 => value.runtime_project_id = "agent:test:other".into(),
            2 => value.provider_instance_id = "replaced".into(),
            3 => value.project_root = temp.path().to_string_lossy().into_owned(),
            4 => value.request_id = "wc_agent_permission_stale".into(),
            _ => value.decision.option_id = Some("not-advertised".into()),
        }
        assert!(manager.handle(wrong, &projects).error.is_some());
        assert_eq!(wait_pending(&manager, &run).request_id, pending.request_id);
    }
    // A current read-only Project cannot authorize the response to an older Run.
    fs::write(
        projects.join("p.toml"),
        format!(
            "id = \"demo\"\npath = {:?}\nallow_patch = false\n",
            root.to_string_lossy()
        ),
    )
    .unwrap();
    assert_eq!(
        manager.handle(request, &projects).error.unwrap().code,
        "stale_coding_agent_permission"
    );
    manager.handle(
        CodingAgentRequest::Cancel(CodingAgentCancelRequest {
            run_id: run.clone(),
        }),
        &projects,
    );
    let terminal = wait_for_terminal_observation(&manager, &run);
    assert_eq!(terminal.run.state, CodingAgentRunState::Cancelled);
    assert_eq!(
        permission_replies(&temp)[0]["result"]["outcome"]["outcome"],
        "cancelled"
    );
}

#[test]
fn cancelled_and_expired_permissions_never_select_allow() {
    for cancel in [false, true] {
        let (temp, manager, projects, root, run, _) = waiting_fixture();
        let pending = wait_pending(&manager, &run);
        let request = response_request(&manager, &run, &root, &pending, Some("allow"));
        let entry = manager.runs.lock().unwrap().get(&run).cloned().unwrap();
        if cancel {
            manager.handle(
                CodingAgentRequest::Cancel(CodingAgentCancelRequest {
                    run_id: run.clone(),
                }),
                &projects,
            );
        } else {
            let mut state = entry.state.lock().unwrap();
            state.permissions.pending.as_mut().unwrap().deadline = Instant::now();
            entry.changed.notify_all();
        }
        assert!(manager.handle(request, &projects).error.is_some());
        assert_eq!(
            wait_for_terminal_observation(&manager, &run).run.state,
            CodingAgentRunState::Cancelled
        );
        assert_eq!(
            permission_replies(&temp)[0]["result"]["outcome"],
            json!({"outcome":"cancelled"})
        );
        assert_eq!(prompt_count(&temp), 1);
    }
}

#[test]
fn permission_normalization_refuses_incomplete_oversized_and_cross_session_details() {
    let mut params = json!({"sessionId":"private", "toolCall":{"title":"Run", "content":[{"type":"content","content":{"type":"text","text":"command: inspect\ncwd: /project"}}]}, "options":[{"optionId":"allow","name":"Allow once","kind":"allow_once"}]});
    let normalize = |value: &Value| {
        super::super::permission::normalize_permission(
            value,
            "private",
            Instant::now() + Duration::from_secs(1),
        )
    };
    assert!(normalize(&params).is_ok());
    params["sessionId"] = json!("different");
    assert!(normalize(&params).is_err());
    params["sessionId"] = json!("private");
    params["toolCall"]["content"][0]["content"]["text"] =
        json!("x".repeat(CODING_AGENT_MAX_PERMISSION_DETAILS_BYTES + 1));
    assert!(normalize(&params).is_err());
    params["toolCall"]["content"] = json!([]);
    params["toolCall"]["rawInput"] = json!({"command":"hidden-action"});
    assert!(normalize(&params).is_err());
}

#[test]
fn callback_ids_round_trip_privately_without_coercion_and_remain_bounded() {
    use super::super::protocol::{result_frame, AcpCallbackId};
    for id in [json!(99), json!(-1), json!("private-permission-id")] {
        let callback = AcpCallbackId::from_value(&id).unwrap();
        let frame: Value = serde_json::from_slice(
            &result_frame(&callback, json!({"outcome":{"outcome":"cancelled"}})).unwrap(),
        )
        .unwrap();
        assert_eq!(frame["id"], id);
    }
    for id in [
        json!(null),
        json!(true),
        json!(1.5),
        json!(""),
        json!("x".repeat(129)),
        json!("line\nbreak"),
    ] {
        assert!(AcpCallbackId::from_value(&id).is_none());
    }
}
