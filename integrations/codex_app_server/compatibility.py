"""Operator-owned, version-pinned compatibility receipts for the Codex bridge.

No network, credentials, model calls, or project execution are used by prepare.
The installed executable generates its own schema; unsupported contracts fail
closed instead of treating an arbitrary version string as compatibility.
"""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile


CONTRACT = "webcodex-codex-acp-v1"
MAX_SCHEMA = 4 * 1024 * 1024
MAX_RECEIPT = 16 * 1024
MAX_EXECUTABLE = 1024 * 1024 * 1024
MAX_NPM_PACKAGE = 64 * 1024
WINDOWS = os.name == "nt"


class Failure(Exception):
    def __init__(self, kind):
        self.kind = kind
        super().__init__(kind)


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")


def parse_json(raw):
    def pairs(items):
        value = {}
        for key, item in items:
            if key in value:
                raise ValueError("duplicate JSON key")
            value[key] = item
        return value
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("non-finite JSON")))


def fingerprint(path):
    digest = hashlib.sha256()
    total = 0
    with open(path, "rb") as stream:
        while block := stream.read(1024 * 1024):
            total += len(block)
            if total > MAX_EXECUTABLE:
                raise Failure("codex_executable_too_large")
            digest.update(block)
    return digest.hexdigest()


def launcher_arguments(arguments):
    if len(arguments) > 8 or any(not isinstance(arg, str) or len(arg) > 4096
                                 or "\x00" in arg for arg in arguments):
        raise Failure("codex_launcher_arguments_invalid")


def npm_command(shim, arguments):
    # npm's Windows shims have this fixed sibling package layout. Never read or
    # execute shell text, invoke npm, or search other installation directories.
    if shim.name.lower() not in ("codex.cmd", "codex.ps1"):
        raise Failure("codex_requires_native_executable")
    package = shim.parent / "node_modules" / "@openai" / "codex"
    script = package / "bin" / "codex.js"
    try:
        with (package / "package.json").open("rb") as stream:
            raw = stream.read(MAX_NPM_PACKAGE + 1)
        if len(raw) > MAX_NPM_PACKAGE:
            raise ValueError("package limit")
        metadata = parse_json(raw)
        if (not isinstance(metadata, dict) or metadata.get("name") != "@openai/codex"
                or metadata.get("bin") != {"codex": "bin/codex.js"}
                or not script.is_file()):
            raise ValueError("package layout")
        script = script.resolve(strict=True)
    except (OSError, ValueError, RuntimeError):
        raise Failure("codex_npm_layout_invalid") from None
    try:
        local_node = shim.parent / "node.exe"
        node = local_node if local_node.exists() else shutil.which("node.exe")
        if not node or not Path(node).is_file() or Path(node).suffix.lower() != ".exe":
            raise Failure("codex_node_not_found")
        node = Path(node).resolve(strict=True)
        if node.suffix.lower() != ".exe":
            raise Failure("codex_node_not_found")
    except (OSError, ValueError, RuntimeError):
        raise Failure("codex_node_not_found") from None
    resolved_arguments = [str(script), *arguments]
    launcher_arguments(resolved_arguments)
    return [str(node), *resolved_arguments]


def default_windows_codex():
    # These are the two standard per-user install locations, not a directory
    # scan. A selected-but-invalid installation must never fall through.
    local = os.environ.get("LOCALAPPDATA")
    if local and Path(local).is_absolute():
        standalone = Path(local) / "Programs" / "OpenAI" / "Codex" / "bin" / "codex.exe"
        if standalone.exists():
            return standalone
    roaming = os.environ.get("APPDATA")
    if roaming and Path(roaming).is_absolute():
        for name in ("codex.cmd", "codex.ps1"):
            shim = Path(roaming) / "npm" / name
            if shim.exists():
                return shim
    return None


