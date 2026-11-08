from __future__ import annotations

import copy
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

from scripts import release_github_actions as base
from scripts import release_github_actions_v054 as staged
from scripts import release_github_actions_v055 as v055
from scripts import release_github_actions_v056 as v056
from scripts import release_github_actions_v057 as v057
from scripts import release_windows_acceptance as worker
from scripts import verify_public_release as public
from scripts import windows_unified_upgrade_smoke as smoke


def assets(version="0.5.4", platform_scope="all"):
    names = {"SHA256SUMS", "manifest.json", "webcodex-release-manifest.json"}
    platforms = base.release_scope.platforms(platform_scope, public.PLATFORMS)
    names.update(public.canonical_archive_name(version, platform) for platform in platforms)
    names.update(public.canonical_source_manifest_name(version, platform) for platform in platforms)
    names.update(public.canonical_installer_name(version, target)
                 for target in base.release_scope.installers(platform_scope, public.INSTALLER_TARGETS))
    names.update(public.canonical_desktop_name(version, platform)
                 for platform in base.release_scope.platforms(platform_scope, public.desktop_platforms_for_version(version)))
    return {name: {"name": name, "size": 42, "sha256": hashlib.sha256(name.encode()).hexdigest()} for name in sorted(names)}


def request(spec=staged.SPEC):
    return {"schema_version": 1, "repo": "9holy/webcodex", "repo_id": 1404596174,
        "tag": "v0.5.4", "source_sha": spec.pinned_request["source_sha"], "control_sha": "b" * 40,
        "request_id": "wa_" + "1" * 32, "controller_run_id": 123, "controller_workflow": spec.workflow_path,
        "release_id": 234, "tag_object_sha": "a" * 40, "build_run_id": 345, "build_run_attempt": 1,
        "release_body_sha256": hashlib.sha256(b"reviewed release").hexdigest(), "assets": assets()}


def fixed_request(spec):
    value = request(spec)
    value.update(tag=spec.pinned_request["tag"], assets=assets(spec.pinned_request["version"], spec.platform_scope))
    return value


def release(request):
    return {"id": request["release_id"], "tag_name": request["tag"], "name": f"WebCodex {request['tag']}",
        "body": "reviewed release", "draft": False, "prerelease": True, "published_at": "2026-11-01T00:00:00Z",
        "author": {"id": base.BOT_ID, "login": base.BOT_LOGIN},
        "assets": [{"id": index + 1, "name": name, "state": "uploaded", "size": item["size"],
                    "digest": "sha256:" + item["sha256"],
                    "browser_download_url": f"https://github.com/9holy/webcodex/releases/download/{request['tag']}/{name}"}
                   for index, (name, item) in enumerate(request["assets"].items())]}


