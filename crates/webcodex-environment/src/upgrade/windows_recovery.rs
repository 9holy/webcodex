//! Windows recovery must never use a replaceable runtime image as its helper.
use super::*;
use std::fs::File;
use std::os::windows::{fs::OpenOptionsExt, io::AsRawHandle};
use windows_sys::Win32::Storage::FileSystem::{
    GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_DIRECTORY,
    FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_READ,
};

type FileIdentity = (u32, u32, u32);

fn open_image(path: &Path) -> SetupResultValue<(File, FileIdentity)> {
    verify_installed_target_path(path)?;
    // Keep the validated image unchanged through the UAC launch and wait.
    let file = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
        .map_err(|_| SetupDiagnostic::io())?;
    let mut info: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
    if unsafe { GetFileInformationByHandle(file.as_raw_handle().cast(), &mut info) } == 0
        || info.dwFileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT) != 0
    {
        return Err(SetupDiagnostic::io());
    }
    Ok((
        file,
        (
            info.dwVolumeSerialNumber,
            info.nFileIndexHigh,
            info.nFileIndexLow,
        ),
    ))
}

fn image_hash(file: &mut File) -> SetupResultValue<String> {
    if file.metadata().map_err(|_| SetupDiagnostic::io())?.len() > 4 * 1024 * 1024 * 1024 {
        return Err(SetupDiagnostic::io());
    }
    let mut hash = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        let size = file.read(&mut buffer).map_err(|_| SetupDiagnostic::io())?;
        if size == 0 {
            return Ok(format!("{:x}", hash.finalize()));
        }
        hash.update(&buffer[..size]);
    }
}

pub(super) fn ensure_external_restore_process(journal: &UpgradeJournal) -> SetupResultValue<()> {
    if current_account()?.identity != journal.record.request.account.identity {
        return Err(error(
            "upgrade_restore_authorization",
            "Program restoration must run as the original Environment owner",
        ));
    }
    let current = std::env::current_exe().map_err(|_| SetupDiagnostic::io())?;
    let (_, current_id) = open_image(&current)?;
    let targets = journal
        .programs
        .iter()
        .map(|item| (&item.target, &item.sha256, item.windows_security.as_ref()))
        .chain(
            journal
                .desktop
                .iter()
                .map(|item| (&item.target, &item.sha256, item.windows_security.as_ref())),
        );
    for (target, previous_hash, security) in targets {
        match std::fs::symlink_metadata(target) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => return Err(SetupDiagnostic::io()),
            Ok(_) => {}
        }
        let (mut file, identity) = open_image(target)?;
        if identity == current_id
            && (image_hash(&mut file)? != *previous_hash
                || !program_security_matches(target, security))
        {
            return Err(SetupDiagnostic::new(
                "upgrade_external_recovery_required",
                "Rollback cannot replace the executable that is running this recovery",
                "Quit this process and run environment upgrade-rollback from the verified CLI outside the installation, as the original owner; keep the retained backup",
            ));
        }
    }
    Ok(())
}

pub(super) fn authorize_destination(
    target: &Path,
    authority: &mut windows_installation::ProgramAuthority,
) -> SetupResultValue<()> {
    authority.destination(target)
}

pub(crate) struct ServiceHelper {
    path: PathBuf,
    _image: File,
}
impl ServiceHelper {
    pub(crate) fn path(&self) -> &Path {
        &self.path
    }
}

pub(crate) fn service_helper(
    store: &EnvironmentStore,
    record: &EnvironmentRecord,
    spec: &ServiceSpec,
    operation: ServiceOperation,
) -> SetupResultValue<Option<ServiceHelper>> {
    service_helper_for(
        store,
        record,
        spec,
        operation,
        &std::env::current_exe().map_err(|_| SetupDiagnostic::io())?,
    )
}

fn service_helper_for(
    store: &EnvironmentStore,
    record: &EnvironmentRecord,
    spec: &ServiceSpec,
    operation: ServiceOperation,
    current: &Path,
) -> SetupResultValue<Option<ServiceHelper>> {
    let Some(journal): Option<UpgradeJournal> = store.read_json("upgrade.json")? else {
        return Ok(None);
    };
    if matches!(journal.phase, Phase::Committed | Phase::RolledBack) {
        return Ok(None);
    }
    let invalid = || {
        error(
            "upgrade_helper_identity",
            "The upgrade service helper no longer matches the original owner and operation",
        )
    };
    let owner = &journal.record.request.account.identity;
    checked_owner(store.root(), owner)?;
    checked_owner(&store.root().join("upgrade.json"), owner)?;
    checked_owner(&store.root().join("environment.json"), owner)?;
    let saved = store.load_environment()?.ok_or_else(invalid)?;
    if current_account()?.identity != *owner
        || record.environment_id != journal.record.environment_id
        || record.request != journal.record.request
        || saved.environment_id != journal.record.environment_id
        || saved.request != journal.record.request
        || !matches!(operation, ServiceOperation::Start | ServiceOperation::Stop)
        || spec.scope != crate::service::ServiceScope::System
        || !journal.all_services.contains(spec)
    {
        return Err(invalid());
    }
    verify_service_inventory(&journal)?;
    let candidate = journal
        .candidate
        .artifacts
        .get("webcodex")
        .ok_or_else(invalid)?;
    let (mut image, _) = open_image(current)?;
    if journal.candidate.provenance_verified && image_hash(&mut image)? == candidate.sha256 {
        return Ok(Some(ServiceHelper {
            path: current.into(),
            _image: image,
        }));
    }
    // Preserve an ordinary installed coordinator only when its bytes still
    // match this operation's sealed old program or verified new candidate.
    let installed = &record.request.binaries.cli;
    let (mut image, _) = open_image(installed)?;
    let installed_hash = image_hash(&mut image)?;
    let previous = journal
        .programs
        .iter()
        .find(|item| item.name == "webcodex" && item.target == *installed)
        .ok_or_else(invalid)?;
    if installed_hash != previous.sha256
        && !(journal.candidate.provenance_verified && installed_hash == candidate.sha256)
    {
        return Err(invalid());
    }
    Ok(Some(ServiceHelper {
        path: installed.clone(),
        _image: image,
    }))
}

#[cfg(test)]
mod tests;
