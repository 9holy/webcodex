//! Immutable, bounded private files for native runtime credentials.
//!
//! Callers choose a private directory, but only generated flat file names may
//! be accessed through this API. Existing files and directories are validated;
//! their ownership or access policy is never repaired implicitly.

use crate::storage::{
    ensure_private_directory, open_existing_private, open_private,
    validate_existing_private_directory,
};
use crate::{SetupDiagnostic, SetupResultValue};
use fs2::FileExt;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub const PRIVATE_FILE_MAX_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone)]
pub struct PrivateFileStore {
    root: PathBuf,
}

pub struct PrivateFileLease {
    _file: std::fs::File,
    root: PathBuf,
    name: String,
    exclusive: bool,
}

impl std::fmt::Debug for PrivateFileLease {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("PrivateFileLease")
    }
}

impl Drop for PrivateFileLease {
    fn drop(&mut self) {
        // A concurrent fork can retain this open-file description until exec.
        // Release the retired guard's lock before closing its handle, rather
        // than extending its lifetime through that unrelated inherited fd.
        // Separately opened leases retain their own locks and still fence GC.
        let _ = FileExt::unlock(&self._file);
    }
}

impl PrivateFileStore {
    pub fn open(root: &Path) -> SetupResultValue<Self> {
        ensure_private_directory(root)?;
        #[cfg(unix)]
        if let Some(parent) = root.parent() {
            std::fs::File::open(parent)
                .and_then(|directory| directory.sync_all())
                .map_err(|_| SetupDiagnostic::io())?;
        }
        Ok(Self {
            root: root.to_path_buf(),
        })
    }

    pub fn existing(root: &Path) -> SetupResultValue<Self> {
        validate_existing_private_directory(root)?;
        Ok(Self {
            root: root.to_path_buf(),
        })
    }

    /// The name is metadata, never a caller-supplied filesystem path.
    pub fn path(&self, name: &str) -> SetupResultValue<PathBuf> {
        if name.is_empty()
            || name.len() > 128
            || name.starts_with('.')
            || name.contains("..")
            || !name
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
        {
            return Err(SetupDiagnostic::io());
        }
        Ok(self.root.join(name))
    }

    pub fn create(&self, name: &str, bytes: &[u8]) -> SetupResultValue<PathBuf> {
        if bytes.len() > PRIVATE_FILE_MAX_BYTES {
            return Err(SetupDiagnostic::io());
        }
        validate_existing_private_directory(&self.root)?;
        let path = self.path(name)?;
        let mut file = open_private(&path, true)?;
        if file
            .write_all(bytes)
            .and_then(|()| file.sync_all())
            .is_err()
        {
            drop(file);
            let _ = std::fs::remove_file(&path);
            return Err(SetupDiagnostic::io());
        }
        #[cfg(unix)]
        if std::fs::File::open(&self.root)
            .and_then(|directory| directory.sync_all())
            .is_err()
        {
            drop(file);
            let _ = std::fs::remove_file(&path);
            return Err(SetupDiagnostic::io());
        }
        Ok(path)
    }

    pub fn read(&self, name: &str, limit: usize) -> SetupResultValue<Vec<u8>> {
        if limit > PRIVATE_FILE_MAX_BYTES {
            return Err(SetupDiagnostic::io());
        }
        validate_existing_private_directory(&self.root)?;
        let path = self.path(name)?;
        // Windows path-based ACL validation must examine the same file that is
        // read. Keep a no-reparse, no-write/no-delete handle for the whole read.
        #[cfg(windows)]
        let _guard = windows_read_guard(&path, false)?;
        let mut file = open_existing_private(&path, false)?;
        if file.metadata().map_err(|_| SetupDiagnostic::io())?.len() > limit as u64 {
            return Err(SetupDiagnostic::io());
        }
        let mut bytes = Vec::new();
        Read::by_ref(&mut file)
            .take(limit as u64 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| SetupDiagnostic::io())?;
        if bytes.len() > limit {
            return Err(SetupDiagnostic::io());
        }
        Ok(bytes)
    }

    /// Remove only a validated private, regular, single-link file in this store.
    pub fn remove(&self, name: &str) -> SetupResultValue<()> {
        validate_existing_private_directory(&self.root)?;
        let path = self.path(name)?;
        if !path.try_exists().map_err(|_| SetupDiagnostic::io())? {
            return Ok(());
        }
        self.read(name, PRIVATE_FILE_MAX_BYTES)?;
        std::fs::remove_file(path).map_err(|_| SetupDiagnostic::io())
    }

