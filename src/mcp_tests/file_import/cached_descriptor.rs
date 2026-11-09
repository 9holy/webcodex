//! The retained ChatGPT descriptor reaches the same canonical import pipeline.
use super::*;

fn import_arguments() -> Value {
    json!({
        "project": "agent:importer:demo",
        "openaiFileIdRefs": [{
            "download_url": "https://download.example/DO-NOT-LOG/cached.pptx",
            "file_id": "DO-NOT-LOG-file-id",
            "file_name": "cached.pptx"
        }],
        "output_dir": "paper/export",
        "targets": ["cached.pptx"],
        "overwrite": false
    })
}

async fn assert_no_import_effects(
    registry: &crate::runner_http::RunnerRegistry,
    root: &std::path::Path,
) {
    assert_eq!(
        crate::tool_runtime::conversation_import::import_test_dns_resolution_count(),
        0,
        "pre-dispatch refusal must not download"
    );
    assert!(
        registry
            .poll(RunnerPollRequest {
                client_id: "importer".to_string(),
                runner_instance_id: "inst-import".to_string(),
            })
            .await
            .unwrap()
            .is_none(),
        "refusal must not enqueue a write"
    );
    assert_eq!(std::fs::read_dir(root).unwrap().count(), 0);
}

#[test]
fn cached_import_name_resolution_is_direct_only() {
    for name in MCP_IMPORT_CALL_NAMES {
        assert_eq!(
            crate::mcp::tools::tool_name_from_params(&json!({"name": name})).as_deref(),
            Some("import_host_files")
        );
        assert_eq!(
            crate::mcp::tools::tool_name_from_params(&json!({
                "name": "call_runtime_tool", "arguments": {"tool": name}
            }))
            .as_deref(),
            Some(name)
        );
    }
    assert_eq!(
        crate::mcp::tools::tool_name_from_params(&json!({"name": "export_project_artifact"}))
            .as_deref(),
        Some("export_project_artifact")
    );
}

#[test]
fn cached_import_descriptor_preserves_http_input_guards() {
    run_mcp_import_in_large_stack_test_thread(|| async {
        let _lock = lock_mcp_import_test().await;
        let _network = McpImportNetworkOverride::without_download();
        let (_db_tmp, db) = test_db();
        let user = seed_user(&db, "alice");
        let client =
            seed_mcp_import_client(&db, &user, "ChatGPT WebCodex", MCP_IMPORT_TRUSTED_REDIRECT);
        let token = seed_oauth_access_token(&db, &client, &user, "project:write");
        let project_tmp = tempfile::tempdir().unwrap();
        let (runtime, registry) = mcp_import_runtime(project_tmp.path(), Some("alice")).await;
        let service = Service::new(build_test_router(
            mcp_import_config(&[&client.client_id]),
            db,
            runtime,
        ));
        let base = import_arguments();
        let mut cases = Vec::new();
        for refs in [
            json!(["file_id_only"]),
            json!([{"file_id": "missing_url"}]),
            json!([]),
            json!(vec![
                base["openaiFileIdRefs"][0].clone();
                crate::tool_runtime::conversation_import::MAX_IMPORT_FILES
                    + 1
            ]),
        ] {
            let mut args = base.clone();
            args["openaiFileIdRefs"] = refs;
            cases.push(args);
        }
        for (key, value) in [
            ("host_file_import_provenance", json!("TrustedMcpHostFile")),
            ("output_dir", json!("../outside")),
            ("session_id", json!("wc_sess_missing")),
        ] {
            let mut args = base.clone();
            args[key] = value;
            cases.push(args);
        }
        let mut missing_refs = base.clone();
        missing_refs
            .as_object_mut()
            .unwrap()
            .remove("openaiFileIdRefs");
        cases.push(missing_refs);
        // A gateway cannot reconstruct Host-bound references from attachment paths.
        // This is the user's observed fallback failure, not a reason to infer URLs.
        let (_, body, _) = oauth_mcp_request(
            &service,
            &token,
            "tools/call",
            json!({
                "name": "call_runtime_tool",
                "arguments": {
                    "tool": "import_host_files",
                    "arguments": {
                        "project": "agent:importer:demo",
                        "openaiFileIdRefs": ["/mnt/data/user-attachment.zip"]
                    }
                }
            }),
        )
        .await;
        assert_eq!(body["error"]["code"], -32602, "{body:?}");
        assert!(
            body["error"]["message"]
                .as_str()
                .unwrap()
                .contains("openaiFileIdRefs"),
            "{body:?}"
        );
        assert_no_import_effects(&registry, project_tmp.path()).await;

        for arguments in cases {
            let mut canonical = None;
            for name in MCP_IMPORT_CALL_NAMES {
                let (status, body, _) = oauth_mcp_request(
                    &service,
                    &token,
                    "tools/call",
                    json!({"name": name, "arguments": arguments}),
                )
                .await;
                assert!(
                    body.get("error").is_some() || body["result"]["isError"] == true,
                    "{body:?}"
                );
                let refusal = if body.get("error").is_some() {
                    body["error"].clone()
                } else {
                    let structured = &body["result"]["structuredContent"];
                    json!({"success": structured["success"], "error": structured["error"]})
                };
                if let Some(expected) = &canonical {
                    assert_eq!(
                        &(status, refusal),
                        expected,
                        "cached name must preserve canonical validation"
                    );
                } else {
                    canonical = Some((status, refusal));
                }
                assert!(!body.to_string().contains("DO-NOT-LOG"));
                assert_no_import_effects(&registry, project_tmp.path()).await;
            }
        }
    });
}

