// A half-open transport can keep accepting local writes without delivering any
// peer frames. Exercise the real session loop under a paused monotonic clock:
// no network outage, scheduler sleep, or operating-system TCP timeout is needed.

#[tokio::test(start_paused = true)]
async fn streaming_silent_peer_recovers_without_runner_restart() {
    for transport in [StreamTransport::WebSocket, StreamTransport::Quic] {
        let cfg = test_runner_config("http://127.0.0.1:9".to_string());
        let runtime = test_runtime(&cfg);
        let registered_jobs = runtime.jobs.inventory();
        let (out_tx, mut out_rx) = mpsc::channel::<RunnerEnvelope>(WS_OUTGOING_CAPACITY);
        let old_sender = out_tx.clone();
        let (_read_tx, read_rx) = mpsc::channel::<StreamRead>(1);
        let pings = Arc::new(AtomicUsize::new(0));
        let writer_pings = pings.clone();
        let writer_task = tokio::spawn(async move {
            while let Some(envelope) = out_rx.recv().await {
                assert!(!matches!(envelope, RunnerEnvelope::Goodbye { .. }));
                if matches!(envelope, RunnerEnvelope::Ping { .. }) {
                    writer_pings.fetch_add(1, Ordering::SeqCst);
                }
            }
            StreamWriterExit::ChannelClosed
        });
        let writer_abort = writer_task.abort_handle();
        let started = tokio::time::Instant::now();

        let exit = tokio::time::timeout(
            Duration::from_secs(91),
            serve_registered_stream(
                transport,
                &cfg,
                "same-silent-peer-instance",
                &registered_jobs,
                out_tx,
                RegisteredStream::Test { reader: read_rx },
                writer_task,
                InitialProjectInventory::Disabled,
                &runtime,
                std::future::pending::<()>(),
            ),
        )
        .await
        .expect("a silent registered peer must reconnect without restarting the Runner")
        .expect("liveness expiry is a transport disconnect, not an authority failure");

        assert_eq!(exit, RunnerSessionExit::TransportDisconnected);
        assert_eq!(started.elapsed(), Duration::from_secs(90));
        assert!(pings.load(Ordering::SeqCst) >= 2);
        assert!(!runtime.shutdown_requested());
        assert_eq!(runtime.jobs.inventory(), registered_jobs);
        tokio::time::timeout(Duration::from_secs(1), old_sender.closed())
            .await
            .expect("the old writer must release every old result sender");
        assert!(
            writer_abort.is_finished(),
            "the old writer must not remain live"
        );
        for mode in [
            StreamSupervisorMode::Strict(transport),
            StreamSupervisorMode::Auto,
        ] {
            assert!(matches!(
                decide_stream_session(mode, transport, false, Ok(exit)),
                StreamSessionDecision::Reconnect(None)
            ));
        }
    }
}

#[tokio::test(start_paused = true)]
async fn streaming_healthy_peer_activity_keeps_same_session_live() {
    for transport in [StreamTransport::WebSocket, StreamTransport::Quic] {
        for pong in [true, false] {
            let cfg = test_runner_config("http://127.0.0.1:9".to_string());
            let runtime = test_runtime(&cfg);
            let registered_jobs = runtime.jobs.inventory();
            let (out_tx, mut out_rx) = mpsc::channel::<RunnerEnvelope>(WS_OUTGOING_CAPACITY);
            let (read_tx, read_rx) = mpsc::channel::<StreamRead>(1);
            let (healthy_tx, healthy_rx) = oneshot::channel();
            let writer_task = tokio::spawn(async move {
                let mut pings = 0;
                let mut healthy_tx = Some(healthy_tx);
                while let Some(envelope) = out_rx.recv().await {
                    if matches!(envelope, RunnerEnvelope::Goodbye { .. }) {
                        return StreamWriterExit::GracefulClose;
                    }
                    if let RunnerEnvelope::Ping { ts } = envelope {
                        pings += 1;
                        if pings == 6 {
                            healthy_tx.take().unwrap().send(()).unwrap();
                            // Keep the writer and reader alive until the caller
                            // requests shutdown after proving three minutes of
                            // healthy activity on this exact connection.
                            continue;
                        }
                        let response = if pong {
                            RunnerEnvelope::Pong { ts }
                        } else {
                            RunnerEnvelope::Ping { ts }
                        };
                        read_tx.send(StreamRead::Envelope(response)).await.unwrap();
                    }
                }
                StreamWriterExit::ChannelClosed
            });
            let started = tokio::time::Instant::now();
            let exit = serve_registered_stream(
                transport,
                &cfg,
                "same-healthy-peer-instance",
                &registered_jobs,
                out_tx,
                RegisteredStream::Test { reader: read_rx },
                writer_task,
                InitialProjectInventory::Disabled,
                &runtime,
                async { healthy_rx.await.unwrap() },
            )
            .await
            .unwrap();
            assert_eq!(exit, RunnerSessionExit::Shutdown);
            assert!(started.elapsed() >= Duration::from_secs(180));
            assert_eq!(runtime.jobs.inventory(), registered_jobs);
        }
    }
}

