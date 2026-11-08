use super::*;

pub(super) fn report_restore_difference(
    expected: &WindowsProgramSecurity,
    actual: &WindowsProgramSecurity,
) {
    fn projection(snapshot: &WindowsProgramSecurity) -> SetupResultValue<serde_json::Value> {
        let descriptor = decode(snapshot)?;
        let mut control = 0;
        let mut revision = 0;
        let mut acl = null_mut();
        let mut present = 0;
        let mut defaulted = 0;
        if unsafe { GetSecurityDescriptorControl(descriptor.0, &mut control, &mut revision) } == 0
            || unsafe {
                GetSecurityDescriptorDacl(descriptor.0, &mut present, &mut acl, &mut defaulted)
            } == 0
            || present == 0
            || acl.is_null()
        {
            return Err(invalid());
        }
        let current = current_account()?.identity;
        let count = unsafe { (*acl).AceCount };
        let mut aces = Vec::new();
        for index in 0..count.min(32) {
            let mut ace = null_mut();
            if unsafe { GetAce(acl, u32::from(index), &mut ace) } == 0 || ace.is_null() {
                return Err(invalid());
            }
            let header = unsafe { &*ace.cast::<ACE_HEADER>() };
            let mut mask = None;
            let mut principal = "uninterpreted";
            if matches!(
                u32::from(header.AceType),
                ACCESS_ALLOWED_ACE_TYPE | ACCESS_DENIED_ACE_TYPE
            ) && (header.AceSize as usize) >= std::mem::size_of::<ACCESS_ALLOWED_ACE>()
            {
                let allowed = unsafe { &*ace.cast::<ACCESS_ALLOWED_ACE>() };
                mask = Some(allowed.Mask);
                let sid = sid_string(std::ptr::addr_of!(allowed.SidStart).cast_mut().cast())?;
                principal = if sid == current {
                    "user"
                } else if sid == ADMINISTRATORS {
                    "administrators"
                } else if sid == "S-1-5-18" {
                    "system"
                } else {
                    "other"
                };
            }
            aces.push(serde_json::json!({
                "type": header.AceType,
                "flags": header.AceFlags,
                "size": header.AceSize,
                "mask": mask,
                "principal": principal,
            }));
        }
        Ok(serde_json::json!({
            "dacl_protected": snapshot.dacl_protected,
            "control_flags": control,
            "ace_count": count,
            "aces": aces,
            "truncated": count > 32,
        }))
    }
    eprintln!(
        "{}",
        serde_json::json!({
            "test": "restore_program_security_difference",
            "owner_equal": expected.owner_identity == actual.owner_identity,
            "expected": projection(expected).ok(),
            "actual": projection(actual).ok(),
        })
    );
}

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
fn native_file_creation_with_original_security_keeps_snapshot() {
    let directory = std::env::var_os("LOCALAPPDATA").expect("native per-user directory");
    let temp = tempfile::Builder::new()
        .prefix("webcodex-native-security-create-")
        .tempdir_in(directory)
        .unwrap();
    let user = current_account().unwrap().identity;
    let default_owner = token_owner().unwrap();
    let owner_class = |owner: &str| {
        if owner == ADMINISTRATORS {
            "administrators"
        } else if owner == user {
            "user"
        } else {
            "other"
        }
    };
    let mut mismatches = Vec::new();
    for protected in [false, true] {
        let original = temp.path().join(format!("original-{protected}.exe"));
        std::fs::write(&original, b"original program bytes").unwrap();
        if protected {
            crate::storage::secure_windows_path(&original).unwrap();
        }
        let snapshot = capture(&original).unwrap();
        assert_eq!(snapshot.dacl_protected, protected);
        if protected {
            assert_eq!(snapshot.owner_identity, user);
        } else {
            assert_eq!(snapshot.owner_identity, default_owner);
        }
        let descriptor = decode(&snapshot).unwrap();
        let mut control = 0;
        let mut revision = 0;
        assert_ne!(
            unsafe { GetSecurityDescriptorControl(descriptor.0, &mut control, &mut revision) },
            0
        );
        let destination = temp
            .path()
            .join(format!("recovery-{}.exe", uuid::Uuid::new_v4()));
        let mut remaining = SNAPSHOT_LIMIT;
        copy_bounded_with(&original, &mut remaining, || {
            create_recovery_file(&destination, &snapshot)
        })
        .unwrap();
        let created = capture(&destination).unwrap();
        let creation_exact = created == snapshot;
        // The real recovery path preserves exact creation when possible and
        // finalizes through the supported setter only when it is necessary.
        restore(&destination, &snapshot).unwrap();
        let restored = capture(&destination).unwrap();
        let exact = restored == snapshot;
        eprintln!(
            "{}",
            serde_json::json!({
                "test": "native_create_with_original_security",
                "token_owner": owner_class(&default_owner),
                "original_owner": owner_class(&snapshot.owner_identity),
                "original_protected": protected,
                "original_control_flags": control,
                "creation_exact": creation_exact,
                "exact_snapshot": exact,
            })
        );
        if !exact {
            report_restore_difference(&snapshot, &restored);
            mismatches.push(protected);
        }
        // A failed CREATE_NEW owns neither the name nor its existing contents.
        assert!(create_recovery_file(&destination, &snapshot).is_err());
        assert_eq!(capture(&destination).unwrap(), restored);
        assert_eq!(capture(&original).unwrap(), snapshot);
        assert_eq!(
            std::fs::read(&destination).unwrap(),
            b"original program bytes"
        );
        let rejected = temp.path().join(format!("rejected-{protected}.exe"));
        let mut foreign = snapshot.clone();
        foreign.owner_identity = "S-1-5-18".into();
        assert_eq!(
            create_recovery_file(&rejected, &foreign).unwrap_err().code,
            "installer_owner"
        );
        assert!(!rejected.exists());
        for outside_scope in ["G:BA", "S:(AU;SA;FA;;;WD)"] {
            let mut extra = snapshot.clone();
            extra.descriptor.push_str(outside_scope);
            let wide: Vec<u16> = extra.descriptor.encode_utf16().chain(Some(0)).collect();
            let mut native = null_mut();
            assert_ne!(
                unsafe {
                    ConvertStringSecurityDescriptorToSecurityDescriptorW(
                        wide.as_ptr(),
                        1,
                        &mut native,
                        null_mut(),
                    )
                },
                0,
                "the out-of-scope descriptor must still be valid native SDDL"
            );
            let allocation = Local(native);
            inspect_descriptor(allocation.0).unwrap();
            assert_eq!(
                create_recovery_file(&rejected, &extra).unwrap_err().code,
                "installer_program_acl"
            );
            assert!(!rejected.exists());
        }
    }
    assert!(
        mismatches.is_empty(),
        "native creation changed original protection cases: {mismatches:?}"
    );
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

#[test]
fn owner_rights_only_names_an_admitted_program_owner() {
    let user = current_account().unwrap().identity;
    for owner in [
        user.as_str(),
        ADMINISTRATORS,
        "S-1-5-18",
        "S-1-5-21-1-2-3-1001",
    ] {
        let owner_sddl = if owner == ADMINISTRATORS {
            "BA"
        } else if owner == "S-1-5-18" {
            "SY"
        } else {
            owner
        };
        for (directory, flags) in [(false, ""), (true, "OICI"), (true, "OICIIO")] {
            let snapshot = WindowsProgramSecurity {
                owner_identity: owner.into(),
                descriptor: format!("O:{owner_sddl}D:P(A;;FA;;;SY)(A;;FA;;;BA)(A;{flags};FA;;;OW)"),
                dacl_protected: true,
            };
            validate(&snapshot).unwrap();
            assert_eq!(
                check_writers(&snapshot, &user, directory).is_ok(),
                owner == user.as_str() || owner == ADMINISTRATORS
            );
            // An understood owner-relative entry cannot excuse another writer.
            for extra in ["(A;;FW;;;BU)", "(A;;FA;;;S-1-5-21-1-2-3-1001)"] {
                let mut foreign_writer = snapshot.clone();
                foreign_writer.descriptor.push_str(extra);
                validate(&foreign_writer).unwrap();
                assert!(check_writers(&foreign_writer, &user, directory).is_err());
            }
        }
    }
}

#[test]
fn inherited_owner_rights_survives_native_program_recovery() {
    let directory = std::env::var_os("LOCALAPPDATA").expect("native per-user directory");
    let temp = tempfile::Builder::new()
        .prefix("webcodex-owner-rights-recovery-")
        .tempdir_in(directory)
        .unwrap();
    let user = current_account().unwrap().identity;
    let default_owner = token_owner().unwrap();
    assert!(default_owner == user || default_owner == ADMINISTRATORS);

    // Match the Windows 0700 directory's owner-relative, inheritable DACL.
    // Only this test-owned parent is changed; no production ACL is repaired.
    let text: Vec<u16> = "D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;FA;;;OW)"
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let mut descriptor = null_mut();
    assert_ne!(
        unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                text.as_ptr(),
                1,
                &mut descriptor,
                null_mut(),
            )
        },
        0
    );
    let descriptor = Local(descriptor);
    let mut acl = null_mut();
    let mut present = 0;
    let mut defaulted = 0;
    assert_ne!(
        unsafe { GetSecurityDescriptorDacl(descriptor.0, &mut present, &mut acl, &mut defaulted) },
        0
    );
    assert_ne!(present, 0);
    assert!(!acl.is_null());
    let parent = open(temp.path(), true).unwrap();
    assert_eq!(
        unsafe {
            SetSecurityInfo(
                parent.as_raw_handle().cast(),
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
                null_mut(),
                null_mut(),
                acl,
                null_mut(),
            )
        },
        0
    );
    drop(parent);
    drop(descriptor);

    let runtime = temp.path().join("webcodex-runtime");
    std::fs::create_dir(&runtime).unwrap();
    for path in [temp.path(), runtime.as_path()] {
        let snapshot = capture(path).unwrap();
        assert!(
            snapshot.owner_identity == default_owner,
            "directory owner changed"
        );
        assert!(snapshot.descriptor.contains(";;;OW)"));
        check_writers(&snapshot, &user, true).unwrap();
    }
    for name in ["webcodex", "webcodex-server", "webcodex-runner", "WebCodex"] {
        let parent = if name == "WebCodex" {
            temp.path()
        } else {
            runtime.as_path()
        };
        let original = parent.join(format!("{name}.exe"));
        std::fs::write(&original, b"original owner-relative program").unwrap();
        let snapshot = capture(&original).unwrap();
        assert!(
            snapshot.owner_identity == default_owner,
            "program owner changed"
        );
        assert!(!snapshot.dacl_protected);
        assert!(snapshot.descriptor.contains(";;;OW)"));
        check_writers(&snapshot, &user, false).unwrap();
        let recovered = parent.join(format!("{name}-recovery.exe"));
        let mut remaining = SNAPSHOT_LIMIT;
        copy_bounded_with(&original, &mut remaining, || {
            create_recovery_file(&recovered, &snapshot)
        })
        .unwrap();
        restore(&recovered, &snapshot).unwrap();
        assert!(
            capture(&recovered).unwrap() == snapshot,
            "recovered program security changed"
        );
        assert!(
            capture(&original).unwrap() == snapshot,
            "original program security changed"
        );
        assert_eq!(
            std::fs::read(recovered).unwrap(),
            b"original owner-relative program"
        );
    }
}
