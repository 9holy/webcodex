//! Authority for installed Windows programs, never for private Environment state.
use super::*;
use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WOW64_64KEY, REG_SZ};
use winreg::RegKey;

mod security;

pub(super) const ADMINISTRATORS: &str = "S-1-5-32-544";
const REGISTRATION: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\WebCodex Desktop";

pub(super) enum Purpose {
    Admission,
    Sealed,
    Recovery,
}

pub(super) struct ProgramAuthority {
    owner: String,
    token_owner: Option<String>,
    runtime: PathBuf,
    binding: Option<WindowsInstallationBinding>,
    purpose: Purpose,
    record_targets: Option<[PathBuf; 3]>,
}

fn owner_error() -> SetupDiagnostic {
    error(
        "installer_owner",
        "The installed program belongs to another Windows account",
    )
}

fn registration_error() -> SetupDiagnostic {
    error(
        "installer_registration",
        "The original Windows installation registration could not be verified",
    )
}

fn registered_root() -> SetupResultValue<Option<PathBuf>> {
    let key = match RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(REGISTRATION, KEY_READ | KEY_WOW64_64KEY)
    {
        Ok(key) => key,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(registration_error()),
    };
    let value = match key.get_raw_value("InstallLocation") {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(registration_error()),
    };
    if value.vtype != REG_SZ || value.bytes.len() > 65536 || value.bytes.len() % 2 != 0 {
        return Err(registration_error());
    }
    let mut wide: Vec<u16> = value
        .bytes
        .chunks_exact(2)
        .map(|part| u16::from_le_bytes([part[0], part[1]]))
        .collect();
    if wide.pop() != Some(0) || wide.contains(&0) {
        return Err(registration_error());
    }
    let text = String::from_utf16(&wide).map_err(|_| registration_error())?;
    let path = if text.starts_with('"') && text.ends_with('"') && text.len() >= 2 {
        &text[1..text.len() - 1]
    } else {
        &text
    };
    if path.is_empty() || path.contains('"') || !Path::new(path).is_absolute() {
        return Err(registration_error());
    }
    Ok(Some(PathBuf::from(path)))
}

impl ProgramAuthority {
    pub(super) fn new(
        owner: &str,
        runtime: &Path,
        binding: Option<&WindowsInstallationBinding>,
        purpose: Purpose,
    ) -> SetupResultValue<Self> {
        if current_account()?.identity != owner {
            return Err(owner_error());
        }
        let mut authority = Self {
            owner: owner.into(),
            token_owner: security::token_owner().ok(),
            runtime: runtime.into(),
            binding: binding.cloned(),
            purpose,
            record_targets: None,
        };
        if authority.binding.is_some() {
            authority.check_registration()?;
        } else if matches!(authority.purpose, Purpose::Admission)
            && authority.token_owner.as_deref() == Some(ADMINISTRATORS)
            && installed_paths::runtime_directory_name(runtime)
        {
            // An elevated NSIS replacement may create group-owned files even
            // when all old programs belong to TokenUser. Admit and seal the
            // original registration now, never from the replacement's state.
            if let (Some(root), Ok(Some(registered))) = (runtime.parent(), registered_root()) {
                if installed_paths::same_location(root, &registered)? {
                    authority.check_registration()?;
                }
            }
        }
        Ok(authority)
    }

    pub(super) fn for_record(
        record: &EnvironmentRecord,
        binding: Option<&WindowsInstallationBinding>,
        purpose: Purpose,
    ) -> SetupResultValue<Self> {
        let runtime = record
            .request
            .binaries
            .cli
            .parent()
            .ok_or_else(owner_error)?;
        let mut authority = Self::new(&record.request.account.identity, runtime, binding, purpose)?;
        authority.record_targets = Some([
            record.request.binaries.cli.clone(),
            record.request.binaries.server.clone(),
            record.request.binaries.runner.clone(),
        ]);
        let desktop = managed_desktop_target(&record.request.binaries);
        let has_group_owner = [
            &record.request.binaries.cli,
            &record.request.binaries.server,
            &record.request.binaries.runner,
        ]
        .into_iter()
        .chain(desktop.as_ref())
        .any(|path| {
            crate::storage::windows_path_owner(path).is_ok_and(|owner| owner == ADMINISTRATORS)
        });
        if has_group_owner || authority.binding.is_some() {
            authority.check_registration()?;
        }
        Ok(authority)
    }

    pub(super) fn binding(&self) -> Option<WindowsInstallationBinding> {
        self.binding.clone()
    }

