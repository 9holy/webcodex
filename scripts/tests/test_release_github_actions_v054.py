from __future__ import annotations

import contextlib
import copy
import hashlib
import io
import json
from pathlib import Path
import re
import runpy
import tempfile
import unittest
from unittest import mock
import zipfile

from scripts import release_github_actions as base
from scripts import release_github_actions_v054 as staged
from scripts import release_windows_acceptance as worker
from scripts.tests import test_release_github_actions as old
from scripts.tests import test_release_windows_acceptance as fixtures


class StagedPublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        control = self.root / "control"
        control.mkdir()
        notes = b"Unit-test-only staged release.\n"
        self.spec = base.ReleaseSpec({**dict(staged.SPEC.pinned_request), "source_sha": "c" * 40,
            "source_tree": "d" * 40, "ci_run_id": 1001, "evidence_run_id": 1002,
            "notes_sha256": hashlib.sha256(notes).hexdigest()}, staged.SPEC.request_path, staged.SPEC.workflow_path)
        request_path = control / self.spec.request_path
        request_path.parent.mkdir(parents=True)
        request_path.write_bytes(base._json_bytes(dict(self.spec.pinned_request)))
        (control / self.spec.pinned_request["notes_path"]).write_bytes(notes)
        client = mock.Mock(spec=base.collector.GitHubClient)
        client.api_url.side_effect = lambda suffix: f"https://api.github.com/repos/9holy/webcodex{suffix}"
        self.c = staged.StagedController(request_path, self.root / "source", self.root / "state", self.root / "bundle",
            control_root=control, client=client, env=old._environment(), spec=self.spec)
        self.c.context = {**old._context(), "workflow_path": self.spec.workflow_path}
        self.c.state = base.new_journal(self.c.request, self.c.request_digest, self.c.context)
        self.c.state.update(release_id=234, tag_object_sha="a" * 40,
                            bundle={"workflow_run_id": 345}, assets=fixtures.assets())
        self.c.state["effects"]["draft"] = old._effect(self.c._draft_intent(), status="succeeded")
        self.release = fixtures.release(fixtures.request(self.spec))
        self.release.update(self.c._draft_intent())
        self.release["published_at"] = None
        self.c._find_release = mock.Mock(side_effect=lambda: copy.deepcopy(self.release))
        self.c._verify_tag = mock.Mock()
        self.c._expected_assets = mock.Mock(return_value=self.c.state["assets"])
        self.c._save()
        self.output = contextlib.redirect_stdout(io.StringIO())
        self.output.__enter__()
        self.addCleanup(self.output.__exit__, None, None, None)

    def preview(self):
        with mock.patch.object(base.publication, "verify_draft_assets", return_value={"release_id": 234,
            "source_sha": self.c.request["source_sha"], "workflow_run_id": 345}):
            self.c.prepare_preview()
        self.release.update(draft=False, prerelease=True, published_at="2026-11-01T00:00:00Z")
        self.c.state["checks"]["preview_bytes"] = True
        self.c.state["checks"]["acceptance_build_attempt"] = 1
        self.c._save()

    def acceptance(self):
        self.preview()
        self.c._prepare("post:windows", {**self.c._post_identity("windows"), "not_before": 1700000000, "baseline_run_ids": []})
        request = self.c._windows_request()
        run = {"id": 456, "run_attempt": 1, "path": f".github/workflows/{worker.WORKFLOW}",
            "display_title": worker.run_name(request), "event": "workflow_dispatch", "head_branch": "main",
            "head_sha": old.CONTROL, "repository": old._repo(), "head_repository": old._repo(),
            "actor": {"id": base.BOT_ID, "login": base.BOT_LOGIN}, "triggering_actor": old._actor(),
            "created_at": "2023-11-14T22:13:21Z", "status": "completed", "conclusion": "success"}
        self.c.state["post"]["windows"] = {"run_id": 456, "run_attempt": 1, "head_sha": old.CONTROL}
        self.jobs = [{"name": f"Windows acceptance ({platform})", "status": "completed", "conclusion": "success"}
                     for platform in worker.PLATFORMS]
        self.artifacts, self.archives = [], {}
        for index, platform in enumerate(worker.PLATFORMS):
            raw = base._json_bytes(fixtures.report(request, platform))
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as archive:
                archive.writestr("report.json", raw)
            data = buffer.getvalue()
            self.archives[index + 1] = data
            self.artifacts.append({"id": index + 1, "name": worker.artifact_name(platform, 456, 1), "expired": False,
                "size_in_bytes": len(data), "digest": "sha256:" + hashlib.sha256(data).hexdigest(),
                "workflow_run": {"id": 456, "repository_id": old.REPO_ID, "head_repository_id": old.REPO_ID,
                                 "head_sha": old.CONTROL, "head_branch": "main"}})
        def fetch(suffix):
            if suffix == "/actions/runs/456":
                return run
            if suffix == "/actions/runs/456/attempts/1/jobs?per_page=100":
                return {"total_count": len(self.jobs), "jobs": self.jobs}
            if suffix == "/actions/runs/456/artifacts?per_page=100":
                return {"total_count": len(self.artifacts), "artifacts": self.artifacts}
            if suffix == "/releases/latest":
                return copy.deepcopy(self.release)
            raise AssertionError(suffix)
        self.c.client.fetch_json.side_effect = fetch
        self.c._download_checkpoint = mock.Mock(side_effect=lambda item, digest, path: path.write_bytes(self.archives[item["id"]]))
        return run

    def test_unfinalized_source_pins_reject_before_network_or_mutation(self):
        unfinalized = base.ReleaseSpec({**dict(self.spec.pinned_request), "source_sha": "0" * 40,
            "source_tree": "0" * 40, "ci_run_id": 1, "evidence_run_id": 1}, self.spec.request_path, self.spec.workflow_path)
        with self.assertRaises(base.ReleaseControlError):
            staged.require_finalized(unfinalized)
        staged.require_finalized(self.spec)
        self.assertNotIn("publish", staged.StagedController.stages)
        self.assertNotIn("prepare-publish", staged.StagedController.stages)
        self.assertIn("publish", base.Controller.stages)

    def test_preview_intent_never_selects_latest_and_unknown_draft_is_not_replayed(self):
        self.preview()
        effect = self.c.state["effects"]["publish-preview"]
        self.assertEqual(effect["intent"]["payload"], {"draft": False, "prerelease": True, "make_latest": "false"})
        effect["status"] = "unknown"
        self.release.update(draft=True, prerelease=False)
        with mock.patch.object(self.c, "_mutate") as mutate, self.assertRaises(base.ReleaseControlError):
            self.c.publish_preview()
        mutate.assert_not_called()
        self.release.update(draft=False, prerelease=True)
        with mock.patch.object(self.c, "_mutate") as mutate:
            self.assertEqual(self.c.publish_preview(), 0)
        mutate.assert_not_called()

    def test_missing_failed_skipped_or_forged_windows_proof_never_promotes(self):
        run = self.acceptance()
        with mock.patch.object(self.c, "_mutate") as mutate:
            run["status"] = "in_progress"
            with self.assertRaises(base.ReleaseControlError):
                self.c.prepare_promotion()
            run.update(status="completed", conclusion="failure")
            with self.assertRaises(base.ReleaseControlError):
                self.c.prepare_promotion()
            run["conclusion"] = "success"
            self.jobs[1]["conclusion"] = "skipped"
            with self.assertRaises(base.ReleaseControlError):
                self.c.prepare_promotion()
            self.jobs[1]["conclusion"] = "success"
            self.artifacts[1]["workflow_run"]["head_sha"] = "f" * 40
            with self.assertRaises(base.ReleaseControlError):
                self.c.prepare_promotion()
            mutate.assert_not_called()
        self.assertNotIn("promote", self.c.state["effects"])

    def test_both_verified_reports_allow_one_promotion_of_same_release_then_read_only_recovery(self):
        self.acceptance()
        self.assertEqual(self.c.prepare_promotion(), 0)
        frozen = copy.deepcopy(self.c.state["effects"]["promote"]["intent"])
        self.assertEqual(set(self.c.state["checks"]["windows_acceptance"]["reports"]), set(worker.PLATFORMS))
        def mutate(key, method, suffix, payload, **kwargs):
            self.assertEqual((key, method, suffix, payload), ("promote", "PATCH", "/releases/234",
                                                           {"prerelease": False, "make_latest": "true"}))
            self.release["prerelease"] = False
            return copy.deepcopy(self.release)
        with mock.patch.object(self.c, "_mutate", side_effect=mutate) as effect:
            self.assertEqual(self.c.promote(), 0)
            self.c.state["effects"]["promote"]["status"] = "unknown"
            self.assertEqual(self.c.promote(), 0)
            effect.assert_called_once()
        self.assertEqual(self.c.state["effects"]["promote"]["intent"], frozen)
        self.assertEqual(self.release["id"], 234)

    def test_unknown_promotion_still_preview_must_not_replay_patch(self):
        self.acceptance()
        self.c.prepare_promotion()
        self.c.state["effects"]["promote"]["status"] = "unknown"
        with mock.patch.object(self.c, "_mutate") as mutate, self.assertRaises(base.ReleaseControlError):
            self.c.promote()
        mutate.assert_not_called()

    def test_preview_real_flag_reaches_verifier_and_cannot_start_image_or_latest(self):
        self.preview()
        del self.c.state["checks"]["preview_bytes"]
        with mock.patch.object(base.public_verifier, "verify_public_release") as verify:
            self.c.verify_preview()
        self.assertIs(verify.call_args.kwargs["expected_prerelease"], True)
        for method in (self.c.prepare_post, self.c.dispatch_post, self.c.verify_public):
            with self.subTest(method=method), self.assertRaises(base.ReleaseControlError):
                method()
        self.assertIs(self.release["prerelease"], True)

    def test_restore_preflight_uses_actual_preview_identity(self):
        self.preview()
        with mock.patch.object(self.c, "_proofs"), mock.patch.object(self.c, "_tag_ref", return_value={"object": {"sha": "a" * 40}}):
            self.assertEqual(self.c.preflight(), 0)
        self.assertIs(self.release["prerelease"], True)

    def test_frozen_reports_reject_later_attempt_or_asset_changes(self):
        self.acceptance()
        self.c.prepare_promotion()
        self.c.state["assets"]["SHA256SUMS"]["sha256"] = "f" * 64
        with self.assertRaises(base.ReleaseControlError):
            self.c.promote()

    def test_unique_lost_dispatch_is_reconciled_but_ambiguous_runs_never_redispatch(self):
        run = self.acceptance()
        self.c.state["post"].pop("windows")
        self.c.state["effects"]["post:windows"]["status"] = "unknown"
        with mock.patch.object(self.c, "_post_runs", return_value=[run, dict(run, id=457)]), mock.patch.object(self.c, "_mutate") as mutate:
            with self.assertRaises(base.ReleaseControlError):
                self.c.dispatch_acceptance()
            mutate.assert_not_called()
        with mock.patch.object(self.c, "_post_runs", return_value=[run]), mock.patch.object(self.c, "_mutate") as mutate:
            self.assertEqual(self.c.dispatch_acceptance(), 0)
            mutate.assert_not_called()
        self.assertEqual(self.c.state["post"]["windows"]["run_id"], 456)

    def test_frozen_promotion_cannot_adopt_another_report_or_later_attempt(self):
        run = self.acceptance()
        self.c.prepare_promotion()
        proof = copy.deepcopy(self.c.state["checks"]["windows_acceptance"])
        proof["run_attempt"] = 2
        with mock.patch.object(self.c, "_acceptance_reports", return_value=proof), self.assertRaises(base.ReleaseControlError):
            self.c.status_acceptance()
        self.assertEqual(self.c.state["checks"]["windows_acceptance"]["run_attempt"], 1)
        run["run_attempt"] = 2
        run["triggering_actor"] = {"id": 999, "login": "another-user"}
        with self.assertRaises(base.ReleaseControlError):
            self.c.status_acceptance()

    def test_stable_without_frozen_promotion_or_latest_identity_is_rejected(self):
        self.acceptance()
        self.release["prerelease"] = False
        with self.assertRaises(base.ReleaseControlError):
            self.c._owned_release()
        self.release["prerelease"] = True
        self.c.prepare_promotion()
        self.release["prerelease"] = False
        self.c.client.fetch_json.side_effect = lambda suffix: dict(self.release, id=999)
        with mock.patch.object(self.c, "_mutate") as mutate, self.assertRaises(base.ReleaseControlError):
            self.c.promote()
        mutate.assert_not_called()

    def test_report_zip_traversal_or_duplicate_member_fails_without_extraction(self):
        run = self.acceptance()
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("../report.json", base._json_bytes(fixtures.report(self.c._windows_request())))
        self.archives[1] = buffer.getvalue()
        with self.assertRaises(base.ReleaseControlError):
            self.c._acceptance_reports(run)
        self.assertFalse((self.root / "report.json").exists())


