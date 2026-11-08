"""Small tests for the real Windows smoke's evidence and isolation decisions.

The native acceptance itself runs the published installers and real CLIs. These
tests do not claim Windows installer/service acceptance or stub its classifier.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

from scripts import windows_unified_upgrade_smoke as smoke


class WindowsUnifiedUpgradeEvidenceTests(unittest.TestCase):
    def test_read_only_owner_helper_preserves_failure_stage_and_uses_encoded_source(self):
        failure = {"exists": {"webcodex": True}, "failure": {
            "stage": "file_owner_webcodex", "exception_type": "MethodException",
            "reason": "MethodException", "script_line": 21}}
        with mock.patch.dict(os.environ, {"SystemRoot": r"C:\Windows"}), \
             mock.patch.object(smoke, "run_command", return_value=smoke.CommandResult(1, json.dumps(failure).encode(), b"bounded helper diagnostic")) as run:
            observed = smoke.owner_observation({"webcodex": Path(r"D:\fixture\webcodex.exe")})
        self.assertEqual(observed["helper_exit_code"], 1)
        self.assertEqual(observed["failure"], failure["failure"])
        self.assertEqual(observed["exists"], {"webcodex": True})
        self.assertIn("-EncodedCommand", run.call_args.args[0])
        self.assertNotIn("-Command", run.call_args.args[0])

    def test_candidate_build_proof_binds_source_architecture_and_clean_tree(self):
        info = {"binary": "webcodex", "version": "0.5.4", "git_commit": "c" * 40,
                "git_dirty": False, "target": "aarch64-pc-windows-msvc", "architecture": "aarch64"}
        kwargs = dict(binary="webcodex", version="0.5.4", source="c" * 40, platform="win32-arm64", label="candidate")
        smoke.verify_build(info, **kwargs)
        for change in ({"git_commit": "a" * 40}, {"target": "x86_64-pc-windows-msvc"}, {"git_dirty": True}):
            with self.assertRaises(smoke.SmokeFailure):
                smoke.verify_build({**info, **change}, **kwargs)

    def test_candidate_upgrade_may_replace_programs_but_not_private_state(self):
        before = {"program/webcodex": "old", "private/runner.toml": "credential-hash", "registration": {"InstallLocation": "original"}}
        after = {**before, "program/webcodex": "new"}
        smoke.unchanged(smoke.preserved_state(before), smoke.preserved_state(after), "upgrade")
        after["private/runner.toml"] = "changed"
        with self.assertRaises(smoke.SmokeFailure):
            smoke.unchanged(smoke.preserved_state(before), smoke.preserved_state(after), "upgrade")

    def test_nsis_directory_is_last_literal_remainder_and_environment_is_separate(self):
        command = smoke.nsis_command(Path(r"C:\downloads\full installer.exe"),
                                     environment=Path(r"D:\fixture\Environment"),
                                     destination=Path(r"D:\fixture\Upstream Desktop"))
        self.assertEqual(command,
            '"C:\\downloads\\full installer.exe" /S /ENVIRONMENTDIR="D:\\fixture\\Environment" /D=D:\\fixture\\Upstream Desktop')
        self.assertEqual(smoke.nsis_command(Path(r"D:\fixture\uninstall.exe"),
            destination=Path(r"D:\fixture\Upstream Desktop"), uninstall=True),
            '"D:\\fixture\\uninstall.exe" /S _?=D:\\fixture\\Upstream Desktop')
        with self.assertRaises(smoke.SmokeFailure):
            smoke.nsis_command(Path('bad"name.exe'))

    def test_only_a_successful_verbatim_control_is_a_path_reproduction(self):
        dos = smoke.classification(smoke.CommandResult(1, b"", b"installer_owner: The installed Environment owner or runtime target differs"))
        verbatim = smoke.classification(smoke.CommandResult(0, b'{"kind":"environment"}\r\n', b""))
        self.assertEqual(smoke.rejection_verdict(dos, verbatim, 1), "reproduced_verbatim_path_rejection")
        self.assertEqual(smoke.rejection_verdict(dos, verbatim, 0), "published_outer_did_not_reject")
        owner = smoke.classification(smoke.CommandResult(1, b"", b"installer_owner: The installed program belongs to another Windows account"))
        self.assertEqual(smoke.rejection_verdict(dos, owner, 1), "blocked_by_installed_program_owner")
        self.assertEqual(smoke.rejection_verdict(dos, dos, 1), "different_or_unresolved_classification_failure")

    def test_classification_report_does_not_copy_arbitrary_output_or_credentials(self):
        result = smoke.classification(smoke.CommandResult(1,
            b'{"token":"fixture-secret-must-not-be-reported","kind":"environment"}',
            b"unrecognized error fixture-secret-must-not-be-reported"))
        encoded = json.dumps(result)
        self.assertNotIn("fixture-secret", encoded)
        self.assertNotIn("token", encoded)
        self.assertEqual(len(result["output_sha256"]), 64)

    def test_snapshot_changes_are_rejected_without_disclosing_private_values(self):
        smoke.unchanged({"private/runner.toml": "original"}, {"private/runner.toml": "original"}, "negative control")
        for after in ({}, {"private/runner.toml": "replacement"}, {"private/runner.toml": "original", "new": "value"}):
            with self.assertRaises(smoke.SmokeFailure) as captured:
                smoke.unchanged({"private/runner.toml": "original"}, after, "negative control")
            self.assertNotIn("replacement", str(captured.exception))
            self.assertNotIn("original", str(captured.exception))

    def test_owned_native_service_observation_requires_both_real_components(self):
        status = {"observation": {"local": {"scope": "user", "components": [
            {"component": component, "service": {"id": component, "ownership": "Owned",
             "installed": True, "enabled": True, "running": True}}
            for component in ("server", "runner")
        ]}, "server_reachable": True, "authenticated": True, "runner_online": True}}
        observed = smoke.service_observation(status)
        self.assertTrue(smoke.services_ready(observed, True))
        observed["components"]["runner"]["ownership"] = "Foreign"
        self.assertFalse(smoke.services_ready(observed, True))
        observed["components"].pop("runner")
        self.assertFalse(smoke.services_ready(observed, True))

    def test_setup_failure_reports_real_phase_without_private_journal_contents(self):
        observed = smoke.setup_observation({
            "steps": {"server_service_start": "complete", "server_reachability": "started",
                      "fixture-secret": "complete"},
            "last_diagnostic": {"code": "server_unreachable", "message": "fixture-secret"},
            "environment": {"token": "fixture-secret"},
        })
        self.assertEqual(observed, {"steps": {"server_service_start": "complete", "server_reachability": "started"},
                                    "diagnostic_code": "server_unreachable"})
        self.assertNotIn("fixture-secret", json.dumps(observed))

    def test_asset_identity_uses_actual_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "asset.exe"
            path.write_bytes(b"published fixture bytes")
            expected = smoke.digest(path)
            self.assertEqual(smoke.verify_input(path, expected, "fixture"), expected)
            path.write_bytes(b"different bytes")
            with self.assertRaises(smoke.SmokeFailure):
                smoke.verify_input(path, expected, "fixture")

    def test_child_has_eof_and_both_output_streams_are_drained(self):
        result = smoke.run_command([sys.executable, "-c",
            "import sys; assert sys.stdin.read() == ''; sys.stdout.write('out'); sys.stderr.write('err')"],
            "owned test child", timeout=5)
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, b"out", b"err"))

    def test_child_output_and_runtime_are_bounded(self):
        with self.assertRaises(smoke.SmokeFailure):
            smoke.run_command([sys.executable, "-c", "import sys; sys.stdout.write('x' * 300000)"], "output cap", timeout=5)
        with self.assertRaises(smoke.SmokeFailure):
            smoke.run_command([sys.executable, "-c", "import time; time.sleep(30)"], "deadline", timeout=0.1)


if __name__ == "__main__":
    unittest.main()
