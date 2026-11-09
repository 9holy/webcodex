//! Manual preview identity is distinct from stable-only update selection.
use super::*;

const PREVIEW: &str = "0.5.9-rc.1";

fn saved_preview() -> (tempfile::TempDir, EnvironmentStore, UpgradeJournal) {
    let directory = crate::test_tempdir().unwrap();
    let store = EnvironmentStore::open(directory.path().join("environment")).unwrap();
    let mut journal = tests::fixture(store.root(), Phase::Prepared);
    journal.record.request.account = crate::current_account().unwrap();
    journal.candidate = candidate_relocation_tests::write_candidate_version(
        &directory.path().join("candidate"),
        PREVIEW,
    );
    let _lock = store.lock().unwrap();
    store.save_environment(&journal.record).unwrap();
    save(&store, &journal).unwrap();
    (directory, store, journal)
}

#[test]
fn preview_journal_status_and_observation_preserve_exact_identity_and_phase() {
    let (_directory, store, mut journal) = saved_preview();
    // Reading a locally verified candidate does not confer published provenance.
    assert!(!journal.candidate.provenance_verified);
    for (phase, projected, outcome) in [
        (
            Phase::Prepared,
            UpgradePhase::Prepared,
            UpgradeOutcome::Pending,
        ),
        (
            Phase::Stopping,
            UpgradePhase::Stopping,
            UpgradeOutcome::Pending,
        ),
        (
            Phase::Stopped,
            UpgradePhase::Stopped,
            UpgradeOutcome::Pending,
        ),
        (
            Phase::SnapshotReady,
            UpgradePhase::SnapshotReady,
            UpgradeOutcome::Pending,
        ),
        (
            Phase::Verifying,
            UpgradePhase::Verifying,
            UpgradeOutcome::Pending,
        ),
        (
            Phase::Committed,
            UpgradePhase::Committed,
            UpgradeOutcome::Committed,
        ),
        (
            Phase::Restoring,
            UpgradePhase::Restoring,
            UpgradeOutcome::RecoveryRequired,
        ),
        (
            Phase::RolledBack,
            UpgradePhase::RolledBack,
            UpgradeOutcome::RolledBack,
        ),
        (
            Phase::RecoveryRequired,
            UpgradePhase::RecoveryRequired,
            UpgradeOutcome::RecoveryRequired,
        ),
    ] {
        journal.phase = phase;
        save(&store, &journal).unwrap();
        let before = std::fs::read(store.root().join("upgrade.json")).unwrap();
        let status = upgrade_status(&store).unwrap().unwrap();
        let observation = upgrade_observation(&store).unwrap().unwrap();
        assert_eq!(status.phase, projected);
        assert_eq!(observation.outcome, outcome);
        for (environment, operation, version, source, manifest) in [
            (
                &status.environment_id,
                &status.operation_id,
                &status.version,
                &status.source_sha,
                &status.manifest_sha256,
            ),
            (
                &observation.environment_id,
                &observation.operation_id,
                &observation.version,
                &observation.source_sha,
                &observation.manifest_sha256,
            ),
        ] {
            assert_eq!(environment, &journal.record.environment_id);
            assert_eq!(operation, &journal.operation_id);
            assert_eq!(version, PREVIEW);
            assert_eq!(source, &journal.candidate.source_sha);
            assert_eq!(manifest, &journal.candidate.manifest_sha256);
        }
        assert_eq!(
            std::fs::read(store.root().join("upgrade.json")).unwrap(),
            before
        );
        assert!(!store.root().join("updates").exists());
    }
}

