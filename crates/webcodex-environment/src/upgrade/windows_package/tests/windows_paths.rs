use super::*;
use crate::process::CommandOutputExt;
use std::process::Command;
use std::time::Duration;

fn dos(path: &Path) -> PathBuf {
    let text = path.to_str().unwrap();
    PathBuf::from(text.strip_prefix(r"\\?\").unwrap_or(text))
}

fn spellings(path: &Path) -> Vec<PathBuf> {
    let canonical = path.canonicalize().unwrap();
    let ordinary = dos(&canonical);
    let different_case = PathBuf::from(ordinary.to_str().unwrap().to_ascii_uppercase());
    assert_ne!(canonical, ordinary);
    vec![canonical, ordinary, different_case]
}

fn junction(path: &Path, target: &Path) {
    let output = Command::new("cmd.exe")
        .args(["/D", "/C", "mklink", "/J"])
        .arg(dos(path))
        .arg(dos(target))
        .output_with_limits(Duration::from_secs(10), 4096)
        .unwrap();
    assert!(
        output.status.success(),
        "could not create the required native reparse fixture"
    );
}

fn prepared(f: &Fixture) -> PreparedInstallationReceipt {
    let files = targets(&f.runtime).unwrap();
    PreparedInstallationReceipt {
        package_flavor: crate::unified_update::PackageFlavor::Full,
        installer_target: None,
        schema_version: 1,
        operation_id: uuid::Uuid::new_v4().to_string(),
        environment_id: "original-environment".into(),
        environment_dir: f.store.root().to_path_buf(),
        owner_identity: current_account().unwrap().identity,
        manifest_sha256: f.candidate.manifest_sha256.clone(),
        targets: files
            .iter()
            .filter(|(name, _)| name.as_str() != "webcodex-desktop")
            .map(|(name, path)| (name.clone(), path.clone()))
            .collect(),
        desktop_target: Some(files["webcodex-desktop"].clone()),
    }
}

#[tokio::test]
async fn configured_environment_accepts_real_windows_path_spellings_without_rewriting_state() {
    let f = Fixture::new();
    let record = f.environment_record();
    f.store.save_environment(&record).unwrap();
    let original = std::fs::read(f.store.root().join("environment.json")).unwrap();
    for runtime in spellings(&f.runtime) {
        assert_eq!(
            classify_inner(&f.store, &runtime).await.unwrap(),
            InstallationKind::Environment
        );
        assert_eq!(
            std::fs::read(f.store.root().join("environment.json")).unwrap(),
            original
        );
    }

    let other = Fixture::new();
    assert_eq!(
        classify_inner(&f.store, &other.runtime)
            .await
            .unwrap_err()
            .code,
        "installer_owner"
    );
    let mut foreign = record;
    foreign.request.account.identity = "another-account".into();
    f.store.save_environment(&foreign).unwrap();
    assert_eq!(
        classify_inner(&f.store, &dos(&f.runtime))
            .await
            .unwrap_err()
            .code,
        "installer_owner"
    );
}

#[tokio::test]
async fn an_equal_file_id_through_another_hard_link_is_not_an_installation_target() {
    let f = Fixture::new();
    f.store.save_environment(&f.environment_record()).unwrap();
    let other = f._temp.path().join("other/webcodex-runtime");
    ensure_private_directory(other.parent().unwrap()).unwrap();
    ensure_private_directory(&other).unwrap();
    let old = targets(&f.runtime).unwrap();
    for (name, path) in targets(&other).unwrap() {
        std::fs::hard_link(&old[&name], &path).unwrap();
    }
    assert_eq!(
        classify_inner(&f.store, &other).await.unwrap_err().code,
        "installer_owner"
    );
}

#[tokio::test]
async fn reparse_ancestors_are_rejected_before_installer_paths_are_resolved() {
    let f = Fixture::new();
    f.store.save_environment(&f.environment_record()).unwrap();
    let link = f._temp.path().join("linked-installation");
    junction(&link, f.runtime.parent().unwrap());
    let linked_runtime = link.join("webcodex-runtime");
    assert_eq!(
        classify_inner(&f.store, &linked_runtime)
            .await
            .unwrap_err()
            .code,
        "installer_targets"
    );
    assert_eq!(
        crate::verify_installer_targets(&prepared(&f), &linked_runtime)
            .unwrap_err()
            .code,
        "installer_targets"
    );
    assert_eq!(
        crate::upgrade::verify_same_installed_package_contents(
            &f.candidate,
            &linked_runtime,
            None,
        )
        .unwrap_err()
        .code,
        "installer_targets"
    );
    std::fs::remove_dir(link).unwrap();
}

#[tokio::test]
async fn sealed_package_recovery_preserves_missing_files_and_original_target_paths() {
    let f = Fixture::new();
    f.prepare();
    let original: PackageJournal = f.store.read_json(JOURNAL).unwrap().unwrap();
    let journal_bytes = std::fs::read(f.store.root().join(JOURNAL)).unwrap();
    let receipt_bytes = std::fs::read(f.store.root().join(RECEIPT)).unwrap();
    for target in targets(&f.runtime).unwrap().values() {
        std::fs::remove_file(target).unwrap();
    }
    for runtime in spellings(&f.runtime) {
        let bound = load_bound(&f.store, &runtime).unwrap();
        assert_eq!(bound.runtime_dir, original.runtime_dir);
        assert_eq!(receipt(&bound), receipt(&original));
        assert_eq!(
            classify_inner(&f.store, &runtime).await.unwrap(),
            InstallationKind::Unconfigured
        );
        assert_eq!(
            std::fs::read(f.store.root().join(JOURNAL)).unwrap(),
            journal_bytes
        );
        assert_eq!(
            std::fs::read(f.store.root().join(RECEIPT)).unwrap(),
            receipt_bytes
        );
    }
    let other = Fixture::new();
    assert_eq!(
        load_bound(&f.store, &other.runtime).err().unwrap().code,
        "upgrade_receipt"
    );
    rollback_inner(&f.store, &dos(&f.runtime)).unwrap();
    f.assert_original();
    let restored: PackageJournal = f.store.read_json(JOURNAL).unwrap().unwrap();
    assert_eq!(receipt(&restored), receipt(&original));
    assert_eq!(
        std::fs::read(f.store.root().join(RECEIPT)).unwrap(),
        receipt_bytes
    );
}

#[test]
fn prepared_targets_accept_real_aliases_and_keep_missing_leaf_bindings() {
    let f = Fixture::new();
    let mut receipt = prepared(&f);
    for path in receipt
        .targets
        .values_mut()
        .chain(receipt.desktop_target.iter_mut())
    {
        *path = dos(path);
    }
    let original = receipt.clone();
    for runtime in spellings(&f.runtime) {
        crate::verify_installer_targets(&receipt, &runtime).unwrap();
        assert_eq!(receipt, original);
    }
    std::fs::remove_file(&receipt.targets["webcodex-runner"]).unwrap();
    crate::verify_installer_targets(&receipt, &dos(&f.runtime)).unwrap();
    let other = Fixture::new();
    assert_eq!(
        crate::verify_installer_targets(&receipt, &other.runtime)
            .unwrap_err()
            .code,
        "installer_targets"
    );
}

#[test]
fn alternate_data_streams_are_not_program_targets_even_when_the_stream_is_missing() {
    let f = Fixture::new();
    let target = f.runtime.join("webcodex.exe");
    let original = std::fs::read(&target).unwrap();
    let stream = PathBuf::from(format!("{}:other", target.display()));
    std::fs::write(&stream, b"distinct named-stream bytes").unwrap();
    assert_eq!(std::fs::read(&target).unwrap(), original);
    assert_ne!(std::fs::read(&stream).unwrap(), original);
    assert_eq!(
        installed_paths::same_location(&stream, &target)
            .unwrap_err()
            .code,
        "installer_targets"
    );
    let mut receipt = prepared(&f);
    receipt.targets.insert("webcodex".into(), stream.clone());
    assert_eq!(
        crate::verify_installer_targets(&receipt, &f.runtime)
            .unwrap_err()
            .code,
        "installer_targets"
    );
    std::fs::remove_file(&stream).unwrap();
    assert_eq!(std::fs::read(&target).unwrap(), original);
    assert_eq!(
        installed_paths::same_location(&stream, &target)
            .unwrap_err()
            .code,
        "installer_targets"
    );
    assert_eq!(
        installed_paths::same_location(
            &f.runtime.join("missing.exe:other"),
            &f.runtime.join("missing.exe"),
        )
        .unwrap_err()
        .code,
        "installer_targets"
    );
}

#[test]
fn identical_package_detection_accepts_windows_spellings_but_still_checks_all_bytes() {
    let f = Fixture::new();
    f.replace();
    for runtime in spellings(&f.runtime) {
        crate::upgrade::verify_same_installed_package_contents(&f.candidate, &runtime, None)
            .unwrap();
    }
    std::fs::write(f.runtime.join("webcodex-server.exe"), "changed").unwrap();
    assert_eq!(
        crate::upgrade::verify_same_installed_package_contents(
            &f.candidate,
            &dos(&f.runtime),
            None,
        )
        .unwrap_err()
        .code,
        "installer_not_same"
    );
}

#[tokio::test]
async fn prepared_environment_receipt_accepts_the_original_dos_directory_without_rewriting_it() {
    use crate::upgrade::{prepared_receipt, UpgradeJournal};

    let f = Fixture::new();
    let store = EnvironmentStore::open(dos(f.store.root())).unwrap();
    let record = f.environment_record();
    store.save_environment(&record).unwrap();
    let journal = UpgradeJournal {
        installer_target: None,
        schema_version: 1,
        operation_id: uuid::Uuid::new_v4().to_string(),
        candidate: f.candidate.clone(),
        phase: Phase::SnapshotReady,
        record,
        services: Vec::new(),
        all_services: Vec::new(),
        inventory_complete: true,
        programs: Vec::new(),
        desktop: None,
        data: None,
        data_snapshot: None,
        rollback_from: None,
        replacement_started: false,
        snapshot_digest: None,
        windows_installation: None,
    };
    store.write_json("upgrade.json", &journal).unwrap();
    let receipt = prepared_receipt(store.root(), &journal);
    store.write_json("upgrade-prepared.json", &receipt).unwrap();
    let original = std::fs::read(store.root().join("upgrade-prepared.json")).unwrap();
    // This deliberately absent candidate prevents network or execution effects.
    // Reaching its validation proves that the valid sealed owner/directory
    // bindings were accepted for both spellings of the same receipt.
    let missing_candidate = f._temp.path().join("absent-candidate");
    for root in spellings(store.root()) {
        assert_eq!(
            crate::verify_prepared_installation(
                &root.join("upgrade-prepared.json"),
                &missing_candidate,
            )
            .await
            .unwrap_err()
            .code,
            "candidate_path"
        );
    }
    assert_eq!(
        std::fs::read(store.root().join("upgrade-prepared.json")).unwrap(),
        original
    );
}
