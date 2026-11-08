from __future__ import annotations

import copy
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from scripts import release_github_actions as base
from scripts import release_github_actions_v054 as staged
from scripts import release_github_actions_v055 as v055
from scripts import release_windows_acceptance as worker
from scripts import verify_public_release as public


def assets(version="0.5.4"):
    names = {"SHA256SUMS", "manifest.json", "webcodex-release-manifest.json"}
    names.update(public.canonical_archive_name(version, platform) for platform in public.PLATFORMS)
    names.update(public.canonical_source_manifest_name(version, platform) for platform in public.PLATFORMS)
    names.update(public.canonical_installer_name(version, target) for target in public.INSTALLER_TARGETS)
    names.update(public.canonical_desktop_name(version, platform) for platform in public.desktop_platforms_for_version(version))
    return {name: {"name": name, "size": 42, "sha256": hashlib.sha256(name.encode()).hexdigest()} for name in sorted(names)}


def request(spec=staged.SPEC):
    return {"schema_version": 1, "repo": "9holy/webcodex", "repo_id": 1404596174,
        "tag": "v0.5.4", "source_sha": spec.pinned_request["source_sha"], "control_sha": "b" * 40,
        "request_id": "wa_" + "1" * 32, "controller_run_id": 123, "controller_workflow": spec.workflow_path,
        "release_id": 234, "tag_object_sha": "a" * 40, "build_run_id": 345, "build_run_attempt": 1,
        "release_body_sha256": hashlib.sha256(b"reviewed release").hexdigest(), "assets": assets()}


def release(request):
    return {"id": request["release_id"], "tag_name": request["tag"], "name": f"WebCodex {request['tag']}",
        "body": "reviewed release", "draft": False, "prerelease": True, "published_at": "2026-11-01T00:00:00Z",
        "author": {"id": base.BOT_ID, "login": base.BOT_LOGIN},
        "assets": [{"id": index + 1, "name": name, "state": "uploaded", "size": item["size"],
                    "digest": "sha256:" + item["sha256"],
                    "browser_download_url": f"https://github.com/9holy/webcodex/releases/download/v0.5.4/{name}"}
                   for index, (name, item) in enumerate(request["assets"].items())]}


def report(request, platform="win32-x64", run_id=456, attempt=1):
    version = request["tag"][1:]
    return {"schema_version": 1, "kind": "windows-release-acceptance", "platform": platform,
        "request_sha256": worker.request_digest(request), "workflow_run_id": run_id,
        "workflow_run_attempt": attempt, "passed": True, "scenarios": dict.fromkeys(worker.SCENARIOS, True),
        "configured": {"platform": platform, "mode": "verify_candidate", "passed": True,
            "complete_upgrade_verified": True, "verdict": "verified_real_unified_upgrade", "cleanup": {"complete": True},
            "candidate_runtime": {"version": version, "git_commit": request["source_sha"], "git_dirty": False},
            "inputs": {"candidate_installer_sha256": request["assets"][f"webcodex-unified-v{version}-{platform}.exe"]["sha256"]},
            "candidate_source_manifest": {
                "sha256": request["assets"][f"webcodex-source-v{version}-{platform}.json"]["sha256"],
                "version": version, "source_sha": request["source_sha"], "platform": platform,
                "source_workflow_run_id": request["build_run_id"],
                "source_workflow_ref": f"9holy/webcodex/.github/workflows/release-build.yml@refs/tags/v{version}",
                "runtime_archive_bytes_verified": True,
                "program_sha256": dict.fromkeys(("webcodex", "webcodex-server", "webcodex-runner", "webcodex-desktop"), "a" * 64)}}}