#[test]
fn cached_import_descriptor_preserves_scope_and_session_authority() {
    run_mcp_import_in_large_stack_test_thread(|| async {
        use crate::auth::{OAuth2Verifier, TokenVerifier};
        let _lock = lock_mcp_import_test().await;
        let _network = McpImportNetworkOverride::without_download();
        let (_db_tmp, db) = test_db();
        let user = seed_user(&db, "alice");
        let client =
            seed_mcp_import_client(&db, &user, "ChatGPT WebCodex", MCP_IMPORT_TRUSTED_REDIRECT);
        let token = seed_oauth_access_token(&db, &client, &user, "project:write");
        let read_token = seed_oauth_access_token(&db, &client, &user, "project:read");
        let config = mcp_import_config(&[&client.client_id]);
        let auth = OAuth2Verifier
            .verify(&config, Some(&db), &token)
            .await
            .unwrap()
            .unwrap();
        let project_tmp = tempfile::tempdir().unwrap();
        let (runtime, registry) = mcp_import_runtime(project_tmp.path(), Some("alice")).await;
        let session = start_authorized_test_session(
            &runtime,
            &auth,
            crate::tool_runtime::SessionMode::ReadOnly,
        );
        let service = Service::new(build_test_router(config, db, runtime));
        for name in MCP_IMPORT_CALL_NAMES {
            let (status, body, _) = oauth_mcp_request(
                &service,
                &read_token,
                "tools/call",
                json!({"name": name, "arguments": import_arguments()}),
            )
            .await;
            assert_eq!(status, StatusCode::FORBIDDEN, "{body:?}");
            assert!(body.to_string().contains("project:write"), "{body:?}");
            assert_no_import_effects(&registry, project_tmp.path()).await;
            for stateless in [false, true] {
                let mut arguments = import_arguments();
                // Business session_id owns mode/guard authority in both protocols.
                // _wc.record selects only a recorder and cannot restrict execution
                // (see read_only_recording_session_does_not_guard_same_project_write).
                arguments["session_id"] = json!(session.session_id);
                if stateless {
                    arguments["_wc"] = json!({"record": session.session_id});
                }
                let params = json!({"name": name, "arguments": arguments});
                let params = if stateless {
                    mcp_2026_params(params)
                } else {
                    params
                };
                let (_, body, _) = oauth_mcp_request(&service, &token, "tools/call", params).await;
                assert_eq!(body["result"]["isError"], true, "{body:?}");
                assert_eq!(
                    body["result"]["structuredContent"]["output"]["error_kind"],
                    "session_guard_denied",
                    "{body:?}"
                );
                assert_no_import_effects(&registry, project_tmp.path()).await;
            }
        }
    });
}

