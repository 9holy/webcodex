use super::*;
use crate::process::CommandOutputExt;
use crate::upgrade::windows_installation::{ProgramAuthority, Purpose, ADMINISTRATORS};
use std::process::Command;
use std::time::Duration;
use windows_sys::Win32::System::Registry::RegOverridePredefKey;
use winreg::enums::{HKEY_CURRENT_USER, KEY_ALL_ACCESS, KEY_WOW64_64KEY};
use winreg::RegKey;

const REGISTRATION: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\WebCodex Desktop";
const CHILD: &str = "upgrade::windows_package::tests::windows_owners::registered_group_owned_child";

struct Registry {
    original: RegKey,
    root: RegKey,
    name: String,
}
impl Registry {
    fn new() -> Self {
        let original = RegKey::predef(HKEY_CURRENT_USER);
        let name = format!(
            r"Software\WebCodexInstallerNativeTests\{}",
            uuid::Uuid::new_v4()
        );
        let (root, _) = original.create_subkey(&name).unwrap();
        assert_eq!(
            unsafe { RegOverridePredefKey(HKEY_CURRENT_USER, root.raw_handle()) },
            0
        );
        Self {
            original,
            root,
            name,
        }
    }
    fn register(&self, f: &Fixture) {
        let (key, _) = self
            .root
            .create_subkey_with_flags(REGISTRATION, KEY_ALL_ACCESS | KEY_WOW64_64KEY)
            .unwrap();
        key.set_value(
            "InstallLocation",
            &f.runtime.parent().unwrap().to_str().unwrap(),
        )
        .unwrap();
    }
    fn remove(&self) {
        self.root.delete_subkey_all(REGISTRATION).unwrap();
    }
}
impl Drop for Registry {
    fn drop(&mut self) {
        assert_eq!(
            unsafe { RegOverridePredefKey(HKEY_CURRENT_USER, std::ptr::null_mut()) },
            0
        );
        self.original.delete_subkey_all(&self.name).unwrap();
    }
}

