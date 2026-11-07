#!/usr/bin/env python3
"""Opt-in real OpenSSH password/key onboarding acceptance on disposable services.

Build dogfood Server/Runner first. Requires OpenSSH and Paramiko 4.x in the test
Python environment. A loopback-only SSH fixture uses generated credentials and
keys; it never changes OS accounts, ~/.ssh, or an installed WebCodex service.
No external model account or production SSH host is contacted.
"""

from __future__ import annotations

import argparse
import base64
from dataclasses import dataclass
import hashlib
import io
import json
import logging
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from urllib.error import URLError

if __package__:
    from .e2e_session_continuity_ws import ROOT, Smoke, check, stop as stop_posix
else:
    from e2e_session_continuity_ws import ROOT, Smoke, check, stop as stop_posix

try:
    import paramiko
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
except ImportError:
    paramiko = None


PROBE_DIAGNOSTIC_STAGES = frozenset({
    "not_observed", "entered", "arguments", "nonce", "clock", "request_path",
    "request_store", "request_read", "request_decode", "expiry", "prompt", "consume",
    "credential_read", "credential_decode", "binding", "secret", "stdout", "complete",
})
PROBE_DIAGNOSTIC_COUNTERS = (
    "askpass_entries", "key_load_errors", "identity_unavailable", "askpass_spawn_errors",
    "authentication_denied",
)
FIXTURE_COUNTERS = (
    "password_attempts", "successful_passwords", "publickey_requests", "accepted_key_offers",
    "executions", "input_eofs", "commands_started", "commands_finished", "framed_executions",
    "execution_failures", "input_timeouts",
)
ACCEPTANCE_STAGES = frozenset({
    "prepare", "scope", "host_key_inspection", "wrong_password", "changed_host_key",
    "password_probe", "plain_key_probe", "wrong_key_probe", "encrypted_key_probe",
    "user_known_hosts_correct_pin", "user_known_hosts_wrong_pin",
    "register", "runner_restart", "remote_shell", "privacy",
})
LITERAL_DOLLAR_ENV = "WEBCODEX_SSH_LITERAL_DOLLAR"
PIN_PROBE_ALIAS = "webcodex-user-known-hosts-fixture"
PIN_PROBE_OUTPUT = b"WEBCODEX_USER_PIN_OK\n"
NONEXECUTABLE_DECOY = b"Fixture sentinel; deliberately not a Windows executable.\r\n"
OPERATOR_ERROR_KINDS = frozenset({
    "permission_denied", "insufficient_scope", "runner_unavailable", "invalid_runner_response",
    "ssh_resource_invalid", "ssh_resource_registry_unavailable", "ssh_resource_binding_stale",
    "ssh_connection_setup_unsupported", "ssh_host_key_unavailable", "ssh_host_key_stale",
    "ssh_host_key_changed", "ssh_authentication_failed", "ssh_connection_failed",
    "ssh_connection_timeout", "ssh_program_unavailable", "ssh_identity_file_invalid",
    "ssh_credentials_unavailable", "ssh_client_permission_denied", "ssh_connection_cancelled",
})
PROBE_DIAGNOSTIC_PREFIX = b"webcodex_ssh_probe: "
PROBE_DIAGNOSTIC_PATTERN = re.compile(
    rb"webcodex_ssh_probe: askpass_stage=(?P<askpass_stage>"
    + b"|".join(sorted(stage.encode("ascii") for stage in PROBE_DIAGNOSTIC_STAGES)) + rb")"
    + b"".join(b" " + field.encode("ascii") + b"=(?P<" + field.encode("ascii")
                + rb">(?:0|[1-9]|1[0-6]))" for field in PROBE_DIAGNOSTIC_COUNTERS)
)


def observed_probe_diagnostic(log: bytes) -> dict | None:
    """Project one bounded, closed diagnostic; never echo process output.

    These are observed markers, not proof of authentication or a retry permit.
    In particular, not_observed does not prove the helper was never invoked.
    """
    latest = None
    for line in log[-65536:].splitlines():
        if len(line) > 1024:
            continue
        line = re.sub(rb"\x1b\[[0-9;]*m", b"", line)
        start = line.find(PROBE_DIAGNOSTIC_PREFIX)
        if start < 0:
            continue
        match = PROBE_DIAGNOSTIC_PATTERN.fullmatch(line[start:])
        if match is not None:
            latest = {"askpass_stage": match["askpass_stage"].decode("ascii")}
            latest.update({field: int(match[field]) for field in PROBE_DIAGNOSTIC_COUNTERS})
    return latest


def counter_delta(before: dict, after: dict) -> dict[str, int]:
    return {name: max(0, min(1000000, after.get(name, 0) - before.get(name, 0)))
            for name in FIXTURE_COUNTERS}


def operator_error_kind(result: dict) -> str:
    output = result.get("output")
    kind = output.get("error_kind") if isinstance(output, dict) else None
    return kind if isinstance(kind, str) and kind in OPERATOR_ERROR_KINDS else "unrecognized"


class OperatorCallFailed(AssertionError):
    def __init__(self, action: str, success: bool, result: dict):
        self.error_kind = operator_error_kind(result)
        action = action if action in {"list", "inspect", "probe", "register", "remove"} else "operation"
        super().__init__(f"operator {action}: expected success={success}; code={self.error_kind}")


def encrypted_key_control_copy(source: Path, root: Path) -> Path:
    """A second name for identical fixture bytes, never a product fallback."""
    target = root / "encrypted-key-ascii"
    shutil.copyfile(source, target)
    secure_fixture_path(target)
    return target


def special_key_path(root: Path) -> Path:
    # Keep the special characters after the Unicode section so they cannot
    # displace the original OpenSSH 100-byte prompt truncation coverage.
    for padding in range(3):
        path = root / ("k" * padding + "长" * 40
                       + " key %q ${WEBCODEX_FIXTURE_UNSET}") / "client-key"
        encoded = str(path).encode("utf-8")
        try:
            encoded[:100].decode("utf-8")
        except UnicodeDecodeError as error:
            if len(encoded) > 100 and error.end == 100 and error.reason == "unexpected end of data":
                return path
    raise AssertionError("fixture root must allow a partial UTF-8 character at the 100-byte key boundary")


