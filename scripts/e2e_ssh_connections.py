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
import hashlib
import io
import json
import logging
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time

from e2e_session_continuity_ws import ROOT, Smoke, check, stop

try:
    import paramiko
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
except ImportError:
    raise SystemExit("Install test-only dependency paramiko==4.0.0 before running this acceptance")


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

    def __init__(self, root: Path):
        self.root = root
        self.user = "webcodex-ssh-fixture"
        self.password = secrets.token_urlsafe(32)
        self.host_key, _ = generated_key()
        self.client_key, client_pem = generated_key()
        self.key_path = root / "client-key"
        self.key_path.write_bytes(client_pem)
        self.key_path.chmod(0o600)
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
        self.encrypted_key_path.chmod(0o600)
        self.remote = root / "remote"
        self.remote.mkdir(mode=0o700)
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
            result = subprocess.run(
                ["sh", "-c", command.decode("utf-8")], cwd=self.remote,
                env={"PATH": os.defpath, "LANG": "C"}, stdin=subprocess.DEVNULL,
                capture_output=True, timeout=15,
            )
            channel.sendall(result.stdout[:2 * 1024 * 1024])
            channel.sendall_stderr(result.stderr[:2 * 1024 * 1024])
            channel.send_exit_status(result.returncode)
        except (OSError, UnicodeError, subprocess.TimeoutExpired):
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
    def __init__(self, bin_dir: Path, root: Path):
        super().__init__(bin_dir, root)
        self.ssh = SshFixture(root)
        self.endpoint = {"host": "127.0.0.1", "port": self.ssh.port, "user": self.ssh.user}
        self.authentication = {"type": "password", "password": self.ssh.password}
        self.env.update({"WEBCODEX_ENV_FILE": os.devnull,
                         "WEBCODEX_MCP_HOST_PROFILE": "direct",
                         "WEBCODEX_TOOL_REQUEST_TRACE": "full",
                         "WEBCODEX_TOOL_REQUEST_TRACE_DIR": str(root / "traces")})

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
        self.config = config_dir / "runner.toml"
        self.config.write_text("\n".join([
            f'server_url = "{self.url}"', f'token = {json.dumps(enrollment["token"])}',
            'client_id = "ssh-setup-runner"', 'owner = "ssh-setup-owner"', 'transport = "websocket"',
            f'project_registry_dir = {json.dumps(str(registry))}', '[policy]', 'allow_raw_shell = true',
            f'allowed_roots = [{json.dumps(str(self.project_dir))}]',
        ]) + "\n")
        self.config.chmod(0o600)
        self.runner = self.launch("webcodex-runner", ["--config", str(self.config)], self.env)
        self.project = "agent:ssh-setup-runner:fixture"
        self.wait_ready(self.project, self.owner)

    def run(self):
        self.prepare()
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
            "binding": binding, "name": "password-fixture", "default_cwd": str(self.ssh.remote),
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
        listed = self.observe()
        check(listed["resources"][0]["active"] and not listed["resources"][0]["pending_restart"],
              "saved connection was not loaded after Runner restart")
        session = self.tool("work_on_project", {"project": self.project,
            "instruction": "Verify the disposable SSH execution target",
            "execution_context": {"resource": "password-fixture", "default_cwd": str(self.ssh.remote)}}, self.owner)
        output = self.tool("run_shell", {"project": session.get("project_ref", self.project),
            "session_id": session.get("session_ref", session.get("session_id")),
            "command": "printf 'SSH_PASSWORD_ROUTE_OK\\n' > remote-proof.txt; cat remote-proof.txt",
            "timeout_secs": 15}, self.owner)
        check((self.ssh.remote / "remote-proof.txt").read_text() == "SSH_PASSWORD_ROUTE_OK\n",
              "MCP shell did not execute in the SSH target")
        check(not (self.project_dir / "remote-proof.txt").exists(), "MCP shell fell back to local execution")
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
    if os.name != "posix" or not shutil.which("ssh") or not shutil.which("ssh-keyscan"):
        raise SystemExit("This acceptance requires a Unix host with OpenSSH ssh and ssh-keyscan")
    for binary in ["webcodex-server", "webcodex-runner"]:
        check((args.bin_dir / binary).is_file(), f"Build {binary} with the dogfood profile first")
    logging.getLogger("paramiko").addHandler(logging.NullHandler())
    logging.getLogger("paramiko").propagate = False
    with tempfile.TemporaryDirectory(prefix="webcodex-ssh-acceptance-") as temporary:
        acceptance = ConnectionAcceptance(args.bin_dir.resolve(), Path(temporary).resolve())
        try:
            acceptance.run()
        finally:
            acceptance.close()


if __name__ == "__main__":
    main()