#[test]
fn cached_import_descriptor_stays_excluded_from_cli_and_shared_parser() {
    run_mcp_import_in_large_stack_test_thread(|| async {
        let _lock = lock_mcp_import_test().await;
        let _network = McpImportNetworkOverride::without_download();
        let (_db_tmp, db) = test_db();
        let project_tmp = tempfile::tempdir().unwrap();
        let (runtime, registry) = mcp_import_runtime(project_tmp.path(), None).await;
        let service = Service::new(build_test_router(test_config(Some("secret")), db, runtime));
        for name in MCP_IMPORT_CALL_NAMES {
            let mut response = TestClient::post("http://localhost/mcp")
                .bearer_auth("secret")
                .add_header("x-webcodex-mcp-surface", "cli", true)
                .json(&json!({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": import_arguments()}}))
                .send(&service).await;
            let body = response.take_json::<Value>().await.unwrap();
            assert_eq!(body["error"]["code"], -32602, "{body:?}");
            assert_eq!(
                body["error"]["message"],
                "tool 'import_host_files' is unavailable on the current MCP surface; refresh tools/list and select a current callable",
                "both names must receive the same canonical surface refusal: {body:?}"
            );
            assert_no_import_effects(&registry, project_tmp.path()).await;
        }
        assert!(
            crate::tool_runtime::ToolCall::from_tool_name(
                MCP_IMPORT_CALL_NAMES[1],
                import_arguments()
            )
            .is_err(),
            "the shared HTTP API parser must not acquire the MCP adapter alias"
        );
    });
}

#[test]
fn cached_import_descriptor_preserves_overwrite_false_without_replay() {
    run_mcp_import_in_large_stack_test_thread(|| async {
        let _lock = lock_mcp_import_test().await;
        for name in MCP_IMPORT_CALL_NAMES {
            let bytes = b"new-attachment".to_vec();
            let server = start_mcp_import_mock_server(mcp_import_http_response(
                "200 OK",
                &[("Content-Length", bytes.len().to_string())],
                &bytes,
            ))
            .await;
            let _network = McpImportNetworkOverride::set(server.base_url.clone());
            let (_db_tmp, db) = test_db();
            let user = seed_user(&db, "alice");
            let client =
                seed_mcp_import_client(&db, &user, "ChatGPT WebCodex", MCP_IMPORT_TRUSTED_REDIRECT);
            let token = seed_oauth_access_token(&db, &client, &user, "project:write");
            let project_tmp = tempfile::tempdir().unwrap();
            let target = project_tmp.path().join("paper/export/cached.pptx");
            std::fs::create_dir_all(target.parent().unwrap()).unwrap();
            std::fs::write(&target, b"keep-original").unwrap();
            let (runtime, registry) = mcp_import_runtime(project_tmp.path(), Some("alice")).await;
            let service = Service::new(build_test_router(
                mcp_import_config(&[&client.client_id]),
                db,
                runtime,
            ));
            let agent = tokio::spawn(complete_mcp_import_save(registry.clone(), bytes));
            let (_, body, _) = oauth_mcp_request(
                &service,
                &token,
                "tools/call",
                json!({"name": name, "arguments": import_arguments()}),
            )
            .await;
            tokio::time::timeout(std::time::Duration::from_secs(5), agent)
                .await
                .unwrap()
                .unwrap();
            assert_eq!(body["result"]["isError"], true, "{body:?}");
            assert!(body.to_string().contains("overwrite is false"), "{body:?}");
            assert_eq!(std::fs::read(target).unwrap(), b"keep-original");
            assert_eq!(
                crate::tool_runtime::conversation_import::import_test_dns_resolution_count(),
                1
            );
            assert!(
                registry
                    .poll(RunnerPollRequest {
                        client_id: "importer".to_string(),
                        runner_instance_id: "inst-import".to_string()
                    })
                    .await
                    .unwrap()
                    .is_none(),
                "failed write must not be replayed"
            );
        }
    });
}