def literal_ssh_option_path(path: Path) -> str:
    # The Windows production contract puts Unicode on argv, not in a path
    # environment variable read through the client's narrow CRT getenv.
    # The one ASCII environment value is forced below and is not recursive.
    value = str(path).replace("%", "%%").replace("$", "${" + LITERAL_DOLLAR_ENV + "}")
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def file_sha256(path: Path) -> bytes:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError:
        raise AssertionError("fixture executable integrity could not be checked") from None
    return digest.digest()


@dataclass(frozen=True)
class NativeRunnerFixture:
    source: Path
    executable: Path
    caller_cwd: Path
    decoy: Path
    digest: bytes

    def verify(self):
        check(self.source.is_absolute() and self.executable.is_absolute()
              and self.caller_cwd.is_absolute()
              and self.executable.parent != self.caller_cwd,
              "fixture Runner must use an absolute executable and a different caller cwd")
        check(file_sha256(self.source) == self.digest == file_sha256(self.executable),
              "fixture Runner bytes must match the exact candidate")
        check(file_sha256(self.decoy) == hashlib.sha256(NONEXECUTABLE_DECOY).digest(),
              "fixture caller-cwd decoy was changed")


def prepare_windows_runner(source: Path, root: Path) -> NativeRunnerFixture:
    parent = root / "Runner 安装 directory"
    caller_cwd = root / "different-caller-cwd"
    for directory in [parent, caller_cwd]:
        directory.mkdir(mode=0o700)
        secure_fixture_path(directory)
    # A different, valid ASCII leaf also rejects hardcoded helper basenames.
    executable = parent / "webcodex-ssh-fixture.exe"
    decoy = caller_cwd / executable.name
    digest = file_sha256(source)
    try:
        shutil.copyfile(source, executable)
        decoy.write_bytes(NONEXECUTABLE_DECOY)
    except OSError:
        raise AssertionError("fixture Runner copy could not be prepared") from None
    secure_fixture_path(executable)
    secure_fixture_path(decoy)
    fixture = NativeRunnerFixture(source, executable, caller_cwd, decoy, digest)
    fixture.verify()
    return fixture


def user_known_hosts_command(program: Path, endpoint: dict, hosts: Path, identity: Path) -> list[str]:
    # This native-client baseline isolates UserKnownHostsFile from the product
    # path, which deliberately pins both the user and global host-key files.
    options = [
        "StrictHostKeyChecking=yes", "GlobalKnownHostsFile=none",
        "UserKnownHostsFile=" + literal_ssh_option_path(hosts),
        "HostKeyAlias=" + PIN_PROBE_ALIAS, "CheckHostIP=no", "UpdateHostKeys=no",
        "VerifyHostKeyDNS=no", "PermitLocalCommand=no", "ClearAllForwardings=yes",
        "ForwardAgent=no", "ForwardX11=no", "IdentityAgent=none", "IdentitiesOnly=yes",
        "IdentityFile=" + literal_ssh_option_path(identity), "HostKeyAlgorithms=ssh-ed25519",
        "PreferredAuthentications=publickey", "PasswordAuthentication=no",
        "KbdInteractiveAuthentication=no", "BatchMode=yes", "ConnectTimeout=10",
        "ServerAliveInterval=5", "ServerAliveCountMax=1",
    ]
    arguments = [str(program), "-F", "none", "-n", "-T",
                 "-p", str(endpoint["port"]), "-l", endpoint["user"]]
    for option in options:
        arguments.extend(["-o", option])
    return arguments + ["--", endpoint["host"], "printf 'WEBCODEX_USER_PIN_OK\\n'"]


def git_posix_tools(git: Path) -> tuple[Path, Path]:
    # cmd/git.exe is usual in PowerShell; Git Bash exposes mingw64/bin/git.exe.
    for root in list(git.resolve().parents)[:3]:
        shell = root / "usr/bin/sh.exe"
        cygpath = shell.with_name("cygpath.exe")
        if shell.is_file() and cygpath.is_file():
            return shell, cygpath
    raise AssertionError("Git for Windows POSIX fixture tools are missing")


def native_ssh_version(output: bytes) -> str:
    match = re.search(rb"(?:^|[\r\n])(OpenSSH_for_Windows_[0-9][0-9A-Za-z._-]{0,63})(?=$|[\s,])",
                      output[:4096])
    check(match is not None, "Windows acceptance requires the native Microsoft OpenSSH client")
    return match.group(1).decode("ascii")


@dataclass(frozen=True)
class HostTools:
    shell: Path
    runner_path: str
    remote_env: dict[str, str]
    cygpath: Path | None = None

    @classmethod
    def discover(cls):
        if os.name == "posix":
            for name in ["ssh", "ssh-keyscan", "sh"]:
                check(shutil.which(name) is not None, f"Required acceptance tool is missing: {name}")
            return cls(Path(shutil.which("sh")), os.environ.get("PATH", os.defpath),
                       {"PATH": os.defpath, "LANG": "C"})
        check(os.name == "nt", "This acceptance requires native Windows or a Unix host")
        system = Path(os.environ["SystemRoot"]) / "System32"
        native = system / "OpenSSH"
        runner_path = os.pathsep.join([str(native), str(system), os.environ.get("PATH", "")])
        for name in ["ssh.exe", "ssh-keyscan.exe"]:
            expected = native / name
            resolved = shutil.which(name, path=runner_path)
            check(expected.is_file() and resolved is not None
                  and Path(resolved).resolve() == expected.resolve(),
                  f"Windows acceptance must use System32 OpenSSH {name}; Git SSH is not accepted")
        version = subprocess.run([str(native / "ssh.exe"), "-V"], stdin=subprocess.DEVNULL,
                                 capture_output=True, timeout=10, check=True)
        client_version = native_ssh_version(version.stdout + version.stderr)
        # Git Bash supplies only the disposable remote POSIX host. It never
        # supplies the SSH client or the native Runner's ASKPASS helper.
        git = shutil.which("git.exe")
        check(git is not None, "Git for Windows is required for the remote POSIX fixture")
        shell, cygpath = git_posix_tools(Path(git))
        remote_env = {"PATH": os.pathsep.join([str(shell.parent), str(system)]), "LANG": "C",
                      "SystemRoot": os.environ["SystemRoot"]}
        for name in ["TEMP", "TMP"]:
            if name in os.environ:
                remote_env[name] = os.environ[name]
        print(f"Using native System32 {client_version} client/keyscan; Git Bash is the remote fixture only",
              flush=True)
        return cls(shell, runner_path, remote_env, cygpath)

    def remote_path(self, path: Path) -> str:
        if self.cygpath is None:
            return str(path)
        result = subprocess.run([str(self.cygpath), "-u", str(path)], stdin=subprocess.DEVNULL,
                                env=self.remote_env, capture_output=True, timeout=10, check=True)
        value = result.stdout.decode("utf-8").strip()
        check(value.startswith("/") and "\n" not in value and "\r" not in value,
              "Remote fixture cwd must be an unambiguous POSIX path")
        return value