def resolve_command(binary, arguments):
    launcher_arguments(arguments)
    try:
        path = shutil.which(binary) if not os.path.isabs(binary) else binary
        if path is None and WINDOWS and binary == "codex":
            path = default_windows_codex()
        if not path or not Path(path).is_file():
            raise Failure("codex_not_found")
        path = Path(path).resolve(strict=True)
    except (OSError, ValueError, RuntimeError):
        raise Failure("codex_not_found") from None
    if path.suffix.lower() in (".cmd", ".bat", ".ps1"):
        if WINDOWS:
            return npm_command(path, arguments)
        raise Failure("codex_requires_native_executable")
    return [str(path), *arguments]


def command_files(command):
    # Bind interpreter launchers to their explicit script as well as the native
    # executable, including the absolute Node/script pair discovered from npm.
    # Do not scan directories or read unrelated configuration.
    return {arg: fingerprint(arg) for index, arg in enumerate(command)
            if index == 0 or os.path.isabs(arg) and Path(arg).is_file()}


async def bounded_command(command, limit=4096, timeout=20):
    process = await asyncio.create_subprocess_exec(
        *command, stdin=asyncio.subprocess.DEVNULL, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL, limit=limit + 1)
    try:
        async def collect():
            raw = bytearray()
            while block := await process.stdout.read(min(4096, limit + 1)):
                raw.extend(block)
                if len(raw) > limit:
                    raise Failure("codex_probe_output_limit")
            await process.wait()
            if process.returncode != 0:
                raise Failure("codex_probe_failed")
            return bytes(raw)
        return await asyncio.wait_for(collect(), timeout)
    except asyncio.TimeoutError:
        raise Failure("codex_probe_timeout") from None
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()


async def read_version(command):
    raw = await bounded_command([*command, "--version"])
    match = re.fullmatch(rb"codex-cli ([A-Za-z0-9.+-]{1,96})\r?\n?", raw)
    if not match:
        raise Failure("codex_version_invalid")
    return match[1].decode("ascii")


def schema_object(directory, name):
    path = directory / name
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_SCHEMA:
        raise Failure("codex_schema_unavailable")
    value = parse_json(path.read_bytes())
    if not isinstance(value, dict):
        raise Failure("codex_schema_incompatible")
    return value


def resolve(document, node):
    for _ in range(16):
        reference = node.get("$ref") if isinstance(node, dict) else None
        if not reference:
            return node
        if not reference.startswith("#/definitions/"):
            break
        node = document.get("definitions", {}).get(reference.rsplit("/", 1)[-1])
    raise Failure("codex_schema_incompatible")


def variants(document, node):
    node = resolve(document, node)
    if not isinstance(node, dict):
        raise Failure("codex_schema_incompatible")
    for key in ("anyOf", "oneOf", "allOf"):
        if key in node:
            return [item for branch in node[key] for item in variants(document, branch)]
    return [node]


def accepts_literal(document, node, literal):
    return any(literal in branch.get("enum", []) for branch in variants(document, node))


def properties(document, node=None):
    candidates = [branch for branch in variants(document, document if node is None else node)
                  if "properties" in branch]
    if len(candidates) != 1:
        raise Failure("codex_schema_incompatible")
    return candidates[0]


