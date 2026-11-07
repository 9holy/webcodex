"""Small independent schema fixture for the app-server wire subset.

This is not a copy of the full Codex schema. Real installation preparation must
validate the schema emitted by that installation, and is never satisfied by
this test fixture.
"""
import json
from pathlib import Path


def object_schema(fields, required=(), definitions=None):
    value = {"type": "object", "properties": fields, "required": list(required)}
    if definitions:
        value["definitions"] = definitions
    return value


def write(directory, incompatible=False):
    string = {"type": "string"}
    approval = {"enum": ["on-request", "never", "untrusted"], "type": "string"}
    reviewer = {"enum": ["user", "auto_review"], "type": "string"}
    policy = {"oneOf": [
        object_schema({"type": {"enum": ["readOnly"]}, "networkAccess": {"type": "boolean"}}, ["type"]),
        object_schema({"type": {"enum": ["workspaceWrite"]}, "writableRoots": {"type": "array", "items": string},
                       "networkAccess": {"type": "boolean"}, "excludeSlashTmp": {"type": "boolean"},
                       "excludeTmpdirEnvVar": {"type": "boolean"}}, ["type"])]}
    initialize = object_schema({"clientInfo": {"type": "object"}, "capabilities": {
        "$ref": "#/definitions/Capabilities"}}, ["clientInfo"], {
        "Capabilities": object_schema({"experimentalApi": {"type": "boolean"},
                                       "explicitGatewayOauth": {"type": "boolean"},
                                       "requiredHumanApproval": {"type": "boolean"}})})
    thread = object_schema({"cwd": string, "model": string, "sandbox": {"enum": ["read-only", "workspace-write"]},
                            "approvalPolicy": approval, "approvalsReviewer": reviewer,
                            "ephemeral": {"type": "boolean"}, "config": {"type": "object"}})
    if incompatible == "incompatible":
        thread["required"] = ["newMandatoryPolicy"]
        thread["properties"]["newMandatoryPolicy"] = string
    turn = object_schema({"threadId": string, "input": {"type": "array"}, "cwd": string,
                          "approvalPolicy": approval, "approvalsReviewer": reviewer,
                          "sandboxPolicy": {"$ref": "#/definitions/Policy"}}, ["threadId", "input"], {"Policy": policy})
    decision = object_schema({"decision": {"enum": ["accept", "acceptForSession", "decline", "cancel"]}}, ["decision"])
    docs = {
        "v1/InitializeParams.json": initialize,
        "v2/ThreadStartParams.json": thread,
        "v2/TurnStartParams.json": turn,
        "v2/TurnInterruptParams.json": object_schema({"threadId": string, "turnId": string}, ["threadId", "turnId"]),
        "v2/ThreadStartResponse.json": object_schema({"thread": {"type": "object"}, "cwd": string,
            "sandbox": policy, "approvalPolicy": approval, "approvalsReviewer": reviewer}),
        "CommandExecutionRequestApprovalResponse.json": decision,
        "FileChangeRequestApprovalResponse.json": decision,
        "PermissionsRequestApprovalResponse.json": object_schema({"permissions": {"type": "object"},
            "scope": {"enum": ["turn", "session"]}}, ["permissions"]),
    }
    incoming = {
        "v2/TurnStartResponse.json": ["turn"],
        "v2/TurnCompletedNotification.json": ["threadId", "turn"],
        "v2/AgentMessageDeltaNotification.json": ["threadId", "turnId", "itemId", "delta"],
        "v2/ItemStartedNotification.json": ["threadId", "turnId", "item"],
        "v2/ItemCompletedNotification.json": ["threadId", "turnId", "item"],
        "CommandExecutionRequestApprovalParams.json": ["threadId", "turnId", "itemId", "command", "cwd"],
        "FileChangeRequestApprovalParams.json": ["threadId", "turnId", "itemId"],
        "PermissionsRequestApprovalParams.json": ["threadId", "turnId", "itemId", "cwd", "permissions"],
    }
    for name, fields in incoming.items():
        docs[name] = object_schema({field: {"type": "object"} if field in ("turn", "item", "permissions")
                                   else string for field in fields}, fields)
    if incompatible == "missing_notification_identity":
        del docs["v2/TurnCompletedNotification.json"]["properties"]["threadId"]
    if incompatible == "read_only_required_field":
        policy["oneOf"][0]["properties"]["newMandatoryPolicy"] = string
        policy["oneOf"][0]["required"].append("newMandatoryPolicy")
    for name, methods in (
        ("ClientRequest.json", ["initialize", "thread/start", "turn/start", "turn/interrupt"]),
        ("ServerRequest.json", ["item/commandExecution/requestApproval", "item/fileChange/requestApproval", "item/permissions/requestApproval"])):
        docs[name] = {"oneOf": [object_schema({"method": {"enum": [method]}}) for method in methods]}
    for name, document in docs.items():
        path = Path(directory, name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(document), encoding="utf-8")
