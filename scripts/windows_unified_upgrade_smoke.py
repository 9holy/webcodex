"""Exercise the published Windows unified installer against a real old Environment.

Run only on a disposable Windows x64 runner with no Desktop installation. The old
standard installer and both real CLIs remain unmodified; in particular this test
never repairs installed-file ownership or replaces installer-classify with a stub.
Only the small allowlisted report is suitable for an Actions artifact. Environment
files and subprocess output can contain generated private credentials and are not
written to the report or printed.
"""
from __future__ import annotations

import argparse
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
import tempfile
import threading
import time
import uuid


UPSTREAM_SHA256 = "dcc391d0c26e3334c60967c269fffff20312e2b059e61f3f1140779ffacdb6c6"
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


def rejection_verdict(dos: dict, verbatim: dict, outer_exit: int) -> str:
    if outer_exit == 0:
        return "published_outer_did_not_reject"
    if (dos["exit_code"] != 0 and dos["runtime_target_differs"]
            and verbatim["exit_code"] == 0 and verbatim["kind"] == "environment"):
        return "reproduced_verbatim_path_rejection"
    if (dos["installed_program_owner_differs"] or verbatim["installed_program_owner_differs"]):
        return "blocked_by_installed_program_owner"
    return "different_or_unresolved_classification_failure"


