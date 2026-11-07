use super::*;

#[test]
fn bundled_adapter_is_complete_private_and_reuses_identical_generation() {
    let temp = crate::test_tempdir().unwrap();
    let first = ensure_adapter_resources(temp.path()).unwrap();
    assert!(first.is_absolute());
    verify_sources(first.parent().unwrap()).unwrap();
    assert_eq!(ensure_adapter_resources(temp.path()).unwrap(), first);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            std::fs::metadata(&first).unwrap().permissions().mode() & 0o777,
            0o600
        );
        assert_eq!(
            std::fs::metadata(first.parent().unwrap())
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
    }
}

#[test]
fn altered_installed_code_is_never_silently_overwritten() {
    let temp = crate::test_tempdir().unwrap();
    let entry = ensure_adapter_resources(temp.path()).unwrap();
    std::fs::write(&entry, b"changed-code").unwrap();
    assert_eq!(
        ensure_adapter_resources(temp.path()).unwrap_err().code,
        "codex_adapter_resources_changed"
    );
    assert_eq!(std::fs::read(entry).unwrap(), b"changed-code");
}

#[test]
fn relative_configuration_root_is_rejected_before_writing() {
    assert_eq!(
        ensure_adapter_resources(Path::new("relative"))
            .unwrap_err()
            .code,
        "codex_adapter_path"
    );
}

#[cfg(unix)]
#[test]
fn linked_generation_and_source_are_rejected_without_touching_target() {
    use std::os::unix::fs::symlink;
    let temp = crate::test_tempdir().unwrap();
    let entry = ensure_adapter_resources(temp.path()).unwrap();
    let external = temp.path().join("external.py");
    std::fs::write(&external, b"private-external").unwrap();
    std::fs::remove_file(&entry).unwrap();
    symlink(&external, &entry).unwrap();
    assert!(ensure_adapter_resources(temp.path()).is_err());
    assert_eq!(std::fs::read(&external).unwrap(), b"private-external");

    let another = crate::test_tempdir().unwrap();
    let root = another.path().join("coding-agent-adapters");
    ensure_private_directory(&root).unwrap();
    symlink(
        temp.path(),
        root.join(format!("codex-app-server-{}", source_digest())),
    )
    .unwrap();
    assert!(ensure_adapter_resources(another.path()).is_err());
}
