use super::*;
use crate::runner_operation::{RunnerInvocationMetadata, RunnerOperation};
use crate::runner_protocol::{RunnerCapabilities, RunnerRequest};
use crate::ssh_resource::{validate_response_for_request, SshResourceRequest, SshResourceResponse};

fn endpoint() -> SshEndpoint {
    SshEndpoint {
        host: "192.0.2.10".into(),
        port: 2222,
        user: "operator".into(),
    }
}

fn trust() -> SshHostKeyTrust {
    SshHostKeyTrust {
        challenge_id: "ssh_challenge_1".into(),
        fingerprint: format!("SHA256:{}", "A".repeat(43)),
    }
}

fn probe() -> SshResourceRequest {
    SshResourceRequest::Probe {
        expected_revision: 7,
        endpoint: endpoint(),
        authentication: SshAuthentication::Password {
            password: SshSecret::new("private-password-sentinel".into()).unwrap(),
        },
        host_key: trust(),
    }
}

#[test]
fn ssh_connection_secret_roundtrips_only_on_transport_and_never_in_debug() {
    let request = probe();
    let json = serde_json::to_string(&request).unwrap();
    assert!(json.contains("private-password-sentinel"));
    assert_eq!(
        serde_json::from_str::<SshResourceRequest>(&json).unwrap(),
        request
    );
    assert!(!format!("{request:?}").contains("private-password-sentinel"));
    assert!(!format!("{request:?}").contains("192.0.2.10"));
    let operation = RunnerOperation::SshResource(request);
    assert!(!format!("{operation:?}").contains("private-password-sentinel"));
    let mut wire = RunnerRequest::from_operation(
        RunnerInvocationMetadata {
            request_id: "request".into(),
            client_id: "runner".into(),
            requested_by: "operator".into(),
            created_at: 1,
        },
        operation,
    )
    .unwrap();
    assert!(!format!("{wire:?}").contains("private-password-sentinel"));
    assert!(matches!(
        wire.decode_operation().unwrap(),
        RunnerOperation::SshResource(SshResourceRequest::Probe { .. })
    ));
    wire.content = Some(r#"{"action":"private-password-sentinel"}"#.into());
    let error = wire.decode_operation().unwrap_err();
    assert_eq!(error, "invalid SSH resource payload");
}

#[test]
fn ssh_connection_secret_bounds_are_static_and_do_not_echo_rejected_values() {
    for value in [
        String::new(),
        "line\nbreak".into(),
        "line\rbreak".into(),
        "nul\0byte".into(),
        "private-password-sentinel".repeat(200),
    ] {
        assert!(SshSecret::new(value.clone()).is_err());
        let error = serde_json::from_value::<SshSecret>(serde_json::json!(value))
            .unwrap_err()
            .to_string();
        assert!(!error.contains("private-password-sentinel"));
    }
    assert!(SshSecret::new("x".repeat(SSH_CONNECTION_SECRET_MAX_BYTES)).is_ok());
}

#[test]
fn ssh_connection_endpoint_is_one_destination_without_option_or_scan_syntax() {
    for host in [
        "192.0.2.1",
        "2001:db8::1",
        "server.example",
        "server.example.",
    ] {
        SshEndpoint {
            host: host.into(),
            ..endpoint()
        }
        .validate()
        .unwrap();
    }
    for host in [
        "",
        "-oProxyCommand=bad",
        "192.0.2.0/24",
        "a,b",
        "a b",
        "a\nb",
        "user@host",
        "fe80::1%en0",
        "[::1]",
        "host:2222",
        "host..example",
    ] {
        assert!(
            SshEndpoint {
                host: host.into(),
                ..endpoint()
            }
            .validate()
            .is_err(),
            "{host}"
        );
    }
    assert!(SshEndpoint {
        port: 0,
        ..endpoint()
    }
    .validate()
    .is_err());
    assert!(SshEndpoint {
        user: "-Fnone".into(),
        ..endpoint()
    }
    .validate()
    .is_err());
    assert!(SshEndpoint {
        user: "user name".into(),
        ..endpoint()
    }
    .validate()
    .is_err());
    for path in [
        "/home/operator/.ssh/id_ed25519",
        "C:\\Users\\operator\\.ssh\\id_ed25519",
    ] {
        SshAuthentication::IdentityFile {
            path: path.into(),
            passphrase: None,
        }
        .validate()
        .unwrap();
    }
    for path in ["id_ed25519", "-oProxyCommand=bad", "/a\nb"] {
        assert!(SshAuthentication::IdentityFile {
            path: path.into(),
            passphrase: None
        }
        .validate()
        .is_err());
    }
}

#[test]
fn ssh_connection_responses_are_bound_to_revision_and_selected_host_key() {
    let inspect = SshResourceRequest::Inspect {
        expected_revision: 7,
        endpoint: endpoint(),
    };
    let key = SshHostKeyCandidate {
        algorithm: "ssh-ed25519".into(),
        fingerprint: trust().fingerprint,
    };
    let response = SshResourceResponse::Inspect {
        revision: 7,
        challenge_id: trust().challenge_id,
        expires_at: 300,
        host_keys: vec![key.clone()],
    };
    validate_response_for_request(&inspect, &response).unwrap();
    let duplicates = SshResourceResponse::Inspect {
        revision: 7,
        challenge_id: trust().challenge_id,
        expires_at: 300,
        host_keys: vec![key.clone(), key],
    };
    assert!(validate_response_for_request(&inspect, &duplicates).is_err());
    validate_response_for_request(
        &probe(),
        &SshResourceResponse::Probe {
            revision: 7,
            host_key_fingerprint: trust().fingerprint,
        },
    )
    .unwrap();
    assert!(validate_response_for_request(
        &probe(),
        &SshResourceResponse::Probe {
            revision: 8,
            host_key_fingerprint: trust().fingerprint
        }
    )
    .is_err());
    assert!(validate_response_for_request(
        &probe(),
        &SshResourceResponse::Probe {
            revision: 7,
            host_key_fingerprint: "SHA256:unrelated".into()
        }
    )
    .is_err());
    assert!(!RunnerCapabilities::default().ssh_connection_setup);
    assert!(
        !serde_json::from_str::<RunnerCapabilities>("{}")
            .unwrap()
            .ssh_connection_setup
    );
    assert!(probe().requires_connection_setup());
    assert!(!SshResourceRequest::List.requires_connection_setup());
}