def report(request, platform="win32-x64", run_id=456, attempt=1):
    version = request["tag"][1:]
    value = {"schema_version": 1, "kind": "windows-release-acceptance", "platform": platform,
        "request_sha256": worker.request_digest(request), "workflow_run_id": run_id,
        "workflow_run_attempt": attempt, "passed": True,
        "scenarios": dict.fromkeys(worker.scenarios_for_request(request), True),
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
    if worker.scenarios_for_request(request) == worker.V056_SCENARIOS:
        previous_hash, previous_size = worker.V054_INSTALLERS[platform]
        value["scenario_exit_codes"] = dict.fromkeys(worker.V056_SCENARIOS, 0)
        value["v054_unconfigured"] = {
            "previous_version": "0.5.4", "previous_source_sha": worker.V054_SOURCE,
            "previous_installer_sha256": previous_hash, "previous_installer_size": previous_size,
            "candidate_installer_sha256": value["configured"]["inputs"]["candidate_installer_sha256"],
            "candidate_source_manifest_sha256": value["configured"]["candidate_source_manifest"]["sha256"],
            "program_sha256": copy.deepcopy(value["configured"]["candidate_source_manifest"]["program_sha256"]),
        }
        native = copy.deepcopy(value["configured"])
        _, target, architecture = smoke.PLATFORMS[platform]
        native["upstream_runtime"] = {"version": "0.5.4", "git_commit": worker.V054_SOURCE,
                                      "git_dirty": False, "target": target, "architecture": architecture}
        native["inputs"]["previous_installer_sha256"] = previous_hash
        native["candidate_outer"] = {"exit_code": 0, "exact_native_programs": True,
            "private_state_preserved": True, "original_directory_preserved": True, "unrelated_process_alive": True}
        value["v054_configured"] = native
    return value


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
        return fixed_request(spec)

    def test_exact_pairs_select_only_their_code_owned_specification(self):
        for module in (staged, v055, v056, v057):
            spec = self.finalized_spec(module)
            with self.subTest(tag=spec.pinned_request["tag"]), mock.patch.object(module, "SPEC", spec):
                self.assertIs(worker.select_release_spec(self.fixed_request(spec)), spec)

    def test_windows_scope_requires_exact_two_architecture_assets_and_reaches_public_verifier(self):
        spec = self.finalized_spec(v056)
        req = self.fixed_request(spec)
        self.assertEqual(len(req["assets"]), 11)
        worker.validate_request(req, spec)
        published = release(req)
        for item in published["assets"]:
            item["browser_download_url"] = f"https://github.com/9holy/webcodex/releases/download/{req['tag']}/{item['name']}"
        self.assertEqual(len(worker.validate_public_assets(published, req, platform_scope=spec.platform_scope)), 11)
        with self.assertRaises(public.VerificationError):
            worker.validate_public_assets(published, req)
        for invalid_assets in (assets("0.5.6"), {k: v for k, v in req["assets"].items() if k != "webcodex-release-manifest.json"}):
            changed = dict(req, assets=invalid_assets)
            with self.subTest(size=len(invalid_assets)), self.assertRaises(base.ReleaseControlError):
                worker.validate_request(changed, spec)

    def test_unknown_crossed_or_missing_pairs_have_no_fallback(self):
        spec = self.finalized_spec(v056)
        modules = (staged, v055, v056, v057)
        crossed = [(left.SPEC.pinned_request["tag"], right.SPEC.workflow_path)
                   for left in modules for right in modules if left is not right]
        for tag, workflow in crossed + [("v0.5.8", ".github/workflows/release-publish-v058.yml"),
                                       ("v0.5.6", ".github/workflows/ci.yml"),
                                       (None, spec.workflow_path), ("v0.5.6", None)]:
            candidate = self.fixed_request(spec)
            candidate.update(tag=tag, controller_workflow=workflow)
            with self.subTest(tag=tag, workflow=workflow), self.assertRaises(base.ReleaseControlError):
                worker.select_release_spec(candidate)

    def test_selection_still_validates_the_complete_request(self):
        for module in (staged, v055, v056, v057):
            spec = self.finalized_spec(module)
            for change in (lambda r: r.update(source_sha="f" * 40),
                           lambda r: r.update(repo_id=999),
                           lambda r: r.update(build_run_id=True),
                           lambda r: r.update(skip_upgrade=True)):
                candidate = self.fixed_request(spec)
                change(candidate)
                with self.subTest(tag=spec.pinned_request["tag"]), mock.patch.object(module, "SPEC", spec), \
                        self.assertRaises(base.ReleaseControlError):
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
        for module in (staged, v055, v056, v057):
            finalized = self.finalized_spec(module)
            for field, value in (("source_sha", "0" * 40), ("source_tree", "0" * 40),
                                 ("ci_run_id", 1), ("evidence_run_id", 1)):
                spec = base.ReleaseSpec({**dict(finalized.pinned_request), field: value},
                                        finalized.request_path, finalized.workflow_path)
                with self.subTest(tag=spec.pinned_request["tag"], field=field), mock.patch.object(module, "SPEC", spec):
                    self.assert_main_refuses_before_execution(base._json_bytes(self.fixed_request(spec)).decode())

    def test_worker_bounds_and_duplicate_keys_precede_authority_selection(self):
        for raw in (" " * (worker.MAX_REQUEST_BYTES + 1), '{"tag":"v0.5.4","tag":"v0.5.5"}'):
            with mock.patch.object(worker, "select_release_spec") as select:
                self.assert_main_refuses_before_execution(raw)
            select.assert_not_called()


class V056UpgradeAcceptanceTests(unittest.TestCase):
    def test_fixed_windows_entries_require_five_scenarios_and_two_real_configured_reports(self):
        for spec, expected in ((staged.SPEC, worker.SCENARIOS), (v055.SPEC, worker.SCENARIOS),
                               (v056.SPEC, worker.V056_SCENARIOS), (v057.SPEC, worker.V056_SCENARIOS)):
            req = fixed_request(spec)
            for platform in worker.PLATFORMS:
                value = report(req, platform)
                with self.subTest(tag=req["tag"], platform=platform):
                    self.assertEqual(set(value["scenarios"]), set(expected))
                    worker.validate_report(value, req, platform, 456, 1)
                    if expected == worker.V056_SCENARIOS:
                        for scenario in ("v054_unconfigured", "v054_configured"):
                            invalid = copy.deepcopy(value)
                            del invalid["scenarios"][scenario]
                            with self.assertRaises(base.ReleaseControlError):
                                worker.validate_report(invalid, req, platform, 456, 1)
                    else:
                        self.assertNotIn("v054_configured", value)

    def test_v054_scenarios_require_actual_success_and_exact_fixed_inputs(self):
        req = fixed_request(v056.SPEC)
        mutations = [
            (("scenarios", "v054_unconfigured"), False), (("scenarios", "v054_configured"), False),
            (("scenario_exit_codes", "v054_unconfigured"), 2),
            (("scenario_exit_codes", "v054_configured"), True),
            (("v054_unconfigured", "previous_version"), "0.5.0"),
            (("v054_unconfigured", "previous_source_sha"), "f" * 40),
            (("v054_unconfigured", "previous_installer_sha256"), "f" * 64),
            (("v054_unconfigured", "previous_installer_size"), 42),
            (("v054_unconfigured", "candidate_installer_sha256"), "f" * 64),
            (("v054_unconfigured", "candidate_source_manifest_sha256"), "f" * 64),
            (("v054_unconfigured", "program_sha256", "webcodex-desktop"), "f" * 64),
            (("v054_configured", "upstream_runtime", "version"), "0.5.0"),
            (("v054_configured", "upstream_runtime", "git_commit"), "f" * 40),
            (("v054_configured", "upstream_runtime", "git_dirty"), 0),
            (("v054_configured", "upstream_runtime", "target"), "wrong-target"),
            (("v054_configured", "upstream_runtime", "architecture"), "wrong-architecture"),
            (("v054_configured", "inputs", "previous_installer_sha256"), "f" * 64),
            (("v054_configured", "mode"), "verify_classifier"),
            (("v054_configured", "complete_upgrade_verified"), False),
            (("v054_configured", "cleanup", "complete"), False),
            (("v054_configured", "candidate_runtime", "git_commit"), "f" * 40),
            (("v054_configured", "inputs", "candidate_installer_sha256"), "f" * 64),
            (("v054_configured", "candidate_source_manifest", "source_sha"), "f" * 40),
            (("v054_configured", "candidate_source_manifest", "runtime_archive_bytes_verified"), False),
            (("v054_configured", "candidate_source_manifest", "program_sha256", "webcodex-desktop"), "f" * 64),
            (("v054_configured", "candidate_outer", "exit_code"), 1),
            (("v054_configured", "candidate_outer", "private_state_preserved"), False),
            (("v054_configured", "candidate_outer", "original_directory_preserved"), False),
            (("v054_configured", "candidate_outer", "unrelated_process_alive"), False),
            (("v054_configured", "candidate_outer", "exact_native_programs"), False),
        ]
        for platform in worker.PLATFORMS:
            for path, replacement in mutations:
                invalid = report(req, platform)
                target = invalid
                for key in path[:-1]:
                    target = target[key]
                target[path[-1]] = replacement
                with self.subTest(platform=platform, field=".".join(path)), self.assertRaises(base.ReleaseControlError):
                    worker.validate_report(invalid, req, platform, 456, 1)

    def run_worker(self, spec, platform, *, fail_scenario=None, missing_report=False):
        """Exercise worker orchestration, mocking only network/native boundaries."""
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        req = fixed_request(spec)
        output = report(req, platform)
        output["passed"] = False
        output["scenarios"] = dict.fromkeys(worker.scenarios_for_request(req), False)
        for key in ("configured", "v054_configured", "v054_unconfigured", "scenario_exit_codes"):
            output.pop(key, None)
        repo = {"id": req["repo_id"], "full_name": req["repo"]}
        run = {"id": 456, "run_attempt": 1, "path": f".github/workflows/{worker.WORKFLOW}",
            "event": "workflow_dispatch", "head_branch": "main", "head_sha": req["control_sha"],
            "display_title": worker.run_name(req), "repository": repo, "head_repository": repo,
            "actor": {"id": base.BOT_ID, "login": base.BOT_LOGIN}}
        responses = {
            "/actions/runs/456/attempts/1": run,
            f"/actions/runs/{req['controller_run_id']}": {"id": req["controller_run_id"],
                "path": spec.workflow_path, "head_sha": req["control_sha"], "head_branch": "main",
                "repository": repo, "head_repository": repo, "event": "push",
                "actor": {"id": spec.pinned_request["owner_id"], "login": spec.pinned_request["owner"]}},
            f"/git/ref/tags/{req['tag']}": {"object": {"type": "tag", "sha": req["tag_object_sha"]}},
            f"/git/tags/{req['tag_object_sha']}": {"object": {"type": "commit", "sha": req["source_sha"]}},
            f"/actions/runs/{req['build_run_id']}/attempts/{req['build_run_attempt']}": {
                "id": req["build_run_id"], "run_attempt": req["build_run_attempt"],
                "path": ".github/workflows/release-build.yml", "event": "workflow_dispatch",
                "head_sha": req["source_sha"], "head_branch": req["tag"], "repository": repo,
                "head_repository": repo, "status": "completed", "conclusion": "success"},
            f"/releases/{req['release_id']}": release(req),
        }
        env = {"PROCESSOR_ARCHITECTURE": smoke.PLATFORMS[platform][0], "GITHUB_REPOSITORY": req["repo"],
            "GITHUB_SHA": req["control_sha"], "GITHUB_WORKFLOW_SHA": req["control_sha"],
            "GITHUB_REF": "refs/heads/main", "GITHUB_WORKFLOW_REF": f"{req['repo']}/.github/workflows/{worker.WORKFLOW}@refs/heads/main",
            "GITHUB_ACTOR": base.BOT_LOGIN, "GITHUB_RUN_ID": "456", "GITHUB_RUN_ATTEMPT": "1",
            "APPDATA": str(root / "appdata"), "LOCALAPPDATA": str(root),
            "GH_TOKEN": "private-token", "ACTIONS_RUNTIME_TOKEN": "private-runtime-token"}
        commands = []
        def native(command, label, *, timeout, env):
            scenario = label.split()[1]
            commands.append((scenario, command))
            self.assertNotIn("GH_TOKEN", env)
            self.assertNotIn("ACTIONS_RUNTIME_TOKEN", env)
            if "--report" in command and not missing_report:
                destination = Path(command[command.index("--report") + 1])
                destination.write_bytes(base._json_bytes(report(req, platform)[scenario]))
            return smoke.CommandResult(2 if scenario == fail_scenario else 0, b"", b"")
        program_hashes = report(req, platform)["configured"]["candidate_source_manifest"]["program_sha256"]
        manifest = {"artifacts": {name: {"sha256": digest, "build_info": {"built_at": "1"}}
                                  for name, digest in program_hashes.items()}}
        with mock.patch.object(worker, "os", SimpleNamespace(name="nt", environ=env)), \
                mock.patch.object(base.collector, "GitHubClient") as client, \
                mock.patch.object(worker, "_download") as download, \
                mock.patch.object(public, "inspect_archive"), \
                mock.patch.object(smoke, "verify_candidate_manifest", return_value=manifest), \
                mock.patch.object(smoke, "run_command", side_effect=native):
            client.return_value.fetch_json.side_effect = lambda path: responses[path]
            if fail_scenario or missing_report:
                with self.assertRaises(base.ReleaseControlError):
                    worker.execute(req, platform, root / "inputs", output, spec=spec)
            else:
                worker.execute(req, platform, root / "inputs", output, spec=spec)
        return output, commands, download.call_args_list

    def test_native_boundary_runs_five_windows_scenarios_and_only_original_three_for_prior_entries(self):
        for spec in (staged.SPEC, v055.SPEC, v056.SPEC, v057.SPEC):
            for platform in worker.PLATFORMS:
                with self.subTest(tag=spec.pinned_request["tag"], platform=platform):
                    output, commands, downloads = self.run_worker(spec, platform)
                    self.assertIs(output["passed"], True)
                    self.assertEqual(set(dict(commands)), set(worker.scenarios_for_request(fixed_request(spec))))
                    old = dict(commands)["configured"]
                    self.assertIn("--published-cli", old)
                    self.assertNotIn("--previous-version", old)
                    if spec.platform_scope != "windows":
                        self.assertFalse(any("webcodex-desktop-v0.5.4-" in call.args[0] for call in downloads))
                        continue
                    unconfigured = dict(commands)["v054_unconfigured"]
                    self.assertTrue(unconfigured[unconfigured.index("-File") + 1].endswith("desktop_install_windows_smoke.ps1"))
                    self.assertEqual(unconfigured[unconfigured.index("-PreviousInstallerSha256") + 1], worker.V054_INSTALLERS[platform][0])
                    hashes = Path(unconfigured[unconfigured.index("-ExpectedProgramHashes") + 1])
                    self.assertEqual(json.loads(hashes.read_bytes()), output["v054_unconfigured"]["program_sha256"])
                    configured = dict(commands)["v054_configured"]
                    self.assertEqual(configured[configured.index("--previous-version") + 1], "0.5.4")
                    self.assertEqual(configured[configured.index("--previous-installer-sha256") + 1], worker.V054_INSTALLERS[platform][0])
                    self.assertFalse(any(value.startswith("--published-") for value in configured))
                    pinned = [call for call in downloads if "v0.5.4/" in call.args[0]]
                    self.assertEqual(len(pinned), 1)
                    self.assertEqual(pinned[0].args[2:], worker.V054_INSTALLERS[platform])
                    self.assertEqual(pinned[0].args[0], f"https://github.com/9holy/webcodex/releases/download/v0.5.4/webcodex-desktop-v0.5.4-{platform}-setup.exe")

    def test_failed_v054_helper_and_absent_native_report_cannot_satisfy_acceptance(self):
        for scenario in ("v054_unconfigured", "v054_configured"):
            with self.subTest(scenario=scenario):
                output, commands, _ = self.run_worker(v056.SPEC, "win32-x64", fail_scenario=scenario)
                self.assertIs(output["scenarios"][scenario], False)
                self.assertEqual(output["scenario_exit_codes"][scenario], 2)
                self.assertEqual(commands[-1][0], scenario)
        self.run_worker(v056.SPEC, "win32-arm64", missing_report=True)

    def test_two_native_reports_fit_existing_budget_and_overflow_fails_closed(self):
        req = fixed_request(v056.SPEC)
        for padding, expected in ((64 * 1024, 0), (worker.MAX_REPORT_BYTES, 1)):
            with self.subTest(padding=padding), tempfile.TemporaryDirectory() as tmp:
                value = report(req)
                for name in ("configured", "v054_configured"):
                    value[name]["diagnostic_fixture"] = "x" * padding
                output = Path(tmp) / "report.json"
                env = {"WEBCODEX_WINDOWS_ACCEPTANCE_REQUEST": base._json_bytes(req).decode(),
                       "GITHUB_RUN_ID": "456", "GITHUB_RUN_ATTEMPT": "1"}
                with mock.patch.dict(os.environ, env, clear=True), \
                        mock.patch.object(worker, "execute", side_effect=lambda request, platform, root, result, **kw: result.update(value)), \
                        contextlib.redirect_stdout(io.StringIO()):
                    code = worker.main(["--platform", "win32-x64", "--inputs-root", str(Path(tmp) / "inputs"),
                                        "--report", str(output)])
                self.assertEqual(code, expected)
                actual = json.loads(output.read_bytes())
                self.assertLessEqual(output.stat().st_size, worker.MAX_REPORT_BYTES)
                if expected:
                    self.assertEqual(actual, {"passed": False, "failure_type": "ReportLimit"})
                else:
                    worker.validate_report(actual, req, "win32-x64", 456, 1)


if __name__ == "__main__":
    unittest.main()