class AcceptanceIdentityTests(unittest.TestCase):
    def test_failure_projection_keeps_only_fixed_codes_and_bounded_exit_integer(self):
        output = b'PRIVATE-TOKEN-CONTENTS "code":"installer_owner" "code":"private_custom_field"'
        error = b"C:/Users/private-user/Environment: Desktop silent install failed with exit code 2\n" + output
        result = worker.helper_failure(output, error)
        self.assertEqual(result, {"code": "installer_exit", "installer_exit_code": 2,
                                  "product_diagnostic_codes": ["installer_owner"]})
        self.assertNotIn(b"PRIVATE", base._json_bytes(result))
        self.assertEqual(worker.helper_failure(b"", b"private unexpected failure"), {"code": "unknown_helper_failure"})
        self.assertEqual(worker.helper_failure(b"", b"installed webcodex-desktop bytes differ from the frozen public source manifest"),
                         {"code": "installed_program_hash"})
        self.assertEqual(worker.helper_failure(b"", b"Desktop silent install failed with exit code 99999999999"),
                         {"code": "unknown_helper_failure"})

    def test_only_fixed_bounded_request_schema_is_accepted(self):
        worker.validate_request(request(), staged.SPEC)
        for key, value in (("source_sha", "a" * 40), ("build_run_id", True), ("schema_version", True),
                           ("request_id", "wa_forged"), ("controller_workflow", ".github/workflows/ci.yml")):
            candidate = request()
            candidate[key] = value
            with self.subTest(key=key), self.assertRaises(base.ReleaseControlError):
                worker.validate_request(candidate, staged.SPEC)
        candidate = request()
        candidate["skip_upgrade"] = True
        with self.assertRaises(base.ReleaseControlError):
            worker.validate_request(candidate, staged.SPEC)

    def test_actual_preview_and_exact_frozen_assets_are_required(self):
        req = request()
        good = release(req)
        self.assertEqual(len(worker.validate_public_assets(good, req)), 26)
        for change in (lambda r: r.update(prerelease=False), lambda r: r.update(draft=True),
                       lambda r: r.update(id=999), lambda r: r.update(body="changed"),
                       lambda r: r["assets"].append(copy.deepcopy(r["assets"][0])),
                       lambda r: r["assets"][0].update(size=43),
                       lambda r: r["assets"][0].update(digest="sha256:" + "f" * 64),
                       lambda r: r["assets"][0].update(state="new"),
                       lambda r: r["assets"][0].update(browser_download_url="https://example.invalid/payload")):
            invalid = copy.deepcopy(good)
            change(invalid)
            with self.subTest(release=invalid["id"], asset=invalid["assets"][0]["name"]), self.assertRaises((base.ReleaseControlError, public.VerificationError)):
                worker.validate_public_assets(invalid, req)

    def test_harness_or_classifier_success_cannot_replace_real_upgrade_report(self):
        req = request()
        worker.validate_report(report(req), req, "win32-x64", 456, 1)
        for change in (lambda r: r["scenarios"].update(configured=False),
                       lambda r: r.update(workflow_run_attempt=2),
                       lambda r: r.update(request_sha256="a" * 64),
                       lambda r: r["configured"].update(mode="verify_classifier"),
                       lambda r: r["configured"].update(complete_upgrade_verified=False),
                       lambda r: r["configured"]["cleanup"].update(complete=False),
                       lambda r: r["configured"]["candidate_runtime"].update(git_dirty=True),
                       lambda r: r["configured"]["inputs"].update(candidate_installer_sha256="b" * 64),
                       lambda r: r["configured"]["candidate_source_manifest"].update(source_workflow_run_id=999),
                       lambda r: r["configured"]["candidate_source_manifest"].update(sha256="c" * 64),
                       lambda r: r["configured"]["candidate_source_manifest"].update(runtime_archive_bytes_verified=False),
                       lambda r: r["configured"]["candidate_source_manifest"]["program_sha256"].pop("webcodex-desktop")):
            invalid = report(req)
            change(invalid)
            with self.subTest(report=invalid), self.assertRaises(base.ReleaseControlError):
                worker.validate_report(invalid, req, "win32-x64", 456, 1)


