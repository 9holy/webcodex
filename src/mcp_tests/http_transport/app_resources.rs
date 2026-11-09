//! Real HTTP/Audit coverage; neither static HTML nor caller payloads are retained.
use super::*;

fn resource_rows(db: &crate::Database) -> Vec<(String, String, i64, Value)> {
    let conn = db.conn_for_tests();
    let mut statement = conn.prepare(
        "SELECT operation, status, http_status, summary_json FROM action_events WHERE action_name = 'resourcesRead' ORDER BY rowid",
    ).unwrap();
    statement
        .query_map([], |row| {
            let summary: String = row.get(3)?;
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                serde_json::from_str(&summary).unwrap(),
            ))
        })
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap()
}

async fn read_resource(
    service: &Service,
    token: &str,
    uri: &str,
    id: Option<i64>,
    case: &str,
) -> (StatusCode, Option<Value>) {
    let version = if case == "protocol" {
        "2099-01-01"
    } else {
        MCP_STATELESS_PROTOCOL_VERSION
    };
    let mut params = mcp_2026_ui_params(json!({
        "uri": uri,
        "private_extension": "request-body-private-sentinel",
    }));
    params["_meta"]["io.modelcontextprotocol/protocolVersion"] = json!(version);
    if case == "window" {
        params["_meta"]["threadId"] = json!(" private-window-sentinel ");
    }
    let mut body = json!({"jsonrpc": "2.0", "method": "resources/read", "params": params});
    if let Some(id) = id {
        body["id"] = json!(id);
    }
    let mut request = TestClient::post("http://localhost/mcp")
        .bearer_auth(token)
        .add_header(MCP_PROTOCOL_VERSION_HEADER, version, true)
        .add_header(MCP_METHOD_HEADER, "resources/read", true)
        .add_header(MCP_NAME_HEADER, uri, true);
    if case == "policy" {
        request = request.add_header("x-webcodex-mcp-surface", "private-invalid-surface", true);
    }
    let mut response = request.json(&body).send(service).await;
    let status = effective_status(&response);
    let body = response.take_json::<Value>().await.ok();
    (status, body)
}

#[tokio::test]
async fn http_mcp_app_resource_versions_are_audited_without_payloads() {
    let (_tmp, db) = test_db();
    let service = Service::new(build_test_router(
        test_config(Some("credential-private-sentinel")),
        db.clone(),
        // Goal Plan is an optional workflow surface, independent of Apps being on.
        Arc::new(with_workflow_tools(test_runtime_with_mcp_settings(
            true, true,
        ))),
    ));
    for (uri, current) in [
        (
            MCP_WORK_RESULT_UI_RESOURCE_URI,
            MCP_WORK_RESULT_UI_RESOURCE_URI,
        ),
        (MCP_WORKBENCH_UI_RESOURCE_URI, MCP_WORKBENCH_UI_RESOURCE_URI),
        (MCP_GOAL_PLAN_UI_RESOURCE_URI, MCP_GOAL_PLAN_UI_RESOURCE_URI),
        (
            "ui://webcodex/work-result/v1",
            MCP_WORK_RESULT_UI_RESOURCE_URI,
        ),
    ] {
        let (status, body) = read_resource(
            &service,
            "credential-private-sentinel",
            uri,
            Some(1),
            "normal",
        )
        .await;
        let body = body.unwrap();
        let registered = uri == current;
        assert_eq!(
            status,
            if registered {
                StatusCode::OK
            } else {
                StatusCode::BAD_REQUEST
            },
            "{body}"
        );
        if registered {
            assert_eq!(body["result"]["contents"][0]["uri"], uri);
        } else {
            assert_eq!(body["error"]["code"], -32602);
            assert!(
                body.get("result").is_none(),
                "diagnostic classification must not serve an alias"
            );
        }
        let rows = resource_rows(&db);
        let (operation, state, http_status, summary) = rows.last().unwrap();
        assert_eq!(operation, "mcp_app_resource_read");
        assert_eq!(state, if registered { "success" } else { "failed" });
        assert_eq!(*http_status, i64::from(status.as_u16()));
        assert_eq!(summary["resource_uri"], uri);
        assert_eq!(summary["current_resource_uri"], current);
        assert_eq!(summary["resource_registered"], registered);
        assert_eq!(summary["outcome_stage"], "response");
        assert_eq!(
            summary["mcp_error_code"],
            if registered {
                Value::Null
            } else {
                json!(-32602)
            }
        );
        assert_eq!(summary.as_object().unwrap().len(), 9);
        let serialized = summary.to_string();
        for private in [
            "private-sentinel",
            "<script",
            "content_base64",
            "hostContext",
            "private_extension",
        ] {
            assert!(!serialized.contains(private), "{serialized}");
        }
    }
    assert_eq!(resource_rows(&db).len(), 4, "one event per dispatched read");
}

