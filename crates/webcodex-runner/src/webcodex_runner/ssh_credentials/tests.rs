use super::*;

fn temporary() -> tempfile::TempDir {
    tempfile::Builder::new()
        .tempdir_in(std::env::temp_dir().canonicalize().unwrap())
        .unwrap()
}

fn endpoint() -> SshEndpoint {
    SshEndpoint {
        host: "127.0.0.1".into(),
        port: 2222,
        user: "fixture-user".into(),
    }
}

fn host_key() -> HostKey {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(&11u32.to_be_bytes());
    bytes.extend_from_slice(b"ssh-ed25519");
    bytes.extend_from_slice(&32u32.to_be_bytes());
    bytes.extend_from_slice(&[7u8; 32]);
    HostKey::parse("ssh-ed25519", &general_purpose::STANDARD.encode(bytes)).unwrap()
}

fn password() -> SshAuthentication {
    SshAuthentication::Password {
        password: SshSecret::new("synthetic password '$` 中文".into()).unwrap(),
    }
}

fn native_askpass_argument(prompt: &[u8]) -> Vec<u8> {
    #[cfg(not(windows))]
    {
        prompt.to_vec()
    }
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStringExt;
        use windows_sys::Win32::Globalization::{MultiByteToWideChar, CP_UTF8};

        let input_length = i32::try_from(prompt.len()).unwrap();
        // Use the same OS conversion and flags as Win32 OpenSSH, independently
        // of the Rust projection under test. The buffers have explicit lengths.
        let length = unsafe {
            MultiByteToWideChar(
                CP_UTF8,
                0,
                prompt.as_ptr(),
                input_length,
                std::ptr::null_mut(),
                0,
            )
        };
        assert!(length > 0);
        let mut wide = vec![0; length as usize];
        let written = unsafe {
            MultiByteToWideChar(
                CP_UTF8,
                0,
                prompt.as_ptr(),
                input_length,
                wide.as_mut_ptr(),
                length,
            )
        };
        assert_eq!(written, length);
        std::ffi::OsString::from_wide(&wide)
            .to_string_lossy()
            .into_owned()
            .into_bytes()
    }
}

#[test]
fn structured_args_pin_exact_host_without_password_in_argv_environment_or_debug() {
    let root = temporary();
    let candidate = ConnectionCandidate::create(
        &root.path().join("private space"),
        endpoint(),
        password(),
        host_key(),
    )
    .unwrap();
    let mut command = Command::new("ssh");
    let lease = candidate
        .connection
        .configure(&mut command, true)
        .unwrap()
        .unwrap();
    let args = command
        .get_args()
        .map(|arg| arg.to_str().unwrap())
        .collect::<Vec<_>>();
    assert!(args.windows(2).any(|pair| pair == ["-p", "2222"]));
    assert!(args.windows(2).any(|pair| pair == ["-l", "fixture-user"]));
    assert!(args.contains(&"StrictHostKeyChecking=yes"));
    assert!(args.contains(&"BatchMode=no"));
    assert!(args.contains(&"KbdInteractiveAuthentication=no"));
    if cfg!(windows) {
        assert!(!args.contains(&"UserKnownHostsFile=${WEBCODEX_SSH_KNOWN_HOSTS_FILE}"));
        assert!(command
            .get_envs()
            .any(|(name, value)| name == KNOWN_HOSTS_PATH_ENV && value.is_none()));
        let executable = std::env::current_exe().unwrap();
        assert_eq!(command.get_current_dir(), executable.parent());
        let helper =
            windows_askpass_leaf(executable.file_name().unwrap().to_str().unwrap()).unwrap();
        assert!(command
            .get_envs()
            .any(|(name, value)| name == "SSH_ASKPASS"
                && value == Some(std::ffi::OsStr::new(&helper))));
    } else {
        assert!(args.contains(&"UserKnownHostsFile=${WEBCODEX_SSH_KNOWN_HOSTS_FILE}"));
        assert!(command
            .get_envs()
            .any(|(name, value)| name == KNOWN_HOSTS_PATH_ENV
                && value.is_some_and(|value| value.to_string_lossy().contains("private space"))));
    }
    let rendered = format!("{command:?} {:?} {lease:?}", candidate.connection);
    assert!(!rendered.contains("synthetic password"));
    assert!(!serde_json::to_string(&candidate.connection.stored)
        .unwrap()
        .contains("synthetic password"));
    let lease_path = lease.store.path(&lease.name).unwrap();
    let nonce = lease
        .name
        .strip_prefix("askpass-")
        .unwrap()
        .strip_suffix(".json")
        .unwrap();
    assert!(askpass_secret(
        &lease_path,
        nonce,
        "Are you sure you want to continue connecting (yes/no)? "
    )
    .is_err());
    assert!(askpass_secret(
        &lease_path,
        nonce,
        "fixture-user@different-host's password: "
    )
    .is_err());
    assert!(askpass_secret(&lease_path, nonce, "Current password: ").is_err());
    assert!(askpass_secret(
        &lease_path,
        nonce,
        format!("fixture-user@webcodex-{}'s password: ", "0".repeat(32))
    )
    .is_err());
    let exact_prompt = format!(
        "fixture-user@{}'s password: ",
        candidate.connection.stored.host_alias()
    );
    let secret = askpass_secret(&lease_path, nonce, &exact_prompt).unwrap();
    assert_eq!(secret.expose_secret(), "synthetic password '$` 中文");
    assert!(matches!(
        askpass_secret(&lease_path, nonce, &exact_prompt),
        Err(AskpassStage::Consume)
    ));
    drop(lease);
    assert!(!lease_path.exists());
}

