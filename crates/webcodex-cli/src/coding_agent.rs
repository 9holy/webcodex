//! Local operator entry point for preparing the bundled experimental provider.
//! Saving/enabling a provider remains the native configuration owner's job.

use std::path::PathBuf;
use webcodex_environment::codex_app_server::{prepare_codex, PrepareCodexOptions};
use webcodex_environment::{SetupDiagnostic, SetupResultValue};

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub(crate) struct Options {
    pub(crate) config_dir: Option<PathBuf>,
    pub(crate) python_bin: Option<PathBuf>,
    pub(crate) codex_bin: Option<PathBuf>,
    pub(crate) codex_args: Vec<String>,
    pub(crate) expected_version: Option<String>,
    pub(crate) json: bool,
}

pub(crate) fn usage() -> &'static str {
    "Usage: webcodex coding-agent prepare-codex --experimental [OPTIONS]\n\n\
Prepare a reviewable, disabled Codex app-server provider using the installed Codex.\n\
Requires Python 3.10+ and a compatible native Codex CLI. No model call is made.\n\n\
Options:\n\
  --experimental             Explicitly opt into the experimental app-server adapter\n\
  --codex-bin PATH            Codex executable (default: discover codex on PATH)\n\
  --codex-arg VALUE           Fixed launcher argument, repeatable (advanced)\n\
  --python-bin PATH           Python executable (default: discover Python 3.10+)\n\
  --expected-version VERSION Require this exact installed Codex version\n\
  --config-dir PATH           Absolute private configuration directory\n\
  --json                     Print the prepared profile or a safe structured error\n\
  -h, --help                 Show this help\n\n\
Preparation verifies the installed version and its generated schema, then pins\n\
the executable in a private compatibility receipt. It does not enable a provider,\n\
change Runner TOML, grant scopes, log in, or restart a service. Use Desktop's\n\
Coding agents page to review and save the provider through the normal workflow.\n"
}

pub(crate) fn parse(args: &[String]) -> Result<Options, String> {
    if args.first().map(String::as_str) != Some("prepare-codex") {
        return Err("expected `webcodex coding-agent prepare-codex --experimental`".into());
    }
    let mut options = Options::default();
    let mut experimental = false;
    let mut arguments = args[1..].iter();
    while let Some(argument) = arguments.next() {
        match argument.as_str() {
            "--experimental" => experimental = true,
            "--json" => options.json = true,
            "--config-dir" | "--python-bin" | "--codex-bin" | "--expected-version"
            | "--codex-arg" => {
                let value = arguments
                    .next()
                    .ok_or_else(|| format!("{argument} requires a value"))?;
                if value.is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
                    return Err(format!("{argument} has an invalid value"));
                }
                match argument.as_str() {
                    "--config-dir" => options.config_dir = Some(value.into()),
                    "--python-bin" => options.python_bin = Some(value.into()),
                    "--codex-bin" => options.codex_bin = Some(value.into()),
                    "--expected-version" => options.expected_version = Some(value.clone()),
                    _ => options.codex_args.push(value.clone()),
                }
            }
            _ => return Err("unknown coding-agent preparation option; use --help".into()),
        }
    }
    if !experimental {
        return Err(
            "--experimental is required: Codex app-server is an experimental integration".into(),
        );
    }
    if options
        .config_dir
        .as_ref()
        .is_some_and(|path| !path.is_absolute())
    {
        return Err("--config-dir must be an absolute private directory".into());
    }
    if options.codex_args.len() > 8 {
        return Err("at most eight fixed --codex-arg values are supported".into());
    }
    if options.expected_version.as_ref().is_some_and(|value| {
        value.len() > 96
            || !value.as_bytes().first().is_some_and(u8::is_ascii_digit)
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b".+-".contains(&byte))
    }) {
        return Err("--expected-version must be an exact Codex version".into());
    }
    Ok(options)
}

pub(crate) fn run(options: Options) -> SetupResultValue<String> {
    let prepared = prepare_codex(&PrepareCodexOptions {
        config_dir: match options.config_dir {
            Some(path) => path,
            None => webcodex_environment::default_environment_dir()?,
        },
        python_bin: options.python_bin,
        codex_bin: options.codex_bin,
        codex_args: options.codex_args,
        expected_version: options.expected_version,
    })?;
    if options.json {
        serde_json::to_string(&prepared).map_err(|_| {
            SetupDiagnostic::new(
                "codex_profile_encode",
                "The prepared profile could not be displayed",
                "Prepare the provider again from Desktop's Coding agents page",
            )
        })
    } else {
        let profile = serde_json::to_string_pretty(&prepared.profile).map_err(|_| {
            SetupDiagnostic::new(
                "codex_profile_encode",
                "The prepared profile could not be displayed",
                "Prepare the provider again from Desktop's Coding agents page",
            )
        })?;
        Ok(format!(
            "Prepared Codex {}. The provider remains disabled.\n\
Compatibility receipt: {}\n\
Account, model access, and OS sandbox readiness are checked when an authorized Run starts.\n\
Review and save this profile in Desktop's Coding agents page.\n\n{}\n",
            prepared.codex_version, prepared.receipt, profile
        ))
    }
}

#[cfg(test)]
mod tests;
