//! Native security-descriptor operations; no permission decision parses SDDL text.
use super::*;
use std::ffi::c_void;
use std::fs::File;
use std::os::windows::{
    ffi::OsStrExt,
    fs::OpenOptionsExt,
    io::{AsRawHandle, FromRawHandle},
};
use std::ptr::null_mut;
use windows_sys::Win32::Foundation::{
    CloseHandle, LocalFree, GENERIC_ALL, GENERIC_WRITE, HANDLE, INVALID_HANDLE_VALUE,
};
use windows_sys::Win32::Security::Authorization::{
    ConvertSecurityDescriptorToStringSecurityDescriptorW, ConvertSidToStringSidW,
    ConvertStringSecurityDescriptorToSecurityDescriptorW, GetSecurityInfo, SetSecurityInfo,
    SE_FILE_OBJECT,
};
use windows_sys::Win32::Security::{
    GetAce, GetSecurityDescriptorControl, GetSecurityDescriptorDacl, GetSecurityDescriptorGroup,
    GetSecurityDescriptorOwner, GetSecurityDescriptorSacl, GetTokenInformation, IsValidAcl,
    IsValidSid, TokenOwner, ACCESS_ALLOWED_ACE, ACE_HEADER, DACL_SECURITY_INFORMATION,
    INHERIT_ONLY_ACE, OWNER_SECURITY_INFORMATION, PROTECTED_DACL_SECURITY_INFORMATION,
    SECURITY_ATTRIBUTES, SE_DACL_PROTECTED, TOKEN_OWNER, TOKEN_QUERY,
    UNPROTECTED_DACL_SECURITY_INFORMATION,
};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, CREATE_NEW, DELETE, FILE_APPEND_DATA, FILE_ATTRIBUTE_NORMAL, FILE_DELETE_CHILD,
    FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_READ_ATTRIBUTES,
    FILE_SHARE_READ, FILE_SHARE_WRITE, FILE_WRITE_ATTRIBUTES, FILE_WRITE_DATA, FILE_WRITE_EA,
    READ_CONTROL, WRITE_DAC, WRITE_OWNER,
};
use windows_sys::Win32::System::SystemServices::{ACCESS_ALLOWED_ACE_TYPE, ACCESS_DENIED_ACE_TYPE};
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

const MAX_DESCRIPTOR: usize = 65536;
const WRITE_MASK: u32 = GENERIC_ALL
    | GENERIC_WRITE
    | DELETE
    | WRITE_DAC
    | WRITE_OWNER
    | FILE_WRITE_DATA
    | FILE_APPEND_DATA
    | FILE_WRITE_EA
    | FILE_WRITE_ATTRIBUTES
    | FILE_DELETE_CHILD;

struct Local(*mut c_void);
impl Drop for Local {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { LocalFree(self.0) };
        }
    }
}
struct Token(HANDLE);
impl Drop for Token {
    fn drop(&mut self) {
        unsafe { CloseHandle(self.0) };
    }
}

fn invalid() -> SetupDiagnostic {
    error(
        "installer_program_acl",
        "The installed program security could not be verified",
    )
}

fn sid_string(sid: *mut c_void) -> SetupResultValue<String> {
    if sid.is_null() || unsafe { IsValidSid(sid) } == 0 {
        return Err(invalid());
    }
    let mut text = null_mut();
    if unsafe { ConvertSidToStringSidW(sid, &mut text) } == 0 {
        return Err(invalid());
    }
    let allocation = Local(text.cast());
    let mut length = 0;
    while length < 256 && unsafe { *text.add(length) } != 0 {
        length += 1;
    }
    if length == 256 {
        return Err(invalid());
    }
    let result = String::from_utf16(unsafe { std::slice::from_raw_parts(text, length) })
        .map_err(|_| invalid());
    drop(allocation);
    result
}

pub(super) fn token_owner() -> SetupResultValue<String> {
    let mut token = null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
        return Err(owner_error());
    }
    let token = Token(token);
    let mut needed = 0;
    unsafe { GetTokenInformation(token.0, TokenOwner, null_mut(), 0, &mut needed) };
    if needed == 0 || needed > 65536 {
        return Err(owner_error());
    }
    let mut buffer = vec![0u64; (needed as usize).div_ceil(8)];
    if unsafe {
        GetTokenInformation(
            token.0,
            TokenOwner,
            buffer.as_mut_ptr().cast(),
            needed,
            &mut needed,
        )
    } == 0
    {
        return Err(owner_error());
    }
    sid_string(unsafe { (*buffer.as_ptr().cast::<TOKEN_OWNER>()).Owner })
}

fn open(path: &Path, writable_security: bool) -> SetupResultValue<File> {
    verify_installed_target_path(path)?;
    std::fs::OpenOptions::new()
        .access_mode(
            READ_CONTROL
                | FILE_READ_ATTRIBUTES
                | if writable_security {
                    WRITE_DAC | WRITE_OWNER
                } else {
                    0
                },
        )
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS)
        .open(path)
        .map_err(|_| invalid())
}

