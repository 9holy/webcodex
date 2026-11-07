"""Actual stdio subprocess fixture; no model, credentials, or external service."""
import json
import os
from pathlib import Path
import sys
import time

from schema_fixture import write as write_schema

sys.stdout.reconfigure(encoding="utf-8", newline="\n")


def emit(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def trace(value):
    path = os.environ.get("FAKE_CODEX_TRACE")
    if path:
        with open(path, "a", encoding="utf-8") as stream:
            stream.write(json.dumps(value) + "\n")


if sys.argv[1:] == ["--version"]:
    print("codex-cli " + os.environ.get("FAKE_CODEX_VERSION", "0.167.0-fixture.1"))
    raise SystemExit(0)
if sys.argv[1:4] == ["app-server", "generate-json-schema", "--experimental"]:
    write_schema(sys.argv[sys.argv.index("--out") + 1], os.environ.get("FAKE_CODEX_SCHEMA"))
    raise SystemExit(0)
if sys.argv[1:] != ["app-server", "--listen", "stdio://"]:
    raise SystemExit(2)

scenario = os.environ.get("FAKE_CODEX_SCENARIO", "complete")
thread_id, turn_id, cwd = "thread-fixture", "turn-fixture", str(Path.cwd())
pending = {}
sequence = 70
trace({"started": True, "pid": os.getpid(), "parent": os.getppid(),
       "group": os.getpgrp() if hasattr(os, "getpgrp") else None})


def notify(method, extra):
    emit({"method": method, "params": {"threadId": thread_id, "turnId": turn_id, **extra}})


def item(value, completed=False):
    notify("item/completed" if completed else "item/started", {"item": value})


def complete(message="完成 🌎", status="completed"):
    notify("item/agentMessage/delta", {"itemId": "message-1", "delta": message})
    item({"id": "message-1", "type": "agentMessage", "text": message}, True)
    notify("turn/completed", {"turn": {"id": turn_id, "status": status, "items": []}})


def permission(kind="command", suffix=""):
    global sequence
    sequence += 1
    rid = "native-" + str(sequence) if scenario == "string_request_id" else sequence
    action_id = kind + suffix
    parameters = {"threadId": thread_id, "turnId": turn_id, "itemId": action_id, "startedAtMs": 1}
    if kind == "file":
        item({"id": action_id, "type": "fileChange", "status": "inProgress", "changes": [
            {"path": str(Path(cwd, "approved-file.txt")), "kind": {"type": "add"}, "diff": "+approved\n"}]})
        method = "item/fileChange/requestApproval"
    elif kind == "permissions":
        method = "item/permissions/requestApproval"
        parameters.update({"cwd": cwd, "reason": "Read the explicit shared directory", "permissions": {
            "fileSystem": {"read": [str(Path(cwd, "shared"))]}, "network": {"enabled": True}}})
    else:
        method = "item/commandExecution/requestApproval"
        parameters.update({"command": "python3 -c 'print(42)'", "cwd": cwd, "reason": "Execute the requested check",
                           "availableDecisions": ["accept", "acceptForSession", "decline", "cancel"]})
        if scenario == "approval_details_limit":
            parameters["command"] = "x" * (64 * 1024)
        if scenario == "no_once_decision":
            parameters["availableDecisions"] = ["acceptForSession", "cancel"]
        if scenario == "wrong_thread":
            parameters["threadId"] = "other-thread"
    pending[rid] = (kind, suffix)
    emit({"id": rid, "method": method, "params": parameters})


for raw in sys.stdin.buffer:
    frame = json.loads(raw)
    trace(frame)
    method, rid = frame.get("method"), frame.get("id")
    if method == "initialize":
        assert frame["params"]["capabilities"]["experimentalApi"] is True
        assert frame["params"]["capabilities"]["requiredHumanApproval"] is True
        emit({"id": rid, "result": {"userAgent": "fixture"}})
    elif method == "initialized":
        continue
    elif method == "thread/start":
        p = frame["params"]
        assert p["cwd"] == cwd
        assert p["ephemeral"] is True
        assert p["approvalPolicy"] == "on-request" and p["approvalsReviewer"] == "user"
        policy = {"type": "workspaceWrite", "writableRoots": [cwd],
                  "excludeTmpdirEnvVar": True, "excludeSlashTmp": True,
                  "networkAccess": p["config"]["sandbox_workspace_write.network_access"]}
        if p["sandbox"] == "read-only":
            policy = {"type": "readOnly", "networkAccess": False}
        if scenario == "wrong_policy":
            policy = {"type": "dangerFullAccess"}
        if scenario == "extra_root":
            policy["writableRoots"].append(str(Path(cwd).parent))
        emit({"id": rid, "result": {"thread": {"id": thread_id}, "cwd": cwd,
            "sandbox": policy, "approvalPolicy": "on-request", "approvalsReviewer": "user"}})
    elif method == "turn/start":
        p = frame["params"]
        assert p["threadId"] == thread_id and p["cwd"] == cwd
        assert p["approvalPolicy"] == "on-request" and p["approvalsReviewer"] == "user"
        if scenario == "rpc_error":
            emit({"id": rid, "error": {"code": -32000, "message": "private-test-secret"}})
            continue
        notify("turn/started", {"turn": {"id": turn_id, "status": "inProgress", "items": []}})
        if scenario != "cancel_before_turn_reply":
            emit({"id": rid, "result": {"turn": {"id": turn_id, "status": "inProgress", "items": []}}})
        if scenario in ("hanging", "cancel_unconfirmed", "cancel_before_turn_reply"):
            continue
        if scenario in ("approval", "string_request_id", "approval_details_limit", "no_once_decision", "wrong_thread", "two_approvals"):
            permission()
        elif scenario == "file_approval":
            permission("file")
        elif scenario == "permission_grant":
            permission("permissions")
        elif scenario == "unknown_request":
            emit({"id": 99, "method": "item/tool/requestUserInput", "params": {
                "threadId": thread_id, "turnId": turn_id, "itemId": "question", "questions": []}})
        elif scenario == "eof":
            notify("item/agentMessage/delta", {"itemId": "message-1", "delta": "partial"})
            raise SystemExit(0)
        elif scenario == "wrong_turn":
            notify("item/agentMessage/delta", {"turnId": "other-turn", "itemId": "message-1", "delta": "foreign"})
        elif scenario == "malformed":
            print("{invalid", flush=True)
        elif scenario == "oversize":
            print("x" * (1024 * 1024 + 1), flush=True)
        else:
            item({"id": "command", "type": "commandExecution", "status": "inProgress", "command": "fixture"})
            Path(cwd, "native-result.txt").write_text("actual fixture execution\n", encoding="utf-8")
            item({"id": "command", "type": "commandExecution", "status": "completed",
                  "aggregatedOutput": "private-test-secret"}, True)
            complete()
    elif method == "turn/interrupt":
        assert frame["params"] == {"threadId": thread_id, "turnId": turn_id}
        emit({"id": rid, "result": {}})
        if scenario != "cancel_unconfirmed":
            notify("turn/completed", {"turn": {"id": turn_id, "status": "interrupted", "items": []}})
    elif method is None and rid in pending:
        kind, suffix = pending.pop(rid)
        result = frame.get("result", {})
        accepted = result.get("decision") == "accept" or kind == "permissions" and bool(result.get("permissions"))
        if accepted:
            if kind == "permissions":
                assert result["scope"] == "turn"
                assert result["permissions"] == {"fileSystem": {"read": [str(Path(cwd, "shared"))]}, "network": {"enabled": True}}
            Path(cwd, "approved-" + kind + suffix + ".txt").write_text("approved", encoding="utf-8")
        if scenario == "two_approvals" and not suffix:
            permission(suffix="-2")
        elif result.get("decision") == "cancel":
            complete("cancelled", "interrupted")
        else:
            complete("approved" if accepted else "denied")
trace({"eof": True})
