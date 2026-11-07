#!/usr/bin/env python3
"""Experimental, bounded ACP provider backed by the installed Codex app-server.

The Runner owns authorization, the project, the Run, and the entire process
tree. This process does not start a shell, inherit a different project, resume
stored conversations, retry a turn, select an approval, or detach children.
"""
import argparse
import asyncio
from collections import deque
from concurrent.futures import CancelledError
import contextlib
import json
import os
from pathlib import Path
import queue
import sys
import threading
import time
import uuid

from compatibility import (Failure, encoded, parse_json, prepare, verify_receipt)


MAX_FRAME = 1024 * 1024
MAX_PROMPT = 64 * 1024
MAX_APPROVAL_DETAILS = 60 * 1024  # Leaves room for Runner normalization labels.
MAX_NATIVE_BYTES = 32 * 1024 * 1024
MAX_EVENTS = 8192
MAX_ITEMS = 256
MAX_APPROVALS = 64
RPC_TIMEOUT = 20.0
WRITE_TIMEOUT = 2.0


def valid_id(value):
    return type(value) is int and 0 <= value < 2 ** 53 or (
        isinstance(value, str) and 0 < len(value.encode("utf-8")) <= 128
        and not any(ord(char) < 32 for char in value))


def text(value, limit=MAX_FRAME):
    if not isinstance(value, str) or len(value.encode("utf-8")) > limit or "\x00" in value:
        raise Failure("codex_protocol_invalid")
    return value


def same_directory(path, expected):
    # Windows verbatim paths, case aliases, and harmless dot segments can name
    # the same admitted directory. Compare its filesystem identity, not text.
    if not isinstance(path, str) or not os.path.isabs(path):
        return False
    try:
        return os.path.samefile(path, expected)
    except (OSError, ValueError):
        return False


class Output:
    """A bounded stdout writer; a stopped consumer cannot block cancellation.

    The daemon uses unbuffered os.write, so a broken/blocked pipe cannot hold a
    Python buffered-stdio lock during interpreter shutdown.
    """
    def __init__(self):
        self.loop = asyncio.get_running_loop()
        self.pending = queue.Queue(maxsize=1)
        self.failed = False
        threading.Thread(target=self.run, daemon=True, name="codex-acp-output").start()

    def run(self):
        while True:
            value = self.pending.get()
            if value is None:
                return
            raw, future = value
            error = None
            try:
                offset = 0
                while offset < len(raw):
                    count = os.write(sys.stdout.fileno(), raw[offset:])
                    if not count:
                        raise OSError("closed output")
                    offset += count
            except OSError:
                error = Failure("acp_output_closed")
                self.failed = True
            def resolve(future=future, error=error):
                if not future.done():
                    if error:
                        future.set_exception(error)
                    else:
                        future.set_result(None)
            with contextlib.suppress(RuntimeError):
                self.loop.call_soon_threadsafe(resolve)
            if error:
                return

    async def send(self, value):
        if self.failed:
            raise Failure("acp_output_closed")
        raw = encoded({"jsonrpc": "2.0", **value}) + b"\n"
        if len(raw) > MAX_FRAME:
            raise Failure("acp_output_limit")
        future = self.loop.create_future()
        try:
            self.pending.put_nowait((raw, future))
            await asyncio.wait_for(future, WRITE_TIMEOUT)
        except (queue.Full, asyncio.TimeoutError):
            self.failed = True
            raise Failure("acp_output_timeout") from None

    def close(self):
        with contextlib.suppress(queue.Full):
            self.pending.put_nowait(None)


