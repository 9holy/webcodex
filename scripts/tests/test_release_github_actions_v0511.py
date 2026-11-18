from __future__ import annotations

from dataclasses import replace
from pathlib import Path
import runpy
import unittest
from unittest import mock

from scripts import release_github_actions as base
from scripts import release_github_actions_v059 as previous
from scripts import release_github_actions_v0510 as windows_only
from scripts import release_github_actions_v0511 as staged
from scripts import release_windows_acceptance as worker
from scripts.tests import test_release_windows_acceptance as fixtures


class V0511PublicationTests(unittest.TestCase):
    def setUp(self):
        self.spec = self.spec_with(source_sha="c" * 40, source_tree="d" * 40,
                                   ci_run_id=1001, evidence_run_id=1002, notes_sha256="e" * 64)

    def spec_with(self, **pins):
        return replace(staged.SPEC, pinned_request={**staged.SPEC.pinned_request, **pins})

    def test_unfinalized_spec_never_reaches_authenticated_dispatcher(self):
        controller = mock.Mock(spec=staged.StagedController)
        for key, placeholder in (("source_sha", "0" * 40), ("source_tree", "0" * 40),
                                 ("ci_run_id", 1), ("evidence_run_id", 1), ("notes_sha256", "0" * 64)):
            controller.spec = replace(self.spec, pinned_request={**self.spec.pinned_request, key: placeholder})
            with self.subTest(pin=key), mock.patch.object(base.Controller, "run") as dispatch:
                with self.assertRaises(base.ReleaseControlError):
                    staged.StagedController.run(controller, "preflight")
                dispatch.assert_not_called()

        controller.spec = self.spec
        with mock.patch.object(base.Controller, "run", return_value=17) as dispatch:
            self.assertEqual(staged.StagedController.run(controller, "status-acceptance", 1), 17)
            dispatch.assert_called_once_with(controller, "status-acceptance", 1)

    def test_fixed_policy_reuses_all_platform_stages_without_overrides(self):
        staged.require_finalized(self.spec)
        for spec in (previous.SPEC, windows_only.SPEC, self.spec_with(platform_scope="windows"),
                     replace(self.spec, workflow_path=windows_only.SPEC.workflow_path)):
            with self.subTest(tag=spec.pinned_request["tag"], workflow=spec.workflow_path):
                with self.assertRaises(base.ReleaseControlError):
                    staged.require_finalized(spec)

        self.assertEqual(self.spec.pinned_request["tag"], "v0.5.11")
        self.assertEqual(self.spec.pinned_request["source_ref"], "release/v0.5.11")
        self.assertEqual(self.spec.platform_scope, "all")
        self.assertEqual(set(self.spec.post_workflows), {"image", "intel"})
        self.assertIs(staged.StagedController.stages, previous.StagedController.stages)
        for method in ("prepare_preview", "publish_preview", "verify_preview", "prepare_acceptance",
                       "dispatch_acceptance", "_acceptance_reports", "status_acceptance", "prepare_promotion",
                       "promote", "verify_public", "prepare_post", "dispatch_post", "status_post"):
            with self.subTest(method=method):
                self.assertIs(getattr(staged.StagedController, method), getattr(previous.StagedController, method))

    def test_windows_worker_requires_exact_authority_and_all_five_scenarios(self):
        request = fixtures.fixed_request(self.spec)
        unreviewed = dict(request, controller_workflow=previous.SPEC.workflow_path)
        with mock.patch.object(staged, "SPEC", self.spec):
            self.assertIs(worker.select_release_spec(request), self.spec)
            with self.assertRaises(base.ReleaseControlError):
                worker.select_release_spec(unreviewed)

        self.assertEqual(worker.scenarios_for_request(request), worker.V056_SCENARIOS)
        for platform in worker.PLATFORMS:
            with self.subTest(platform=platform):
                report = fixtures.report(request, platform)
                worker.validate_report(report, request, platform, 456, 1)
                del report["scenarios"]["v054_configured"]
                with self.assertRaises(base.ReleaseControlError):
                    worker.validate_report(report, request, platform, 456, 1)

    def test_workflow_preserves_reviewed_steps_permissions_and_checkpoints(self):
        root = Path(__file__).resolve().parents[2]
        entry = runpy.run_path(str(root / "scripts/release_github_actions_v0511.py"), run_name="v0511_fixture")
        self.assertIs(entry["base"].ReleaseControlError, worker.control.ReleaseControlError)

        expected = (root / previous.SPEC.workflow_path).read_text(encoding="utf-8")
        expected = expected.replace("v0.5.9", "v0.5.11").replace("v059", "v0511")
        expected = expected.replace("          scripts.tests.test_release_github_actions_v0511\n",
            "          scripts.tests.test_release_github_actions_v059\n"
            "          scripts.tests.test_release_github_actions_v0510\n"
            "          scripts.tests.test_release_github_actions_v0511\n")
        self.assertEqual((root / staged.SPEC.workflow_path).read_text(encoding="utf-8"), expected)
