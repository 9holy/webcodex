#!/usr/bin/env python3
"""Build the outer Windows unified installer around a Tauri NSIS payload."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

import prepare_windows_unified_installer as candidate

INSTALLER_HOOKS = Path(__file__).resolve().parents[1] / "apps/desktop/src-tauri/windows/installer-hooks.nsh"

# Only fixed diagnostic categories are displayed. Lifecycle output can contain
# paths or other private details and must never become an installer log dump.
CLASSIFICATION_DIAGNOSTICS = {
    "installer_owner": (
        "The saved Environment targets or Windows ownership do not match this installation. Keep its original folder and use the Windows account and permission level of the original installation.",
        "已保存的运行环境路径或 Windows 归属与本次安装不匹配。请保留原安装目录，并使用原安装的 Windows 账户和权限级别。",
    ),
    "installer_registration": (
        "Setup could not verify the original Windows installation registration. Keep the original folder and recover its installation information before retrying.",
        "无法确认原 Windows 安装登记。请保留原安装目录，并恢复原安装信息后重试。",
    ),
    "installer_program_acl": (
        "The installed program permissions could not be verified or allow another account to change the programs. Restore the original installation permissions before upgrading.",
        "无法验证已有程序的权限，或这些权限允许其他账户修改程序。请先恢复原安装权限，再进行升级。",
    ),
    "upgrade_receipt_owner": (
        "The saved upgrade state or its path is not private to the original account. Resume recovery using the original account and Environment directory.",
        "已保存的升级状态或其路径不再专属于原账户。请使用原账户和原运行环境目录恢复升级。",
    ),
    "upgrade_restore_security": (
        "The original program permissions could not be recovered from the saved upgrade state. Keep the original installation and its recovery files for diagnosis.",
        "无法根据已保存的升级状态恢复原程序权限。请保留原安装及恢复文件，以便进一步检查。",
    ),
    "upgrade_program_changed": (
        "The installed program bytes or permissions changed after upgrade preparation. Recover the saved upgrade before starting again.",
        "升级准备后，已有程序的内容或权限发生了变化。请先恢复已保存的升级，再重新开始。",
    ),
    "package_identity": (
        "Setup could not verify the installed Runtime version or program identity. The existing installation needs to be checked before it can be upgraded.",
        "无法验证已有 Runtime 的版本或程序身份。需要先检查已有安装，才能继续升级。",
    ),
    "setup_busy": (
        "Another operation is using this Environment. Wait for that operation to finish, then retry setup.",
        "另一个操作正在使用此运行环境。请等待该操作结束后重试安装。",
    ),
    "legacy_installation_incomplete": (
        "The existing installation is missing required programs. Restore its original Runtime before upgrading.",
        "已有安装缺少必要的程序。请先恢复原 Runtime，再进行升级。",
    ),
    "upgrade_pending": (
        "An earlier upgrade still needs recovery. Resume that operation before starting another upgrade.",
        "上一次升级尚待恢复。请先恢复该操作，再开始新的升级。",
    ),
    "state_io": (
        "Setup could not safely read or save the Environment state. Check its directory permissions and available disk space.",
        "无法安全读取或保存运行环境状态。请检查目录权限和可用磁盘空间。",
    ),
}


def classification_diagnostic_lines() -> list[str]:
    lines = [
        'LangString WebCodexClassifyUnknown 1033 "Setup could not verify the existing installation or Environment. Use the diagnostic code below when reporting this error."',
        'LangString WebCodexClassifyUnknown 2052 "无法验证已有安装或运行环境。反馈此错误时，请附上下方的诊断代码。"',
        'LangString WebCodexClassifyStopped 1033 "No installation files were replaced by this attempt.$\\r$\\nDiagnostic code: $WebCodexClassificationCode"',
        'LangString WebCodexClassifyStopped 2052 "本次安装尚未替换任何文件。$\\r$\\n诊断代码：$WebCodexClassificationCode"',
    ]
    for code, (english, chinese) in CLASSIFICATION_DIAGNOSTICS.items():
        lines.extend([
            f'LangString WebCodexClassify_{code} 1033 "{english}"',
            f'LangString WebCodexClassify_{code} 2052 "{chinese}"',
        ])
    lines.extend([
        'Function WebCodexClassificationFailed',
        '  StrCpy $WebCodexClassificationCode "installer_classify_failed"',
        '  StrCpy $WebCodexFailureReason "$(WebCodexClassifyUnknown)"',
    ])
    for code in CLASSIFICATION_DIAGNOSTICS:
        lines.extend([
            f'  StrCpy $R0 $1 {len(code) + 1}',
            f'  ${{If}} $R0 == "{code}:"',
            f'    StrCpy $WebCodexClassificationCode "{code}"',
            f'    StrCpy $WebCodexFailureReason "$(WebCodexClassify_{code})"',
            '  ${EndIf}',
        ])
    lines.extend([
        '  DetailPrint "WebCodex: $WebCodexClassificationCode"',
        '  MessageBox MB_ICONSTOP "$WebCodexFailureReason$\\r$\\n$\\r$\\n$(WebCodexClassifyStopped)" /SD IDOK',
        'FunctionEnd',
    ])
    return lines


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def nsis_quote(path: Path) -> str:
    value = str(path.resolve()).replace("/", "\\")
    if any(ch in value for ch in ('"', "$", "\r", "\n")):
        raise ValueError("NSIS path contains unsupported characters")
    return f'"{value}"'


def candidate_hash_command(expected_sha256: str) -> str:
    # NSIS expands ExecWait into a 1024-character buffer. Keep the one-shot
    # helper small enough for the real installer, not only direct PowerShell
    # tests. Base64 represents the same 32 SHA-256 bytes and MUST compare with
    # -cne (case sensitive). This process owns its stream/crypto handles until
    # exit; ExecWait observes exit before any candidate executable is launched.
    expected_bytes = bytes.fromhex(expected_sha256)
    if len(expected_bytes) != 32:
        raise ValueError("candidate SHA-256 must contain 32 bytes")
    expected = base64.b64encode(expected_bytes).decode("ascii")
    # Paths remain outside the source, in a child-local environment variable.
    script = (
        "try { $s=[IO.File]::OpenRead($env:WEBCODEX_INSTALLER_CANDIDATE_CLI); "
        "$h=[Convert]::ToBase64String([Security.Cryptography.SHA256]::Create().ComputeHash($s)); "
        f"exit ([int]($h -cne '{expected}')) }} catch {{ exit 1 }}"
    )
    return base64.b64encode(script.encode("utf-16le")).decode("ascii")


def render(candidate_dir: Path, inner_installer: Path, output: Path, platform: str) -> str:
    manifest, files = candidate.validate_candidate(candidate_dir, platform)
    candidate.require_guarded_bootstrap_contract(manifest)
    inner = inner_installer.resolve(strict=True)
    if inner.read_bytes()[:2] != b"MZ":
        raise ValueError("inner Tauri installer is not a Windows executable")
    hash_arguments = " -NoProfile -NonInteractive -EncodedCommand " + candidate_hash_command(manifest["artifacts"]["webcodex"]["sha256"])
    hash_fixed_length = len(r"\System32\WindowsPowerShell\v1.0\powershell.exe") + len(hash_arguments) + 2
    target = "x86_64" if platform == "win32-x64" else "aarch64"
    lines = [
        'Unicode true',
        '!include "MUI2.nsh"',
        '!include "LogicLib.nsh"',
        '!include "FileFunc.nsh"',
        '!include "WinMessages.nsh"',
        '!include "StrFunc.nsh"',
        '${Using:StrFunc} StrStr',
        'Name "WebCodex Unified Installer"',
        f'OutFile {nsis_quote(output)}',
        'RequestExecutionLevel user',
        # As in Tauri, a placeholder distinguishes a real /D= argument from the
        # default. $INSTDIR remains the one selected destination through the UI.
        '!define WEBCODEX_DEFAULT_DIR "placeholder\\WebCodex Desktop"',
        'InstallDir "${WEBCODEX_DEFAULT_DIR}"',
        'Var WebCodexInstallDir',
        'Var WebCodexRegisteredDir',
        'Var WebCodexDirectoryText',
        'Var WebCodexEnvironmentDir',
        'Var WebCodexExisting',
        'Var WebCodexCandidate',
        'Var WebCodexTrustedCLI',
        'Var WebCodexPackageUpgrade',
        'Var WebCodexForeignServices',
        'Var WebCodexOldDesktop',
        'Var WebCodexUpgradePrepared',
        'Var WebCodexUpgradeTargetFile',
        'Var WebCodexBoundOperation',
        'Var WebCodexClassificationCode',
        'Var WebCodexFailureReason',
        '',
        f'!include {nsis_quote(INSTALLER_HOOKS)}',
        '!define MUI_ABORTWARNING',
        '!define MUI_CUSTOMFUNCTION_ABORT WebCodexUserAbort',
        '!define MUI_WELCOMEPAGE_TEXT "$(WebCodexWelcome)"',
        '!insertmacro MUI_PAGE_WELCOME',
        '!define MUI_DIRECTORYPAGE_TEXT_TOP "$WebCodexDirectoryText"',
        '!define MUI_PAGE_CUSTOMFUNCTION_LEAVE WebCodexValidateInstallDir',
        '!insertmacro MUI_PAGE_DIRECTORY',
        '!insertmacro MUI_PAGE_INSTFILES',
        '!define MUI_FINISHPAGE_NOAUTOCLOSE',
        '!insertmacro MUI_PAGE_FINISH',
        '!insertmacro MUI_LANGUAGE "English"',
        '!insertmacro MUI_LANGUAGE "SimpChinese"',
        'LangString WebCodexWelcome 1033 "Install WebCodex Desktop and its CLI, Server and Runner.$\\r$\\n$\\r$\\nFor an existing installation, setup upgrades the same folder and preserves your settings, projects and credentials. Services are coordinated through their existing Environment owner."',
        'LangString WebCodexWelcome 2052 "安装 WebCodex Desktop 及其 CLI、Server 和 Runner。$\\r$\\n$\\r$\\n已有安装将在原目录升级，保留设置、项目和凭据。服务继续由原有运行环境管理。"',
        'LangString WebCodexChooseDirectory 1033 "Choose where to install WebCodex Desktop and its bundled Runtime."',
        'LangString WebCodexChooseDirectory 2052 "请选择 WebCodex Desktop 及其自带 Runtime 的安装目录。"',
        'LangString WebCodexKeepDirectory 1033 "An existing WebCodex installation was found in the folder below. Upgrade keeps this folder, settings and data. Moving an existing Environment is a separate operation; keep the detected directory to continue."',
        'LangString WebCodexKeepDirectory 2052 "已在下方目录找到 WebCodex。升级会保留此目录、设置和数据。移动已有运行环境需要单独处理，请保留检测到的目录继续升级。"',
        'LangString WebCodexDirectoryMismatch 1033 "This upgrade must use the existing installation folder:$\\r$\\n$WebCodexRegisteredDir$\\r$\\n$\\r$\\nThe selected directory differs. No installation files were replaced. Keep the existing folder; setup cannot move an existing Environment."',
        'LangString WebCodexDirectoryMismatch 2052 "本次升级必须使用已有安装目录：$\\r$\\n$WebCodexRegisteredDir$\\r$\\n$\\r$\\n所选目录不同，安装文件尚未替换。请保留已有目录；安装程序不会移动已有运行环境。"',
        'LangString WebCodexDirectoryInvalid 1033 "Choose one absolute installation folder. The existing installation location must be a valid Windows path."',
        'LangString WebCodexDirectoryInvalid 2052 "请选择一个完整的安装目录。已有安装位置必须是有效的 Windows 路径。"',
        '',
        *classification_diagnostic_lines(),
        '',
        'Function .onInit',
        '  StrCpy $WebCodexUpgradeTargetFile ""',
        '  StrCpy $WebCodexBoundOperation ""',
        '  SetRegView 64',
        '  StrCpy $WebCodexEnvironmentDir ""',
        '  ${GetParameters} $R0',
        '  ClearErrors',
        '  ${GetOptions} $R0 "/ENVIRONMENTDIR=" $WebCodexEnvironmentDir',
        '  ${If} ${Errors}',
        '    StrCpy $WebCodexEnvironmentDir ""',
        '  ${EndIf}',
        '  ClearErrors',
        '  ${GetOptions} $R0 "/UPGRADETARGET=" $WebCodexUpgradeTargetFile',
        '  ${If} ${Errors}',
        '    StrCpy $WebCodexUpgradeTargetFile ""',
        '  ${ElseIf} $WebCodexUpgradeTargetFile == ""',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  ${If} $WebCodexUpgradeTargetFile != ""',
        '  ${AndIf} $WebCodexEnvironmentDir == ""',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  ReadRegStr $WebCodexRegisteredDir HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\WebCodex Desktop" "InstallLocation"',
        '  ${If} $WebCodexRegisteredDir != ""',
        '    StrCpy $0 $WebCodexRegisteredDir 1',
        '    ${If} $0 == \'"\'',
        '      StrCpy $0 $WebCodexRegisteredDir 1 -1',
        '      ${If} $0 != \'"\'',
        '        Goto webcodex_directory_invalid',
        '      ${EndIf}',
        '      StrCpy $WebCodexRegisteredDir $WebCodexRegisteredDir -1 1',
        '    ${EndIf}',
        '    ${StrStr} $R0 "$WebCodexRegisteredDir" \'"\'',
        '    ${If} $R0 != ""',
        '      Goto webcodex_directory_invalid',
        '    ${EndIf}',
        '    System::Call \'shlwapi::PathIsRelativeW(w "$WebCodexRegisteredDir") i .r0\'',
        '    ${If} $0 != 0',
        '      Goto webcodex_directory_invalid',
        '    ${EndIf}',
        # NSIS GetFullPathName also probes filesystem existence. An installer
        # must accept a new destination; the bounded Windows API only
        # normalizes the path. Native lifecycle admission still checks owners,
        # reparse points and the exact existing Environment target.
        '    System::Call \'kernel32::GetFullPathNameW(w "$WebCodexRegisteredDir", i ${NSIS_MAX_STRLEN}, w .r1, p 0) i .r0\'',
        '    ${If} $0 == 0',
        '    ${OrIf} $0 >= ${NSIS_MAX_STRLEN}',
        '      Goto webcodex_directory_invalid',
        '    ${EndIf}',
        '    StrCpy $WebCodexRegisteredDir $1',
        '    StrCpy $WebCodexDirectoryText "$(WebCodexKeepDirectory)"',
        '  ${Else}',
        '    StrCpy $WebCodexDirectoryText "$(WebCodexChooseDirectory)"',
        '  ${EndIf}',
        '  ${If} $INSTDIR == "${WEBCODEX_DEFAULT_DIR}"',
        '    ${If} $WebCodexRegisteredDir != ""',
        '      StrCpy $INSTDIR $WebCodexRegisteredDir',
        '    ${Else}',
        '      StrCpy $INSTDIR "$LOCALAPPDATA\\WebCodex Desktop"',
        '    ${EndIf}',
        '  ${EndIf}',
        # Never silently disregard /D= when an existing Environment pins its
        # runtime paths. Interactive selection has the same check on page leave.
        '  Call WebCodexValidateInstallDir',
        '  Return',
        'webcodex_directory_invalid:',
        '  MessageBox MB_ICONSTOP "$(WebCodexDirectoryInvalid)" /SD IDOK',
        '  SetErrorLevel 1',
        '  Abort',
        'FunctionEnd',
        '',
        'Function WebCodexValidateInstallDir',
        '  ${StrStr} $R0 "$INSTDIR" \'"\'',
        '  ${If} $R0 != ""',
        '    MessageBox MB_ICONSTOP "$(WebCodexDirectoryInvalid)" /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  System::Call \'shlwapi::PathIsRelativeW(w "$INSTDIR") i .r0\'',
        '  ${If} $0 != 0',
        '    MessageBox MB_ICONSTOP "$(WebCodexDirectoryInvalid)" /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  System::Call \'kernel32::GetFullPathNameW(w "$INSTDIR", i ${NSIS_MAX_STRLEN}, w .r1, p 0) i .r0\'',
        '  ${If} $0 == 0',
        '  ${OrIf} $0 >= ${NSIS_MAX_STRLEN}',
        '    MessageBox MB_ICONSTOP "$(WebCodexDirectoryInvalid)" /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  StrCpy $INSTDIR $1',
        '  ${If} $WebCodexRegisteredDir != ""',
        '  ${AndIf} $INSTDIR != $WebCodexRegisteredDir',
        '    MessageBox MB_ICONSTOP "$(WebCodexDirectoryMismatch)" /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  StrCpy $WebCodexInstallDir $INSTDIR',
        '  SetErrorLevel 0',
        'FunctionEnd',
        '',
        'Section "-WebCodexUnifiedBootstrap"',
        '  Call WebCodexValidateInstallDir',
        '  StrCpy $WebCodexExisting 0',
        '  StrCpy $WebCodexPackageUpgrade 0',
        '  StrCpy $WebCodexForeignServices 0',
        '  ReadRegStr $R3 HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\WebCodex Desktop" "InstallLocation"',
        '  ${If} $R3 != ""',
        '    StrCpy $WebCodexExisting 1',
        '  ${EndIf}',
        '  ${If} ${FileExists} "$WebCodexInstallDir\\WebCodex.exe"',
        '  ${OrIf} ${FileExists} "$WebCodexInstallDir\\webcodex-runtime\\webcodex.exe"',
        '    StrCpy $WebCodexExisting 1',
        '  ${EndIf}',
        '  SetRegView 64',
        '  StrCpy $R1 0',
        'webcodex_service_scan:',
        '  EnumRegKey $R0 HKLM "SYSTEM\\CurrentControlSet\\Services" $R1',
        '  ${If} $R0 == ""',
        '    Goto webcodex_services_checked',
        '  ${EndIf}',
        '  StrCpy $R2 $R0 8',
        '  ${If} $R2 == "WebCodex"',
        '    StrCpy $WebCodexForeignServices 1',
        '  ${EndIf}',
        '  IntOp $R1 $R1 + 1',
        '  Goto webcodex_service_scan',
        'webcodex_services_checked:',
        '  InitPluginsDir',
        '  StrCpy $WebCodexCandidate "$PLUGINSDIR\\WebCodexUpgradeCandidate"',
        '  SetOutPath "$WebCodexCandidate"',
        f'  File /oname=source-manifest.json {nsis_quote(candidate_dir / "source-manifest.json")}',
        f'  File /oname=SHA256SUMS {nsis_quote(candidate_dir / "SHA256SUMS")}',
        '  SetOutPath "$WebCodexCandidate\\artifacts\\bin"',
    ]
    for name in candidate.BINARIES:
        lines.append(f'  File /oname={name}.exe {nsis_quote(files[name])}')
    lines.extend([
        '  System::Call \'kernel32::SetEnvironmentVariableW(w "WEBCODEX_INSTALLER_CANDIDATE_CLI", w "$WebCodexCandidate\\artifacts\\bin\\webcodex.exe") i .r0\'',
        '  ${If} $0 == 0',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  StrLen $0 "$WINDIR"',
        f'  IntOp $0 $0 + {hash_fixed_length}',
        '  ${If} $0 >= ${NSIS_MAX_STRLEN}',
        '    MessageBox MB_ICONSTOP "The Windows system path exceeds this installer command bound." /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        f'  ExecWait \'"$WINDIR\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"{hash_arguments}\' $0',
        '  ${If} $0 != 0',
        '    MessageBox MB_ICONSTOP "WebCodex candidate CLI failed its manifest-bound SHA-256 check." /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  StrCpy $WebCodexTrustedCLI "$WebCodexCandidate\\artifacts\\bin\\webcodex.exe"',
        '  ${If} $WebCodexEnvironmentDir == ""',
        '    nsExec::ExecToStack \'"$WebCodexTrustedCLI" environment installer-classify --expected-runtime-dir "$WebCodexInstallDir\\webcodex-runtime" --json\'',
        '  ${Else}',
        '    ${If} $WebCodexUpgradeTargetFile != ""',
        '      nsExec::ExecToStack \'"$WebCodexTrustedCLI" environment installer-classify --expected-runtime-dir "$WebCodexInstallDir\\webcodex-runtime" --environment-dir "$WebCodexEnvironmentDir" --upgrade-target-file "$WebCodexUpgradeTargetFile" --json\'',
        '    ${Else}',
        '    nsExec::ExecToStack \'"$WebCodexTrustedCLI" environment installer-classify --expected-runtime-dir "$WebCodexInstallDir\\webcodex-runtime" --environment-dir "$WebCodexEnvironmentDir" --json\'',
        '    ${EndIf}',
        '  ${EndIf}',
        '  Pop $0',
        '  Pop $1',
        'webcodex_classification_trim:',
        '  StrCpy $R0 $1 1 -1',
        '  ${If} $R0 == "$\\r"',
        '  ${OrIf} $R0 == "$\\n"',
        '    StrCpy $1 $1 -1',
        '    Goto webcodex_classification_trim',
        '  ${EndIf}',
        '  ${If} $0 != 0',
        '    Call WebCodexClassificationFailed',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  ${If} $WebCodexUpgradeTargetFile != ""',
        '  ${AndIf} $1 != \'{"kind":"environment"}\'',
        '    MessageBox MB_ICONSTOP "The selected Environment is no longer available. Guarded installation cannot fall back to another installation mode." /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        # The user selected this publisher's installer. Its verified same-source
        # CLI owns every lifecycle command; an older publisher's installed CLI
        # cannot validate this publisher's candidate. Environment owner/path and
        # receipt checks still apply in the candidate CLI.
        '  ${If} $1 == \'{"kind":"unconfigured"}\'',
        '    StrCpy $WebCodexPackageUpgrade 1',
        '  ${ElseIf} $1 == \'{"kind":"environment"}\'',
        '    StrCpy $WebCodexPackageUpgrade 0',
        '  ${ElseIf} $1 != \'{"kind":"fresh"}\'',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  ${If} $WebCodexForeignServices == 1',
        '  ${AndIf} $1 != \'{"kind":"environment"}\'',
        '    MessageBox MB_ICONSTOP "Windows contains WebCodex services without a matching Environment owner. Recover their original ownership before upgrading." /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  ${If} $WebCodexExisting == 1',
        '  ${AndIf} $WebCodexUpgradeTargetFile == ""',
        '    ExecWait \'"$WebCodexTrustedCLI" environment installer-verify-same --candidate-dir "$WebCodexCandidate" --expected-runtime-dir "$WebCodexInstallDir\\webcodex-runtime" --json\' $0',
        '    ${If} $0 == 0',
        '      Goto webcodex_bootstrap_done',
        '    ${EndIf}',
        '  ${EndIf}',
        '  !insertmacro WebCodexRequireStopped "$WebCodexInstallDir\\WebCodex.exe"',
        '  ${If} $WebCodexPackageUpgrade == 1',
        '    Call WebCodexPackagePreflight',
        '  ${Else}',
        '  ${If} $WebCodexEnvironmentDir == ""',
        '    ExecWait \'"$WebCodexTrustedCLI" environment upgrade-preflight --candidate-dir "$WebCodexCandidate" --json\' $0',
        '  ${Else}',
        '    ExecWait \'"$WebCodexTrustedCLI" environment upgrade-preflight --candidate-dir "$WebCodexCandidate" --environment-dir "$WebCodexEnvironmentDir" --json\' $0',
        '  ${EndIf}',
        '  ${EndIf}',
        '  ${If} $0 != 0',
        '    MessageBox MB_ICONSTOP "WebCodex upgrade preflight rejected this installer." /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  ${If} $WebCodexUpgradeTargetFile != ""',
        '    nsExec::ExecToStack \'"$WebCodexTrustedCLI" environment upgrade-prepare --candidate-dir "$WebCodexCandidate" --environment-dir "$WebCodexEnvironmentDir" --upgrade-target-file "$WebCodexUpgradeTargetFile" --operation-id-output\'',
        '    Pop $0',
        '    Pop $WebCodexBoundOperation',
        'webcodex_operation_trim:',
        '    StrCpy $R0 $WebCodexBoundOperation 1 -1',
        '    ${If} $R0 == "$\\r"',
        '    ${OrIf} $R0 == "$\\n"',
        '      StrCpy $WebCodexBoundOperation $WebCodexBoundOperation -1',
        '      Goto webcodex_operation_trim',
        '    ${EndIf}',
        '    StrLen $R0 $WebCodexBoundOperation',
        '    ${If} $0 != 0',
        '    ${OrIf} $R0 != 36',
        '      StrCpy $WebCodexBoundOperation ""',
        '      SetErrorLevel 1',
        '      Abort',
        '    ${EndIf}',
        '  StrCpy $WebCodexUpgradePrepared 1',
        '  ${Else}',
        '  StrCpy $WebCodexUpgradePrepared 1',
        '  ${If} $WebCodexPackageUpgrade == 1',
        '    Call WebCodexPackagePrepare',
        '  ${Else}',
        '  ${If} $WebCodexEnvironmentDir == ""',
        '    ExecWait \'"$WebCodexTrustedCLI" environment upgrade-prepare --candidate-dir "$WebCodexCandidate" --json\' $0',
        '  ${Else}',
        '    ExecWait \'"$WebCodexTrustedCLI" environment upgrade-prepare --candidate-dir "$WebCodexCandidate" --environment-dir "$WebCodexEnvironmentDir" --json\' $0',
        '  ${EndIf}',
        '  ${EndIf}',
        '  ${EndIf}',
        '  ${If} $0 != 0',
        '    Call WebCodexRollback',
        '    MessageBox MB_ICONSTOP "WebCodex could not prepare the upgrade; installation was stopped." /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  ${If} $WebCodexExisting == 1',
        '    ${If} $WebCodexPackageUpgrade == 1',
        '      Call WebCodexPackageVerify',
        '    ${Else}',
        '    ${If} $WebCodexEnvironmentDir == ""',
        '      ExecWait \'"$WebCodexTrustedCLI" environment installer-verify --candidate-dir "$WebCodexCandidate" --expected-runtime-dir "$WebCodexInstallDir\\webcodex-runtime" --json\' $0',
        '    ${Else}',
        '      ${If} $WebCodexUpgradeTargetFile != ""',
        '        ExecWait \'"$WebCodexTrustedCLI" environment installer-verify --candidate-dir "$WebCodexCandidate" --expected-runtime-dir "$WebCodexInstallDir\\webcodex-runtime" --environment-dir "$WebCodexEnvironmentDir" --upgrade-target-file "$WebCodexUpgradeTargetFile" --operation-id "$WebCodexBoundOperation" --json\' $0',
        '      ${Else}',
        '      ExecWait \'"$WebCodexTrustedCLI" environment installer-verify --candidate-dir "$WebCodexCandidate" --expected-runtime-dir "$WebCodexInstallDir\\webcodex-runtime" --environment-dir "$WebCodexEnvironmentDir" --json\' $0',
        '      ${EndIf}',
        '    ${EndIf}',
        '    ${EndIf}',
        '    ${If} $0 != 0',
        '      Call WebCodexRollback',
        '      MessageBox MB_ICONSTOP "Prepared owner receipt or runtime target does not match this installation. No files were replaced." /SD IDOK',
        '      SetErrorLevel 1',
        '      Abort',
        '    ${EndIf}',
        '  ${EndIf}',
        '  ${If} ${FileExists} "$WebCodexInstallDir\\WebCodex.exe"',
        '    StrCpy $WebCodexOldDesktop "$PLUGINSDIR\\WebCodexDesktop.backup.exe"',
        '    CopyFiles /SILENT "$WebCodexInstallDir\\WebCodex.exe" "$WebCodexOldDesktop"',
        '  ${EndIf}',
        '  SetOutPath "$PLUGINSDIR"',
        f'  File /oname=WebCodexTauriPayload.exe {nsis_quote(inner)}',
        '  ExecWait \'"$PLUGINSDIR\\WebCodexTauriPayload.exe" /S /UPDATE /D=$WebCodexInstallDir\' $0',
        '  ${If} $0 != 0',
        '    Call WebCodexRollback',
        '    MessageBox MB_ICONSTOP "WebCodex installation failed; restoration of the selected operation was requested. Verify its recovery status before retrying." /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  ${If} $WebCodexPackageUpgrade == 1',
        '    Call WebCodexPackageFinish',
        '  ${Else}',
        '  ${If} $WebCodexEnvironmentDir == ""',
        '    ExecWait \'"$WebCodexTrustedCLI" environment upgrade-finish --json\' $0',
        '  ${Else}',
        '    ${If} $WebCodexUpgradeTargetFile != ""',
        '      ExecWait \'"$WebCodexTrustedCLI" environment upgrade-finish --environment-dir "$WebCodexEnvironmentDir" --upgrade-target-file "$WebCodexUpgradeTargetFile" --operation-id "$WebCodexBoundOperation" --json\' $0',
        '    ${Else}',
        '    ExecWait \'"$WebCodexTrustedCLI" environment upgrade-finish --environment-dir "$WebCodexEnvironmentDir" --json\' $0',
        '    ${EndIf}',
        '  ${EndIf}',
        '  ${EndIf}',
        '  ${If} $0 != 0',
        '    Call WebCodexRollback',
        '    MessageBox MB_ICONSTOP "WebCodex could not verify the installed upgrade; rollback was requested." /SD IDOK',
        '    SetErrorLevel 1',
        '    Abort',
        '  ${EndIf}',
        '  ReadRegStr $0 HKCU "Environment" "Path"',
        '  StrCpy $1 "$WebCodexInstallDir\\webcodex-runtime"',
        '  ${StrStr} $2 "$0" "$1"',
        '  ${If} $2 == ""',
        '    ${If} $0 == ""',
        '      WriteRegStr HKCU "Environment" "Path" "$1"',
        '    ${Else}',
        '      WriteRegStr HKCU "Environment" "Path" "$1;$0"',
        '    ${EndIf}',
        '  ${EndIf}',
        '  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000',
        '  StrCpy $WebCodexUpgradePrepared 0',
        'webcodex_bootstrap_done:',
        'SectionEnd',
        '',
        'Function WebCodexRollback',
        '  ${If} $WebCodexUpgradePrepared == 1',
        '    ${If} $WebCodexPackageUpgrade == 1',
        '      Call WebCodexPackageRollback',
        '    ${Else}',
        '    ${If} $WebCodexEnvironmentDir == ""',
        '      ExecWait \'"$WebCodexTrustedCLI" environment upgrade-rollback --json\' $0',
        '    ${Else}',
        '      ${If} $WebCodexUpgradeTargetFile != ""',
        '        ExecWait \'"$WebCodexTrustedCLI" environment upgrade-rollback --environment-dir "$WebCodexEnvironmentDir" --upgrade-target-file "$WebCodexUpgradeTargetFile" --operation-id "$WebCodexBoundOperation" --json\' $0',
        '      ${Else}',
        '      ExecWait \'"$WebCodexTrustedCLI" environment upgrade-rollback --environment-dir "$WebCodexEnvironmentDir" --json\' $0',
        '      ${EndIf}',
        '    ${EndIf}',
        '    ${EndIf}',
        '    ${If} $WebCodexPackageUpgrade == 0',
        '    ${AndIf} $0 == 0',
        '    ${AndIf} ${FileExists} "$WebCodexOldDesktop"',
        '      CopyFiles /SILENT "$WebCodexOldDesktop" "$WebCodexInstallDir\\WebCodex.exe"',
        '    ${EndIf}',
        '    ${If} $0 != 0',
        '      MessageBox MB_ICONSTOP "WebCodex rollback failed; the previous program backup remains available." /SD IDOK',
        '    ${EndIf}',
        '  ${EndIf}',
        '  StrCpy $WebCodexUpgradePrepared 0',
        'FunctionEnd',
        '',
        'Function .onInstFailed',
        '  Call WebCodexRollback',
        'FunctionEnd',
        'Function WebCodexUserAbort',
        '  Call WebCodexRollback',
        'FunctionEnd',
        '',
    ])
    for step in ("preflight", "prepare", "verify", "finish", "rollback"):
        arguments = ' --candidate-dir "$WebCodexCandidate"' if step in ("preflight", "prepare", "verify") else ""
        command = f'"$WebCodexCandidate\\artifacts\\bin\\webcodex.exe" environment package-upgrade-{step}{arguments} --expected-runtime-dir "$WebCodexInstallDir\\webcodex-runtime"'
        lines.extend([
            f"Function WebCodexPackage{step.title()}",
            '  ${If} $WebCodexEnvironmentDir == ""',
            f"    ExecWait '{command} --json' $0",
            '  ${Else}',
            f"    ExecWait '{command} --environment-dir \"$WebCodexEnvironmentDir\" --json' $0",
            '  ${EndIf}',
            'FunctionEnd',
            '',
        ])
    return "\n".join(lines)


def build(args: argparse.Namespace) -> dict:
    if args.output.exists():
        raise ValueError(f"output already exists: {args.output}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    source = render(args.candidate_dir, args.inner_installer, args.output, args.platform)
    script = args.output.with_suffix(".nsi")
    script.write_text(source, encoding="utf-8-sig", newline="\n")
    compiler = args.makensis or shutil.which("makensis")
    if not compiler:
        raise ValueError("makensis is required to build the Windows bootstrap installer")
    result = subprocess.run([compiler, "/V3", str(script)], stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=180)
    if result.returncode:
        args.output.unlink(missing_ok=True)
        raise ValueError("makensis failed to compile the outer Windows installer")
    manifest = json.loads((args.candidate_dir / "source-manifest.json").read_text(encoding="utf-8"))
    provenance = {
        "schema_version": 1,
        "guarded_handoff_version": 1,
        "platform": args.platform,
        "version": manifest["version"],
        "source_sha": manifest["source_sha"],
        "workflow_run_id": manifest["source_workflow_run_id"],
        "workflow_ref": manifest["source_workflow_ref"],
        "candidate_manifest_sha256": sha256(args.candidate_dir / "source-manifest.json"),
        "inner_installer_sha256": sha256(args.inner_installer),
        "installer_sha256": sha256(args.output),
    }
    sidecar = args.output.with_suffix(args.output.suffix + ".provenance.json")
    sidecar.write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return provenance


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate-dir", type=Path, required=True)
    parser.add_argument("--inner-installer", type=Path, required=True)
    parser.add_argument("--platform", choices=tuple(candidate.TARGETS), required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--makensis")
    args = parser.parse_args()
    try:
        print(json.dumps(build(args), sort_keys=True))
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        raise SystemExit(f"Windows unified bootstrap build failed: {exc}") from exc
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
