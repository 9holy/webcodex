"""Exercise the published Windows unified installer against a real old Environment.

Run only on a disposable native Windows runner with no Desktop installation. The old
standard installer and both real CLIs remain unmodified; in particular this test
never repairs installed-file ownership or replaces installer-classify with a stub.
Only the small allowlisted report is suitable for an Actions artifact. Environment
files and subprocess output can contain generated private credentials and are not
written to the report or printed.

The default v0.5.0 fixture reproduces the published v0.5.3 rejection first. The
explicit v0.5.4 fixture only accepts complete candidate verification and upgrades
the real configured installation directly, without that unrelated reproduction.
"""
from __future__ import annotations

import argparse
import base64
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import uuid

try:
    from . import package_unified_installer as packaging
    from . import runtime_installer_manifest as manifest_contract
except ImportError:
    import package_unified_installer as packaging
    import runtime_installer_manifest as manifest_contract


UPSTREAM_SHA256 = {
    "win32-x64": "dcc391d0c26e3334c60967c269fffff20312e2b059e61f3f1140779ffacdb6c6",
    "win32-arm64": "9d3692b3d9309b82ec987565d140dd9226a6d1473d2e67e5f9d675a3250a52b2",
}
V054_SHA256 = {
    "win32-x64": "6dbaa9075541d44a2c4f22075409abdb43f25a0a41f50aa26fc73cc137f9cc8e",
    "win32-arm64": "b233872dc776d2a706235ac5fcc593b7949f7b38d878dd7de099ec7e513ad180",
}
V054_SOURCE = "1af9bb5321edcdc16a4f1a5be65d0611ef19964a"
PLATFORMS = {
    "win32-x64": ("AMD64", "x86_64-pc-windows-msvc", "x86_64"),
    "win32-arm64": ("ARM64", "aarch64-pc-windows-msvc", "aarch64"),
}
PUBLISHED_SOURCE = "883fe91ec125440a689827eb8857d04718331461"
UNINSTALL_KEY = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\WebCodex Desktop"
PROGRAMS = {
    "webcodex": "webcodex-runtime/webcodex.exe",
    "webcodex-server": "webcodex-runtime/webcodex-server.exe",
    "webcodex-runner": "webcodex-runtime/webcodex-runner.exe",
    "webcodex-desktop": "WebCodex.exe",
}
PRIVATE_FILES = (
    "environment.json", "runner.toml", "webcodex-user-token",
    "server/webcodex.env", "enrollment-recovery.json",
)
DIAGNOSTIC_CODES = (
    "installer_owner", "upgrade_receipt_owner", "package_identity",
    "legacy_installation_incomplete", "unsafe_path", "state_path",
    "environment_io", "io_error", "home_unavailable", "setup_busy",
    "installer_registration", "installer_program_acl",
    "upgrade_restore_security", "upgrade_program_changed",
)
SETUP_STEPS = (
    "preflight", "server_configuration", "server_service_install", "server_service_start",
    "server_reachability", "user_authentication", "runner_enrollment", "runner_configuration",
    "project_registration", "runner_service_install", "runner_service_start", "readiness",
)


class SmokeFailure(RuntimeError):
    """A bounded, non-secret failure suitable for the public report."""


@dataclass(frozen=True)
class CommandResult:
    returncode: int
    stdout: bytes
    stderr: bytes


def run_command(argv: list[str] | str, label: str, *, timeout: float = 45,
                env: dict[str, str] | None = None) -> CommandResult:
    """Drain both pipes with a per-stream cap; stdin is always EOF."""
    limit = 256 * 1024
    process = subprocess.Popen(
        argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, env=env,
    )
    overflow = threading.Event()
    outputs = [bytearray(), bytearray()]

    def drain(stream, output):
        try:
            while chunk := stream.read(8192):
                room = max(0, limit - len(output))
                output.extend(chunk[:room])
                if len(chunk) > room:
                    overflow.set()
        finally:
            stream.close()

    readers = [threading.Thread(target=drain, args=(stream, output), daemon=True)
               for stream, output in zip((process.stdout, process.stderr), outputs)]
    for reader in readers:
        reader.start()
    deadline = time.monotonic() + timeout
    try:
        while process.poll() is None:
            if overflow.is_set() or time.monotonic() >= deadline:
                process.kill()  # Only the exact child created by this invocation.
                process.wait(timeout=5)
                raise SmokeFailure(f"{label}: child exceeded its time/output bound")
            time.sleep(0.05)
        for reader in readers:
            reader.join(timeout=max(0.1, deadline - time.monotonic()))
        if overflow.is_set() or any(reader.is_alive() for reader in readers):
            raise SmokeFailure(f"{label}: output did not settle within its bound")
        return CommandResult(process.returncode, bytes(outputs[0]), bytes(outputs[1]))
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)