#[test]
fn preview_journal_readers_reject_malformed_versions_and_changed_identity() {
    let (_directory, store, journal) = saved_preview();
    for version in [
        "",
        "v0.5.9-rc.1",
        "0.5",
        "0.05.9-rc.1",
        "0.5.9-rc.01",
        "0.5.9-rc.1/other",
        "../0.5.9-rc.1",
        "0.5.9-rc.1\\other",
        "https://example.invalid/0.5.9-rc.1",
        "0.5.9-rc.1?tag=other",
        "0.5.9-rc.1\n",
        &format!("0.5.9-{}", "a".repeat(64)),
    ] {
        let mut changed = journal.clone();
        changed.candidate.version = version.into();
        save(&store, &changed).unwrap();
        assert_eq!(
            upgrade_status(&store).unwrap_err().code,
            "upgrade_identity",
            "{version}"
        );
        assert_eq!(
            upgrade_observation(&store).unwrap_err().code,
            "upgrade_observation",
            "{version}"
        );
    }
    for (pointer, value) in [
        ("/operation_id", json!("invalid")),
        ("/candidate/source_sha", json!("A".repeat(40))),
        ("/candidate/manifest_sha256", json!("b".repeat(63))),
        ("/record/environment_id", json!("different-environment")),
        ("/record/request/account/identity", json!("different-owner")),
    ] {
        let mut changed = serde_json::to_value(&journal).unwrap();
        *changed.pointer_mut(pointer).unwrap() = value;
        store.write_json("upgrade.json", &changed).unwrap();
        assert!(upgrade_status(&store).is_err(), "{pointer}");
        assert!(upgrade_observation(&store).is_err(), "{pointer}");
    }
}

#[tokio::test]
async fn preview_recovery_keeps_exact_terminal_retries_and_ambiguous_effects_closed() {
    let (_directory, store, mut journal) = saved_preview();
    let mut backend = NativeEnvironment::new().unwrap();
    let target = UpgradeTarget {
        environment_id: journal.record.environment_id.clone(),
        operation_id: Some(journal.operation_id.clone()),
        manifest_sha256: journal.candidate.manifest_sha256.clone(),
    };
    for phase in [
        Phase::SnapshotReady,
        Phase::Verifying,
        Phase::Restoring,
        Phase::RecoveryRequired,
    ] {
        journal.phase = phase;
        save(&store, &journal).unwrap();
        let before = std::fs::read(store.root().join("upgrade.json")).unwrap();
        assert_eq!(
            backend
                .upgrade_finish_headless_guarded(&store, &target)
                .await
                .unwrap_err()
                .code,
            "upgrade_manual_recovery"
        );
        assert_eq!(
            backend
                .upgrade_rollback_headless_guarded(&store, &target)
                .await
                .unwrap_err()
                .code,
            "upgrade_manual_recovery"
        );
        assert_eq!(
            std::fs::read(store.root().join("upgrade.json")).unwrap(),
            before
        );
    }
    for phase in [Phase::Committed, Phase::RolledBack] {
        journal.phase = phase;
        save(&store, &journal).unwrap();
        let before = std::fs::read(store.root().join("upgrade.json")).unwrap();
        for stale in [
            UpgradeTarget {
                operation_id: Some(uuid::Uuid::new_v4().to_string()),
                ..target.clone()
            },
            UpgradeTarget {
                manifest_sha256: "c".repeat(64),
                ..target.clone()
            },
        ] {
            assert_eq!(
                backend
                    .upgrade_finish_guarded(&store, &stale)
                    .await
                    .unwrap_err()
                    .code,
                "upgrade_target_changed"
            );
            assert_eq!(
                backend
                    .upgrade_rollback_guarded(&store, &stale)
                    .await
                    .unwrap_err()
                    .code,
                "upgrade_target_changed"
            );
        }
        if phase == Phase::Committed {
            backend
                .upgrade_finish_headless_guarded(&store, &target)
                .await
                .unwrap();
            assert_eq!(
                backend
                    .upgrade_rollback_guarded(&store, &target)
                    .await
                    .unwrap_err()
                    .code,
                "upgrade_committed"
            );
        } else {
            backend
                .upgrade_rollback_headless_guarded(&store, &target)
                .await
                .unwrap();
        }
        assert_eq!(
            std::fs::read(store.root().join("upgrade.json")).unwrap(),
            before
        );
    }
}