def acl_failure_details(result) -> str:
    """Report only bounded OS failure metadata, never PowerShell's raw errors."""
    details = {"stage": "powershell_start", "exit_code": result.returncode}
    if len(result.stdout) <= 4096:
        try:
            reported = json.loads(result.stdout)
        except (UnicodeError, ValueError):
            reported = None
        if isinstance(reported, dict):
            stage = reported.get("stage")
            if isinstance(stage, str) and stage in {"inspect", "identity", "descriptor", "persist", "verify"}:
                details["stage"] = stage
            kind = reported.get("exception_type")
            if isinstance(kind, str) and re.fullmatch(r"System\.[A-Za-z0-9_.+`]{1,150}", kind):
                details["exception_type"] = kind
            for name in ["hresult", "native_code"]:
                value = reported.get(name)
                if type(value) is int and -(2**31) <= value < 2**32:
                    details[name] = value
    return json.dumps(details, sort_keys=True)


def secure_fixture_path(path: Path) -> None:
    """Protect only newly created, owned fixture paths; never repair user files."""
    if os.name != "nt":
        path.chmod(0o700 if path.is_dir() else 0o600)
        return
    # chmod on Windows does not establish an owner/private DACL. Match the
    # native private store's current SID + SYSTEM + Administrators contract.
    script = r"""
$ErrorActionPreference = 'Stop'
$stage = 'inspect'
try {
    $path = $env:WEBCODEX_SSH_FIXTURE_PRIVATE_PATH
    $item = Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw [System.InvalidOperationException]::new()
    }
    $stage = 'identity'
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $stage = 'descriptor'
    if ($item.PSIsContainer) { $acl = New-Object System.Security.AccessControl.DirectorySecurity }
    else { $acl = New-Object System.Security.AccessControl.FileSecurity }
    $sections = [System.Security.AccessControl.AccessControlSections]::Owner -bor [System.Security.AccessControl.AccessControlSections]::Access
    $acl.SetSecurityDescriptorSddlForm("O:${sid}D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;FA;;;${sid})", $sections)
    $stage = 'persist'
    # Set-Acl copies the descriptor with All sections. The direct .NET API
    # persists only the modified Owner/Access sections, leaving Group/SACL alone.
    $item.SetAccessControl($acl)
    $stage = 'verify'
    $actual = $item.GetAccessControl($sections)
    if ($actual.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid -or -not $actual.AreAccessRulesProtected) {
        throw [System.InvalidOperationException]::new()
    }
    $allowed = @($sid, 'S-1-5-18', 'S-1-5-32-544')
    $seen = @{}
    $full = [System.Security.AccessControl.FileSystemRights]::FullControl
    foreach ($rule in $actual.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
        $identity = $rule.IdentityReference.Value
        if ($allowed -notcontains $identity -or $rule.IsInherited -or
            $rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow -or
            ($rule.FileSystemRights -band $full) -ne $full) {
            throw [System.InvalidOperationException]::new()
        }
        $seen[$identity] = $true
    }
    foreach ($identity in $allowed) {
        if (-not $seen.ContainsKey($identity)) { throw [System.InvalidOperationException]::new() }
    }
} catch {
    $exception = $_.Exception.GetBaseException()
    $native = $null
    if ($exception -is [System.ComponentModel.Win32Exception]) { $native = $exception.NativeErrorCode }
    $diagnostic = [ordered]@{
        stage = $stage; exception_type = $exception.GetType().FullName;
        hresult = $exception.HResult; native_code = $native
    } | ConvertTo-Json -Compress
    [Console]::Out.WriteLine($diagnostic)
    exit 1
}
"""
    program = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    try:
        result = subprocess.run([str(program), "-NoLogo", "-NoProfile", "-NonInteractive",
                                 "-EncodedCommand", base64.b64encode(script.encode("utf-16le")).decode("ascii")],
                                env=os.environ | {"WEBCODEX_SSH_FIXTURE_PRIVATE_PATH": str(path)},
                                stdin=subprocess.DEVNULL, capture_output=True, timeout=20)
    except subprocess.TimeoutExpired:
        raise AssertionError("Windows fixture ACL failed: stage=powershell_timeout") from None
    except OSError as error:
        raise AssertionError(f"Windows fixture ACL failed: stage=powershell_spawn; errno={error.errno}") from None
    check(result.returncode == 0, "Windows fixture ACL failed: " + acl_failure_details(result))


def stop(process: subprocess.Popen | None) -> None:
    if os.name != "nt":
        stop_posix(process)
    elif process is not None and process.poll() is None:
        # SIGINT is not a portable Popen signal on Windows. These are owned
        # temporary services; terminating the Runner also exercises recovery
        # from its already-committed credential/registry state.
        process.terminate()
        try:
            process.wait(timeout=20)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def channel_input(channel, deadline: float, limit: int = 2 * 1024 * 1024) -> bytes:
    data = bytearray()
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("fixture input deadline")
        channel.settimeout(remaining)
        part = channel.recv(min(65536, limit - len(data) + 1))
        if not part:
            return bytes(data)
        data.extend(part)
        if len(data) > limit:
            raise ValueError("fixture input limit")


def generated_key():
    pem = Ed25519PrivateKey.generate().private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.OpenSSH,
        serialization.NoEncryption(),
    )
    return paramiko.Ed25519Key(file_obj=io.StringIO(pem.decode())), pem


def fingerprint(key) -> str:
    digest = hashlib.sha256(key.asbytes()).digest()
    return "SHA256:" + base64.b64encode(digest).decode().rstrip("=")


