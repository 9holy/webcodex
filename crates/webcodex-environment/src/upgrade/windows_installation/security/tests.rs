use super::*;

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