def validate_bundle(directory):
    """Check the wire subset actually consumed, including newly required fields.

    This is deliberately a compatibility check, not a general JSON Schema
    implementation. Runtime messages also undergo strict identity/type/bound
    validation. A new schema shape is an explicit compatibility failure.
    """
    files = {
        "v1/InitializeParams.json": {"clientInfo", "capabilities"},
        "v2/ThreadStartParams.json": {"cwd", "model", "sandbox", "approvalPolicy",
                                      "approvalsReviewer", "ephemeral", "config"},
        "v2/TurnStartParams.json": {"threadId", "input", "cwd", "approvalPolicy",
                                    "approvalsReviewer", "sandboxPolicy"},
        "v2/TurnInterruptParams.json": {"threadId", "turnId"},
        "CommandExecutionRequestApprovalResponse.json": {"decision"},
        "FileChangeRequestApprovalResponse.json": {"decision"},
        "PermissionsRequestApprovalResponse.json": {"permissions", "scope"},
    }
    documents = {}
    for name, emitted in files.items():
        document = schema_object(directory, name)
        node = properties(document)
        if not emitted <= node["properties"].keys() or not set(node.get("required", [])) <= emitted:
            raise Failure("codex_schema_incompatible")
        documents[name] = document
    incoming = {
        "v2/ThreadStartResponse.json": {"thread", "cwd", "sandbox", "approvalPolicy", "approvalsReviewer"},
        "v2/TurnStartResponse.json": {"turn"},
        "v2/TurnCompletedNotification.json": {"threadId", "turn"},
        "v2/AgentMessageDeltaNotification.json": {"threadId", "turnId", "itemId", "delta"},
        "v2/ItemStartedNotification.json": {"threadId", "turnId", "item"},
        "v2/ItemCompletedNotification.json": {"threadId", "turnId", "item"},
        "CommandExecutionRequestApprovalParams.json": {"threadId", "turnId", "itemId", "command", "cwd"},
        "FileChangeRequestApprovalParams.json": {"threadId", "turnId", "itemId"},
        "PermissionsRequestApprovalParams.json": {"threadId", "turnId", "itemId", "cwd", "permissions"},
    }
    for name, consumed in incoming.items():
        document = schema_object(directory, name)
        if not consumed <= properties(document)["properties"].keys():
            raise Failure("codex_schema_incompatible")
        documents[name] = document
    for name in ("ClientRequest.json", "ServerRequest.json"):
        documents[name] = schema_object(directory, name)
    request_methods = {method for variant in documents["ClientRequest.json"].get("oneOf", [])
                       for method in variant.get("properties", {}).get("method", {}).get("enum", [])}
    server_methods = {method for variant in documents["ServerRequest.json"].get("oneOf", [])
                      for method in variant.get("properties", {}).get("method", {}).get("enum", [])}
    if not {"initialize", "thread/start", "turn/start", "turn/interrupt"} <= request_methods:
        raise Failure("codex_schema_incompatible")
    if not {"item/commandExecution/requestApproval", "item/fileChange/requestApproval",
            "item/permissions/requestApproval"} <= server_methods:
        raise Failure("codex_schema_incompatible")
    thread = documents["v2/ThreadStartParams.json"]
    for field, literal in (("sandbox", "workspace-write"), ("sandbox", "read-only"),
                           ("approvalPolicy", "on-request"), ("approvalsReviewer", "user")):
        if not accepts_literal(thread, thread["properties"][field], literal):
            raise Failure("codex_schema_incompatible")
    turn = documents["v2/TurnStartParams.json"]
    policies = variants(turn, turn["properties"]["sandboxPolicy"])
    workspace = next((policy for policy in policies if "workspaceWrite" in
                      policy.get("properties", {}).get("type", {}).get("enum", [])), None)
    if not workspace or not {"writableRoots", "networkAccess", "excludeSlashTmp",
                              "excludeTmpdirEnvVar"} <= workspace.get("properties", {}).keys():
        raise Failure("codex_schema_incompatible")
    if not set(workspace.get("required", [])) <= {"type", "writableRoots", "networkAccess",
                                                 "excludeSlashTmp", "excludeTmpdirEnvVar"}:
        raise Failure("codex_schema_incompatible")
    read_only = next((policy for policy in policies if "readOnly" in
                      policy.get("properties", {}).get("type", {}).get("enum", [])), None)
    if not read_only or "networkAccess" not in read_only.get("properties", {}):
        raise Failure("codex_schema_incompatible")
    if not set(read_only.get("required", [])) <= {"type", "networkAccess"}:
        raise Failure("codex_schema_incompatible")
    for name in ("CommandExecutionRequestApprovalResponse.json", "FileChangeRequestApprovalResponse.json"):
        document = documents[name]
        if not all(accepts_literal(document, document["properties"]["decision"], literal)
                   for literal in ("accept", "decline", "cancel")):
            raise Failure("codex_schema_incompatible")
    grants = documents["PermissionsRequestApprovalResponse.json"]
    if not accepts_literal(grants, grants["properties"]["scope"], "turn"):
        raise Failure("codex_schema_incompatible")
    initialize = documents["v1/InitializeParams.json"]
    caps = properties(initialize, initialize["properties"]["capabilities"])
    if "experimentalApi" not in caps["properties"]:
        raise Failure("codex_schema_incompatible")
    capabilities = {"experimentalApi": True}
    for name in ("explicitGatewayOauth", "requiredHumanApproval"):
        if name in caps["properties"]:
            capabilities[name] = True
    if not set(caps.get("required", [])) <= capabilities.keys():
        raise Failure("codex_schema_incompatible")
    digest = hashlib.sha256()
    for name, document in sorted(documents.items()):
        digest.update(name.encode("utf-8") + b"\x00" + encoded(document))
    return {"schema_sha256": digest.hexdigest(), "initialize_capabilities": capabilities}


