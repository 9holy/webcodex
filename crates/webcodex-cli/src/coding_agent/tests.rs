use super::*;

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

#[test]
fn codex_preparation_requires_explicit_experimental_opt_in() {
    assert!(parse(&args(&["prepare-codex", "--json"]))
        .unwrap_err()
        .contains("--experimental"));
    let parsed = parse(&args(&["prepare-codex", "--experimental", "--json"])).unwrap();
    assert!(parsed.json);
    assert!(parsed.codex_bin.is_none());
    assert!(parsed.python_bin.is_none());
    assert!(parsed.config_dir.is_none());
    assert!(!parsed.allow_network);
}

#[test]
fn codex_preparation_network_is_an_independent_explicit_opt_in() {
    assert!(parse(&args(&["prepare-codex", "--network"])).is_err());
    let parsed = parse(&args(&["prepare-codex", "--experimental", "--network"])).unwrap();
    assert!(parsed.allow_network);
    assert!(parsed.codex_args.is_empty());
    assert!(usage().contains("--network"));
    assert!(parse(&args(&[
        "prepare-codex",
        "--experimental",
        "--network",
        "false"
    ]))
    .is_err());
}

#[test]
fn codex_preparation_parses_fixed_paths_and_exact_version() {
    let directory = std::env::temp_dir();
    let values = vec![
        "prepare-codex".into(),
        "--experimental".into(),
        "--config-dir".into(),
        directory.to_string_lossy().into_owned(),
        "--python-bin".into(),
        "python3".into(),
        "--codex-bin".into(),
        "node".into(),
        "--codex-arg".into(),
        "codex.js".into(),
        "--expected-version".into(),
        "0.167.0-alpha.4".into(),
    ];
    let parsed = parse(&values).unwrap();
    assert_eq!(parsed.config_dir, Some(directory));
    assert_eq!(parsed.codex_bin, Some(PathBuf::from("node")));
    assert_eq!(parsed.codex_args, ["codex.js"]);
    assert_eq!(parsed.expected_version.as_deref(), Some("0.167.0-alpha.4"));
}

#[test]
fn codex_preparation_rejects_ambiguous_or_unbounded_arguments() {
    for values in [
        vec![
            "prepare-codex",
            "--experimental",
            "--config-dir",
            "relative",
        ],
        vec!["prepare-codex", "--experimental", "--python-bin"],
        vec!["prepare-codex", "--experimental", "--enable"],
        vec![
            "prepare-codex",
            "--experimental",
            "--expected-version",
            "latest",
        ],
    ] {
        assert!(parse(&args(&values)).is_err());
    }
    let mut many = args(&["prepare-codex", "--experimental"]);
    for _ in 0..9 {
        many.extend(args(&["--codex-arg", "arg"]));
    }
    assert!(parse(&many).is_err());
}

#[test]
fn codex_preparation_is_reachable_from_the_public_cli() {
    assert!(matches!(
        crate::cli_action(["coding-agent", "prepare-codex", "--experimental", "--json"]),
        crate::CliAction::CodexPrepare(_)
    ));
    assert!(matches!(
        crate::cli_action(["coding-agent", "--help"]),
        crate::CliAction::Exit { code: 0, .. }
    ));
}