class FixedAuthoritySelectionTests(unittest.TestCase):
    def finalized_spec(self, module):
        return base.ReleaseSpec({**dict(module.SPEC.pinned_request), "source_sha": "c" * 40,
            "source_tree": "d" * 40, "ci_run_id": 1001, "ci_run_attempt": 1,
            "evidence_run_id": 1002, "evidence_run_attempt": 1},
            module.SPEC.request_path, module.SPEC.workflow_path)

    def fixed_request(self, spec):
        value = request(spec)
        value.update(tag=spec.pinned_request["tag"], assets=assets(spec.pinned_request["version"]))
        return value

    def test_exact_pairs_select_only_their_code_owned_specification(self):
        for module in (staged, v055):
            spec = self.finalized_spec(module)
            with self.subTest(tag=spec.pinned_request["tag"]), mock.patch.object(module, "SPEC", spec):
                self.assertIs(worker.select_release_spec(self.fixed_request(spec)), spec)

    def test_unknown_crossed_or_missing_pairs_have_no_fallback(self):
        spec = self.finalized_spec(v055)
        for tag, workflow in (("v0.5.4", spec.workflow_path),
                              ("v0.5.5", staged.SPEC.workflow_path),
                              ("v0.5.6", ".github/workflows/release-publish-v056.yml"),
                              ("v0.5.5", ".github/workflows/ci.yml"),
                              (None, spec.workflow_path), ("v0.5.5", None)):
            candidate = self.fixed_request(spec)
            candidate.update(tag=tag, controller_workflow=workflow)
            with self.subTest(tag=tag, workflow=workflow), self.assertRaises(base.ReleaseControlError):
                worker.select_release_spec(candidate)

    def test_selection_still_validates_the_complete_request(self):
        spec = self.finalized_spec(v055)
        for change in (lambda r: r.update(source_sha="f" * 40),
                       lambda r: r.update(repo_id=999),
                       lambda r: r.update(build_run_id=True),
                       lambda r: r.update(skip_upgrade=True)):
            candidate = self.fixed_request(spec)
            change(candidate)
            with mock.patch.object(v055, "SPEC", spec), self.assertRaises(base.ReleaseControlError):
                worker.select_release_spec(candidate)

    def assert_main_refuses_before_execution(self, raw):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            inputs = root / "inputs-never-created"
            report_path = root / "report.json"
            env = {"WEBCODEX_WINDOWS_ACCEPTANCE_REQUEST": raw, "GITHUB_RUN_ID": "456", "GITHUB_RUN_ATTEMPT": "1"}
            with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(worker, "execute") as execute, \
                    mock.patch.object(worker, "_download") as download, contextlib.redirect_stdout(io.StringIO()):
                result = worker.main(["--platform", "win32-x64", "--inputs-root", str(inputs),
                                      "--report", str(report_path)])
            self.assertEqual(result, 1)
            execute.assert_not_called()
            download.assert_not_called()
            self.assertFalse(inputs.exists())
            self.assertIs(json.loads(report_path.read_bytes())["passed"], False)

    def test_constructed_unfinalized_pins_refuse_before_worker_execution(self):
        finalized = self.finalized_spec(v055)
        for field, value in (("source_sha", "0" * 40), ("source_tree", "0" * 40),
                             ("ci_run_id", 1), ("evidence_run_id", 1)):
            spec = base.ReleaseSpec({**dict(finalized.pinned_request), field: value},
                                    finalized.request_path, finalized.workflow_path)
            with self.subTest(field=field), mock.patch.object(v055, "SPEC", spec):
                self.assert_main_refuses_before_execution(base._json_bytes(self.fixed_request(spec)).decode())

    def test_worker_bounds_and_duplicate_keys_precede_authority_selection(self):
        for raw in (" " * (worker.MAX_REQUEST_BYTES + 1), '{"tag":"v0.5.4","tag":"v0.5.5"}'):
            with mock.patch.object(worker, "select_release_spec") as select:
                self.assert_main_refuses_before_execution(raw)
            select.assert_not_called()


if __name__ == "__main__":
    unittest.main()