    fn check_registration(&mut self) -> SetupResultValue<()> {
        if self.token_owner.as_deref() != Some(ADMINISTRATORS)
            || !installed_paths::runtime_directory_name(&self.runtime)
        {
            return Err(owner_error());
        }
        let root = self.runtime.parent().ok_or_else(registration_error)?;
        installed_paths::existing_directory(root)?;
        installed_paths::existing_directory(&self.runtime)?;
        if let Some(saved) = &self.record_targets {
            for (path, name) in saved
                .iter()
                .zip(["webcodex", "webcodex-server", "webcodex-runner"])
            {
                if !installed_paths::same_location(path, &self.runtime.join(format!("{name}.exe")))?
                {
                    return Err(owner_error());
                }
            }
        }
        if let Some(binding) = &self.binding {
            if binding.owner_identity != self.owner
                || binding.program_owner_identity != ADMINISTRATORS
                || !installed_paths::same_location(&binding.install_root, root)?
            {
                return Err(registration_error());
            }
        } else if !matches!(self.purpose, Purpose::Admission) {
            // Historical journals did not retain group-owner admission or its
            // original security. They cannot acquire that authority on recovery.
            return Err(owner_error());
        }
        match registered_root()? {
            Some(registered) if installed_paths::same_location(&registered, root)? => {}
            None if self.binding.is_some() && matches!(self.purpose, Purpose::Recovery) => {}
            _ => return Err(registration_error()),
        }
        for directory in [root, self.runtime.as_path()] {
            verify_installed_target_path(directory)?;
            let snapshot = security::capture(directory)?;
            if snapshot.owner_identity != self.owner && snapshot.owner_identity != ADMINISTRATORS {
                return Err(owner_error());
            }
            security::check_writers(&snapshot, &self.owner, true)?;
        }
        for target in [
            self.runtime.join("webcodex.exe"),
            self.runtime.join("webcodex-server.exe"),
            self.runtime.join("webcodex-runner.exe"),
            root.join("WebCodex.exe"),
        ] {
            match std::fs::symlink_metadata(&target) {
                Err(error)
                    if error.kind() == std::io::ErrorKind::NotFound
                        && matches!(self.purpose, Purpose::Recovery) =>
                {
                    continue
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    return Err(super::error(
                        "candidate_file",
                        "An upgrade artifact is missing",
                    ));
                }
                Err(_) => return Err(owner_error()),
                Ok(metadata) if !metadata.is_file() => return Err(owner_error()),
                Ok(_) => {}
            }
            let snapshot = security::capture(&target)?;
            if snapshot.owner_identity != self.owner && snapshot.owner_identity != ADMINISTRATORS {
                return Err(owner_error());
            }
            security::check_writers(&snapshot, &self.owner, false)?;
        }
        if self.binding.is_none() {
            self.binding = Some(WindowsInstallationBinding {
                owner_identity: self.owner.clone(),
                program_owner_identity: ADMINISTRATORS.into(),
                install_root: root.into(),
            });
        }
        Ok(())
    }

    fn fixed_target(&self, path: &Path, directory: bool) -> SetupResultValue<bool> {
        let root = self.runtime.parent().ok_or_else(owner_error)?;
        let expected = if directory {
            vec![root.to_path_buf(), self.runtime.clone()]
        } else {
            vec![
                self.runtime.join("webcodex.exe"),
                self.runtime.join("webcodex-server.exe"),
                self.runtime.join("webcodex-runner.exe"),
                root.join("WebCodex.exe"),
            ]
        };
        for expected in expected {
            if installed_paths::same_location(path, &expected)? {
                return Ok(true);
            }
        }
        Ok(false)
    }

    pub(super) fn authorize(&mut self, path: &Path, directory: bool) -> SetupResultValue<()> {
        let metadata = std::fs::symlink_metadata(path).map_err(|error| {
            if !directory && error.kind() == std::io::ErrorKind::NotFound {
                super::error("candidate_file", "An upgrade artifact is missing")
            } else {
                SetupDiagnostic::io()
            }
        })?;
        verify_installed_target_path(path)?;
        if metadata.is_dir() != directory || (!directory && !metadata.is_file()) {
            return Err(owner_error());
        }
        let snapshot = security::capture(path)?;
        if self.binding.is_some() {
            if !self.fixed_target(path, directory)? {
                return Err(owner_error());
            }
            security::check_writers(&snapshot, &self.owner, directory)?;
        }
        if snapshot.owner_identity == self.owner {
            return Ok(());
        }
        if snapshot.owner_identity != ADMINISTRATORS {
            return Err(owner_error());
        }
        self.check_registration()?;
        if !self.fixed_target(path, directory)? {
            return Err(owner_error());
        }
        security::check_writers(&snapshot, &self.owner, directory)
    }