class Adapter:
    def __init__(self, config):
        self.config = config
        self.output = Output()
        self.events = asyncio.Queue(maxsize=32)
        self.process = None
        self.reader_task = None
        self.receipt = None
        self.initialized = False
        self.session = None
        self.cwd = None
        self.thread_id = None
        self.turn_id = None
        self.used = False
        self.prompt_id = None
        self.handling_caller = None
        self.pending = {}
        self.next_rpc = 1
        self.next_permission = 1000000
        self.approval = None
        self.approval_queue = deque()
        self.native_requests = set()
        self.items = {}
        self.messages = {}
        self.output_bytes = 0
        self.native_bytes = 0
        self.event_count = 0
        self.deadline = time.monotonic() + RPC_TIMEOUT
        self.cancel_requested = False
        self.interrupt_sent = False
        self.cancel_deadline = None
        self.stopping = False
        self.acp_request_ids = set()

    async def result(self, rid, value):
        await self.output.send({"id": rid, "result": value})

    async def error(self, rid, kind, code=-32000):
        await self.output.send({"id": rid, "error": {
            "code": code, "message": kind, "data": {"kind": kind}}})

    async def update(self, value):
        if self.session and not self.cancel_requested:
            await self.output.send({"method": "session/update", "params": {
                "sessionId": self.session, "update": value}})

    async def message(self, content):
        content = text(content)
        self.output_bytes += len(content.encode("utf-8"))
        if self.output_bytes > self.config.max_output_bytes:
            raise Failure("codex_output_limit")
        for offset in range(0, len(content), 2048):
            await self.update({"sessionUpdate": "agent_message_chunk",
                               "content": {"type": "text", "text": content[offset:offset + 2048]}})

    async def native_send(self, value):
        raw = encoded(value) + b"\n"
        if len(raw) > MAX_FRAME or not self.process or self.process.returncode is not None:
            raise Failure("codex_transport_closed")
        try:
            self.process.stdin.write(raw)
            await asyncio.wait_for(self.process.stdin.drain(), WRITE_TIMEOUT)
        except (OSError, asyncio.TimeoutError):
            raise Failure("codex_write_failed") from None

    async def request(self, method, params, caller=None):
        rid = self.next_rpc
        self.next_rpc += 1
        self.pending[rid] = (method, caller, time.monotonic() + RPC_TIMEOUT)
        await self.native_send({"id": rid, "method": method, "params": params})

    async def native_reader(self):
        try:
            while True:
                raw = await self.process.stdout.readline()
                if not raw:
                    await self.events.put(("failure", "codex_output_closed"))
                    return
                if len(raw) > MAX_FRAME or not raw.endswith(b"\n"):
                    raise Failure("codex_frame_limit")
                self.native_bytes += len(raw)
                self.event_count += 1
                if self.native_bytes > MAX_NATIVE_BYTES or self.event_count > MAX_EVENTS:
                    raise Failure("codex_response_limit")
                await self.events.put(("native", parse_json(raw)))
        except (ValueError, UnicodeError, RecursionError):
            await self.events.put(("failure", "codex_protocol_invalid"))
        except (OSError, Failure) as exc:
            await self.events.put(("failure", exc.kind if isinstance(exc, Failure) else "codex_read_failed"))

    async def start_native(self):
        self.receipt = await verify_receipt(self.config.receipt)
        # Deliberately inherit the Runner-owned process group / Windows Job
        # Object. start_new_session, detached flags, and shell=True are forbidden.
        self.process = await asyncio.create_subprocess_exec(
            *self.receipt["command"], "app-server", "--listen", "stdio://",
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL, limit=MAX_FRAME + 1)
        self.reader_task = asyncio.create_task(self.native_reader())

    def sandbox(self):
        if self.config.sandbox == "read-only":
            return {"type": "readOnly", "networkAccess": self.config.network}
        return {"type": "workspaceWrite", "writableRoots": [self.cwd],
                "networkAccess": self.config.network,
                "excludeTmpdirEnvVar": True, "excludeSlashTmp": True}

    def validate_effective_thread(self, result):
        thread = result.get("thread")
        if not isinstance(thread, dict) or not valid_id(thread.get("id")) or not isinstance(thread["id"], str):
            raise Failure("codex_thread_invalid")
        if (result.get("approvalPolicy") != "on-request" or result.get("approvalsReviewer") != "user"
                or not same_directory(result.get("cwd"), self.cwd)):
            raise Failure("codex_effective_policy_mismatch")
        actual = result.get("sandbox")
        expected = self.sandbox()
        if not isinstance(actual, dict) or actual.get("type") != expected["type"]:
            raise Failure("codex_effective_policy_mismatch")
        network = actual.get("networkAccess", False)
        if type(network) is not bool or network and not self.config.network:
            raise Failure("codex_effective_policy_mismatch")
        if expected["type"] == "workspaceWrite":
            roots = actual.get("writableRoots", [])
            if (not isinstance(roots, list) or len(roots) > 16
                    or any(not same_directory(root, self.cwd) for root in roots)
                    or actual.get("excludeTmpdirEnvVar") is not True
                    or actual.get("excludeSlashTmp") is not True):
                raise Failure("codex_effective_policy_mismatch")
        self.thread_id = thread["id"]

    async def handle_acp(self, frame):
        if not isinstance(frame, dict) or frame.get("jsonrpc") != "2.0":
            raise Failure("acp_request_invalid")
        rid = frame.get("id")
        if "method" not in frame:
            await self.permission_response(frame)
            return
        method, params = frame["method"], frame.get("params", {})
        if not isinstance(method, str) or not isinstance(params, dict) or rid is not None and not valid_id(rid):
            raise Failure("acp_request_invalid")
        if method == "session/cancel":
            if self.session is not None and params.get("sessionId") == self.session and self.prompt_id is not None:
                self.cancel_requested = True
                self.cancel_deadline = time.monotonic() + self.config.cancel_timeout
                await self.cancel_approvals()
                await self.interrupt()
            return
        if rid is None:
            return
        if rid in self.acp_request_ids:
            await self.error(rid, "acp_request_replayed", -32600)
            return
        if len(self.acp_request_ids) >= 32:
            raise Failure("acp_request_limit")
        self.acp_request_ids.add(rid)
        if method == "initialize":
            if self.process or self.initialized or params.get("protocolVersion") != 1:
                await self.error(rid, "invalid_initialize", -32602)
                return
            try:
                await self.start_native()
            except (Failure, OSError, ValueError) as exc:
                await self.error(rid, exc.kind if isinstance(exc, Failure) else "codex_unavailable")
                self.stopping = True
                return
            await self.request("initialize", {"clientInfo": {"name": "webcodex_acp", "version": "1"},
                "capabilities": self.receipt["initialize_capabilities"]}, rid)
        elif method == "session/new":
            cwd = params.get("cwd")
            if (not self.initialized or self.session is not None or self.thread_id is not None
                    or any(entry[0] == "thread/start" for entry in self.pending.values())
                    or not isinstance(cwd, str) or not os.path.isabs(cwd)
                    or len(cwd.encode("utf-8")) > 4096 or not Path(cwd).is_dir()
                    or not same_directory(cwd, Path.cwd()) or params.get("mcpServers") != []):
                await self.error(rid, "invalid_session", -32602)
                return
            # Pass one native OS spelling after the Runner-owned working
            # directory has been checked; never forward a caller's path alias.
            cwd = str(Path.cwd())
            self.cwd = cwd
            values = {"cwd": cwd, "sandbox": self.config.sandbox, "approvalPolicy": "on-request",
                      "approvalsReviewer": "user", "ephemeral": True,
                      "config": {"sandbox_workspace_write.writable_roots": [cwd],
                                 "sandbox_workspace_write.network_access": self.config.network,
                                 "sandbox_workspace_write.exclude_tmpdir_env_var": True,
                                 "sandbox_workspace_write.exclude_slash_tmp": True}}
            if self.config.model:
                values["model"] = self.config.model
            await self.request("thread/start", values, rid)
        elif method == "session/prompt":
            if self.session is None or params.get("sessionId") != self.session:
                await self.error(rid, "invalid_session", -32602)
                return
            if self.used:
                await self.error(rid, "session_already_used", -32602)
                return
            blocks = params.get("prompt")
            if not isinstance(blocks, list) or not 1 <= len(blocks) <= 64:
                await self.error(rid, "invalid_prompt", -32602)
                return
            parts = []
            for block in blocks:
                if not isinstance(block, dict):
                    await self.error(rid, "invalid_prompt", -32602)
                    return
                if block.get("type") == "text" and isinstance(block.get("text"), str):
                    parts.append(block["text"])
                elif block.get("type") == "resource_link" and isinstance(block.get("uri"), str):
                    parts.append("Resource reference: " + block["uri"])
                else:
                    await self.error(rid, "unsupported_prompt_content", -32602)
                    return
            prompt = "\n\n".join(parts)
            if not prompt.strip() or len(prompt.encode("utf-8")) > MAX_PROMPT or "\x00" in prompt:
                await self.error(rid, "prompt_limit", -32602)
                return
            self.used, self.prompt_id = True, rid
            self.deadline = time.monotonic() + self.config.timeout
            await self.request("turn/start", {"threadId": self.thread_id, "cwd": self.cwd,
                "input": [{"type": "text", "text": prompt}], "approvalPolicy": "on-request",
                "approvalsReviewer": "user", "sandboxPolicy": self.sandbox()}, rid)
        else:
            await self.error(rid, "method_not_found", -32601)

    def bind_turn(self, turn):
        if (self.prompt_id is None or not isinstance(turn, dict) or not isinstance(turn.get("id"), str)
                or not valid_id(turn["id"]) or self.turn_id is not None and self.turn_id != turn["id"]):
            raise Failure("codex_turn_identity_mismatch")
        self.turn_id = turn["id"]

    def check_identity(self, params, turn=True):
        if params.get("threadId") != self.thread_id or self.thread_id is None:
            raise Failure("codex_thread_identity_mismatch")
        if turn and (self.turn_id is None or params.get("turnId") != self.turn_id):
            raise Failure("codex_turn_identity_mismatch")

    async def handle_native(self, frame):
        if not isinstance(frame, dict) or frame.get("jsonrpc", "2.0") != "2.0":
            raise Failure("codex_protocol_invalid")
        if "method" not in frame:
            rid = frame.get("id")
            if type(rid) is not int or rid not in self.pending:
                raise Failure("codex_response_identity_mismatch")
            method, caller, _ = self.pending.pop(rid)
            self.handling_caller = caller
            if "error" in frame or not isinstance(frame.get("result"), dict):
                raise Failure("codex_request_rejected")
            result = frame["result"]
            if method == "initialize":
                await self.native_send({"method": "initialized", "params": {}})
                self.initialized = True
                await self.result(caller, {"protocolVersion": 1, "agentCapabilities": {
                    "loadSession": False, "promptCapabilities": {}}, "authMethods": [],
                    "agentInfo": {"name": "webcodex-codex-app-server", "version": "1"}})
                self.deadline = time.monotonic() + RPC_TIMEOUT
            elif method == "thread/start":
                self.validate_effective_thread(result)
                self.session = str(uuid.uuid4())
                await self.result(caller, {"sessionId": self.session})
                self.deadline = time.monotonic() + RPC_TIMEOUT
            elif method == "turn/start":
                self.bind_turn(result.get("turn"))
                await self.interrupt()
            # turn/interrupt acceptance is not terminal cancellation.
            self.handling_caller = None
            return
        method, params = frame["method"], frame.get("params", {})
        if not isinstance(method, str) or not isinstance(params, dict):
            raise Failure("codex_protocol_invalid")
        if "id" in frame:
            await self.native_request(frame["id"], method, params)
            return
        if method == "turn/started":
            self.check_identity(params, turn=False)
            self.bind_turn(params.get("turn"))
            await self.interrupt()
        elif method == "turn/completed":
            self.check_identity(params, turn=False)
            self.bind_turn(params.get("turn"))
            status = params["turn"].get("status")
            if status not in ("completed", "interrupted", "failed"):
                raise Failure("codex_terminal_invalid")
            self.approval = None
            self.approval_queue.clear()
            if status == "failed":
                raise Failure("codex_turn_failed")
            await self.result(self.prompt_id, {"stopReason": "end_turn" if status == "completed" else "cancelled"})
            self.prompt_id = None
            self.stopping = True
        elif method == "item/agentMessage/delta":
            self.check_identity(params)
            item = params.get("itemId")
            if not valid_id(item):
                raise Failure("codex_item_invalid")
            delta = text(params.get("delta"))
            if item not in self.messages and len(self.messages) >= MAX_ITEMS:
                raise Failure("codex_item_limit")
            self.messages[item] = self.messages.get(item, "") + delta
            if len(self.messages[item].encode("utf-8")) > self.config.max_output_bytes:
                raise Failure("codex_output_limit")
            await self.message(delta)
        elif method in ("item/started", "item/completed"):
            self.check_identity(params)
            await self.item_update(params.get("item"), method == "item/completed")
        elif method == "serverRequest/resolved":
            if self.approval and params.get("requestId") == self.approval["native_id"]:
                self.check_identity(params, turn=False)
                self.approval = None  # A stale ACP selection can no longer grant anything.
                await self.next_approval()
        # Other notifications are bounded and ignored. They are not success or
        # execution authority; raw internal/model error text is never relayed.

    async def item_update(self, item, completed):
        if not isinstance(item, dict) or not valid_id(item.get("id")):
            raise Failure("codex_item_invalid")
        identity, kind = item["id"], item.get("type")
        if kind == "agentMessage" and completed:
            final = text(item.get("text"))
            previous = self.messages.pop(identity, "")
            if final.startswith(previous):
                await self.message(final[len(previous):])
            elif final != previous:
                await self.message("\nFinal response:\n" + final)
            return
        choices = {"commandExecution": ("execute", "Codex command"),
                   "fileChange": ("edit", "Codex file changes"),
                   "mcpToolCall": ("other", "Codex MCP tool"),
                   "webSearch": ("fetch", "Codex web search"),
                   "imageView": ("read", "Codex image inspection"),
                   "collabAgentToolCall": ("other", "Codex delegated agent")}
        if kind not in choices:
            return
        if kind == "fileChange" and not completed:
            if len(self.items) >= MAX_ITEMS:
                raise Failure("codex_item_limit")
            self.items[identity] = item if len(encoded(item)) <= MAX_APPROVAL_DETAILS else None
        tool_kind, title = choices[kind]
        status = "completed" if completed else "in_progress"
        if item.get("status") in ("failed", "declined"):
            status = "failed"
        await self.update({"sessionUpdate": "tool_call_update" if completed else "tool_call",
                           "toolCallId": identity, "title": title, "kind": tool_kind, "status": status})
        if completed:
            self.items.pop(identity, None)

    async def native_request(self, rid, method, params):
        if not valid_id(rid) or (type(rid).__name__, rid) in self.native_requests:
            raise Failure("codex_request_identity_mismatch")
        if len(self.native_requests) >= MAX_APPROVALS:
            raise Failure("codex_approval_limit")
        self.native_requests.add((type(rid).__name__, rid))
        supported = {"item/commandExecution/requestApproval", "item/fileChange/requestApproval",
                     "item/permissions/requestApproval"}
        if method not in supported:
            await self.native_send({"id": rid, "error": {"code": -32601,
                "message": "This ACP bridge does not support this interactive request"}})
            raise Failure("codex_interactive_request_unsupported")
        self.check_identity(params)
        if not valid_id(params.get("itemId")):
            raise Failure("codex_item_invalid")
        if self.cancel_requested:
            await self.native_send({"id": rid, "result": self.cancel_result(method)})
            return
        if len(self.approval_queue) >= 8:
            raise Failure("codex_approval_limit")
        self.approval_queue.append((rid, method, params))
        await self.next_approval()

    @staticmethod
    def cancel_result(method):
        return {"permissions": {}, "scope": "turn"} if method == "item/permissions/requestApproval" else {"decision": "cancel"}

    async def next_approval(self):
        if self.approval or not self.approval_queue:
            return
        rid, method, params = self.approval_queue.popleft()
        details = {"operation": method, "threadId": self.thread_id, "turnId": self.turn_id,
                   "itemId": params["itemId"]}
        decisions = {"reject": {"decision": "decline"}}
        allow_name = "Approve this action once"
        kind, title = "other", "Codex permission request"
        if method == "item/commandExecution/requestApproval":
            if not isinstance(params.get("command"), str) or not isinstance(params.get("cwd"), str):
                raise Failure("codex_approval_details_unavailable")
            for name in ("command", "cwd", "kind", "reason", "approvalId", "additionalPermissions", "networkApprovalContext"):
                if name in params:
                    details[name] = params[name]
            available = params.get("availableDecisions")
            if available is None:
                available = ["accept", "decline", "cancel"]
            if not isinstance(available, list) or len(available) > 16:
                raise Failure("codex_approval_invalid")
            if "accept" in available:
                decisions["allow"] = {"decision": "accept"}
            if "decline" not in available:
                decisions["reject"] = {"decision": "cancel"}
            kind, title = "execute", "Approve a Codex command"
        elif method == "item/fileChange/requestApproval":
            item = self.items.get(params["itemId"])
            if not item or not isinstance(item.get("changes"), list) or not item["changes"]:
                raise Failure("codex_approval_details_unavailable")
            details.update({"changes": item["changes"], "reason": params.get("reason"),
                            "grantRoot": params.get("grantRoot")})
            decisions["allow"] = {"decision": "accept"}
            kind, title = "edit", "Approve Codex file changes"
        else:
            permissions = params.get("permissions")
            if (not isinstance(permissions, dict) or not permissions
                    or not permissions.keys() <= {"network", "fileSystem"}
                    or any(value is not None and not isinstance(value, dict) for value in permissions.values())
                    or not isinstance(params.get("cwd"), str)):
                raise Failure("codex_approval_invalid")
            details.update({"permissions": permissions, "cwd": params["cwd"],
                            "reason": params.get("reason"), "grantScope": "turn"})
            decisions = {"allow": {"permissions": permissions, "scope": "turn"},
                         "reject": {"permissions": {}, "scope": "turn"}}
            allow_name = "Grant exactly these permissions for this turn"
        content = json.dumps(details, ensure_ascii=False, indent=2, allow_nan=False)
        if len(content.encode("utf-8")) > MAX_APPROVAL_DETAILS:
            raise Failure("codex_approval_details_limit")
        options = []
        if "allow" in decisions:
            options.append({"optionId": "allow", "name": allow_name, "kind": "allow_once"})
        options.append({"optionId": "reject", "name": "Deny this request", "kind": "reject_once"})
        acp_id = self.next_permission
        self.next_permission += 1
        self.approval = {"acp_id": acp_id, "native_id": rid, "method": method, "decisions": decisions,
                         "deadline": time.monotonic() + self.config.permission_timeout}
        await self.output.send({"id": acp_id, "method": "session/request_permission", "params": {
            "sessionId": self.session, "toolCall": {"toolCallId": params["itemId"], "title": title,
                "kind": kind, "status": "pending", "content": [
                    {"type": "content", "content": {"type": "text", "text": content}}]}, "options": options}})

    async def permission_response(self, frame):
        pending = self.approval
        if not pending or type(frame.get("id")) is not int or frame["id"] != pending["acp_id"]:
            return  # Late, duplicate, or unrelated replies never retarget a new request.
        if time.monotonic() >= pending["deadline"] or self.cancel_requested:
            raise Failure("codex_permission_expired")
        outcome = frame.get("result", {}).get("outcome") if isinstance(frame.get("result"), dict) else None
        if not isinstance(outcome, dict):
            raise Failure("acp_permission_response_invalid")
        if outcome == {"outcome": "cancelled"}:
            result = self.cancel_result(pending["method"])
        elif (set(outcome) == {"outcome", "optionId"} and outcome["outcome"] == "selected"
              and isinstance(outcome["optionId"], str) and outcome["optionId"] in pending["decisions"]):
            result = pending["decisions"][outcome["optionId"]]
        else:
            raise Failure("acp_permission_response_invalid")
        self.approval = None  # Consume before the possibly uncertain outbound write.
        await self.native_send({"id": pending["native_id"], "result": result})
        await self.next_approval()

    async def cancel_approvals(self):
        pending, self.approval = self.approval, None
        if pending:
            await self.native_send({"id": pending["native_id"], "result": self.cancel_result(pending["method"])})
        while self.approval_queue:
            rid, method, _ = self.approval_queue.popleft()
            await self.native_send({"id": rid, "result": self.cancel_result(method)})

    async def interrupt(self):
        if self.cancel_requested and self.prompt_id is not None and self.turn_id and not self.interrupt_sent:
            self.interrupt_sent = True
            await self.request("turn/interrupt", {"threadId": self.thread_id, "turnId": self.turn_id})

    async def shutdown(self):
        if self.process:
            with contextlib.suppress(Exception):
                self.cancel_requested = True
                await self.cancel_approvals()
                await self.interrupt()
            if self.process.stdin:
                self.process.stdin.close()
            try:
                await asyncio.wait_for(self.process.wait(), 1)
            except asyncio.TimeoutError:
                with contextlib.suppress(ProcessLookupError):
                    self.process.terminate()
                try:
                    await asyncio.wait_for(self.process.wait(), 1)
                except asyncio.TimeoutError:
                    with contextlib.suppress(ProcessLookupError):
                        self.process.kill()
                    await self.process.wait()
        if self.reader_task:
            self.reader_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.reader_task
        self.output.close()

    async def run(self):
        loop = asyncio.get_running_loop()
        def reader():
            try:
                while True:
                    raw = sys.stdin.buffer.readline(MAX_FRAME + 1)
                    if not raw:
                        event = ("eof", None)
                    elif len(raw) > MAX_FRAME or not raw.endswith(b"\n"):
                        event = ("failure", "acp_frame_limit")
                    else:
                        event = ("acp", parse_json(raw))
                    asyncio.run_coroutine_threadsafe(self.events.put(event), loop).result()
                    if event[0] in ("eof", "failure"):
                        return
            except (ValueError, UnicodeError, RecursionError):
                with contextlib.suppress(RuntimeError):
                    asyncio.run_coroutine_threadsafe(self.events.put(("failure", "acp_json_invalid")), loop)
            except (OSError, RuntimeError, CancelledError):
                pass
        threading.Thread(target=reader, daemon=True, name="codex-acp-input").start()
        try:
            while not self.stopping:
                now = time.monotonic()
                deadlines = [self.deadline]
                deadlines.extend(entry[2] for entry in self.pending.values())
                if self.approval:
                    deadlines.append(self.approval["deadline"])
                if self.cancel_deadline:
                    deadlines.append(self.cancel_deadline)
                remaining = min(deadlines) - now
                if remaining <= 0:
                    if self.cancel_deadline and now >= self.cancel_deadline:
                        raise Failure("codex_cancel_unconfirmed")
                    if self.approval and now >= self.approval["deadline"]:
                        raise Failure("codex_permission_timeout")
                    raise Failure("codex_deadline_exceeded")
                try:
                    source, value = await asyncio.wait_for(self.events.get(), remaining)
                except asyncio.TimeoutError:
                    continue
                if source == "eof":
                    break
                if source == "failure":
                    raise Failure(value)
                await (self.handle_acp(value) if source == "acp" else self.handle_native(value))
        except (Failure, OSError, ValueError, UnicodeError, RecursionError) as exc:
            kind = exc.kind if isinstance(exc, Failure) else "codex_protocol_invalid"
            rid = self.prompt_id
            if rid is None:
                rid = self.handling_caller
            if rid is None:
                rid = next((entry[1] for entry in self.pending.values() if entry[1] is not None), None)
            if not self.output.failed:
                with contextlib.suppress(Failure, OSError):
                    await self.error(rid, kind)
        finally:
            await self.shutdown()


