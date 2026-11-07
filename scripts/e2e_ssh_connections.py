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


def git_posix_tools(git: Path) -> tuple[Path, Path]:
    # cmd/git.exe is usual in PowerShell; Git Bash exposes mingw64/bin/git.exe.
    for root in list(git.resolve().parents)[:3]:
        shell = root / "usr/bin/sh.exe"
        cygpath = shell.with_name("cygpath.exe")
        if shell.is_file() and cygpath.is_file():
            return shell, cygpath
    raise AssertionError("Git for Windows POSIX fixture tools are missing")


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
        check(b"OpenSSH_for_Windows" in version.stdout + version.stderr,
              "Windows acceptance requires the native Microsoft OpenSSH client")
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
        print("Using native System32 OpenSSH client/keyscan; Git Bash is the remote fixture only")
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
        # OpenSSH abbreviates passphrase prompts at 100 bytes. Deliberately
        # cross that boundary inside a UTF-8 path to cover the native helper.
        encrypted_dir = root / ("encrypted-key-" + "长" * 40)
        encrypted_dir.mkdir(mode=0o700)
        self.encrypted_key_path = encrypted_dir / "client-key"
        self.encrypted_key_path.write_bytes(serialization.load_ssh_private_key(client_pem, password=None).private_bytes(
            serialization.Encoding.PEM, serialization.PrivateFormat.OpenSSH,
            serialization.BestAvailableEncryption(self.passphrase.encode()),
        ))
        secure_fixture_path(self.encrypted_key_path)
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
        self.password_attempts = 0
        self.successful_passwords = 0
        self.executions = 0
        self.framed_executions = 0
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
                valid = username == fixture.user and key == fixture.client_key
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
        try:
            deadline = time.monotonic() + 15
            # Native Windows OpenSSH carries the exact program on channel
            # stdin. Preserve those bytes and EOF; DEVNULL would test only
            # authentication and silently discard the real execution protocol.
            data = channel_input(channel, deadline)
            if command.startswith(b": WEBCODEX_SSH_PROGRAM_BYTES=") and data:
                self.framed_executions += 1
            result = subprocess.run(
                [str(self.tools.shell), "-c", command.decode("utf-8")], cwd=self.remote,
                env=self.tools.remote_env, input=data,
                capture_output=True, timeout=max(0.001, deadline - time.monotonic()),
            )
            channel.sendall(result.stdout[:2 * 1024 * 1024])
            channel.sendall_stderr(result.stderr[:2 * 1024 * 1024])
            channel.send_exit_status(result.returncode)
        except (OSError, ValueError, subprocess.TimeoutExpired):
            try:
                channel.send_exit_status(125)
            except OSError:
                pass
        finally:
            channel.close()

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
        # Windows ignores XDG roots for several native state stores. Isolate
        # both Windows locations too, without changing the actual OS identity,
        # USERPROFILE or the native OpenSSH installation.
        for variable, directory in [("APPDATA", "roaming"), ("LOCALAPPDATA", "local")]:
            path = root / directory
            path.mkdir(mode=0o700)
            secure_fixture_path(path)
            self.env[variable] = str(path)
        self.ssh = SshFixture(root, tools)
        self.remote_cwd = self.ssh.remote_cwd
        self.endpoint = {"host": "127.0.0.1", "port": self.ssh.port, "user": self.ssh.user}
        self.authentication = {"type": "password", "password": self.ssh.password}
        self.env.update({"PATH": tools.runner_path, "WEBCODEX_ENV_FILE": os.devnull,
                         "WEBCODEX_MCP_HOST_PROFILE": "direct",
                         "WEBCODEX_TOOL_REQUEST_TRACE": "full",
                         "WEBCODEX_TOOL_REQUEST_TRACE_DIR": str(root / "traces")})

    def launch(self, binary: str, args: list[str], env: dict) -> subprocess.Popen:
        if os.name != "nt":
            return super().launch(binary, args, env)
        log = (self.root / f"{binary}-{len(self.logs)}.log").open("wb")
        self.logs.append(log)
        return subprocess.Popen([str(self.bin_dir / (binary + ".exe")), *args], env=env,
                                stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)

    def operator(self, action, body, token=None, success=True):
        result = self.post("/api/runtime-console/ssh-resources/" + action, body, token or self.owner)
        check(result.get("success") is success,
              f"operator {action}: expected success={success}; fields={list(result)}; "
              f"code={result.get('output', {}).get('error_kind')}")
        check(all(secret not in json.dumps(result) for secret in [self.ssh.password, self.ssh.passphrase]),
              "credential appeared in operator response")
        return result.get("output", {})

    def observe(self):
        return self.operator("list", {"runner": "ssh-setup-runner"})

    def wait_loaded_resource(self):
        # list_projects may retain the previous Runner's Project inventory.
        # Only a fresh operator response from the replacement Runner proves it
        # loaded the saved SSH resource. Retry bounded reads, never the save.
        deadline = time.monotonic() + 30
        last_kind = None
        while time.monotonic() < deadline:
            check(self.runner.poll() is None, "replacement Runner exited")
            result = self.post("/api/runtime-console/ssh-resources/list",
                               {"runner": "ssh-setup-runner"}, self.owner)
            if result.get("success") is True:
                output = result.get("output", {})
                resources = output.get("resources", [])
                if resources == [{"name": "password-fixture", "source": "managed",
                                  "active": True, "pending_restart": False}]:
                    return output
                last_kind = "saved_resource_not_loaded"
            else:
                last_kind = result.get("output", {}).get("error_kind")
                check(last_kind in {"ssh_resource_registry_unavailable", "runner_unavailable"},
                      f"replacement Runner SSH observation failed: {last_kind}")
            time.sleep(0.1)
        raise AssertionError(f"replacement Runner did not load the saved resource: {last_kind}")

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
        config_dir = self.root / "runner %q configuration"
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
        denied = self.post("/api/runtime-console/ssh-resources/list", {"runner": "ssh-setup-runner"}, self.restricted)
        check(denied.get("success") is not True, "missing ssh:local scope was accepted")
        binding = self.observe()["binding"]
        inspected = self.operator("inspect", {"binding": binding, "endpoint": self.endpoint})
        keys = inspected["host_keys"]
        check(any(key["fingerprint"] == fingerprint(self.ssh.host_key) for key in keys),
              "inspect did not return the actual fixture host key")
        trust = {"challenge_id": inspected["challenge_id"], "fingerprint": fingerprint(self.ssh.host_key)}
        probe = {"binding": binding, "endpoint": self.endpoint,
                 "authentication": self.authentication, "host_key": trust}
        before = self.ssh.successful_passwords
        wrong = self.operator("probe", probe | {"authentication": {"type": "password", "password": "wrong-fixture-password"}}, success=False)
        check(wrong.get("error_kind") == "ssh_authentication_failed", "wrong password was not classified")
        check(self.ssh.successful_passwords == before, "wrong password authenticated")

        original_key = self.ssh.host_key
        attempts_before_changed_key = self.ssh.password_attempts
        self.ssh.host_key, _ = generated_key()
        changed = self.operator("probe", probe, success=False)
        check(changed.get("error_kind") == "ssh_host_key_changed", "changed host key was not rejected")
        check(self.ssh.successful_passwords == before, "password sent before host-key verification")
        check(self.ssh.password_attempts == attempts_before_changed_key,
              "changed host key reached password authentication")
        self.ssh.host_key = original_key
        valid = self.operator("probe", probe)
        check(valid["host_key_fingerprint"] == trust["fingerprint"], "probe acknowledged another key")
        check(self.ssh.successful_passwords > before, "successful probe did not perform password authentication")

        key_probe = probe | {"authentication": {"type": "identity_file", "path": str(self.ssh.key_path)}}
        self.operator("probe", key_probe)
        encrypted_key_probe = probe | {"authentication": {"type": "identity_file",
            "path": str(self.ssh.encrypted_key_path), "passphrase": self.ssh.passphrase}}
        self.operator("probe", encrypted_key_probe)
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

        stop(self.runner)
        self.runner = self.launch("webcodex-runner", ["--config", str(self.config)], self.env)
        self.wait_ready(self.project, self.owner)
        listed = self.wait_loaded_resource()
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
        output = self.tool("run_shell", {"project": self.project,
            "session_id": session_id,
            "command": "printf 'SSH_PASSWORD_ROUTE_OK\\n' > remote-proof.txt; cat remote-proof.txt",
            "timeout_secs": 15}, self.owner)
        check((self.ssh.remote / "remote-proof.txt").read_text() == "SSH_PASSWORD_ROUTE_OK\n",
              "MCP shell did not execute in the SSH target")
        check(not (self.project_dir / "remote-proof.txt").exists(), "MCP shell fell back to local execution")
        if os.name == "nt":
            check(self.ssh.framed_executions > 0,
                  "Native Windows SSH did not deliver the real program over channel stdin")
        check(self.ssh.password not in json.dumps(output), "MCP output disclosed the password")
        print("PASS: persisted password survives Runner restart; MCP run_shell executes on the selected SSH resource")

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
        finally:
            acceptance.close()


if __name__ == "__main__":
    main()
