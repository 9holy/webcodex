use super::*;

#[test]
fn native_sddl_buffer_capacity_is_not_the_string_length() {
    let expected = "O:BAD:P(A;;FA;;;BA)";
    let mut buffer: Vec<u16> = expected.encode_utf16().chain(Some(0)).collect();
    // Allocated capacity may extend beyond the initialized native string. Its
    // contents must never become part of the persisted security descriptor.
    buffer.extend([0xd800, 0xffff, 0]);
    assert_eq!(
        unsafe { descriptor_string(buffer.as_ptr(), buffer.len()) }.unwrap(),
        expected
    );
    for malformed in [vec![0], vec![b'O' as u16], vec![0xd800, 0]] {
        assert!(unsafe { descriptor_string(malformed.as_ptr(), malformed.len()) }.is_err());
    }
    assert!(unsafe { descriptor_string(std::ptr::null(), 1) }.is_err());
    assert!(unsafe { descriptor_string(buffer.as_ptr(), 0) }.is_err());
    assert!(unsafe { descriptor_string(buffer.as_ptr(), MAX_DESCRIPTOR + 1) }.is_err());
}

#[test]
fn native_private_file_and_directory_security_round_trip() {
    let temp = crate::test_tempdir().unwrap();
    let directory = temp.path().join("security-round-trip");
    ensure_private_directory(&directory).unwrap();
    let file = directory.join("program.exe");
    std::fs::write(&file, b"owned security fixture").unwrap();
    crate::storage::secure_windows_path(&file).unwrap();
    let owner = current_account().unwrap().identity;
    for path in [&directory, &file] {
        let snapshot = capture(path).expect("capture native Owner and DACL");
        assert_eq!(snapshot.owner_identity, owner);
        assert!(snapshot.dacl_protected);
        assert!(!snapshot.descriptor.contains('\0'));
        validate(&snapshot).expect("captured descriptor must decode without changing its fields");
        assert_eq!(capture(path).unwrap(), snapshot);
    }
}

#[test]
fn writer_policy_understands_inheritance_and_rejects_uninterpreted_allow_aces() {
    let owner = current_account().unwrap().identity;
    let snapshot = |extra: &str| WindowsProgramSecurity {
        owner_identity: ADMINISTRATORS.into(),
        descriptor: format!("O:BAD:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;{owner}){extra}"),
        dacl_protected: true,
    };
    for (extra, directory, accepted) in [
        ("(A;;FRFX;;;BU)", false, true),
        ("(A;;FW;;;BU)", false, false),
        ("(A;;FA;;;S-1-5-21-1-2-3-1001)", false, false),
        ("(D;;FA;;;BU)", false, true),
        ("(A;OICIIO;FA;;;CO)", true, true),
        ("(A;;FA;;;CO)", true, false),
        ("(A;OICIIO;FA;;;BU)", true, false),
        ("(A;OICIIO;FA;;;BU)", false, true),
        (
            "(OA;;FR;01234567-89ab-cdef-0123-456789abcdef;;BA)",
            false,
            false,
        ),
    ] {
        let descriptor = snapshot(extra);
        // These are valid native descriptors; a rejection must come from the
        // understood writer policy rather than invalid fixture syntax.
        validate(&descriptor).unwrap();
        assert_eq!(
            check_writers(&descriptor, &owner, directory).is_ok(),
            accepted
        );
    }
    let mut invalid = snapshot("");
    invalid.descriptor = "O:BAD:NO_ACCESS_CONTROL".into();
    invalid.dacl_protected = false;
    assert!(validate(&invalid).is_err());
    let mut invalid = snapshot("");
    invalid.dacl_protected = false;
    assert!(validate(&invalid).is_err());
    let mut invalid = snapshot("");
    invalid.descriptor = " ".repeat(MAX_DESCRIPTOR + 1);
    assert!(validate(&invalid).is_err());
}