def digest(path: Path) -> str:
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def verify_input(path: Path, expected: str, label: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{64}", expected) or not path.is_file():
        raise SmokeFailure(f"{label}: missing input or invalid pinned digest")
    actual = digest(path)
    if actual != expected:
        raise SmokeFailure(f"{label}: bytes differ from the pinned published asset")
    return actual


def verify_build(info: dict, *, binary: str, version: str, source: str | None,
                 platform: str, label: str) -> dict:
    _, target, architecture = PLATFORMS[platform]
    if (info.get("binary") != binary or info.get("version") != version
            or source is not None and info.get("git_commit") != source
            or info.get("git_dirty") is not False or info.get("target") != target
            or info.get("architecture") != architecture):
        raise SmokeFailure(f"{label}: runtime build identity differs from the selected source/platform")
    return {key: info.get(key) for key in ("version", "git_commit", "git_dirty", "target", "architecture")}


def verify_candidate_manifest(path: Path, expected_sha256: str, *, version: str,
                              source: str, platform: str, build_run_id: int,
                              runtime_dir: Path) -> dict:
    """Bind public Runtime bytes and the future Desktop destination to one release.

    The caller obtains the pinned manifest digest from the frozen public Release
    asset. This does not invent a fourth local executable or bypass the product's
    independent published-provenance check when the actual outer EXE runs.
    """
    if not path.is_file() or not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
        raise SmokeFailure("candidate source manifest is missing or has no pinned digest")
    with path.open("rb") as handle:
        raw = handle.read(packaging.MAX_BYTES + 1)
    if len(raw) > packaging.MAX_BYTES or hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise SmokeFailure("candidate source manifest exceeds its size bound or differs from the public digest")
    try:
        manifest = manifest_contract.parse(raw)
    except (UnicodeError, ValueError) as error:
        raise SmokeFailure("candidate source manifest is not unique-field JSON") from error
    required = {"schema_version", "version", "source_sha", "source_workflow_run_id",
                "source_workflow_ref", "platform", "target", "architecture",
                "desktop_runtime_contract", "artifacts", "desktop_payload"}
    _, target, architecture = PLATFORMS[platform]
    workflow_ref = f"9holy/webcodex/.github/workflows/release-build.yml@refs/tags/v{version}"
    if (not isinstance(manifest, dict) or set(manifest) != required
            or type(manifest.get("schema_version")) is not int or manifest["schema_version"] != 1
            or (manifest.get("version"), manifest.get("source_sha"), manifest.get("platform"),
                manifest.get("target"), manifest.get("architecture")) !=
               (version, source, platform, target, architecture)
            or type(manifest.get("source_workflow_run_id")) is not int or build_run_id <= 0
            or manifest["source_workflow_run_id"] != build_run_id
            or manifest.get("source_workflow_ref") != workflow_ref):
        raise SmokeFailure("candidate source manifest differs from the frozen release identity")
    contract = manifest["desktop_runtime_contract"]
    if (not isinstance(contract, dict) or set(contract) != {"min_generation", "max_generation"}
            or any(type(value) is not int or value <= 0 for value in contract.values())
            or contract["min_generation"] > contract["max_generation"]):
        raise SmokeFailure("candidate source manifest has an invalid Desktop Runtime contract")
    records = manifest["artifacts"]
    if not isinstance(records, dict) or set(records) != set(PROGRAMS):
        raise SmokeFailure("candidate source manifest must bind all four installed programs")
    for name in PROGRAMS:
        record = records[name]
        if (not isinstance(record, dict)
                or set(record) != {"path", "sha256", "build_info", "build_info_sha256", "probe"}
                or record["path"] != f"artifacts/bin/{name}.exe"
                or not isinstance(record["sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", record["sha256"])
                or record["probe"] != "native-build-job"
                or packaging.canonical_digest(record["build_info"]) != record["build_info_sha256"]):
            raise SmokeFailure("candidate source manifest component attestation is malformed")
        try:
            packaging.validate_build_info(record["build_info"], name, manifest)
        except packaging.PackageError as error:
            raise SmokeFailure("candidate source manifest component build identity differs") from error
        if name != "webcodex-desktop":
            verify_input(runtime_dir / f"{name}.exe", record["sha256"], f"candidate {name} from public Runtime archive")
    desktop = manifest["desktop_payload"]
    expected_managed = [{"path": relative, "sha256": records[name]["sha256"]}
                        for name, relative in sorted(PROGRAMS.items(), key=lambda item: item[1])]
    if (not isinstance(desktop, dict) or set(desktop) != {"path", "sha256", "executable", "managed_files"}
            or desktop["path"] != "artifacts/bin/webcodex-desktop.exe"
            or desktop["executable"] != "webcodex-desktop.exe"
            or not isinstance(desktop["sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", desktop["sha256"])
            or desktop["managed_files"] != expected_managed):
        raise SmokeFailure("candidate source manifest Desktop destination mapping differs")
    return manifest


def parse_json(result: CommandResult, label: str) -> dict:
    if result.returncode:
        raise SmokeFailure(f"{label}: CLI exit {result.returncode}")
    try:
        value = json.loads(result.stdout)
    except (ValueError, UnicodeError) as error:
        raise SmokeFailure(f"{label}: CLI returned invalid JSON") from error
    if not isinstance(value, dict):
        raise SmokeFailure(f"{label}: CLI returned a non-object result")
    return value


def nsis_command(executable: Path, *, environment: Path | None = None,
                 destination: Path | None = None, uninstall: bool = False) -> str:
    # /D= and _?= consume the literal remainder of the Windows command line.
    # They are not shell arguments, so quote only the executable/other values.
    for path in (executable, environment, destination):
        if path is not None and any(c in str(path) for c in '\"\r\n\0'):
            raise SmokeFailure("installer argument contains an invalid path character")
    command = f'"{executable}" /S'
    if environment is not None:
        command += f' /ENVIRONMENTDIR="{environment}"'
    if destination is not None:
        command += (" _?=" if uninstall else " /D=") + str(destination)
    return command


def classification(result: CommandResult) -> dict:
    """Project only known classification facts, never arbitrary CLI output."""
    kind = None
    try:
        value = json.loads(result.stdout)
        if isinstance(value, dict) and value.get("kind") in ("fresh", "unconfigured", "environment"):
            kind = value["kind"]
    except (ValueError, UnicodeError):
        pass
    text = (result.stdout + result.stderr).decode("utf-8", errors="replace")
    return {
        "exit_code": result.returncode, "kind": kind,
        "diagnostic_codes": [code for code in DIAGNOSTIC_CODES
                             if re.search(rf"\b{re.escape(code)}\b", text)],
        "runtime_target_differs": "Environment owner or runtime target differs" in text,
        "installed_program_owner_differs": "installed program belongs to another Windows account" in text,
        "output_sha256": hashlib.sha256(result.stdout + b"\0" + result.stderr).hexdigest(),
    }


def rejection_verdict(dos: dict, verbatim: dict, outer_exit: int, *,
                      unconfigured: dict | None = None, owners: dict | None = None,
                      environment: dict | None = None, private_owners: dict | None = None) -> str:
    if outer_exit == 0:
        return "published_outer_did_not_reject"
    target_rejected = (dos["exit_code"] != 0 and dos["runtime_target_differs"]
                       and "installer_owner" in dos["diagnostic_codes"])
    if target_rejected and verbatim["exit_code"] == 0 and verbatim["kind"] == "environment":
        return "reproduced_cli_path_rejection"
    owners, environment, private_owners = owners or {}, environment or {}, private_owners or {}
    account = environment.get("owner_identity")
    admin = "S-1-5-32-544"
    owner_rejected = lambda value: (value is not None and value["exit_code"] != 0
        and value["installed_program_owner_differs"] and "installer_owner" in value["diagnostic_codes"])
    # A normal verbatim probe can advance past the path mismatch and independently
    # expose the current installer-owner restriction on an administrator install.
    # Require the exact observed SID/record/file evidence, not just another failure.
    if (target_rejected and owner_rejected(verbatim) and owner_rejected(unconfigured)
            and owners.get("helper_exit_code") == 0 and owners.get("token_owner") == admin
            and isinstance(account, str) and account.startswith("S-1-") and account != admin
            and owners.get("token_user") == account
            and environment.get("runtime_paths_resolve_to_installed_files") is True
            and all(owners.get("files", {}).get(name) == admin for name in ("install_directory", *PROGRAMS))
            and private_owners.get("helper_exit_code") == 0 and private_owners.get("token_user") == account
            and all(private_owners.get("files", {}).get(name) == account
                    for name in ("environment_directory", "environment_record"))):
        return "reproduced_cli_path_and_admin_owner_rejections"
    if (dos["installed_program_owner_differs"] or verbatim["installed_program_owner_differs"]):
        return "blocked_by_installed_program_owner"
    return "different_or_unresolved_classification_failure"


def unchanged(before: dict, after: dict, label: str) -> None:
    changed = sorted(key for key in before.keys() | after.keys() if before.get(key) != after.get(key))
    if changed:
        raise SmokeFailure(f"{label}: changed fixture entries: {', '.join(changed)}")


def preserved_state(snapshot: dict) -> dict:
    return {name: value for name, value in snapshot.items() if not name.startswith("program/")}


def service_observation(status: dict) -> dict:
    local = status.get("observation", {}).get("local") or {}
    components = {}
    for row in local.get("components", []):
        name = row.get("component")
        if name in ("server", "runner"):
            service = row.get("service") or {}
            components[name] = {key: service.get(key) for key in
                                ("id", "ownership", "installed", "enabled", "running")}
    observation = status.get("observation", {})
    return {"scope": local.get("scope"), "components": components,
            "server_reachable": observation.get("server_reachable"),
            "authenticated": observation.get("authenticated"),
            "runner_online": observation.get("runner_online")}


def services_ready(observed: dict, running: bool) -> bool:
    rows = observed["components"]
    if observed["scope"] != "user" or set(rows) != {"server", "runner"}:
        return False
    if not all(row["ownership"] == "Owned" and row["installed"] is True
               and row["running"] is running for row in rows.values()):
        return False
    return not running or all(observed[key] is True for key in
                              ("server_reachable", "authenticated", "runner_online"))


def service_identity(observed: dict) -> dict:
    rows = observed.get("components", {})
    if set(rows) != {"server", "runner"} or any(
            not isinstance(row.get("id"), str) or not row["id"] or not isinstance(row.get("enabled"), bool)
            for row in rows.values()):
        raise SmokeFailure("service identity/enabled observation is incomplete")
    return {"scope": observed.get("scope"), **{name: {key: rows[name][key] for key in ("id", "enabled")}
                                               for name in ("server", "runner")}}


def setup_observation(journal: dict) -> dict:
    diagnostic = journal.get("last_diagnostic") or {}
    code = diagnostic.get("code")
    return {"steps": {name: journal.get("steps", {}).get(name) for name in SETUP_STEPS
                      if journal.get("steps", {}).get(name) in ("started", "complete")},
            "diagnostic_code": code if isinstance(code, str) and re.fullmatch(r"[a-zA-Z0-9_]{1,80}", code) else None}


def read_registration() -> dict | None:
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY, 0,
                            winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as key:
            return {name: winreg.QueryValueEx(key, name)[0] for name in
                    ("InstallLocation", "UninstallString", "DisplayName")}
    except FileNotFoundError:
        return None


def registered_path(value: str) -> Path:
    value = value.strip()
    if value.startswith('"') and value.endswith('"'):
        value = value[1:-1]
    if not value or any(c in value for c in '\"\r\n\0'):
        raise SmokeFailure("installer registry path is malformed")
    return Path(value)


def owner_observation(paths: dict[str, Path]) -> dict:
    # Read-only Windows APIs exposed by .NET. No ACL change, takeown, or password.
    script = r"""
$ErrorActionPreference='Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$stage='read_path_request'
$result=@{files=@{}; exists=@{}; dacl=@{}}
try {
  $paths=$env:WEBCODEX_UPGRADE_SMOKE_PATHS | ConvertFrom-Json
  foreach($item in $paths.PSObject.Properties) {
    $result.exists[$item.Name]=[bool]([IO.Directory]::Exists($item.Value) -or [IO.File]::Exists($item.Value))
  }
  $stage='token_identity'
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
  $result.token_user=$identity.User.Value
  $result.token_owner=$identity.Owner.Value
  foreach($item in $paths.PSObject.Properties) {
    $stage='file_owner_' + $item.Name
    if ([IO.Directory]::Exists($item.Value)) {
      $acl=[IO.Directory]::GetAccessControl($item.Value)
    } else {
      $acl=[IO.File]::GetAccessControl($item.Value)
    }
    $result.files[$item.Name]=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    $stage='file_dacl_' + $item.Name
    $raw=[Security.AccessControl.RawSecurityDescriptor]::new($acl.GetSecurityDescriptorBinaryForm(), 0)
    $dacl=$raw.DiscretionaryAcl
    if ($null -ne $dacl -and $dacl.Count -gt 128) { throw [InvalidOperationException]::new('fixture ACL bound') }
    $aces=@()
    if ($null -ne $dacl) {
      foreach($ace in $dacl) {
        $entry=@{type=[int]$ace.AceType; flags=[int]$ace.AceFlags; sid=$null; mask=$null; write_mask=$null}
        if ($ace -is [Security.AccessControl.KnownAce]) {
          $entry.sid=$ace.SecurityIdentifier.Value
          $entry.mask=([int64]$ace.AccessMask) -band 4294967295L
          $entry.write_mask=$entry.mask -band 0x500D0156
        }
        $aces += $entry
      }
    }
    $sections=[Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Access
    $sddl=$raw.GetSddlForm($sections)
    $sha=[Security.Cryptography.SHA256]::Create()
    try { $sddlHash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($sddl))).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
    $result.dacl[$item.Name]=@{null=($null -eq $dacl); protected=[bool]$acl.AreAccessRulesProtected;
      sddl_sha256=$sddlHash; aces=$aces}
  }
} catch {
  $result.failure=@{stage=$stage; exception_type=$_.Exception.GetType().Name;
    reason=$_.CategoryInfo.Reason; script_line=$_.InvocationInfo.ScriptLineNumber}
  $result | ConvertTo-Json -Depth 8 -Compress
  exit 1
}
$result | ConvertTo-Json -Depth 8 -Compress
"""
    env = dict(os.environ, WEBCODEX_UPGRADE_SMOKE_PATHS=json.dumps({k: str(v) for k, v in paths.items()}))
    powershell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    encoded = base64.b64encode(script.encode("utf-16le")).decode("ascii")
    result = run_command([str(powershell), "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
                         "observe installed owners", env=env)
    try:
        value = json.loads(result.stdout)
        if not isinstance(value, dict):
            raise ValueError("non-object helper result")
    except (ValueError, UnicodeError):
        value = {"failure": {"stage": "decode_read_only_owner_helper"}}
    value["helper_exit_code"] = result.returncode
    if result.stderr:
        # This dedicated helper only consumes the explicit fixture paths and
        # token SID metadata. Unlike setup/Runtime CLI output, it has no secrets.
        value["helper_stderr"] = result.stderr[:2048].decode("utf-8", errors="replace")
    return value


class NativeSmoke:
    def __init__(self, args):
        self.args = args
        self.report = {"schema_version": 1, "scenario": "published-unified-verbatim-upgrade",
                       "platform": args.platform,
                       "mode": "reproduce_only" if args.reproduce_only else "verify_candidate" if args.verify_candidate else "verify_classifier",
                       "phases": {}, "cleanup": {}}
        if args.previous_version == "0.5.0":
            self.report["published_source"] = PUBLISHED_SOURCE
        self.root: Path | None = None
        self.installed: Path | None = None
        self.environment: Path | None = None
        self.old_cli: Path | None = None
        self.record: dict | None = None
        self.candidate_manifest: dict | None = None
        self.service_baseline: dict | None = None
        self.unrelated: subprocess.Popen | None = None
        self.desktop_sentinel: Path | None = None
        self.created_desktop_data = False
        self.uncertain_installer = False

    def cli(self, program: Path, command: list[str], label: str, timeout=45) -> CommandResult:
        return run_command([str(program), "environment", *command,
                            "--environment-dir", str(self.environment), "--json"], label, timeout=timeout)

    def status(self) -> dict:
        return parse_json(self.cli(self.old_cli, ["status"], "observe fixture Environment"), "observe fixture Environment")

    def wait_services(self, running: bool, seconds=90) -> dict:
        deadline = time.monotonic() + seconds
        while True:
            result = service_observation(self.status())
            if services_ready(result, running):
                return result
            if time.monotonic() >= deadline:
                raise SmokeFailure("fixture services did not reach the required owned running state")
            time.sleep(1)

    def control(self, operation: str, component: str) -> None:
        parse_json(self.cli(self.old_cli, [operation, component], f"{operation} owned {component}"),
                   f"{operation} owned {component}")

    def observe_preserved_services(self, name: str, running: bool) -> None:
        observed = self.wait_services(running)
        if self.service_baseline is None:
            self.service_baseline = service_identity(observed)
            self.report["service_identity_baseline"] = self.service_baseline
        else:
            unchanged(self.service_baseline, service_identity(observed), "service identity and enabled state")
        self.report["phases"][name] = observed

    def snapshot(self) -> dict:
        values = {f"program/{name}": digest(self.installed / path) for name, path in PROGRAMS.items()}
        for relative in PRIVATE_FILES:
            path = self.environment / relative
            values[f"private/{relative}"] = digest(path) if path.is_file() else None
        values["desktop_sentinel"] = digest(self.desktop_sentinel)
        values["registration"] = read_registration()
        return values

    def run_installer(self, executable: Path, *, environment=None, destination=None, uninstall=False) -> CommandResult:
        try:
            return run_command(nsis_command(executable, environment=environment,
                                            destination=destination, uninstall=uninstall),
                               "native installer", timeout=180)
        except SmokeFailure:
            # A timed-out installer can have handed off to an inner process.
            # Do not race it with an uninstall or recursive file removal.
            self.uncertain_installer = True
            raise

    def observe_previous_runtime(self) -> None:
        source = V054_SOURCE if self.args.previous_version == "0.5.4" else None
        programs = PROGRAMS if source else ("webcodex", "webcodex-server", "webcodex-runner")
        identities = []
        for name in programs:
            info = parse_json(run_command([str(self.installed / PROGRAMS[name]), "--build-info-json"],
                "upstream build identity"), "upstream build identity")
            identities.append(verify_build(info, binary=name, version=self.args.previous_version, source=source,
                                           platform=self.args.platform, label="upstream installed runtime"))
        if any(identity != identities[0] for identity in identities[1:]):
            raise SmokeFailure("upstream runtime build identities disagree")
        self.report["upstream_runtime"] = identities[0]

    def run(self) -> None:
        self.report["phase"] = "validate_inputs"
        native_arch = os.environ.get("PROCESSOR_ARCHITEW6432") or os.environ.get("PROCESSOR_ARCHITECTURE", "")
        if os.name != "nt" or native_arch.upper() != PLATFORMS[self.args.platform][0]:
            raise SmokeFailure("this smoke requires a disposable native Windows runner matching --platform")
        if read_registration() is not None:
            raise SmokeFailure("refusing to change a pre-existing current-user Desktop installation")
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", 8080))
            except OSError as error:
                raise SmokeFailure("fixture loopback port 8080 is already in use") from error
        self.report["inputs"] = {
            "previous_installer_sha256": verify_input(self.args.previous_installer, self.args.previous_installer_sha256, "previous installer"),
        }
        if self.args.previous_version == "0.5.0":
            self.report["inputs"].update({
                "published_installer_sha256": verify_input(self.args.published_installer, self.args.published_installer_sha256, "published unified installer"),
                "published_cli_sha256": digest(self.args.published_cli),
            })
            build = parse_json(run_command([str(self.args.published_cli), "--build-info-json"], "published CLI identity"), "published CLI identity")
            verify_build(build, binary="webcodex", version="0.5.3", source=PUBLISHED_SOURCE,
                         platform=self.args.platform, label="published CLI")
        if self.args.verify_candidate:
            self.report["inputs"]["candidate_installer_sha256"] = verify_input(
                self.args.candidate_installer, self.args.candidate_installer_sha256, "candidate unified installer")
            self.candidate_manifest = verify_candidate_manifest(self.args.candidate_source_manifest,
                self.args.candidate_source_manifest_sha256, version=self.args.candidate_version,
                source=self.args.candidate_source_sha, platform=self.args.platform,
                build_run_id=self.args.candidate_build_run_id, runtime_dir=self.args.candidate_cli.parent)
            if not os.path.samefile(self.args.candidate_cli, self.args.candidate_cli.parent / "webcodex.exe"):
                raise SmokeFailure("candidate CLI is not the exact public Runtime archive component")
            self.report["candidate_source_manifest"] = {
                "sha256": self.args.candidate_source_manifest_sha256,
                **{key: self.candidate_manifest[key] for key in ("version", "source_sha", "platform",
                    "source_workflow_run_id", "source_workflow_ref")},
                "program_sha256": {name: record["sha256"] for name, record in self.candidate_manifest["artifacts"].items()},
                "runtime_archive_bytes_verified": True,
            }
        if not self.args.reproduce_only:
            candidate = parse_json(run_command([str(self.args.candidate_cli), "--build-info-json"], "candidate CLI identity"), "candidate CLI identity")
            self.report["candidate_runtime"] = verify_build(candidate, binary="webcodex", version=self.args.candidate_version,
                source=self.args.candidate_source_sha, platform=self.args.platform, label="candidate CLI")
            self.report["inputs"]["candidate_cli_sha256"] = digest(self.args.candidate_cli)
            if self.candidate_manifest is not None and candidate != self.candidate_manifest["artifacts"]["webcodex"]["build_info"]:
                raise SmokeFailure("actual public candidate CLI differs from its manifest build-info")
        # Inherit the real current-user installation parent's ACL. Runner temp
        # directories can grant broad write access and are not a Desktop fixture.
        fixture_root = Path(os.environ["LOCALAPPDATA"]) / ("webcodex-unified-regression-" + uuid.uuid4().hex)
        fixture_root.mkdir()
        self.root = fixture_root  # Cleanup owns this root only after creation succeeds.
        self.installed = self.root / "Upstream Desktop"
        self.environment = self.root / "Environment"
        self.old_cli = self.installed / PROGRAMS["webcodex"]
        self.report["fixture_root"] = str(self.root)
        self.report["fixture_parent"] = "LOCALAPPDATA"
        self.report["phase"] = "install_upstream_standard_desktop"
        result = self.run_installer(self.args.previous_installer, destination=self.installed)
        if result.returncode:
            raise SmokeFailure(f"upstream standard installer exit {result.returncode}")
        registration = read_registration()
        if registration is None or not os.path.samefile(registered_path(registration["InstallLocation"]), self.installed):
            raise SmokeFailure("upstream installer did not register the exact isolated directory")
        self.report["phase"] = "observe_upstream_installed_file_owners"
        self.report["installed_program_presence"] = {name: (self.installed / path).is_file()
                                                      for name, path in PROGRAMS.items()}
        owners = owner_observation({"install_directory": self.installed,
                                    "runtime_directory": self.installed / "webcodex-runtime",
                                    **{name: self.installed / path for name, path in PROGRAMS.items()}})
        self.report["installed_owners"] = owners
        if owners.get("helper_exit_code") != 0 or owners.get("failure"):
            raise SmokeFailure("read-only installed owner helper failed; inspect its fixed-stage diagnostic")
        self.observe_previous_runtime()
        if self.args.previous_version == "0.5.0":
            self.report["phase"] = "classify_real_unconfigured_upstream_installation"
            self.report["unconfigured_classification"] = classification(self.cli(self.args.published_cli,
                ["installer-classify", "--expected-runtime-dir", str(self.installed / "webcodex-runtime")],
                "published unconfigured classification"))
        self.report["phase"] = "configure_real_upstream_environment"
        try:
            setup = self.cli(self.old_cli, ["configure", "--create", "--runner", "--no-project", "--scope", "user",
                                             "--bin-dir", str(self.installed / "webcodex-runtime")], "configure real old Environment", timeout=180)
        finally:
            # Observe partial setup before deciding cleanup; never dump its record.
            for name in ("environment.json", "setup.json"):
                path = self.environment / name
                if path.is_file() and path.stat().st_size <= 1024 * 1024:
                    value = json.loads(path.read_bytes())
                    if name == "environment.json":
                        self.record = value
                    else:
                        self.report["setup_progress"] = setup_observation(value)
        parse_json(setup, "configure real old Environment")
        if self.record is None or self.record.get("configured") is not True:
            raise SmokeFailure("upstream CLI did not create a configured real Environment")
        binaries = self.record["request"]["binaries"]
        for name, binary in (("cli", "webcodex"), ("server", "webcodex-server"), ("runner", "webcodex-runner")):
            if not binaries[name].startswith("\\\\?\\") or not os.path.samefile(binaries[name], self.installed / PROGRAMS[binary]):
                raise SmokeFailure("real upstream setup did not retain canonical/verbatim runtime paths")
        self.report["environment"] = {
            "environment_id": self.record["environment_id"], "service_scope": self.record["request"]["service_scope"],
            "owner_identity": self.record["request"]["account"]["identity"],
            "runtime_paths": binaries, "runner_client_id": self.record.get("runner_client_id"),
            "runtime_paths_resolve_to_installed_files": True,
        }
        private_owners = owner_observation({"environment_directory": self.environment,
                                            "environment_record": self.environment / "environment.json"})
        self.report["private_environment_owners"] = private_owners
        expected_owner = self.report["environment"]["owner_identity"]
        if (private_owners.get("helper_exit_code") != 0 or private_owners.get("token_user") != expected_owner
                or any(private_owners.get("files", {}).get(name) != expected_owner
                       for name in ("environment_directory", "environment_record"))):
            raise SmokeFailure("real private Environment owner differs from the saved/current user")
        self.report["phase"] = "exercise_owned_runtime_stop_start"
        self.observe_preserved_services("initial_services", True)
        for component in ("runner", "server"):
            self.control("stop", component)
        self.observe_preserved_services("services_stopped", False)
        for component in ("server", "runner"):
            self.control("start", component)
        self.observe_preserved_services("services_restarted", True)

        desktop_data = Path(os.environ["LOCALAPPDATA"]) / "dev.webcodex.desktop"
        self.created_desktop_data = not desktop_data.exists()
        desktop_data.mkdir(exist_ok=True)
        self.desktop_sentinel = desktop_data / ("unified-upgrade-fixture-" + uuid.uuid4().hex + ".json")
        self.desktop_sentinel.write_text('{"fixture":"preserve-desktop-data"}\n', encoding="utf-8")
        unrelated = self.root / "unrelated" / "WebCodex.exe"
        unrelated.parent.mkdir()
        shutil.copyfile(Path(os.environ["SystemRoot"]) / "System32/cmd.exe", unrelated)
        self.unrelated = subprocess.Popen([str(unrelated), "/D", "/C", "set /p fixture="],
                                          stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        before = self.snapshot()
        verbatim_runtime = str(Path(binaries["cli"]).parent)
        if self.args.previous_version == "0.5.4":
            self.verify_candidate(before, verbatim_runtime)
            return
        self.report["phase"] = "classify_published_dos_and_verbatim_paths"
        dos = classification(self.cli(self.args.published_cli,
            ["installer-classify", "--expected-runtime-dir", str(self.installed / "webcodex-runtime")], "published DOS classification"))
        verbatim = classification(self.cli(self.args.published_cli,
            ["installer-classify", "--expected-runtime-dir", verbatim_runtime], "published verbatim classification"))
        self.report["classification"] = {"dos": dos, "verbatim": verbatim}
        # Use normal same-product location discovery: /D= must not hide a bug.
        self.report["phase"] = "run_original_published_unified_installer"
        original = self.run_installer(self.args.published_installer, environment=self.environment)
        self.report["phase"] = "verify_rejection_preserved_old_installation"
        after = self.snapshot()
        unchanged(before, after, "rejected original outer installer")
        if self.unrelated.poll() is not None:
            raise SmokeFailure("original outer installer stopped an unrelated same-name process")
        self.observe_preserved_services("after_rejection_services", True)
        self.report["published_outer"] = {"exit_code": original.returncode, "programs_and_private_state_unchanged": True,
                                          "original_directory_preserved": True, "unrelated_process_alive": True,
                                          "exact_outer_failure_stage": "unknown"}
        self.report["verdict"] = rejection_verdict(dos, verbatim, original.returncode,
            unconfigured=self.report["unconfigured_classification"], owners=owners,
            environment=self.report["environment"], private_owners=private_owners)
        self.report["cli_path_rejection_reproduced"] = self.report["verdict"] in (
            "reproduced_cli_path_rejection", "reproduced_cli_path_and_admin_owner_rejections")
        self.report["cli_admin_owner_rejection_reproduced"] = self.report["verdict"] == "reproduced_cli_path_and_admin_owner_rejections"
        self.report["outer_rejected_unchanged"] = original.returncode != 0
        self.report["exact_outer_failure_stage"] = "unknown"
        if not self.report["cli_path_rejection_reproduced"]:
            raise SmokeFailure("original CLI rejection was not isolated by the required path/owner evidence")
        self.report["phase"] = "reproduction_complete"
        if not self.args.reproduce_only:
            self.verify_candidate(before, verbatim_runtime)

    def verify_candidate(self, before: dict, verbatim_runtime: str) -> None:
        self.report["phase"] = "classify_candidate_dos_and_verbatim_paths"
        observations = {}
        for name, runtime in (("dos", str(self.installed / "webcodex-runtime")), ("verbatim", verbatim_runtime)):
            observed = classification(self.cli(self.args.candidate_cli,
                ["installer-classify", "--expected-runtime-dir", runtime], f"candidate {name} classification"))
            observations[name] = observed
        self.report["candidate_classification"] = observations
        if any(value["exit_code"] != 0 or value["kind"] != "environment" for value in observations.values()):
            raise SmokeFailure("fixed real CLI did not accept both spellings of the same owned Environment")
        unchanged(before, self.snapshot(), "candidate classification")
        if self.unrelated.poll() is not None:
            raise SmokeFailure("candidate classification stopped an unrelated same-name process")
        if self.args.verify_classifier:
            self.observe_preserved_services("after_candidate_classification_services", True)
            self.report["complete_upgrade_verified"] = False
            self.report["verdict"] = "verified_fixed_classifier_only"
            self.report["phase"] = "classifier_verification_complete"
            return

        # The public Runtime archive has only three CLIs. Bind all four installed
        # programs, including Desktop, to the authenticated public source manifest.
        if self.candidate_manifest is None:
            raise SmokeFailure("complete upgrade lacks its verified public source manifest")
        expected = {f"program/{name}": record["sha256"]
                    for name, record in self.candidate_manifest["artifacts"].items()}
        self.report["phase"] = "upgrade_running_environment_with_candidate_outer"
        installed = self.run_installer(self.args.candidate_installer, environment=self.environment)
        self.report["candidate_outer"] = {"exit_code": installed.returncode}
        if installed.returncode:
            raise SmokeFailure(f"candidate unified installer exit {installed.returncode}")
        self.report["phase"] = "verify_exact_installed_candidate_and_preserved_identity"
        after = self.snapshot()
        unchanged(expected, {key: value for key, value in after.items() if key.startswith("program/")},
                  "installed candidate program bytes")
        unchanged(preserved_state(before), preserved_state(after), "candidate upgrade private state and directory")
        for name in ("webcodex", "webcodex-server", "webcodex-runner"):
            info = parse_json(run_command([str(self.installed / PROGRAMS[name]), "--build-info-json"], "installed candidate identity"), "installed candidate identity")
            verify_build(info, binary=name, version=self.args.candidate_version, source=self.args.candidate_source_sha,
                         platform=self.args.platform, label="installed candidate")
        if self.unrelated.poll() is not None:
            raise SmokeFailure("candidate unified installer stopped an unrelated same-name process")
        self.observe_preserved_services("after_candidate_upgrade_services", True)
        for component in ("runner", "server"):
            self.control("stop", component)
        self.observe_preserved_services("candidate_services_stopped", False)
        for component in ("server", "runner"):
            self.control("start", component)
        self.observe_preserved_services("candidate_services_restarted", True)
        unchanged(preserved_state(before), preserved_state(self.snapshot()), "candidate service restart private state")
        self.report["candidate_outer"].update({"exact_native_programs": True, "private_state_preserved": True,
            "original_directory_preserved": True, "unrelated_process_alive": True})
        self.report["complete_upgrade_verified"] = True
        self.report["verdict"] = "verified_real_unified_upgrade"
        self.report["phase"] = "candidate_upgrade_verification_complete"

    def cleanup(self) -> None:
        problems = []
        if self.unrelated is not None:
            try:
                self.unrelated.communicate(input=b"\n", timeout=10)
            except subprocess.TimeoutExpired:
                self.unrelated.kill()  # Exact owned fixture handle, never a name lookup.
                self.unrelated.wait(timeout=5)
        if self.uncertain_installer:
            self.report["cleanup"] = {"complete": False, "preserved_after_uncertain_installer": True}
            return
        if self.record is not None and self.old_cli is not None and self.old_cli.is_file():
            for component in ("runner", "server"):
                try:
                    observed = service_observation(self.status())["components"].get(component, {})
                    if observed.get("ownership") == "Absent" and observed.get("installed") is False:
                        continue
                    if observed.get("ownership") != "Owned":
                        raise SmokeFailure("cleanup cannot confirm exact fixture service ownership")
                    if observed.get("running") is True:
                        self.control("stop", component)
                    self.control("uninstall-service", component)
                except (SmokeFailure, OSError, ValueError):
                    problems.append(f"owned_{component}_cleanup_failed")
        if not problems and self.installed is not None:
            registration = read_registration()
            if registration is not None:
                try:
                    if not os.path.samefile(registered_path(registration["InstallLocation"]), self.installed):
                        raise SmokeFailure("cleanup installation identity changed")
                    raw = registration["UninstallString"].strip()
                    match = re.match(r'^"([^"]+)"', raw)
                    uninstaller = Path(match.group(1) if match else raw.split()[0])
                    if not os.path.samefile(uninstaller.parent, self.installed):
                        raise SmokeFailure("cleanup uninstaller is outside the owned installation")
                    result = self.run_installer(uninstaller, destination=self.installed, uninstall=True)
                    if result.returncode or read_registration() is not None:
                        raise SmokeFailure("owned installer cleanup did not complete")
                except (SmokeFailure, OSError, ValueError):
                    problems.append("owned_installer_cleanup_failed")
        if self.desktop_sentinel is not None:
            self.desktop_sentinel.unlink(missing_ok=True)
            if self.created_desktop_data:
                try:
                    self.desktop_sentinel.parent.rmdir()
                except OSError:
                    pass  # Never delete other Desktop state.
        if not problems and not self.uncertain_installer and self.root is not None:
            # The exact uninstaller has exited; Windows can release its image
            # handle slightly later. Retry only removal of our own unique root.
            deadline = time.monotonic() + 10
            while self.root.exists():
                try:
                    shutil.rmtree(self.root)
                except OSError:
                    if time.monotonic() >= deadline:
                        problems.append("owned_fixture_directory_cleanup_failed")
                        break
                    time.sleep(0.25)
        self.report["cleanup"] = {"complete": not problems and not self.uncertain_installer, "problems": problems}


def arguments(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--reproduce-only", action="store_true")
    mode.add_argument("--verify-classifier", action="store_true", help="real fixed CLI acceptance; does not install a candidate")
    mode.add_argument("--verify-candidate", action="store_true", help="upgrade with a genuine public release outer installer")
    parser.add_argument("--platform", choices=tuple(PLATFORMS), default="win32-x64")
    parser.add_argument("--previous-version", choices=("0.5.0", "0.5.4"), default="0.5.0")
    parser.add_argument("--previous-installer", type=Path, required=True)
    parser.add_argument("--previous-installer-sha256", required=True)
    parser.add_argument("--published-installer", type=Path)
    parser.add_argument("--published-installer-sha256")
    parser.add_argument("--published-cli", type=Path)
    parser.add_argument("--candidate-cli", type=Path)
    parser.add_argument("--candidate-version")
    parser.add_argument("--candidate-source-sha")
    parser.add_argument("--candidate-installer", type=Path)
    parser.add_argument("--candidate-installer-sha256")
    parser.add_argument("--candidate-source-manifest", type=Path)
    parser.add_argument("--candidate-source-manifest-sha256")
    parser.add_argument("--candidate-build-run-id", type=int)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(argv)
    previous_digests = V054_SHA256 if args.previous_version == "0.5.4" else UPSTREAM_SHA256
    if args.previous_installer_sha256 != previous_digests[args.platform]:
        parser.error("the selected previous standard fixture must use its code-owned platform digest")
    published_inputs = (args.published_installer, args.published_installer_sha256, args.published_cli)
    if args.previous_version == "0.5.0":
        if any(value is None for value in published_inputs):
            parser.error("the v0.5.0 fixture requires the published v0.5.3 installer, digest and CLI")
    elif not args.verify_candidate or any(value is not None for value in published_inputs):
        parser.error("the v0.5.4 fixture requires --verify-candidate without published v0.5.3 reproduction inputs")
    if not args.reproduce_only and (not args.candidate_cli
            or not packaging.VERSION_RE.fullmatch(args.candidate_version or "")
            or not re.fullmatch(r"[0-9a-f]{40}", args.candidate_source_sha or "")):
        parser.error("candidate verification requires the real CLI, version and exact source SHA")
    if args.verify_candidate and (not args.candidate_installer
            or not re.fullmatch(r"[0-9a-f]{64}", args.candidate_installer_sha256 or "")
            or not args.candidate_source_manifest
            or not re.fullmatch(r"[0-9a-f]{64}", args.candidate_source_manifest_sha256 or "")
            or args.candidate_build_run_id is None or args.candidate_build_run_id <= 0):
        parser.error("complete upgrade requires the genuine outer, public source manifest, pinned digests and exact build run ID")
    full_inputs = (args.candidate_installer, args.candidate_installer_sha256, args.candidate_source_manifest,
                   args.candidate_source_manifest_sha256, args.candidate_build_run_id)
    if not args.verify_candidate and any(value is not None for value in full_inputs):
        parser.error("public candidate installer/manifest inputs apply only to --verify-candidate")
    for name in ("previous_installer", "published_installer", "published_cli", "candidate_cli", "candidate_installer", "candidate_source_manifest", "report"):
        if getattr(args, name) is not None:
            setattr(args, name, getattr(args, name).absolute())
    return args


def main(argv=None) -> int:
    args = arguments(argv)
    smoke = NativeSmoke(args)
    error = None
    try:
        smoke.run()
    except SmokeFailure as failure:
        error = str(failure)
    except Exception as failure:
        # Never stringify an unexpected exception that could include a private JSON.
        error = f"unexpected {type(failure).__name__} in native fixture"
    finally:
        try:
            smoke.cleanup()
        except Exception as failure:
            smoke.report["cleanup"] = {"complete": False, "error_type": type(failure).__name__}
        smoke.report["passed"] = error is None and smoke.report["cleanup"].get("complete") is True
        if error:
            smoke.report["failure"] = error
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(smoke.report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"passed": smoke.report["passed"], "verdict": smoke.report.get("verdict"),
                      "report": str(args.report), "failure": error}, sort_keys=True))
    return 0 if smoke.report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
