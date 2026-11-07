use super::*;
use crate::process::CommandOutputExt;
use crate::service::{ServiceAccount, ServiceScope};
use crate::storage::{atomic_private_write, secure_windows_path};
use std::process::Command;
use std::time::Duration;

struct Fixture {
    _temporary: tempfile::TempDir,
    store: EnvironmentStore,
    journal: UpgradeJournal,
}

impl Fixture {
    fn new() -> Self {
        let temporary = crate::test_tempdir().unwrap();
        let store = EnvironmentStore::open(temporary.path().join("environment")).unwrap();
        let mut journal = super::super::tests::fixture(store.root(), Phase::SnapshotReady);
        journal.record.request.account = current_account().unwrap();
        journal.record.request.service_scope = ServiceScope::User;
        let installed = temporary.path().join("installed");
        let runtime = installed.join("webcodex-runtime");
        ensure_private_directory(&installed).unwrap();
        ensure_private_directory(&runtime).unwrap();
        journal.record.request.binaries = RuntimeBinaries {
            cli: runtime.join("webcodex.exe"),
            server: runtime.join("webcodex-server.exe"),
            runner: runtime.join("webcodex-runner.exe"),
        };
        let backups = store.root().join("upgrade-backups");
        ensure_private_directory(&backups).unwrap();
        let backups = backups.join(&journal.operation_id);
        ensure_private_directory(&backups).unwrap();
        let candidate = temporary.path().join("candidate");
        ensure_private_directory(&candidate).unwrap();
        journal.candidate.root = candidate.clone();
        journal.candidate.platform = crate::unified_update::RuntimePlatform::current()
            .unwrap()
            .as_str()
            .into();
        for (name, target) in [
            ("webcodex", &journal.record.request.binaries.cli),
            ("webcodex-server", &journal.record.request.binaries.server),
            ("webcodex-runner", &journal.record.request.binaries.runner),
        ] {
            let backup = backups.join(format!("{name}.exe"));
            atomic_private_write(&backup, format!("original {name}").as_bytes()).unwrap();
            atomic_private_write(target, format!("failed replacement {name}").as_bytes()).unwrap();
            journal.programs.push(ProgramBackup {
                target: target.clone(),
                sha256: digest(&backup).unwrap(),
                backup,
                name: name.into(),
            });
            let path = candidate.join(format!("{name}.exe"));
            atomic_private_write(&path, format!("candidate {name}").as_bytes()).unwrap();
            let platform = crate::unified_update::RuntimePlatform::current().unwrap();
            let build_info = serde_json::from_value(json!({
                "schema_version": 1, "binary": name, "version": "1.0.0",
                "git_commit": "a".repeat(40), "git_dirty": false, "built_at": "1",
                "target": platform.target(), "architecture": std::env::consts::ARCH,
                "desktop_runtime_contract": DESKTOP_RUNTIME_CONTRACT,
                "environment_data_format": 1
            }))
            .unwrap();
            journal.candidate.artifacts.insert(
                name.into(),
                CandidateArtifact {
                    sha256: digest(&path).unwrap(),
                    path,
                    build_info,
                },
            );
        }
        let desktop = installed.join("WebCodex.exe");
        let desktop_backup = backups.join("desktop");
        atomic_private_write(&desktop, b"failed replacement Desktop").unwrap();
        atomic_private_write(&desktop_backup, b"original Desktop").unwrap();
        journal.desktop = Some(DesktopBackup {
            target: desktop,
            sha256: digest(&desktop_backup).unwrap(),
            backup: desktop_backup,
            directory_modes_sha256: String::new(),
        });
        store.save_environment(&journal.record).unwrap();
        save(&store, &journal).unwrap();
        write_prepared_receipt(&store, &journal).unwrap();
        Self {
            _temporary: temporary,
            store,
            journal,
        }
    }

    fn assert_restored(&self) {
        for program in &self.journal.programs {
            assert_eq!(digest(&program.target).unwrap(), program.sha256);
            assert_eq!(
                crate::storage::windows_path_owner(&program.target).unwrap(),
                self.journal.record.request.account.identity
            );
        }
        let desktop = self.journal.desktop.as_ref().unwrap();
        assert_eq!(digest(&desktop.target).unwrap(), desktop.sha256);
        let saved: UpgradeJournal = self.store.read_json("upgrade.json").unwrap().unwrap();
        assert_eq!(saved.phase, Phase::RolledBack);
    }