#[test]
fn helper_rejects_expired_and_cross_profile_credentials() {
    let root = temporary();
    let candidate = ConnectionCandidate::create(
        &root.path().join("private"),
        endpoint(),
        password(),
        host_key(),
    )
    .unwrap();
    let mut command = Command::new("ssh");
    let lease = candidate
        .connection
        .configure(&mut command, true)
        .unwrap()
        .unwrap();
    let nonce = lease
        .name
        .strip_prefix("askpass-")
        .unwrap()
        .strip_suffix(".json")
        .unwrap();
    let path = lease.store.path(&lease.name).unwrap();
    let bytes = lease
        .store
        .read(&lease.name, SECRET_FILE_MAX_BYTES)
        .unwrap();
    let mut request: AskpassRequest = serde_json::from_slice(&bytes).unwrap();
    request.expires_at = 0;
    lease.store.remove(&lease.name).unwrap();
    lease
        .store
        .create(&lease.name, &serde_json::to_vec(&request).unwrap())
        .unwrap();
    assert!(matches!(
        askpass_secret(&path, nonce, "fixture-user@127.0.0.1's password: "),
        Err(AskpassStage::Expiry)
    ));
    request.expires_at = now_seconds().unwrap() + ASKPASS_LIFETIME_SECS;
    request.binding = "a different profile".into();
    lease.store.remove(&lease.name).unwrap();
    lease
        .store
        .create(&lease.name, &serde_json::to_vec(&request).unwrap())
        .unwrap();
    assert!(matches!(
        askpass_secret(&path, nonce, "fixture-user@127.0.0.1's password: "),
        Err(AskpassStage::Binding)
    ));
}

