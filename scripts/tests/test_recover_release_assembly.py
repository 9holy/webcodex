"""Recovery boundaries for the fixed native run; no builds or GitHub writes."""

from __future__ import annotations

import contextlib
import copy
import hashlib
import json
import os
import shutil
import stat
import subprocess
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path
from unittest import mock

from scripts import recover_release_assembly as recovery


ROOT = Path(__file__).resolve().parents[2]
ORIGIN_PATH = ROOT / ".github/release-requests/v0.5.2-assembly-recovery.json"
SOURCE = "2299ffe5bcc0f3965e11b753fabc3fb558769de8"
RUN = 42373155729
ASSEMBLY_RUN = 42380000001
CONTROL = "d" * 40


def origin() -> dict:
    return json.loads(ORIGIN_PATH.read_bytes())


def original_workflow() -> bytes:
    # The forward producer fix changes exactly these four lines. Reconstruct
    # the frozen input fixture without requiring history in a shallow checkout.
    text = (ROOT / ".github/workflows/release-build.yml").read_text(encoding="utf-8")
    prefix_text, text = text.split("\n  unified-native:\n", 1)
    for command in ("sha256sum", "shasum -a 256"):
        for variable in ("source_name", "filename"):
            indent = 10 if command == "shasum -a 256" else (14 if variable == "source_name" else 16)
            prefix = "\n" + " " * indent
            fixed = prefix + f'(cd dist && {command} "${variable}" > "${variable}.sha256")'
            old = prefix + f'{command} "dist/${variable}" > "dist/${variable}.sha256"'
            if text.count(fixed) != 1:
                raise AssertionError("the forward producer fix no longer has its reviewed four-line scope")
            text = text.replace(fixed, old)
    data = (prefix_text + "\n  unified-native:\n" + text).encode("utf-8")
    if hashlib.sha256(data).hexdigest() != "16b4742ec1f8eee5203a48d5635332a0c89b21a94c75a112a6849129597032ba":
        raise AssertionError("the frozen v0.5.2 workflow fixture differs")
    return data


def environment() -> dict[str, str]:
    return {
        "PATH": os.environ.get("PATH", os.defpath),
        "GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": "9holy/webcodex",
        "GITHUB_REPOSITORY_ID": "1404596174", "GITHUB_REF": "refs/heads/main",
        "GITHUB_RUN_ID": str(ASSEMBLY_RUN), "GITHUB_RUN_ATTEMPT": "1",
        "GITHUB_SHA": CONTROL, "GITHUB_WORKFLOW_SHA": CONTROL,
        "GITHUB_WORKFLOW_REF": "9holy/webcodex/.github/workflows/release-assembly-recovery.yml@refs/heads/main",
        "GITHUB_JOB": "assemble", "GITHUB_STEP_SUMMARY": "/tmp/current-job-summary",
        "GITHUB_TOKEN": "test-never-in-child", "GH_TOKEN": "test-never-in-child",
        "BASH_ENV": "/untrusted/startup", "PYTHONPATH": "/untrusted/python",
    }


def source_run() -> dict:
    repo = {"id": 1404596174, "full_name": "9holy/webcodex"}
    return {
        "id": RUN, "run_attempt": 1, "head_sha": SOURCE, "head_branch": "v0.5.2",
        "path": ".github/workflows/release-build.yml", "event": "workflow_dispatch",
        "display_title": "Release build v0.5.2 rb_d71b1111926a9ef697d21eb1",
        "status": "completed", "conclusion": "failure", "repository": repo,
        "head_repository": copy.deepcopy(repo),
    }


