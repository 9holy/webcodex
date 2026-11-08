"""Small tests for the real Windows smoke's evidence and isolation decisions.

The native acceptance itself runs the published installers and real CLIs. These
tests do not claim Windows installer/service acceptance or stub its classifier.
"""
from __future__ import annotations

import copy
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

from scripts import windows_unified_upgrade_smoke as smoke


class WindowsUnifiedUpgradeEvidenceTests(unittest.TestCase):
    def public_candidate_fixture(self, root: Path) -> tuple[Path, dict, dict]:
        contract = {"min_generation": 1, "max_generation": 1}
        manifest = {"schema_version": 1, "version": "0.5.4", "source_sha": "c" * 40,
            "platform": "win32-x64", "target": "x86_64-pc-windows-msvc", "architecture": "x86_64",
            "source_workflow_run_id": 123, "desktop_runtime_contract": contract,
            "source_workflow_ref": "9holy/webcodex/.github/workflows/release-build.yml@refs/tags/v0.5.4",
            "artifacts": {}}
        for name in smoke.PROGRAMS:
            raw = ("fixture bytes " + name).encode()
            if name != "webcodex-desktop":
                (root / f"{name}.exe").write_bytes(raw)
            info = {"schema_version": 1, "binary": name, "version": manifest["version"],
                "git_commit": manifest["source_sha"], "git_dirty": False, "target": manifest["target"],
                "architecture": manifest["architecture"], "built_at": "1234567890",
                "desktop_runtime_contract": contract, "environment_data_format": 1}
            manifest["artifacts"][name] = {"path": f"artifacts/bin/{name}.exe", "sha256": hashlib.sha256(raw).hexdigest(),
                "build_info": info, "build_info_sha256": smoke.packaging.canonical_digest(info), "probe": "native-build-job"}
        manifest["desktop_payload"] = {"path": "artifacts/bin/webcodex-desktop.exe", "executable": "webcodex-desktop.exe",
            "sha256": "d" * 64, "managed_files": [{"path": relative, "sha256": manifest["artifacts"][name]["sha256"]}
                for name, relative in sorted(smoke.PROGRAMS.items(), key=lambda item: item[1])]}
        path = root / "candidate-source-manifest.json"
        path.write_text(json.dumps(manifest), encoding="utf-8")
        options = dict(version="0.5.4", source="c" * 40, platform="win32-x64", build_run_id=123, runtime_dir=root)
        return path, manifest, options

    def test_public_manifest_binds_three_runtime_bytes_and_desktop_without_a_local_desktop(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path, manifest, options = self.public_candidate_fixture(root)
            self.assertFalse((root / "webcodex-desktop.exe").exists())
            self.assertEqual(smoke.verify_candidate_manifest(path, smoke.digest(path), **options), manifest)
            (root / "webcodex-runner.exe").write_bytes(b"different public component")
            with self.assertRaises(smoke.SmokeFailure):
                smoke.verify_candidate_manifest(path, smoke.digest(path), **options)

    def test_public_manifest_cannot_change_source_build_platform_or_component_attestation(self):
        with tempfile.TemporaryDirectory() as temporary:
            path, original, options = self.public_candidate_fixture(Path(temporary))
            mutations = [
                ("source_sha", "a" * 40), ("source_workflow_run_id", 124),
                ("source_workflow_ref", "9holy/webcodex/.github/workflows/release-build.yml@refs/heads/main"),
                ("platform", "win32-arm64"), ("schema_version", True),
            ]
            for key, changed in mutations:
                manifest = {**original, key: changed}
                path.write_text(json.dumps(manifest), encoding="utf-8")
                with self.subTest(key=key), self.assertRaises(smoke.SmokeFailure):
                    smoke.verify_candidate_manifest(path, smoke.digest(path), **options)
            for change in ("missing_desktop", "changed_desktop_hash", "different_native_probe", "changed_build_info", "redirected_destination"):
                manifest = copy.deepcopy(original)
                if change == "missing_desktop":
                    manifest["artifacts"].pop("webcodex-desktop")
                elif change == "changed_desktop_hash":
                    manifest["artifacts"]["webcodex-desktop"]["sha256"] = "f" * 64
                elif change == "different_native_probe":
                    manifest["artifacts"]["webcodex"]["probe"] = "local-unverified"
                elif change == "changed_build_info":
                    manifest["artifacts"]["webcodex-desktop"]["build_info"]["git_commit"] = "a" * 40
                else:
                    manifest["desktop_payload"]["managed_files"][0]["path"] = "Other.exe"
                path.write_text(json.dumps(manifest), encoding="utf-8")
                with self.subTest(change=change), self.assertRaises(smoke.SmokeFailure):
                    smoke.verify_candidate_manifest(path, smoke.digest(path), **options)
            path.write_text(json.dumps(original), encoding="utf-8")
            with self.assertRaises(smoke.SmokeFailure):
                smoke.verify_candidate_manifest(path, "0" * 64, **options)
            raw = path.read_text(encoding="utf-8")
            path.write_text('{"version":"0.5.4",' + raw[1:], encoding="utf-8")
            with self.assertRaises(smoke.SmokeFailure):
                smoke.verify_candidate_manifest(path, smoke.digest(path), **options)

    def test_complete_candidate_mode_requires_public_manifest_and_exact_build_run(self):
        common = ["--previous-installer", "old.exe", "--previous-installer-sha256", smoke.UPSTREAM_SHA256["win32-x64"],
            "--published-installer", "published.exe", "--published-installer-sha256", "a" * 64,
            "--published-cli", "published/webcodex.exe", "--report", "report.json",
            "--candidate-cli", "candidate/webcodex.exe", "--candidate-version", "0.5.4", "--candidate-source-sha", "c" * 40]
        classifier = smoke.arguments(["--verify-classifier", *common])
        self.assertTrue(classifier.verify_classifier)
        self.assertEqual(classifier.previous_version, "0.5.0")
        full = ["--candidate-installer", "candidate.exe", "--candidate-installer-sha256", "b" * 64,
            "--candidate-source-manifest", "manifest.json", "--candidate-source-manifest-sha256", "d" * 64,
            "--candidate-build-run-id", "123"]
        self.assertEqual(smoke.arguments(["--verify-candidate", *common, *full]).candidate_build_run_id, 123)
        for selected in (["--verify-candidate", *common], ["--verify-classifier", *common, *full],
                         ["--verify-candidate", *common, *full[:-1], "0"]):
            with mock.patch("sys.stderr", new=io.StringIO()), self.assertRaises(SystemExit):
                smoke.arguments(selected)

    def v054_candidate_arguments(self, platform="win32-x64"):
        return ["--verify-candidate", "--platform", platform, "--previous-version", "0.5.4",
            "--previous-installer", "old.exe", "--previous-installer-sha256", smoke.V054_SHA256[platform],
            "--candidate-cli", "candidate/webcodex.exe", "--candidate-version", "0.5.6",
            "--candidate-source-sha", "c" * 40, "--candidate-installer", "candidate.exe",
            "--candidate-installer-sha256", "b" * 64, "--candidate-source-manifest", "manifest.json",
            "--candidate-source-manifest-sha256", "d" * 64, "--candidate-build-run-id", "123",
            "--report", "report.json"]

    def test_v054_uses_only_the_two_fixed_published_standard_installers(self):
        self.assertEqual(smoke.V054_SOURCE, "1af9bb5321edcdc16a4f1a5be65d0611ef19964a")
        self.assertEqual(smoke.V054_SHA256, {
            "win32-x64": "6dbaa9075541d44a2c4f22075409abdb43f25a0a41f50aa26fc73cc137f9cc8e",
            "win32-arm64": "b233872dc776d2a706235ac5fcc593b7949f7b38d878dd7de099ec7e513ad180",
        })
        for platform in smoke.PLATFORMS:
            selected = self.v054_candidate_arguments(platform)
            args = smoke.arguments(selected)
            self.assertEqual((args.platform, args.previous_version), (platform, "0.5.4"))
            self.assertTrue(args.verify_candidate)
            self.assertIsNone(args.published_installer)
            self.assertIsNone(args.published_installer_sha256)
            self.assertIsNone(args.published_cli)
            for digest in (smoke.UPSTREAM_SHA256[platform], "0" * 64,
                           smoke.V054_SHA256[next(p for p in smoke.PLATFORMS if p != platform)]):
                changed = selected.copy()
                changed[changed.index("--previous-installer-sha256") + 1] = digest
                with self.subTest(platform=platform, digest=digest), \
                        mock.patch("sys.stderr", new=io.StringIO()), self.assertRaises(SystemExit):
                    smoke.arguments(changed)

    def test_v054_cannot_select_reproduction_classifier_or_partial_candidate_verification(self):
        selected = self.v054_candidate_arguments()
        invalid = [[mode, *selected[1:]] for mode in ("--reproduce-only", "--verify-classifier")]
        for flag in ("--candidate-cli", "--candidate-version", "--candidate-source-sha",
                     "--candidate-installer", "--candidate-installer-sha256", "--candidate-source-manifest",
                     "--candidate-source-manifest-sha256", "--candidate-build-run-id"):
            index = selected.index(flag)
            invalid.append(selected[:index] + selected[index + 2:])
        for flag in ("--published-installer", "--published-installer-sha256", "--published-cli",
                     "--previous-source-sha"):
            invalid.append([*selected, flag, "unexpected"])
        for version in ("0.5.3", "0.5.5", "latest", "../../old"):
            changed = selected.copy()
            changed[changed.index("--previous-version") + 1] = version
            invalid.append(changed)
        # Duplicated options cannot select the legacy route with the v0.5.4 bytes.
        invalid.append([*selected, "--previous-version", "0.5.0"])
        for changed in invalid:
            with self.subTest(arguments=changed), mock.patch("sys.stderr", new=io.StringIO()), self.assertRaises(SystemExit):
                smoke.arguments(changed)

    def test_default_v050_still_requires_the_complete_published_reproduction_inputs(self):
        selected = ["--reproduce-only", "--previous-installer", "old.exe",
            "--previous-installer-sha256", smoke.UPSTREAM_SHA256["win32-x64"],
            "--published-installer", "published.exe", "--published-installer-sha256", "a" * 64,
            "--published-cli", "published/webcodex.exe", "--report", "report.json"]
        args = smoke.arguments(selected)
        self.assertEqual(args.previous_version, "0.5.0")
        self.assertTrue(args.reproduce_only)
        self.assertEqual(smoke.NativeSmoke(args).report["published_source"], smoke.PUBLISHED_SOURCE)
        for flag in ("--published-installer", "--published-installer-sha256", "--published-cli"):
            index = selected.index(flag)
            with self.subTest(flag=flag), mock.patch("sys.stderr", new=io.StringIO()), self.assertRaises(SystemExit):
                smoke.arguments(selected[:index] + selected[index + 2:])

    def test_previous_build_observation_checks_exact_v054_source_and_keeps_v050_behavior(self):
        for previous in ("0.5.0", "0.5.4"):
            for platform, (_, target, architecture) in smoke.PLATFORMS.items():
                selected = self.v054_candidate_arguments(platform)
                if previous == "0.5.0":
                    selected[selected.index("--previous-version") + 1] = previous
                    selected[selected.index("--previous-installer-sha256") + 1] = smoke.UPSTREAM_SHA256[platform]
                    selected += ["--published-installer", "published.exe", "--published-installer-sha256", "a" * 64,
                                 "--published-cli", "published/webcodex.exe"]
                args = smoke.arguments(selected)
                native = smoke.NativeSmoke(args)
                native.installed = Path("isolated-desktop")
                source = smoke.V054_SOURCE if previous == "0.5.4" else "e" * 40
                identity = {"version": previous, "git_commit": source, "git_dirty": False,
                            "target": target, "architecture": architecture}
                programs = tuple(smoke.PROGRAMS) if previous == "0.5.4" else tuple(smoke.PROGRAMS)[:3]
                results = [smoke.CommandResult(0, json.dumps({"binary": name, **identity}).encode(), b"")
                           for name in programs]
                with self.subTest(previous=previous, platform=platform), \
                        mock.patch.object(smoke, "run_command", side_effect=results) as run:
                    native.observe_previous_runtime()
                self.assertEqual(native.report["upstream_runtime"], identity)
                self.assertNotIn("previous_runtime", native.report)
                self.assertEqual([call.args[0] for call in run.call_args_list], [
                    [str(native.installed / smoke.PROGRAMS[name]), "--build-info-json"] for name in programs])
                self.assertEqual("published_source" in native.report, previous == "0.5.0")

    def test_each_v054_installed_program_must_have_the_pinned_clean_native_build_identity(self):
        args = smoke.arguments(self.v054_candidate_arguments())
        identity = {"version": "0.5.4", "git_commit": smoke.V054_SOURCE, "git_dirty": False,
                    "target": "x86_64-pc-windows-msvc", "architecture": "x86_64"}
        for rejected in smoke.PROGRAMS:
            for change in ({"version": "0.5.0"}, {"git_commit": "e" * 40}, {"git_dirty": True},
                           {"target": "aarch64-pc-windows-msvc"}, {"architecture": "aarch64"},
                           {"binary": "different"}):
                native = smoke.NativeSmoke(args)
                native.installed = Path("isolated-desktop")
                results = [smoke.CommandResult(0, json.dumps({"binary": name, **identity,
                    **(change if name == rejected else {})}).encode(), b"") for name in smoke.PROGRAMS]
                with self.subTest(program=rejected, change=change), \
                        mock.patch.object(smoke, "run_command", side_effect=results), self.assertRaises(smoke.SmokeFailure):
                    native.observe_previous_runtime()
                self.assertNotIn("upstream_runtime", native.report)

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
        self.assertEqual(smoke.rejection_verdict(dos, verbatim, 1), "reproduced_cli_path_rejection")
        self.assertEqual(smoke.rejection_verdict(dos, verbatim, 0), "published_outer_did_not_reject")
        owner = smoke.classification(smoke.CommandResult(1, b"", b"installer_owner: The installed program belongs to another Windows account"))
        self.assertEqual(smoke.rejection_verdict(dos, owner, 1), "blocked_by_installed_program_owner")
        self.assertEqual(smoke.rejection_verdict(dos, dos, 1), "different_or_unresolved_classification_failure")

    def test_observed_admin_owner_rejection_requires_exact_sid_and_same_file_evidence(self):
        dos = smoke.classification(smoke.CommandResult(1, b"", b"installer_owner: The installed Environment owner or runtime target differs"))
        owner = smoke.classification(smoke.CommandResult(1, b"", b"installer_owner: The installed program belongs to another Windows account"))
        user, admin = "S-1-5-21-100-200-300-500", "S-1-5-32-544"
        evidence = {"unconfigured": owner,
            "owners": {"helper_exit_code": 0, "token_user": user, "token_owner": admin,
                       "files": {name: admin for name in ("install_directory", *smoke.PROGRAMS)}},
            "environment": {"owner_identity": user, "runtime_paths_resolve_to_installed_files": True},
            "private_owners": {"helper_exit_code": 0, "token_user": user,
                               "files": {"environment_directory": user, "environment_record": user}}}
        self.assertEqual(smoke.rejection_verdict(dos, owner, 1, **evidence), "reproduced_cli_path_and_admin_owner_rejections")
        for key, changed in (("environment", {"owner_identity": "other-owner", "runtime_paths_resolve_to_installed_files": True}),
                             ("environment", {"owner_identity": user, "runtime_paths_resolve_to_installed_files": False}),
                             ("private_owners", {"helper_exit_code": 0, "token_user": user, "files": {"environment_directory": admin}}),
                             ("unconfigured", smoke.classification(smoke.CommandResult(1, b"", b"unrelated failure")))):
            self.assertNotEqual(smoke.rejection_verdict(dos, owner, 1, **{**evidence, key: changed}),
                                "reproduced_cli_path_and_admin_owner_rejections")
        evidence["owners"]["files"]["webcodex-runner"] = "S-1-5-21-400-500-600-1000"
        self.assertNotEqual(smoke.rejection_verdict(dos, owner, 1, **evidence), "reproduced_cli_path_and_admin_owner_rejections")

    def test_classification_report_does_not_copy_arbitrary_output_or_credentials(self):
        result = smoke.classification(smoke.CommandResult(1,
            b'{"token":"fixture-secret-must-not-be-reported","kind":"environment"}',
            b"unrecognized error fixture-secret-must-not-be-reported installer_registration "
            b"installer_program_acl upgrade_restore_security upgrade_program_changed"))
        encoded = json.dumps(result)
        self.assertNotIn("fixture-secret", encoded)
        self.assertNotIn("token", encoded)
        self.assertEqual(len(result["output_sha256"]), 64)
        self.assertEqual(result["diagnostic_codes"], ["installer_registration", "installer_program_acl",
                                                     "upgrade_restore_security", "upgrade_program_changed"])

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

    def test_service_identity_and_enabled_state_must_survive_upgrade_and_restart(self):
        rows = {name: {"id": "owned-" + name, "enabled": True, "running": True}
                for name in ("server", "runner")}
        baseline = smoke.service_identity({"scope": "user", "components": rows})
        for name in rows:
            rows[name]["running"] = False
        smoke.unchanged(baseline, smoke.service_identity({"scope": "user", "components": rows}), "service restart")
        rows["runner"]["enabled"] = False
        with self.assertRaises(smoke.SmokeFailure):
            smoke.unchanged(baseline, smoke.service_identity({"scope": "user", "components": rows}), "service restart")
        rows["runner"]["enabled"] = None
        with self.assertRaises(smoke.SmokeFailure):
            smoke.service_identity({"scope": "user", "components": rows})

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