class FixedWorkflowContractTests(unittest.TestCase):
    def test_script_entry_uses_the_same_bounded_validation_error_class_as_worker(self):
        root = Path(__file__).resolve().parents[2]
        entry = runpy.run_path(str(root / "scripts/release_github_actions_v054.py"), run_name="staged_entry_fixture")
        self.assertIs(entry["base"].ReleaseControlError, entry["windows"].control.ReleaseControlError)

    def test_fixed_request_notes_and_code_owned_spec_agree(self):
        root = Path(__file__).resolve().parents[2]
        self.assertEqual(json.loads((root / staged.SPEC.request_path).read_bytes()), dict(staged.SPEC.pinned_request))
        notes = (root / staged.SPEC.pinned_request["notes_path"]).read_bytes()
        self.assertEqual(hashlib.sha256(notes).hexdigest(), staged.SPEC.pinned_request["notes_sha256"])
        self.assertEqual(staged.SPEC.pinned_request["tag"], "v0.5.4")

    def test_every_new_effect_has_remote_checkpoint_before_execute_and_promotion_follows_reports(self):
        root = Path(__file__).resolve().parents[2]
        workflow = (root / staged.SPEC.workflow_path).read_text()
        sequence = [".py prepare-preview ", "-16-preview-intent", ".py publish-preview ",
                    "-17-preview-published", ".py verify-preview ", "-18-preview-verified",
                    ".py prepare-acceptance ", "-19-acceptance-intent", ".py dispatch-acceptance ",
                    "-20-acceptance-dispatched", ".py status-acceptance ", "-21-acceptance-verified",
                    ".py prepare-promotion ", "-22-promotion-intent", ".py promote ", "-23-stable-promoted",
                    ".py verify-public ", "-24-public-verified", ".py prepare-post ", "-25-post-intent",
                    ".py dispatch-post ", "-26-post-dispatched", ".py status-post ", "-27-post-verified"]
        positions = [workflow.index(part) for part in sequence]
        self.assertEqual(positions, sorted(positions))
        self.assertNotIn(".py publish ", workflow)
        self.assertIn("require_finalized(SPEC)", workflow)
        self.assertIn("if: always()", workflow)
        self.assertIn("-99-final-state", workflow)
        self.assertEqual(len(re.findall(r"name: release-control-v0\.5\.4-", workflow)), 28)

    def test_acceptance_has_only_read_permissions_and_both_native_targets(self):
        root = Path(__file__).resolve().parents[2]
        workflow = (root / ".github/workflows/release-windows-acceptance.yml").read_text()
        self.assertIn("permissions:\n  contents: read\n  actions: read", workflow)
        self.assertNotIn(": write", workflow)
        self.assertIn("platform: win32-x64\n            runner: windows-latest", workflow)
        self.assertIn("platform: win32-arm64\n            runner: windows-11-arm", workflow)
        self.assertIn("persist-credentials: false", workflow)
        self.assertIn("WEBCODEX_WINDOWS_ACCEPTANCE_REQUEST: ${{ inputs.request }}", workflow)
        self.assertNotIn("${{ inputs.request }}'", workflow)
        self.assertIn("test_windows_desktop_hashes", workflow)
        self.assertIn("windows-release-acceptance-${{ matrix.platform }}-${{ github.run_id }}-${{ github.run_attempt }}", workflow)


if __name__ == "__main__":
    unittest.main()