def jobs_payload() -> dict:
    required = {
        "preflight": ["Fail fast on deterministic release contracts"],
        "prepare": ["Require immutable tagged workflow source", "Resolve immutable release metadata"],
        "linux": ["Build and verify inside glibc 2.17 userspace", "Upload Linux candidate"],
        "macos": ["Configure persistent macOS signing", "Build and verify native macOS candidate", "Upload macOS candidate"],
        "windows": [
            "Build and verify native Windows candidate", "Smoke native Windows artifact through npm installer",
            "Stage exact native Windows runtime for Desktop", "Build unsigned native Windows Desktop NSIS candidate",
            "Smoke native Windows Desktop NSIS candidate", "Collect native Windows unified installer inputs",
            "Build native Tauri payload and outer Windows bootstrap", "Upload Windows unified installer and provenance",
            "Upload Windows candidate", "Upload native Windows Desktop candidate",
        ],
        "unified-linux": ["Fence exact clean source before generated inputs", "Upload native Linux/macOS unified installer",
                          "Build and package Linux installer in Ubuntu 22.04 native container"],
        "unified-macos": ["Fence exact clean source before generated inputs", "Upload native Linux/macOS unified installer",
                          "Verify native host and prepare exact runtime inputs", "Configure persistent macOS signing",
                          "Install frontend dependencies and build Desktop", "Collect and package macOS installer"],
    }
    jobs = []
    for pin in origin()["jobs"]:
        name = pin["name"]
        if name == "runtime-native":
            steps = []
        elif name == "assemble":
            steps = [
                ("Download same-run native candidates", "success"),
                ("Verify and assemble one release bundle", "failure"),
                ("Verify complete selected bundle", "skipped"),
                ("Upload assembled candidate set", "skipped"),
            ]
        else:
            family = name.split(" ", 1)[0]
            if family == "unified-native":
                family = "unified-linux" if "(linux-" in name else "unified-macos"
            names = list(required[family])
            if name.startswith("macos (darwin-arm64,"):
                names += ["Stage exact native runtime for macOS Desktop", "Build native macOS Desktop DMG",
                          "Smoke native macOS Desktop DMG and signing evidence"]
            steps = [(step, "success") for step in names]
        jobs.append({**pin, "run_id": RUN, "run_attempt": 1, "head_sha": SOURCE, "status": "completed",
                     "steps": [{"number": i + 1, "name": name, "status": "completed", "conclusion": conclusion}
                               for i, (name, conclusion) in enumerate(steps)]})
    return {"total_count": len(jobs), "jobs": jobs}


def artifacts_payload() -> dict:
    metadata = {"id": RUN, "repository_id": 1404596174, "head_repository_id": 1404596174,
                "head_sha": SOURCE, "head_branch": "v0.5.2"}
    items = [{**pin, "expired": False, "workflow_run": copy.deepcopy(metadata)} for pin in origin()["artifacts"]]
    items.append({"id": 13575257207, "name": "dmg-diagnostics-darwin-arm64-1", "size_in_bytes": 64,
                  "digest": "sha256:" + "a" * 64, "expired": False, "workflow_run": metadata})
    return {"total_count": len(items), "artifacts": items}


def candidate_bytes() -> dict[str, bytes]:
    names = set().union(*recovery.artifact_members().values())
    result = {name: ("synthetic existing native output: " + name).encode("ascii") for name in names}
    for sidecar, source in recovery.unix_sidecar_targets().items():
        result[sidecar] = f"{hashlib.sha256(result[source]).hexdigest()}  dist/{source}\n".encode("ascii")
    return result


def write_files(root: Path, files: dict[str, bytes]) -> None:
    root.mkdir(parents=True, exist_ok=True)
    for name, data in files.items():
        (root / name).write_bytes(data)