async def prepare(binary, arguments, receipt_path, expected_version=None):
    command = resolve_command(binary, arguments)
    version = await read_version(command)
    if expected_version is not None and version != expected_version:
        raise Failure("codex_version_mismatch")
    fingerprints = command_files(command)
    with tempfile.TemporaryDirectory(prefix="webcodex-codex-schema-") as directory:
        await bounded_command([*command, "app-server", "generate-json-schema", "--experimental",
                               "--out", directory], timeout=30)
        checked = validate_bundle(Path(directory))
    if fingerprints != command_files(command) or version != await read_version(command):
        raise Failure("codex_changed_during_prepare")
    receipt = {"schema_version": 1, "contract": CONTRACT, "command": command,
               "codex_version": version, "files_sha256": fingerprints, **checked}
    if len(encoded(receipt)) > MAX_RECEIPT:
        raise Failure("codex_receipt_limit")
    path = Path(receipt_path)
    if not path.is_absolute() or path.is_symlink():
        raise Failure("receipt_requires_absolute_owned_path")
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".codex-receipt-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(encoded(receipt) + b"\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return receipt


async def verify_receipt(path):
    target = Path(path)
    if not target.is_absolute() or target.is_symlink() or not target.is_file() or target.stat().st_size > MAX_RECEIPT:
        raise Failure("codex_receipt_invalid")
    value = parse_json(target.read_bytes())
    expected_keys = {"schema_version", "contract", "command", "codex_version", "files_sha256",
                     "schema_sha256", "initialize_capabilities"}
    if not isinstance(value, dict) or set(value) != expected_keys or value["schema_version"] != 1 or value["contract"] != CONTRACT:
        raise Failure("codex_receipt_invalid")
    command = value["command"]
    if not isinstance(command, list) or not command or len(command) > 9 or any(not isinstance(item, str) for item in command):
        raise Failure("codex_receipt_invalid")
    if command != resolve_command(command[0], command[1:]):
        raise Failure("codex_receipt_invalid")
    caps = value["initialize_capabilities"]
    if (not isinstance(caps, dict) or caps.get("experimentalApi") is not True
            or not caps.keys() <= {"experimentalApi", "explicitGatewayOauth", "requiredHumanApproval"}
            or any(item is not True for item in caps.values())
            or not isinstance(value["schema_sha256"], str)
            or not re.fullmatch(r"[0-9a-f]{64}", value["schema_sha256"])):
        raise Failure("codex_receipt_invalid")
    if value["codex_version"] != await read_version(command):
        raise Failure("codex_version_mismatch")
    if value["files_sha256"] != command_files(command):
        raise Failure("codex_binary_changed")
    return value
