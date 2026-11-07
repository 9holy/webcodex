use super::*;

fn approval_service(auth: AuthContext) -> Service {
    Service::new(
        Router::new()
            .hoop(affix_state::inject(test_runtime()))
            .hoop(affix_state::inject(auth))
            .push(
                Router::with_path("api/runtime-console/coding-agent-runs")
                    .post(crate::runtime_console_http::coding_agents::list),
            ),
    )
}

#[tokio::test]
async fn coding_agent_operator_route_requires_independent_scope_and_closed_input() {
    let url = "http://localhost/api/runtime-console/coding-agent-runs";
    let denied = approval_service(scoped_oauth(&[SCOPE_RUNTIME_READ, SCOPE_PROJECT_READ]));
    let mut response = TestClient::post(url)
        .json(&json!(false))
        .send(&denied)
        .await;
    assert_eq!(response.status_code, Some(StatusCode::FORBIDDEN));
    assert_eq!(
        response.take_json::<Value>().await.unwrap()["error"],
        "Coding Agent access required"
    );

    let service = approval_service(scoped_oauth(&[crate::auth::SCOPE_CODING_AGENT_RUN]));
    for input in [
        json!(false),
        json!({"owner":"somebody"}),
        json!({"run_id":"foreign"}),
        json!({"limit":999999}),
    ] {
        let response = TestClient::post(url).json(&input).send(&service).await;
        assert_eq!(response.status_code, Some(StatusCode::BAD_REQUEST));
    }
    let mut response = TestClient::post(url).json(&json!({})).send(&service).await;
    assert_eq!(response.status_code, Some(StatusCode::OK));
    assert_eq!(
        response.take_json::<Value>().await.unwrap(),
        json!({
            "runs":[],"authorization":{"can_run":true,"can_approve":false},"truncated":false
        })
    );

    let response = TestClient::post(url)
        .add_header("Origin", "https://other.example", true)
        .json(&json!({}))
        .send(&service)
        .await;
    assert_eq!(response.status_code, Some(StatusCode::FORBIDDEN));
}

#[test]
fn coding_agent_operator_inventory_metadata_does_not_inherit_runtime_read() {
    assert_eq!(
        crate::route_metadata::spec(crate::route_metadata::RouteId::RuntimeConsoleCodingAgentRuns)
            .scope_policy,
        webcodex_core::authority::OAuthRouteScopePolicy::Require(
            crate::auth::SCOPE_CODING_AGENT_RUN
        ),
    );
}