class SshFixture:
    """Small real SSH server; rejects forwarding, PTY, and interactive shells."""

    def __init__(self, root: Path, tools: HostTools):
        check(paramiko is not None, "Install test-only dependency paramiko==4.0.0 before running this acceptance")
        self.root = root
        self.tools = tools
        self.user = "webcodex-ssh-fixture"
        self.password = secrets.token_urlsafe(32)
        self.host_key, _ = generated_key()
        self.client_key, client_pem = generated_key()
        self.key_path = root / "client-key"
        self.key_path.write_bytes(client_pem)
        secure_fixture_path(self.key_path)
        self.passphrase = secrets.token_urlsafe(32)
        # Exercise literal %, environment syntax, spaces and a guaranteed
        # partial UTF-8 character in the 100-byte native passphrase prompt.
        self.encrypted_key_path = special_key_path(root)
        encrypted_dir = self.encrypted_key_path.parent
        encrypted_dir.mkdir(mode=0o700)
        secure_fixture_path(encrypted_dir)
        self.encrypted_key_path.write_bytes(serialization.load_ssh_private_key(client_pem, password=None).private_bytes(
            serialization.Encoding.PEM, serialization.PrivateFormat.OpenSSH,
            serialization.BestAvailableEncryption(self.passphrase.encode()),
        ))
        secure_fixture_path(self.encrypted_key_path)
        self.ascii_encrypted_key_path = encrypted_key_control_copy(self.encrypted_key_path, root)
        _, wrong_key_pem = generated_key()
        self.wrong_key_path = encrypted_dir / "wrong-key"
        self.wrong_key_path.write_bytes(wrong_key_pem)
        secure_fixture_path(self.wrong_key_path)
        wrong_host_key, _ = generated_key()
        self.correct_hosts_path = encrypted_dir / "correct-known-hosts"
        self.wrong_hosts_path = encrypted_dir / "wrong-known-hosts"
        for path, key in [(self.correct_hosts_path, self.host_key), (self.wrong_hosts_path, wrong_host_key)]:
            path.write_text(f"{PIN_PROBE_ALIAS} {key.get_name()} {key.get_base64()}\n", encoding="ascii")
            secure_fixture_path(path)
        self.remote = root / "remote"
        self.remote.mkdir(mode=0o700)
        self.remote_cwd = tools.remote_path(self.remote)
        self.listener = socket.socket()
        self.listener.bind(("127.0.0.1", 0))
        self.listener.listen(16)
        self.listener.settimeout(0.2)
        self.port = self.listener.getsockname()[1]
        self.closed = threading.Event()
        self.transports = []
        self.threads = []
        for name in FIXTURE_COUNTERS:
            setattr(self, name, 0)
        self.thread = threading.Thread(target=self.accept, daemon=True)
        self.thread.start()

    def accept(self):
        while not self.closed.is_set():
            try:
                connection, _ = self.listener.accept()
            except socket.timeout:
                continue
            except OSError:
                break
            if len(self.threads) >= 128:
                connection.close()
                continue
            thread = threading.Thread(target=self.serve, args=(connection,), daemon=True)
            self.threads.append(thread)
            thread.start()

    def serve(self, connection):
        fixture = self

        class Server(paramiko.ServerInterface):
            def get_allowed_auths(self, username):
                return "password,publickey"

            def check_auth_password(self, username, password):
                fixture.password_attempts += 1
                valid = username == fixture.user and secrets.compare_digest(password, fixture.password)
                fixture.successful_passwords += int(valid)
                return paramiko.AUTH_SUCCESSFUL if valid else paramiko.AUTH_FAILED

            def check_auth_publickey(self, username, key):
                valid = fixture.record_key_offer(username, key)
                return paramiko.AUTH_SUCCESSFUL if valid else paramiko.AUTH_FAILED

            def check_channel_request(self, kind, chanid):
                return (paramiko.OPEN_SUCCEEDED if kind == "session"
                        else paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED)

            def check_channel_exec_request(self, channel, command):
                if len(command) > 128 * 1024:
                    return False
                threading.Thread(target=fixture.execute, args=(channel, command), daemon=True).start()
                return True

        transport = paramiko.Transport(connection)
        self.transports.append(transport)
        transport.add_server_key(self.host_key)
        transport.banner_timeout = 5
        transport.auth_timeout = 10
        try:
            transport.start_server(server=Server())
            while transport.is_active() and not self.closed.is_set():
                # Retain channels until their execution thread closes them.
                channel = transport.accept(0.2)
                if channel is not None:
                    while not channel.closed and transport.is_active() and not self.closed.is_set():
                        self.closed.wait(0.02)
        except (EOFError, OSError, paramiko.SSHException):
            # keyscan deliberately disconnects and requests unsupported key types.
            pass
        finally:
            transport.close()

    def execute(self, channel, command):
        self.executions += 1
        input_complete = False
        try:
            deadline = time.monotonic() + 15
            # Native Windows OpenSSH carries the exact program on channel
            # stdin. Preserve those bytes and EOF; DEVNULL would test only
            # authentication and silently discard the real execution protocol.
            data = channel_input(channel, deadline)
            self.input_eofs += 1
            input_complete = True
            if command.startswith(b": WEBCODEX_SSH_PROGRAM_BYTES=") and data:
                self.framed_executions += 1
            self.commands_started += 1
            result = subprocess.run(
                [str(self.tools.shell), "-c", command.decode("utf-8")], cwd=self.remote,
                env=self.tools.remote_env, input=data,
                capture_output=True, timeout=max(0.001, deadline - time.monotonic()),
            )
            self.commands_finished += 1
            channel.sendall(result.stdout[:2 * 1024 * 1024])
            channel.sendall_stderr(result.stderr[:2 * 1024 * 1024])
            channel.send_exit_status(result.returncode)
        except (OSError, ValueError, subprocess.TimeoutExpired) as error:
            self.execution_failures += 1
            if not input_complete and isinstance(error, TimeoutError):
                self.input_timeouts += 1
            try:
                channel.send_exit_status(125)
            except OSError:
                pass
        finally:
            channel.close()

    def record_key_offer(self, username, key):
        # OpenSSH may offer the public part before decrypting/signing with the
        # private key. These counts therefore do not claim successful key login.
        self.publickey_requests += 1
        valid = username == self.user and key == self.client_key
        self.accepted_key_offers += int(valid)
        return valid

    def diagnostic_counts(self):
        # Only fixture-owned counters leave the test. Never print credentials,
        # paths, SSH command/prompt bodies, or captured process output on failure.
        return {name: min(1000000, getattr(self, name)) for name in FIXTURE_COUNTERS}

    def close(self):
        self.closed.set()
        self.listener.close()
        for transport in self.transports:
            transport.close()
        self.thread.join(timeout=3)
        for thread in self.threads:
            thread.join(timeout=0.1)