#[test]
fn failed_candidates_clean_files_and_environment_mode_never_prompts() {
    let root = temporary();
    let private = root.path().join("private");
    {
        let candidate = ConnectionCandidate::create(
            &private,
            endpoint(),
            SshAuthentication::ExistingEnvironment,
            host_key(),
        )
        .unwrap();
        let mut command = Command::new("ssh");
        command
            .current_dir(root.path())
            .env("SSH_ASKPASS", "poisoned-helper")
            .env("SSH_ASKPASS_PROMPT", "confirm");
        assert!(candidate
            .connection
            .configure(&mut command, true)
            .unwrap()
            .is_none());
        let args = command
            .get_args()
            .map(|arg| arg.to_str().unwrap())
            .collect::<Vec<_>>();
        assert!(args.contains(&"BatchMode=yes"));
        assert!(args.contains(&"PasswordAuthentication=no"));
        assert_eq!(command.get_current_dir(), Some(root.path()));
        for name in ["SSH_ASKPASS", "SSH_ASKPASS_REQUIRE", "SSH_ASKPASS_PROMPT"] {
            assert!(command
                .get_envs()
                .any(|(key, value)| key == name && value.is_none()));
        }
    }
    assert_eq!(std::fs::read_dir(private).unwrap().count(), 0);
}

#[test]
fn host_key_fingerprint_is_derived_from_wire_key_and_rejects_algorithm_substitution() {
    let key = host_key();
    assert!(key.fingerprint.starts_with("SHA256:"));
    assert_eq!(key.fingerprint.len(), 50);
    assert!(HostKey::parse("ssh-rsa", &key.public_key).is_err());
    assert!(HostKey::parse("ssh-ed25519", "AA==").is_err());
}

#[test]
fn password_prompt_accepts_only_the_exact_user_and_equivalent_endpoint() {
    let request = AskpassRequest {
        nonce: "a".repeat(32),
        expires_at: 0,
        binding: "fixture".into(),
        credential_file: format!("credential-{}.json", "a".repeat(32)),
        authentication: StoredAuthentication::Password,
        endpoint: SshEndpoint {
            host: "EXAMPLE.COM".into(),
            port: 22,
            user: "user@domain".into(),
        },
        host_alias: format!("webcodex-{}", "a".repeat(32)),
        identity_file: None,
    };
    assert!(prompt_matches(
        &request,
        "user@domain@example.com's password: "
    ));
    assert!(!prompt_matches(&request, "other@example.com's password: "));
    assert!(!prompt_matches(
        &request,
        "user@domain@example.com.evil's password: "
    ));
    assert!(!prompt_matches(&request, "New password: "));
    assert!(prompt_matches(
        &request,
        format!("user@domain@{}'s password: ", request.host_alias)
    ));
    assert!(!prompt_matches(
        &request,
        format!("other@{}'s password: ", request.host_alias)
    ));
    assert!(!prompt_matches(
        &request,
        format!("user@domain@webcodex-{}'s password: ", "b".repeat(32))
    ));
    let mut malformed = request;
    malformed.host_alias = format!("webcodex-{}", "b".repeat(32));
    assert!(!prompt_matches(
        &malformed,
        format!("user@domain@{}'s password: ", malformed.host_alias)
    ));
    malformed.host_alias = "arbitrary-alias".into();
    assert!(!prompt_matches(
        &malformed,
        "user@domain@arbitrary-alias's password: "
    ));
}

#[test]
fn windows_key_prompt_preserves_the_exact_truncated_path_representation() {
    // Win32 OpenSSH truncates UTF-8 before converting the whole command line to
    // UTF-16. Every possible partial suffix below becomes exactly one U+FFFD.
    for (character, included_bytes) in [("中", 1), ("中", 2), ("😀", 1), ("😀", 2), ("😀", 3)]
    {
        let prefix = format!("/{}", "a".repeat(99 - included_bytes));
        let path = format!("{prefix}{character}/private-key");
        let mut raw = b"Enter passphrase for key '".to_vec();
        raw.extend_from_slice(&path.as_bytes()[..100]);
        raw.extend_from_slice(b"': ");
        assert!(std::str::from_utf8(&raw).is_err());
        let native = format!("Enter passphrase for key '{prefix}\u{fffd}': ");
        #[cfg(windows)]
        assert_eq!(native_askpass_argument(&raw), native.as_bytes());
        assert!(key_prompt_matches(&path, native.as_bytes(), true));
        assert!(!key_prompt_matches(&path, native.as_bytes(), false));
        assert!(key_prompt_matches(&path, &raw, false));
        assert!(!key_prompt_matches(&path, &raw, true));
        assert!(key_prompt_matches(
            &path,
            format!("Enter passphrase for key '{path}': ").as_bytes(),
            true,
        ));
        for unexpected in [
            format!("Enter passphrase for key '{prefix}': "),
            format!("Enter passphrase for key '{prefix}\u{fffd}\u{fffd}': "),
            format!("Enter passphrase for key 'other-{prefix}\u{fffd}': "),
            format!(
                "Enter passphrase for key '{}\u{fffd}': ",
                prefix.replacen('a', "\u{fffd}", 1)
            ),
            "Enter passphrase: ".to_string(),
        ] {
            assert!(!key_prompt_matches(&path, unexpected.as_bytes(), true));
        }
    }
}