    pub fn shared_lease(&self, name: &str) -> SetupResultValue<PrivateFileLease> {
        self.lease(name, false)?.ok_or_else(SetupDiagnostic::io)
    }

    pub fn try_exclusive_lease(&self, name: &str) -> SetupResultValue<Option<PrivateFileLease>> {
        self.lease(name, true)
    }

    fn lease(&self, name: &str, exclusive: bool) -> SetupResultValue<Option<PrivateFileLease>> {
        validate_existing_private_directory(&self.root)?;
        let path = self.path(name)?;
        #[cfg(windows)]
        let file = {
            let guard = windows_read_guard(&path, true)?;
            // Check the owner/DACL while the guard fences path replacement.
            drop(open_existing_private(&path, false)?);
            guard
        };
        #[cfg(not(windows))]
        let file = open_existing_private(&path, false)?;
        let locked = if exclusive {
            FileExt::try_lock_exclusive(&file)
        } else {
            FileExt::try_lock_shared(&file)
        };
        if locked.is_err() {
            return Ok(None);
        }
        Ok(Some(PrivateFileLease {
            _file: file,
            root: self.root.clone(),
            name: name.into(),
            exclusive,
        }))
    }

    /// Delete the exact already-validated file while its exclusive lease still
    /// excludes other processes. Windows byte-range locks prohibit reading it
    /// through a second handle, so do not reopen it during this removal.
    pub fn remove_leased(&self, lease: &PrivateFileLease) -> SetupResultValue<()> {
        if !lease.exclusive || lease.root != self.root {
            return Err(SetupDiagnostic::io());
        }
        validate_existing_private_directory(&self.root)?;
        std::fs::remove_file(self.path(&lease.name)?).map_err(|_| SetupDiagnostic::io())
    }

    pub fn file_names(&self, limit: usize) -> SetupResultValue<Vec<String>> {
        if limit > 512 {
            return Err(SetupDiagnostic::io());
        }
        validate_existing_private_directory(&self.root)?;
        let mut names = Vec::new();
        for entry in std::fs::read_dir(&self.root)
            .map_err(|_| SetupDiagnostic::io())?
            .take(limit)
        {
            let entry = entry.map_err(|_| SetupDiagnostic::io())?;
            if let Some(name) = entry
                .file_name()
                .to_str()
                .filter(|name| self.path(name).is_ok())
            {
                names.push(name.to_string());
            }
        }
        Ok(names)
    }
}

