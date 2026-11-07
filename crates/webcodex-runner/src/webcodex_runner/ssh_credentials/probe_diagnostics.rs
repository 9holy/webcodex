//! Closed observations for the fixed authentication probe only. SSH stderr is
//! untrusted: these markers never establish identity, effects, or retry safety.

use std::io::Write;
use std::process::Command;

pub(super) const DIAGNOSTICS_ENV: &str = "WEBCODEX_SSH_PROBE_DIAGNOSTICS";
const MARKER: &str = "webcodex_ssh_askpass:";
const MAX_STDERR_BYTES: usize = 32 * 1024;
const MAX_COUNT: u8 = 16;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum AskpassStage {
    Entered,
    Arguments,
    Nonce,
    Clock,
    RequestPath,
    RequestStore,
    RequestRead,
    RequestDecode,
    Expiry,
    Prompt,
    Consume,
    CredentialRead,
    CredentialDecode,
    Binding,
    Secret,
    Stdout,
    Complete,
}

impl AskpassStage {
    fn name(self) -> &'static str {
        match self {
            Self::Entered => "entered",
            Self::Arguments => "arguments",
            Self::Nonce => "nonce",
            Self::Clock => "clock",
            Self::RequestPath => "request_path",
            Self::RequestStore => "request_store",
            Self::RequestRead => "request_read",
            Self::RequestDecode => "request_decode",
            Self::Expiry => "expiry",
            Self::Prompt => "prompt",
            Self::Consume => "consume",
            Self::CredentialRead => "credential_read",
            Self::CredentialDecode => "credential_decode",
            Self::Binding => "binding",
            Self::Secret => "secret",
            Self::Stdout => "stdout",
            Self::Complete => "complete",
        }
    }

    fn parse(value: &str) -> Option<Self> {
        [
            Self::Entered,
            Self::Arguments,
            Self::Nonce,
            Self::Clock,
            Self::RequestPath,
            Self::RequestStore,
            Self::RequestRead,
            Self::RequestDecode,
            Self::Expiry,
            Self::Prompt,
            Self::Consume,
            Self::CredentialRead,
            Self::CredentialDecode,
            Self::Binding,
            Self::Secret,
            Self::Stdout,
            Self::Complete,
        ]
        .into_iter()
        .find(|stage| stage.name() == value)
    }
}

pub(super) fn record_stage(enabled: bool, stage: AskpassStage, output: &mut impl Write) {
    if enabled {
        // Diagnostics are best effort and must never change authentication.
        let _ = writeln!(output, "{MARKER}{}", stage.name());
    }
}

pub(crate) fn enable_probe_diagnostics(command: &mut Command) {
    command.env(DIAGNOSTICS_ENV, "1");
}

pub(crate) fn probe_failure_summary(stderr: &[u8]) -> String {
    let stderr = &stderr[..stderr.len().min(MAX_STDERR_BYTES)];
    let mut stage = None;
    let mut entries = 0u8;
    let mut key_load = 0u8;
    let mut identity = 0u8;
    let mut spawn = 0u8;
    let mut denied = 0u8;
    let increment = |value: &mut u8| *value = value.saturating_add(1).min(MAX_COUNT);
    for line in String::from_utf8_lossy(stderr).lines() {
        let line = line.trim_end_matches('\r');
        if let Some(observed) = line.strip_prefix(MARKER).and_then(AskpassStage::parse) {
            stage = Some(observed);
            if observed == AskpassStage::Entered {
                increment(&mut entries);
            }
        }
        // Only fixed client-error categories survive; never interpolate any
        // part of a client message, key path, prompt, or remote stderr.
        let lower = line.to_ascii_lowercase();
        if lower.starts_with("load key ") {
            increment(&mut key_load);
        }
        if lower.contains("identity file")
            && (lower.contains("not accessible") || lower.contains("no such file"))
        {
            increment(&mut identity);
        }
        if lower.contains("ssh_askpass:")
            && (lower.contains("posix_spawnp:") || lower.contains("exec("))
        {
            increment(&mut spawn);
        }
        if lower.contains("permission denied (") || lower.contains("authentication failed") {
            increment(&mut denied);
        }
    }
    format!(
        "webcodex_ssh_probe: askpass_stage={} askpass_entries={entries} key_load_errors={key_load} identity_unavailable={identity} askpass_spawn_errors={spawn} authentication_denied={denied}",
        stage.map(AskpassStage::name).unwrap_or("not_observed"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostics_are_opt_in_and_ignore_writer_failure() {
        let mut output = Vec::new();
        record_stage(false, AskpassStage::Entered, &mut output);
        assert!(output.is_empty());
        record_stage(true, AskpassStage::Entered, &mut output);
        assert_eq!(output, b"webcodex_ssh_askpass:entered\n");
        let mut full: &mut [u8] = &mut [];
        record_stage(true, AskpassStage::Prompt, &mut full);
    }

    #[test]
    fn summary_contains_only_closed_observations_and_bounded_counts() {
        let private = "PRIVATE_PATH_OR_PROMPT_OR_SECRET";
        let stderr = format!(
            "webcodex_ssh_askpass:entered\nwebcodex_ssh_askpass:prompt\nLoad key \"{private}\": invalid format\nWarning: Identity file {private} not accessible: No such file\nssh_askpass: posix_spawnp: {private}\n{private}: Permission denied (publickey).\nwebcodex_ssh_askpass:complete {private}\nprefix webcodex_ssh_askpass:complete\n"
        );
        let summary = probe_failure_summary(stderr.as_bytes());
        assert_eq!(summary, "webcodex_ssh_probe: askpass_stage=prompt askpass_entries=1 key_load_errors=1 identity_unavailable=1 askpass_spawn_errors=1 authentication_denied=1");
        assert!(!summary.contains(private));
        assert_eq!(probe_failure_summary(b"webcodex_ssh_askpass:unknown\n"), "webcodex_ssh_probe: askpass_stage=not_observed askpass_entries=0 key_load_errors=0 identity_unavailable=0 askpass_spawn_errors=0 authentication_denied=0");
        let repeated =
            b"webcodex_ssh_askpass:entered\nPermission denied (publickey).\n".repeat(128);
        assert_eq!(probe_failure_summary(&repeated), "webcodex_ssh_probe: askpass_stage=entered askpass_entries=16 key_load_errors=0 identity_unavailable=0 askpass_spawn_errors=0 authentication_denied=16");
        let mut too_late = vec![b'x'; MAX_STDERR_BYTES];
        too_late.extend_from_slice(b"\nwebcodex_ssh_askpass:complete\n");
        assert!(probe_failure_summary(&too_late).contains("askpass_stage=not_observed"));
    }
}