fn inspect_descriptor(descriptor: *mut c_void) -> SetupResultValue<(String, bool)> {
    let mut owner = null_mut();
    let mut defaulted = 0;
    let mut acl = null_mut();
    let mut present = 0;
    let mut control = 0;
    let mut revision = 0;
    if unsafe { GetSecurityDescriptorOwner(descriptor, &mut owner, &mut defaulted) } == 0
        || unsafe { GetSecurityDescriptorDacl(descriptor, &mut present, &mut acl, &mut defaulted) }
            == 0
        || present == 0
        || acl.is_null()
        || unsafe { IsValidAcl(acl) } == 0
        || unsafe { GetSecurityDescriptorControl(descriptor, &mut control, &mut revision) } == 0
    {
        return Err(invalid());
    }
    Ok((sid_string(owner)?, control & SE_DACL_PROTECTED != 0))
}

// `capacity` is the allocation size returned by the native SDDL converter, not
// the string length. Read only the initialized prefix through its first NUL.
// SAFETY: `text` must point to that allocation, or a readable test buffer of
// `capacity` WCHARs. The converter guarantees an initialized NUL-terminated string.
unsafe fn descriptor_string(text: *const u16, capacity: usize) -> SetupResultValue<String> {
    if text.is_null() || capacity == 0 || capacity > MAX_DESCRIPTOR {
        return Err(invalid());
    }
    let mut length = 0;
    while length < capacity && unsafe { *text.add(length) } != 0 {
        length += 1;
    }
    if length == 0 || length == capacity {
        return Err(invalid());
    }
    String::from_utf16(unsafe { std::slice::from_raw_parts(text, length) }).map_err(|_| invalid())
}

pub(super) fn capture(path: &Path) -> SetupResultValue<WindowsProgramSecurity> {
    let file = open(path, false)?;
    let mut descriptor = null_mut();
    if unsafe {
        GetSecurityInfo(
            file.as_raw_handle().cast(),
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            null_mut(),
            null_mut(),
            null_mut(),
            null_mut(),
            &mut descriptor,
        )
    } != 0
    {
        return Err(invalid());
    }
    let allocation = Local(descriptor);
    let (owner_identity, dacl_protected) = inspect_descriptor(descriptor)?;
    let mut text = null_mut();
    let mut length = 0;
    if unsafe {
        ConvertSecurityDescriptorToStringSecurityDescriptorW(
            descriptor,
            1,
            OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            &mut text,
            &mut length,
        )
    } == 0
    {
        return Err(invalid());
    }
    let text_allocation = Local(text.cast());
    let descriptor = unsafe { descriptor_string(text, length as usize) }?;
    drop(text_allocation);
    drop(allocation);
    verify_installed_target_path(path)?;
    Ok(WindowsProgramSecurity {
        owner_identity,
        descriptor,
        dacl_protected,
    })
}

fn decode(snapshot: &WindowsProgramSecurity) -> SetupResultValue<Local> {
    if snapshot.descriptor.len() > MAX_DESCRIPTOR
        || snapshot.descriptor.contains('\0')
        || snapshot.descriptor.is_empty()
    {
        return Err(invalid());
    }
    let text: Vec<u16> = snapshot.descriptor.encode_utf16().chain(Some(0)).collect();
    let mut descriptor = null_mut();
    if unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            text.as_ptr(),
            1,
            &mut descriptor,
            null_mut(),
        )
    } == 0
    {
        return Err(invalid());
    }
    let descriptor = Local(descriptor);
    let (owner, protected) = inspect_descriptor(descriptor.0)?;
    if owner != snapshot.owner_identity || protected != snapshot.dacl_protected {
        return Err(invalid());
    }
    // This retained descriptor grants authority for Owner and DACL only. In
    // particular, passing it at file creation must not also assign a Group or
    // SACL supplied by a modified journal.
    let mut group = null_mut();
    let mut sacl = null_mut();
    let mut present = 0;
    let mut defaulted = 0;
    if unsafe { GetSecurityDescriptorGroup(descriptor.0, &mut group, &mut defaulted) } == 0
        || !group.is_null()
        || unsafe {
            GetSecurityDescriptorSacl(descriptor.0, &mut present, &mut sacl, &mut defaulted)
        } == 0
        || present != 0
    {
        return Err(invalid());
    }
    Ok(descriptor)
}

pub(super) fn validate(snapshot: &WindowsProgramSecurity) -> SetupResultValue<()> {
    decode(snapshot).map(|_| ())
}

