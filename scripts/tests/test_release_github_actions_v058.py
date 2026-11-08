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
from unittest import mock

from scripts import release_github_actions as base
from scripts import release_github_actions_v054 as v054
from scripts import release_github_actions_v055 as v055
from scripts import release_github_actions_v056 as v056
from scripts import release_github_actions_v057 as previous
from scripts import release_github_actions_v058 as staged
from scripts import release_windows_acceptance as worker
from scripts.tests import test_release_github_actions as old
from scripts.tests import test_release_github_actions_v057 as previous_tests
from scripts.tests import test_release_windows_acceptance as fixtures


class V058StagedPublicationTests(previous_tests.V057StagedPublicationTests):
    """Run the reviewed Windows failure/recovery suite with the new authority."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        control = self.root / "control"
        control.mkdir()
        notes = b"Unit-test-only v0.5.8 staged release.\n"
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
                            assets=fixtures.assets("0.5.8", "windows"))
        self.c.state["effects"]["draft"] = old._effect(self.c._draft_intent(), status="succeeded")
        self.release = {**self.c._draft_intent(), "id": 234, "published_at": None,
            "author": {"id": base.BOT_ID, "login": base.BOT_LOGIN},
            "assets": [{"id": index + 1, "name": name, "state": "uploaded", "size": item["size"],
                "digest": "sha256:" + item["sha256"],
                "browser_download_url": f"https://github.com/9holy/webcodex/releases/download/v0.5.8/{name}"}
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

    def test_all_earlier_entries_and_crossed_workflows_fail_the_v058_guard(self):
        for module in (v054, v055, v056, previous):
            with self.subTest(tag=module.SPEC.pinned_request["tag"]), self.assertRaises(base.ReleaseControlError):
                staged.require_finalized(module.SPEC)
            wrong = base.ReleaseSpec(dict(self.spec.pinned_request), self.spec.request_path,
                                     module.SPEC.workflow_path)
            with self.assertRaises(base.ReleaseControlError):
                staged.require_finalized(wrong)

    def test_v057_report_and_rebound_digest_cannot_authorize_v058(self):
        self.acceptance()
        request = self.c._windows_request()
        value = fixtures.report(fixtures.fixed_request(previous.SPEC))
        for changed_digest in (False, True):
            if changed_digest:
                value["request_sha256"] = worker.request_digest(request)
            with self.subTest(changed_digest=changed_digest), self.assertRaises(base.ReleaseControlError):
                worker.validate_report(value, request, "win32-x64", 456, 1)


class V058FixedWorkflowContractTests(unittest.TestCase):
    def test_script_and_worker_preserve_one_error_class_and_windows_controller(self):
        root = Path(__file__).resolve().parents[2]
        entry = runpy.run_path(str(root / "scripts/release_github_actions_v058.py"), run_name="v058_entry_fixture")
        self.assertIs(entry["base"].ReleaseControlError, worker.control.ReleaseControlError)
        self.assertIs(entry["staged"].StagedController, previous.StagedController)

    def test_fixed_request_notes_and_code_owned_spec_agree(self):
        root = Path(__file__).resolve().parents[2]
        self.assertEqual(json.loads((root / staged.SPEC.request_path).read_bytes()), dict(staged.SPEC.pinned_request))
        notes = (root / staged.SPEC.pinned_request["notes_path"]).read_bytes()
        self.assertEqual(hashlib.sha256(notes).hexdigest(), staged.SPEC.pinned_request["notes_sha256"])
        self.assertEqual(staged.SPEC.pinned_request["tag"], "v0.5.8")
        self.assertEqual(staged.SPEC.pinned_request["source_ref"], "release/v0.5.8")
        self.assertEqual(staged.SPEC.platform_scope, "windows")

    def test_only_fixed_entry_guard_is_overridden(self):
        self.assertEqual({name for name, value in vars(staged.StagedController).items() if callable(value)}, {"run"})
        self.assertIs(staged.StagedController.stages, previous.StagedController.stages)
        for name in ("_authenticate", "_lock", "restore_state", "_source", "publish_preview",
                     "_windows_request", "prepare_acceptance", "dispatch_acceptance", "_acceptance_reports",
                     "status_acceptance", "_require_publication_intent", "_validate_release_identity",
                     "_latest_identity", "_preserved_latest", "_verify_preserved_latest", "_publication_intent",
                     "prepare_preview", "verify_preview", "prepare_promotion", "_verify_latest", "promote",
                     "verify_public", "_post_scope", "_require_windows_post_scope", "prepare_post",
                     "dispatch_post", "status_post"):
            with self.subTest(method=name):
                self.assertIs(getattr(staged.StagedController, name), getattr(previous.StagedController, name))

    def test_publisher_preserves_all_reviewed_steps_permissions_and_checkpoints(self):
        root = Path(__file__).resolve().parents[2]
        original = (root / previous.SPEC.workflow_path).read_text()
        expected = original.replace("v0.5.7", "v0.5.8").replace("v057", "v058")
        expected = expected.replace("          scripts.tests.test_release_github_actions_v058\n",
            "          scripts.tests.test_release_github_actions_v057\n"
            "          scripts.tests.test_release_github_actions_v058\n")
        actual = (root / staged.SPEC.workflow_path).read_text()
        self.assertEqual(actual, expected)
        self.assertEqual(actual.count("name: release-control-v0.5.8-"), 28)
        self.assertIn("require_finalized(SPEC)", actual)
        self.assertNotIn(".py publish ", actual)


if __name__ == "__main__":
    unittest.main()