def profile(receipt, receipt_path, entry_path, *, network=False):
    environment = {name: name for name in ("PATH", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA",
                   "SystemRoot", "CODEX_HOME", "OPENAI_API_KEY", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY",
                   "SSL_CERT_FILE", "SSL_CERT_DIR") if name in os.environ}
    args = [str(Path(entry_path).resolve()), "serve", "--experimental",
            "--receipt", str(Path(receipt_path).resolve())]
    if network:
        args.append("--network")
    return {"provider_id": "codex-app-server", "name": "Codex app-server (experimental)",
            "executable": sys.executable, "args": args, "enabled": False,
            "env_from_env": environment, "allowed_config_options": []}


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest="action", required=True)
    setup = commands.add_parser("prepare", help="Check the installed Codex and save its exact compatibility receipt")
    setup.add_argument("--experimental", action="store_true", required=True)
    setup.add_argument("--codex-bin", default="codex")
    setup.add_argument("--codex-arg", action="append", default=[], help="Fixed operator-owned interpreter/launcher argument")
    setup.add_argument("--expected-version", help="Also require this exact codex-cli version")
    setup.add_argument("--receipt", required=True, help="Absolute operator-owned receipt path")
    setup.add_argument("--network", action="store_true", help="Explicitly allow network in the prepared provider; workspace-write and on-request approval remain")
    run = commands.add_parser("serve", help="Serve one Runner-owned ACP Run")
    run.add_argument("--experimental", action="store_true", required=True)
    run.add_argument("--receipt", required=True)
    run.add_argument("--model", help="Operator-selected model; otherwise use the Codex configuration")
    run.add_argument("--sandbox", choices=("read-only", "workspace-write"), default="workspace-write")
    run.add_argument("--network", action="store_true", help="Explicitly enable native sandbox network access")
    run.add_argument("--timeout", type=float, default=3600)
    run.add_argument("--permission-timeout", type=float, default=300)
    run.add_argument("--cancel-timeout", type=float, default=3)
    run.add_argument("--max-output-bytes", type=int, default=1024 * 1024)
    return result


