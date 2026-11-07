#!/usr/bin/env python3
"""Assemble the fixed v0.5.2 native outputs without rebuilding or publishing.

Only ten private Unix checksum sidecars are repaired. Signed installers,
native archives, Desktop distributions and source manifests stay byte-identical.
The original tagged assembly and validation scripts run in a disposable worktree
with explicit SOURCE_BUILD_* provenance; the real GITHUB_* identity is retained.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Mapping

if __package__:
    from . import collect_release_bundle as collector
    from . import release_publication as publication
else:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import collect_release_bundle as collector
    import release_publication as publication


ORIGIN_SHA256 = "b3b58a18c9c4c85effc0f1f132b17549c336aa2d0b4bc6137baef094124c26ee"
ORIGIN_FILE_SHA256 = "1eadff660c06001238a5c15c120f0d6362523b061b3bf7f2738bb83a2f817f59"
REPO = "9holy/webcodex"
REPO_ID = 1404596174
SOURCE_SHA = "2299ffe5bcc0f3965e11b753fabc3fb558769de8"
SOURCE_TREE = "c1b02a3d3820f595f832105772ecbeb181468db1"
BUILD_RUN_ID = 42373155729
BUILD_ATTEMPT = 1
BUILD_REQUEST_ID = "rb_d71b1111926a9ef697d21eb1"
TAG = "v0.5.2"
VERSION = "0.5.2"
STEM = f"webcodex-{TAG}"
WORKFLOW_PATH = ".github/workflows/release-build.yml"
WORKFLOW_REF = f"{REPO}/{WORKFLOW_PATH}@refs/tags/{TAG}"
WORKFLOW_SHA256 = "16b4742ec1f8eee5203a48d5635332a0c89b21a94c75a112a6849129597032ba"
ASSEMBLE_STEP = "Verify and assemble one release bundle"
VERIFY_STEP = "Verify complete selected bundle"
STEP_SHA256 = {
    ASSEMBLE_STEP: "fd2b5cabb6adacd7104a617134a88180e4b04a85d0ad4c933c09fde6a4b4a6d1",
    VERIFY_STEP: "daf6f94850b74ffb482c60af7bd158b3554b668f650380cc0a26c2e20c913460",
}
EXECUTED_STEP_SHA256 = {
    ASSEMBLE_STEP: "2a0890a59f242e36c2a9563a92688ff53ea03a80206f46dc83983c3742a225fb",
    VERIFY_STEP: "ef137515154891af48937eedf913cebee46ca79266fd61569fc84bcbae93eb31",
}
SUBSTITUTIONS = {ASSEMBLE_STEP: (5, 3), VERIFY_STEP: (1, 0)}
MAX_JSON_BYTES = 256 * 1024
MAX_CANDIDATE_BYTES = 2 * 1024 * 1024 * 1024
ASSEMBLY_TIMEOUT = 900
GENERATED_PUBLIC_FILES = frozenset({"SHA256SUMS", "manifest.json", "webcodex-release-manifest.json"})
INTERNAL_BUNDLE_FILES = frozenset({"release-build.json", "linux-x64-elf.txt", "linux-arm64-elf.txt"})
RECEIPT_KIND = "webcodex-v0.5.2-assembly-recovery-receipt"


class AssemblyRecoveryError(RuntimeError):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise AssemblyRecoveryError(message)


def _positive_int(value: object) -> bool:
    return type(value) is int and value > 0


def _json_bytes(value: dict) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def canonical_sha256(value: dict) -> str:
    return hashlib.sha256(_json_bytes(value)).hexdigest()


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    result: dict = {}
    for key, value in pairs:
        _require(key not in result, "duplicate JSON field in recovery evidence")
        result[key] = value
    return result


def _safe_path(path: Path) -> Path:
    result = path.absolute()
    for item in (result, *result.parents):
        try:
            mode = item.lstat().st_mode
        except FileNotFoundError:
            continue
        _require(not stat.S_ISLNK(mode), "recovery paths must not traverse symlinks")
    return result


def _read_json(path: Path) -> dict:
    target = _safe_path(path)
    _require(target.is_file() and 0 < target.stat().st_size <= MAX_JSON_BYTES, "recovery JSON is missing or oversized")
    try:
        value = json.loads(target.read_bytes(), object_pairs_hook=_unique_object)
    except (ValueError, UnicodeDecodeError) as exc:
        raise AssemblyRecoveryError("invalid recovery JSON") from exc
    _require(isinstance(value, dict), "recovery JSON must be an object")
    return value


def validate_origin(origin: dict) -> dict:
    _require(isinstance(origin, dict) and canonical_sha256(origin) == ORIGIN_SHA256,
             "origin differs from the reviewed v0.5.2 run, jobs, artifacts or assembly scripts")
    return origin


def artifact_members() -> dict[str, set[str]]:
    """The exact fourteen artifact namespaces produced by the tagged workflow."""
    result: dict[str, set[str]] = {}
    for platform in collector.PLATFORMS:
        archive = f"{STEM}-{platform}.tar.gz"
        members = {archive, f"{archive}.sha256"}
        if platform.startswith("linux-"):
            members.add(f"{platform}-elf.txt")
        if platform == "darwin-arm64":
            desktop = f"webcodex-desktop-{TAG}-{platform}.dmg"
            members.update({desktop, f"{desktop}.sha256", f"{desktop}.evidence.json"})
        result[f"{STEM}-{platform}"] = members
        source = f"webcodex-source-{TAG}-{platform}.json"
        unified = {source, f"{source}.sha256"}
        suffixes = ("deb", "rpm") if platform.startswith("linux-") else (("pkg",) if platform.startswith("darwin-") else ("exe",))
        for suffix in suffixes:
            installer = f"webcodex-unified-{TAG}-{platform}.{suffix}"
            unified.update({installer, f"{installer}.sha256"})
            if suffix == "exe":
                unified.update({f"{installer}.provenance.json",
                                f"webcodex-unified-{TAG}-{platform}.source-manifest.json",
                                f"webcodex-unified-{TAG}-{platform}.candidate-SHA256SUMS"})
        result[f"{STEM}-unified-{platform}"] = unified
        if platform.startswith("win32-"):
            desktop = f"webcodex-desktop-{TAG}-{platform}-setup.exe"
            result[f"{STEM}-desktop-{platform}"] = {desktop, f"{desktop}.sha256"}
    return result


def public_input_names() -> set[str]:
    names = {f"{STEM}-{platform}.tar.gz" for platform in collector.PLATFORMS}
    names.update(f"webcodex-source-{TAG}-{platform}.json" for platform in collector.PLATFORMS)
    names.update(collector.installer_artifact_filename(VERSION, target) for target in collector.INSTALLER_TARGETS)
    names.update(collector.desktop_artifact_filename(VERSION, platform, build_kind="release", tag=TAG, source_sha=SOURCE_SHA)
                 for platform in collector.DESKTOP_PLATFORMS)
    return names


def unix_sidecar_targets() -> dict[str, str]:
    names: set[str] = set()
    for platform in ("linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"):
        names.add(f"webcodex-source-{TAG}-{platform}.json")
        suffixes = ("deb", "rpm") if platform.startswith("linux-") else ("pkg",)
        names.update(f"webcodex-unified-{TAG}-{platform}.{suffix}" for suffix in suffixes)
    return {f"{name}.sha256": name for name in sorted(names)}


def _repo_identity(value: object) -> bool:
    return isinstance(value, dict) and value.get("id") == REPO_ID and value.get("full_name") == REPO


def validate_source_run(run: dict, origin: dict) -> None:
    expected = {"id": BUILD_RUN_ID, "run_attempt": BUILD_ATTEMPT, "head_sha": SOURCE_SHA,
                "head_branch": TAG, "path": WORKFLOW_PATH, "event": "workflow_dispatch",
                "display_title": f"Release build {TAG} {BUILD_REQUEST_ID}",
                "status": "completed", "conclusion": "failure"}
    _require(all(type(run.get(key)) is type(value) and run.get(key) == value for key, value in expected.items()),
             "the original failed run identity, attempt or terminal result has changed")
    _require(_repo_identity(run.get("repository")) and _repo_identity(run.get("head_repository")),
             "the original run belongs to a different repository")
    _require(origin["source_build_run_id"] == BUILD_RUN_ID and origin["source_build_run_attempt"] == BUILD_ATTEMPT,
             "wrong original production run")


def required_producer_steps(name: str) -> set[str]:
    if name == "preflight":
        return {"Fail fast on deterministic release contracts"}
    if name == "prepare":
        return {"Require immutable tagged workflow source", "Resolve immutable release metadata"}
    if name.startswith("linux ("):
        return {"Build and verify inside glibc 2.17 userspace", "Upload Linux candidate"}
    if name.startswith("macos ("):
        steps = {"Configure persistent macOS signing", "Build and verify native macOS candidate", "Upload macOS candidate"}
        if name.startswith("macos (darwin-arm64,"):
            steps.update({"Stage exact native runtime for macOS Desktop", "Build native macOS Desktop DMG",
                          "Smoke native macOS Desktop DMG and signing evidence"})
        return steps
    if name.startswith("windows ("):
        return {"Build and verify native Windows candidate", "Smoke native Windows artifact through npm installer",
                "Stage exact native Windows runtime for Desktop", "Build unsigned native Windows Desktop NSIS candidate",
                "Smoke native Windows Desktop NSIS candidate", "Collect native Windows unified installer inputs",
                "Build native Tauri payload and outer Windows bootstrap", "Upload Windows unified installer and provenance",
                "Upload Windows candidate", "Upload native Windows Desktop candidate"}
    if name.startswith("unified-native ("):
        steps = {"Fence exact clean source before generated inputs", "Upload native Linux/macOS unified installer"}
        if name.startswith("unified-native (linux-"):
            steps.add("Build and package Linux installer in Ubuntu 22.04 native container")
        else:
            steps.update({"Verify native host and prepare exact runtime inputs", "Configure persistent macOS signing",
                          "Install frontend dependencies and build Desktop", "Collect and package macOS installer"})
        return steps
    raise AssemblyRecoveryError("unexpected original producer job")


def validate_source_jobs(payload: dict, origin: dict) -> None:
    jobs = payload.get("jobs")
    pinned = {item["id"]: item for item in origin["jobs"]}
    _require(type(payload.get("total_count")) is int and payload["total_count"] == len(pinned)
             and isinstance(jobs, list) and len(jobs) == len(pinned), "the original attempt's job list is incomplete")
    _require(all(isinstance(job, dict) and _positive_int(job.get("id")) for job in jobs)
             and {job["id"] for job in jobs} == set(pinned), "the original job ids differ from reviewed evidence")
    for job in jobs:
        pin = pinned[job["id"]]
        _require(job.get("name") == pin["name"] and job.get("conclusion") == pin["conclusion"]
                 and job.get("status") == "completed" and job.get("run_id") == BUILD_RUN_ID
                 and job.get("run_attempt") == BUILD_ATTEMPT and job.get("head_sha") == SOURCE_SHA,
                 "an original job changed identity, attempt, source or result")
        steps = job.get("steps")
        _require(isinstance(steps, list) and len(steps) <= 100, "original job steps are missing or oversized")
        numbers: set[int] = set()
        by_name: dict[str, list[dict]] = {}
        for step in steps:
            _require(isinstance(step, dict) and _positive_int(step.get("number")) and step["number"] not in numbers
                     and isinstance(step.get("name"), str) and 0 < len(step["name"]) <= 256
                     and step.get("status") == "completed", "original job step evidence is malformed")
            numbers.add(step["number"])
            by_name.setdefault(step["name"], []).append(step)
        if pin["conclusion"] == "skipped":
            _require(pin["name"] == "runtime-native" and not steps, "unexpected skipped producer job")
            continue
        if pin["name"] == "assemble":
            failed = [step for step in steps if step.get("conclusion") not in {"success", "skipped"}]
            _require(len(failed) == 1 and failed[0].get("name") == ASSEMBLE_STEP
                     and failed[0].get("conclusion") == "failure", "the original failure was not confined to assembly")
            required = {"Download same-run native candidates": "success", ASSEMBLE_STEP: "failure",
                        VERIFY_STEP: "skipped", "Upload assembled candidate set": "skipped"}
        else:
            _require(pin["conclusion"] == "success" and all(step.get("conclusion") in {"success", "skipped"} for step in steps),
                     "a native production or validation step did not succeed")
            required = {name: "success" for name in required_producer_steps(pin["name"])}
        for name, conclusion in required.items():
            _require(len(by_name.get(name, [])) == 1 and by_name[name][0].get("conclusion") == conclusion,
                     f"required original step evidence is missing or changed: {name}")


def validate_source_artifacts(payload: dict, origin: dict) -> list[dict]:
    items = payload.get("artifacts")
    _require(isinstance(items, list) and type(payload.get("total_count")) is int
             and payload["total_count"] == len(items) and 14 <= len(items) <= 16,
             "the original artifact list is incomplete or oversized")
    _require(all(isinstance(item, dict) and _positive_int(item.get("id")) and isinstance(item.get("name"), str)
                 for item in items), "original artifact metadata is malformed")
    _require(len({item["id"] for item in items}) == len(items) and len({item["name"] for item in items}) == len(items),
             "duplicate artifact identity or name")
    by_id = {item["id"]: item for item in items}
    expected_names = set(artifact_members())
    extras = {item["name"] for item in items} - expected_names
    _require(extras <= {"dmg-diagnostics-darwin-x64-1", "dmg-diagnostics-darwin-arm64-1"},
             "unexpected artifacts exist in the failed assembly run")
    selected = []
    for pin in origin["artifacts"]:
        item = by_id.get(pin["id"])
        _require(isinstance(item, dict) and all(type(item.get(key)) is type(pin[key]) and item.get(key) == pin[key]
                                                for key in ("id", "name", "size_in_bytes", "digest"))
                 and item.get("expired") is False, "an original artifact is expired, replaced or changed")
        run = item.get("workflow_run")
        _require(isinstance(run, dict) and run.get("id") == BUILD_RUN_ID
                 and run.get("repository_id") == REPO_ID and run.get("head_repository_id") == REPO_ID
                 and run.get("head_sha") == SOURCE_SHA and run.get("head_branch") == TAG,
                 "artifact provenance does not belong to the original tagged run")
        selected.append(dict(pin))
    _require({item["name"] for item in selected} == expected_names, "incomplete pinned native artifact set")
    _require(sum(item["size_in_bytes"] for item in selected) <= MAX_CANDIDATE_BYTES, "pinned artifact downloads exceed the total bound")
    return selected


def file_record(path: Path) -> dict:
    target = _safe_path(path)
    _require(target.is_file() and 0 < target.stat().st_size <= collector.MAX_MEMBER_BYTES,
             "candidate file is missing, non-regular or oversized")
    return {"size": target.stat().st_size, "sha256": collector.sha256_file(target)}


def extract_candidate_artifact(archive: Path, destination: Path, artifact_name: str) -> dict[str, dict]:
    expected = artifact_members().get(artifact_name)
    _require(expected is not None, "unapproved native artifact namespace")
    _safe_path(archive)
    target = _safe_path(destination)
    _require(not target.exists(), "candidate extraction directory already exists")
    try:
        with zipfile.ZipFile(archive) as handle:
            members = handle.infolist()
            _require(len(members) == len(expected) and {member.filename for member in members} == expected,
                     "artifact contains missing, duplicate, nested or unexpected files")
            _require(all(not member.flag_bits & 1 for member in members), "encrypted candidate ZIP members are not supported")
        names = collector.safe_extract_zip(archive, target)
        _require(names == expected, "extracted artifact member set changed")
        return {name: file_record(target / name) for name in sorted(names)}
    except (zipfile.BadZipFile, OSError, collector.CollectionError) as exc:
        raise AssemblyRecoveryError("native artifact extraction failed its flat-file safety contract") from exc


def merge_candidate_files(source: Path, destination: Path, records: dict[str, dict]) -> None:
    source = _safe_path(source)
    target = _safe_path(destination)
    _require(target.is_dir(), "merged candidate directory does not exist")
    _require(set(records) <= set().union(*artifact_members().values()), "candidate merge contains unknown names")
    for name in records:
        _require(not (target / name).exists() and not (target / name).is_symlink(), "candidate artifacts overlap; no file will be replaced")
        _require(file_record(source / name) == records[name], "candidate bytes changed after extraction")
    for name in sorted(records):
        # A fresh private destination and O_EXCL ensure artifacts cannot clobber
        # earlier producers. No extraction path is reused across artifacts.
        with (source / name).open("rb") as original, (target / name).open("xb") as output:
            shutil.copyfileobj(original, output, length=1024 * 1024)
        _require(file_record(target / name) == records[name], "candidate bytes changed during merge")


def normalize_unix_sidecars(candidate_dir: Path) -> list[dict]:
    root = _safe_path(candidate_dir)
    planned: list[tuple[Path, bytes, bytes, dict]] = []
    for name, source_name in unix_sidecar_targets().items():
        path = _safe_path(root / name)
        _require(path.is_file() and 0 < path.stat().st_size <= 1024, "expected Unix sidecar is missing or oversized")
        before = path.read_bytes()
        source = file_record(root / source_name)
        expected = f"{source['sha256']}  dist/{source_name}\n".encode("ascii")
        _require(before == expected, "Unix sidecar is not exactly one matching sha256 plus two spaces and dist/basename")
        after = f"{source['sha256']}  {source_name}\n".encode("ascii")
        record = {"name": name, "source_filename": source_name,
                  "before_sha256": hashlib.sha256(before).hexdigest(), "after_sha256": hashlib.sha256(after).hexdigest(),
                  "before_size": len(before), "after_size": len(after)}
        planned.append((path, before, after, record))
    # Validate all ten before making even the private, reproducible repair.
    for path, before, after, _record in planned:
        _require(path.read_bytes() == before, "Unix sidecar changed before normalization")
        path.write_bytes(after)
    return [record for _path, _before, _after, record in planned]


def extract_original_steps(workflow: bytes, origin: dict) -> dict[str, str]:
    _require(hashlib.sha256(workflow).hexdigest() == WORKFLOW_SHA256, "the original tagged workflow bytes differ")
    text = workflow.decode("utf-8")
    _require(text.count("\n  assemble:\n") == 1, "original assemble job is not unique")
    job = text.split("\n  assemble:\n", 1)[1]
    steps: dict[str, str] = {}
    for name in STEP_SHA256:
        marker = f"      - name: {name}\n        shell: bash\n        run: |\n"
        _require(job.count(marker) == 1, "the original assembly step is not unique")
        tail = job.split(marker, 1)[1]
        end = tail.find("\n      - ")
        _require(end >= 0, "the original assembly step boundary is missing")
        lines = tail[:end].splitlines()
        _require(all(not line or line.startswith(" " * 10) for line in lines), "unexpected original assembly block indentation")
        script = "\n".join(line[10:] if line else "" for line in lines).rstrip("\n") + "\n"
        _require(hashlib.sha256(script.encode()).hexdigest() == STEP_SHA256[name] == origin["assembly_steps_sha256"][name],
                 "the original assembly script SHA-256 differs")
        steps[name] = script
    return steps


def adapt_source_identity(name: str, script: str) -> str:
    _require(name in STEP_SHA256 and hashlib.sha256(script.encode()).hexdigest() == STEP_SHA256[name],
             "only the exact reviewed original assembly scripts may execute")
    expected_run, expected_ref = SUBSTITUTIONS[name]
    _require(script.count("GITHUB_RUN_ID") == expected_run and script.count("GITHUB_WORKFLOW_REF") == expected_ref
             and "SOURCE_BUILD_RUN_ID" not in script and "SOURCE_BUILD_WORKFLOW_REF" not in script,
             "original source identity references differ from the reviewed substitution")
    result = script.replace("GITHUB_RUN_ID", "SOURCE_BUILD_RUN_ID").replace("GITHUB_WORKFLOW_REF", "SOURCE_BUILD_WORKFLOW_REF")
    _require(hashlib.sha256(result.encode()).hexdigest() == EXECUTED_STEP_SHA256[name],
             "the adapted assembly script differs from the reviewed provenance-only change")
    return result


def assembly_context_from_env(env: Mapping[str, str] | None = None) -> dict:
    values = os.environ if env is None else env
    _require(values.get("GITHUB_ACTIONS") == "true" and values.get("GITHUB_REPOSITORY") == REPO
             and values.get("GITHUB_REPOSITORY_ID") == str(REPO_ID) and values.get("GITHUB_REF") == "refs/heads/main",
             "assembly must run in the real repository's reviewed main workflow")
    try:
        run_id = int(values.get("GITHUB_RUN_ID", ""))
        attempt = int(values.get("GITHUB_RUN_ATTEMPT", ""))
    except ValueError as exc:
        raise AssemblyRecoveryError("invalid actual assembly run identity") from exc
    sha = values.get("GITHUB_SHA", "")
    workflow_ref = values.get("GITHUB_WORKFLOW_REF", "")
    job = values.get("GITHUB_JOB", "")
    _require(run_id > 0 and run_id != BUILD_RUN_ID and attempt > 0
             and re.fullmatch(r"[0-9a-f]{40}", sha) is not None and values.get("GITHUB_WORKFLOW_SHA") == sha
             and re.fullmatch(re.escape(REPO) + r"/\.github/workflows/[a-zA-Z0-9_-]+\.ya?ml@refs/heads/main", workflow_ref) is not None
             and re.fullmatch(r"[a-zA-Z_][a-zA-Z0-9_-]*", job) is not None,
             "the current assembly identity cannot impersonate the native production run")
    return {"repo": REPO, "repo_id": REPO_ID, "run_id": run_id, "run_attempt": attempt,
            "control_sha": sha, "workflow_ref": workflow_ref, "job": job}


def _validate_assembly_run(run: dict, context: dict) -> None:
    path = context["workflow_ref"].split("/", 2)[2].split("@", 1)[0]
    expected = {"id": context["run_id"], "run_attempt": context["run_attempt"], "head_sha": context["control_sha"],
                "head_branch": "main", "path": path}
    _require(all(run.get(key) == value for key, value in expected.items())
             and run.get("event") in {"push", "workflow_dispatch"}
             and _repo_identity(run.get("repository")) and _repo_identity(run.get("head_repository")),
             "GitHub's current assembly run differs from its real runtime identity")


def source_execution_env(origin: dict, env: Mapping[str, str]) -> dict[str, str]:
    assembly_context_from_env(env)
    # The original steps require no network credentials. Preserve actual GitHub
    # identity values, while omitting credentials and shell/Python injection hooks.
    kept = {"PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "TZ", "SYSTEMROOT"}
    result = {key: value for key, value in env.items()
              if key in kept or key.startswith("GITHUB_") or key.startswith("RUNNER_")}
    result.pop("GITHUB_TOKEN", None)
    result.update({"SOURCE_BUILD_RUN_ID": str(origin["source_build_run_id"]),
                   "SOURCE_BUILD_WORKFLOW_REF": origin["source_build_workflow_ref"],
                   "VERSION": VERSION, "SOURCE_SHA": SOURCE_SHA, "WEBCODEX_BUILT_AT": str(origin["built_at"]),
                   "BUILD_KIND": "release", "ARCHIVE_STEM": STEM, "INPUT_TAG": TAG,
                   "MACOS_SIGNING_MODE": "self-signed", "DESKTOP_DARWIN_X64_SUPPLEMENTAL": "true",
                   "INCLUDE_UNIFIED_INSTALLERS": "true", "INCLUDE_RUNTIME_INSTALLERS": "false",
                   "PYTHONDONTWRITEBYTECODE": "1", "PYTHONNOUSERSITE": "1"})
    _require(all(result.get(key) == value for key, value in env.items() if key.startswith("GITHUB_") and key != "GITHUB_TOKEN"),
             "assembly must never replace the actual GitHub runtime identity")
    return result


def _source_identity(origin: dict) -> dict:
    return {"run_id": origin["source_build_run_id"], "run_attempt": origin["source_build_run_attempt"],
            "request_id": origin["source_build_request_id"], "source_sha": origin["source_sha"],
            "tag": origin["tag"], "workflow_ref": origin["source_build_workflow_ref"],
            "tag_object_sha": origin["tag_object_sha"], "built_at": origin["built_at"]}


def _validate_records(records: object, expected_names: set[str]) -> None:
    _require(isinstance(records, dict) and set(records) == expected_names, "recovery file record set differs")
    for name, record in records.items():
        _require(isinstance(record, dict) and set(record) == {"size", "sha256"}
                 and _positive_int(record.get("size")) and record["size"] <= collector.MAX_MEMBER_BYTES
                 and isinstance(record.get("sha256"), str) and collector.SHA256_RE.fullmatch(record["sha256"]) is not None,
                 f"invalid recovery file record: {name}")


def validate_receipt(origin: dict, receipt: dict, assembly_context: dict, *, bundle_dir: Path | None = None) -> dict:
    validate_origin(origin)
    fields = {"schema_version", "kind", "origin_sha256", "source_build", "assembly", "inputs", "normalizations",
              "scripts", "public_inputs", "generated_public_files", "bundle_files", "summary_sha256"}
    _require(isinstance(receipt, dict) and set(receipt) == fields and type(receipt.get("schema_version")) is int
             and receipt["schema_version"] == 1 and receipt.get("kind") == RECEIPT_KIND
             and receipt.get("origin_sha256") == canonical_sha256(origin)
             and receipt.get("source_build") == _source_identity(origin), "recovery receipt origin or schema differs")
    observed = receipt.get("assembly")
    _require(isinstance(observed, dict) and set(observed) == set(assembly_context)
             and all(observed.get(key) == value for key, value in assembly_context.items() if key != "run_attempt")
             and _positive_int(observed.get("run_attempt")) and observed["run_attempt"] <= assembly_context["run_attempt"],
             "recovered bytes belong to a different assembly run, source or future attempt")
    inputs = receipt.get("inputs")
    _require(isinstance(inputs, list) and len(inputs) == len(origin["artifacts"]), "recovery receipt has an incomplete input set")
    expected_artifacts = {item["id"]: item for item in origin["artifacts"]}
    _require(all(isinstance(item, dict) and set(item) == {"id", "name", "size_in_bytes", "digest", "files"} for item in inputs)
             and {item["id"] for item in inputs} == set(expected_artifacts), "recovery input artifact ids differ")
    all_input_files: dict[str, dict] = {}
    for item in inputs:
        pin = expected_artifacts[item["id"]]
        _require(all(item[key] == value for key, value in pin.items()), "recovery input artifact digest or identity differs")
        _validate_records(item["files"], artifact_members()[pin["name"]])
        _require(not set(item["files"]) & set(all_input_files), "recovery input artifacts overlap")
        all_input_files.update(item["files"])
    _validate_records(receipt.get("public_inputs"), public_input_names())
    _require(all(receipt["public_inputs"][name] == all_input_files[name] for name in public_input_names()),
             "a public installer, archive, Desktop asset or source manifest was changed")
    normalizations = receipt.get("normalizations")
    targets = unix_sidecar_targets()
    _require(isinstance(normalizations, list) and len(normalizations) == len(targets)
             and all(isinstance(item, dict) and isinstance(item.get("name"), str) for item in normalizations)
             and {item["name"] for item in normalizations} == set(targets), "the receipt must describe exactly ten Unix sidecars")
    for item in normalizations:
        source_name = targets[item["name"]]
        digest = receipt["public_inputs"][source_name]["sha256"]
        before = f"{digest}  dist/{source_name}\n".encode("ascii")
        after = f"{digest}  {source_name}\n".encode("ascii")
        expected = {"name": item["name"], "source_filename": source_name,
                    "before_sha256": hashlib.sha256(before).hexdigest(), "after_sha256": hashlib.sha256(after).hexdigest(),
                    "before_size": len(before), "after_size": len(after)}
        _require(item == expected and all_input_files[item["name"]] == {"size": len(before), "sha256": expected["before_sha256"]},
                 "sidecar repair exceeds the exact verified dist/basename normalization")
    scripts = receipt.get("scripts")
    _require(isinstance(scripts, dict) and set(scripts) == set(STEP_SHA256), "recovery script evidence is incomplete")
    for name, expected in STEP_SHA256.items():
        item = scripts[name]
        _require(isinstance(item, dict) and set(item) == {"original_sha256", "executed_sha256"}
                 and item.get("original_sha256") == expected
                 and item.get("executed_sha256") == EXECUTED_STEP_SHA256[name], "recovery script SHA-256 evidence differs")
    _validate_records(receipt.get("generated_public_files"), set(GENERATED_PUBLIC_FILES))
    output_names = public_input_names() | set(GENERATED_PUBLIC_FILES) | set(INTERNAL_BUNDLE_FILES)
    _validate_records(receipt.get("bundle_files"), output_names)
    _require(all(receipt["bundle_files"][name] == record for name, record in receipt["public_inputs"].items())
             and all(receipt["bundle_files"][name] == record for name, record in receipt["generated_public_files"].items()),
             "recovery bundle changed public input bytes or generated metadata")
    _require(isinstance(receipt.get("summary_sha256"), str) and collector.SHA256_RE.fullmatch(receipt["summary_sha256"]) is not None,
             "recovery summary digest is invalid")
    if bundle_dir is not None:
        root = _safe_path(bundle_dir)
        _require(root.is_dir() and {path.name for path in root.iterdir()} == output_names, "retained recovery bundle member set differs")
        _require({name: file_record(root / name) for name in sorted(output_names)} == receipt["bundle_files"],
                 "retained recovery bundle bytes differ from the receipt")
        summary = collector.verify_bundle_directory(root, repo=REPO, run_id=BUILD_RUN_ID, expected_source_sha=SOURCE_SHA,
                                                     expected_tag=TAG, artifact_name=f"{STEM}-bundle",
                                                     require_unified_installers=True, require_runtime_installers=False)
        _require(canonical_sha256(summary) == receipt["summary_sha256"], "retained bundle validation differs from its receipt")
    return receipt


@contextlib.contextmanager
def _source_worktree(source_root: Path, directory: Path):
    command = ["git", "-c", "core.hooksPath=/dev/null", "-C", str(source_root)]
    result = subprocess.run([*command, "worktree", "add", "--detach", str(directory), SOURCE_SHA],
                            check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
    _require(result.returncode == 0, "could not create the isolated exact-source assembly worktree")
    try:
        publication._require_exact_clean_root(directory, SOURCE_SHA)
        yield directory
    finally:
        # This path is the private worktree created above, never a caller-owned checkout.
        subprocess.run([*command, "worktree", "remove", "--force", str(directory)],
                       check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)


def recover_assembly(*, origin: dict, source_root: Path, output_dir: Path,
                     client: collector.GitHubClient, env: Mapping[str, str] | None = None,
                     timeout: float = 120) -> tuple[dict, dict]:
    validate_origin(origin)
    values = dict(os.environ if env is None else env)
    context = assembly_context_from_env(values)
    _require(client.repo == REPO and 0 < timeout <= 600, "recovery API repository or timeout differs")
    source = _safe_path(source_root)
    destination = _safe_path(output_dir)
    _require(not destination.exists() and not destination.is_relative_to(source)
             and not source.is_relative_to(destination), "recovery output must be new and outside the original source checkout")
    publication._require_exact_clean_root(source, SOURCE_SHA)
    _require(publication._git(source, "rev-parse", "HEAD^{tree}") == SOURCE_TREE, "original source tree differs")
    publication._require_package_versions(source, VERSION, context="assembly recovery")
    steps = extract_original_steps((source / WORKFLOW_PATH).read_bytes(), origin)
    transformed = {name: adapt_source_identity(name, script) for name, script in steps.items()}
    _validate_assembly_run(client.fetch_json(f"/actions/runs/{context['run_id']}/attempts/{context['run_attempt']}"), context)
    validate_source_run(client.fetch_json(f"/actions/runs/{BUILD_RUN_ID}"), origin)
    validate_source_run(client.fetch_json(f"/actions/runs/{BUILD_RUN_ID}/attempts/{BUILD_ATTEMPT}"), origin)
    validate_source_jobs(client.fetch_json(f"/actions/runs/{BUILD_RUN_ID}/attempts/{BUILD_ATTEMPT}/jobs?per_page=100"), origin)
    artifacts = validate_source_artifacts(client.fetch_json(f"/actions/runs/{BUILD_RUN_ID}/artifacts?per_page=100"), origin)
    destination.parent.mkdir(parents=True, exist_ok=True)
    receipt: dict = {"schema_version": 1, "kind": RECEIPT_KIND, "origin_sha256": canonical_sha256(origin),
                    "source_build": _source_identity(origin), "assembly": context, "inputs": [], "normalizations": [],
                    "scripts": {name: {"original_sha256": STEP_SHA256[name], "executed_sha256": hashlib.sha256(script.encode()).hexdigest()}
                                for name, script in transformed.items()},
                    "public_inputs": {}, "generated_public_files": {}, "bundle_files": {}, "summary_sha256": ""}
    with tempfile.TemporaryDirectory(prefix=".webcodex-assembly-", dir=destination.parent) as temporary:
        private = Path(temporary)
        with _source_worktree(source, private / "source") as worktree:
            candidates = worktree / "candidate-input"
            candidates.mkdir(mode=0o700)
            byte_count = 0
            for index, artifact in enumerate(artifacts):
                archive = private / f"input-{index}.zip"
                client.download_artifact_zip(artifact["id"], archive, artifact["size_in_bytes"], collector._artifact_digest(artifact["digest"]))
                extracted = private / f"input-{index}"
                records = extract_candidate_artifact(archive, extracted, artifact["name"])
                byte_count += sum(item["size"] for item in records.values())
                _require(byte_count <= MAX_CANDIDATE_BYTES, "combined native candidate bytes exceed the recovery bound")
                merge_candidate_files(extracted, candidates, records)
                receipt["inputs"].append({**artifact, "files": records})
                shutil.rmtree(extracted)
                archive.unlink()
            expected_inputs = set().union(*artifact_members().values())
            _require({path.name for path in candidates.iterdir()} == expected_inputs, "merged native candidate set differs")
            receipt["public_inputs"] = {name: file_record(candidates / name) for name in sorted(public_input_names())}
            receipt["normalizations"] = normalize_unix_sidecars(candidates)
            execution_env = source_execution_env(origin, values)
            _require(bool(execution_env.get("GITHUB_STEP_SUMMARY")), "the real current GitHub step-summary path is required")
            for index, name in enumerate(STEP_SHA256):
                script = private / f"original-assembly-{index}.sh"
                script.write_text(transformed[name], encoding="utf-8")
                print(f"[assembly-recovery] running original step: {name}", flush=True)
                result = subprocess.run(["bash", "--noprofile", "--norc", str(script)], cwd=worktree,
                                        env=execution_env, check=False, timeout=ASSEMBLY_TIMEOUT)
                _require(result.returncode == 0, "the complete original assembly or verification step failed")
            bundle = worktree / "release-bundle"
            summary = collector.verify_bundle_directory(bundle, repo=REPO, run_id=BUILD_RUN_ID, expected_source_sha=SOURCE_SHA,
                                                         expected_tag=TAG, artifact_name=f"{STEM}-bundle",
                                                         require_unified_installers=True, require_runtime_installers=False)
            receipt["bundle_files"] = {path.name: file_record(path) for path in sorted(bundle.iterdir())}
            receipt["generated_public_files"] = {name: receipt["bundle_files"][name] for name in sorted(GENERATED_PUBLIC_FILES)}
            receipt["summary_sha256"] = canonical_sha256(summary)
            _require({name: file_record(candidates / name) for name in sorted(public_input_names())} == receipt["public_inputs"],
                     "original public input bytes changed during assembly")
            validate_receipt(origin, receipt, context)
            publication._require_exact_clean_root(source, SOURCE_SHA)
            _require(not destination.exists() and not destination.is_symlink(), "recovery output appeared concurrently")
            os.rename(bundle, destination)
    return summary, receipt


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Recover only the failed v0.5.2 assembly from fixed original native artifacts.")
    parser.add_argument("--origin", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--receipt-file", type=Path, required=True)
    parser.add_argument("--timeout", type=float, default=120)
    args = parser.parse_args(argv)
    try:
        receipt_path = _safe_path(args.receipt_file)
        _require(not receipt_path.exists() and not receipt_path.is_relative_to(args.output_dir.absolute()),
                 "receipt output must be new and outside the strict release bundle")
        origin = _read_json(args.origin)
        _require(collector.sha256_file(args.origin) == ORIGIN_FILE_SHA256, "origin document bytes differ from the reviewed input")
        client = collector.GitHubClient(REPO, collector.resolve_github_token(), args.timeout)
        summary, receipt = recover_assembly(origin=origin, source_root=args.source_root, output_dir=args.output_dir,
                                           client=client, timeout=args.timeout)
        receipt_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with receipt_path.open("xb") as output:
            output.write(_json_bytes(receipt))
        print(json.dumps({"summary": summary, "receipt_file": str(receipt_path)}, sort_keys=True))
        return 0
    except (AssemblyRecoveryError, collector.CollectionError, publication.PublicationError, OSError,
            ValueError, TypeError, KeyError, subprocess.SubprocessError) as exc:
        # Network exceptions may contain signed artifact URLs; keep them out of logs.
        print(f"assembly recovery failed ({type(exc).__name__}); retained source and published bytes were not replaced", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