#[tokio::test(start_paused = true)]
async fn streaming_partial_write_timeout_discards_old_result_without_replay() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use webcodex_core::runner_protocol::{RunnerResultPayload, RunnerResultRequest};

    for transport in [StreamTransport::WebSocket, StreamTransport::Quic] {
        let cfg = test_runner_config("http://127.0.0.1:9".to_string());
        let runtime = test_runtime(&cfg);
        let instance = "same-partial-write-instance";
        let (out_tx, mut out_rx) = mpsc::channel::<RunnerEnvelope>(1);
        let old_sink = match transport {
            StreamTransport::WebSocket => RunnerSink::WebSocket {
                tx: out_tx.clone(),
                client_id: cfg.client_id.clone(),
                runner_instance_id: instance.to_string(),
            },
            StreamTransport::Quic => RunnerSink::Quic {
                tx: out_tx.clone(),
                client_id: cfg.client_id.clone(),
                runner_instance_id: instance.to_string(),
            },
        };
        out_tx
            .try_send(RunnerEnvelope::Result {
                payload: RunnerResultPayload {
                    result: RunnerResultRequest {
                        client_id: cfg.client_id.clone(),
                        runner_instance_id: instance.to_string(),
                        request_id: "already-executed-request".to_string(),
                        exit_code: Some(0),
                        stdout: Some("effect completed once".to_string()),
                        stderr: None,
                        stdout_truncated: false,
                        stderr_truncated: false,
                        duration_ms: Some(1),
                        error: None,
                    },
                    command_execution_state: None,
                    mcp_gateway: None,
                    plugin_gateway: None,
                    coding_agent: None,
                },
            })
            .unwrap();
        // The first byte is genuinely written, then the peer stops reading.
        // Expiry must cancel this exact write and destroy the old connection,
        // not start a second attempt at an already partially delivered result.
        let (mut wire, mut peer) = tokio::io::duplex(1);
        let attempts = Arc::new(AtomicUsize::new(0));
        let write_attempts = attempts.clone();
        let writer_task = tokio::spawn(async move {
            let envelope = out_rx.recv().await.unwrap();
            let RunnerEnvelope::Result { payload } = &envelope else {
                panic!("the original result must retain its envelope identity");
            };
            assert_eq!(payload.result.request_id, "already-executed-request");
            assert_eq!(payload.result.runner_instance_id, instance);
            let bytes = envelope.to_json().unwrap();
            write_attempts.fetch_add(1, Ordering::SeqCst);
            assert!(
                !write_stream_frame(transport, "result", wire.write_all(bytes.as_bytes())).await
            );
            StreamWriterExit::TransportFailed
        });
        let (_read_tx, read_rx) = mpsc::channel::<StreamRead>(1);
        let started = tokio::time::Instant::now();
        let exit = serve_registered_stream(
            transport,
            &cfg,
            instance,
            &runtime.jobs.inventory(),
            out_tx,
            RegisteredStream::Test { reader: read_rx },
            writer_task,
            InitialProjectInventory::Disabled,
            &runtime,
            std::future::pending::<()>(),
        )
        .await
        .unwrap();
        assert_eq!(exit, RunnerSessionExit::TransportDisconnected);
        assert_eq!(started.elapsed(), Duration::from_secs(30));
        assert_eq!(attempts.load(Ordering::SeqCst), 1);
        assert!(!runtime.shutdown_requested());
        let mut partial = Vec::new();
        peer.read_to_end(&mut partial).await.unwrap();
        assert_eq!(
            partial, b"{",
            "the old partial frame is closed, never retried"
        );

        let (fresh_tx, mut fresh_rx) = mpsc::channel::<RunnerEnvelope>(1);
        let fresh_sink = match transport {
            StreamTransport::WebSocket => RunnerSink::WebSocket {
                tx: fresh_tx,
                client_id: cfg.client_id.clone(),
                runner_instance_id: instance.to_string(),
            },
            StreamTransport::Quic => RunnerSink::Quic {
                tx: fresh_tx,
                client_id: cfg.client_id.clone(),
                runner_instance_id: instance.to_string(),
            },
        };
        runtime.jobs.install_sink(fresh_sink);
        let late_result = tokio::task::spawn_blocking(move || {
            old_sink.submit_result(
                "late-already-executed-request".to_string(),
                CommandResult {
                    exit_code: Some(0),
                    stdout: Some("completed".to_string()),
                    stderr: None,
                    duration_ms: Some(1),
                    error: None,
                },
            )
        })
        .await
        .unwrap();
        assert!(matches!(
            late_result,
            Err(SubmitResultError::TransportClosed(_))
        ));
        assert!(
            fresh_rx.try_recv().is_err(),
            "ordinary old results must not retarget the new sink"
        );
    }
}