#[test]
fn key_prompt_matches_only_the_selected_key_including_openssh_byte_truncation() {
    // The 100th byte splits the final Chinese character. The helper must not
    // panic during argv decoding or accidentally accept a generic key prompt.
    let path = format!("/{}中文/private-key", "a".repeat(98));
    assert!(std::str::from_utf8(&path.as_bytes()[..100]).is_err());
    let request = AskpassRequest {
        nonce: "a".repeat(32),
        expires_at: 0,
        binding: "fixture".into(),
        credential_file: format!("credential-{}.json", "a".repeat(32)),
        authentication: StoredAuthentication::IdentityFile,
        endpoint: endpoint(),
        host_alias: format!("webcodex-{}", "a".repeat(32)),
        identity_file: Some(path.clone()),
    };
    let mut prompt = b"Enter passphrase for key '".to_vec();
    prompt.extend_from_slice(&path.as_bytes()[..100]);
    prompt.extend_from_slice(b"': ");
    let mut prompt = native_askpass_argument(&prompt);
    assert!(prompt_matches(&request, &prompt));
    assert!(prompt_matches(
        &request,
        format!("Enter passphrase for key '{path}': ")
    ));
    assert!(!prompt_matches(
        &request,
        "Enter passphrase for key '/other-key': "
    ));
    assert!(!prompt_matches(&request, "Enter passphrase: "));
    prompt[25] = b'x';
    assert!(!prompt_matches(&request, &prompt));
}

#[test]
fn key_passphrase_is_bound_to_the_selected_request_and_released_once() {
    let root = temporary();
    let private = root.path().join("private-中文");
    let store = PrivateFileStore::open(&private).unwrap();
    let identity = store
        .create("selected-key", b"synthetic key placeholder")
        .unwrap();
    let identity_path = identity.to_str().unwrap();
    let candidate = ConnectionCandidate::create(
        &private,
        endpoint(),
        SshAuthentication::IdentityFile {
            path: identity_path.to_string(),
            passphrase: Some(SshSecret::new("synthetic key passphrase".into()).unwrap()),
        },
        host_key(),
    )
    .unwrap();
    let mut command = Command::new("ssh");
    let lease = candidate
        .connection
        .configure(&mut command, true)
        .unwrap()
        .unwrap();
    let request_path = lease.store.path(&lease.name).unwrap();
    let nonce = lease
        .name
        .strip_prefix("askpass-")
        .unwrap()
        .strip_suffix(".json")
        .unwrap();
    for unexpected in [
        "Enter passphrase: ",
        "Enter passphrase for key '/other-key': ",
        "fixture-user@127.0.0.1's password: ",
    ] {
        assert!(askpass_secret(&request_path, nonce, unexpected).is_err());
    }
    let mut raw = b"Enter passphrase for key '".to_vec();
    raw.extend_from_slice(&identity_path.as_bytes()[..identity_path.len().min(100)]);
    raw.extend_from_slice(b"': ");
    let prompt = native_askpass_argument(&raw);
    let secret = askpass_secret(&request_path, nonce, &prompt).unwrap();
    assert_eq!(secret.expose_secret(), "synthetic key passphrase");
    assert!(askpass_secret(&request_path, nonce, &prompt).is_err());
}