def unchanged(before: dict, after: dict, label: str) -> None:
    changed = sorted(key for key in before.keys() | after.keys() if before.get(key) != after.get(key))
    if changed:
        raise SmokeFailure(f"{label}: changed fixture entries: {', '.join(changed)}")


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
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$result=@{token_user=$identity.User.Value; token_owner=$identity.Owner.Value; files=@{}}
$paths=$env:WEBCODEX_UPGRADE_SMOKE_PATHS | ConvertFrom-Json
foreach($item in $paths.PSObject.Properties) {
  $acl=Get-Acl -LiteralPath $item.Value
  $result.files[$item.Name]=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
}
$result | ConvertTo-Json -Depth 4 -Compress
"""
    env = dict(os.environ, WEBCODEX_UPGRADE_SMOKE_PATHS=json.dumps({k: str(v) for k, v in paths.items()}))
    powershell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    result = run_command([str(powershell), "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
                         "observe installed owners", env=env)
    return parse_json(result, "observe installed owners")


class NativeSmoke:
    def __init__(self, args):
        self.args = args
        self.report = {"schema_version": 1, "scenario": "published-unified-verbatim-upgrade",
                       "published_source": PUBLISHED_SOURCE, "phases": {}, "cleanup": {}}
        self.root: Path | None = None
        self.installed: Path | None = None
        self.environment: Path | None = None
        self.old_cli: Path | None = None
        self.record: dict | None = None
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

    def run(self) -> None:
        self.report["phase"] = "validate_inputs"
        if os.name != "nt" or os.environ.get("PROCESSOR_ARCHITECTURE", "").upper() != "AMD64":
            raise SmokeFailure("this smoke requires a disposable native Windows x64 runner")
        if read_registration() is not None:
            raise SmokeFailure("refusing to change a pre-existing current-user Desktop installation")
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", 8080))
            except OSError as error:
                raise SmokeFailure("fixture loopback port 8080 is already in use") from error
        self.report["inputs"] = {
            "previous_installer_sha256": verify_input(self.args.previous_installer, self.args.previous_installer_sha256, "previous installer"),
            "published_installer_sha256": verify_input(self.args.published_installer, self.args.published_installer_sha256, "published unified installer"),
            "published_cli_sha256": digest(self.args.published_cli),
        }
        build = parse_json(run_command([str(self.args.published_cli), "--build-info-json"], "published CLI identity"), "published CLI identity")
        if (build.get("binary") != "webcodex" or build.get("version") != "0.5.3"
                or build.get("git_commit") != PUBLISHED_SOURCE or build.get("git_dirty") is not False):
            raise SmokeFailure("published CLI does not match immutable v0.5.3 source identity")
        self.root = Path(tempfile.mkdtemp(prefix="webcodex-unified-regression-", dir=os.environ.get("RUNNER_TEMP")))
        self.installed = self.root / "Upstream Desktop"
        self.environment = self.root / "Environment"
        self.old_cli = self.installed / PROGRAMS["webcodex"]
        self.report["fixture_root"] = str(self.root)
        self.report["phase"] = "install_upstream_standard_desktop"
        result = self.run_installer(self.args.previous_installer, destination=self.installed)
        if result.returncode:
            raise SmokeFailure(f"upstream standard installer exit {result.returncode}")
        registration = read_registration()
        if registration is None or not os.path.samefile(registered_path(registration["InstallLocation"]), self.installed):
            raise SmokeFailure("upstream installer did not register the exact isolated directory")
        owners = owner_observation({"install_directory": self.installed,
                                    **{name: self.installed / path for name, path in PROGRAMS.items()}})
        self.report["installed_owners"] = owners
        identities = []
        for name in ("webcodex", "webcodex-server", "webcodex-runner"):
            info = parse_json(run_command([str(self.installed / PROGRAMS[name]), "--build-info-json"], "upstream build identity"), "upstream build identity")
            if info.get("binary") != name or info.get("version") != "0.5.0":
                raise SmokeFailure("upstream setup did not install the expected real v0.5.0 runtime")
            identities.append({key: info.get(key) for key in ("version", "git_commit", "git_dirty", "target", "architecture")})
        if any(identity != identities[0] for identity in identities[1:]):
            raise SmokeFailure("upstream runtime build identities disagree")
        self.report["upstream_runtime"] = identities[0]
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
        }
        self.report["phase"] = "exercise_owned_runtime_stop_start"
        self.report["phases"]["initial_services"] = self.wait_services(True)
        for component in ("runner", "server"):
            self.control("stop", component)
        self.report["phases"]["services_stopped"] = self.wait_services(False)
        for component in ("server", "runner"):
            self.control("start", component)
        self.report["phases"]["services_restarted"] = self.wait_services(True)

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
        self.report["phase"] = "classify_published_dos_and_verbatim_paths"
        dos = classification(self.cli(self.args.published_cli,
            ["installer-classify", "--expected-runtime-dir", str(self.installed / "webcodex-runtime")], "published DOS classification"))
        verbatim_runtime = str(Path(binaries["cli"]).parent)
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
        self.report["phases"]["after_rejection_services"] = self.wait_services(True)
        self.report["published_outer"] = {"exit_code": original.returncode, "programs_and_private_state_unchanged": True,
                                          "original_directory_preserved": True, "unrelated_process_alive": True}
        self.report["verdict"] = rejection_verdict(dos, verbatim, original.returncode)
        if self.report["verdict"] != "reproduced_verbatim_path_rejection":
            raise SmokeFailure("original installer did not isolate the expected verbatim-path rejection; inspect the classification/owner evidence")
        self.report["phase"] = "reproduction_complete"

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
            try:
                shutil.rmtree(self.root)
            except OSError:
                problems.append("owned_fixture_directory_cleanup_failed")
        self.report["cleanup"] = {"complete": not problems and not self.uncertain_installer, "problems": problems}


def arguments(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reproduce-only", action="store_true", required=True)
    parser.add_argument("--previous-installer", type=Path, required=True)
    parser.add_argument("--previous-installer-sha256", required=True)
    parser.add_argument("--published-installer", type=Path, required=True)
    parser.add_argument("--published-installer-sha256", required=True)
    parser.add_argument("--published-cli", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(argv)
    if args.previous_installer_sha256 != UPSTREAM_SHA256:
        parser.error("the upstream v0.5.0 x64 standard fixture must use its code-owned published digest")
    for name in ("previous_installer", "published_installer", "published_cli", "report"):
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
