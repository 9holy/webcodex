from __future__ import annotations

import os
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest import mock

from scripts.e2e_ssh_connections import (
    ConnectionAcceptance, FIXTURE_COUNTERS, HostTools, OperatorCallFailed,
    LITERAL_DOLLAR_ENV, NONEXECUTABLE_DECOY, PIN_PROBE_OUTPUT,
    PROBE_DIAGNOSTIC_COUNTERS, PROBE_DIAGNOSTIC_STAGES, SshFixture,
    acl_failure_details, channel_input, encrypted_key_control_copy, git_posix_tools,
    literal_ssh_option_path, native_ssh_version, observed_probe_diagnostic,
    prepare_windows_runner, secure_fixture_path, special_key_path, user_known_hosts_command,
)


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
    def empty_fixture(self):
        fixture = object.__new__(SshFixture)
        for name in FIXTURE_COUNTERS:
            setattr(fixture, name, 0)
        return fixture

    def diagnostic_line(self, stage="prompt", count=1):
        return (f"webcodex_ssh_probe: askpass_stage={stage}" + "".join(
            f" {name}={count}" for name in PROBE_DIAGNOSTIC_COUNTERS)).encode()

    def empty_acceptance(self):
        acceptance = object.__new__(ConnectionAcceptance)
        acceptance.logs = []
        acceptance.ssh = self.empty_fixture()
        acceptance.ssh.password = "private-password-canary"
        acceptance.ssh.passphrase = "private-passphrase-canary"
        acceptance.ssh.ascii_encrypted_key_path = Path("ascii-fixture-key")
        acceptance.primary_probe_diagnostic = None
        acceptance.ascii_key_control = None
        acceptance.begin_stage("encrypted_key_probe")
        return acceptance

    def pin_acceptance(self):
        acceptance = self.empty_acceptance()
        temporary = tempfile.TemporaryDirectory(prefix="wc-native-pin-")
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name) / "中文 pin %q ${NAME}"
        root.mkdir()
        acceptance.ssh.key_path = Path("plain-ascii-fixture-key")
        acceptance.ssh.correct_hosts_path = root / "selected"
        acceptance.ssh.wrong_hosts_path = root / "different-key-source"
        acceptance.ssh.correct_hosts_path.write_bytes(b"known fixture right public key")
        acceptance.ssh.wrong_hosts_path.write_bytes(b"known fixture wrong public key")
        acceptance.ssh.tools = HostTools(Path("unused"), "fixture-path", {})
        acceptance.endpoint = {"host": "127.0.0.1", "port": 22122, "user": "fixture-user"}
        acceptance.env = {LITERAL_DOLLAR_ENV: "inherited-poison",
                          "SSH_ASKPASS": "private-helper-canary",
                          "WEBCODEX_SSH_ASKPASS_REQUEST": "private-request-canary",
                          "SSH_AUTH_SOCK": "private-agent-canary"}
        return acceptance

    def test_special_key_path_guarantees_partial_utf8_and_literal_special_characters(self):
        for length in [1, 15, 31, 60, 90]:
            with self.subTest(root_length=length):
                path = special_key_path(Path("r" * length))
                encoded = str(path).encode("utf-8")
                self.assertGreater(len(encoded), 100)
                with self.assertRaises(UnicodeDecodeError):
                    encoded[:100].decode("utf-8")
                self.assertIn(" key %q ${WEBCODEX_FIXTURE_UNSET}", str(path))
                self.assertEqual(path.name, "client-key")
        with self.assertRaisesRegex(AssertionError, "100-byte key boundary"):
            special_key_path(Path("r" * 120))

    def test_native_user_known_hosts_arguments_isolate_the_user_pin_and_literal_paths(self):
        hosts = Path(r"C:\private path\中文 %q ${NAME}\known-hosts")
        encoded = literal_ssh_option_path(hosts)
        self.assertTrue(encoded.startswith('"') and encoded.endswith('"'))
        self.assertIn("%%q", encoded)
        self.assertIn("${WEBCODEX_SSH_LITERAL_DOLLAR}{NAME}", encoded)
        self.assertNotIn("${NAME}", encoded)
        self.assertIn("\\\\", encoded)
        endpoint = {"host": "127.0.0.1", "port": 22122, "user": "fixture-user"}
        command = user_known_hosts_command(Path("native-ssh"), endpoint, hosts, Path("plain-key"))
        options = [command[index + 1] for index, argument in enumerate(command) if argument == "-o"]
        self.assertEqual([option for option in options if option.startswith("GlobalKnownHostsFile=")],
                         ["GlobalKnownHostsFile=none"])
        self.assertEqual([option for option in options if option.startswith("UserKnownHostsFile=")],
                         ["UserKnownHostsFile=" + encoded])
        for option in ["StrictHostKeyChecking=yes", "IdentityAgent=none", "IdentitiesOnly=yes",
                       "BatchMode=yes", "PasswordAuthentication=no", "KbdInteractiveAuthentication=no"]:
            self.assertIn(option, options)
        self.assertEqual(command[:8], ["native-ssh", "-F", "none", "-n", "-T", "-p", "22122", "-l"])
        self.assertEqual(command[8], "fixture-user")
        self.assertEqual(command[-3:], ["--", "127.0.0.1", "printf 'WEBCODEX_USER_PIN_OK\\n'"])

    def test_native_runner_copy_preserves_exact_hash_and_rejects_tampered_copy_or_decoy(self):
        with tempfile.TemporaryDirectory(prefix="wc-runner-copy-") as directory:
            root = Path(directory).resolve()
            secure_fixture_path(root)
            source = root / "webcodex-runner.exe"
            payload = b"exact candidate fixture bytes" * 1024
            source.write_bytes(payload)
            fixture = prepare_windows_runner(source, root)
            self.assertEqual(fixture.executable.read_bytes(), payload)
            self.assertTrue(fixture.executable.name.isascii())
            self.assertNotEqual(fixture.executable.name, source.name)
            self.assertIn("安装", str(fixture.executable.parent))
            self.assertNotEqual(fixture.caller_cwd, fixture.executable.parent)
            self.assertEqual(fixture.decoy.name, fixture.executable.name)
            self.assertEqual(fixture.decoy.read_bytes(), NONEXECUTABLE_DECOY)
            for target, original in [(source, payload), (fixture.executable, payload),
                                     (fixture.decoy, NONEXECUTABLE_DECOY)]:
                target.write_bytes(b"tampered fixture bytes")
                with self.assertRaises(AssertionError):
                    fixture.verify()
                target.write_bytes(original)
                fixture.verify()

    def test_native_runner_launch_uses_verified_absolute_copy_and_different_cwd(self):
        with tempfile.TemporaryDirectory(prefix="wc-runner-launch-") as directory:
            root = Path(directory).resolve()
            secure_fixture_path(root)
            source = root / "webcodex-runner.exe"
            source.write_bytes(b"exact native fixture bytes")
            acceptance = self.empty_acceptance()
            acceptance.root = acceptance.bin_dir = root
            acceptance.native_runner = prepare_windows_runner(source, root)
            arguments = ["--config", str(root / "runner.toml")]
            try:
                with mock.patch("scripts.e2e_ssh_connections.os", SimpleNamespace(name="nt")), \
                        mock.patch("scripts.e2e_ssh_connections.subprocess.CREATE_NEW_PROCESS_GROUP", 512, create=True), \
                        mock.patch("scripts.e2e_ssh_connections.subprocess.Popen") as launch:
                    acceptance.launch("webcodex-runner", arguments, {})
                    call = launch.call_args
                    self.assertEqual(call.args[0], [str(acceptance.native_runner.executable), *arguments])
                    self.assertEqual(call.kwargs["cwd"], acceptance.native_runner.caller_cwd)
                    self.assertEqual(call.kwargs["stdin"], subprocess.DEVNULL)
                    acceptance.native_runner.executable.write_bytes(b"changed")
                    with self.assertRaisesRegex(AssertionError, "exact candidate"):
                        acceptance.launch("webcodex-runner", arguments, {})
                    self.assertEqual(launch.call_count, 1)
            finally:
                for log in acceptance.logs:
                    log.close()

    def test_wrong_actual_key_requires_an_offer_without_authentication_fallback_or_execution(self):
        probe = {"binding": {"revision": "fenced"}, "endpoint": {"host": "127.0.0.1"},
                 "host_key": {"challenge_id": "fenced", "fingerprint": "pinned"},
                 "authentication": {"type": "password", "password": "private"}}
        for rejected_case in [None, "no_offer", "accepted_key", "executed", "password_fallback"]:
            with self.subTest(rejected_case=rejected_case):
                acceptance = self.empty_acceptance()
                acceptance.ssh.wrong_key_path = Path("wrong-中文-%q-key")
                def operator(action, body, *, success=True):
                    self.assertEqual(action, "probe")
                    self.assertFalse(success)
                    self.assertEqual(body, probe | {"authentication": {
                        "type": "identity_file", "path": str(acceptance.ssh.wrong_key_path)}})
                    if rejected_case != "no_offer":
                        acceptance.ssh.publickey_requests += 1
                    if rejected_case == "accepted_key":
                        acceptance.ssh.accepted_key_offers += 1
                    if rejected_case == "executed":
                        acceptance.ssh.executions += 1
                    if rejected_case == "password_fallback":
                        acceptance.ssh.password_attempts += 1
                    return {"error_kind": "ssh_authentication_failed"}
                acceptance.operator = operator
                if rejected_case is None:
                    acceptance.reject_wrong_key(probe)
                else:
                    with self.assertRaises(AssertionError):
                        acceptance.reject_wrong_key(probe)

    def test_user_only_pin_checks_real_execution_and_rejects_authentication_after_wrong_pin(self):
        for invalid in [None, "success", "authentication", "no_execution", "wrong_output"]:
            with self.subTest(invalid=invalid):
                acceptance = self.pin_acceptance()
                calls = []
                def native_probe(arguments, **kwargs):
                    calls.append(arguments)
                    self.assertEqual(kwargs["env"][LITERAL_DOLLAR_ENV], "$")
                    self.assertFalse(any("private-" in value for value in kwargs["env"].values()))
                    self.assertEqual(kwargs["stdin"], subprocess.DEVNULL)
                    if len(calls) == 1:
                        self.assertEqual(acceptance.ssh.correct_hosts_path.read_bytes(),
                                         b"known fixture right public key")
                        acceptance.ssh.publickey_requests += 2
                        acceptance.ssh.accepted_key_offers += 2
                        if invalid != "no_execution":
                            acceptance.ssh.executions += 1
                        return SimpleNamespace(returncode=0,
                            stdout=b"incorrect" if invalid == "wrong_output" else PIN_PROBE_OUTPUT,
                            stderr=b"private-native-path-canary")
                    self.assertEqual(arguments, calls[0])
                    self.assertEqual(acceptance.ssh.correct_hosts_path.read_bytes(),
                                     b"known fixture wrong public key")
                    if invalid == "authentication":
                        acceptance.ssh.publickey_requests += 1
                    return SimpleNamespace(returncode=0 if invalid == "success" else 255,
                                           stdout=b"", stderr=b"private-native-path-canary")
                with mock.patch("scripts.e2e_ssh_connections.shutil.which", return_value="native-ssh"), \
                        mock.patch("scripts.e2e_ssh_connections.subprocess.run", side_effect=native_probe), \
                        mock.patch("builtins.print") as output:
                    if invalid is None:
                        acceptance.check_user_known_hosts_only()
                        self.assertEqual(len(calls), 2)
                    else:
                        with self.assertRaises(AssertionError):
                            acceptance.check_user_known_hosts_only()
                    self.assertNotIn("private-native-path-canary", str(output.call_args_list))

    def test_probe_diagnostic_projects_only_complete_closed_bounded_messages(self):
        canary = b"private-path-prompt-and-credential"
        for stage in PROBE_DIAGNOSTIC_STAGES:
            with self.subTest(stage=stage):
                line = self.diagnostic_line(stage, 16)
                diagnostic = observed_probe_diagnostic(b"2026-11-07T00:00:00Z \x1b[31mERROR\x1b[0m runner: " + line)
                self.assertEqual(diagnostic, {"askpass_stage": stage, **{
                    field: 16 for field in PROBE_DIAGNOSTIC_COUNTERS}})
        valid = self.diagnostic_line()
        for malicious in [
            canary,
            valid + b" password=" + canary,
            valid + b"\x00" + canary,
            valid.replace(b"stage=prompt", b"stage=" + canary),
            valid.replace(b"entries=1", b"entries=17"),
            valid.replace(b"entries=1", b"entries=-1"),
            valid.replace(b"entries=1", b"entries=01"),
            valid.replace(b" key_load_errors=1", b""),
            valid + b" x" * 1000,
        ]:
            with self.subTest(size=len(malicious)):
                self.assertIsNone(observed_probe_diagnostic(malicious))
        latest = observed_probe_diagnostic(valid + b"\n" + canary + b"\n" + self.diagnostic_line("complete", 0))
        self.assertEqual(latest["askpass_stage"], "complete")
        self.assertNotIn(canary.decode(), json.dumps(latest))
        self.assertIsNone(observed_probe_diagnostic(valid + b"\n" + b"x" * 65536))

    def test_probe_diagnostic_never_reuses_an_earlier_stage_log(self):
        acceptance = self.empty_acceptance()
        with tempfile.TemporaryDirectory(prefix="webcodex-probe-diagnostic-") as directory:
            path = Path(directory) / "webcodex-runner-1.log"
            path.write_bytes(self.diagnostic_line("complete") + b"\n")
            acceptance.logs = [SimpleNamespace(name=str(path))]
            acceptance.begin_stage("encrypted_key_probe")
            self.assertIsNone(acceptance.stage_diagnostic()["runner_probe_observed"])
            with path.open("ab") as log:
                log.write(b"PRIVATE PATH AND SECRET\n" + self.diagnostic_line("prompt") + b"\n")
            diagnostic = acceptance.stage_diagnostic()
            self.assertEqual(diagnostic["runner_probe_observed"]["askpass_stage"], "prompt")
            self.assertNotIn(str(path), json.dumps(diagnostic))
            self.assertNotIn("PRIVATE", json.dumps(diagnostic))

    def test_public_key_offer_counts_do_not_claim_private_key_authentication(self):
        fixture = self.empty_fixture()
        fixture.user = "fixture-user"
        fixture.client_key = object()
        self.assertFalse(fixture.record_key_offer("other-user", fixture.client_key))
        self.assertFalse(fixture.record_key_offer(fixture.user, object()))
        self.assertTrue(fixture.record_key_offer(fixture.user, fixture.client_key))
        counts = fixture.diagnostic_counts()
        self.assertEqual(counts["publickey_requests"], 3)
        self.assertEqual(counts["accepted_key_offers"], 1)
        self.assertEqual(counts["executions"], 0)
        self.assertEqual(counts["successful_passwords"], 0)

    def test_ascii_control_preserves_exact_encrypted_bytes_in_a_private_file(self):
        with tempfile.TemporaryDirectory(prefix="webcodex-key-control-") as directory:
            root = Path(directory).resolve()
            secure_fixture_path(root)
            source = root / "encrypted-长-key"
            payload = b"synthetic encrypted fixture bytes\x00\r\n"
            source.write_bytes(payload)
            secure_fixture_path(source)
            control = encrypted_key_control_copy(source, root)
            self.assertNotEqual(source, control)
            self.assertEqual(control.name, "encrypted-key-ascii")
            self.assertEqual(control.read_bytes(), payload)
            self.assertEqual(source.read_bytes(), payload)

    def test_successful_ascii_control_cannot_replace_the_original_unicode_failure(self):
        acceptance = self.empty_acceptance()
        primary = OperatorCallFailed("probe", True, {
            "output": {"error_kind": "ssh_authentication_failed"}})
        probe = {"binding": {"revision": "fenced"}, "endpoint": {"host": "127.0.0.1"},
                 "host_key": {"challenge_id": "fenced", "fingerprint": "pinned"},
                 "authentication": {"type": "identity_file", "path": "private-长-path",
                                    "passphrase": acceptance.ssh.passphrase}}
        calls = []

        def operator(action, body):
            calls.append((action, body))
            if len(calls) == 1:
                acceptance.ssh.publickey_requests += 1
                raise primary
            acceptance.ssh.publickey_requests += 2
            acceptance.ssh.accepted_key_offers += 2
            acceptance.ssh.executions += 1
            return {"action": "probe"}

        acceptance.operator = operator
        with self.assertRaises(OperatorCallFailed) as error:
            acceptance.probe_encrypted_key(probe)
        self.assertIs(error.exception, primary)
        self.assertEqual(len(calls), 2)
        self.assertEqual([action for action, _ in calls], ["probe", "probe"])
        self.assertEqual(calls[1][1], probe | {"authentication": {
            "type": "identity_file", "path": str(acceptance.ssh.ascii_encrypted_key_path),
            "passphrase": acceptance.ssh.passphrase,
        }})
        summary = acceptance.failure_diagnostic()
        self.assertEqual(summary["stage"], "encrypted_key_probe")
        self.assertEqual(summary["stage_delta"]["publickey_requests"], 1)
        self.assertEqual(summary["stage_delta"]["executions"], 0)
        self.assertEqual(summary["ascii_key_control"]["outcome"], "succeeded")
        self.assertEqual(summary["ascii_key_control"]["stage_delta"]["publickey_requests"], 2)
        self.assertEqual(summary["ascii_key_control"]["stage_delta"]["executions"], 1)
        for private in [acceptance.ssh.passphrase, acceptance.ssh.password,
                        "private-长-path", "ascii-fixture-key", "127.0.0.1", "pinned"]:
            self.assertNotIn(private, json.dumps(summary, ensure_ascii=False))

    def test_control_error_is_closed_and_primary_success_never_runs_a_control(self):
        canary = "private-secret-or-key-path"
        for control_error in [OperatorCallFailed("probe", True, {"output": {"error_kind": canary}}),
                              OSError(canary)]:
            acceptance = self.empty_acceptance()
            primary = OperatorCallFailed("probe", True, {"output": {"error_kind": "ssh_authentication_failed"}})
            acceptance.operator = mock.Mock(side_effect=[primary, control_error])
            with self.assertRaises(OperatorCallFailed) as error:
                acceptance.probe_encrypted_key({"authentication": {}})
            self.assertIs(error.exception, primary)
            self.assertEqual(acceptance.operator.call_count, 2)
            self.assertNotIn(canary, json.dumps(acceptance.failure_diagnostic()))
        acceptance = self.empty_acceptance()
        acceptance.operator = mock.Mock(return_value={"action": "probe"})
        self.assertEqual(acceptance.probe_encrypted_key({}), {"action": "probe"})
        acceptance.operator.assert_called_once_with("probe", {})
        self.assertIsNone(acceptance.ascii_key_control)

    def test_non_ascii_fixture_root_is_not_misreported_as_an_ascii_control(self):
        acceptance = self.empty_acceptance()
        acceptance.ssh.ascii_encrypted_key_path = Path("private-长-root") / "encrypted-key-ascii"
        primary = OperatorCallFailed("probe", True, {"output": {"error_kind": "ssh_authentication_failed"}})
        acceptance.operator = mock.Mock(side_effect=primary)
        with self.assertRaises(OperatorCallFailed) as error:
            acceptance.probe_encrypted_key({})
        self.assertIs(error.exception, primary)
        acceptance.operator.assert_called_once()
        self.assertEqual(acceptance.ascii_key_control, {"outcome": "not_available"})

    def test_operator_failure_does_not_echo_arbitrary_response_keys_or_codes(self):
        canary = "private-credential-and-path"
        error = OperatorCallFailed(canary, True, {canary: canary, "output": {"error_kind": canary}})
        self.assertEqual(error.error_kind, "unrecognized")
        self.assertNotIn(canary, str(error))

    def test_native_client_diagnostic_contains_only_a_bounded_version(self):
        secret = b"fixture-password-or-private-path"
        self.assertEqual(native_ssh_version(b"OpenSSH_for_Windows_9.5p1, LibreSSL 3.8.2\r\n" + secret),
                         "OpenSSH_for_Windows_9.5p1")
        for value in [secret, b"OpenSSH_9.5p1\r\n", b"OpenSSH_for_Windows_" + b"1" * 65]:
            with self.assertRaisesRegex(AssertionError, "native Microsoft OpenSSH"):
                native_ssh_version(value)

    def test_fixture_native_state_never_uses_the_invoking_users_appdata(self):
        with tempfile.TemporaryDirectory(prefix="webcodex-ssh-state-") as directory:
            root = Path(directory)
            fixture = SimpleNamespace(remote_cwd="/remote", port=1, user="fixture", password="fixture",
                                      diagnostic_counts=lambda: dict.fromkeys(FIXTURE_COUNTERS, 0))
            tools = HostTools(Path("unused"), "fixture-path", {})
            ambient = {"APPDATA": root / "foreign-roaming", "LOCALAPPDATA": root / "foreign-local"}
            for path in ambient.values():
                path.mkdir()
            with mock.patch.dict(os.environ, {name: str(path) for name, path in ambient.items()}), \
                    mock.patch("scripts.e2e_ssh_connections.SshFixture", return_value=fixture), \
                    mock.patch("scripts.e2e_ssh_connections.prepare_windows_runner", return_value=None):
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
            fixture = self.empty_fixture()
            fixture.remote = Path(directory)
            fixture.tools = HostTools(shell, "", env)
            # The actual shell must consume bytes through EOF. The old fixture's
            # DEVNULL input fails this assertion even though authentication works.
            channel = Channel([b"exact stdin\x00", b"with newline\n"])
            fixture.execute(channel, b"cat")
            self.assertEqual(channel.status, 0)
            self.assertEqual(channel.stdout, b"exact stdin\x00with newline\n")
            self.assertTrue(channel.closed)
            self.assertEqual(fixture.executions, 1)
            self.assertEqual(fixture.input_eofs, 1)
            self.assertEqual(fixture.commands_started, 1)
            self.assertEqual(fixture.commands_finished, 1)

    def test_withheld_stdin_eof_is_distinguished_from_failed_authentication(self):
        class WithoutEof(Channel):
            def recv(self, size):
                raise TimeoutError("private fixture detail must not be reported")

        fixture = self.empty_fixture()
        fixture.password_attempts = fixture.successful_passwords = 1
        fixture.password = fixture.passphrase = "synthetic-secret-must-stay-private"
        channel = WithoutEof([])
        with mock.patch("scripts.e2e_ssh_connections.subprocess.run") as run:
            fixture.execute(channel, b"echo WEBCODEX_SSH_CONNECTION_OK")
        run.assert_not_called()
        self.assertEqual(channel.status, 125)
        self.assertTrue(channel.closed)
        counts = fixture.diagnostic_counts()
        self.assertEqual(counts, {
            "password_attempts": 1, "successful_passwords": 1, "publickey_requests": 0,
            "accepted_key_offers": 0, "executions": 1, "input_eofs": 0,
            "commands_started": 0, "commands_finished": 0, "framed_executions": 0,
            "execution_failures": 1, "input_timeouts": 1,
        })
        self.assertNotIn(fixture.password, json.dumps(counts))

    def test_oversize_stdin_never_starts_a_fixture_command(self):
        fixture = self.empty_fixture()
        channel = Channel([b"x" * (2 * 1024 * 1024 + 1)])
        with mock.patch("scripts.e2e_ssh_connections.subprocess.run") as run:
            fixture.execute(channel, b"echo must-not-run")
        run.assert_not_called()
        self.assertEqual(channel.status, 125)
        self.assertTrue(channel.closed)
        self.assertEqual(fixture.commands_started, 0)
        self.assertEqual(fixture.execution_failures, 1)


if __name__ == "__main__":
    unittest.main()