#[test]
fn structured_paths_preserve_percent_tokens_environment_syntax_and_spaces() {
    let root = temporary();
    let private = root.path().join("private 中文 %q ${NOT_A_VARIABLE} space");
    let store = PrivateFileStore::open(&private).unwrap();
    let identity = store
        .create("fixture-key", b"synthetic key placeholder")
        .unwrap();
    let candidate = ConnectionCandidate::create(
        &private,
        endpoint(),
        SshAuthentication::IdentityFile {
            path: identity.to_str().unwrap().to_string(),
            passphrase: Some(SshSecret::new("synthetic passphrase".into()).unwrap()),
        },
        host_key(),
    )
    .unwrap();
    let mut command = Command::new("ssh");
    command
        .env(KNOWN_HOSTS_PATH_ENV, "poisoned-hosts")
        .env(IDENTITY_PATH_ENV, "poisoned-identity")
        .env(LITERAL_DOLLAR_ENV, "poisoned-expansion")
        .env("SSH_ASKPASS_PROMPT", "confirm");
    let _lease = candidate.connection.configure(&mut command, true).unwrap();
    let args = command
        .get_args()
        .map(|arg| arg.to_str().unwrap())
        .collect::<Vec<_>>();
    assert!(!args.contains(&"-i"));
    let hosts = store
        .path(&candidate.connection.stored.known_hosts_name())
        .unwrap();
    assert!(
        args.contains(&format!("GlobalKnownHostsFile={}", option_path(&hosts).unwrap()).as_str())
    );
    if cfg!(windows) {
        assert!(args.contains(
            &format!(
                "UserKnownHostsFile={}",
                windows_expanding_option_path(&hosts).unwrap()
            )
            .as_str()
        ));
        assert!(args.contains(
            &format!(
                "IdentityFile={}",
                windows_expanding_option_path(&identity).unwrap()
            )
            .as_str()
        ));
        for name in [KNOWN_HOSTS_PATH_ENV, IDENTITY_PATH_ENV] {
            assert!(command
                .get_envs()
                .any(|(key, value)| key == name && value.is_none()));
        }
        assert!(command.get_envs().any(|(key, value)| {
            key == LITERAL_DOLLAR_ENV && value == Some(std::ffi::OsStr::new("$"))
        }));
    } else {
        assert!(args.contains(&"UserKnownHostsFile=${WEBCODEX_SSH_KNOWN_HOSTS_FILE}"));
        assert!(args.contains(&"IdentityFile=${WEBCODEX_SSH_IDENTITY_FILE}"));
        assert!(command
            .get_envs()
            .any(|(name, value)| name == KNOWN_HOSTS_PATH_ENV && value == Some(hosts.as_os_str())));
        assert!(command
            .get_envs()
            .any(|(name, value)| name == IDENTITY_PATH_ENV && value == Some(identity.as_os_str())));
    }
    assert!(command
        .get_envs()
        .any(|(name, value)| name == "SSH_ASKPASS_PROMPT" && value.is_none()));
    assert!(!format!("{command:?}").contains("synthetic passphrase"));
    assert!(!format!("{command:?}").contains("poisoned-"));
}

