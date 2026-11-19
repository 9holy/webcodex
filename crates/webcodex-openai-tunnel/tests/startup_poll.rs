mod support;
use serde_json::json;
use std::time::Duration;
use support::*;
use tokio::time;
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

#[tokio::test]
async fn recovery_bounds_silent_poll_and_sustained_network_backoff() {
    let mut cp = Server::new().await;
    let mcp = Server::new().await;
    let client = client(&cp, &mcp, Limits::default(), DeadlinePolicy::default());
    let health = client.health();
    let (stop, task) = start(client);

    let first = cp.next().await;
    let instance = first.headers["x-tunnel-client-instance-id"].clone();
    first.respond(204, "");
    let steady = cp.next().await;
    assert!(steady.path.contains("timeout_ms=15000"));
    assert!(health.is_ready());
    steady.disconnect();

    let silent = cp.next().await;
    assert!(silent.path.contains("timeout_ms=1000"));
    assert!(!health.is_ready());
    // Keep this TCP connection open without headers and advance its HTTP deadline.
    time::pause();
    time::advance(Duration::from_secs(6)).await;
    time::resume();
    let mut retry = time::timeout(Duration::from_secs(2), cp.requests.recv())
        .await
        .expect("a silent recovery poll should time out before the steady deadline")
        .unwrap();
    drop(silent);

    // The sixth consecutive failure would wait 6.4s without the cap, beyond
    // the fixture's 5s wait for the next request.
    for _ in 0..4 {
        retry.disconnect();
        retry = cp.next().await;
    }
    assert!(retry.path.contains("timeout_ms=1000"));
    assert_eq!(retry.headers["x-tunnel-client-instance-id"], instance);
    assert!(!health.is_ready());
    retry.respond(204, "");

    let steady = cp.next().await;
    assert!(steady.path.contains("timeout_ms=15000"));
    assert!(health.is_ready());
    assert_eq!(finish(stop, task).await, Ok(()));
}

#[tokio::test]
async fn recovery_honors_server_retry_after_above_network_backoff_cap() {
    let mut cp = Server::new().await;
    let mcp = Server::new().await;
    let client = client(&cp, &mcp, Limits::default(), DeadlinePolicy::default());
    let health = client.health();
    let (stop, task) = start(client);

    cp.next().await.respond(204, "");
    let steady = cp.next().await;
    assert!(health.is_ready());
    let started = time::Instant::now();
    steady.raw(429, "Retry-After: 4\r\n", "");

    time::timeout(Duration::from_secs(2), async {
        while health.is_ready() {
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("rate limiting should immediately clear readiness");
    time::pause();
    time::advance(Duration::from_secs(3)).await;
    time::resume();

    let retry = cp.next().await;
    assert!(started.elapsed() >= Duration::from_secs(4));
    assert!(retry.path.contains("timeout_ms=1000"));
    assert!(!health.is_ready());
    retry.respond(204, "");
    let steady = cp.next().await;
    assert!(steady.path.contains("timeout_ms=15000"));
    assert!(health.is_ready());
    assert_eq!(finish(stop, task).await, Ok(()));
}

#[tokio::test]
async fn repeated_fast_timeouts_still_allow_a_slow_route_to_recover() {
    let mut cp = Server::new().await;
    let mcp = Server::new().await;
    let client = client(&cp, &mcp, Limits::default(), DeadlinePolicy::default());
    let health = client.health();
    let (stop, task) = start(client);

    cp.next().await.respond(204, "");
    cp.next().await.disconnect();
    let mut recovery = cp.next().await;
    for _ in 0..2 {
        assert!(recovery.path.contains("timeout_ms=1000"));
        time::pause();
        time::advance(Duration::from_secs(7)).await;
        time::resume();
        let replacement = cp.next().await;
        drop(recovery);
        recovery = replacement;
    }

    // After two fast retries, the next short poll can receive late headers.
    assert!(recovery.path.contains("timeout_ms=1000"));
    time::pause();
    time::advance(Duration::from_secs(7)).await;
    time::resume();
    assert!(!health.is_ready());
    recovery.respond(204, "");
    let steady = cp.next().await;
    assert!(steady.path.contains("timeout_ms=15000"));
    assert!(health.is_ready());
    assert_eq!(finish(stop, task).await, Ok(()));
}