fn write_manifest(root: &Path, manifest: &Value) {
    let bytes = serde_json::to_vec(manifest).unwrap();
    let sums = std::fs::read_to_string(root.join("SHA256SUMS")).unwrap();
    let mut sums = sums
        .lines()
        .filter(|line| !line.ends_with("  source-manifest.json"))
        .map(|line| format!("{line}\n"))
        .collect::<String>();
    sums.push_str(&format!("{}  source-manifest.json\n", hex(&bytes)));
    crate::storage::atomic_private_write(&root.join("source-manifest.json"), &bytes).unwrap();
    crate::storage::atomic_private_write(&root.join("SHA256SUMS"), sums.as_bytes()).unwrap();
}

#[test]
fn preview_candidate_keeps_native_source_hash_publisher_and_compatibility_checks() {
    let (_directory, _store, journal) = saved_preview();
    let root = &journal.candidate.root;
    let original: Value =
        serde_json::from_slice(&std::fs::read(root.join("source-manifest.json")).unwrap()).unwrap();
    assert_eq!(verify_upgrade_candidate(root).unwrap().version, PREVIEW);
    // Hash-bound test bytes are not executables or proof of publication.
    assert!(verify_candidate_executable_headers(&journal.candidate).is_err());
    for (pointer, value, code) in [
        ("/version", json!("../0.5.9-rc.1"), "candidate_version"),
        ("/version", json!("0.5.9-rc.01"), "candidate_version"),
        (
            "/version",
            json!("https://example.invalid/version"),
            "candidate_version",
        ),
        ("/version", json!("0.5.9"), "candidate_identity"),
        ("/source_sha", json!("c".repeat(40)), "candidate_identity"),
        (
            "/source_workflow_ref",
            json!("foreign/webcodex/.github/workflows/release-build.yml@refs/tags/v0.5.9-rc.1"),
            "candidate_provenance",
        ),
        ("/source_workflow_run_id", json!(0), "candidate_provenance"),
        (
            "/platform",
            json!("other-platform"),
            "candidate_architecture",
        ),
        (
            "/artifacts/webcodex/probe",
            json!("not-native"),
            "candidate_provenance",
        ),
        (
            "/artifacts/webcodex/path",
            json!("../webcodex"),
            "candidate_path",
        ),
        (
            "/artifacts/webcodex/sha256",
            json!("c".repeat(64)),
            "candidate_checksum",
        ),
        (
            "/artifacts/webcodex/build_info/version",
            json!("0.5.9-rc.2"),
            "candidate_identity",
        ),
        (
            "/artifacts/webcodex/build_info/git_dirty",
            json!(true),
            "candidate_identity",
        ),
        (
            "/artifacts/webcodex/build_info/architecture",
            json!("other"),
            "candidate_identity",
        ),
        (
            "/artifacts/webcodex/build_info/environment_data_format",
            json!(2),
            "candidate_data_compatibility",
        ),
        (
            "/artifacts/webcodex/build_info/desktop_runtime_contract",
            json!({"min_generation":65535,"max_generation":65535}),
            "candidate_data_compatibility",
        ),
        (
            "/artifacts/webcodex-server/build_info/agent_protocol_generation",
            json!(0),
            "candidate_protocol",
        ),
    ] {
        let mut changed = original.clone();
        *changed.pointer_mut(pointer).unwrap() = value;
        for item in changed["artifacts"].as_object_mut().unwrap().values_mut() {
            item["build_info_sha256"] =
                hex(&serde_json::to_vec(&item["build_info"]).unwrap()).into();
        }
        write_manifest(root, &changed);
        assert_eq!(
            verify_upgrade_candidate(root).unwrap_err().code,
            code,
            "{pointer}"
        );
    }
    write_manifest(root, &original);
    assert_eq!(verify_upgrade_candidate(root).unwrap(), journal.candidate);
}