def record(data: bytes) -> dict:
    return {"size": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def receipt_fixture(root: Path) -> tuple[dict, dict, dict]:
    pinned = origin()
    data = candidate_bytes()
    write_files(root, data)
    context = recovery.assembly_context_from_env(environment())
    public = {name: record(data[name]) for name in recovery.public_input_names()}
    generated = {name: record(("generated:" + name).encode()) for name in recovery.GENERATED_PUBLIC_FILES}
    internal = {name: record(("internal:" + name).encode()) for name in recovery.INTERNAL_BUNDLE_FILES}
    receipt = {
        "schema_version": 1, "kind": "webcodex-v0.5.2-assembly-recovery-receipt",
        "origin_sha256": recovery.canonical_sha256(pinned),
        "source_build": {
            "run_id": RUN, "run_attempt": 1, "request_id": "rb_d71b1111926a9ef697d21eb1",
            "source_sha": SOURCE, "tag": "v0.5.2",
            "workflow_ref": "9holy/webcodex/.github/workflows/release-build.yml@refs/tags/v0.5.2",
            "tag_object_sha": "d85163dc707e45ac8c014eeec67ffa529b78e1c9", "built_at": 1794054750,
        },
        "assembly": context,
        "inputs": [{**pin, "files": {name: record(data[name]) for name in recovery.artifact_members()[pin["name"]]}}
                   for pin in pinned["artifacts"]],
        "normalizations": recovery.normalize_unix_sidecars(root),
        "scripts": {name: {"original_sha256": recovery.STEP_SHA256[name], "executed_sha256": recovery.EXECUTED_STEP_SHA256[name]}
                    for name in recovery.STEP_SHA256},
        "public_inputs": public, "generated_public_files": generated,
        "bundle_files": {**public, **generated, **internal},
        "summary_sha256": hashlib.sha256(b"synthetic verification summary").hexdigest(),
    }
    return pinned, receipt, context


class RecoveryEvidenceTests(unittest.TestCase):
    def test_fixed_origin_and_exact_artifact_names(self) -> None:
        self.assertEqual(recovery.validate_origin(origin()), origin())
        self.assertEqual(hashlib.sha256(ORIGIN_PATH.read_bytes()).hexdigest(), recovery.ORIGIN_FILE_SHA256)
        members = recovery.artifact_members()
        self.assertEqual(set(members), {item["name"] for item in origin()["artifacts"]})
        self.assertEqual((len(members), sum(map(len, members.values())), len(set().union(*members.values()))), (14, 55, 55))
        self.assertEqual((len(recovery.public_input_names()), len(recovery.unix_sidecar_targets())), (23, 10))
        self.assertFalse(any("runtime-" in name or "diagnostics" in name for name in recovery.public_input_names()))

    def test_origin_has_no_alternate_run_source_artifact_or_script(self) -> None:
        for key, value in (("source_build_run_id", RUN + 1), ("source_build_run_attempt", 2),
                           ("source_sha", "a" * 40), ("include_runtime_installers", True)):
            changed = origin()
            changed[key] = value
            with self.subTest(field=key), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.validate_origin(changed)
        for field in ("id", "digest", "size_in_bytes"):
            changed = origin()
            changed["artifacts"][0][field] = "different"
            with self.subTest(artifact=field), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.validate_origin(changed)

    def test_source_run_is_failed_original_attempt_not_new_assembly(self) -> None:
        recovery.validate_source_run(source_run(), origin())
        changes = {"id": ASSEMBLY_RUN, "run_attempt": 2, "head_sha": "c" * 40, "head_branch": "main",
                   "path": ".github/workflows/other.yml", "event": "pull_request", "conclusion": "success",
                   "display_title": "Release build v0.5.2 rb_other"}
        for field, value in changes.items():
            run = source_run()
            run[field] = value
            with self.subTest(field=field), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.validate_source_run(run, origin())
        run = source_run()
        run["head_repository"]["id"] += 1
        with self.assertRaises(recovery.AssemblyRecoveryError):
            recovery.validate_source_run(run, origin())

    def test_all_native_producers_and_validation_steps_must_succeed(self) -> None:
        recovery.validate_source_jobs(jobs_payload(), origin())
        for index, job in enumerate(jobs_payload()["jobs"]):
            if job["conclusion"] != "success":
                continue
            payload = jobs_payload()
            payload["jobs"][index]["steps"][0]["conclusion"] = "skipped"
            with self.subTest(job=job["name"]), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.validate_source_jobs(payload, origin())

    def test_assembly_failure_cannot_hide_failed_upload_or_other_step(self) -> None:
        payload = jobs_payload()
        assembly = next(job for job in payload["jobs"] if job["name"] == "assemble")
        assembly["steps"][0]["conclusion"] = "failure"
        with self.assertRaises(recovery.AssemblyRecoveryError):
            recovery.validate_source_jobs(payload, origin())
        payload = jobs_payload()
        payload["jobs"][0]["run_attempt"] = 2
        with self.assertRaises(recovery.AssemblyRecoveryError):
            recovery.validate_source_jobs(payload, origin())
        payload = jobs_payload()
        payload["jobs"].pop()
        with self.assertRaises(recovery.AssemblyRecoveryError):
            recovery.validate_source_jobs(payload, origin())

    def test_artifact_selection_excludes_diagnostics_and_pins_downloads(self) -> None:
        selected = recovery.validate_source_artifacts(artifacts_payload(), origin())
        self.assertEqual(selected, origin()["artifacts"])
        for field, value in (("id", 1), ("size_in_bytes", 1), ("digest", "sha256:" + "0" * 64),
                             ("expired", True), ("name", "replacement")):
            payload = artifacts_payload()
            payload["artifacts"][0][field] = value
            with self.subTest(field=field), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.validate_source_artifacts(payload, origin())

    def test_artifact_provenance_cross_run_or_extra_unknown_artifact_fails(self) -> None:
        for field, value in (("id", RUN + 1), ("repository_id", 1), ("head_repository_id", 1),
                             ("head_sha", "b" * 40), ("head_branch", "main")):
            payload = artifacts_payload()
            payload["artifacts"][0]["workflow_run"][field] = value
            with self.subTest(field=field), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.validate_source_artifacts(payload, origin())
        payload = artifacts_payload()
        payload["artifacts"][-1]["name"] = "unreviewed-output"
        with self.assertRaises(recovery.AssemblyRecoveryError):
            recovery.validate_source_artifacts(payload, origin())


class RecoveryFilesTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)

    def make_zip(self, *, altered_name: str | None = None, duplicate: bool = False,
                 symlink: bool = False, directory: bool = False) -> tuple[Path, str]:
        artifact = "webcodex-v0.5.2-linux-x64"
        archive = self.root / "candidate.zip"
        names = sorted(recovery.artifact_members()[artifact])
        with warnings.catch_warnings(), zipfile.ZipFile(archive, "w") as handle:
            warnings.simplefilter("ignore", UserWarning)
            for index, name in enumerate(names):
                actual = altered_name if index == 0 and altered_name is not None else name
                entry = zipfile.ZipInfo(actual)
                entry.create_system = 3
                entry.external_attr = ((stat.S_IFLNK if symlink and index == 0 else
                                        stat.S_IFDIR if directory and index == 0 else stat.S_IFREG) | 0o600) << 16
                handle.writestr(entry, b"native fixture")
            if duplicate:
                handle.writestr(names[0], b"duplicate")
        return archive, artifact

    def test_flat_zip_exact_members_extract_without_overwrite(self) -> None:
        archive, artifact = self.make_zip()
        target = self.root / "out"
        records = recovery.extract_candidate_artifact(archive, target, artifact)
        self.assertEqual(set(records), recovery.artifact_members()[artifact])
        with self.assertRaises(recovery.AssemblyRecoveryError):
            recovery.extract_candidate_artifact(archive, target, artifact)
        self.assertEqual({p.read_bytes() for p in target.iterdir()}, {b"native fixture"})

    def test_zip_paths_unknown_members_duplicates_symlinks_and_directories_fail(self) -> None:
        cases = [{"altered_name": "../escape"}, {"altered_name": "/escape"},
                 {"altered_name": "dist/nested"}, {"altered_name": "dist\\nested"},
                 {"altered_name": "unrequested.exe"}, {"duplicate": True}, {"symlink": True}, {"directory": True}]
        for index, args in enumerate(cases):
            archive, artifact = self.make_zip(**args)
            with self.subTest(args=args), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.extract_candidate_artifact(archive, self.root / f"out-{index}", artifact)
        self.assertFalse((self.root.parent / "escape").exists())

    def test_existing_collector_size_limits_still_apply(self) -> None:
        archive, artifact = self.make_zip()
        with mock.patch.object(recovery.collector, "MAX_MEMBER_BYTES", 2), self.assertRaises(recovery.AssemblyRecoveryError):
            recovery.extract_candidate_artifact(archive, self.root / "out", artifact)

    def test_encrypted_zip_member_fails_before_extraction(self) -> None:
        archive, artifact = self.make_zip()
        data = bytearray(archive.read_bytes())
        data[data.index(b"PK\x03\x04") + 6] |= 1
        data[data.index(b"PK\x01\x02") + 8] |= 1
        archive.write_bytes(data)
        with mock.patch.object(recovery.collector, "safe_extract_zip") as extract:
            with self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.extract_candidate_artifact(archive, self.root / "out", artifact)
            extract.assert_not_called()

    def test_merge_checks_all_collisions_before_copying_any_file(self) -> None:
        source = self.root / "input"
        target = self.root / "merged"
        names = sorted(recovery.artifact_members()["webcodex-v0.5.2-linux-x64"])
        write_files(source, {name: b"original" for name in names})
        write_files(target, {names[-1]: b"prior producer"})
        records = {name: recovery.file_record(source / name) for name in names}
        with self.assertRaises(recovery.AssemblyRecoveryError):
            recovery.merge_candidate_files(source, target, records)
        self.assertEqual({p.name for p in target.iterdir()}, {names[-1]})
        self.assertEqual((target / names[-1]).read_bytes(), b"prior producer")

    def test_all_ten_sidecars_normalize_while_public_inputs_stay_identical(self) -> None:
        data = candidate_bytes()
        write_files(self.root, data)
        changes = recovery.normalize_unix_sidecars(self.root)
        self.assertEqual(len(changes), 10)
        changed_names = {name for name, before in data.items() if (self.root / name).read_bytes() != before}
        self.assertEqual(changed_names, set(recovery.unix_sidecar_targets()))
        for name in recovery.public_input_names():
            self.assertEqual((self.root / name).read_bytes(), data[name])
        for change in changes:
            self.assertEqual(change["before_sha256"], hashlib.sha256(data[change["name"]]).hexdigest())
            self.assertEqual(change["after_size"], change["before_size"] - 5)

    def test_bad_sidecar_fails_before_any_repair(self) -> None:
        cases = [lambda b: b.replace(b"  dist/", b" dist/"), lambda b: b.replace(b"\n", b"\r\n"),
                 lambda b: b.rstrip(b"\n"), lambda b: b + b"another row\n",
                 lambda b: b.replace(b"dist/", b"../"), lambda b: b.replace(b"dist/", b""),
                 lambda b: b"0" * 64 + b[64:]]
        last = sorted(recovery.unix_sidecar_targets())[-1]
        for index, transform in enumerate(cases):
            data = candidate_bytes()
            data[last] = transform(data[last])
            root = self.root / str(index)
            write_files(root, data)
            with self.subTest(index=index), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.normalize_unix_sidecars(root)
            self.assertEqual({name: (root / name).read_bytes() for name in data}, data)

    def test_sidecar_never_accepts_a_matching_name_with_changed_payload(self) -> None:
        data = candidate_bytes()
        target = next(iter(recovery.unix_sidecar_targets().values()))
        data[target] += b"tampered"
        write_files(self.root, data)
        with self.assertRaises(recovery.AssemblyRecoveryError):
            recovery.normalize_unix_sidecars(self.root)

    def test_sidecar_symlink_is_not_followed(self) -> None:
        data = candidate_bytes()
        write_files(self.root, data)
        name = next(iter(recovery.unix_sidecar_targets()))
        outside = self.root / "external"
        outside.write_bytes(data[name])
        (self.root / name).unlink()
        (self.root / name).symlink_to(outside)
        with self.assertRaises(recovery.AssemblyRecoveryError):
            recovery.normalize_unix_sidecars(self.root)
        self.assertEqual(outside.read_bytes(), data[name])


class RecoveryIdentityAndReceiptTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)

    def test_exact_original_scripts_only_replace_production_identity_aliases(self) -> None:
        steps = recovery.extract_original_steps(original_workflow(), origin())
        self.assertEqual(set(steps), {"Verify and assemble one release bundle", "Verify complete selected bundle"})
        for name, script in steps.items():
            transformed = recovery.adapt_source_identity(name, script)
            self.assertEqual(transformed.replace("SOURCE_BUILD_RUN_ID", "GITHUB_RUN_ID")
                             .replace("SOURCE_BUILD_WORKFLOW_REF", "GITHUB_WORKFLOW_REF"), script)
            self.assertEqual(hashlib.sha256(transformed.encode()).hexdigest(), recovery.EXECUTED_STEP_SHA256[name])
            with self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.adapt_source_identity(name, script + "\ntrue\n")
        with self.assertRaises(recovery.AssemblyRecoveryError):
            recovery.extract_original_steps(original_workflow() + b"\n", origin())

    def test_execution_preserves_real_github_identity_and_omits_credentials(self) -> None:
        values = environment()
        execution = recovery.source_execution_env(origin(), values)
        for key in ("GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT", "GITHUB_WORKFLOW_REF", "GITHUB_SHA", "GITHUB_STEP_SUMMARY"):
            self.assertEqual(execution[key], values[key])
        self.assertEqual(execution["SOURCE_BUILD_RUN_ID"], str(RUN))
        self.assertEqual(execution["SOURCE_BUILD_WORKFLOW_REF"], origin()["source_build_workflow_ref"])
        self.assertEqual(execution["INCLUDE_RUNTIME_INSTALLERS"], "false")
        for key in ("GITHUB_TOKEN", "GH_TOKEN", "BASH_ENV", "PYTHONPATH"):
            self.assertNotIn(key, execution)

    def test_assembly_context_cannot_impersonate_producer_or_other_source(self) -> None:
        for key, value in (("GITHUB_RUN_ID", str(RUN)), ("GITHUB_RUN_ATTEMPT", "0"),
                           ("GITHUB_REPOSITORY_ID", "1"), ("GITHUB_REF", "refs/tags/v0.5.2"),
                           ("GITHUB_WORKFLOW_SHA", "a" * 40),
                           ("GITHUB_WORKFLOW_REF", "other/repo/.github/workflows/recovery.yml@refs/heads/main")):
            values = environment()
            values[key] = value
            with self.subTest(field=key), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.assembly_context_from_env(values)

    def test_receipt_keeps_original_and_current_run_distinct_and_allows_same_run_resume(self) -> None:
        pinned, receipt, context = receipt_fixture(self.root)
        recovery.validate_receipt(pinned, receipt, context)
        recovery.validate_receipt(pinned, receipt, {**context, "run_attempt": 2})
        self.assertEqual(receipt["source_build"]["run_id"], RUN)
        self.assertEqual(receipt["assembly"]["run_id"], ASSEMBLY_RUN)
        for field, value in (("run_id", ASSEMBLY_RUN + 1), ("control_sha", "b" * 40),
                             ("job", "different"), ("run_attempt", 0)):
            with self.subTest(field=field), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.validate_receipt(pinned, receipt, {**context, field: value})

    def test_receipt_rejects_modified_public_bytes_artifact_binding_or_script(self) -> None:
        pinned, base, context = receipt_fixture(self.root)
        changed = copy.deepcopy(base)
        changed["public_inputs"][next(iter(changed["public_inputs"]))]["sha256"] = "0" * 64
        changed_input = copy.deepcopy(base)
        changed_input["inputs"][0]["digest"] = "sha256:" + "0" * 64
        changed_script = copy.deepcopy(base)
        changed_script["scripts"][recovery.VERIFY_STEP]["executed_sha256"] = "0" * 64
        changed_normalization = copy.deepcopy(base)
        changed_normalization["normalizations"][0]["after_sha256"] = "0" * 64
        changed_source = copy.deepcopy(base)
        changed_source["source_build"]["run_id"] = ASSEMBLY_RUN
        for index, value in enumerate((changed, changed_input, changed_script, changed_normalization, changed_source)):
            with self.subTest(index=index), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.validate_receipt(pinned, value, context)

    def test_receipt_rejects_unexpected_public_files_or_embedded_receipt(self) -> None:
        pinned, base, context = receipt_fixture(self.root)
        for name in ("npm-package.tgz", "assembly-recovery-receipt.json", "webcodex-desktop-v0.5.2-darwin-x64.dmg"):
            changed = copy.deepcopy(base)
            changed["bundle_files"][name] = record(b"unrequested")
            with self.subTest(name=name), self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.validate_receipt(pinned, changed, context)

    def test_retained_bundle_changed_bytes_fail_before_collector(self) -> None:
        pinned, receipt, context = receipt_fixture(self.root / "input")
        bundle = self.root / "bundle"
        data = candidate_bytes()
        write_files(bundle, {name: data[name] for name in recovery.public_input_names()})
        write_files(bundle, {name: ("generated:" + name).encode() for name in recovery.GENERATED_PUBLIC_FILES})
        write_files(bundle, {name: ("internal:" + name).encode() for name in recovery.INTERNAL_BUNDLE_FILES})
        with mock.patch.object(recovery.collector, "verify_bundle_directory") as verifier:
            (bundle / next(iter(recovery.public_input_names()))).write_bytes(b"tampered retained bytes")
            with self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.validate_receipt(pinned, receipt, context, bundle_dir=bundle)
            verifier.assert_not_called()

    def test_retained_bundle_requires_full_original_provenance_and_summary_digest(self) -> None:
        pinned, receipt, context = receipt_fixture(self.root / "input")
        bundle = self.root / "bundle"
        data = candidate_bytes()
        write_files(bundle, {name: data[name] for name in recovery.public_input_names()})
        write_files(bundle, {name: ("generated:" + name).encode() for name in recovery.GENERATED_PUBLIC_FILES})
        write_files(bundle, {name: ("internal:" + name).encode() for name in recovery.INTERNAL_BUNDLE_FILES})
        summary = {"workflow_run_id": RUN, "source_sha": SOURCE, "tag": "v0.5.2"}
        receipt["summary_sha256"] = recovery.canonical_sha256(summary)
        with mock.patch.object(recovery.collector, "verify_bundle_directory", return_value=summary) as verifier:
            recovery.validate_receipt(pinned, receipt, context, bundle_dir=bundle)
            verifier.assert_called_once_with(bundle, repo="9holy/webcodex", run_id=RUN,
                                             expected_source_sha=SOURCE, expected_tag="v0.5.2",
                                             artifact_name="webcodex-v0.5.2-bundle",
                                             require_unified_installers=True, require_runtime_installers=False)
            verifier.return_value = {**summary, "workflow_run_id": ASSEMBLY_RUN}
            with self.assertRaises(recovery.AssemblyRecoveryError):
                recovery.validate_receipt(pinned, receipt, context, bundle_dir=bundle)

    def test_disposable_worktree_does_not_change_source_checkout(self) -> None:
        if not shutil.which("git"):
            self.skipTest("worktree isolation requires git")
        source = self.root / "source"
        source.mkdir()
        def git(*args: str) -> str:
            result = subprocess.run(["git", "-c", "core.hooksPath=/dev/null", "-C", str(source), *args],
                                    check=True, capture_output=True, text=True, timeout=10)
            return result.stdout.strip()
        git("init", "--quiet")
        git("config", "user.name", "Recovery fixture")
        git("config", "user.email", "fixture@example.invalid")
        (source / "source.txt").write_text("unchanged original")
        git("add", "source.txt")
        git("commit", "--quiet", "-m", "isolated recovery fixture")
        sha = git("rev-parse", "HEAD")
        destination = self.root / "temporary-worktree"
        with mock.patch.object(recovery, "SOURCE_SHA", sha):
            with self.assertRaisesRegex(RuntimeError, "fixture interruption"):
                with recovery._source_worktree(source, destination) as worktree:
                    (worktree / "source.txt").write_text("private staging change")
                    self.assertEqual((source / "source.txt").read_text(), "unchanged original")
                    raise RuntimeError("fixture interruption")
        self.assertFalse(destination.exists())
        self.assertEqual(git("rev-parse", "HEAD"), sha)
        self.assertEqual(git("status", "--porcelain"), "")
        self.assertNotIn(str(destination), git("worktree", "list", "--porcelain"))


