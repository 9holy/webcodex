mod support;
use serde_json::json;
use support::*;
use webcodex_openai_tunnel::policy::{DeadlinePolicy, Limits};

#[tokio::test]
async fn initial_poll_uses_short_wait_then_returns_to_normal_long_poll() {
    let mut cp = Server::new().await;
    let mcp = Server::new().await;
    let client = client(&cp, &mcp, Limits::default(), DeadlinePolicy::default());
    let health = client.health();
    let (stop, task) = start(client);

    let first = cp.next().await;
    assert_eq!(first.method, "GET");
    assert!(
        first.path.ends_with("/poll?limit=8&timeout_ms=1000"),
        "{}",
        first.path
    );
    assert!(
        !health.is_ready(),
        "a request in flight is not proof of a successful poll"
    );
    // Simulate a service-held successful empty poll without any real network.
    tokio::time::sleep(std::time::Duration::from_millis(65)).await;
    first.respond(204, "");

    let second = cp.next().await;
    assert!(
        health.is_ready(),
        "a successful empty poll establishes readiness"
    );
    let (attempts, request_ms) = health.initial_poll_details().unwrap();
    assert_eq!(attempts, 1);
    assert!(
        request_ms >= 50,
        "HTTP wait was not measured: {request_ms}ms"
    );
    assert!(request_ms <= health.initial_poll_ms().unwrap());
    assert!(
        second.path.ends_with("/poll?limit=8&timeout_ms=15000"),
        "{}",
        second.path
    );
    second.respond(204, "");
    assert_eq!(finish(stop, task).await, Ok(()));
}

#[tokio::test]
async fn transient_initial_failure_keeps_short_poll_until_success() {
    let mut cp = Server::new().await;
    let mcp = Server::new().await;
    let client = client(&cp, &mcp, Limits::default(), DeadlinePolicy::default());
    let health = client.health();
    let (stop, task) = start(client);

    let first = cp.next().await;
    assert!(first.path.contains("timeout_ms=1000"));
    first.respond(503, "");
    let retry = cp.next().await;
    assert!(retry.path.contains("timeout_ms=1000"));
    assert!(!health.is_ready());
    retry.respond(204, "");
    let steady = cp.next().await;
    let (attempts, request_ms) = health.initial_poll_details().unwrap();
    assert_eq!(attempts, 2);
    assert!(request_ms <= health.initial_poll_ms().unwrap());
    assert!(steady.path.contains("timeout_ms=15000"));
    steady.respond(204, "");
    assert_eq!(finish(stop, task).await, Ok(()));
}

#[tokio::test]
async fn disconnected_poll_recovers_in_place_without_replaying_mcp_work() {
    let mut cp = Server::new().await;
    let mut mcp = Server::new().await;
    let client = client(&cp, &mcp, Limits::default(), DeadlinePolicy::default());
    let health = client.health();
    let (stop, task) = start(client);

    let first = cp.next().await;
    let instance = first.headers["x-tunnel-client-instance-id"].clone();
    first.respond(200, &json!({"commands":[command("old")]}).to_string());
    let steady = cp.next().await;
    assert!(steady.path.contains("timeout_ms=15000"));
    assert!(health.is_ready());
    let initial_poll = health.initial_poll_details().unwrap();

    let old_effect = mcp.next().await;
    assert_eq!(old_effect.json()["id"], "old");
    old_effect.respond(200, r#"{"jsonrpc":"2.0","id":"old","result":{}}"#);
    let old_result = cp.next().await;
    assert!(old_result.path.ends_with("/response"));
    assert_eq!(old_result.json()["request_id"], "old");
    old_result.respond(200, "{}");
    settled(&health).await;

    steady.disconnect();
    let recovery = cp.next().await;
    assert_eq!(recovery.method, "GET");
    assert!(recovery.path.contains("timeout_ms=1000"));
    assert_eq!(recovery.headers["x-tunnel-client-instance-id"], instance);
    assert!(!health.is_ready());
    recovery.respond(
        200,
        &json!({"commands":[command("old"),command("new")]}).to_string(),
    );

    let steady = cp.next().await;
    assert!(steady.path.contains("timeout_ms=15000"));
    assert!(health.is_ready());
    assert_eq!(health.initial_poll_details(), Some(initial_poll));
    let new_effect = mcp.next().await;
    assert_eq!(new_effect.json()["id"], "new");
    new_effect.respond(200, r#"{"jsonrpc":"2.0","id":"new","result":{}}"#);
    let new_result = cp.next().await;
    assert!(new_result.path.ends_with("/response"));
    assert_eq!(new_result.json()["request_id"], "new");
    new_result.respond(200, "{}");
    settled(&health).await;
    assert_eq!(finish(stop, task).await, Ok(()));
    assert!(mcp.requests.try_recv().is_err());
}
