; Shared by the standard Tauri installer and the unified outer bootstrap.
; Never find or terminate processes by executable name: another installation
; may use that name. An exclusive writable handle checks only the selected file.
!ifndef WEBCODEX_INSTALLER_HOOKS
!define WEBCODEX_INSTALLER_HOOKS
!include "LogicLib.nsh"

LangString WebCodexProgramBusy 1033 "Files in this installation are still in use or cannot be replaced.$\r$\n$\r$\nChoose Quit from the Desktop tray menu. For a Runtime installed as background services, use the full WebCodex installer to coordinate the upgrade, or stop those services through their Environment controls before retrying. Settings and data are preserved."
LangString WebCodexProgramBusy 2052 "此安装目录中的文件仍在使用，或无法替换。$\r$\n$\r$\n请从 Desktop 托盘菜单选择退出。若 Runtime 作为后台服务运行，请使用 WebCodex 完整安装包协调升级，或先在运行环境控制中停止相应服务，再重试。设置和数据会保留。"

!macro WebCodexRequireStopped executablePath
  !define WebCodexStoppedLabel ${__LINE__}
  Push $0
webcodex_stopped_retry_${WebCodexStoppedLabel}:
  IfFileExists "${executablePath}" 0 webcodex_stopped_done_${WebCodexStoppedLabel}
  System::Call 'kernel32::CreateFileW(w "${executablePath}", i 0xC0000000, i 0, p 0, i 3, i 0x80, p 0) p .r0'
  ${If} $0 P<> -1
    System::Call 'kernel32::CloseHandle(p r0)'
    Goto webcodex_stopped_done_${WebCodexStoppedLabel}
  ${EndIf}
  IfSilent webcodex_stopped_cancel_${WebCodexStoppedLabel} 0
  MessageBox MB_ICONEXCLAMATION|MB_RETRYCANCEL "$(WebCodexProgramBusy)$\r$\n$\r$\n${executablePath}" /SD IDCANCEL IDRETRY webcodex_stopped_retry_${WebCodexStoppedLabel}
webcodex_stopped_cancel_${WebCodexStoppedLabel}:
  Pop $0
  SetErrorLevel 1
  Abort
webcodex_stopped_done_${WebCodexStoppedLabel}:
  Pop $0
  !undef WebCodexStoppedLabel
!macroend

; Tauri 2.11's default macro kills processes by name, including in silent mode.
; Replace only that check; keep its normal pages, product identity and data rules.
!ifmacrodef CheckIfAppIsRunning
  !macroundef CheckIfAppIsRunning
  !macro CheckIfAppIsRunning executableName productName
    !insertmacro WebCodexRequireStopped "$INSTDIR\WebCodex.exe"
    !insertmacro WebCodexRequireStopped "$INSTDIR\webcodex-runtime\webcodex.exe"
    !insertmacro WebCodexRequireStopped "$INSTDIR\webcodex-runtime\webcodex-server.exe"
    !insertmacro WebCodexRequireStopped "$INSTDIR\webcodex-runtime\webcodex-runner.exe"
  !macroend
!endif
!endif