    pub(super) fn destination(&mut self, target: &Path) -> SetupResultValue<()> {
        self.authorize(target.parent().ok_or_else(owner_error)?, true)?;
        match std::fs::symlink_metadata(target) {
            Ok(_) => self.authorize(target, false),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                if self.binding.is_some() && !self.fixed_target(target, false)? {
                    return Err(owner_error());
                }
                Ok(())
            }
            Err(_) => Err(SetupDiagnostic::io()),
        }
    }

    pub(super) fn snapshot(&mut self, path: &Path) -> SetupResultValue<WindowsProgramSecurity> {
        self.authorize(path, false)?;
        let snapshot = security::capture(path)?;
        self.validate_snapshot(&snapshot)?;
        Ok(snapshot)
    }

    pub(super) fn validate_snapshot(
        &self,
        snapshot: &WindowsProgramSecurity,
    ) -> SetupResultValue<()> {
        security::validate(snapshot)?;
        if snapshot.owner_identity == self.owner {
            if self.binding.is_some() {
                security::check_writers(snapshot, &self.owner, false)?;
            }
            return Ok(());
        }
        if snapshot.owner_identity != ADMINISTRATORS
            || self.binding.is_none()
            || self.token_owner.as_deref() != Some(ADMINISTRATORS)
        {
            return Err(owner_error());
        }
        security::check_writers(snapshot, &self.owner, false)
    }
}

pub(super) fn restore_security(
    path: &Path,
    snapshot: &WindowsProgramSecurity,
) -> SetupResultValue<()> {
    security::restore(path, snapshot)
}

pub(super) fn verify_security(
    path: &Path,
    snapshot: &WindowsProgramSecurity,
) -> SetupResultValue<()> {
    if security::capture(path)? != *snapshot {
        return Err(error(
            "upgrade_program_changed",
            "The original program security changed during preparation",
        ));
    }
    Ok(())
}

pub(super) fn security_matches(path: &Path, snapshot: &WindowsProgramSecurity) -> bool {
    security::capture(path).is_ok_and(|current| current == *snapshot)
}

pub(super) fn verify_original_security(journal: &UpgradeJournal) -> SetupResultValue<()> {
    for (target, snapshot) in journal
        .programs
        .iter()
        .map(|program| (&program.target, program.windows_security.as_ref()))
        .chain(
            journal
                .desktop
                .iter()
                .map(|desktop| (&desktop.target, desktop.windows_security.as_ref())),
        )
    {
        if let Some(snapshot) = snapshot {
            verify_security(target, snapshot)?;
        }
    }
    Ok(())
}

pub(super) fn verify_record(
    store: &EnvironmentStore,
    record: &EnvironmentRecord,
    binding: Option<&WindowsInstallationBinding>,
    purpose: Purpose,
    missing: bool,
) -> SetupResultValue<ProgramAuthority> {
    let owner = &record.request.account.identity;
    checked_owner(store.root(), owner)?;
    checked_owner(&store.root().join("environment.json"), owner)?;
    let saved = store.load_environment()?.ok_or_else(owner_error)?;
    if saved.environment_id != record.environment_id || saved.request != record.request {
        return Err(owner_error());
    }
    let mut authority = ProgramAuthority::for_record(record, binding, purpose)?;
    for path in [
        &record.request.binaries.cli,
        &record.request.binaries.server,
        &record.request.binaries.runner,
    ] {
        if missing {
            authority.destination(path)?;
        } else {
            authority.authorize(path, false)?;
        }
    }
    if let Some(desktop) = managed_desktop_target(&record.request.binaries) {
        if missing {
            authority.destination(&desktop)?;
        } else {
            authority.authorize(&desktop, false)?;
        }
    }
    Ok(authority)
}

pub(super) fn verify_journal(
    store: &EnvironmentStore,
    journal: &UpgradeJournal,
    purpose: Purpose,
    missing: bool,
) -> SetupResultValue<ProgramAuthority> {
    checked_owner(
        &store.root().join("upgrade.json"),
        &journal.record.request.account.identity,
    )?;
    let authority = verify_record(
        store,
        &journal.record,
        journal.windows_installation.as_ref(),
        purpose,
        missing,
    )?;
    if journal.windows_installation.is_some() {
        let binaries = &journal.record.request.binaries;
        let expected = [
            ("webcodex", &binaries.cli),
            ("webcodex-server", &binaries.server),
            ("webcodex-runner", &binaries.runner),
        ];
        if journal.programs.len() != expected.len() {
            return Err(owner_error());
        }
        for (name, path) in expected {
            let program = journal
                .programs
                .iter()
                .find(|item| item.name == name)
                .ok_or_else(owner_error)?;
            if !installed_paths::same_location(path, &program.target)? {
                return Err(owner_error());
            }
        }
        let desktop = journal.desktop.as_ref().ok_or_else(owner_error)?;
        let expected = managed_desktop_target(binaries).ok_or_else(owner_error)?;
        if !installed_paths::same_location(&desktop.target, &expected)? {
            return Err(owner_error());
        }
    }
    for snapshot in journal
        .programs
        .iter()
        .map(|program| program.windows_security.as_ref())
        .chain(
            journal
                .desktop
                .iter()
                .map(|desktop| desktop.windows_security.as_ref()),
        )
    {
        match snapshot {
            Some(snapshot) => authority.validate_snapshot(snapshot)?,
            None if journal.windows_installation.is_some() => {
                return Err(error(
                    "upgrade_restore_security",
                    "The original program security snapshot is missing",
                ));
            }
            None => {}
        }
    }
    Ok(authority)
}