#[test]
#[ignore = "requires a native administrator token whose default owner is Administrators"]
fn registered_group_owned_installation_lifecycle() {
    let output = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", CHILD, "--ignored", "--nocapture"])
        .env("WEBCODEX_TEST_REGISTERED_OWNER_CHILD", "1")
        .output_with_limits(Duration::from_secs(90), 32768)
        .unwrap();
    assert!(
        output.status.success(),
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

fn assert_security(journal: &PackageJournal) {
    for program in &journal.programs {
        assert_eq!(digest(&program.target).unwrap(), program.sha256);
        assert!(windows_installation::security_matches(
            &program.target,
            program.windows_security.as_ref().unwrap(),
        ));
    }
}

fn environment_journal(f: &Fixture) -> UpgradeJournal {
    let mut record = f.environment_record();
    record.request.runner = Some(false);
    record.runner_client_id = None;
    f.store.save_environment(&record).unwrap();
    let mut authority =
        windows_installation::verify_record(&f.store, &record, None, Purpose::Admission, false)
            .unwrap();
    let mut journal = crate::upgrade::tests::fixture(f.store.root(), Phase::Restoring);
    journal.record = record;
    journal.candidate = f.candidate.clone();
    let backup_root = f
        .store
        .root()
        .join("upgrade-backups")
        .join(&journal.operation_id);
    ensure_private_directory(&backup_root).unwrap();
    for (name, target) in [
        ("webcodex", &journal.record.request.binaries.cli),
        ("webcodex-server", &journal.record.request.binaries.server),
        ("webcodex-runner", &journal.record.request.binaries.runner),
    ] {
        let snapshot = authority.snapshot(target).unwrap();
        let backup = backup_root.join(format!("{name}.exe"));
        crate::storage::atomic_private_write(&backup, &std::fs::read(target).unwrap()).unwrap();
        journal.programs.push(ProgramBackup {
            target: target.clone(),
            sha256: digest(&backup).unwrap(),
            backup,
            name: name.into(),
            windows_security: Some(snapshot),
        });
    }
    let desktop = f.runtime.parent().unwrap().join("WebCodex.exe");
    let snapshot = authority.snapshot(&desktop).unwrap();
    journal.desktop = snapshot_desktop(
        &journal.record.request.binaries,
        &backup_root,
        Some(snapshot),
    )
    .unwrap();
    journal.windows_installation = authority.binding();
    save(&f.store, &journal).unwrap();
    journal
}

#[tokio::test]
#[ignore = "owned subprocess; invoked only by the exact registered-owner driver"]
async fn registered_group_owned_child() {
    assert_eq!(
        std::env::var("WEBCODEX_TEST_REGISTERED_OWNER_CHILD").unwrap(),
        "1"
    );
    let registry = Registry::new();
    let f = Fixture::group_owned();
    for path in targets(&f.runtime)
        .unwrap()
        .values()
        .map(PathBuf::as_path)
        .chain([f.runtime.as_path(), f.runtime.parent().unwrap()])
    {
        assert_eq!(
            crate::storage::windows_path_owner(path).unwrap(),
            ADMINISTRATORS
        );
    }
    registry.register(&f);
    let record = f.environment_record();
    f.store.save_environment(&record).unwrap();
    let original_record = std::fs::read(f.store.root().join("environment.json")).unwrap();
    assert_eq!(
        classify_inner(&f.store, &f.runtime).await.unwrap(),
        InstallationKind::Environment
    );
    assert_eq!(
        std::fs::read(f.store.root().join("environment.json")).unwrap(),
        original_record
    );
    let other = Fixture::group_owned();
    assert_eq!(
        classify_inner(&f.store, &other.runtime)
            .await
            .unwrap_err()
            .code,
        "installer_owner"
    );
    registry.register(&other);
    assert_eq!(
        classify_inner(&f.store, &f.runtime).await.unwrap_err().code,
        "installer_registration"
    );
    registry.register(&f);
    let mut foreign = record.clone();
    foreign.request.account.identity = "S-1-5-21-1-2-3-1001".into();
    f.store.save_environment(&foreign).unwrap();
    assert_eq!(
        classify_inner(&f.store, &f.runtime).await.unwrap_err().code,
        "installer_owner"
    );
    f.store.save_environment(&record).unwrap();

    let journal = environment_journal(&f);
    let authority =
        windows_installation::verify_journal(&f.store, &journal, Purpose::Sealed, false).unwrap();
    let original_security = journal.programs[0].windows_security.as_ref().unwrap();
    let mut owner_relative = original_security.clone();
    owner_relative.descriptor = "O:BAD:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;OW)".into();
    owner_relative.dacl_protected = true;
    authority.validate_snapshot(&owner_relative).unwrap();
    // OWNER RIGHTS does not acquire the original registration's authority.
    let unbound = ProgramAuthority::new(
        &journal.record.request.account.identity,
        &f.runtime,
        None,
        Purpose::Sealed,
    )
    .unwrap();
    assert_eq!(
        unbound.validate_snapshot(&owner_relative).unwrap_err().code,
        "installer_owner"
    );
    for extra in [
        "(A;;FW;;;BU)",
        "(A;;FA;;;S-1-5-21-1-2-3-1001)",
        "(OA;;FR;01234567-89ab-cdef-0123-456789abcdef;;BA)",
    ] {
        let mut invalid = original_security.clone();
        invalid.descriptor = format!(
            "O:BAD:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;{}){extra}",
            journal.record.request.account.identity,
        );
        invalid.dacl_protected = true;
        assert_eq!(
            authority.validate_snapshot(&invalid).unwrap_err().code,
            "installer_program_acl"
        );
    }
    for owner in ["S-1-5-18", "S-1-5-21-1-2-3-1001"] {
        let mut invalid = original_security.clone();
        invalid.owner_identity = owner.into();
        invalid.descriptor = format!("O:{owner}D:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;OW)");
        invalid.dacl_protected = true;
        assert_eq!(
            authority.validate_snapshot(&invalid).unwrap_err().code,
            "installer_owner"
        );
    }
    let probe = f
        .runtime
        .join(format!("security-probe-{}", uuid::Uuid::new_v4()));
    let mut remaining = SNAPSHOT_LIMIT;
    copy_bounded_with(&journal.programs[0].backup, &mut remaining, || {
        windows_installation::create_recovery_file(&probe, original_security)
    })
    .unwrap();
    assert_eq!(digest(&probe).unwrap(), journal.programs[0].sha256);
    windows_installation::restore_security(&probe, original_security).unwrap();
    assert!(windows_installation::security_matches(
        &probe,
        original_security
    ));
    std::fs::remove_file(probe).unwrap();
    let before_record = std::fs::read(f.store.root().join("environment.json")).unwrap();
    for program in &journal.programs {
        std::fs::write(&program.target, b"failed replacement").unwrap();
    }
    std::fs::remove_file(&journal.record.request.binaries.cli).unwrap();
    registry.remove();
    assert_eq!(
        ProgramAuthority::new(
            &journal.record.request.account.identity,
            &f.runtime,
            journal.windows_installation.as_ref(),
            Purpose::Sealed,
        )
        .err()
        .unwrap()
        .code,
        "installer_registration"
    );
    restore_programs_from_journal(
        f.store.root(),
        &journal.operation_id,
        &journal.record.request.account.identity,
    )
    .unwrap();
    for program in &journal.programs {
        assert_eq!(digest(&program.target).unwrap(), program.sha256);
        assert!(windows_installation::security_matches(
            &program.target,
            program.windows_security.as_ref().unwrap(),
        ));
    }
    let desktop = journal.desktop.as_ref().unwrap();
    assert!(windows_installation::security_matches(
        &desktop.target,
        desktop.windows_security.as_ref().unwrap(),
    ));
    assert_eq!(
        std::fs::read(f.store.root().join("environment.json")).unwrap(),
        before_record
    );

    // A failed installer may change security without changing any old byte.
    registry.register(&f);
    for target in [&journal.programs[0].target, &desktop.target] {
        crate::storage::secure_windows_path(target).unwrap();
    }
    restore_programs_from_journal(
        f.store.root(),
        &journal.operation_id,
        &journal.record.request.account.identity,
    )
    .unwrap();
    assert!(windows_installation::security_matches(
        &journal.programs[0].target,
        journal.programs[0].windows_security.as_ref().unwrap(),
    ));
    assert!(windows_installation::security_matches(
        &desktop.target,
        desktop.windows_security.as_ref().unwrap(),
    ));
    registry.register(&other);
    assert_eq!(
        restore_programs_from_journal(
            f.store.root(),
            &journal.operation_id,
            &journal.record.request.account.identity,
        )
        .unwrap_err()
        .code,
        "installer_registration"
    );

    // Package-only recovery retains the same owner/ACL and exact sealed paths.
    let package = Fixture::group_owned();
    registry.register(&package);
    package.prepare();
    let prepared: PackageJournal = package.store.read_json(JOURNAL).unwrap().unwrap();
    assert!(prepared.windows_installation.is_some());
    for p in &prepared.programs {
        assert_eq!(
            crate::storage::windows_path_owner(&p.backup).unwrap(),
            prepared.owner_identity
        );
    }
    package.replace();
    std::fs::remove_file(package.runtime.join("webcodex.exe")).unwrap();
    registry.remove();
    rollback_inner(&package.store, &package.runtime).unwrap();
    assert_security(&prepared);

    // Both a group-owned and a user-owned registered parent can receive a
    // group-owned replacement from this token. Admission must seal that fact
    // while the old programs still belong to TokenUser.
    for private_directories in [false, true] {
        let transition = Fixture::group_owned();
        if private_directories {
            crate::storage::secure_windows_path(transition.runtime.parent().unwrap()).unwrap();
            crate::storage::secure_windows_path(&transition.runtime).unwrap();
        }
        for path in targets(&transition.runtime).unwrap().values() {
            crate::storage::secure_windows_path(path).unwrap();
        }
        registry.register(&transition);
        transition.prepare();
        let sealed: PackageJournal = transition.store.read_json(JOURNAL).unwrap().unwrap();
        assert!(sealed.windows_installation.is_some());
        for (name, target) in targets(&transition.runtime).unwrap() {
            std::fs::remove_file(&target).unwrap();
            std::fs::write(
                &target,
                std::fs::read(&transition.candidate.artifacts[&name].path).unwrap(),
            )
            .unwrap();
            assert_eq!(
                crate::storage::windows_path_owner(&target).unwrap(),
                ADMINISTRATORS
            );
        }
        let mut authority = sealed_authority(&sealed, false).unwrap();
        for p in &sealed.programs {
            authority.authorize(&p.target, false).unwrap();
        }
        let failure = finish_inner(&transition.store, &transition.runtime)
            .await
            .unwrap_err();
        // Synthetic fixture bytes deliberately stop at executable validation;
        // the independent full-package smoke supplies real release programs.
        assert_eq!(failure.code, "candidate_architecture");
        rollback_inner(&transition.store, &transition.runtime).unwrap();
        assert_security(&sealed);
    }

    // A group-owned Desktop cannot admit user-owned programs saved elsewhere.
    let mixed = Fixture::group_owned();
    for path in [
        mixed.runtime.join("webcodex.exe"),
        mixed.runtime.join("webcodex-server.exe"),
        mixed.runtime.join("webcodex-runner.exe"),
    ] {
        crate::storage::secure_windows_path(&path).unwrap();
    }
    registry.register(&mixed);
    let mut record = mixed.environment_record();
    let unrelated = Fixture::new();
    record.request.binaries.server = unrelated.runtime.join("webcodex-server.exe");
    mixed.store.save_environment(&record).unwrap();
    assert_eq!(
        classify_inner(&mixed.store, &mixed.runtime)
            .await
            .unwrap_err()
            .code,
        "installer_owner"
    );

    // An unrelated Desktop above an independent user-owned runtime does not
    // make that runtime part of an NSIS installation.
    let standalone = Fixture::group_owned();
    let custom = standalone.runtime.parent().unwrap().join("custom-bin");
    ensure_private_directory(&custom).unwrap();
    let mut record = standalone.environment_record();
    record.request.binaries = RuntimeBinaries {
        cli: custom.join("webcodex.exe"),
        server: custom.join("webcodex-server.exe"),
        runner: custom.join("webcodex-runner.exe"),
    };
    for path in [
        &record.request.binaries.cli,
        &record.request.binaries.server,
        &record.request.binaries.runner,
    ] {
        crate::storage::atomic_private_write(path, b"independent user runtime").unwrap();
    }
    standalone.store.save_environment(&record).unwrap();
    let authority = windows_installation::verify_record(
        &standalone.store,
        &record,
        None,
        Purpose::Admission,
        false,
    )
    .unwrap();
    assert!(authority.binding().is_none());
}
