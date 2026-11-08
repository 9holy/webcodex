from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

from scripts.diagnostics import windows_v055_upgrade as diagnostic
from scripts.tests.test_windows_v055_acl_observer import projected_fixture


ROOT = Path(__file__).resolve().parents[2]


def lines(*events):
    return "\n".join(diagnostic.PREFIX + event for event in events).encode()


def original_helper():
    return diagnostic.original_helper_bytes(ROOT, {k: v for k, v in os.environ.items() if k not in diagnostic.TOKENS})


class ObservationCopyTests(unittest.TestCase):
    def test_copy_reverses_to_exact_original_and_preserves_all_commands(self):
        original = original_helper()
        self.assertEqual(hashlib.sha256(original).hexdigest(), diagnostic.HELPER_SHA256)
        copy = diagnostic.instrument_helper(original).decode()
        for old, new in reversed(diagnostic.observation_insertions()):
            self.assertEqual(copy.count(new), 1)
            copy = copy.replace(new, old, 1)
        self.assertEqual(copy.encode(), original)

    def test_changed_original_is_refused_before_instrumentation(self):
        original = original_helper()
        with self.assertRaisesRegex(diagnostic.DiagnosticFailure, "control_helper_changed"):
            diagnostic.instrument_helper(original.replace(b'@("/S")', b'@("/S", "/UPDATE")'))

    def test_classifier_hook_is_only_after_failed_candidate_and_before_original_guard(self):
        original = original_helper()
        copy = diagnostic.instrument_helper(original).decode()
        self.assertEqual(copy.count("if ($installProcess.ExitCode -ne 0) { Invoke-WebCodexFailureObservation }"), 1)
        start = copy.index("$installProcess = Start-Process")
        hook = copy.index("if ($installProcess.ExitCode -ne 0) { Invoke-WebCodexFailureObservation }")
        original_guard = copy.index('throw "Desktop silent install failed with exit code')
        cleanup = copy.index('Write-Output "WEBCODEX_V055_DIAG:cleanup_start"')
        self.assertLess(start, hook)
        self.assertLess(hook, original_guard)
        self.assertLess(original_guard, cleanup)
        self.assertNotIn("package-upgrade-", diagnostic.PROBE_SOURCE)
        self.assertNotIn("upgrade-prepare", diagnostic.PROBE_SOURCE)
        self.assertLess(diagnostic.PROBE_SOURCE.index("observer.observe("), diagnostic.PROBE_SOURCE.index("result = run_command("))

    @unittest.skipUnless(shutil.which("pwsh"), "PowerShell parser requires native pwsh")
    def test_observation_copy_is_valid_powershell(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "observed.ps1"
            path.write_bytes(diagnostic.instrument_helper(original_helper()))
            script = '$tokens=$null; $errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($env:OBSERVED_HELPER,[ref]$tokens,[ref]$errors); if ($errors.Count -ne 0) { exit 1 }'
            result = subprocess.run(["pwsh", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
                                    env={**os.environ, "OBSERVED_HELPER": str(path)}, capture_output=True, timeout=30)
            self.assertEqual(result.returncode, 0)


class ProjectionTests(unittest.TestCase):
    def test_baseline_failure_does_not_claim_candidate_started(self):
        observed = diagnostic.project_helper(lines("baseline_start", "baseline_exit=1", "cleanup_start", "cleanup_complete"), b"private baseline output", 1, "unconfigured")
        self.assertEqual(observed["baseline_install"], {"started": True, "exit_code": 1})
        self.assertEqual(observed["candidate_outer"], {"started": False, "exit_code": None})
        self.assertEqual(observed["helper_exit_code"], 1)

    def test_candidate_failure_and_post_classifier_keep_distinct_evidence(self):
        classifier = json.dumps({"exit_code": 0, "kind": "unconfigured", "diagnostic_codes": []})
        observed = diagnostic.project_helper(lines("baseline_start", "baseline_exit=0", "candidate_start", "candidate_exit=1", "classifier=" + classifier, "cleanup_start", "cleanup_complete"), b"installer_owner: PRIVATE_TOKEN C:\\private\\path", 1, "unconfigured")
        self.assertEqual(observed["candidate_outer"]["exit_code"], 1)
        self.assertEqual(observed["post_failure_classifier"]["exit_code"], 0)
        self.assertEqual(observed["outer_output_diagnostic_codes"], ["installer_owner"])
        self.assertNotIn("PRIVATE", json.dumps(observed))
        self.assertNotIn("private", json.dumps(observed))

    def test_probe_before_candidate_or_after_success_is_refused(self):
        for events in (("classifier={\"error\":\"probe_failed\"}",),
                       ("candidate_start", "candidate_exit=0", "classifier={\"error\":\"probe_failed\"}")):
            with self.subTest(events=events), self.assertRaises(diagnostic.DiagnosticFailure):
                diagnostic.project_helper(lines(*events), b"", 1, "fresh")

    def test_classifier_unknown_fields_and_codes_never_reach_report(self):
        for value in ({"exit_code": 1, "kind": None, "diagnostic_codes": ["private_secret"]},
                      {"exit_code": 1, "kind": None, "diagnostic_codes": [], "path": "private"}):
            with self.subTest(value=value), self.assertRaises(diagnostic.DiagnosticFailure):
                diagnostic.project_helper(lines("candidate_start", "candidate_exit=1", "classifier=" + json.dumps(value)), b"", 1, "fresh")

    def test_security_projection_is_only_post_failure_before_classifier_and_cleanup(self):
        security = "security=" + json.dumps(projected_fixture())
        classifier = 'classifier={"error":"probe_failed"}'
        result = diagnostic.project_helper(lines("baseline_start", "baseline_exit=0", "candidate_start", "candidate_exit=1",
            security, classifier, "cleanup_start", "cleanup_complete"), b"PRIVATE_OUTPUT", 1, "unconfigured")
        self.assertEqual(len(result["post_failure_security"]["objects"]), 6)
        self.assertEqual(result["helper_exit_code"], 1)
        self.assertNotIn("PRIVATE", json.dumps(result))
        for events in ((security,), ("candidate_start", "candidate_exit=0", security),
                       ("candidate_start", "candidate_exit=1", classifier, security),
                       ("candidate_start", "candidate_exit=1", "cleanup_start", security)):
            with self.subTest(events=events), self.assertRaises(diagnostic.DiagnosticFailure):
                diagnostic.project_helper(lines(*events), b"", 1, "fresh")

    def test_security_private_fields_are_rejected_without_changing_failure_exit(self):
        value = projected_fixture()
        value["objects"][0]["sddl"] = "PRIVATE_SDDL"
        with self.assertRaisesRegex(diagnostic.DiagnosticFailure, "security_projection"):
            diagnostic.project_helper(lines("candidate_start", "candidate_exit=1", "security=" + json.dumps(value)), b"", 1, "fresh")

    def test_success_requires_original_cleanup_completion(self):
        with self.assertRaises(diagnostic.DiagnosticFailure):
            diagnostic.project_helper(lines("candidate_start", "candidate_exit=0", "cleanup_start"), b"", 0, "fresh")
        result = diagnostic.project_helper(lines("candidate_start", "candidate_exit=0", "cleanup_start", "cleanup_complete"), b"", 0, "fresh")
        self.assertTrue(result["cleanup"]["complete"])

    def test_exit_bounds_duplicates_and_output_bounds_fail_closed(self):
        for stdout in (lines("candidate_start", "candidate_exit=99999999999"),
                       lines("candidate_start", "candidate_start"), b"x" * (256 * 1024 + 1)):
            with self.subTest(length=len(stdout)), self.assertRaises(diagnostic.DiagnosticFailure):
                diagnostic.project_helper(stdout, b"", 1, "fresh")

    def test_frozen_request_requires_exact_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "request.json"
            path.write_bytes(b'{"tag":"v0.5.5"}\n')
            with self.assertRaisesRegex(diagnostic.DiagnosticFailure, "frozen_request_changed"):
                diagnostic.read_request(path)

    def test_parser_reports_only_count_and_refuses_errors_before_installation(self):
        smoke = SimpleNamespace(run_command=mock.Mock(return_value=SimpleNamespace(
            returncode=1, stdout=b"3\n", stderr=b"PRIVATE PARSER PATH")))
        report = {}
        with self.assertRaisesRegex(diagnostic.DiagnosticFailure, "observation_powershell_syntax"):
            diagnostic.validate_powershell(smoke, Path("fixture.ps1"), {}, report)
        self.assertEqual(report, {"powershell_syntax_error_count": 3})
        self.assertNotIn("PRIVATE", json.dumps(report))

    def test_main_preserves_helper_failure_and_never_claims_formal_acceptance(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.json"
            argv = ["--platform", "win32-x64", "--mode", "direct", "--control-root", directory,
                    "--inputs-root", str(Path(directory) / "inputs"), "--report", str(path)]
            with mock.patch.object(diagnostic, "execute", return_value=7):
                self.assertEqual(diagnostic.main(argv), 7)
            report = json.loads(path.read_bytes())
            self.assertEqual(report["kind"], "windows-v055-upgrade-diagnostic")
            self.assertIs(report["formal_acceptance"], False)
            self.assertIs(report["post_failure_security_is_outer_failure_evidence"], False)
            self.assertNotIn("passed", report)


if __name__ == "__main__":
    unittest.main()
