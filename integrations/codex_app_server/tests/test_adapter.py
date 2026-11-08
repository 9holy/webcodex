"""Real ACP -> adapter -> stdio app-server process tests, without a model."""
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import time
import unittest


ROOT = Path(__file__).resolve().parents[1]
ADAPTER = ROOT / "adapter.py"
FIXTURE = ROOT / "tests" / "fake_codex.py"


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="webcodex-codex-provider-")
        self.root = Path(self.temp.name).resolve()
        self.receipt = self.root / "receipt.json"
        self.trace = self.root / "trace.jsonl"
        self.process = None
        self.environment = dict(os.environ, FAKE_CODEX_TRACE=str(self.trace))
        for name in ("FAKE_CODEX_VERSION", "FAKE_CODEX_SCHEMA", "FAKE_CODEX_SCENARIO"):
            self.environment.pop(name, None)
        result = self.prepare()
        self.assertEqual(result.returncode, 0, result.stdout)
        self.profile = json.loads(result.stdout)["profile"]

    def tearDown(self):
        if self.process:
            if not self.process.stdin.closed:
                with self.subTest("stdin close"):
                    try:
                        self.process.stdin.close()
                    except BrokenPipeError:
                        pass
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=2)
                self.fail("adapter did not terminate after EOF")
            stderr = self.process.stderr.read().decode("utf-8", errors="replace")
            self.process.stderr.close()
            self.process.stdout.close()
            self.assertNotIn("private-test-secret", stderr)
            self.assertNotIn("Traceback", stderr, stderr)
        self.temp.cleanup()

    def prepare(self, *extra, environment=None, entry=ADAPTER):
        return subprocess.run([sys.executable, str(entry), "prepare", "--experimental",
            "--codex-bin", sys.executable, "--codex-arg", str(FIXTURE),
            "--receipt", str(self.receipt), *extra], env=environment or self.environment,
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)

    def start(self, scenario="complete", *extra, handshake=True, environment=None, entry=ADAPTER, runner_cwd=None, profile=None):
        env = dict(environment or self.environment, FAKE_CODEX_SCENARIO=scenario)
        command = ([profile["executable"], *profile["args"], *extra] if profile is not None else
                   [sys.executable, str(entry), "serve", "--experimental", "--receipt", str(self.receipt), *extra])
        self.process = subprocess.Popen(command, cwd=runner_cwd or self.root, env=env,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.messages = queue.Queue()
        def read():
            try:
                for line in self.process.stdout:
                    self.messages.put(json.loads(line))
            except (ValueError, OSError) as exc:
                self.messages.put(exc)
            self.messages.put(None)
        threading.Thread(target=read, daemon=True).start()
        self.send(1, "initialize", {"protocolVersion": 1, "clientCapabilities": {}})
        initialized = self.get()
        if not handshake:
            return initialized
        self.assertEqual(initialized.get("result", {}).get("protocolVersion"), 1, initialized)
        self.send(2, "session/new", {"cwd": str(self.root), "mcpServers": []})
        frame = self.get()
        self.session = frame.get("result", {}).get("sessionId")
        return frame

    def send(self, rid, method, params):
        frame = {"jsonrpc": "2.0", "method": method, "params": params}
        if rid is not None:
            frame["id"] = rid
        self.write(frame)

    def write(self, frame):
        self.process.stdin.write(json.dumps(frame).encode("utf-8") + b"\n")
        self.process.stdin.flush()

    def get(self, timeout=4):
        value = self.messages.get(timeout=timeout)
        self.assertIsInstance(value, dict, value)
        self.assertNotIn("private-test-secret", json.dumps(value))
        return value

    def prompt(self, rid=3):
        self.send(rid, "session/prompt", {"sessionId": self.session,
            "prompt": [{"type": "text", "text": "检查并修改项目 🌎"}]})

    def terminal(self):
        frames = []
        while True:
            value = self.get()
            if value.get("id") == 3 and "method" not in value:
                return value, frames
            frames.append(value)

    def approval(self):
        while True:
            frame = self.get()
            if frame.get("method") == "session/request_permission":
                return frame
            self.assertNotIn("error", frame)

    def answer(self, request, selected="allow"):
        outcome = {"outcome": "cancelled"} if selected is None else {"outcome": "selected", "optionId": selected}
        self.write({"jsonrpc": "2.0", "id": request["id"], "result": {"outcome": outcome}})

    def log(self):
        return [json.loads(line) for line in self.trace.read_text().splitlines()] if self.trace.exists() else []

    def wait_log(self, method):
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            matching = [frame for frame in self.log() if frame.get("method") == method]
            if matching:
                return matching
            time.sleep(.01)
        self.fail("missing native request: " + method)

    def test_actual_subprocess_lifecycle_effect_and_streamed_text(self):
        self.start()
        self.prompt()
        terminal, events = self.terminal()
        self.assertEqual(terminal["result"], {"stopReason": "end_turn"})
        self.assertEqual((self.root / "native-result.txt").read_bytes(), b"actual fixture execution\n")
        updates = [frame["params"]["update"] for frame in events]
        self.assertEqual([update["kind"] for update in updates if update["sessionUpdate"].startswith("tool_call")], ["execute", "execute"])
        self.assertEqual("".join(update["content"]["text"] for update in updates if "content" in update), "完成 🌎")
        request = self.wait_log("turn/start")[0]["params"]
        self.assertEqual(request["sandboxPolicy"], {"type": "workspaceWrite", "writableRoots": [str(self.root)],
            "networkAccess": False, "excludeTmpdirEnvVar": True, "excludeSlashTmp": True})
        self.assertEqual(len(self.wait_log("thread/start")), 1)
        self.assertEqual(len(self.wait_log("turn/start")), 1)

    def test_prepared_profile_is_disabled_and_contains_no_credentials(self):
        self.assertFalse(self.profile["enabled"])
        self.assertEqual(self.profile["allowed_config_options"], [])
        self.assertTrue(Path(self.profile["executable"]).is_absolute())
        self.assertEqual(self.profile["args"][1:3], ["serve", "--experimental"])
        self.assertNotIn("--network", self.profile["args"])
        self.assertTrue(all(key == value for key, value in self.profile["env_from_env"].items()))

    def test_prepared_network_profile_keeps_workspace_and_explicit_approval(self):
        prepared = self.prepare("--network")
        self.assertEqual(prepared.returncode, 0, prepared.stdout)
        profile = json.loads(prepared.stdout)["profile"]
        self.assertEqual(profile, dict(self.profile, args=[*self.profile["args"], "--network"]))
        self.assertFalse(profile["enabled"])
        self.assertNotIn("GH_TOKEN", profile["env_from_env"])
        self.assertNotIn("SSH_AUTH_SOCK", profile["env_from_env"])
        self.start("approval", profile=profile)
        self.prompt()
        permission = self.approval()
        self.assertFalse((self.root / "approved-command.txt").exists())
        thread = self.wait_log("thread/start")[0]["params"]
        turn = self.wait_log("turn/start")[0]["params"]
        for request in (thread, turn):
            self.assertEqual(request["approvalPolicy"], "on-request")
            self.assertEqual(request["approvalsReviewer"], "user")
            self.assertEqual(request["cwd"], str(self.root))
        self.assertEqual(thread["sandbox"], "workspace-write")
        self.assertEqual(thread["config"], {
            "sandbox_workspace_write.writable_roots": [str(self.root)],
            "sandbox_workspace_write.network_access": True,
            "sandbox_workspace_write.exclude_tmpdir_env_var": True,
            "sandbox_workspace_write.exclude_slash_tmp": True,
        })
        self.assertEqual(turn["sandboxPolicy"], {"type": "workspaceWrite", "writableRoots": [str(self.root)],
            "networkAccess": True, "excludeTmpdirEnvVar": True, "excludeSlashTmp": True})
        self.assertEqual([option["kind"] for option in permission["params"]["options"]], ["allow_once", "reject_once"])
        self.answer(permission, "reject")
        self.assertEqual(self.terminal()[0]["result"]["stopReason"], "end_turn")
        self.assertFalse((self.root / "approved-command.txt").exists())

    def test_project_alias_uses_the_runner_owned_directory_before_native_start(self):
        native_root = self.root.resolve()
        if os.name == "nt":
            self.root = Path("\\\\?\\" + str(native_root))
        else:
            (native_root / "nested").mkdir()
            self.root = native_root / "nested" / ".."
        self.start(runner_cwd=native_root)
        self.prompt()
        self.assertEqual(self.terminal()[0]["result"]["stopReason"], "end_turn")
        self.assertEqual(self.wait_log("thread/start")[0]["params"]["cwd"], str(native_root))
        self.assertEqual(self.wait_log("turn/start")[0]["params"]["cwd"], str(native_root))
        self.assertTrue((native_root / "native-result.txt").is_file())

    def test_session_cannot_select_another_existing_directory(self):
        other = self.root / "unadmitted"
        other.mkdir()
        self.start(handshake=False)
        self.send(2, "session/new", {"cwd": str(other), "mcpServers": []})
        self.assertEqual(self.get()["error"]["data"]["kind"], "invalid_session")
        self.assertFalse(any(frame.get("method") == "thread/start" for frame in self.log()))

    def test_native_command_approval_never_executes_before_selection(self):
        self.start("approval")
        self.prompt()
        request = self.approval()
        self.assertFalse((self.root / "approved-command.txt").exists())
        details = json.loads(request["params"]["toolCall"]["content"][0]["content"]["text"])
        self.assertEqual(details["cwd"], str(self.root))
        self.assertEqual(details["command"], "python3 -c 'print(42)'")
        self.assertEqual([option["kind"] for option in request["params"]["options"]], ["allow_once", "reject_once"])
        self.answer(request)
        self.assertEqual(self.terminal()[0]["result"]["stopReason"], "end_turn")
        self.assertTrue((self.root / "approved-command.txt").exists())
        native_reply = [frame for frame in self.log() if frame.get("id") == 71 and "result" in frame]
        self.assertEqual([frame["result"] for frame in native_reply], [{"decision": "accept"}])

    def test_denial_has_no_effect(self):
        self.start("approval")
        self.prompt()
        self.answer(self.approval(), "reject")
        self.assertEqual(self.terminal()[0]["result"]["stopReason"], "end_turn")
        self.assertFalse((self.root / "approved-command.txt").exists())

    def test_cancelled_permission_stops_original_turn(self):
        self.start("approval")
        self.prompt()
        self.answer(self.approval(), None)
        self.assertEqual(self.terminal()[0]["result"]["stopReason"], "cancelled")
        self.assertFalse((self.root / "approved-command.txt").exists())

    def test_replayed_selection_cannot_approve_next_request(self):
        self.start("two_approvals")
        self.prompt()
        first = self.approval()
        self.answer(first)
        second = self.approval()
        self.assertNotEqual(first["id"], second["id"])
        self.answer(first)
        self.assertFalse((self.root / "approved-command-2.txt").exists())
        self.answer(second, "reject")
        self.terminal()
        self.assertFalse((self.root / "approved-command-2.txt").exists())
        native = [frame for frame in self.log() if frame.get("id") == 72 and "result" in frame]
        self.assertEqual([frame["result"] for frame in native], [{"decision": "decline"}])

    def test_file_approval_includes_complete_diff(self):
        self.start("file_approval")
        self.prompt()
        request = self.approval()
        details = json.loads(request["params"]["toolCall"]["content"][0]["content"]["text"])
        self.assertEqual(details["changes"][0]["diff"], "+approved\n")
        self.assertEqual(details["changes"][0]["path"], str(self.root / "approved-file.txt"))
        self.answer(request)
        self.terminal()
        self.assertTrue((self.root / "approved-file.txt").exists())

    def test_permissions_grant_is_exact_and_turn_scoped(self):
        self.start("permission_grant")
        self.prompt()
        request = self.approval()
        self.assertIn("for this turn", request["params"]["options"][0]["name"])
        self.answer(request)
        self.terminal()
        native = [frame for frame in self.log() if frame.get("id") == 71 and "result" in frame][0]
        self.assertEqual(native["result"]["scope"], "turn")
        self.assertEqual(native["result"]["permissions"], {
            "fileSystem": {"read": [str(self.root / "shared")]}, "network": {"enabled": True}})

    def test_unknown_selection_does_not_grant(self):
        self.start("approval")
        self.prompt()
        self.answer(self.approval(), "acceptForSession")
        terminal, _ = self.terminal()
        self.assertEqual(terminal["error"]["data"]["kind"], "acp_permission_response_invalid")
        self.assertFalse((self.root / "approved-command.txt").exists())

    def test_only_advertised_once_decisions_are_exposed(self):
        self.start("no_once_decision")
        self.prompt()
        request = self.approval()
        self.assertEqual([option["optionId"] for option in request["params"]["options"]], ["reject"])
        self.answer(request, "reject")
        self.assertEqual(self.terminal()[0]["result"]["stopReason"], "cancelled")

    def test_original_string_native_request_id_is_preserved(self):
        self.start("string_request_id")
        self.prompt()
        self.answer(self.approval())
        self.terminal()
        self.assertTrue(any(frame.get("id") == "native-71" and frame.get("result") == {"decision": "accept"} for frame in self.log()))

    def test_permission_timeout_never_approves(self):
        self.start("approval", "--permission-timeout", ".1")
        self.prompt()
        self.approval()
        terminal, _ = self.terminal()
        self.assertEqual(terminal["error"]["data"]["kind"], "codex_permission_timeout")
        self.assertFalse((self.root / "approved-command.txt").exists())

    def test_cancel_waits_for_confirmed_original_turn(self):
        self.start("hanging")
        self.prompt()
        self.wait_log("turn/start")
        self.send(None, "session/cancel", {"sessionId": self.session})
        self.assertEqual(self.terminal()[0]["result"]["stopReason"], "cancelled")
        self.assertEqual(self.wait_log("turn/interrupt")[0]["params"], {"threadId": "thread-fixture", "turnId": "turn-fixture"})
        self.assertEqual(len(self.wait_log("turn/start")), 1)

    def test_interrupt_acceptance_alone_is_not_cancelled(self):
        self.start("cancel_unconfirmed", "--cancel-timeout", ".1")
        self.prompt()
        self.wait_log("turn/start")
        self.send(None, "session/cancel", {"sessionId": self.session})
        self.assertEqual(self.terminal()[0]["error"]["data"]["kind"], "codex_cancel_unconfirmed")

    def test_no_rerun_after_ambiguous_native_exit(self):
        self.start("eof")
        self.prompt()
        terminal, events = self.terminal()
        self.assertEqual(terminal["error"]["data"]["kind"], "codex_output_closed")
        self.assertEqual(len(self.wait_log("turn/start")), 1)
        self.assertTrue(events)

    def test_rpc_rejection_is_correlated_and_sanitized(self):
        self.start("rpc_error")
        self.prompt()
        terminal, _ = self.terminal()
        self.assertEqual(terminal["id"], 3)
        self.assertEqual(terminal["error"]["data"]["kind"], "codex_request_rejected")

    def test_effective_sandbox_cannot_silently_widen(self):
        frame = self.start("wrong_policy")
        self.assertEqual(frame["id"], 2)
        self.assertEqual(frame["error"]["data"]["kind"], "codex_effective_policy_mismatch")
        self.assertFalse(any(frame.get("method") == "turn/start" for frame in self.log()))

    def test_extra_writable_root_is_rejected(self):
        frame = self.start("extra_root")
        self.assertEqual(frame["error"]["data"]["kind"], "codex_effective_policy_mismatch")

    def test_read_only_turn_can_explicitly_enable_network(self):
        self.start("hanging", "--sandbox", "read-only", "--network")
        self.prompt()
        request = self.wait_log("turn/start")[0]["params"]
        self.assertEqual(request["sandboxPolicy"], {"type": "readOnly", "networkAccess": True})
        self.send(None, "session/cancel", {"sessionId": self.session})
        self.assertEqual(self.terminal()[0]["result"]["stopReason"], "cancelled")

    def test_wrong_turn_is_not_user_output(self):
        self.start("wrong_turn")
        self.prompt()
        terminal, events = self.terminal()
        self.assertEqual(terminal["error"]["data"]["kind"], "codex_turn_identity_mismatch")
        self.assertEqual(events, [])

    def test_wrong_thread_cannot_ask_for_permission(self):
        self.start("wrong_thread")
        self.prompt()
        terminal, events = self.terminal()
        self.assertEqual(terminal["error"]["data"]["kind"], "codex_thread_identity_mismatch")
        self.assertFalse(any(frame.get("method") == "session/request_permission" for frame in events))

    def test_oversize_details_do_not_offer_blind_approval(self):
        self.start("approval_details_limit")
        self.prompt()
        terminal, events = self.terminal()
        self.assertEqual(terminal["error"]["data"]["kind"], "codex_approval_details_limit")
        self.assertFalse(any(frame.get("method") == "session/request_permission" for frame in events))

    def test_unsupported_interactive_request_fails_explicitly(self):
        self.start("unknown_request")
        self.prompt()
        terminal, _ = self.terminal()
        self.assertEqual(terminal["error"]["data"]["kind"], "codex_interactive_request_unsupported")
        # The ACP error can arrive before the native child records its reply.
        # Shutdown waits for that child; inspect its trace only after it exits.
        self.process.wait(timeout=5)
        self.assertTrue(any(frame.get("id") == 99 and frame.get("error", {}).get("code") == -32601 for frame in self.log()))

    def test_changed_version_requires_new_preparation(self):
        env = dict(self.environment, FAKE_CODEX_VERSION="0.168.0-fixture.1")
        frame = self.start(handshake=False, environment=env)
        self.assertEqual(frame["id"], 1)
        self.assertEqual(frame["error"]["data"]["kind"], "codex_version_mismatch")
        self.assertEqual(self.log(), [])

    def test_operator_can_prepare_another_compatible_exact_version(self):
        env = dict(self.environment, FAKE_CODEX_VERSION="0.168.0-fixture.1")
        result = self.prepare("--expected-version", "0.168.0-fixture.1", environment=env)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertEqual(json.loads(result.stdout)["codex_version"], "0.168.0-fixture.1")
        self.start(environment=env)
        self.prompt()
        self.assertEqual(self.terminal()[0]["result"]["stopReason"], "end_turn")

    def test_incompatible_schema_does_not_replace_existing_receipt(self):
        previous = self.receipt.read_bytes()
        for schema in ("incompatible", "missing_notification_identity", "read_only_required_field"):
            with self.subTest(schema=schema):
                result = self.prepare(environment=dict(self.environment, FAKE_CODEX_SCHEMA=schema))
                self.assertEqual(result.returncode, 1)
                self.assertEqual(json.loads(result.stdout)["kind"], "codex_schema_incompatible")
                self.assertEqual(self.receipt.read_bytes(), previous)

    def test_expected_version_mismatch_fails_before_app_server(self):
        result = self.prepare("--expected-version", "999")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)["kind"], "codex_version_mismatch")
        self.assertEqual(self.log(), [])

    def test_explicit_experimental_flag_is_required(self):
        result = subprocess.run([sys.executable, str(ADAPTER), "serve", "--receipt", str(self.receipt)],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=3)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.log(), [])

    def test_run_deadline_is_not_success(self):
        self.start("hanging", "--timeout", ".1")
        self.prompt()
        self.assertEqual(self.terminal()[0]["error"]["data"]["kind"], "codex_deadline_exceeded")

    def test_output_limit_is_failure(self):
        self.start("complete", "--max-output-bytes", "1")
        self.prompt()
        self.assertEqual(self.terminal()[0]["error"]["data"]["kind"], "codex_output_limit")


if __name__ == "__main__":
    unittest.main()