    fn system_spec(&mut self) -> ServiceSpec {
        self.journal.record.request.service_scope = ServiceScope::System;
        self.journal.record.request.runner = Some(true);
        let account = &self.journal.record.request.account;
        let spec = ServiceSpec {
            scope: ServiceScope::System,
            id: "WebCodexRunner-recovery-fixture".into(),
            component: Component::Runner,
            program: self.journal.record.request.binaries.runner.clone(),
            args: vec![],
            working_directory: self.store.root().into(),
            account: ServiceAccount::SystemUser {
                name: account.name.clone(),
                group: None,
                expected_identity: account.identity.clone(),
                home: Some(account.home.clone()),
            },
            config_identity: self.journal.record.environment_id.clone(),
            env_file: None,
            environment: BTreeMap::new(),
            linux_socket: None,
        };
        self.journal.all_services = vec![spec.clone()];
        self.store.save_environment(&self.journal.record).unwrap();
        save(&self.store, &self.journal).unwrap();
        spec
    }
}

#[tokio::test]
async fn failed_candidate_finish_restores_corrupt_or_missing_cli_without_executing_it() {
    for missing in [false, true] {
        let fixture = Fixture::new();
        let before = std::fs::read(fixture.store.root().join("environment.json")).unwrap();
        let receipt = std::fs::read(fixture.store.root().join(PREPARED_RECEIPT)).unwrap();
        if missing {
            std::fs::remove_file(&fixture.journal.record.request.binaries.cli).unwrap();
        }
        let mut backend = NativeEnvironment::new().unwrap();
        let failure = backend.upgrade_finish(&fixture.store).await.unwrap_err();
        assert_eq!(
            failure.code,
            if missing {
                "candidate_file"
            } else {
                "upgrade_installed_hash"
            }
        );
        fixture.assert_restored();
        assert_eq!(
            std::fs::read(fixture.store.root().join("environment.json")).unwrap(),
            before
        );
        assert_eq!(
            std::fs::read(fixture.store.root().join(PREPARED_RECEIPT)).unwrap(),
            receipt
        );
        backend.upgrade_rollback(&fixture.store).await.unwrap();
        fixture.assert_restored();
    }
}

#[test]
fn restore_rejects_changed_owner_operation_backup_and_missing_parent() {
    let mut fixture = Fixture::new();
    fixture.journal.phase = Phase::Restoring;
    save(&fixture.store, &fixture.journal).unwrap();
    let target = &fixture.journal.record.request.binaries.server;
    let before = digest(target).unwrap();
    for (operation, owner) in [
        (
            uuid::Uuid::new_v4().to_string(),
            fixture.journal.record.request.account.identity.clone(),
        ),
        (
            fixture.journal.operation_id.clone(),
            "different owner".into(),
        ),
    ] {
        assert_eq!(
            restore_programs_from_journal(fixture.store.root(), &operation, &owner)
                .unwrap_err()
                .code,
            "upgrade_restore_authorization"
        );
        assert_eq!(digest(target).unwrap(), before);
    }
    let server = fixture
        .journal
        .programs
        .iter()
        .find(|item| item.name == "webcodex-server")
        .unwrap();
    atomic_private_write(&server.backup, b"changed backup").unwrap();
    assert_eq!(
        restore_programs_from_journal(
            fixture.store.root(),
            &fixture.journal.operation_id,
            &fixture.journal.record.request.account.identity
        )
        .unwrap_err()
        .code,
        "upgrade_backup_changed"
    );
    assert_eq!(digest(target).unwrap(), before);
    let nonexistent = fixture._temporary.path().join("absent-parent/webcodex.exe");
    assert!(authorize_destination(
        &nonexistent,
        &fixture.journal.record.request.account.identity
    )
    .is_err());
    assert!(!nonexistent.exists());
}