class RecoveryExecutionTests(unittest.TestCase):
    """Exercise orchestration with transport and native semantic validation mocked.

    ZIP safety, hashing, source checksums, script binding and receipts remain real.
    Existing collector tests own transport digest and native archive validation.
    """

    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.source = self.root / "original-source"
        workflow = self.source / ".github/workflows/release-build.yml"
        workflow.parent.mkdir(parents=True)
        workflow.write_bytes(original_workflow())
        self.output = self.root / "completed-bundle"
        self.client = mock.Mock(spec=recovery.collector.GitHubClient)
        self.client.repo = "9holy/webcodex"
        self.downloads = []
        self.executed = []
        self.data = candidate_bytes()
        self.summary = {"source_sha": SOURCE, "run_id": RUN, "tag": "v0.5.2", "verified": True}

        def fetch(suffix: str) -> dict:
            if suffix == f"/actions/runs/{ASSEMBLY_RUN}/attempts/1":
                result = source_run()
                result.update({"id": ASSEMBLY_RUN, "head_sha": CONTROL, "head_branch": "main",
                               "path": ".github/workflows/release-assembly-recovery.yml"})
                return result
            if suffix in (f"/actions/runs/{RUN}", f"/actions/runs/{RUN}/attempts/1"):
                return source_run()
            if suffix == f"/actions/runs/{RUN}/attempts/1/jobs?per_page=100":
                return jobs_payload()
            if suffix == f"/actions/runs/{RUN}/artifacts?per_page=100":
                return artifacts_payload()
            raise AssertionError("unreviewed API read")

        def download(artifact_id: int, path: Path, expected_size: int, expected_digest: str) -> None:
            pin = next(item for item in origin()["artifacts"] if item["id"] == artifact_id)
            self.assertEqual((expected_size, expected_digest), (pin["size_in_bytes"], pin["digest"][7:]))
            self.downloads.append(artifact_id)
            with zipfile.ZipFile(path, "w") as handle:
                for name in sorted(recovery.artifact_members()[pin["name"]]):
                    handle.writestr(name, self.data[name])

        @contextlib.contextmanager
        def worktree(source: Path, destination: Path):
            self.assertEqual(source, self.source)
            destination.mkdir()
            yield destination

        def execute(argv: list[str], **kwargs) -> subprocess.CompletedProcess:
            script = Path(argv[-1]).read_text()
            self.executed.append((script, kwargs["env"]))
            if len(self.executed) == 1:
                worktree = kwargs["cwd"]
                bundle = worktree / "release-bundle"
                bundle.mkdir()
                for name in recovery.public_input_names():
                    shutil.copyfile(worktree / "candidate-input" / name, bundle / name)
                for name in recovery.GENERATED_PUBLIC_FILES | recovery.INTERNAL_BUNDLE_FILES:
                    (bundle / name).write_text("generated fixture: " + name)
            return subprocess.CompletedProcess(argv, 0)

        self.client.fetch_json.side_effect = fetch
        self.client.download_artifact_zip.side_effect = download
        stack = contextlib.ExitStack()
        self.addCleanup(stack.close)
        self.clean_check = stack.enter_context(mock.patch.object(recovery.publication, "_require_exact_clean_root"))
        stack.enter_context(mock.patch.object(recovery.publication, "_git", return_value=recovery.SOURCE_TREE))
        stack.enter_context(mock.patch.object(recovery.publication, "_require_package_versions"))
        stack.enter_context(mock.patch.object(recovery, "_source_worktree", side_effect=worktree))
        self.execute = stack.enter_context(mock.patch.object(recovery.subprocess, "run", side_effect=execute))
        self.verify = stack.enter_context(mock.patch.object(recovery.collector, "verify_bundle_directory", return_value=self.summary))

    def recover(self) -> tuple[dict, dict]:
        return recovery.recover_assembly(origin=origin(), source_root=self.source, output_dir=self.output,
                                         client=self.client, env=environment())

    def test_all_original_inputs_and_both_exact_scripts_are_required(self) -> None:
        summary, receipt = self.recover()
        self.assertEqual(summary, self.summary)
        self.assertEqual(self.downloads, [item["id"] for item in origin()["artifacts"]])
        self.assertEqual(len(self.executed), 2)
        for (script, env), name in zip(self.executed, (recovery.ASSEMBLE_STEP, recovery.VERIFY_STEP), strict=True):
            self.assertEqual(hashlib.sha256(script.encode()).hexdigest(), recovery.EXECUTED_STEP_SHA256[name])
            self.assertEqual(env["GITHUB_RUN_ID"], str(ASSEMBLY_RUN))
            self.assertEqual(env["SOURCE_BUILD_RUN_ID"], str(RUN))
        for name in recovery.public_input_names():
            self.assertEqual((self.output / name).read_bytes(), self.data[name])
        self.assertEqual(len(list(self.output.iterdir())), 29)
        self.assertEqual(self.verify.call_args.kwargs["run_id"], RUN)
        self.assertEqual(receipt["source_build"]["run_id"], RUN)
        self.assertEqual(receipt["assembly"]["run_id"], ASSEMBLY_RUN)
        self.assertEqual(self.clean_check.call_count, 2)
        self.assertFalse(list(self.root.glob(".webcodex-assembly-*")))

    def test_failed_original_verifier_never_produces_recovery_output(self) -> None:
        first = self.execute.side_effect
        def execute(argv: list[str], **kwargs) -> subprocess.CompletedProcess:
            result = first(argv, **kwargs)
            if len(self.executed) == 2:
                result.returncode = 1
            return result
        self.execute.side_effect = execute
        with self.assertRaises(recovery.AssemblyRecoveryError):
            self.recover()
        self.assertEqual(len(self.executed), 2)
        self.verify.assert_not_called()
        self.assertFalse(self.output.exists())
        self.assertFalse(list(self.root.glob(".webcodex-assembly-*")))

    def test_existing_output_or_dirty_source_stops_before_download(self) -> None:
        write_files(self.output, {"retained": b"do not replace"})
        with self.assertRaises(recovery.AssemblyRecoveryError):
            self.recover()
        self.assertEqual((self.output / "retained").read_bytes(), b"do not replace")
        shutil.rmtree(self.output)
        self.clean_check.side_effect = recovery.publication.PublicationError("dirty source")
        with self.assertRaises(recovery.publication.PublicationError):
            self.recover()
        self.client.fetch_json.assert_not_called()
        self.client.download_artifact_zip.assert_not_called()


if __name__ == "__main__":
    unittest.main()