#[tokio::test]
async fn http_mcp_app_resource_rejection_stages_are_audited() {
    for (case, stage, expected_code) in [
        ("disabled", "response", -32602),
        ("surface", "response", -32602),
        (
            "protocol",
            "protocol_error",
            MCP_UNSUPPORTED_PROTOCOL_VERSION,
        ),
        ("policy", "request_policy_error", -32600),
        ("window", "client_window_error", -32600),
    ] {
        let (_tmp, db) = test_db();
        let service = Service::new(build_test_router(
            test_config(Some("secret")),
            db.clone(),
            Arc::new(test_runtime_with_mcp_settings(true, case != "disabled")),
        ));
        let uri = if case == "surface" {
            MCP_GOAL_PLAN_UI_RESOURCE_URI
        } else {
            MCP_WORK_RESULT_UI_RESOURCE_URI
        };
        let (status, body) = read_resource(&service, "secret", uri, Some(2), case).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{case}: {body:?}");
        assert_eq!(body.unwrap()["error"]["code"], expected_code);
        let rows = resource_rows(&db);
        assert_eq!(rows.len(), 1, "{case}");
        assert_eq!(rows[0].1, "failed");
        assert_eq!(rows[0].3["mcp_error_code"], expected_code);
        assert_eq!(rows[0].3["outcome_stage"], stage);
        assert!(!rows[0].3.to_string().contains("private"));
    }
}

#[tokio::test]
async fn http_mcp_app_resource_scope_denial_still_requires_authorization() {
    let (_tmp, db) = test_db();
    let user = seed_user(&db, "resource-audit-user");
    let client = seed_oauth_client(&db, &user);
    let token = seed_oauth_access_token(&db, &client, &user, "project:read");
    let service = Service::new(build_test_router(
        test_config_oauth2(Some("secret")),
        db.clone(),
        Arc::new(test_runtime_with_mcp_settings(true, true)),
    ));
    let (status, body) = read_resource(
        &service,
        &token,
        MCP_WORK_RESULT_UI_RESOURCE_URI,
        Some(3),
        "normal",
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body:?}");
    assert_eq!(body.unwrap()["error"], "insufficient_scope");
    let rows = resource_rows(&db);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].2, 403);
    assert_eq!(rows[0].1, "failed");
    assert_eq!(rows[0].3["resource_registered"], true);
    assert!(!rows[0].3.to_string().contains(&token));
}

#[tokio::test]
async fn http_mcp_app_resource_audit_excludes_arbitrary_uris_and_notifications() {
    let (_tmp, db) = test_db();
    let service = Service::new(build_test_router(
        test_config(Some("secret")),
        db.clone(),
        Arc::new(test_runtime_with_mcp_settings(true, true)),
    ));
    for uri in [
        "ui://webcodex/work-result/v1?token=private-sentinel",
        "ui://webcodex/private-sentinel/v1",
        "file:///private-sentinel",
    ] {
        let (status, _) = read_resource(&service, "secret", uri, Some(4), "normal").await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }
    let (status, _) = read_resource(
        &service,
        "secret",
        MCP_WORK_RESULT_UI_RESOURCE_URI,
        None,
        "normal",
    )
    .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    assert!(resource_rows(&db).is_empty());
}