pub(super) fn check_writers(
    snapshot: &WindowsProgramSecurity,
    owner: &str,
    directory: bool,
) -> SetupResultValue<()> {
    let descriptor = decode(snapshot)?;
    let mut acl = null_mut();
    let mut present = 0;
    let mut defaulted = 0;
    if unsafe { GetSecurityDescriptorDacl(descriptor.0, &mut present, &mut acl, &mut defaulted) }
        == 0
        || present == 0
        || acl.is_null()
    {
        return Err(invalid());
    }
    for index in 0..unsafe { (*acl).AceCount } {
        let mut ace = null_mut();
        if unsafe { GetAce(acl, index as u32, &mut ace) } == 0 || ace.is_null() {
            return Err(invalid());
        }
        let header = unsafe { &*ace.cast::<ACE_HEADER>() };
        // An inherit-only entry cannot grant access to this file. On a
        // directory it can authorize future replacements and must be checked.
        if !directory && u32::from(header.AceFlags) & INHERIT_ONLY_ACE != 0 {
            continue;
        }
        if u32::from(header.AceType) == ACCESS_DENIED_ACE_TYPE {
            continue;
        }
        // Callback/object/unknown allow entries are not silently interpreted as
        // harmless. This additional group-owner admission requires understood
        // permissions; it never rewrites an unfamiliar ACL to make it pass.
        if u32::from(header.AceType) != ACCESS_ALLOWED_ACE_TYPE
            || (header.AceSize as usize) < std::mem::size_of::<ACCESS_ALLOWED_ACE>()
        {
            return Err(invalid());
        }
        let allowed = unsafe { &*ace.cast::<ACCESS_ALLOWED_ACE>() };
        if allowed.Mask & WRITE_MASK == 0 {
            continue;
        }
        let sid = sid_string(std::ptr::addr_of!(allowed.SidStart).cast_mut().cast())?;
        if sid == owner || sid == ADMINISTRATORS || sid == "S-1-5-18" {
            continue;
        }
        if sid == "S-1-3-4"
            && (snapshot.owner_identity == owner || snapshot.owner_identity == ADMINISTRATORS)
        {
            // OWNER RIGHTS names this object's owner, not an additional writer.
            // Callers separately admit that owner, including the original
            // registration and TokenOwner checks for Administrators ownership.
            continue;
        }
        if directory && u32::from(header.AceFlags) & INHERIT_ONLY_ACE != 0 && sid == "S-1-3-0" {
            // CREATOR OWNER applies to the creator of a child, not to an
            // unrelated account. Actual child owners are checked separately.
            continue;
        }
        return Err(invalid());
    }
    Ok(())
}

fn restore_descriptor(snapshot: &WindowsProgramSecurity) -> SetupResultValue<Local> {
    let current = current_account()?.identity;
    if snapshot.owner_identity != current
        && !(snapshot.owner_identity == ADMINISTRATORS && token_owner()?.as_str() == ADMINISTRATORS)
    {
        return Err(owner_error());
    }
    if snapshot.owner_identity == ADMINISTRATORS {
        check_writers(snapshot, &current, false)?;
    }
    decode(snapshot)
}

pub(super) fn create_recovery_file(
    path: &Path,
    snapshot: &WindowsProgramSecurity,
) -> SetupResultValue<File> {
    let descriptor = restore_descriptor(snapshot)?;
    installed_paths::existing_directory(path.parent().ok_or_else(invalid)?)?;
    if path.file_name().is_none_or(|name| {
        name.encode_wide()
            .any(|unit| unit == 0 || unit == u16::from(b':'))
    }) {
        return Err(invalid());
    }
    let attributes = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: descriptor.0,
        bInheritHandle: 0,
    };
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            GENERIC_WRITE | READ_CONTROL | FILE_READ_ATTRIBUTES,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            &attributes,
            CREATE_NEW,
            FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT,
            null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        // CREATE_NEW did not give this call ownership of the name. In
        // particular, an existing entry must never be removed as cleanup.
        return Err(invalid());
    }
    let file = unsafe { File::from_raw_handle(handle.cast()) };
    verify_installed_target_path(path)?;
    Ok(file)
}

pub(super) fn restore(path: &Path, snapshot: &WindowsProgramSecurity) -> SetupResultValue<()> {
    let descriptor = restore_descriptor(snapshot)?;
    // Creation with the original descriptor can preserve an inherited DACL's
    // original control bits. SetSecurityInfo would convert that model even if
    // all permissions were unchanged, so leave an exact new copy untouched.
    if capture(path)? == *snapshot {
        return Ok(());
    }
    let mut owner = null_mut();
    let mut acl = null_mut();
    let mut present = 0;
    let mut defaulted = 0;
    if unsafe { GetSecurityDescriptorOwner(descriptor.0, &mut owner, &mut defaulted) } == 0
        || unsafe {
            GetSecurityDescriptorDacl(descriptor.0, &mut present, &mut acl, &mut defaulted)
        } == 0
        || present == 0
        || acl.is_null()
    {
        return Err(invalid());
    }
    let file = open(path, true)?;
    let protection = if snapshot.dacl_protected {
        PROTECTED_DACL_SECURITY_INFORMATION
    } else {
        UNPROTECTED_DACL_SECURITY_INFORMATION
    };
    if unsafe {
        SetSecurityInfo(
            file.as_raw_handle().cast(),
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION | protection,
            owner,
            null_mut(),
            acl,
            null_mut(),
        )
    } != 0
    {
        return Err(invalid());
    }
    drop(file);
    let restored = capture(path)?;
    if restored != *snapshot {
        #[cfg(test)]
        tests::report_restore_difference(snapshot, &restored);
        return Err(error(
            "upgrade_restore_security",
            "The original program security could not be restored",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests;
