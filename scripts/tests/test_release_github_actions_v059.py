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
from scripts import release_github_actions_v059 as staged
from scripts import release_windows_acceptance as worker
from scripts.tests import test_release_github_actions as old
from scripts.tests import test_release_github_actions_v054 as previous_tests
from scripts.tests import test_release_windows_acceptance as fixtures


class V059StagedPublicationTests(previous_tests.StagedPublicationTests):
    """Run the existing staged failure/recovery suite against the new authority."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        control = self.root / "control"
        control.mkdir()
        notes = b"Unit-test-only v0.5.9 staged release.\n"
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
                            bundle={"workflow_run_id": 345}, assets=fixtures.assets("0.5.9"))
        self.c.state["effects"]["draft"] = old._effect(self.c._draft_intent(), status="succeeded")
        self.release = {**self.c._draft_intent(), "id": 234, "published_at": None,
            "author": {"id": base.BOT_ID, "login": base.BOT_LOGIN},
            "assets": [{"id": index + 1, "name": name, "state": "uploaded", "size": item["size"],
                "digest": "sha256:" + item["sha256"],
                "browser_download_url": f"https://github.com/9holy/webcodex/releases/download/v0.5.9/{name}"}
                for index, (name, item) in enumerate(self.c.state["assets"].items())]}
        self.c._find_release = mock.Mock(side_effect=lambda: copy.deepcopy(self.release))
        self.c._verify_tag = mock.Mock()
        self.c._expected_assets = mock.Mock(return_value=self.c.state["assets"])
        self.c._save()
        self.output = contextlib.redirect_stdout(io.StringIO())
        self.output.__enter__()
        self.addCleanup(self.output.__exit__, None, None, None)

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

    def test_another_fixed_entry_cannot_pass_the_v059_guard(self):
        with self.assertRaises(base.ReleaseControlError):
            staged.require_finalized(previous.SPEC)
        wrong_workflow = base.ReleaseSpec(dict(self.spec.pinned_request), self.spec.request_path,
                                         previous.SPEC.workflow_path)
        with self.assertRaises(base.ReleaseControlError):
            staged.require_finalized(wrong_workflow)

    def test_v054_report_cannot_satisfy_the_v059_acceptance_request(self):
        self.acceptance()
        request = self.c._windows_request()
        previous_report = fixtures.report(fixtures.request())
        with self.assertRaises(base.ReleaseControlError):
            worker.validate_report(previous_report, request, "win32-x64", 456, 1)
        previous_report["request_sha256"] = worker.request_digest(request)
        with self.assertRaises(base.ReleaseControlError):
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

    def test_all_platform_scope_and_fixed_five_scenario_authority(self):
        self.assertEqual(self.spec.platform_scope, "all")
        self.assertGreater(len(self.c.state["assets"]), 11)
        self.acceptance()
        request = self.c._windows_request()
        self.assertEqual(worker.scenarios_for_request(request), worker.V056_SCENARIOS)
        with mock.patch.object(staged, "SPEC", self.spec):
            self.assertIs(worker.select_release_spec(request), self.spec)
        wrong = base.ReleaseSpec({**dict(self.spec.pinned_request), "platform_scope": "windows"},
                                 self.spec.request_path, self.spec.workflow_path)
        with self.assertRaises(base.ReleaseControlError):
            staged.require_finalized(wrong)


    def test_prior_windows_authority_and_reports_cannot_authorize_all_platform_release(self):
        from scripts import release_github_actions_v058 as windows_entry
        with self.assertRaises(base.ReleaseControlError):
            staged.require_finalized(windows_entry.SPEC)
        self.acceptance()
        request = self.c._windows_request()
        value = fixtures.report(fixtures.fixed_request(windows_entry.SPEC))
        for rebound in (False, True):
            if rebound:
                value["request_sha256"] = worker.request_digest(request)
            with self.subTest(rebound=rebound), self.assertRaises(base.ReleaseControlError):
                worker.validate_report(value, request, "win32-x64", 456, 1)


class V059FixedWorkflowContractTests(unittest.TestCase):
    def test_script_and_shared_worker_keep_the_same_validation_error_identity(self):
        root = Path(__file__).resolve().parents[2]
        entry = runpy.run_path(str(root / "scripts/release_github_actions_v059.py"), run_name="v059_entry_fixture")
        self.assertIs(entry["base"].ReleaseControlError, worker.control.ReleaseControlError)
        self.assertIs(entry["staged"].StagedController, previous.StagedController)

    def test_fixed_request_notes_and_code_owned_spec_agree(self):
        root = Path(__file__).resolve().parents[2]
        self.assertEqual(json.loads((root / staged.SPEC.request_path).read_bytes()), dict(staged.SPEC.pinned_request))
        notes = (root / staged.SPEC.pinned_request["notes_path"]).read_bytes()
        self.assertEqual(hashlib.sha256(notes).hexdigest(), staged.SPEC.pinned_request["notes_sha256"])
        self.assertEqual(staged.SPEC.pinned_request["tag"], "v0.5.9")
        self.assertEqual(staged.SPEC.pinned_request["source_ref"], "release/v0.5.9")

    def test_existing_staged_gates_are_inherited_without_policy_overrides(self):
        self.assertIs(staged.StagedController.stages, previous.StagedController.stages)
        for name in ("_authenticate", "_lock", "restore_state", "_source", "prepare_preview", "publish_preview",
                     "verify_preview", "prepare_acceptance", "dispatch_acceptance", "_acceptance_reports",
                     "status_acceptance", "prepare_promotion", "promote", "verify_public", "status_post"):
            with self.subTest(method=name):
                self.assertIs(getattr(staged.StagedController, name), getattr(previous.StagedController, name))

    def test_publisher_preserves_all_reviewed_steps_permissions_and_checkpoints(self):
        root = Path(__file__).resolve().parents[2]
        original = (root / ".github/workflows/release-publish-v055.yml").read_text()
        expected = original.replace("v0.5.5", "v0.5.9").replace("v055", "v059")
        expected = expected.replace("          scripts.tests.test_release_github_actions_v059\n",
            "          scripts.tests.test_release_github_actions_v055\n"
            "          scripts.tests.test_release_github_actions_v056\n"
            "          scripts.tests.test_release_github_actions_v057\n"
            "          scripts.tests.test_release_github_actions_v058\n"
            "          scripts.tests.test_release_github_actions_v059\n")
        expected = expected.replace("all three install scenarios", "all five install scenarios")
        actual = (root / staged.SPEC.workflow_path).read_text()
        self.assertEqual(actual, expected)
        self.assertEqual(actual.count("name: release-control-v0.5.9-"), 28)
        self.assertIn("require_finalized(SPEC)", actual)
        self.assertNotIn(".py publish ", actual)


if __name__ == "__main__":
    unittest.main()
