//! Literal-argument, allowlisted navigation. No cmd/sh/PowerShell interpolation.
use crate::error::{DesktopError, DesktopResult};
use std::path::Path;

fn unavailable() -> DesktopError {
    DesktopError::new(
        "diagnostic_location_unavailable",
        "The selected location could not be opened",
        "Open the corresponding Runtime or app-data location with your system file manager.",
    )
}

pub fn directory(path: &Path) -> DesktopResult<()> {
    let path = path.canonicalize().map_err(|_| unavailable())?;
    if !path.is_dir() {
        return Err(unavailable());
    }
    open_literal(path.as_os_str())
}

pub fn url(url: &str) -> DesktopResult<()> {
    validate_url(url)?;
    open_literal(std::ffi::OsStr::new(url))
}

pub(crate) fn validate_url(url: &str) -> DesktopResult<()> {
    let parsed = url::Url::parse(url).map_err(|_| unavailable())?;
    let local = matches!(
        parsed.host_str(),
        Some("localhost" | "127.0.0.1" | "[::1]" | "::1")
    );
    let github = parsed.scheme() == "https"
        && parsed.host_str() == Some("github.com")
        && parsed.port().is_none()
        && [
            webcodex_core::build_info::RELEASE_REPOSITORY,
            webcodex_core::build_info::UPSTREAM_REPOSITORY,
        ]
        .into_iter()
        .any(|repository| {
            let root = format!("/{repository}");
            parsed.path() == root || parsed.path().starts_with(&format!("{root}/"))
        });
    if (!local && !github)
        || !matches!(parsed.scheme(), "http" | "https")
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err(unavailable());
    }
    if local && parsed.path() != "/runtime" && parsed.path() != "/runtime/" {
        return Err(unavailable());
    }
    Ok(())
}

fn open_literal(target: &std::ffi::OsStr) -> DesktopResult<()> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::Shell::ShellExecuteW;
        let file: Vec<u16> = target.encode_wide().chain(Some(0)).collect();
        let verb: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
        let result = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                verb.as_ptr(),
                file.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1,
            )
        };
        if (result as isize) <= 32 {
            return Err(unavailable());
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::{Command, Stdio};
        let mut command = Command::new(if cfg!(target_os = "macos") {
            "/usr/bin/open"
        } else {
            "xdg-open"
        });
        command
            .arg(target)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        // Only start the OS launcher; do not manage/terminate the user's browser
        // or file manager as if it were a Desktop-owned Runtime process.
        let mut child = command.spawn().map_err(|_| unavailable())?;
        std::thread::spawn(move || {
            let _ = child.wait();
        });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_navigation_admits_only_the_compiled_publisher_and_upstream() {
        let publisher = webcodex_core::build_info::RELEASE_REPOSITORY;
        for repository in [publisher, webcodex_core::build_info::UPSTREAM_REPOSITORY] {
            for suffix in ["", "/releases", "/releases/latest", "/issues/new"] {
                assert!(validate_url(&format!("https://github.com/{repository}{suffix}")).is_ok());
            }
        }
        for url in [
            format!("https://github.com/{publisher}-untrusted/releases"),
            format!("https://github.com/{publisher}?redirect=other"),
            format!("https://github.com/{publisher}#fragment"),
            format!("http://github.com/{publisher}"),
            format!("https://github.com:8443/{publisher}"),
            format!("https://user@github.com/{publisher}"),
            format!("https://github.com.invalid/{publisher}"),
        ] {
            assert!(validate_url(&url).is_err(), "{url}");
        }
        assert!(validate_url("http://127.0.0.1:4000/runtime").is_ok());
        assert!(validate_url("http://127.0.0.1:4000/admin").is_err());
    }
}
