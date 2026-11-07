from __future__ import annotations

import os
import json
from pathlib import Path
import shutil
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest import mock

from scripts.e2e_ssh_connections import ConnectionAcceptance, HostTools, SshFixture, acl_failure_details, channel_input, git_posix_tools, secure_fixture_path


class Channel:
    def __init__(self, chunks: list[bytes]):
        self.chunks = list(chunks)
        self.stdout = bytearray()
        self.stderr = bytearray()
        self.status = None
        self.closed = False
        self.reads = 0

    def settimeout(self, seconds):
        assert seconds > 0

    def recv(self, size):
        self.reads += 1
        if not self.chunks:
            return b""
        value = self.chunks.pop(0)
        if len(value) > size:
            self.chunks.insert(0, value[size:])
        return value[:size]

    def sendall(self, data):
        self.stdout.extend(data)

    def sendall_stderr(self, data):
        self.stderr.extend(data)

    def send_exit_status(self, status):
        self.status = status

    def close(self):
        self.closed = True


class SshFixtureInputTests(unittest.TestCase):
    def test_fixture_native_state_never_uses_the_invoking_users_appdata(self):
        with tempfile.TemporaryDirectory(prefix="webcodex-ssh-state-") as directory:
            root = Path(directory)
            fixture = SimpleNamespace(remote_cwd="/remote", port=1, user="fixture", password="fixture")
            tools = HostTools(Path("unused"), "fixture-path", {})
            ambient = {"APPDATA": root / "foreign-roaming", "LOCALAPPDATA": root / "foreign-local"}
            for path in ambient.values():
                path.mkdir()
            with mock.patch.dict(os.environ, {name: str(path) for name, path in ambient.items()}), \
                    mock.patch("scripts.e2e_ssh_connections.SshFixture", return_value=fixture):
                acceptance = ConnectionAcceptance(root, root, tools)
            for variable, name in [("APPDATA", "roaming"), ("LOCALAPPDATA", "local")]:
                self.assertEqual(acceptance.env[variable], str(root / name))
                self.assertTrue((root / name).is_dir())
            # Exercise both DirectorySecurity and FileSecurity before expensive
            # native builds, with only a newly created fixture-owned file.
            private_file = root / "local" / "private-fixture"
            private_file.write_bytes(b"owned fixture payload")
            secure_fixture_path(private_file)
            self.assertEqual(private_file.read_bytes(), b"owned fixture payload")

    def test_acl_failure_reports_only_bounded_stage_and_os_error_metadata(self):
        secret = "fixture-credential-and-private-path"
        result = SimpleNamespace(returncode=1, stderr=secret.encode(), stdout=json.dumps({
            "stage": "persist", "exception_type": "System.UnauthorizedAccessException",
            "hresult": -2147024891, "native_code": 5, "message": secret, "path": secret,
        }).encode())
        details = acl_failure_details(result)
        self.assertNotIn(secret, details)
        self.assertEqual(json.loads(details), {
            "stage": "persist", "exit_code": 1,
            "exception_type": "System.UnauthorizedAccessException", "hresult": -2147024891, "native_code": 5,
        })
        for payload in [secret.encode(), b"x" * 4097, json.dumps({"stage": [secret]}).encode(), json.dumps({
            "stage": secret, "exception_type": secret, "hresult": secret, "native_code": 2**40,
        }).encode()]:
            result.stdout = payload
            self.assertEqual(json.loads(acl_failure_details(result)), {"stage": "powershell_start", "exit_code": 1})

    def test_git_remote_shell_is_resolved_from_powershell_and_git_bash_layouts(self):
        with tempfile.TemporaryDirectory(prefix="webcodex-ssh-tools-") as directory:
            root = Path(directory)
            shell = root / "usr/bin/sh.exe"
            shell.parent.mkdir(parents=True)
            shell.touch()
            cygpath = shell.with_name("cygpath.exe")
            cygpath.touch()
            for relative in ["cmd/git.exe", "mingw64/bin/git.exe"]:
                git = root / relative
                git.parent.mkdir(parents=True, exist_ok=True)
                git.touch()
                self.assertEqual(git_posix_tools(git), (shell.resolve(), cygpath.resolve()))
            cygpath.unlink()
            with self.assertRaises(AssertionError):
                git_posix_tools(root / "cmd/git.exe")

    def test_channel_input_preserves_exact_bytes_and_eof(self):
        channel = Channel([b"first\x00", b"\nsecond\n"])
        self.assertEqual(channel_input(channel, time.monotonic() + 5), b"first\x00\nsecond\n")
        self.assertEqual(channel.reads, 3)
        self.assertEqual(channel_input(Channel([]), time.monotonic() + 5), b"")

    def test_channel_input_rejects_oversize_and_expired_without_unbounded_read(self):
        channel = Channel([b"12345"])
        with self.assertRaises(ValueError):
            channel_input(channel, time.monotonic() + 5, limit=4)
        self.assertEqual(channel.reads, 1)
        channel = Channel([b"not consumed"])
        with self.assertRaises(TimeoutError):
            channel_input(channel, time.monotonic() - 1)
        self.assertEqual(channel.reads, 0)

    def test_fixture_forwards_stdin_and_eof_to_the_real_remote_shell(self):
        if os.name == "nt":
            git = shutil.which("git.exe")
            self.assertIsNotNone(git, "Git for Windows is required for this fixture")
            shell, _ = git_posix_tools(Path(git))
            env = {"PATH": str(shell.parent), "SystemRoot": os.environ["SystemRoot"]}
        else:
            shell = Path(shutil.which("sh"))
            env = {"PATH": os.defpath}
        self.assertTrue(shell.is_file())
        with tempfile.TemporaryDirectory(prefix="webcodex-ssh-pipe-") as directory:
            fixture = object.__new__(SshFixture)
            fixture.remote = Path(directory)
            fixture.tools = HostTools(shell, "", env)
            fixture.executions = fixture.framed_executions = 0
            # The actual shell must consume bytes through EOF. The old fixture's
            # DEVNULL input fails this assertion even though authentication works.
            channel = Channel([b"exact stdin\x00", b"with newline\n"])
            fixture.execute(channel, b"cat")
            self.assertEqual(channel.status, 0)
            self.assertEqual(channel.stdout, b"exact stdin\x00with newline\n")
            self.assertTrue(channel.closed)
            self.assertEqual(fixture.executions, 1)

    def test_oversize_stdin_never_starts_a_fixture_command(self):
        fixture = object.__new__(SshFixture)
        fixture.executions = fixture.framed_executions = 0
        channel = Channel([b"x" * (2 * 1024 * 1024 + 1)])
        with mock.patch("scripts.e2e_ssh_connections.subprocess.run") as run:
            fixture.execute(channel, b"echo must-not-run")
        run.assert_not_called()
        self.assertEqual(channel.status, 125)
        self.assertTrue(channel.closed)


if __name__ == "__main__":
    unittest.main()
