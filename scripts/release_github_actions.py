#!/usr/bin/env python3
"""Publish an explicitly reviewed 9holy/webcodex request from GitHub Actions.

The workflow checkpoints each prepare stage before its corresponding effect.
Only the original controller run can resume its checkpoints. An ambiguous
effect is observed, never repeated. Candidate source and publication control
are separate checkouts; existing readiness/build/bundle verification owns the
candidate contract. A reviewed Python entry point may supply a fixed ReleaseSpec;
request JSON and CLI arguments cannot select it. The default remains v0.5.2.
This module has no arbitrary command/URL/token inputs.
"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import hashlib
import json
import os
import re
import stat
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Mapping

if __package__:
    from . import collect_release_bundle as collector
    from . import release_publication as publication
    from . import release_readiness as readiness
    from . import verify_public_release as public_verifier
    from . import release_platform_scope as release_scope
else:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import collect_release_bundle as collector
    import release_publication as publication
    import release_readiness as readiness
    import verify_public_release as public_verifier
    import release_platform_scope as release_scope

PINNED_REQUEST = {
    "schema_version": 1,
    "repo": "9holy/webcodex",
    "repo_id": 1404596174,
    "owner": "9holy",
    "owner_id": 45361924,
    "version": "0.5.2",
    "tag": "v0.5.2",
    "source_ref": "release/v0.5.2",
    "source_sha": "2299ffe5bcc0f3965e11b753fabc3fb558769de8",
    "source_tree": "c1b02a3d3820f595f832105772ecbeb181468db1",
    "ci_run_id": 42352622976,
    "ci_run_attempt": 1,
    "evidence_run_id": 42352623048,
    "evidence_run_attempt": 1,
    "github_only": True,
    "include_unified_installers": True,
    "include_runtime_installers": False,
    "notes_path": ".github/release-requests/v0.5.2-notes.md",
    "notes_sha256": "c97e1af2f06c76ff8696a307e3e2e64c31e2c1aa68bf0bf64b8289813e338e2b",
}
WORKFLOW_PATH = ".github/workflows/release-publish.yml"
REQUEST_PATH = ".github/release-requests/v0.5.2.json"
BOT_LOGIN = "github-actions[bot]"
BOT_ID = 41898282
MAX_STATE_BYTES = 256 * 1024
MAX_CHECKPOINT_BYTES = 2 * 1024 * 1024
STATE_FILES = frozenset({"journal.json", "readiness.json", "build.json"})
EFFECT_STATUSES = frozenset({"prepared", "started", "succeeded", "rejected", "unknown"})
_POST_WORKFLOW_DEFINITIONS = {
    "image": ("release-image.yml", "Release server image"),
    "intel": ("release-desktop-darwin-x64.yml", "Release macOS Intel Desktop"),
}
STAGES = (
    "restore-state", "preflight", "prepare-readiness", "dispatch-readiness", "status-readiness",
    "prepare-tag", "create-tag", "prepare-build", "dispatch-build", "status-build", "collect",
    "prepare-draft", "create-draft", "prepare-upload", "upload-assets", "verify-draft",
    "prepare-publish", "publish", "verify-public", "prepare-post", "dispatch-post", "status-post",
)


class ReleaseControlError(RuntimeError):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ReleaseControlError(message)


def _positive_int(value: object) -> bool:
    return type(value) is int and value > 0


@dataclass(frozen=True)
class ReleaseSpec:
    """Code-owned release authority, never inferred from an input JSON file.

    Take an immutable snapshot so changing the caller's dictionary cannot change
    a live controller's authority. Only version/source/proof identity and the
    fixed control workflow vary; the existing GitHub-only delivery scope stays.
    """

    pinned_request: Mapping[str, object]
    request_path: str
    workflow_path: str

    def __post_init__(self) -> None:
        request = dict(self.pinned_request)
        fields = set(PINNED_REQUEST)
        if "platform_scope" in request:
            _require(type(request["platform_scope"]) is str and request["platform_scope"] in release_scope.SCOPES,
                     "发布规格的平台范围必须为 all 或 windows。")
            fields.add("platform_scope")
        _require(set(request) == fields, "发布规格字段不符合固定合同。")
        _require(all(type(request[key]) is type(value) for key, value in PINNED_REQUEST.items()),
                 "发布规格字段类型不符合固定合同。")
        for key in ("schema_version", "repo", "repo_id", "owner", "owner_id", "github_only",
                    "include_unified_installers", "include_runtime_installers"):
            _require(request[key] == PINNED_REQUEST[key], "发布规格不能扩大仓库或交付范围。")
        tag = request["tag"]
        _require(collector.VERSION_RE.fullmatch(request["version"]) is not None
                 and tag == f"v{request['version']}" and request["source_ref"] == f"release/{tag}",
                 "发布规格的版本、tag 或源码分支不一致。")
        _require(self.request_path == f".github/release-requests/{tag}.json"
                 and request["notes_path"] == f".github/release-requests/{tag}-notes.md"
                 and isinstance(self.workflow_path, str)
                 and re.fullmatch(r"\.github/workflows/[A-Za-z0-9][A-Za-z0-9._-]*\.yml", self.workflow_path) is not None,
                 "发布规格必须使用固定仓库内请求、说明及工作流路径。")
        _require(all(re.fullmatch(r"[0-9a-f]{40}", request[key]) is not None
                     for key in ("source_sha", "source_tree"))
                 and re.fullmatch(r"[0-9a-f]{64}", request["notes_sha256"]) is not None
                 and all(_positive_int(request[key]) for key in
                         ("ci_run_id", "ci_run_attempt", "evidence_run_id", "evidence_run_attempt")),
                 "发布规格缺少完整源码、说明或验收运行身份。")
        object.__setattr__(self, "pinned_request", MappingProxyType(request))

    @property
    def platform_scope(self) -> str:
        return self.pinned_request.get("platform_scope", "all")

    @property
    def post_workflows(self) -> Mapping[str, tuple[str, str]]:
        if self.platform_scope == "windows":
            return MappingProxyType({})
        return MappingProxyType({
            kind: (workflow, f"{title} {self.pinned_request['tag']}")
            for kind, (workflow, title) in _POST_WORKFLOW_DEFINITIONS.items()
        })


DEFAULT_RELEASE_SPEC = ReleaseSpec(PINNED_REQUEST, REQUEST_PATH, WORKFLOW_PATH)
# Preserve the named default consumed by the existing v0.5.2 recovery/tests.
POST_WORKFLOWS = DEFAULT_RELEASE_SPEC.post_workflows


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    result: dict = {}
    for key, value in pairs:
        _require(key not in result, "JSON 包含重复字段，已停止。")
        result[key] = value
    return result


def _json_bytes(value: dict) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def _parse_json(raw: bytes) -> dict:
    _require(0 < len(raw) <= MAX_STATE_BYTES, "发布记录大小不符合限制。")
    try:
        value = json.loads(raw, object_pairs_hook=_unique_object)
    except (ValueError, UnicodeDecodeError) as exc:
        raise ReleaseControlError("发布记录不是有效的 UTF-8 JSON。") from exc
    _require(isinstance(value, dict), "发布记录必须是 JSON 对象。")
    return value


def _safe_path(path: Path) -> Path:
    result = path.absolute()
    for item in (result, *result.parents):
        try:
            info = item.lstat()
        except FileNotFoundError:
            continue
        _require(not stat.S_ISLNK(info.st_mode), "发布路径不能包含符号链接。")
        _require(not (getattr(info, "st_file_attributes", 0) & 0x400), "发布路径不能包含重解析点。")
    return result


def _read_json(path: Path) -> dict:
    target = _safe_path(path)
    _require(target.is_file() and target.stat().st_size <= MAX_STATE_BYTES, "发布记录缺失或过大。")
    return _parse_json(target.read_bytes())


def _atomic_json(path: Path, value: dict) -> None:
    target = _safe_path(path)
    payload = _json_bytes(value)
    _require(len(payload) <= MAX_STATE_BYTES, "发布记录超过限制。")
    target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".release-state-", dir=target.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        _safe_path(target)
        os.replace(name, target)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def validate_request(value: dict, *, spec: ReleaseSpec = DEFAULT_RELEASE_SPEC) -> dict:
    _require(isinstance(value, dict) and set(value) == set(spec.pinned_request), "发布请求字段不符合固定合同。")
    for key, expected in spec.pinned_request.items():
        _require(type(value[key]) is type(expected) and value[key] == expected,
                 f"发布请求的 {key} 与已审核的固定版本不一致。")
    return dict(value)


def validate_context(env: Mapping[str, str], request: dict, run: dict,
                     *, spec: ReleaseSpec = DEFAULT_RELEASE_SPEC) -> dict:
    """Validate a machine principal separately from the human authorizing actor."""
    validate_request(request, spec=spec)
    expected_env = {
        "GITHUB_ACTIONS": "true", "GITHUB_SERVER_URL": "https://github.com",
        "GITHUB_API_URL": "https://api.github.com", "GITHUB_REPOSITORY": request["repo"],
        "GITHUB_REPOSITORY_ID": str(request["repo_id"]),
        "GITHUB_REPOSITORY_OWNER": request["owner"],
        "GITHUB_REPOSITORY_OWNER_ID": str(request["owner_id"]),
        "GITHUB_REF": "refs/heads/main", "GITHUB_ACTOR": request["owner"],
        "GITHUB_ACTOR_ID": str(request["owner_id"]), "GITHUB_TRIGGERING_ACTOR": request["owner"],
        "GITHUB_WORKFLOW_REF": f"{request['repo']}/{spec.workflow_path}@refs/heads/main",
    }
    _require(all(env.get(key) == value for key, value in expected_env.items()),
             "发布必须由 9holy 在本仓库已审核的 main 工作流中执行。")
    event = env.get("GITHUB_EVENT_NAME")
    sha = env.get("GITHUB_SHA", "")
    _require(event in {"push", "workflow_dispatch"}, "不支持当前工作流触发方式。")
    _require(re.fullmatch(r"[0-9a-f]{40}", sha) is not None and env.get("GITHUB_WORKFLOW_SHA") == sha,
             "控制工作流源码身份不一致。")
    try:
        run_id = int(env.get("GITHUB_RUN_ID", ""))
        attempt = int(env.get("GITHUB_RUN_ATTEMPT", ""))
    except ValueError as exc:
        raise ReleaseControlError("控制工作流运行编号无效。") from exc
    _require(run_id > 0 and attempt > 0, "控制工作流运行编号无效。")
    expected_run = {"id": run_id, "run_attempt": attempt, "path": spec.workflow_path,
                    "event": event, "head_branch": "main", "head_sha": sha}
    _require(all(type(run.get(key)) is type(value) and run.get(key) == value for key, value in expected_run.items()),
             "GitHub 返回的控制运行与本次执行不一致。")
    for key in ("repository", "head_repository"):
        repo = run.get(key)
        _require(isinstance(repo, dict) and repo.get("id") == request["repo_id"]
                 and repo.get("full_name") == request["repo"], "控制运行来自错误的仓库。")
    for key in ("actor", "triggering_actor"):
        actor = run.get(key)
        _require(isinstance(actor, dict) and actor.get("id") == request["owner_id"]
                 and actor.get("login") == request["owner"], "控制运行的授权发起人不一致。")
    return {"run_id": run_id, "attempt": attempt, "control_sha": sha,
            "workflow_path": spec.workflow_path, "actor_id": request["owner_id"]}


def validate_proof_run(run: dict, request: dict, kind: str) -> None:
    _require(kind in {"ci", "evidence"}, "未知源码验收类型。")
    path = readiness.CI_WORKFLOW_PATH if kind == "ci" else readiness.READINESS_WORKFLOW_PATH
    expected = {"id": request[f"{kind}_run_id"], "run_attempt": request[f"{kind}_run_attempt"],
                "path": path, "event": "push", "head_branch": request["source_ref"],
                "head_sha": request["source_sha"], "status": "completed", "conclusion": "success"}
    _require(all(type(run.get(key)) is type(value) and run.get(key) == value for key, value in expected.items()),
             "固定源码验收运行尚未成功，或其源码、分支、尝试次数不一致。")
    for key in ("repository", "head_repository"):
        repo = run.get(key)
        _require(isinstance(repo, dict) and repo.get("id") == request["repo_id"]
                 and repo.get("full_name") == request["repo"], "源码验收运行的仓库身份不一致。")


def _controller_identity(context: dict) -> dict:
    return {key: context[key] for key in ("run_id", "control_sha", "workflow_path", "actor_id")}


def new_journal(request: dict, request_digest: str, context: dict, now: int | None = None) -> dict:
    identity = f"https://github.com/{request['repo']}/actions/runs/{context['run_id']}:{request_digest}"
    return {"schema_version": 1, "kind": "github-actions-publication", "request": dict(request),
            "request_sha256": request_digest, "controller": _controller_identity(context),
            "journal_id": str(uuid.uuid5(uuid.NAMESPACE_URL, identity)), "created_at": now or int(time.time()),
            "effects": {}, "checks": {}, "tag_object_sha": None, "release_id": None,
            "bundle": None, "assets": {}, "post": {}}


def validate_journal(value: dict, request: dict, request_digest: str, context: dict,
                     *, spec: ReleaseSpec = DEFAULT_RELEASE_SPEC) -> dict:
    validate_request(request, spec=spec)
    prototype = new_journal(request, request_digest, context)
    _require(isinstance(value, dict) and set(value) == set(prototype), "发布记录字段不符合当前版本。")
    for key in ("schema_version", "kind", "request", "request_sha256", "controller", "journal_id"):
        _require(type(value.get(key)) is type(prototype[key]) and value.get(key) == prototype[key],
                 "发布记录不属于当前仓库、源码或原控制运行。")
    validate_request(value["request"], spec=spec)
    _require(_positive_int(value.get("created_at")), "发布记录时间无效。")
    for key in ("effects", "checks", "assets", "post"):
        _require(isinstance(value.get(key), dict) and len(value[key]) <= 64, "发布记录子项无效。")
    _require(value.get("release_id") is None or _positive_int(value["release_id"]), "发布记录 Release 编号无效。")
    _require(value.get("tag_object_sha") is None or re.fullmatch(r"[0-9a-f]{40}", str(value["tag_object_sha"])) is not None,
             "发布记录 tag 对象无效。")
    _require(value.get("bundle") is None or isinstance(value["bundle"], dict), "发布包记录无效。")
    for key, effect in value["effects"].items():
        _require(isinstance(key, str) and isinstance(effect, dict)
                 and set(effect) == {"status", "attempt", "intent", "result"}, "发布操作记录无效。")
        _require(effect.get("status") in EFFECT_STATUSES and _positive_int(effect.get("attempt"))
                 and effect["attempt"] <= context["attempt"] and isinstance(effect.get("intent"), dict)
                 and (effect.get("result") is None or isinstance(effect["result"], dict)), "发布操作状态无效。")
    for name, asset in value["assets"].items():
        _validate_asset_description(asset)
        _require(name == asset["name"], "发布记录的附件索引不一致。")
    return value


def validate_release_identity(release: dict, journal: dict, allow_public: bool = False, *,
                              expected_prerelease: bool | None = None, publication_effect: str = "publish") -> None:
    effect = journal.get("effects", {}).get("draft")
    _require(isinstance(effect, dict), "发现未归属当前发布记录的 Release。")
    intent = effect["intent"]
    _require(_positive_int(release.get("id")), "GitHub Release 编号无效。")
    _require(journal.get("release_id") in (None, release["id"]), "GitHub Release 编号已改变。")
    # target_commitish is unused by GitHub for an already-existing tag. The
    # annotated tag object, independently rechecked by the controller, owns
    # source identity; a mutable/default-branch display field cannot replace it.
    for key in ("tag_name", "name", "body"):
        _require(release.get(key) == intent.get(key), "GitHub Release 与固定 tag、说明或发布记录不一致。")
    prerelease = intent.get("prerelease") if expected_prerelease is None else expected_prerelease
    _require(type(prerelease) is bool and release.get("prerelease") is prerelease,
             "GitHub Release 的预发布状态与固定阶段不一致。")
    author = release.get("author")
    _require(isinstance(author, dict) and author.get("login") == BOT_LOGIN and author.get("id") == BOT_ID,
             "GitHub Release 创建者不是本发布工作流的机器身份。")
    if release.get("draft") is False:
        publish = journal.get("effects", {}).get(publication_effect)
        _require(allow_public and isinstance(publish, dict) and publish["intent"].get("release_id") == release["id"]
                 and bool(release.get("published_at")), "Release 已公开，但缺少本记录的已验收发布意图。")
    else:
        _require(release.get("draft") is True, "GitHub Release 草稿状态无效。")


def _validate_asset_description(expected: dict) -> None:
    _require(isinstance(expected, dict) and set(expected) == {"name", "size", "sha256"}, "附件意图字段无效。")
    name = expected.get("name")
    _require(isinstance(name, str) and Path(name).name == name and name not in {"", ".", ".."}
             and _positive_int(expected.get("size")) and expected["size"] <= collector.MAX_ARTIFACT_ZIP_BYTES
             and isinstance(expected.get("sha256"), str) and re.fullmatch(r"[0-9a-f]{64}", expected["sha256"]) is not None,
             "附件意图的名称、大小或 SHA-256 无效。")


def validate_asset(asset: dict, expected: dict) -> None:
    _validate_asset_description(expected)
    _require(isinstance(asset, dict) and asset.get("name") == expected.get("name") and asset.get("state") == "uploaded"
             and type(asset.get("size")) is int and asset.get("size") == expected.get("size")
             and asset.get("digest") == f"sha256:{expected.get('sha256')}",
             "已有发布附件的名称、大小、状态或 SHA-256 不一致；不会覆盖。")


def annotated_tag_intent(request: dict, journal: dict) -> dict:
    epoch = journal["created_at"]
    name = BOT_LOGIN
    email = f"{BOT_ID}+{BOT_LOGIN}@users.noreply.github.com"
    message = f"WebCodex {request['tag']}\n\nSource: {request['source_sha']}\nPublication: {journal['journal_id']}\n"
    content = (f"object {request['source_sha']}\ntype commit\ntag {request['tag']}\n"
               f"tagger {name} <{email}> {epoch} +0000\n\n{message}").encode("utf-8")
    sha = hashlib.sha1(b"tag " + str(len(content)).encode("ascii") + b"\0" + content).hexdigest()
    return {"sha": sha, "payload": {"tag": request["tag"], "message": message,
            "object": request["source_sha"], "type": "commit",
            "tagger": {"name": name, "email": email,
                       "date": dt.datetime.fromtimestamp(epoch, dt.timezone.utc).isoformat().replace("+00:00", "Z")}}}


class Controller:
    stages = STAGES

    def __init__(self, request_path: Path, source_root: Path, state_dir: Path,
                 bundle_dir: Path | None = None, timeout: float = 60,
                 env: Mapping[str, str] | None = None, client: collector.GitHubClient | None = None,
                 control_root: Path | None = None, *, spec: ReleaseSpec = DEFAULT_RELEASE_SPEC) -> None:
        self.spec = spec
        self.control_root = _safe_path(control_root or Path(__file__).resolve().parent.parent)
        self.source_root = _safe_path(source_root)
        self.state_dir = _safe_path(state_dir)
        self.bundle_dir = _safe_path(bundle_dir or state_dir.parent / "webcodex-release-bundle")
        self.request_path = _safe_path(request_path)
        _require(self.request_path == self.control_root / self.spec.request_path, "发布请求必须来自已审核控制源码的固定路径。")
        _require(self.source_root != self.control_root and not self.source_root.is_relative_to(self.control_root)
                 and not self.control_root.is_relative_to(self.source_root), "候选源码与控制源码必须使用独立目录。")
        for path in (self.state_dir, self.bundle_dir):
            _require(not path.is_relative_to(self.source_root) and not path.is_relative_to(self.control_root),
                     "发布记录和候选包必须保留在源码 checkout 外。")
        _require(self.state_dir != self.bundle_dir and not self.state_dir.is_relative_to(self.bundle_dir)
                 and not self.bundle_dir.is_relative_to(self.state_dir), "候选包与 JSON 发布记录必须分开保存。")
        raw = self.request_path.read_bytes()
        self.request = validate_request(_parse_json(raw), spec=self.spec)
        self.request_digest = hashlib.sha256(raw).hexdigest()
        notes = _safe_path(self.control_root / self.request["notes_path"])
        _require(notes.is_file() and notes.stat().st_size <= MAX_STATE_BYTES, "固定发布说明缺失或过大。")
        note_bytes = notes.read_bytes()
        _require(hashlib.sha256(note_bytes).hexdigest() == self.request["notes_sha256"], "固定发布说明 SHA-256 不一致。")
        self.notes = note_bytes.decode("utf-8")
        _require(0 < timeout <= 600, "API 超时时间必须在 0..600 秒内。")
        self.timeout = timeout
        self.env = os.environ if env is None else env
        self.client = client
        self.context: dict = {}
        self.state: dict = {}

    @property
    def journal_path(self) -> Path:
        return self.state_dir / "journal.json"

    def _authenticate(self) -> None:
        _require(self.env.get("GITHUB_ACTIONS") == "true", "此发布器仅在已审核的 GitHub Actions 中执行。")
        if self.client is None:
            token = self.env.get("GH_TOKEN") or self.env.get("GITHUB_TOKEN")
            _require(isinstance(token, str) and bool(token.strip()), "工作流未提供官方 GITHUB_TOKEN。")
            if self.env.get("GH_TOKEN") and self.env.get("GITHUB_TOKEN"):
                _require(self.env["GH_TOKEN"] == self.env["GITHUB_TOKEN"], "工作流存在冲突的凭据来源。")
            self.client = collector.GitHubClient(self.request["repo"], token, self.timeout)
        run_id = self.env.get("GITHUB_RUN_ID", "")
        attempt = self.env.get("GITHUB_RUN_ATTEMPT", "")
        _require(run_id.isdigit() and attempt.isdigit(), "控制工作流编号无效。")
        run = self.client.fetch_json(f"/actions/runs/{run_id}/attempts/{attempt}")
        self.context = validate_context(self.env, self.request, run, spec=self.spec)
        repo = self.client.fetch_json("")
        _require(repo.get("id") == self.request["repo_id"] and repo.get("full_name") == self.request["repo"]
                 and repo.get("owner", {}).get("id") == self.request["owner_id"]
                 and repo.get("default_branch") == "main", "GitHub 仓库身份或默认分支不一致。")
        installation = self.client._fetch_json_url("https://api.github.com/installation/repositories?per_page=100")
        repositories = installation.get("repositories")
        _require(type(installation.get("total_count")) is int and installation.get("total_count") == 1
                 and isinstance(repositories, list) and len(repositories) == 1
                 and isinstance(repositories[0], dict) and repositories[0].get("id") == self.request["repo_id"]
                 and repositories[0].get("full_name") == self.request["repo"],
                 "凭据必须是仅限当前仓库的 GitHub App installation token；不会改用个人凭据。")

    @contextlib.contextmanager
    def _lock(self):
        import fcntl  # This controller's reviewed runner is ubuntu-latest.

        _safe_path(self.state_dir)
        self.state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        target = _safe_path(self.state_dir / ".controller.lock")
        fd = os.open(target, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
        try:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise ReleaseControlError("已有发布控制进程正在操作此记录。") from exc
            yield
        finally:
            os.close(fd)

    def _save(self) -> None:
        validate_journal(self.state, self.request, self.request_digest, self.context, spec=self.spec)
        _atomic_json(self.journal_path, self.state)

    def _load(self) -> None:
        _require(self.journal_path.is_file(), "缺少本次发布记录，请先恢复原运行的 checkpoint。")
        self.state = validate_journal(_read_json(self.journal_path), self.request, self.request_digest, self.context, spec=self.spec)

    def _source(self) -> None:
        publication._require_exact_clean_root(self.source_root, self.request["source_sha"])
        _require(publication._git(self.source_root, "rev-parse", "HEAD^{tree}") == self.request["source_tree"],
                 "候选源码 tree 与已验收版本不一致。")
        publication._require_package_versions(self.source_root, self.request["version"], context="GitHub Actions release")
        publication._require_exact_clean_root(self.control_root, self.context["control_sha"])

    def _proofs(self) -> None:
        for kind in ("ci", "evidence"):
            run = self.client.fetch_json(f"/actions/runs/{self.request[f'{kind}_run_id']}/attempts/{self.request[f'{kind}_run_attempt']}")
            validate_proof_run(run, self.request, kind)

    def _source_branch(self) -> None:
        _require(readiness._branch_sha(self.client, self.request["source_ref"]) == self.request["source_sha"],
                 "创建 tag 前源码分支已变化；已停止。")

    def _prepare(self, key: str, intent: dict) -> dict:
        previous = self.state["effects"].get(key)
        if previous is not None:
            _require(previous["intent"] == intent, "恢复操作的固定意图已变化。")
            return previous
        effect = {"status": "prepared", "attempt": self.context["attempt"], "intent": intent, "result": None}
        self.state["effects"][key] = effect
        self._save()
        return effect

    def _may_execute(self, key: str) -> dict:
        effect = self.state["effects"].get(key)
        _require(isinstance(effect, dict) and effect["status"] == "prepared"
                 and effect["attempt"] == self.context["attempt"],
                 "此前操作结果不确定或已执行；只允许核对，不能重复提交。")
        return effect

    def _record_success(self, key: str, result: dict | None = None) -> None:
        self.state["effects"][key]["status"] = "succeeded"
        self.state["effects"][key]["result"] = result or {}
        self._save()

    def _mutate(self, key: str, method: str, suffix: str, payload: dict | None = None,
                *, asset: Path | None = None, expected_status: int = 201) -> dict:
        effect = self._may_execute(key)
        effect["status"] = "started"
        self._save()  # The workflow has already retained the prepared intent remotely.
        url = self.client.api_url(suffix)
        if asset is not None:
            url = f"https://uploads.github.com/repos/{self.request['repo']}{suffix}"
        request = self.client._request(url)
        request.method = method
        with contextlib.ExitStack() as stack:
            if asset is None:
                request.data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
                request.add_header("Content-Type", "application/json")
            else:
                request.data = stack.enter_context(asset.open("rb"))
                request.add_header("Content-Type", "application/octet-stream")
                request.add_header("Content-Length", str(asset.stat().st_size))
            try:
                with self.client.opener.open(request, timeout=self.timeout) as response:
                    status_code = response.status
                    raw = response.read(collector.MAX_JSON_BYTES + 1)
            except urllib.error.HTTPError as exc:
                effect["status"] = "rejected" if 400 <= exc.code < 500 else "unknown"
                self._save()
                raise ReleaseControlError(f"GitHub 操作未确认成功（HTTP {exc.code}）；保留记录，禁止盲目重试。") from exc
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                effect["status"] = "unknown"
                self._save()
                raise ReleaseControlError("GitHub 连接中断，操作结果未知；保留记录并只读核对。") from exc
        if status_code != expected_status or len(raw) > collector.MAX_JSON_BYTES:
            effect["status"] = "unknown"
            self._save()
            raise ReleaseControlError("GitHub 返回了未预期的操作结果；不会再次提交。")
        try:
            value = json.loads(raw, object_pairs_hook=_unique_object)
        except (ValueError, UnicodeDecodeError) as exc:
            effect["status"] = "unknown"
            self._save()
            raise ReleaseControlError("GitHub 操作响应无法核对；不会再次提交。") from exc
        _require(isinstance(value, dict), "GitHub 操作响应格式异常，需只读核对。")
        return value

    def run(self, stage: str, wait_secs: int = 0) -> int:
        _require(stage in self.stages and 0 <= wait_secs <= 60, "发布阶段或等待时间无效。")
        self._authenticate()
        with self._lock():
            if stage == "restore-state":
                return self.restore_state()
            if stage == "preflight" and not self.journal_path.exists():
                _require(self.context["attempt"] == 1, "重试运行缺少已恢复的发布记录；已停止。")
                self.state = new_journal(self.request, self.request_digest, self.context)
                self._save()
            else:
                self._load()
            self._source()
            method = getattr(self, stage.replace("-", "_"))
            return method(wait_secs) if stage.startswith("status-") else method()

    def restore_state(self) -> int:
        if self.journal_path.exists():
            self._load()
            self._validate_child_states()
            print("已核对当前运行的本地发布记录。")
            return 0
        _require(not any((self.state_dir / name).exists() for name in STATE_FILES),
                 "发现不完整本地发布记录，不能覆盖恢复。")
        if self.context["attempt"] == 1:
            print("首次控制运行，将在预检后建立发布记录。")
            return 0
        run_id = self.context["run_id"]
        prefix = f"release-control-{self.request['tag']}-{run_id}-"
        pattern = re.compile(re.escape(prefix) + r"([1-9][0-9]*)-([0-9]{2})-([a-z0-9-]+)$")
        candidates: list[tuple[int, int, dict]] = []
        for page in range(1, 11):
            result = self.client.fetch_json(f"/actions/runs/{run_id}/artifacts?per_page=100&page={page}")
            items = result.get("artifacts")
            _require(isinstance(items, list) and len(items) <= 100
                     and type(result.get("total_count")) is int and result["total_count"] <= 1000,
                     "控制运行的 checkpoint 列表无效或超出限制。")
            for item in items:
                _require(isinstance(item, dict), "checkpoint 元数据无效。")
                name = item.get("name", "")
                if not isinstance(name, str) or not name.startswith(prefix):
                    continue
                match = pattern.fullmatch(name)
                _require(match is not None, "checkpoint 名称与本控制运行合同不一致。")
                attempt, phase = int(match[1]), int(match[2])
                _require(1 <= phase <= 99 and attempt < self.context["attempt"],
                         "checkpoint 来自错误的控制运行尝试。")
                candidates.append((attempt, phase, item))
            if len(items) < 100:
                break
        else:
            raise ReleaseControlError("checkpoint 列表未在限制内结束。")
        _require(bool(candidates), "原控制运行没有可恢复 checkpoint；不会新建发布状态或重派。")
        latest = max((attempt, phase) for attempt, phase, _item in candidates)
        matches = [item for attempt, phase, item in candidates if (attempt, phase) == latest]
        _require(len(matches) == 1, "最新 checkpoint 不唯一；已停止恢复。")
        item = matches[0]
        _require(item.get("expired") is False and _positive_int(item.get("id"))
                 and type(item.get("size_in_bytes")) is int and 0 < item["size_in_bytes"] <= MAX_CHECKPOINT_BYTES,
                 "最新 checkpoint 已过期或大小异常；不能退回较旧状态。")
        origin = item.get("workflow_run")
        _require(isinstance(origin, dict) and origin.get("id") == run_id
                 and origin.get("repository_id") == self.request["repo_id"]
                 and origin.get("head_repository_id") == self.request["repo_id"]
                 and origin.get("head_sha") == self.context["control_sha"]
                 and origin.get("head_branch") == "main", "checkpoint 来源运行不一致。")
        previous_run = self.client.fetch_json(f"/actions/runs/{run_id}/attempts/{latest[0]}")
        previous_env = dict(self.env)
        previous_env["GITHUB_RUN_ATTEMPT"] = str(latest[0])
        validate_context(previous_env, self.request, previous_run, spec=self.spec)
        _require(previous_run.get("status") == "completed", "旧控制运行尚未结束，不能同时恢复。")
        digest = collector._artifact_digest(item.get("digest"))
        with tempfile.TemporaryDirectory(prefix="webcodex-checkpoint-", dir=self.state_dir.parent) as tmp:
            archive = Path(tmp) / "checkpoint.zip"
            self._download_checkpoint(item, digest, archive)
            restored: dict[str, dict] = {}
            with zipfile.ZipFile(archive) as handle:
                members = handle.infolist()
                _require(1 <= len(members) <= len(STATE_FILES), "checkpoint 只能包含受限 JSON 记录。")
                for member in members:
                    mode = member.external_attr >> 16
                    _require(member.filename in STATE_FILES and member.filename not in restored
                             and not member.is_dir() and not member.flag_bits & 1
                             and (stat.S_IFMT(mode) in {0, stat.S_IFREG})
                             and 0 < member.file_size <= MAX_STATE_BYTES, "checkpoint 包含不安全或重复成员。")
                    restored[member.filename] = _parse_json(handle.read(member))
            _require("journal.json" in restored, "checkpoint 缺少根发布记录。")
            self.state = validate_journal(restored["journal.json"], self.request, self.request_digest, self.context, spec=self.spec)
            # Check the existing helper schemas in a private staging directory
            # before exposing any restored file in the live state directory.
            for name, value in restored.items():
                _atomic_json(Path(tmp) / name, value)
            self._validate_child_states(Path(tmp))
            for name, value in restored.items():
                if name != "journal.json":
                    _atomic_json(self.state_dir / name, value)
            self._save()
        print(f"已恢复原运行 attempt {latest[0]} 的 checkpoint {latest[1]:02d}；未知操作只核对。")
        return 0

    def _download_checkpoint(self, item: dict, digest: str, destination: Path) -> None:
        # A JSON checkpoint has a much smaller limit than a multi-platform bundle.
        # Enforce that bound while reading, before writing anything to disk.
        request = self.client._request(self.client.api_url(f"/actions/artifacts/{item['id']}/zip"))
        try:
            with self.client.opener.open(request, timeout=self.timeout) as response:
                length = collector._content_length(response.headers)
                _require(length is None or length <= MAX_CHECKPOINT_BYTES, "checkpoint 下载超过 2 MiB 限制。")
                raw = response.read(MAX_CHECKPOINT_BYTES + 1)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as exc:
            raise ReleaseControlError("无法只读下载原 checkpoint；不会退回旧记录或重新开始发布。") from exc
        _require(0 < len(raw) <= MAX_CHECKPOINT_BYTES and len(raw) == item["size_in_bytes"]
                 and hashlib.sha256(raw).hexdigest() == digest, "checkpoint 下载大小或 SHA-256 与 GitHub 记录不一致。")
        destination.write_bytes(raw)

    def _child_state(self, kind: str, root: Path | None = None) -> dict:
        module = readiness if kind == "readiness" else publication
        path = (root or self.state_dir) / f"{kind}.json"
        value = module._load_state(path)
        _require(value.get("repo") == self.request["repo"] and value.get("source_sha") == self.request["source_sha"],
                 "子运行记录与固定仓库或源码不一致。")
        effect = self.state["effects"].get(kind)
        expected_id = self._new_workflow_state(kind)["request_id"]
        _require(isinstance(effect, dict) and effect["intent"] == {"request_id": expected_id}
                 and value.get("request_id") == expected_id,
                 "子运行记录与发布意图不一致。")
        if kind == "readiness":
            _require(value.get("schema_version") == readiness.STATE_SCHEMA_VERSION
                     and value.get("source_ref") == self.request["source_ref"]
                     and all(value.get(key) == self.request[key] for key in
                             ("ci_run_id", "ci_run_attempt", "evidence_run_id", "evidence_run_attempt")),
                     "readiness 的固定源码验收记录不一致。")
        else:
            _require(value.get("schema_version") == publication.BUILD_STATE_SCHEMA_VERSION
                     and value.get("tag") == self.request["tag"]
                     and value.get("include_unified_installers") is True
                     and value.get("include_runtime_installers") is False, "正式构建的 tag 或安装包选择不一致。")
            _require(value.get("platform_scope", "all") == self.spec.platform_scope,
                     "正式构建的平台范围与固定发布规格不一致。")
        return value

    def _validate_child_states(self, root: Path | None = None) -> None:
        for kind in ("readiness", "build"):
            exists = ((root or self.state_dir) / f"{kind}.json").exists()
            _require(exists == (kind in self.state["effects"]), "checkpoint 的子运行记录不完整。")
            if exists:
                self._child_state(kind, root)

    def _find_release(self) -> dict | None:
        found: list[dict] = []
        for page in range(1, publication.MAX_DRAFT_RELEASE_PAGES + 1):
            rows = publication._github_json_array(self.client, f"/releases?per_page=100&page={page}")
            found.extend(row for row in rows if row.get("tag_name") == self.request["tag"])
            _require(len(found) <= 1, "同一 tag 出现多个 Release；已停止。")
            if len(rows) < 100:
                return found[0] if found else None
        raise ReleaseControlError("Release 列表超过受限扫描范围。")

    def _tag_ref(self) -> dict | None:
        tag = urllib.parse.quote(self.request["tag"], safe="")
        return publication._github_optional_json(self.client, f"/git/ref/tags/{tag}")

    def _verify_tag_object(self, value: dict) -> None:
        expected = annotated_tag_intent(self.request, self.state)
        body = expected["payload"]
        _require(value.get("sha") == expected["sha"] and value.get("tag") == body["tag"]
                 and value.get("message") == body["message"], "annotated tag 对象身份或说明不一致。")
        target = value.get("object")
        _require(isinstance(target, dict) and target.get("type") == "commit"
                 and target.get("sha") == self.request["source_sha"], "annotated tag 未直接指向固定源码。")
        tagger = value.get("tagger")
        _require(isinstance(tagger, dict) and tagger.get("name") == body["tagger"]["name"]
                 and tagger.get("email") == body["tagger"]["email"], "annotated tag 的机器签发身份不一致。")
        try:
            actual_date = dt.datetime.fromisoformat(str(tagger.get("date", "")).replace("Z", "+00:00"))
        except ValueError as exc:
            raise ReleaseControlError("annotated tag 时间无效。") from exc
        _require(actual_date.timestamp() == self.state["created_at"], "annotated tag 时间与固定发布意图不一致。")

    def _verify_tag(self, ref: dict | None = None) -> None:
        _require("tag-ref" in self.state["effects"] and "tag-object" in self.state["effects"],
                 "已有 tag 不属于当前发布记录；不会移动或认领。")
        expected = annotated_tag_intent(self.request, self.state)
        _require(self.state["tag_object_sha"] == expected["sha"], "本地 tag 对象记录已改变。")
        value = ref if ref is not None else self._tag_ref()
        _require(isinstance(value, dict) and value.get("ref") == f"refs/tags/{self.request['tag']}"
                 and value.get("object", {}).get("type") == "tag"
                 and value.get("object", {}).get("sha") == expected["sha"],
                 "远端 tag 缺失、不是 annotated tag 或已改变。")
        self._verify_tag_object(self.client.fetch_json(f"/git/tags/{expected['sha']}"))

    def preflight(self) -> int:
        self._proofs()
        ref = self._tag_ref()
        if ref is None:
            self._source_branch()
            _require(not publication._git(self.source_root, "tag", "--list", self.request["tag"]),
                     "本地出现未归属的候选 tag；已停止。")
        else:
            self._verify_tag(ref)
        release = self._find_release()
        if release is not None:
            self._verify_tag(ref)
            self._validate_release_identity(release, allow_public=True)
        self.state["checks"]["preflight"] = {"principal": "github-actions-installation", "github_only": True}
        self._save()
        print("机器身份、固定源码、版本及两份成功源码验收已核对；仅发布 GitHub。")
        return 0

    def _new_workflow_state(self, kind: str) -> dict:
        request_id = ("rr_" if kind == "readiness" else "rb_") + hashlib.sha256(
            f"{self.state['journal_id']}:{kind}".encode("ascii")).hexdigest()[:24]
        base = {"repo": self.request["repo"], "source_sha": self.request["source_sha"],
                "request_id": request_id, "dispatch_state": "prepared", "created_at": self.state["created_at"],
                "run_id": None, "run_head_sha": None, "source_matches": None, "run_url": None,
                "run_status": None, "run_conclusion": None, "last_observed_at": None}
        if kind == "readiness":
            base.update(schema_version=readiness.STATE_SCHEMA_VERSION, kind="release-readiness",
                        source_ref=self.request["source_ref"], workflow_file=readiness.READINESS_WORKFLOW_FILE,
                        workflow_path=readiness.READINESS_WORKFLOW_PATH,
                        run_name=readiness._run_name(request_id, self.request["source_sha"]))
            for proof in ("ci", "evidence"):
                run_id = self.request[f"{proof}_run_id"]
                base.update({f"{proof}_run_id": run_id, f"{proof}_run_attempt": self.request[f"{proof}_run_attempt"],
                             f"{proof}_run_url": f"https://github.com/{self.request['repo']}/actions/runs/{run_id}",
                             f"{proof}_run_head_sha": self.request["source_sha"], f"{proof}_run_conclusion": "success"})
        else:
            base.update(schema_version=publication.BUILD_STATE_SCHEMA_VERSION, kind="release-build",
                        tag=self.request["tag"], workflow_file=publication.BUILD_WORKFLOW_FILE,
                        workflow_path=publication.BUILD_WORKFLOW_PATH, include_unified_installers=True,
                        include_runtime_installers=False,
                        run_name=publication._build_run_name(self.request["tag"], request_id))
            base.update(release_scope.metadata(self.spec.platform_scope))
        return base

    def _prepare_workflow(self, kind: str) -> int:
        _require(bool(self.state["checks"].get("preflight")), "尚未通过发布预检。")
        if kind in self.state["effects"]:
            self._child_state(kind)
            return 0
        if kind == "readiness":
            self._source_branch()
            self._proofs()
        else:
            _require(self.status_readiness(0) == 0, "readiness 尚未成功，不能准备正式构建。")
            self._verify_tag()
        child = self._new_workflow_state(kind)
        path = self.state_dir / f"{kind}.json"
        _require(not path.exists(), "存在未归属的子运行记录；不会覆盖。")
        self._prepare(kind, {"request_id": child["request_id"]})
        (readiness if kind == "readiness" else publication)._write_state(path, child)
        self._child_state(kind)
        print(f"已冻结 {kind} 请求；须在 dispatch 前保留 checkpoint。")
        return 0

    def prepare_readiness(self) -> int:
        return self._prepare_workflow("readiness")

    def prepare_build(self) -> int:
        return self._prepare_workflow("build")

    def _workflow_snapshot(self, kind: str, child: dict) -> dict | None:
        if kind == "readiness":
            run = readiness._get_bound_run(self.client, child)
        else:
            run = publication._get_bound_build_run(self.client, child)
        if run is None:
            return None
        expected_ref = self.request["source_ref"] if kind == "readiness" else self.request["tag"]
        actual_attempt = run.get("run_attempt")
        prior_effect = self.state["effects"][kind].get("result") or {}
        prior_check = self.state["checks"].get(kind) or {}
        previous_attempt = max(prior_effect.get("run_attempt", 0), prior_check.get("run_attempt", 0))
        _require(run.get("head_sha") == self.request["source_sha"] and run.get("head_branch") == expected_ref
                 and _positive_int(actual_attempt) and actual_attempt >= previous_attempt,
                 "子运行的源码、ref 或尝试次数已改变。")
        if actual_attempt > 1:
            actor = run.get("triggering_actor")
            _require(isinstance(actor, dict) and actor.get("login") == self.request["owner"]
                     and actor.get("id") == self.request["owner_id"], "只接受仓库所有者主动重跑的同一构建运行。")
        for key in ("repository", "head_repository"):
            repo = run.get(key)
            _require(isinstance(repo, dict) and repo.get("id") == self.request["repo_id"]
                     and repo.get("full_name") == self.request["repo"], "子运行的仓库身份不一致。")
        (readiness if kind == "readiness" else publication)._write_state(self.state_dir / f"{kind}.json", child)
        self._record_success(kind, {"run_id": run["id"], "run_attempt": actual_attempt})
        return run

    def _dispatch_workflow(self, kind: str) -> int:
        child = self._child_state(kind)
        if self._workflow_snapshot(kind, child) is not None:
            print(f"已核对原 {kind} 运行；没有再次 dispatch。")
            return 0
        effect = self._may_execute(kind)
        if kind == "readiness":
            self._source_branch()
            self._proofs()
        else:
            self._verify_tag()
            _require(self.status_readiness(0) == 0, "readiness 尚未成功。")
        effect["status"] = "started"
        self._save()
        child["dispatch_state"] = "unknown"
        module = readiness if kind == "readiness" else publication
        module._write_state(self.state_dir / f"{kind}.json", child)
        try:
            if kind == "readiness":
                readiness._post_dispatch(self.client, self.request["source_ref"], self.request["source_sha"],
                                         child["request_id"], self.request["ci_run_id"], self.request["ci_run_attempt"],
                                         self.request["evidence_run_id"], self.request["evidence_run_attempt"])
            else:
                publication._post_build_dispatch(self.client, self.request["tag"], child["request_id"],
                                                 include_unified_installers=True, include_runtime_installers=False,
                                                 **release_scope.metadata(self.spec.platform_scope))
        except (readiness.DispatchRejected, publication.DispatchRejected) as exc:
            effect["status"] = "rejected"
            child["dispatch_state"] = "rejected"
            self._save()
            module._write_state(self.state_dir / f"{kind}.json", child)
            raise ReleaseControlError("GitHub 拒绝了工作流 dispatch；保留记录，不自动重派。") from exc
        except (readiness.DispatchOutcomeUnknown, publication.DispatchOutcomeUnknown) as exc:
            effect["status"] = "unknown"
            self._save()
            raise ReleaseControlError("工作流 dispatch 结果未知；后续仅核对同一请求。") from exc
        child["dispatch_state"] = "dispatched"
        module._write_state(self.state_dir / f"{kind}.json", child)
        self._record_success(kind)
        print(f"{kind} dispatch 已接收，仍须等待其真正完成并成功。")
        return 0

    def dispatch_readiness(self) -> int:
        return self._dispatch_workflow("readiness")

    def dispatch_build(self) -> int:
        return self._dispatch_workflow("build")

    def _status_workflow(self, kind: str, wait_secs: int) -> int:
        child = self._child_state(kind)
        deadline = time.monotonic() + wait_secs
        while True:
            run = self._workflow_snapshot(kind, child)
            if run is None:
                _require(self.state["effects"][kind]["status"] == "succeeded",
                         "未找到此前不确定 dispatch 的唯一运行；不会重新 dispatch。")
            elif child["run_status"] == "completed":
                passed = child["source_matches"] is True and child["run_conclusion"] == "success"
                self.state["checks"][kind] = {"run_id": child["run_id"], "run_attempt": run["run_attempt"], "success": passed}
                self._save()
                print(f"{kind} 运行 {child['run_id']}：{'成功' if passed else '失败，已停止'}。")
                return 0 if passed else 1
            if time.monotonic() >= deadline:
                print(f"{kind} 原运行仍在排队或执行，保留同一身份继续观察。")
                return 2
            time.sleep(min(10, max(0.1, deadline - time.monotonic())))

    def status_readiness(self, wait_secs: int = 0) -> int:
        return self._status_workflow("readiness", wait_secs)

    def status_build(self, wait_secs: int = 0) -> int:
        return self._status_workflow("build", wait_secs)

    def prepare_tag(self) -> int:
        if "tag-ref" in self.state["effects"]:
            expected = annotated_tag_intent(self.request, self.state)
            _require(self.state["tag_object_sha"] == expected["sha"], "固定 tag 对象记录不一致。")
            return 0
        _require(self.status_readiness(0) == 0, "readiness 尚未成功，不能创建 tag。")
        self._source_branch()
        _require(self._tag_ref() is None and self._find_release() is None, "tag 或 Release 已被占用；不会移动或覆盖。")
        intent = annotated_tag_intent(self.request, self.state)
        self.state["tag_object_sha"] = intent["sha"]
        self._prepare("tag-object", intent)
        self._prepare("tag-ref", {"ref": f"refs/tags/{self.request['tag']}", "sha": intent["sha"]})
        print("已冻结 annotated tag 内容与对象 SHA；须先保留 checkpoint。")
        return 0

    def create_tag(self) -> int:
        ref = self._tag_ref()
        if ref is not None:
            self._verify_tag(ref)
            self._record_success("tag-object", {"sha": self.state["tag_object_sha"]})
            self._record_success("tag-ref", {"sha": self.state["tag_object_sha"]})
        else:
            self._may_execute("tag-ref")
            _require(self.status_readiness(0) == 0, "readiness 尚未成功。")
            self._source_branch()
            expected = annotated_tag_intent(self.request, self.state)
            _require(self.state["effects"]["tag-object"]["intent"] == expected
                     and self.state["tag_object_sha"] == expected["sha"]
                     and self.state["effects"]["tag-ref"]["intent"] == {
                         "ref": f"refs/tags/{self.request['tag']}", "sha": expected["sha"]}, "tag 创建意图发生变化。")
            obj = publication._github_optional_json(self.client, f"/git/tags/{expected['sha']}")
            if obj is None:
                obj = self._mutate("tag-object", "POST", "/git/tags", expected["payload"])
            self._verify_tag_object(obj)
            self._record_success("tag-object", {"sha": expected["sha"]})
            self._mutate("tag-ref", "POST", "/git/refs", self.state["effects"]["tag-ref"]["intent"])
            self._verify_tag()
            self._record_success("tag-ref", {"sha": expected["sha"]})
        self.state["checks"]["tag"] = True
        self._save()
        print(f"已核对 immutable annotated tag {self.request['tag']} → {self.request['source_sha']}。")
        return 0

    def _check_bundle_summary(self, summary: dict) -> None:
        child = self._child_state("build")
        try:
            release_scope.require_metadata(summary, self.spec.platform_scope)
        except ValueError as exc:
            raise ReleaseControlError("候选包的平台范围与固定发布规格不一致。") from exc
        _require(summary.get("build_kind") == "release" and summary.get("version") == self.request["version"]
                 and summary.get("source_sha") == self.request["source_sha"]
                 and summary.get("tag") == self.request["tag"]
                 and summary.get("workflow_run_id") == child["run_id"],
                 "候选包不是同一正式构建运行、tag 与固定源码。")

    def _bundle_summary(self) -> dict:
        _safe_path(self.bundle_dir)
        summary = publication.verify_bundle(self.bundle_dir, self.request["repo"],
                                            require_unified_installers=True, require_runtime_installers=False,
                                            **release_scope.metadata(self.spec.platform_scope))
        self._check_bundle_summary(summary)
        _require("installer_manifest_v2" not in summary, "本次请求不包含额外 Runtime 安装包。")
        recorded = self.state.get("bundle")
        _require(isinstance(recorded, dict)
                 and recorded.get("platform_scope", "all") == self.spec.platform_scope,
                 "保留候选包的平台范围记录不一致。")
        _require(isinstance(recorded, dict) and recorded.get("workflow_run_id") == summary["workflow_run_id"]
                 and recorded.get("source_sha") == summary["source_sha"] and recorded.get("tag") == summary["tag"]
                 and recorded.get("sha256sums_sha256") == collector.sha256_file(self.bundle_dir / "SHA256SUMS"),
                 "保留候选包与已记录的 bundle 不一致。")
        return summary

    def collect(self) -> int:
        self._verify_tag()
        _require(self.status_build(0) == 0, "正式构建尚未成功，不能收集发布包。")
        child = self._child_state("build")
        recorded = self.state.get("bundle")
        if self.bundle_dir.exists():
            _require(isinstance(recorded, dict), "发现未记录的已有候选目录；不会删除或替换。")
            self._bundle_summary()
            print("已有候选包已重新验收，继续使用同一运行的字节。")
            return 0
        # Checkpoints deliberately contain JSON only. A new runner fetches the
        # already-bound immutable artifact again; this never dispatches a build.
        summary = collector.collect_bundle(repo=self.request["repo"], run_id=child["run_id"],
                                           expected_source_sha=self.request["source_sha"], expected_tag=self.request["tag"],
                                           output_dir=self.bundle_dir, timeout=self.timeout, token=self.client.token,
                                           require_unified_installers=True, require_runtime_installers=False,
                                           **release_scope.metadata(self.spec.platform_scope))
        self._check_bundle_summary(summary)
        _require("installer_manifest_v2" not in summary, "本次请求不包含额外 Runtime 安装包。")
        receipt = {key: summary[key] for key in ("workflow_run_id", "source_sha", "tag", "bundle_artifact_id", "bundle_artifact_sha256")}
        receipt["sha256sums_sha256"] = collector.sha256_file(self.bundle_dir / "SHA256SUMS")
        receipt.update(release_scope.metadata(self.spec.platform_scope))
        _require(recorded is None or recorded == receipt, "重新下载的 artifact 身份或内容已改变；不会替换记录。")
        self.state["bundle"] = receipt
        self._save()
        print("已收集并验收同一正式运行的完整安装包。")
        return 0

    def _draft_intent(self) -> dict:
        marker = (f"<!-- webcodex-release-control:{self.state['journal_id']};"
                  f"source={self.request['source_sha']};request={self.request_digest} -->")
        return {"tag_name": self.request["tag"], "name": f"WebCodex {self.request['tag']}",
                "body": self.notes.rstrip() + "\n\n" + marker + "\n",
                "draft": True, "prerelease": False, "generate_release_notes": False}

    def prepare_draft(self) -> int:
        self._verify_tag()
        self._bundle_summary()
        self._prepare("draft", self._draft_intent())
        print("已冻结草稿身份、固定发布说明和唯一归属标记。")
        return 0

    def _owned_release(self, *, allow_public: bool = True) -> dict:
        self._verify_tag()
        release = self._find_release()
        _require(release is not None, "当前发布记录绑定的 Release 不存在；不会重建。")
        self._validate_release_identity(release, allow_public=allow_public)
        return release

    def _validate_release_identity(self, release: dict, *, allow_public: bool = True) -> None:
        validate_release_identity(release, self.state, allow_public=allow_public)

    def create_draft(self) -> int:
        self._verify_tag()
        _require(self.state["effects"].get("draft", {}).get("intent") == self._draft_intent(),
                 "草稿创建意图尚未冻结或已改变。")
        release = self._find_release()
        if release is None:
            self._bundle_summary()
            release = self._mutate("draft", "POST", "/releases", self._draft_intent())
        self._validate_release_identity(release, allow_public=True)
        self.state["release_id"] = release["id"]
        self._record_success("draft", {"release_id": release["id"]})
        print(f"已核对本次发布的 Release {release['id']}；未重复创建。")
        return 0

    def _expected_assets(self) -> dict[str, dict]:
        summary = self._bundle_summary()
        names = publication.expected_draft_asset_names(summary, **release_scope.metadata(self.spec.platform_scope))
        result: dict[str, dict] = {}
        _require(1 <= len(names) <= 33, "发布附件白名单数量无效。")
        for name in sorted(names):
            _require(Path(name).name == name and name not in {".", ".."}, "发布附件名称不安全。")
            path = _safe_path(self.bundle_dir / name)
            _require(path.is_file() and 0 < path.stat().st_size <= collector.MAX_ARTIFACT_ZIP_BYTES,
                     "发布附件缺失或大小异常。")
            result[name] = {"name": name, "size": path.stat().st_size, "sha256": collector.sha256_file(path)}
        return result

    def prepare_upload(self) -> int:
        release = self._owned_release()
        expected = self._expected_assets()
        _require(not self.state["assets"] or self.state["assets"] == expected,
                 "安装包白名单或字节与已有上传意图不一致。")
        if release["draft"] is False:
            _require(bool(self.state["assets"]), "公开 Release 缺少原资产记录。")
            self._verify_primary_assets(release, complete=True)
            return 0
        self.state["assets"] = expected
        for name, item in expected.items():
            self._prepare(f"asset:{name}", {**item, "release_id": self.state["release_id"]})
        self._save()
        print(f"已冻结 {len(expected)} 个允许公开的附件及其大小、SHA-256；须先保留 checkpoint。")
        return 0

    def _verify_primary_assets(self, release: dict, *, complete: bool, expected_prerelease: bool = False) -> dict[str, dict]:
        assets = release.get("assets")
        _require(isinstance(assets, list) and len(assets) <= 64, "GitHub 附件列表不完整或过大。")
        by_name: dict[str, dict] = {}
        for item in assets:
            _require(isinstance(item, dict) and isinstance(item.get("name"), str) and item["name"] not in by_name,
                     "GitHub 附件列表包含无效或重复名称。")
            by_name[item["name"]] = item
        expected = self.state["assets"]
        _require(bool(expected), "缺少冻结的上传白名单。")
        if release.get("draft") is False:
            # Existing post-publication adapters own their extra assets. Reuse
            # their canonical names, allowing an in-progress supplemental pair.
            # Only the independent post gate may declare that adapter complete.
            post_names = set()
            if self.spec.platform_scope == "all":
                post_names = {public_verifier.SERVER_IMAGE_METADATA, *public_verifier.SERVER_DEPLOYMENT_ASSETS}
                for platform in public_verifier.supplemental_desktop_platforms_for_version(self.request["version"]):
                    post_names.add(public_verifier.canonical_desktop_name(self.request["version"], platform))
                    post_names.add(public_verifier.canonical_desktop_checksum_name(self.request["version"], platform))
            _require(set(by_name) <= set(expected) | post_names, "公开 Release 含有未允许的额外附件。")
            primary_release = {**release, "assets": [item for name, item in by_name.items() if name in expected]}
            public_verifier.validate_github_assets(primary_release, self.request["version"], unified_installers=True,
                                                  require_runtime_installers=False, expected_prerelease=expected_prerelease,
                                                  **release_scope.metadata(self.spec.platform_scope))
        else:
            _require(set(by_name) <= set(expected), "草稿包含未允许公开的内部文件或额外附件。")
        if complete:
            _require(set(expected) <= set(by_name), "GitHub Release 缺少冻结白名单中的附件。")
        for name in set(expected) & set(by_name):
            validate_asset(by_name[name], expected[name])
        return by_name

    def upload_assets(self) -> int:
        release = self._owned_release()
        expected = self._expected_assets()
        _require(self.state["assets"] == expected, "未保留匹配的上传意图；不能上传附件。")
        existing = self._verify_primary_assets(release, complete=release["draft"] is False)
        if release["draft"] is False:
            print("Release 已公开：仅核对原附件，不修改任何已发布字节。")
            return 0
        for name in sorted(expected):
            key = f"asset:{name}"
            _require(self.state["effects"].get(key, {}).get("intent") == {**expected[name], "release_id": release["id"]},
                     "附件上传意图与固定 Release 不一致。")
            if name in existing:
                self._record_success(key, {"asset_id": existing[name].get("id")})
                continue
            self._may_execute(key)
            # Re-read the exact draft immediately before every upload. Publishing
            # or adding a conflicting asset concurrently closes the write path.
            current = self._owned_release(allow_public=False)
            current_assets = self._verify_primary_assets(current, complete=False)
            if name in current_assets:
                self._record_success(key, {"asset_id": current_assets[name].get("id")})
                continue
            path = self.bundle_dir / name
            _require(path.stat().st_size == expected[name]["size"] and collector.sha256_file(path) == expected[name]["sha256"],
                     "本地附件在上传前发生变化。")
            suffix = f"/releases/{release['id']}/assets?{urllib.parse.urlencode({'name': name})}"
            uploaded = self._mutate(key, "POST", suffix, asset=path)
            validate_asset(uploaded, expected[name])
            self._record_success(key, {"asset_id": uploaded.get("id")})
            print(f"已核对附件 {name}。")
        self._verify_primary_assets(self._owned_release(allow_public=False), complete=True)
        return 0

    def verify_draft(self) -> int:
        release = self._owned_release()
        _require(self.state["assets"] == self._expected_assets(), "草稿的保留字节与上传意图不一致。")
        self._verify_primary_assets(release, complete=True)
        if release["draft"] is False:
            # A rerun executes every stage. Ownership + the persisted publication
            # intent allows read-only verification; never turn a release draft.
            print("原 Release 已公开；已只读核对同一发布意图和全部 primary 附件。")
            return 0
        result = publication.verify_draft_assets(repo=self.request["repo"], bundle_dir=self.bundle_dir,
                                                 timeout=self.timeout, require_unified_installers=True,
                                                 require_runtime_installers=False,
                                                 **release_scope.metadata(self.spec.platform_scope))
        _require(result.get("release_id") == self.state["release_id"]
                 and result.get("source_sha") == self.request["source_sha"]
                 and result.get("workflow_run_id") == self.state["bundle"]["workflow_run_id"],
                 "draft 验收结果的 Release 或构建身份不一致。")
        self.state["checks"]["draft"] = {"release_id": release["id"],
                                        "assets_sha256": hashlib.sha256(_json_bytes(self.state["assets"])).hexdigest()}
        self._save()
        print("原 draft 验收器已确认完整白名单、大小和 GitHub SHA-256 均匹配。")
        return 0

    def prepare_publish(self) -> int:
        self.verify_draft()
        check = self.state["checks"].get("draft")
        digest = hashlib.sha256(_json_bytes(self.state["assets"])).hexdigest()
        _require(check == {"release_id": self.state["release_id"], "assets_sha256": digest},
                 "缺少同一完整草稿的成功验收记录。")
        self._prepare("publish", {"release_id": self.state["release_id"], "assets_sha256": digest,
                                  "tag_object_sha": self.state["tag_object_sha"]})
        print("已冻结公开发布的准确 Release 编号和已验收字节；须先保留 checkpoint。")
        return 0

    def publish(self) -> int:
        release = self._owned_release()
        effect = self.state["effects"].get("publish")
        _require(isinstance(effect, dict) and effect["intent"] == {
            "release_id": self.state["release_id"], "assets_sha256": hashlib.sha256(_json_bytes(self.state["assets"])).hexdigest(),
            "tag_object_sha": self.state["tag_object_sha"]}, "公开发布意图缺失或发生变化。")
        self._verify_primary_assets(release, complete=True)
        if release["draft"] is True:
            self._may_execute("publish")
            self.verify_draft()
            release = self._mutate("publish", "PATCH", f"/releases/{release['id']}",
                                   {"draft": False, "make_latest": "true"}, expected_status=200)
        validate_release_identity(release, self.state, allow_public=True)
        _require(release.get("draft") is False, "GitHub 尚未确认准确 Release 已公开；不会重新提交。")
        self._record_success("publish", {"release_id": release["id"], "published_at": release["published_at"]})
        self.state["checks"]["published"] = True
        self._save()
        print(f"已确认 GitHub Release 公开：https://github.com/{self.request['repo']}/releases/tag/{self.request['tag']}")
        return 0

    def verify_public(self) -> int:
        release = self._owned_release()
        _require(release["draft"] is False, "Release 尚未公开。")
        self._verify_primary_assets(release, complete=True)
        if self.state["checks"].get("public_bytes") is True:
            print("既有公开字节验收已保留，全部 primary 附件 SHA-256 仍一致；继续独立后续验收。")
            return 0
        public_verifier.verify_public_release(self.request["version"], self.timeout, repo=self.request["repo"],
                                              github_only=True, require_unified_installers=True,
                                              require_runtime_installers=False,
                                              **release_scope.metadata(self.spec.platform_scope))
        self.state["checks"]["public_bytes"] = True
        self._save()
        print("Windows 公开安装包的字节验收已通过。" if self.spec.platform_scope == "windows" else
              "GitHub 公开安装包的字节验收已通过；Docker 仍由独立 image 工作流验收。")
        return 0

    def _post_definition(self, kind: str) -> tuple[str, str]:
        return self.spec.post_workflows[kind]

    def _post_identity(self, kind: str) -> dict:
        workflow, title = self._post_definition(kind)
        return {"workflow_file": workflow, "run_name": title, "ref": "main", "tag": self.request["tag"],
                "source_sha": self.request["source_sha"], "tag_object_sha": self.state["tag_object_sha"],
                "release_id": self.state["release_id"], "head_sha": self.context["control_sha"]}

    def _post_inputs(self, kind: str) -> dict:
        return {"tag": self.request["tag"]}

    def _post_runs(self, kind: str) -> list[dict]:
        workflow, _title = self._post_definition(kind)
        payload = self.client.fetch_json(f"/actions/workflows/{workflow}/runs?event=workflow_dispatch&branch=main&per_page=100")
        runs = payload.get("workflow_runs")
        _require(isinstance(runs, list) and len(runs) <= 100 and all(isinstance(run, dict) for run in runs),
                 "后续工作流列表无效或超出限制。")
        return runs

    def _post_intent(self, kind: str) -> dict:
        effect = self.state["effects"].get(f"post:{kind}")
        _require(isinstance(effect, dict), "缺少后续工作流的固定 dispatch 意图。")
        intent = effect["intent"]
        expected = self._post_identity(kind)
        _require(set(intent) == set(expected) | {"not_before", "baseline_run_ids"}
                 and all(intent.get(key) == value for key, value in expected.items()), "后续工作流意图发生变化。")
        baseline = intent.get("baseline_run_ids")
        _require(isinstance(baseline, list) and len(baseline) <= 100
                 and all(_positive_int(value) for value in baseline) and len(set(baseline)) == len(baseline)
                 and _positive_int(intent.get("not_before")), "后续工作流的只读恢复依据无效。")
        return intent

    def prepare_post(self) -> int:
        release = self._owned_release()
        _require(release["draft"] is False and self.state["checks"].get("public_bytes") is True,
                 "公开安装包尚未完成字节验收，不能开始后续发布。")
        for kind, (workflow, title) in self.spec.post_workflows.items():
            if f"post:{kind}" in self.state["effects"]:
                self._post_intent(kind)
                continue
            main_sha = readiness._branch_sha(self.client, "main")
            _require(main_sha == self.context["control_sha"],
                     "main 已离开本次审核的控制源码；不会从未审核的新 main 触发后续发布。")
            baseline = [run.get("id") for run in self._post_runs(kind)]
            _require(all(_positive_int(value) for value in baseline), "后续工作流列表包含无效编号。")
            intent = {"workflow_file": workflow, "run_name": title, "ref": "main", "tag": self.request["tag"],
                      "source_sha": self.request["source_sha"], "tag_object_sha": self.state["tag_object_sha"],
                      "release_id": self.state["release_id"], "head_sha": main_sha,
                      "not_before": int(time.time()), "baseline_run_ids": sorted(set(baseline))}
            self._prepare(f"post:{kind}", intent)
        print("已冻结 Docker 与 Intel Mac 后续工作流；从已审核 main 控制固定 tag。")
        return 0

    def _validate_post_run(self, kind: str, run: dict) -> None:
        intent = self._post_intent(kind)
        _require(_positive_int(run.get("id")) and run.get("path") == f".github/workflows/{intent['workflow_file']}"
                 and run.get("event") == "workflow_dispatch" and run.get("head_branch") == "main"
                 and run.get("head_sha") == intent["head_sha"] and run.get("display_title") == intent["run_name"],
                 "后续运行的 workflow、main 控制源码或 tag 关联不一致。")
        for key in ("repository", "head_repository"):
            repo = run.get(key)
            _require(isinstance(repo, dict) and repo.get("id") == self.request["repo_id"]
                     and repo.get("full_name") == self.request["repo"], "后续运行来自错误仓库。")
        actor = run.get("actor")
        _require(isinstance(actor, dict) and actor.get("login") == BOT_LOGIN and actor.get("id") == BOT_ID,
                 "后续运行不是由本仓库工作流机器身份触发。")
        actual_attempt = run.get("run_attempt")
        previous = self.state["post"].get(kind, {}).get("run_attempt", 0)
        _require(_positive_int(actual_attempt) and actual_attempt >= previous, "后续运行尝试次数倒退或无效。")
        if actual_attempt > 1:
            trigger = run.get("triggering_actor")
            _require(isinstance(trigger, dict) and trigger.get("login") == self.request["owner"]
                     and trigger.get("id") == self.request["owner_id"], "只观察仓库所有者主动重跑的后续任务。")

    def _post_snapshot(self, kind: str) -> dict | None:
        intent = self._post_intent(kind)
        bound = self.state["post"].get(kind)
        if bound is not None:
            _require(isinstance(bound, dict) and _positive_int(bound.get("run_id"))
                     and bound.get("head_sha") == intent["head_sha"], "后续运行记录无效。")
            run = self.client.fetch_json(f"/actions/runs/{bound['run_id']}")
            _require(run.get("id") == bound["run_id"], "后续运行编号发生变化。")
        else:
            # The existing adapters accept only tag, so the normal binding uses
            # GitHub's returned run ID. After a lost response, only a unique new
            # bot dispatch with the exact workflow/main/title/time may reconcile.
            matches = []
            for candidate in self._post_runs(kind):
                if (candidate.get("id") in intent["baseline_run_ids"]
                        or candidate.get("path") != f".github/workflows/{intent['workflow_file']}"
                        or candidate.get("head_sha") != intent["head_sha"]
                        or candidate.get("display_title") != intent["run_name"]
                        or candidate.get("actor", {}).get("id") != BOT_ID):
                    continue
                try:
                    created = dt.datetime.fromisoformat(str(candidate.get("created_at", "")).replace("Z", "+00:00"))
                except ValueError as exc:
                    raise ReleaseControlError("后续运行创建时间无效，无法安全关联。") from exc
                _require(created.tzinfo is not None, "后续运行创建时间缺少时区。")
                if created.timestamp() >= intent["not_before"]:
                    self._validate_post_run(kind, candidate)
                    matches.append(candidate)
            _require(len(matches) <= 1, "有多个后续运行可能对应本次 dispatch；不会猜测或重派。")
            if not matches:
                return None
            run = matches[0]
        self._validate_post_run(kind, run)
        self.state["post"][kind] = {"run_id": run["id"], "head_sha": intent["head_sha"],
                                   "run_attempt": run["run_attempt"], "status": run.get("status"),
                                   "conclusion": run.get("conclusion")}
        self._record_success(f"post:{kind}", {"run_id": run["id"], "run_attempt": run["run_attempt"]})
        return run

    def dispatch_post(self) -> int:
        release = self._owned_release()
        _require(release["draft"] is False and self.state["checks"].get("public_bytes") is True,
                 "后续任务需要已验收的公开 Release。")
        for kind in self.spec.post_workflows:
            self._dispatch_post_kind(kind)
        return 0

    def _dispatch_post_kind(self, kind: str) -> None:
        intent = self._post_intent(kind)
        if self._post_snapshot(kind) is not None:
            return
        self._may_execute(f"post:{kind}")
        _require(readiness._branch_sha(self.client, "main") == intent["head_sha"],
                 "dispatch 前 main 控制源码已变化；已停止。")
        result = self._mutate(f"post:{kind}", "POST", f"/actions/workflows/{intent['workflow_file']}/dispatches",
                              {"ref": "main", "inputs": self._post_inputs(kind), "return_run_details": True},
                              expected_status=200)
        run_id = result.get("workflow_run_id")
        _require(_positive_int(run_id) and result.get("run_url") == self.client.api_url(f"/actions/runs/{run_id}")
                 and result.get("html_url") == f"https://github.com/{self.request['repo']}/actions/runs/{run_id}",
                 "GitHub 未返回可核对的后续运行编号；保留意图，只允许只读恢复。")
        self.state["post"][kind] = {"run_id": run_id, "head_sha": intent["head_sha"],
                                    "run_attempt": 1, "status": "requested", "conclusion": None}
        self._record_success(f"post:{kind}", {"run_id": run_id, "run_attempt": 1})
        print(f"已绑定 {kind} 后续运行 {run_id}；尚未将 dispatch 当作验收完成。")

    def _verify_image_success(self, run: dict) -> None:
        payload = self.client.fetch_json(f"/actions/runs/{run['id']}/attempts/{run['run_attempt']}/jobs?per_page=100")
        jobs = payload.get("jobs")
        _require(isinstance(jobs, list) and payload.get("total_count") == len(jobs) and len(jobs) <= 100,
                 "Docker 工作流 job 记录不完整。")
        public_jobs = [job for job in jobs if isinstance(job, dict) and job.get("name") == "verify-public"]
        _require(len(public_jobs) == 1 and public_jobs[0].get("status") == "completed"
                 and public_jobs[0].get("conclusion") == "success", "Docker 的匿名公开可用性验收尚未成功。")
        base = f"https://github.com/{self.request['repo']}/releases/download/{self.request['tag']}"
        metadata = public_verifier.fetch_json(f"{base}/{public_verifier.SERVER_IMAGE_METADATA}", self.timeout)
        bootstrap = public_verifier.fetch_bytes(f"{base}/{public_verifier.SERVER_BOOTSTRAP_ASSET}",
                                                public_verifier.MAX_JSON_BYTES, self.timeout)
        image = public_verifier.validate_server_image_release_record(metadata, self.request["version"], bootstrap,
                                                                    repo=self.request["repo"])
        _require(image["source_sha"] == self.request["source_sha"]
                 and image["deployment_source_sha"] == self._post_intent("image")["head_sha"],
                 "Docker 产物源码或部署脚本控制源码不一致。")
        self.state["checks"]["server_image"] = {"run_id": run["id"], "run_attempt": run["run_attempt"],
                                               "digest": image["digest"], "anonymous_verification": "success"}
        self._save()

    def status_post(self, wait_secs: int = 0) -> int:
        release = self._owned_release()
        _require(release["draft"] is False, "后续任务对应的 Release 尚未公开。")
        deadline = time.monotonic() + wait_secs
        while True:
            observed: dict[str, dict] = {}
            for kind in self.spec.post_workflows:
                run = self._post_snapshot(kind)
                _require(run is not None, "此前后续 dispatch 尚无法唯一关联；不自动重派。")
                observed[kind] = run
            image = observed["image"]
            intel = observed["intel"]
            if image.get("status") == "completed":
                if image.get("conclusion") != "success":
                    print("安装包已公开且验收通过，但 Docker 工作流未成功。若是首次 GHCR 包仍为 Private，"
                          "需所有者在 GitHub 核对包可见性；本控制器不更改权限、不自动重跑。", file=sys.stderr)
                    return 1
                receipt = self.state["checks"].get("server_image", {})
                if receipt.get("run_id") != image["id"] or receipt.get("run_attempt") != image["run_attempt"]:
                    self._verify_image_success(image)
                self._verify_primary_assets(self._owned_release(), complete=True)
                if intel.get("status") == "completed" and intel.get("conclusion") == "success":
                    self.state["checks"]["intel_desktop"] = {"run_id": intel["id"], "run_attempt": intel["run_attempt"], "success": True}
                    self._save()
                    print("GitHub 安装包、Docker 匿名可用性与 Intel Mac 补充工作流均已成功。")
                else:
                    print(f"GitHub 安装包和 Docker 已验收；Intel Mac 补充运行 {intel['id']} "
                          f"仍为 {intel.get('conclusion') or intel.get('status')}，可独立继续，不重发主 Release。")
                return 0
            if time.monotonic() >= deadline:
                print(f"已公开安装包；正在观察原 Docker 运行 {image['id']} 与 Intel Mac 运行 {intel['id']}。")
                return 2
            time.sleep(min(10, max(0.1, deadline - time.monotonic())))


def build_parser(*, spec: ReleaseSpec = DEFAULT_RELEASE_SPEC, stages: tuple[str, ...] = STAGES) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=f"固定 WebCodex {spec.pinned_request['tag']} 的 GitHub Actions 发布控制器；无参数仅显示计划。")
    parser.add_argument("stage", nargs="?", choices=stages)
    parser.add_argument("--plan", action="store_true", help="只显示固定目标和阶段，不联网或创建状态")
    parser.add_argument("--request", type=Path)
    parser.add_argument("--source-root", type=Path)
    parser.add_argument("--state-dir", type=Path)
    parser.add_argument("--bundle-dir", type=Path)
    parser.add_argument("--wait-secs", type=int, default=0)
    parser.add_argument("--timeout", type=float, default=60)
    return parser


def main(argv: list[str] | None = None, *, spec: ReleaseSpec = DEFAULT_RELEASE_SPEC,
         controller_type: type[Controller] | None = None) -> int:
    stages = STAGES if controller_type is None else controller_type.stages
    controller_type = Controller if controller_type is None else controller_type
    parser = build_parser(spec=spec, stages=stages)
    args = parser.parse_args(argv)
    if args.plan or args.stage is None:
        print(f"固定发布 {spec.pinned_request['repo']} {spec.pinned_request['tag']}，源码 {spec.pinned_request['source_sha']}。")
        print("仅 GitHub、8 个 unified 安装目标；通过仓库官方 Actions installation token 执行。")
        print("prepare 后必须先保存 checkpoint；同一控制 run 可恢复，未知操作不重复提交。")
        print("阶段：" + " → ".join(stages))
        return 0
    if args.request is None or args.source_root is None or args.state_dir is None:
        parser.error("执行阶段需要 --request、--source-root 和 --state-dir")
    try:
        return controller_type(args.request, args.source_root, args.state_dir, args.bundle_dir, args.timeout, spec=spec).run(args.stage, args.wait_secs)
    except ReleaseControlError as exc:
        print(f"[release-control] {exc}", file=sys.stderr)
        return 1
    except (collector.CollectionError, publication.PublicationError, readiness.ReadinessError,
            public_verifier.VerificationError) as exc:
        # Existing network helpers may include signed redirect URLs in diagnostic
        # text. Never replay their raw exception or HTTP body into workflow logs.
        print(f"[release-control] 既有发布验收未通过（{type(exc).__name__}）；已停止并保留记录，请核对固定运行的验收日志。",
              file=sys.stderr)
        return 1
    except (OSError, ValueError, TypeError, KeyError, zipfile.BadZipFile) as exc:
        print(f"[release-control] 发布文件或响应格式异常（{type(exc).__name__}）；已停止，不自动重试。", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