#[test]
fn windows_paths_use_unicode_arguments_and_only_an_ascii_literal_environment_value() {
    let mut command = Command::new("ssh");
    command
        .env(KNOWN_HOSTS_PATH_ENV, "poisoned-hosts")
        .env(IDENTITY_PATH_ENV, "poisoned-identity")
        .env("WEBCODEX_SSH_LITERAL_DOLLAR", "poisoned-expansion");
    configure_path_arguments(
        &mut command,
        Path::new(r"C:\profiles\中文 %q ${HOME}\hosts"),
        Some(r"C:\keys\長 %% ${OTHER}\selected-key"),
        true,
    )
    .unwrap();
    let args = command
        .get_args()
        .map(|arg| arg.to_str().unwrap())
        .collect::<Vec<_>>();
    assert!(args.contains(
        &r#"UserKnownHostsFile="C:\\profiles\\中文 %%q ${WEBCODEX_SSH_LITERAL_DOLLAR}{HOME}\\hosts""#
    ));
    assert!(args.contains(
        &r#"IdentityFile="C:\\keys\\長 %%%% ${WEBCODEX_SSH_LITERAL_DOLLAR}{OTHER}\\selected-key""#
    ));
    assert!(args.contains(&r#"GlobalKnownHostsFile="C:\\profiles\\中文 %q ${HOME}\\hosts""#));
    assert!(!args.contains(&"-i"));
    for name in [KNOWN_HOSTS_PATH_ENV, IDENTITY_PATH_ENV] {
        assert!(command
            .get_envs()
            .any(|(key, value)| key == name && value.is_none()));
    }
    assert!(command.get_envs().any(|(key, value)| {
        key == "WEBCODEX_SSH_LITERAL_DOLLAR" && value == Some(std::ffi::OsStr::new("$"))
    }));
}

#[test]
fn windows_path_encoding_has_independent_literal_vectors_and_bounded_failure() {
    for (input, expected) in [
        ("%q", r#""%%q""#),
        ("%%", r#""%%%%""#),
        ("${HOME}", r#""${WEBCODEX_SSH_LITERAL_DOLLAR}{HOME}""#),
        (
            "$$",
            r#""${WEBCODEX_SSH_LITERAL_DOLLAR}${WEBCODEX_SSH_LITERAL_DOLLAR}""#,
        ),
        (
            r#"C:\中文\key "quoted".pem"#,
            r#""C:\\中文\\key \"quoted\".pem""#,
        ),
        ("C:/中文/space key", r#""C:/中文/space key""#),
    ] {
        assert_eq!(
            windows_expanding_option_path(Path::new(input)).unwrap(),
            expected
        );
    }
    for invalid in [
        "key\npath",
        "key\rpath",
        "key\tpath",
        "key\0path",
        "key\u{1b}path",
    ] {
        assert_eq!(
            windows_expanding_option_path(Path::new(invalid)),
            Err("ssh_credentials_unavailable")
        );
    }
    // Each component is a valid Windows leaf length and the original is below
    // the identity input ceiling, but its dollar expansion is not expressible.
    let dense = format!("C:\\{}", vec!["$".repeat(128); 9].join("\\"));
    assert!(dense.len() < 4096);
    assert_eq!(
        windows_expanding_option_path(Path::new(&dense)),
        Err("ssh_credentials_unavailable")
    );
}

#[test]
fn windows_final_command_budget_counts_utf16_quotes_every_argument_and_nul() {
    // Independent golden boundary: 1 NUL + 5 quoted program units +
    // 2 * 16379 argument units + 3 separator/quote units = 32767.
    let mut boundary = Command::new("ssh");
    boundary.arg("a".repeat(16379));
    assert!(validate_windows_command(&boundary).is_ok());
    boundary.arg("");
    assert_eq!(
        validate_windows_command(&boundary),
        Err("ssh_credentials_unavailable")
    );

    let mut too_long = Command::new("ssh");
    too_long.arg("a".repeat(16380));
    assert!(validate_windows_command(&too_long).is_err());
    let mut unicode = Command::new("ssh");
    unicode.arg("🙂".repeat(8189));
    assert!(validate_windows_command(&unicode).is_ok());
    unicode.arg("x");
    assert!(validate_windows_command(&unicode).is_err());
    let mut escaped = Command::new("ssh");
    escaped.arg("\"\\".repeat(8190));
    assert!(validate_windows_command(&escaped).is_err());
    let long_program = Command::new("s".repeat(32765));
    assert!(validate_windows_command(&long_program).is_err());
    assert!(windows_utf16_units(std::ffi::OsStr::new("before\0after")).is_err());
    #[cfg(windows)]
    {
        // Windows retains the OsString argument. Unix replaces an invalid
        // CString with an empty placeholder and rejects it at spawn instead,
        // so get_args() cannot expose that original NUL to this validator.
        let mut invalid = Command::new("ssh");
        invalid.arg("before\0after");
        assert!(validate_windows_command(&invalid).is_err());
    }
}

#[test]
fn windows_askpass_uses_only_the_actual_safe_image_leaf_in_its_own_child_cwd() {
    let root = temporary();
    let caller = root.path().join("caller directory");
    let executable = root
        .path()
        .join("中文 image directory")
        .join("runner-copy_1.EXE");
    let mut command = Command::new("ssh");
    command
        .current_dir(&caller)
        .env("SSH_ASKPASS", "poisoned-helper");
    configure_askpass_program(&mut command, &executable, true).unwrap();
    assert_eq!(command.get_current_dir(), executable.parent());
    assert_eq!(command.get_program(), std::ffi::OsStr::new("ssh"));
    assert!(command.get_envs().any(|(name, value)| {
        name == "SSH_ASKPASS" && value == Some(std::ffi::OsStr::new(r".\runner-copy_1.EXE"))
    }));
    for name in [
        ".exe",
        "runner.exe other.exe",
        "runner.exe\"extra",
        "runner.exe\\other.exe",
        "nested/runner.exe",
        "runner:other.exe",
        "runner%q.exe",
        "runner$X.exe",
        "runner;other.exe",
        "中文.exe",
        "runner",
        "runner.exe ",
    ] {
        assert!(
            windows_askpass_leaf(name).is_err(),
            "ambiguous helper leaf was accepted"
        );
    }
    let mut rejected = Command::new("ssh");
    rejected
        .current_dir(&caller)
        .env("SSH_ASKPASS", "original-helper");
    assert!(configure_askpass_program(&mut rejected, Path::new("relative.exe"), true).is_err());
    assert!(configure_askpass_program(
        &mut rejected,
        &root.path().join("runner.exe other.exe"),
        true
    )
    .is_err());
    assert_eq!(rejected.get_current_dir(), Some(caller.as_path()));
    assert!(rejected.get_envs().any(|(name, value)| {
        name == "SSH_ASKPASS" && value == Some(std::ffi::OsStr::new("original-helper"))
    }));

    let mut unix = Command::new("ssh");
    unix.current_dir(&caller);
    configure_askpass_program(&mut unix, &executable, false).unwrap();
    assert_eq!(unix.get_current_dir(), Some(caller.as_path()));
    assert!(unix
        .get_envs()
        .any(|(name, value)| { name == "SSH_ASKPASS" && value == Some(executable.as_os_str()) }));
}

#[test]
fn managed_command_without_an_authentication_lease_keeps_its_original_cwd() {
    let root = temporary();
    let candidate = ConnectionCandidate::create(
        &root.path().join("private"),
        endpoint(),
        password(),
        host_key(),
    )
    .unwrap();
    let mut command = Command::new("ssh");
    command
        .current_dir(root.path())
        .env("SSH_ASKPASS_PROMPT", "confirm");
    assert!(candidate
        .connection
        .configure(&mut command, false)
        .unwrap()
        .is_none());
    assert_eq!(command.get_current_dir(), Some(root.path()));
    for name in [
        "SSH_ASKPASS",
        "SSH_ASKPASS_REQUIRE",
        "SSH_ASKPASS_PROMPT",
        ASKPASS_REQUEST_ENV,
        ASKPASS_NONCE_ENV,
    ] {
        assert!(command
            .get_envs()
            .any(|(key, value)| key == name && value.is_none()));
    }
}