#[test]
fn system_recovery_selects_only_the_bound_candidate_and_keeps_its_image_unchanged() {
    let mut fixture = Fixture::new();
    let spec = fixture.system_spec();
    let candidate = fixture.journal.candidate.artifacts["webcodex"].path.clone();
    // Both damaged and absent installed CLIs must be irrelevant to a verified
    // candidate's UAC helper. No real service or administrator prompt is used.
    for missing in [false, true] {
        if missing {
            std::fs::remove_file(&fixture.journal.record.request.binaries.cli).unwrap();
        }
        let helper = service_helper_for(
            &fixture.store,
            &fixture.journal.record,
            &spec,
            ServiceOperation::Stop,
            &candidate,
        )
        .unwrap()
        .unwrap();
        assert_eq!(helper.path(), candidate);
        assert!(std::fs::OpenOptions::new()
            .write(true)
            .open(&candidate)
            .is_err());
        assert!(std::fs::remove_file(&candidate).is_err());
        drop(helper);
    }
    let foreign = fixture._temporary.path().join("foreign.exe");
    atomic_private_write(&foreign, b"unverified helper").unwrap();
    assert!(service_helper_for(
        &fixture.store,
        &fixture.journal.record,
        &spec,
        ServiceOperation::Stop,
        &foreign
    )
    .is_err());
    fixture.journal.candidate.provenance_verified = false;
    save(&fixture.store, &fixture.journal).unwrap();
    assert!(service_helper_for(
        &fixture.store,
        &fixture.journal.record,
        &spec,
        ServiceOperation::Stop,
        &candidate
    )
    .is_err());
    fixture.journal.candidate.provenance_verified = true;
    save(&fixture.store, &fixture.journal).unwrap();
    let mut other = spec.clone();
    other.args.push("different request".into());
    assert!(service_helper_for(
        &fixture.store,
        &fixture.journal.record,
        &other,
        ServiceOperation::Stop,
        &candidate
    )
    .is_err());
    assert!(service_helper_for(
        &fixture.store,
        &fixture.journal.record,
        &spec,
        ServiceOperation::Install,
        &candidate
    )
    .is_err());
    let mut other_owner = fixture.journal.record.clone();
    other_owner.request.account.identity = "different owner".into();
    assert!(service_helper_for(
        &fixture.store,
        &other_owner,
        &spec,
        ServiceOperation::Stop,
        &candidate
    )
    .is_err());
    fixture
        .store
        .write_json("upgrade.json", &json!({"invalid":true}))
        .unwrap();
    assert!(service_helper_for(
        &fixture.store,
        &fixture.journal.record,
        &spec,
        ServiceOperation::Stop,
        &candidate
    )
    .is_err());
}

#[test]
#[ignore = "owned subprocess invoked by installed_image_and_hardlink_recovery_are_rejected_before_effects"]
fn self_image_recovery_child() {
    let root = std::env::var_os("WEBCODEX_TEST_RECOVERY_ENVIRONMENT").expect("owned fixture root");
    let store = EnvironmentStore::open_existing(root.into())
        .unwrap()
        .unwrap();
    let before = std::fs::read(store.root().join("upgrade.json")).unwrap();
    let result = tokio::runtime::Runtime::new()
        .unwrap()
        .block_on(NativeEnvironment::new().unwrap().upgrade_rollback(&store));
    assert_eq!(
        result.unwrap_err().code,
        "upgrade_external_recovery_required"
    );
    assert_eq!(
        std::fs::read(store.root().join("upgrade.json")).unwrap(),
        before
    );
}

#[tokio::test]
async fn installed_image_and_hardlink_recovery_are_rejected_before_effects() {
    let executable = std::env::current_exe().unwrap();
    for desktop in [false, true] {
        let fixture = Fixture::new();
        let target = if desktop {
            &fixture.journal.desktop.as_ref().unwrap().target
        } else {
            &fixture.journal.record.request.binaries.cli
        };
        std::fs::copy(&executable, target).unwrap();
        secure_windows_path(target).unwrap();
        let target_before = digest(target).unwrap();
        let alias = fixture._temporary.path().join("outside-hardlink.exe");
        std::fs::hard_link(target, &alias).unwrap();
        assert_eq!(open_image(target).unwrap().1, open_image(&alias).unwrap().1);
        for launch in [target, &alias] {
            let output = Command::new(launch)
                .args([
                    "--exact",
                    "upgrade::windows_recovery::tests::self_image_recovery_child",
                    "--ignored",
                    "--nocapture",
                ])
                .env("WEBCODEX_TEST_RECOVERY_ENVIRONMENT", fixture.store.root())
                .output_with_limits(Duration::from_secs(30), 8192)
                .unwrap();
            assert!(
                output.status.success(),
                "{}{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            assert_eq!(digest(target).unwrap(), target_before);
        }
        std::fs::remove_file(alias).unwrap();
        // The same operation succeeds from an external process after the
        // installed/alias process exits, including the Desktop executable.
        NativeEnvironment::new()
            .unwrap()
            .upgrade_rollback(&fixture.store)
            .await
            .unwrap();
        fixture.assert_restored();
    }
}

#[test]
fn already_restored_self_image_is_an_idempotent_noop() {
    let fixture = Fixture::new();
    let mut journal = fixture.journal.clone();
    let current = std::env::current_exe().unwrap();
    journal.programs[0].target = current.clone();
    journal.programs[0].sha256 = digest(&current).unwrap();
    journal.desktop = Some(DesktopBackup {
        target: current.clone(),
        backup: current.clone(),
        sha256: digest(&current).unwrap(),
        directory_modes_sha256: String::new(),
    });
    ensure_external_restore_process(&journal).unwrap();
}