#[cfg(windows)]
fn windows_read_guard(path: &Path, allow_delete: bool) -> SetupResultValue<std::fs::File> {
    use std::os::windows::{fs::OpenOptionsExt, io::AsRawHandle};
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_DIRECTORY,
        FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_DELETE,
        FILE_SHARE_READ,
    };
    let file = std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .share_mode(FILE_SHARE_READ | if allow_delete { FILE_SHARE_DELETE } else { 0 })
        .open(path)
        .map_err(|_| SetupDiagnostic::io())?;
    let mut information = std::mem::MaybeUninit::<BY_HANDLE_FILE_INFORMATION>::uninit();
    if unsafe { GetFileInformationByHandle(file.as_raw_handle().cast(), information.as_mut_ptr()) }
        == 0
    {
        return Err(SetupDiagnostic::io());
    }
    let information = unsafe { information.assume_init() };
    if information.dwFileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT) != 0
        || information.nNumberOfLinks != 1
    {
        return Err(SetupDiagnostic::io());
    }
    Ok(file)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn retired_leases_release_inherited_open_file_descriptions() {
        for exclusive in [false, true] {
            let temporary = crate::test_tempdir().unwrap();
            let store = PrivateFileStore::open(&temporary.path().join("private")).unwrap();
            let path = store
                .create("hosts.txt", b"pinned-public-host-key")
                .unwrap();
            let lease = if exclusive {
                store.try_exclusive_lease("hosts.txt").unwrap().unwrap()
            } else {
                store.shared_lease("hosts.txt").unwrap()
            };
            // dup and fork retain the same open-file description. A parallel
            // spawn can keep this descriptor until exec despite O_CLOEXEC.
            // Holding the duplicate makes that window deterministic without
            // forking the multithreaded Rust test process.
            let inherited = lease._file.try_clone().unwrap();
            assert!(store.try_exclusive_lease("hosts.txt").unwrap().is_none());
            drop(lease);

            let removal = store
                .try_exclusive_lease("hosts.txt")
                .unwrap()
                .expect("a retired guard retained its lock through an inherited descriptor");
            store.remove_leased(&removal).unwrap();
            assert!(!path.exists());
            assert!(inherited.metadata().unwrap().len() > 0);
            drop(inherited);
        }
    }

    #[cfg(unix)]
    #[test]
    fn independent_lease_still_protects_after_an_inherited_guard_is_retired() {
        let temporary = crate::test_tempdir().unwrap();
        let store = PrivateFileStore::open(&temporary.path().join("private")).unwrap();
        let path = store
            .create("hosts.txt", b"pinned-public-host-key")
            .unwrap();
        let first = store.shared_lease("hosts.txt").unwrap();
        let inherited = first._file.try_clone().unwrap();
        // This separately opened lease models another live Runner snapshot,
        // rather than the incidental descriptor inherited by an unrelated fork.
        let independent = store.shared_lease("hosts.txt").unwrap();
        drop(first);
        assert!(store.try_exclusive_lease("hosts.txt").unwrap().is_none());
        assert_eq!(
            store.read("hosts.txt", 64).unwrap(),
            b"pinned-public-host-key"
        );
        drop(independent);

        let removal = store
            .try_exclusive_lease("hosts.txt")
            .unwrap()
            .expect("only an unrelated inherited descriptor remains");
        store.remove_leased(&removal).unwrap();
        assert!(!path.exists());
        assert!(inherited.metadata().unwrap().len() > 0);
        drop(inherited);
    }

    #[test]
    fn independent_shared_leases_protect_reads_and_exclude_removal() {
        let temporary = crate::test_tempdir().unwrap();
        let store = PrivateFileStore::open(&temporary.path().join("private")).unwrap();
        store
            .create("hosts.txt", b"pinned-public-host-key")
            .unwrap();
        let first = store.shared_lease("hosts.txt").unwrap();
        let second = store.shared_lease("hosts.txt").unwrap();
        assert_eq!(
            store.read("hosts.txt", 64).unwrap(),
            b"pinned-public-host-key"
        );
        assert!(store.try_exclusive_lease("hosts.txt").unwrap().is_none());
        drop(first);
        assert!(store.try_exclusive_lease("hosts.txt").unwrap().is_none());
        drop(second);
        let exclusive = store.try_exclusive_lease("hosts.txt").unwrap().unwrap();
        assert!(store.shared_lease("hosts.txt").is_err());
        store.remove_leased(&exclusive).unwrap();
        drop(exclusive);
        assert!(!store.path("hosts.txt").unwrap().exists());
    }

    #[test]
    fn immutable_bounded_files_reject_paths_overwrites_and_hardlinks() {
        let temporary = crate::test_tempdir().unwrap();
        let store = PrivateFileStore::open(&temporary.path().join("private")).unwrap();
        let path = store
            .create("credential.json", b"private-test-value")
            .unwrap();
        assert!(store.create("credential.json", b"replacement").is_err());
        assert!(store.path("../escape").is_err());
        assert!(store.read("credential.json", 3).is_err());
        assert_eq!(
            store.read("credential.json", 64).unwrap(),
            b"private-test-value"
        );
        let link = temporary.path().join("hardlink");
        std::fs::hard_link(&path, &link).unwrap();
        assert!(store.read("credential.json", 64).is_err());
        assert!(store.remove("credential.json").is_err());
        std::fs::remove_file(link).unwrap();
        store.remove("credential.json").unwrap();
        assert!(!path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn private_files_reject_symlinks_and_permissive_files_without_repairing_them() {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let temporary = crate::test_tempdir().unwrap();
        let store = PrivateFileStore::open(&temporary.path().join("private")).unwrap();
        let path = store.create("credential.json", b"fixture").unwrap();
        symlink(&path, store.path("alias.json").unwrap()).unwrap();
        assert!(store.read("alias.json", 64).is_err());
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        assert!(store.read("credential.json", 64).is_err());
        assert_eq!(
            std::fs::metadata(path).unwrap().permissions().mode() & 0o777,
            0o644
        );
    }
}