class ConnectionAcceptance(Smoke):
    def __init__(self, bin_dir: Path, root: Path, tools: HostTools):
        super().__init__(bin_dir, root)
        self.stage = "prepare"
        # Windows ignores XDG roots for several native state stores. Isolate
        # both Windows locations too, without changing the actual OS identity,
        # USERPROFILE or the native OpenSSH installation.
        for variable, directory in [("APPDATA", "roaming"), ("LOCALAPPDATA", "local")]:
            path = root / directory
            path.mkdir(mode=0o700)
            secure_fixture_path(path)
            self.env[variable] = str(path)
        self.native_runner = (prepare_windows_runner(bin_dir / "webcodex-runner.exe", root)
                              if os.name == "nt" else None)
        self.ssh = SshFixture(root, tools)
        self.stage_counts = self.ssh.diagnostic_counts()
        self.stage_log_offsets = {}
        self.primary_probe_diagnostic = None
        self.ascii_key_control = None
        self.remote_cwd = self.ssh.remote_cwd
        self.endpoint = {"host": "127.0.0.1", "port": self.ssh.port, "user": self.ssh.user}
        self.authentication = {"type": "password", "password": self.ssh.password}
        self.env.update({"PATH": tools.runner_path, "WEBCODEX_ENV_FILE": os.devnull,
                         "WEBCODEX_MCP_HOST_PROFILE": "direct",
                         "WEBCODEX_TOOL_REQUEST_TRACE": "full",
                         "WEBCODEX_TOOL_REQUEST_TRACE_DIR": str(root / "traces"),
                         # The child must force its one literal-dollar value,
                         # never trust an inherited value from the launcher.
                         LITERAL_DOLLAR_ENV: "fixture-inherited-value-must-not-be-used"})

    def launch(self, binary: str, args: list[str], env: dict) -> subprocess.Popen:
        if os.name != "nt":
            return super().launch(binary, args, env)
        log = (self.root / f"{binary}-{len(self.logs)}.log").open("wb")
        self.logs.append(log)
        program, caller_cwd = self.bin_dir / (binary + ".exe"), None
        if binary == "webcodex-runner":
            check(self.native_runner is not None, "native Runner fixture is missing")
            self.native_runner.verify()
            program, caller_cwd = self.native_runner.executable, self.native_runner.caller_cwd
        return subprocess.Popen([str(program), *args], env=env, cwd=caller_cwd,
                                stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)

    def operator(self, action, body, token=None, success=True):
        result = self.post("/api/runtime-console/ssh-resources/" + action, body, token or self.owner)
        check(all(secret not in json.dumps(result) for secret in [self.ssh.password, self.ssh.passphrase]),
              "credential appeared in operator response")
        if result.get("success") is not success:
            raise OperatorCallFailed(action, success, result)
        return result.get("output", {})

    def runner_log_offsets(self):
        offsets = {}
        for log in self.logs[-4:]:
            path = Path(log.name)
            if path.name.startswith("webcodex-runner-"):
                try:
                    offsets[str(path)] = path.stat().st_size
                except OSError:
                    pass
        return offsets

    def runner_probe_diagnostic(self, offsets):
        latest = None
        for name, offset in list(offsets.items())[-2:]:
            try:
                with Path(name).open("rb") as stream:
                    stream.seek(0, os.SEEK_END)
                    end = stream.tell()
                    stream.seek(max(offset, end - 65536))
                    observed = observed_probe_diagnostic(stream.read(65536))
                    if observed is not None:
                        latest = observed
            except OSError:
                pass
        return latest

    def begin_stage(self, stage):
        self.stage = stage
        self.stage_counts = self.ssh.diagnostic_counts()
        self.stage_log_offsets = self.runner_log_offsets()

    def stage_diagnostic(self):
        counts = self.ssh.diagnostic_counts()
        return {"stage": self.stage if self.stage in ACCEPTANCE_STAGES else "unknown",
                "counts": counts, "stage_delta": counter_delta(self.stage_counts, counts),
                "runner_probe_observed": self.runner_probe_diagnostic(self.stage_log_offsets)}

    def diagnose_ascii_key(self, probe):
        path = self.ssh.ascii_encrypted_key_path
        if not str(path).isascii():
            return {"outcome": "not_available"}
        before = self.ssh.diagnostic_counts()
        offsets = self.runner_log_offsets()
        diagnostic = {"outcome": "unconfirmed"}
        try:
            self.operator("probe", probe | {"authentication": {
                "type": "identity_file", "path": str(path), "passphrase": self.ssh.passphrase,
            }})
            diagnostic["outcome"] = "succeeded"
        except OperatorCallFailed as error:
            diagnostic.update({"outcome": "failed", "error_kind": error.error_kind})
        except Exception:
            # A failed diagnostic never replaces or prints the primary failure.
            pass
        diagnostic["stage_delta"] = counter_delta(before, self.ssh.diagnostic_counts())
        diagnostic["runner_probe_observed"] = self.runner_probe_diagnostic(offsets)
        return diagnostic

    def probe_encrypted_key(self, probe):
        try:
            return self.operator("probe", probe)
        except OperatorCallFailed:
            # Snapshot the original evidence before making exactly one controlled
            # comparison. Even successful ASCII authentication cannot pass the
            # Unicode acceptance or continue to persistence/restart/execution.
            self.primary_probe_diagnostic = self.stage_diagnostic()
            self.ascii_key_control = self.diagnose_ascii_key(probe)
            raise

    def failure_diagnostic(self):
        summary = dict(self.primary_probe_diagnostic or self.stage_diagnostic())
        if self.ascii_key_control is not None:
            summary["ascii_key_control"] = self.ascii_key_control
        return summary

    def reject_wrong_key(self, probe):
        self.begin_stage("wrong_key_probe")
        before = self.ssh.diagnostic_counts()
        denied = self.operator("probe", probe | {"authentication": {
            "type": "identity_file", "path": str(self.ssh.wrong_key_path),
        }}, success=False)
        after = self.ssh.diagnostic_counts()
        check(denied.get("error_kind") == "ssh_authentication_failed",
              "the actual untrusted private key was not rejected as an authentication failure")
        check(after["publickey_requests"] > before["publickey_requests"]
              and after["accepted_key_offers"] == before["accepted_key_offers"],
              "wrong-key negative must offer the actual untrusted key without accepting it")
        check(after["executions"] == before["executions"]
              and after["password_attempts"] == before["password_attempts"],
              "the untrusted key must not execute or fall back to password authentication")

    def check_user_known_hosts_only(self):
        if os.name == "nt":
            program = Path(os.environ["SystemRoot"]) / "System32/OpenSSH/ssh.exe"
        else:
            resolved = shutil.which("ssh", path=self.ssh.tools.runner_path)
            check(resolved is not None, "the native SSH pin probe client is missing")
            program = Path(resolved)
        check(str(self.ssh.key_path).isascii(),
              "UserKnownHostsFile isolation requires an ASCII plain-key fixture path")
        selected_hosts = self.ssh.correct_hosts_path
        try:
            correct_pin = selected_hosts.read_bytes()
            wrong_pin = self.ssh.wrong_hosts_path.read_bytes()
        except OSError:
            raise AssertionError("fixture host-key pin bytes could not be read") from None
        check(correct_pin and wrong_pin and correct_pin != wrong_pin,
              "the native pin probe must use two different actual host keys")
        # Ignore ambient helpers and agents. Only the fixture's ordinary key
        # authenticates here; password/passphrase handling stays in product E2E.
        env = {name: value for name, value in self.env.items()
               if not name.startswith(("SSH_ASKPASS", "WEBCODEX_SSH_"))
               and name not in {"SSH_AUTH_SOCK", "SSH_AGENT_PID"}}
        env.update({LITERAL_DOLLAR_ENV: "$", "LC_ALL": "C"})
        for stage, expected in [
            ("user_known_hosts_correct_pin", True),
            ("user_known_hosts_wrong_pin", False),
        ]:
            self.begin_stage(stage)
            before = self.ssh.diagnostic_counts()
            if not expected:
                # Change only the bytes in the same selected file. A missing
                # or misaddressed second path cannot satisfy the negative case.
                # Truncating the owned existing file preserves its private ACL.
                try:
                    selected_hosts.write_bytes(wrong_pin)
                    installed_pin = selected_hosts.read_bytes()
                except OSError:
                    raise AssertionError("fixture wrong host-key pin could not be installed") from None
                check(installed_pin == wrong_pin, "fixture wrong host-key pin bytes were not installed")
            arguments = user_known_hosts_command(program, self.endpoint, selected_hosts, self.ssh.key_path)
            try:
                result = subprocess.run(arguments, env=env, stdin=subprocess.DEVNULL,
                                        capture_output=True, timeout=15)
            except subprocess.TimeoutExpired:
                raise AssertionError("UserKnownHostsFile-only native probe timed out") from None
            except OSError:
                raise AssertionError("UserKnownHostsFile-only native client could not start") from None
            check(all(secret.encode() not in result.stdout + result.stderr
                      for secret in [self.ssh.password, self.ssh.passphrase]),
                  "credential appeared in the native pin probe output")
            after = self.ssh.diagnostic_counts()
            if expected:
                check(result.returncode == 0 and result.stdout == PIN_PROBE_OUTPUT,
                      "UserKnownHostsFile-only correct pin did not produce the exact remote response")
                check(after["executions"] > before["executions"]
                      and after["accepted_key_offers"] > before["accepted_key_offers"],
                      "UserKnownHostsFile-only correct pin did not authenticate and execute")
            else:
                check(result.returncode != 0, "UserKnownHostsFile-only wrong pin was accepted")
                check(all(after[name] == before[name] for name in [
                    "password_attempts", "publickey_requests", "accepted_key_offers", "executions",
                ]), "wrong user host-key pin must fail before authentication or execution")
        print("PASS: special-path UserKnownHostsFile alone accepts only the exact host key")

    def observe(self):
        return self.operator("list", {"runner": "ssh-setup-runner"})

    def readiness_post(self, path, body, deadline):
        remaining = deadline - time.monotonic()
        check(remaining > 0, "replacement Runner readiness deadline exceeded")
        try:
            result = self.post(path, body, self.owner, timeout=min(20, remaining))
        except (OSError, URLError, ValueError):
            raise AssertionError("replacement Runner readiness observation unavailable") from None
        # Never accept a late response as proof of readiness within the budget.
        check(time.monotonic() < deadline, "replacement Runner readiness deadline exceeded")
        check(isinstance(result, dict), "replacement Runner readiness response is invalid")
        return result

    def runner_catalog(self, deadline):
        result = self.readiness_post("/api/tools/call", {"tool": "list_runners", "params": {
            "client_id": "ssh-setup-runner", "include_projects": True, "summary_only": False,
        }}, deadline)
        output = result.get("output")
        check(result.get("success") is True and isinstance(output, dict),
              "replacement Runner catalog observation failed")
        rows = output.get("runners")
        check(isinstance(rows, list) and len(rows) <= 1,
              "replacement Runner catalog is ambiguous")
        if not rows:
            return None
        row = rows[0]
        check(isinstance(row, dict) and row.get("client_id") == "ssh-setup-runner"
              and isinstance(row.get("runner_instance_id"), str) and row["runner_instance_id"]
              and isinstance(row.get("connected"), bool),
              "replacement Runner catalog identity is invalid")
        return row

    def fixture_project_identity(self, row):
        inventory = row.get("project_inventory")
        check(isinstance(inventory, dict) and inventory.get("sync_state") in {
            "pending", "in_progress", "complete",
        }, "replacement Runner project inventory is unavailable or failed")
        if not row["connected"] or inventory["sync_state"] != "complete":
            return None
        check(row.get("projects_truncated") is False and row.get("projects_next_offset") is None
              and row.get("projects_offset") == 0, "fixture Project inventory must be complete")
        projects = row.get("projects")
        check(isinstance(projects, list) and all(isinstance(item, dict) for item in projects),
              "fixture Project inventory is invalid")
        matches = [item for item in projects if item.get("id") == "fixture"]
        check(len(matches) == 1 and matches[0].get("disabled") is False,
              "complete Runner catalog does not contain the enabled fixture Project")
        path, fingerprint = matches[0].get("path"), matches[0].get("root_fingerprint")
        check(isinstance(path, str) and path and isinstance(fingerprint, str) and fingerprint,
              "fixture Project root identity is unavailable")
        return path, fingerprint

    def restart_runner(self):
        before = self.runner_catalog(time.monotonic() + 20)
        check(before is not None, "original Runner catalog is missing")
        identity = self.fixture_project_identity(before)
        check(identity is not None, "original Runner Project inventory is not ready")
        try:
            # Rust canonical paths can have a Windows extended-path prefix.
            # Verify the filesystem identity once, then retain that exact
            # canonical path and fingerprint across the process replacement.
            same_root = Path(identity[0]).samefile(self.project_dir)
        except (OSError, ValueError):
            same_root = False
        check(same_root, "original Runner reported a different fixture Project root")
        stop(self.runner)
        self.runner = self.launch("webcodex-runner", ["--config", str(self.config)], self.env)
        deadline, replacement = time.monotonic() + 45, None
        while time.monotonic() < deadline:
            check(self.server.poll() is None and self.runner.poll() is None,
                  "temporary Server or replacement Runner exited")
            row = self.runner_catalog(deadline)
            if row is not None:
                instance = row["runner_instance_id"]
                if replacement is None and instance != before["runner_instance_id"]:
                    replacement = instance
                check(replacement is None or instance == replacement,
                      "replacement Runner instance changed during readiness")
                if instance == replacement:
                    observed = self.fixture_project_identity(row)
                    if observed is not None:
                        check(observed == identity, "replacement Runner fixture Project identity changed")
                        result = self.readiness_post("/api/runtime-console/ssh-resources/list",
                                                     {"runner": "ssh-setup-runner"}, deadline)
                        output = result.get("output")
                        check(isinstance(output, dict), "replacement Runner SSH observation is invalid")
                        if result.get("success") is True:
                            loaded = output.get("resources") == [{"name": "password-fixture",
                                "source": "managed", "active": True, "pending_restart": False}]
                            if loaded:
                                check(isinstance(output.get("binding"), str) and output["binding"],
                                      "replacement Runner SSH observation has no binding")
                                # SSH bindings are opaque. Bracket the fresh
                                # Runner response with the same ready instance;
                                # never infer Project readiness from SSH alone.
                                after = self.runner_catalog(deadline)
                                check(after is not None and after["runner_instance_id"] == replacement,
                                      "replacement Runner instance changed during SSH observation")
                                final_identity = self.fixture_project_identity(after)
                                if final_identity is not None:
                                    check(final_identity == identity,
                                          "replacement Runner fixture Project identity changed")
                                    check(time.monotonic() < deadline,
                                          "replacement Runner readiness deadline exceeded")
                                    return output
                        else:
                            check(operator_error_kind(result) in {
                                "ssh_resource_registry_unavailable", "runner_unavailable",
                            }, "replacement Runner SSH observation failed")
            remaining = deadline - time.monotonic()
            if remaining > 0:
                time.sleep(min(0.1, remaining))
        raise AssertionError("replacement Runner readiness deadline exceeded")

    def prepare(self):
        self.start_server()
        check(self.post("/api/users/create", {"username": "ssh-setup-owner"}, self.bootstrap).get("success"),
              "fixture owner creation failed")
        scopes = ["runtime:read", "project:read", "project:write", "job:run", "session:collaborate", "ssh:local"]
        self.owner = self.pat("ssh-setup-owner", scopes)
        self.restricted = self.pat("ssh-setup-owner", [scope for scope in scopes if scope != "ssh:local"])
        enrollment = self.post("/api/agent-tokens/create", {
            "username": "ssh-setup-owner", "client_id": "ssh-setup-runner", "name": "ssh-fixture"
        }, self.bootstrap)
        check(isinstance(enrollment.get("token"), str), "fixture Runner enrollment failed")
        self.project_dir = self.root / "project"
        self.project_dir.mkdir(mode=0o700)
        registry = self.root / "projects"
        registry.mkdir(mode=0o700)
        (registry / "fixture.toml").write_text(f'id = "fixture"\npath = {json.dumps(str(self.project_dir))}\n')
        # OpenSSH expands % tokens in UserKnownHostsFile. The Runner must quote
        # its private path even when the operator config directory contains %.
        config_dir = self.root / "runner 中文 %q ${WEBCODEX_FIXTURE_UNSET} configuration"
        config_dir.mkdir(mode=0o700)
        secure_fixture_path(config_dir)
        self.config = config_dir / "runner.toml"
        self.config.write_text("\n".join([
            f'server_url = "{self.url}"', f'token = {json.dumps(enrollment["token"])}',
            'client_id = "ssh-setup-runner"', 'owner = "ssh-setup-owner"', 'transport = "websocket"',
            f'project_registry_dir = {json.dumps(str(registry))}', '[policy]', 'allow_raw_shell = true',
            f'allowed_roots = [{json.dumps(str(self.project_dir))}]',
        ]) + "\n")
        secure_fixture_path(self.config)
        self.runner = self.launch("webcodex-runner", ["--config", str(self.config)], self.env)
        self.project = "agent:ssh-setup-runner:fixture"
        self.wait_ready(self.project, self.owner)

    def run(self):
        self.prepare()
        self.initialize(self.owner)
        self.begin_stage("scope")
        denied = self.post("/api/runtime-console/ssh-resources/list", {"runner": "ssh-setup-runner"}, self.restricted)
        check(denied.get("success") is not True, "missing ssh:local scope was accepted")
        binding = self.observe()["binding"]
        self.begin_stage("host_key_inspection")
        inspected = self.operator("inspect", {"binding": binding, "endpoint": self.endpoint})
        keys = inspected["host_keys"]
        check(any(key["fingerprint"] == fingerprint(self.ssh.host_key) for key in keys),
              "inspect did not return the actual fixture host key")
        trust = {"challenge_id": inspected["challenge_id"], "fingerprint": fingerprint(self.ssh.host_key)}
        probe = {"binding": binding, "endpoint": self.endpoint,
                 "authentication": self.authentication, "host_key": trust}
        before = self.ssh.successful_passwords
        self.begin_stage("wrong_password")
        wrong = self.operator("probe", probe | {"authentication": {"type": "password", "password": "wrong-fixture-password"}}, success=False)
        check(wrong.get("error_kind") == "ssh_authentication_failed", "wrong password was not classified")
        check(self.ssh.successful_passwords == before, "wrong password authenticated")

        original_key = self.ssh.host_key
        attempts_before_changed_key = self.ssh.password_attempts
        self.ssh.host_key, _ = generated_key()
        self.begin_stage("changed_host_key")
        changed = self.operator("probe", probe, success=False)
        check(changed.get("error_kind") == "ssh_host_key_changed", "changed host key was not rejected")
        check(self.ssh.successful_passwords == before, "password sent before host-key verification")
        check(self.ssh.password_attempts == attempts_before_changed_key,
              "changed host key reached password authentication")
        self.ssh.host_key = original_key
        self.begin_stage("password_probe")
        valid = self.operator("probe", probe)
        check(valid["host_key_fingerprint"] == trust["fingerprint"], "probe acknowledged another key")
        check(self.ssh.successful_passwords > before, "successful probe did not perform password authentication")

        key_probe = probe | {"authentication": {"type": "identity_file", "path": str(self.ssh.key_path)}}
        self.begin_stage("plain_key_probe")
        self.operator("probe", key_probe)
        self.reject_wrong_key(probe)
        encrypted_key_probe = probe | {"authentication": {"type": "identity_file",
            "path": str(self.ssh.encrypted_key_path), "passphrase": self.ssh.passphrase}}
        self.begin_stage("encrypted_key_probe")
        self.probe_encrypted_key(encrypted_key_probe)
        self.check_user_known_hosts_only()
        self.begin_stage("register")
        saved = self.operator("register", {
            "binding": binding, "name": "password-fixture", "default_cwd": self.remote_cwd,
            "connection": {"kind": "direct", "endpoint": self.endpoint,
                           "authentication": self.authentication, "host_key": trust},
        })
        check(saved.get("persisted") is True and saved.get("restart_required") is True,
              "save must stage desired state and require restart")
        listed = self.observe()
        check(listed["resources"] == [{"name": "password-fixture", "source": "managed",
                                      "active": False, "pending_restart": True}],
              "saved connection was incorrectly reported as loaded")
        check("password" not in json.dumps(listed).replace("password-fixture", ""),
              "inventory disclosed authentication data")
        print("PASS: scope, real host-key inspection, wrong password, changed key, password/plain/encrypted-key login, staged save")

        self.begin_stage("runner_restart")
        listed = self.restart_runner()
        check(listed["resources"][0]["active"] and not listed["resources"][0]["pending_restart"],
              "saved connection was not loaded after Runner restart")
        session = self.tool("work_on_project", {"project": self.project,
            "instruction": "Verify the disposable SSH execution target"}, self.owner)
        check(session.get("resolved_project") == self.project,
              "MCP startup selected a different Project")
        session_id = session.get("session_id")
        check(isinstance(session_id, str) and session_id.startswith("wc_sess_"),
              "MCP startup did not return an explicit Workflow Session")
        # Bootstrap and Session execution defaults are separate contracts.
        # MCP receives only the loaded logical resource name and remote cwd;
        # authentication and host-key trust remain in the operator flow.
        execution_context = {"resource": "password-fixture", "default_cwd": self.remote_cwd}
        updated = self.tool("update_session_context", {"project": self.project,
            "session_id": session_id, "execution_context": execution_context}, self.owner)
        check(updated.get("project") == self.project and updated.get("session_id") == session_id
              and updated.get("execution_context") == execution_context,
              "MCP context update did not bind the exact Session and SSH resource")
        self.begin_stage("remote_shell")
        output = self.tool("run_shell", {"project": self.project,
            "session_id": session_id,
            "command": "printf 'SSH_PASSWORD_ROUTE_OK\\n' > remote-proof.txt; cat remote-proof.txt",
            "timeout_secs": 15}, self.owner)
        check((self.ssh.remote / "remote-proof.txt").read_text() == "SSH_PASSWORD_ROUTE_OK\n",
              "MCP shell did not execute in the SSH target")
        check(not (self.project_dir / "remote-proof.txt").exists(), "MCP shell fell back to local execution")
        if os.name == "nt":
            self.native_runner.verify()
            check(not (self.native_runner.caller_cwd / "remote-proof.txt").exists()
                  and not (self.native_runner.executable.parent / "remote-proof.txt").exists(),
                  "MCP shell executed in a local Runner or helper directory")
            check(self.ssh.framed_executions > 0,
                  "Native Windows SSH did not deliver the real program over channel stdin")
        check(self.ssh.password not in json.dumps(output), "MCP output disclosed the password")
        print("PASS: persisted password survives Runner restart; MCP run_shell executes on the selected SSH resource")

        self.begin_stage("privacy")
        stop(self.runner)
        stop(self.server)
        for directory in [self.root / "data", self.root / "traces"]:
            if directory.exists():
                for path in directory.rglob("*"):
                    if path.is_file():
                        data = path.read_bytes()
                        check(all(secret.encode() not in data for secret in [self.ssh.password, self.ssh.passphrase]),
                              "credential appeared in Server durable state or full trace")
        for log in self.logs:
            log.flush()
            data = Path(log.name).read_bytes()
            check(all(secret.encode() not in data for secret in [self.ssh.password, self.ssh.passphrase]),
                  "credential appeared in a process log")
        print("PASS: password and passphrase absent from Server durable state, full traces, public responses, and process logs")

    def close(self):
        stop(self.runner)
        stop(self.server)
        self.ssh.close()
        for log in self.logs:
            log.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin-dir", type=Path, default=ROOT / "target" / "dogfood")
    args = parser.parse_args()
    check(paramiko is not None, "Install test-only dependency paramiko==4.0.0 before running this acceptance")
    tools = HostTools.discover()
    for binary in ["webcodex-server", "webcodex-runner"]:
        filename = binary + (".exe" if os.name == "nt" else "")
        check((args.bin_dir / filename).is_file(), f"Build {binary} with the dogfood profile first")
    logging.getLogger("paramiko").addHandler(logging.NullHandler())
    logging.getLogger("paramiko").propagate = False
    with tempfile.TemporaryDirectory(prefix="webcodex-ssh-acceptance-") as temporary:
        root = Path(temporary).resolve()
        secure_fixture_path(root)
        acceptance = ConnectionAcceptance(args.bin_dir.resolve(), root, tools)
        try:
            acceptance.run()
        except Exception:
            print("SSH acceptance diagnostic: " + json.dumps(acceptance.failure_diagnostic(),
                                                             sort_keys=True), flush=True)
            raise
        finally:
            acceptance.close()


if __name__ == "__main__":
    main()