def main():
    if sys.version_info < (3, 10):
        print("Python 3.10 or newer is required for the Codex app-server adapter", file=sys.stderr)
        return 1
    arguments = parser().parse_args()
    if arguments.action == "prepare":
        try:
            receipt = asyncio.run(prepare(arguments.codex_bin, arguments.codex_arg, arguments.receipt, arguments.expected_version))
            print(json.dumps({"status": "ready", "codex_version": receipt["codex_version"],
                              "receipt": arguments.receipt,
                              "profile": profile(receipt, arguments.receipt, sys.argv[0], network=arguments.network)}))
        except (Failure, OSError, ValueError, RecursionError) as exc:
            kind = exc.kind if isinstance(exc, Failure) else "codex_prepare_failed"
            print(json.dumps({"status": "error", "kind": kind,
                "next_step": "Install a compatible native Codex executable and rerun prepare; upgrades require a new receipt."}))
            return 1
    else:
        if (not 0 < arguments.timeout <= 3600 or not 0 < arguments.permission_timeout <= 600
                or not 0 < arguments.cancel_timeout <= 10 or not 1 <= arguments.max_output_bytes <= 16 * 1024 * 1024
                or arguments.model is not None and (len(arguments.model) > 256 or any(ord(char) < 32 for char in arguments.model))):
            parser().error("bounds exceed the supported adapter contract")
        async def serve():
            await Adapter(arguments).run()
        asyncio.run(serve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
