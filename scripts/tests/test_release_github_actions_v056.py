from __future__ import annotations

import contextlib
import copy
import hashlib
import io
import json
from pathlib import Path
import runpy
import tempfile
import unittest
import zipfile
from unittest import mock

from scripts import release_github_actions as base
from scripts import release_github_actions_v054 as previous
from scripts import release_github_actions_v055 as previous_entry
from scripts import release_github_actions_v056 as staged
from scripts import release_windows_acceptance as worker
from scripts.tests import test_release_github_actions as old
from scripts.tests import test_release_github_actions_v054 as previous_tests
from scripts.tests import test_release_windows_acceptance as fixtures


class V056StagedPublicationTests(previous_tests.StagedPublicationTests):
    """Run the existing staged failure/recovery suite against the new authority."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        control = self.root / "control"
        control.mkdir()
        notes = b"Unit-test-only v0.5.6 staged release.\n"
        self.spec = base.ReleaseSpec({**dict(staged.SPEC.pinned_request), "source_sha": "c" * 40,
            "source_tree": "d" * 40, "ci_run_id": 1001, "ci_run_attempt": 1,
            "evidence_run_id": 1002, "evidence_run_attempt": 1,
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
                            bundle={"workflow_run_id": 345, "platform_scope": "windows"},
                            assets=fixtures.assets("0.5.6", "windows"))
        self.c.state["effects"]["draft"] = old._effect(self.c._draft_intent(), status="succeeded")
        self.release = {**self.c._draft_intent(), "id": 234, "published_at": None,
            "author": {"id": base.BOT_ID, "login": base.BOT_LOGIN},
            "assets": [{"id": index + 1, "name": name, "state": "uploaded", "size": item["size"],
                "digest": "sha256:" + item["sha256"],
                "browser_download_url": f"https://github.com/9holy/webcodex/releases/download/v0.5.6/{name}"}
                for index, (name, item) in enumerate(self.c.state["assets"].items())]}
        self.c._find_release = mock.Mock(side_effect=lambda: copy.deepcopy(self.release))
        self.c._verify_tag = mock.Mock()
        self.c._expected_assets = mock.Mock(return_value=self.c.state["assets"])
        self.latest = {"id": 123, "tag_name": "v0.5.3", "draft": False, "prerelease": False}
        self.c.client.fetch_json.side_effect = lambda suffix: copy.deepcopy(self.latest) if suffix == "/releases/latest" else None
        self.c._save()
        self.output = contextlib.redirect_stdout(io.StringIO())
        self.output.__enter__()
        self.addCleanup(self.output.__exit__, None, None, None)

    def acceptance(self):
        run = super().acceptance()
        original = self.c.client.fetch_json.side_effect
        self.c.client.fetch_json.side_effect = lambda suffix: (copy.deepcopy(self.latest)
            if suffix == "/releases/latest" else original(suffix))
        return run

    def test_both_verified_reports_allow_one_promotion_of_same_release_then_read_only_recovery(self):
        self.acceptance()
        self.assertEqual(self.c.prepare_promotion(), 0)
        frozen = copy.deepcopy(self.c.state["effects"]["promote"]["intent"])
        self.assertEqual(set(self.c.state["checks"]["windows_acceptance"]["reports"]), set(worker.PLATFORMS))
        self.assertEqual(frozen["preserved_latest"], {"release_id": 123, "tag": "v0.5.3"})
        def mutate(key, method, suffix, payload, **kwargs):
            self.assertEqual((key, method, suffix, payload), ("promote", "PATCH", "/releases/234",
                                                           {"prerelease": False, "make_latest": "false"}))
            self.release["prerelease"] = False
            return copy.deepcopy(self.release)
        with mock.patch.object(self.c, "_mutate", side_effect=mutate) as effect:
            self.assertEqual(self.c.promote(), 0)
            self.c.state["effects"]["promote"]["status"] = "unknown"
            self.assertEqual(self.c.promote(), 0)
            effect.assert_called_once()
        self.assertEqual(self.c.state["effects"]["promote"]["intent"], frozen)
        self.assertEqual(self.release["id"], 234)
        self.assertEqual(self.latest["id"], 123)
        self.assertIs(self.c.state["effects"]["promote"]["result"]["latest"], False)

    def test_latest_is_frozen_before_preview_and_cannot_be_rebound(self):
        self.preview()
        expected = {"release_id": 123, "tag": "v0.5.3"}
        self.assertEqual(self.c.state["effects"]["publish-preview"]["intent"]["preserved_latest"], expected)
        self.latest["id"] = 999
        with mock.patch.object(self.c, "_mutate") as mutate:
            for method in (self.c.prepare_preview, self.c.verify_preview, self.c.prepare_promotion):
                with self.subTest(method=method.__name__), self.assertRaises(base.ReleaseControlError):
                    method()
            mutate.assert_not_called()
        self.assertEqual(self.c.state["checks"]["preserved_latest"], expected)

    def test_windows_post_records_not_applicable_only_after_full_public_acceptance(self):
        self.acceptance()
        self.c.prepare_promotion()
        self.release["prerelease"] = False
        self.c.promote()
        with self.assertRaises(base.ReleaseControlError):
            self.c.prepare_post()
        with mock.patch.object(base.public_verifier, "verify_public_release") as verify:
            self.c.verify_public()
        self.assertEqual(verify.call_args.kwargs["platform_scope"], "windows")
        with mock.patch.object(self.c, "_mutate") as mutate:
            self.assertEqual(self.c.prepare_post(), 0)
            self.assertEqual(self.c.dispatch_post(), 0)
            self.assertEqual(self.c.status_post(), 0)
            mutate.assert_not_called()
        self.assertEqual(self.c.state["checks"]["post_scope"], {
            "platform_scope": "windows", "image": "not_applicable", "intel": "not_applicable"})
        self.assertEqual(set(self.c.state["post"]), {"windows"})
        self.c.state["post"]["intel"] = {"run_id": 999}
        with self.assertRaises(base.ReleaseControlError):
            self.c.status_post()

    def test_unfinalized_source_pins_reject_before_network_or_mutation(self):
        # Construct placeholders, so finalizing the checked-in six pins does not
        # remove this rejection case or require changing the test's expectation.
        for field, value in (("source_sha", "0" * 40), ("source_tree", "0" * 40),
                             ("ci_run_id", 1), ("evidence_run_id", 1)):
            self.c.spec = base.ReleaseSpec({**dict(self.spec.pinned_request), field: value},
                                          self.spec.request_path, self.spec.workflow_path)
            with self.subTest(field=field), mock.patch.object(base.Controller, "run") as dispatch, \
                    mock.patch.object(self.c, "_authenticate") as authenticate, \
                    self.assertRaises(base.ReleaseControlError):
                self.c.run("preflight")
            dispatch.assert_not_called()
            authenticate.assert_not_called()
        self.c.spec = self.spec
        staged.require_finalized(self.spec)
        self.assertNotIn("publish", staged.StagedController.stages)
        self.assertNotIn("prepare-publish", staged.StagedController.stages)
        self.assertIn("publish", base.Controller.stages)

    def test_finalized_entry_uses_the_original_authenticated_dispatcher(self):
        with mock.patch.object(base.Controller, "run", return_value=17) as dispatch:
            self.assertEqual(self.c.run("status-acceptance", 1), 17)
        dispatch.assert_called_once_with(self.c, "status-acceptance", 1)

    def test_another_fixed_entry_cannot_pass_the_v056_guard(self):
        for module in (previous, previous_entry):
            with self.subTest(tag=module.SPEC.pinned_request["tag"]), self.assertRaises(base.ReleaseControlError):
                staged.require_finalized(module.SPEC)
        wrong_workflow = base.ReleaseSpec(dict(self.spec.pinned_request), self.spec.request_path,
                                         previous.SPEC.workflow_path)
        with self.assertRaises(base.ReleaseControlError):
            staged.require_finalized(wrong_workflow)

    def test_previous_reports_cannot_satisfy_the_v056_acceptance_request(self):
        self.acceptance()
        request = self.c._windows_request()
        for module in (previous, previous_entry):
            prior = fixtures.request(module.SPEC)
            prior.update(tag=module.SPEC.pinned_request["tag"],
                         assets=fixtures.assets(module.SPEC.pinned_request["version"]))
            previous_report = fixtures.report(prior)
            with self.subTest(tag=prior["tag"]), self.assertRaises(base.ReleaseControlError):
                worker.validate_report(previous_report, request, "win32-x64", 456, 1)
            previous_report["request_sha256"] = worker.request_digest(request)
            with self.subTest(tag=prior["tag"], changed_request_digest=True), self.assertRaises(base.ReleaseControlError):
                worker.validate_report(previous_report, request, "win32-x64", 456, 1)

    def test_missing_or_invalid_v054_native_evidence_blocks_promotion(self):
        self.acceptance()
        request = self.c._windows_request()
        for mutate in (lambda r: r["scenarios"].pop("v054_unconfigured"),
                       lambda r: r["scenario_exit_codes"].update(v054_configured=2),
                       lambda r: r["v054_configured"]["upstream_runtime"].update(git_commit="f" * 40),
                       lambda r: r["v054_configured"]["cleanup"].update(complete=False)):
            value = fixtures.report(request, "win32-x64")
            mutate(value)
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as archive:
                archive.writestr("report.json", base._json_bytes(value))
            data = buffer.getvalue()
            self.archives[1] = data
            self.artifacts[0].update(size_in_bytes=len(data), digest="sha256:" + hashlib.sha256(data).hexdigest())
            with mock.patch.object(self.c, "_mutate") as effect, self.assertRaises(base.ReleaseControlError):
                self.c.prepare_promotion()
            effect.assert_not_called()
            self.assertNotIn("promote", self.c.state["effects"])


class V056FixedWorkflowContractTests(unittest.TestCase):
    def test_script_and_shared_worker_keep_the_same_validation_error_identity(self):
        root = Path(__file__).resolve().parents[2]
        entry = runpy.run_path(str(root / "scripts/release_github_actions_v056.py"), run_name="v056_entry_fixture")
        self.assertIs(entry["base"].ReleaseControlError, worker.control.ReleaseControlError)
        self.assertIs(entry["staged"].StagedController, previous.StagedController)

    def test_fixed_request_notes_and_code_owned_spec_agree(self):
        root = Path(__file__).resolve().parents[2]
        self.assertEqual(json.loads((root / staged.SPEC.request_path).read_bytes()), dict(staged.SPEC.pinned_request))
        notes = (root / staged.SPEC.pinned_request["notes_path"]).read_bytes()
        self.assertEqual(hashlib.sha256(notes).hexdigest(), staged.SPEC.pinned_request["notes_sha256"])
        self.assertEqual(staged.SPEC.pinned_request["tag"], "v0.5.6")
        self.assertEqual(staged.SPEC.pinned_request["source_ref"], "release/v0.5.6")

    def test_identity_and_native_acceptance_controller_remain_inherited(self):
        self.assertIs(staged.StagedController.stages, previous.StagedController.stages)
        for name in ("_authenticate", "_lock", "restore_state", "_source", "publish_preview",
                     "_windows_request", "prepare_acceptance", "dispatch_acceptance", "_acceptance_reports",
                     "status_acceptance", "_require_publication_intent", "_validate_release_identity"):
            with self.subTest(method=name):
                self.assertIs(getattr(staged.StagedController, name), getattr(previous.StagedController, name))

    def test_publisher_preserves_all_reviewed_steps_permissions_and_checkpoints(self):
        root = Path(__file__).resolve().parents[2]
        original = (root / previous_entry.SPEC.workflow_path).read_text()
        expected = original.replace("v0.5.5", "v0.5.6").replace("v055", "v056")
        expected = expected.replace("          scripts.tests.test_release_github_actions_v056\n",
            "          scripts.tests.test_release_github_actions_v055\n"
            "          scripts.tests.test_release_github_actions_v056\n")
        for old_name, new_name in {
            "Require both native Windows architectures and all three install scenarios": "Require both native Windows architectures and all five install scenarios",
            "Promote the same Release to stable and latest once": "Promote the same Windows Release while preserving all-platform latest",
            "Freeze image and Intel Desktop dispatches after promotion": "Freeze Windows completion with image and Intel marked not applicable",
            "Dispatch the existing post-publication workflows": "Confirm no cross-platform workflows are dispatched",
            "Require image verification and completed Intel DMG publication": "Require Windows public bytes and preserved all-platform latest",
        }.items():
            expected = expected.replace(old_name, new_name)
        actual = (root / staged.SPEC.workflow_path).read_text()
        self.assertEqual(actual, expected)
        self.assertEqual(actual.count("name: release-control-v0.5.6-"), 28)
        self.assertIn("require_finalized(SPEC)", actual)
        self.assertNotIn(".py publish ", actual)


if __name__ == "__main__":
    unittest.main()
