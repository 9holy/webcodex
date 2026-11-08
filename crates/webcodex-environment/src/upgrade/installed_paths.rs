//! Compare installer locations without changing the paths sealed in saved state.
//! Windows path spelling is not file identity. Resolve only after checking the
//! original path for links, and keep missing recovery suffixes literal.
use super::*;

pub(crate) fn runtime_directory_name(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };
    #[cfg(windows)]
    return name.eq_ignore_ascii_case("webcodex-runtime");
    #[cfg(not(windows))]
    return name == "webcodex-runtime";
}

#[cfg(windows)]
pub(crate) fn existing_directory(path: &Path) -> SetupResultValue<PathBuf> {
    let resolved = windows::resolve(path)?;
    if !resolved.missing.is_empty() || !resolved.directory {
        return Err(error(
            "installer_targets",
            "The installed directory is unavailable",
        ));
    }
    Ok(resolved.canonical)
}

pub(crate) fn same_location(left: &Path, right: &Path) -> SetupResultValue<bool> {
    #[cfg(windows)]
    {
        let left = windows::resolve(left)?;
        let right = windows::resolve(right)?;
        if left.missing != right.missing {
            return Ok(false);
        }
        if left.canonical == right.canonical {
            return Ok(match (left.identity, right.identity) {
                (Some(left), Some(right)) => left == right,
                _ => true,
            });
        }
        if left.canonical.components().next() != right.canonical.components().next() {
            return Ok(false);
        }
        // A directory has one location once links/reparse points are excluded.
        // A file with multiple hard-link names must not authorize replacing a
        // different directory entry merely because its current bytes share an ID.
        Ok(left.identity.is_some()
            && left.identity == right.identity
            && (left.directory && right.directory || left.links == 1 && right.links == 1))
    }
    #[cfg(not(windows))]
    {
        Ok(left == right)
    }
}

#[cfg(windows)]
mod windows {
    use super::*;
    use std::ffi::OsString;
    use std::fs::File;
    use std::os::windows::{ffi::OsStrExt, fs::OpenOptionsExt, io::AsRawHandle};
    use windows_sys::Win32::Storage::FileSystem::{
        FileIdInfo, GetFileInformationByHandle, GetFileInformationByHandleEx,
        BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT,
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_ID_INFO,
        FILE_READ_ATTRIBUTES, FILE_SHARE_READ, FILE_SHARE_WRITE,
    };

    pub(super) struct Location {
        pub(super) canonical: PathBuf,
        pub(super) missing: Vec<OsString>,
        pub(super) identity: Option<(u64, [u8; 16])>,
        pub(super) directory: bool,
        pub(super) links: u32,
        _guard: File,
    }

    pub(super) fn resolve(path: &Path) -> SetupResultValue<Location> {
        // A file ID identifies a file, not a particular NTFS data stream.
        // Program destinations use the default stream only, including while a
        // recovery leaf is absent. Drive-prefix colons are not Normal parts.
        if path.components().any(|part| match part {
            PathComponent::Normal(name) => name.encode_wide().any(|unit| unit == u16::from(b':')),
            _ => false,
        }) {
            return Err(error(
                "installer_targets",
                "Installed program paths must not name alternate data streams",
            ));
        }
        if !path.is_absolute() {
            return Err(error(
                "installer_targets",
                "Installer destinations must be absolute",
            ));
        }
        let mut existing = path;
        let mut missing = Vec::new();
        loop {
            match std::fs::symlink_metadata(existing) {
                Ok(_) => break,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    missing.push(
                        existing
                            .file_name()
                            .ok_or_else(SetupDiagnostic::io)?
                            .to_os_string(),
                    );
                    existing = existing.parent().ok_or_else(SetupDiagnostic::io)?;
                }
                Err(_) => return Err(SetupDiagnostic::io()),
            }
        }
        verify_installed_target_path(existing)?;
        // Attribute access also works for running images. Denying deletion keeps
        // the inspected entry in place while the other spelling is resolved.
        let guard = std::fs::OpenOptions::new()
            .access_mode(FILE_READ_ATTRIBUTES)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS)
            .open(existing)
            .map_err(|_| SetupDiagnostic::io())?;
        let mut info: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
        if unsafe { GetFileInformationByHandle(guard.as_raw_handle().cast(), &mut info) } == 0
            || info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
        {
            return Err(SetupDiagnostic::io());
        }
        let directory = info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY != 0;
        if !missing.is_empty() && !directory {
            return Err(SetupDiagnostic::io());
        }
        // Some supported filesystems cannot provide a 128-bit ID. They can still
        // retain the original exact-canonical comparison, but cannot authorize
        // an additional spelling unless its complete identity is available.
        // Do not truncate IDs to BY_HANDLE_FILE_INFORMATION's 64-bit index.
        let mut identity = std::mem::MaybeUninit::<FILE_ID_INFO>::zeroed();
        let identity = if unsafe {
            GetFileInformationByHandleEx(
                guard.as_raw_handle().cast(),
                FileIdInfo,
                identity.as_mut_ptr().cast(),
                std::mem::size_of::<FILE_ID_INFO>() as u32,
            )
        } != 0
        {
            let identity = unsafe { identity.assume_init() };
            (identity.FileId.Identifier != [0; 16])
                .then_some((identity.VolumeSerialNumber, identity.FileId.Identifier))
        } else {
            None
        };
        let canonical = existing.canonicalize().map_err(|_| SetupDiagnostic::io())?;
        verify_installed_target_path(existing)?;
        verify_installed_target_path(&canonical)?;
        missing.reverse();
        Ok(Location {
            canonical,
            missing,
            identity,
            directory,
            links: info.nNumberOfLinks,
            _guard: guard,
        })
    }
}
