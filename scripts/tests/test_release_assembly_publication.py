from __future__ import annotations

import contextlib
import copy
import hashlib
import io
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts import release_assembly_publication as recovery
from scripts import recover_release_assembly as assembly
from scripts import release_github_actions as base
from scripts.tests import test_release_github_actions as fixtures


ROOT = Path(__file__).resolve().parents[2]


def _origin() -> dict:
    return json.loads((ROOT / recovery.ORIGIN_PATH).read_text(encoding="utf-8"))


def _original_tag(origin: dict) -> tuple[dict, dict]:
    journal = fixtures._journal()
    journal["created_at"] = origin["tag_created_at"]
    journal["journal_id"] = origin["tag_journal_id"]
    intent = base.annotated_tag_intent(fixtures._request(), journal)
    payload = intent["payload"]
    ref = {
        "ref": f"refs/tags/{fixtures.TAG}",
        "object": {"type": "tag", "sha": origin["tag_object_sha"]},
    }
    tag = {
        "sha": intent["sha"],
        "tag": payload["tag"],
        "message": payload["message"],
        "tagger": payload["tagger"],
        "object": {"type": "commit", "sha": fixtures.SOURCE},
    }
    return ref, tag


class RecoveryFixture(unittest.TestCase):
    def setUp(self) -> None:
        self.output = io.StringIO()
        redirect = contextlib.redirect_stdout(self.output)
        redirect.__enter__()
        self.addCleanup(redirect.__exit__, None, None, None)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.origin = _origin()
        self.controller = self.make_controller()
        self.controller.state = base.new_journal(
            self.controller.request,
            self.controller.request_digest,
            self.controller.context,
            now=1800000000,
        )
        self.controller._save()

    def make_controller(
        self, *, attempt: int = 1, run_id: int = fixtures.CONTROL_RUN,
        control_root: Path = ROOT,
    ) -> recovery.RecoveryController:
        client = mock.Mock(spec=base.collector.GitHubClient)
        client.repo = fixtures.REPO
        client.token = "fixture-token"
        client.api_url.side_effect = lambda suffix: (
            f"https://api.github.com/repos/{fixtures.REPO}{suffix}"
        )
        env = fixtures._environment(
            GITHUB_RUN_ATTEMPT=str(attempt), GITHUB_RUN_ID=str(run_id), GITHUB_JOB="publish",
        )
        controller = recovery.RecoveryController(
            control_root / base.REQUEST_PATH,
            self.root / "source",
            self.root / "state",
            self.root / "bundle",
            env=env,
            client=client,
            control_root=control_root,
        )
        controller.context = base.validate_context(
            env, controller.request,
            fixtures._controller_run(id=run_id, run_attempt=attempt),
        )
        return controller

    def summary(self, **changes) -> dict:
        result = {
            "build_kind": "release",
            "version": fixtures.VERSION,
            "source_sha": fixtures.SOURCE,
            "tag": fixtures.TAG,
            "workflow_run_id": self.origin["source_build_run_id"],
            "built_at": self.origin["built_at"],
            "archive_stem": f"webcodex-v{fixtures.VERSION}",
        }
        result.update(changes)
        return result

    def mark_origin_verified(self) -> None:
        self.controller.state["tag_object_sha"] = self.origin["tag_object_sha"]
        self.controller.state["checks"]["recovery_origin"] = self.controller._origin_receipt()
        self.controller._save()

    def original_publication_responses(self) -> dict[str, dict]:
        old = fixtures._controller_run(
            id=self.origin["original_publisher_run_id"],
            head_sha=self.origin["original_control_sha"],
            status="completed", conclusion="failure",
        )
        names = [
            "Create or reconcile the bound draft",
            "Upload retained assets without replacing existing bytes",
            "Publish the verified GitHub Release once",
            "Dispatch the existing post-publication workflows",
        ]
        job = {
            "id": 128404552109, "name": "publish", "status": "completed", "conclusion": "failure",
            "steps": [
                {"name": "Require the exact formal build to succeed", "conclusion": "failure"},
                *({"name": name, "conclusion": "skipped"} for name in names),
            ],
        }
        ready = fixtures._proof(
            "evidence", id=self.origin["readiness_run_id"], event="workflow_dispatch",
            display_title=f"Release readiness {self.origin['readiness_request_id']} {fixtures.SOURCE}",
            actor={"login": base.BOT_LOGIN, "id": base.BOT_ID},
            triggering_actor={"login": base.BOT_LOGIN, "id": base.BOT_ID},
        )
        return {
            f"/actions/runs/{self.origin['original_publisher_run_id']}": old,
            f"/actions/runs/{self.origin['original_publisher_run_id']}/attempts/1/jobs?per_page=100":
                {"total_count": 1, "jobs": [job]},
            f"/actions/runs/{self.origin['readiness_run_id']}": ready,
        }

    def bundle_fixture(self) -> tuple[dict, dict, dict[str, bytes]]:
        public = {name: f"retained bytes: {name}\n".encode() for name in assembly.public_input_names()}
        records = lambda values: {
            name: {"size": len(value), "sha256": hashlib.sha256(value).hexdigest()}
            for name, value in values.items()
        }
        inputs = []
        normalizations = []
        targets = assembly.unix_sidecar_targets()
        for pin in self.origin["artifacts"]:
            files = {}
            for name in assembly.artifact_members()[pin["name"]]:
                if name in public:
                    files[name] = public[name]
                elif name in targets:
                    source = targets[name]
                    digest = hashlib.sha256(public[source]).hexdigest()
                    before = f"{digest}  dist/{source}\n".encode()
                    after = f"{digest}  {source}\n".encode()
                    files[name] = before
                    normalizations.append({
                        "name": name, "source_filename": source,
                        "before_sha256": hashlib.sha256(before).hexdigest(),
                        "after_sha256": hashlib.sha256(after).hexdigest(),
                        "before_size": len(before), "after_size": len(after),
                    })
                else:
                    files[name] = f"private evidence: {name}\n".encode()
            inputs.append({**pin, "files": records(files)})
        generated = {name: f"generated metadata: {name}\n".encode() for name in assembly.GENERATED_PUBLIC_FILES}
        internal = {name: f"internal evidence: {name}\n".encode() for name in assembly.INTERNAL_BUNDLE_FILES}
        payloads = {**public, **generated, **internal}
        all_records = records(payloads)
        summary = self.summary(
            artifacts={platform: all_records[f"webcodex-v{fixtures.VERSION}-{platform}.tar.gz"]["sha256"]
                       for platform in base.collector.PLATFORMS},
            desktop_artifacts={
                platform: {
                    "filename": name,
                    "sha256": all_records[name]["sha256"],
                }
                for platform in base.collector.primary_desktop_platforms_for_version(fixtures.VERSION)
                for name in [base.collector.desktop_artifact_filename(
                    fixtures.VERSION, platform, build_kind="release", tag=fixtures.TAG, source_sha=fixtures.SOURCE,
                )]
            },
            installer_artifacts={
                target: {
                    "filename": name, "sha256": all_records[name]["sha256"],
                    "source_manifest_filename": source,
                    "source_manifest_sha256": all_records[source]["sha256"],
                }
                for target, (platform, _suffix) in base.collector.INSTALLER_TARGETS.items()
                for name in [base.collector.installer_artifact_filename(fixtures.VERSION, target)]
                for source in [f"webcodex-source-v{fixtures.VERSION}-{platform}.json"]
            },
            runtime_manifest={
                "filename": "webcodex-release-manifest.json",
                "sha256": all_records["webcodex-release-manifest.json"]["sha256"],
            },
        )
        receipt = {
            "schema_version": 1, "kind": assembly.RECEIPT_KIND,
            "origin_sha256": assembly.canonical_sha256(self.origin),
            "source_build": {
                "run_id": self.origin["source_build_run_id"],
                "run_attempt": self.origin["source_build_run_attempt"],
                "request_id": self.origin["source_build_request_id"],
                "source_sha": fixtures.SOURCE, "tag": fixtures.TAG,
                "workflow_ref": self.origin["source_build_workflow_ref"],
                "tag_object_sha": self.origin["tag_object_sha"], "built_at": self.origin["built_at"],
            },
            "assembly": self.controller._assembly_context(), "inputs": inputs,
            "normalizations": normalizations,
            "scripts": {name: {"original_sha256": digest, "executed_sha256": assembly.EXECUTED_STEP_SHA256[name]}
                        for name, digest in assembly.STEP_SHA256.items()},
            "public_inputs": records(public), "generated_public_files": records(generated),
            "bundle_files": all_records, "summary_sha256": assembly.canonical_sha256(summary),
        }
        assembly.validate_receipt(self.origin, receipt, self.controller._assembly_context())
        return summary, receipt, payloads

    def install_bundle(self) -> tuple[dict, dict, dict[str, bytes]]:
        self.mark_origin_verified()
        summary, receipt, payloads = self.bundle_fixture()
        self.controller.bundle_dir.mkdir()
        for name, value in payloads.items():
            (self.controller.bundle_dir / name).write_bytes(value)
        self.controller.state["checks"]["assembly_recovery"] = receipt
        self.controller.state["checks"]["assembly_summary"] = summary
        self.controller.state["bundle"] = {
            "workflow_run_id": self.origin["source_build_run_id"],
            "source_sha": fixtures.SOURCE, "tag": fixtures.TAG,
            "sha256sums_sha256": hashlib.sha256(payloads["SHA256SUMS"]).hexdigest(),
            "origin_sha256": recovery.ORIGIN_SHA256, "assembly_run_id": fixtures.CONTROL_RUN,
            "assembly_control_sha": fixtures.CONTROL,
        }
        self.controller._save()
        return summary, receipt, payloads


class RecoveryScopeTests(RecoveryFixture):
    def test_origin_file_matches_reviewed_digest_and_product_identity(self) -> None:
        raw = (ROOT / recovery.ORIGIN_PATH).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), recovery.ORIGIN_SHA256)
        self.assertEqual(self.origin["source_sha"], fixtures.SOURCE)
        self.assertEqual(self.origin["source_tree"], fixtures.SOURCE_TREE)
        self.assertEqual(self.origin["source_build_run_id"], 42373155729)
        self.assertEqual(self.origin["source_build_run_attempt"], 1)
        self.assertEqual(self.origin["tag_object_sha"], "d85163dc707e45ac8c014eeec67ffa529b78e1c9")
        self.assertEqual(self.origin["built_at"], self.origin["tag_created_at"])
        self.assertTrue(self.origin["include_unified_installers"])
        self.assertFalse(self.origin["include_runtime_installers"])

    def test_changed_origin_cannot_retarget_source_tag_or_retained_artifact(self) -> None:
        control = self.root / "other-control"
        for relative in (
            base.REQUEST_PATH, self.controller.request["notes_path"], recovery.ORIGIN_PATH,
        ):
            destination = control / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes((ROOT / relative).read_bytes())
        changes = [
            {"source_sha": fixtures.CONTROL},
            {"tag_object_sha": "e" * 40},
            {"source_build_run_id": self.origin["source_build_run_id"] + 1},
            {"original_publisher_run_id": fixtures.CONTROL_RUN},
            {"include_runtime_installers": True},
        ]
        changed_artifacts = copy.deepcopy(self.origin["artifacts"])
        changed_artifacts[0]["digest"] = "sha256:" + "f" * 64
        changes.append({"artifacts": changed_artifacts})
        for changed in changes:
            (control / recovery.ORIGIN_PATH).write_bytes(
                base._json_bytes(dict(self.origin, **changed))
            )
            with self.subTest(changed=changed), self.assertRaises(base.ReleaseControlError):
                self.make_controller(control_root=control)

    def test_stage_allowlist_excludes_production_dispatch_and_tag_creation(self) -> None:
        self.assertIn("preflight-recovery", recovery.RECOVERY_STAGES)
        self.assertIn("recover-assembly", recovery.RECOVERY_STAGES)
        forbidden = {
            "preflight", "prepare-readiness", "dispatch-readiness", "status-readiness",
            "prepare-tag", "create-tag", "prepare-build", "dispatch-build",
            "status-build", "collect",
        }
        self.assertFalse(forbidden.intersection(recovery.RECOVERY_STAGES))
        with mock.patch.object(self.controller, "_authenticate") as authenticate:
            for stage in sorted(forbidden):
                with self.subTest(stage=stage), self.assertRaises(base.ReleaseControlError):
                    self.controller.run(stage)
        authenticate.assert_not_called()

    def test_release_notes_link_original_production_and_current_assembly(self) -> None:
        body = self.controller._draft_intent()["body"]
        self.assertIn(
            f"https://github.com/{fixtures.REPO}/actions/runs/{self.origin['source_build_run_id']}",
            body,
        )
        self.assertIn(
            f"https://github.com/{fixtures.REPO}/actions/runs/{fixtures.CONTROL_RUN}",
            body,
        )
        self.assertNotEqual(fixtures.CONTROL_RUN, self.origin["source_build_run_id"])


class RecoveryCheckpointTests(RecoveryFixture):
    def test_checkpoint_from_original_publisher_is_not_a_new_run_checkpoint(self) -> None:
        recovered = self.make_controller(attempt=2)
        recovered.journal_path.unlink()
        artifact = {
            "id": 778899,
            "name": f"release-control-{fixtures.TAG}-{fixtures.CONTROL_RUN}-1-99-final-state",
            "expired": False,
            "size_in_bytes": 1,
            "digest": "sha256:" + "a" * 64,
            "workflow_run": {
                "id": self.origin["original_publisher_run_id"],
                "repository_id": fixtures.REPO_ID,
                "head_repository_id": fixtures.REPO_ID,
                "head_sha": self.origin["original_control_sha"],
                "head_branch": "main",
            },
        }
        recovered.client.fetch_json.return_value = {"total_count": 1, "artifacts": [artifact]}
        with mock.patch.object(recovered, "_download_checkpoint") as download:
            with self.assertRaises(base.ReleaseControlError):
                recovered.restore_state()
        download.assert_not_called()
        self.assertFalse(recovered.journal_path.exists())


class RecoveryPreflightTests(RecoveryFixture):
    def test_failed_original_publisher_is_recorded_without_fabricating_build_success(self) -> None:
        responses = self.original_publication_responses()
        self.controller.client.fetch_json.side_effect = lambda suffix: copy.deepcopy(responses[suffix])
        with mock.patch.object(self.controller, "_proofs"), mock.patch.object(
            self.controller, "_verify_tag",
        ), mock.patch.object(self.controller, "_find_release", return_value=None), mock.patch.object(
            self.controller, "_mutate",
        ) as mutation:
            self.assertEqual(self.controller.preflight_recovery(), 0)
        mutation.assert_not_called()
        self.assertEqual(self.controller.state["checks"]["recovery_origin"], self.controller._origin_receipt())
        self.assertEqual(self.controller.state["checks"]["preflight"]["tag_action"], "observed-unchanged")
        self.assertFalse(self.controller.state["effects"])
        self.assertIsNone(self.controller.state["bundle"])
        self.assertFalse((self.controller.state_dir / "build.json").exists())

    def test_original_publisher_cannot_be_recast_as_success_or_have_started_publication(self) -> None:
        old_path = f"/actions/runs/{self.origin['original_publisher_run_id']}"
        jobs_path = old_path + "/attempts/1/jobs?per_page=100"
        for fault in ("aggregate-success", "different-failure", "draft-started", "wrong-source"):
            responses = self.original_publication_responses()
            if fault == "aggregate-success":
                responses[old_path]["conclusion"] = "success"
            elif fault == "wrong-source":
                responses[old_path]["head_sha"] = fixtures.SOURCE
            elif fault == "different-failure":
                responses[jobs_path]["jobs"][0]["steps"][0]["name"] = "Upload retained assets without replacing existing bytes"
            else:
                responses[jobs_path]["jobs"][0]["steps"][1]["conclusion"] = "success"
            self.controller.client.fetch_json.side_effect = lambda suffix: copy.deepcopy(responses[suffix])
            with self.subTest(fault=fault), self.assertRaises(base.ReleaseControlError):
                self.controller._original_publication_proofs()
        self.assertFalse(self.controller.state["effects"])

    def test_original_readiness_requires_exact_success_source_and_bot(self) -> None:
        ready_path = f"/actions/runs/{self.origin['readiness_run_id']}"
        for changed in (
            {"conclusion": "failure"}, {"head_sha": fixtures.CONTROL},
            {"run_attempt": 2}, {"actor": fixtures._actor()},
        ):
            responses = self.original_publication_responses()
            responses[ready_path].update(changed)
            self.controller.client.fetch_json.side_effect = lambda suffix: copy.deepcopy(responses[suffix])
            with self.subTest(changed=changed), self.assertRaises(base.ReleaseControlError):
                self.controller._original_publication_proofs()


class RecoveryAssemblyGateTests(RecoveryFixture):
    def test_complete_receipt_keeps_producer_and_current_assembly_identities_distinct(self) -> None:
        summary, receipt, _payloads = self.install_bundle()
        self.controller._check_bundle_summary(summary)
        self.assertEqual(summary["workflow_run_id"], self.origin["source_build_run_id"])
        self.assertEqual(receipt["source_build"]["run_id"], self.origin["source_build_run_id"])
        self.assertEqual(receipt["assembly"]["run_id"], fixtures.CONTROL_RUN)
        self.assertEqual(self.controller.state["bundle"]["assembly_control_sha"], fixtures.CONTROL)
        self.assertNotIn("build", self.controller.state["effects"])

    def test_summary_rejects_new_run_as_producer_and_changed_source_tag_or_timestamp(self) -> None:
        summary, _receipt, _payloads = self.install_bundle()
        for changes in (
            {"workflow_run_id": fixtures.CONTROL_RUN}, {"source_sha": fixtures.CONTROL},
            {"tag": "v0.5.1"}, {"built_at": self.origin["built_at"] + 1},
            {"build_kind": "verification"}, {"installer_manifest_v2": {}},
        ):
            with self.subTest(changes=changes), self.assertRaises(base.ReleaseControlError):
                self.controller._check_bundle_summary(dict(summary, **changes))

    def test_stored_summary_nested_digests_cannot_drift_with_unchanged_source_identity(self) -> None:
        summary, _receipt, _payloads = self.install_bundle()
        checkpoint = self.controller.journal_path.read_bytes()
        altered = []
        archives = copy.deepcopy(summary)
        archives["artifacts"]["linux-x64"] = "f" * 64
        altered.append(("archive", archives))
        desktop = copy.deepcopy(summary)
        desktop["desktop_artifacts"]["darwin-arm64"]["sha256"] = "f" * 64
        altered.append(("desktop", desktop))
        installer = copy.deepcopy(summary)
        installer["installer_artifacts"]["linux-x64-deb"]["source_manifest_sha256"] = "f" * 64
        altered.append(("installer-source", installer))
        for label, changed in altered:
            with self.subTest(changed=label):
                self.controller.state["checks"]["assembly_summary"] = changed
                # These still match the tag, producer, source and timestamp.
                self.controller._check_summary_identity(changed)
                with self.assertRaisesRegex(base.ReleaseControlError, "摘要"):
                    self.controller._validate_recovery_state()
                with self.assertRaisesRegex(base.ReleaseControlError, "摘要"):
                    self.controller._check_bundle_summary(changed)
                with self.assertRaisesRegex(base.ReleaseControlError, "摘要"):
                    self.controller._save()
                self.assertEqual(self.controller.journal_path.read_bytes(), checkpoint)

    def test_custom_bundle_record_cannot_change_assembly_origin_or_checksum(self) -> None:
        self.install_bundle()
        original = copy.deepcopy(self.controller.state["bundle"])
        checkpoint = self.controller.journal_path.read_bytes()
        for field, value in (
            ("assembly_run_id", self.origin["original_publisher_run_id"]),
            ("assembly_control_sha", self.origin["original_control_sha"]),
            ("origin_sha256", "e" * 64),
            ("sha256sums_sha256", "f" * 64),
            ("workflow_run_id", fixtures.CONTROL_RUN),
        ):
            with self.subTest(field=field):
                self.controller.state["bundle"] = dict(original, **{field: value})
                with self.assertRaisesRegex(base.ReleaseControlError, "候选包记录"):
                    self.controller._validate_recovery_state()
                with self.assertRaisesRegex(base.ReleaseControlError, "候选包记录"):
                    self.controller._save()
                self.assertEqual(self.controller.journal_path.read_bytes(), checkpoint)

    def test_custom_bundle_record_requires_the_complete_exact_schema(self) -> None:
        self.install_bundle()
        original = copy.deepcopy(self.controller.state["bundle"])
        missing = dict(original)
        del missing["assembly_control_sha"]
        for changed in (missing, dict(original, source_build_conclusion="success")):
            self.controller.state["bundle"] = changed
            with self.subTest(changed=changed), self.assertRaisesRegex(base.ReleaseControlError, "候选包记录"):
                self.controller._validate_recovery_state()

    def test_no_draft_before_complete_assembly_receipt_even_if_bundle_parser_succeeds(self) -> None:
        self.mark_origin_verified()
        with mock.patch.object(self.controller, "_verify_tag"), mock.patch.object(
            base.publication, "verify_bundle", return_value=self.summary(),
        ), mock.patch.object(self.controller, "_mutate") as mutation:
            with self.assertRaisesRegex(base.ReleaseControlError, "完整恢复汇总"):
                self.controller.prepare_draft()
        mutation.assert_not_called()
        self.assertNotIn("draft", self.controller.state["effects"])

    def test_recovery_state_cannot_invent_tag_creation_or_successful_build_effects(self) -> None:
        self.install_bundle()
        for effect in recovery.FORBIDDEN_EFFECTS:
            with self.subTest(effect=effect):
                self.controller.state["effects"][effect] = fixtures._effect({}, status="succeeded")
                with self.assertRaises(base.ReleaseControlError):
                    self.controller._validate_recovery_state()
                del self.controller.state["effects"][effect]
        (self.controller.state_dir / "build.json").write_text("{}", encoding="utf-8")
        with self.assertRaises(base.ReleaseControlError):
            self.controller._validate_child_states()

    def test_foreign_assembly_receipt_is_rejected_on_recovery_state_validation(self) -> None:
        self.install_bundle()
        original = copy.deepcopy(self.controller.state["checks"]["assembly_recovery"])
        for field, value in (
            ("run_id", self.origin["original_publisher_run_id"]),
            ("control_sha", self.origin["original_control_sha"]), ("run_attempt", 2),
        ):
            changed = copy.deepcopy(original)
            changed["assembly"][field] = value
            self.controller.state["checks"]["assembly_recovery"] = changed
            with self.subTest(field=field), self.assertRaises(assembly.AssemblyRecoveryError):
                self.controller._validate_recovery_state()

    def test_original_producer_failure_stops_recovery_before_any_download_or_publication(self) -> None:
        self.mark_origin_verified()
        source = self.controller.source_root / assembly.WORKFLOW_PATH
        source.parent.mkdir(parents=True)
        source.write_bytes(b"fixture source; the complete-script extractor is isolated in this test")
        run = {
            "id": self.origin["source_build_run_id"], "run_attempt": 1,
            "head_sha": fixtures.SOURCE, "head_branch": fixtures.TAG,
            "path": assembly.WORKFLOW_PATH, "event": "workflow_dispatch",
            "display_title": f"Release build {fixtures.TAG} {self.origin['source_build_request_id']}",
            "status": "completed", "conclusion": "failure",
            "repository": fixtures._repo(), "head_repository": fixtures._repo(),
        }
        jobs = []
        for pin in self.origin["jobs"]:
            if pin["name"] == "runtime-native":
                required = {}
            elif pin["name"] == "assemble":
                required = {
                    "Download same-run native candidates": "success",
                    assembly.ASSEMBLE_STEP: "failure", assembly.VERIFY_STEP: "skipped",
                    "Upload assembled candidate set": "skipped",
                }
            else:
                required = {name: "success" for name in assembly.required_producer_steps(pin["name"])}
            jobs.append({
                **pin, "run_id": self.origin["source_build_run_id"], "run_attempt": 1,
                "head_sha": fixtures.SOURCE, "status": "completed",
                "steps": [
                    {"number": index, "name": name, "status": "completed", "conclusion": conclusion}
                    for index, (name, conclusion) in enumerate(sorted(required.items()), 1)
                ],
            })
        jobs_payload = {"total_count": len(jobs), "jobs": jobs}
        # Establish that the untouched fixture is acceptable before changing one producer.
        assembly.validate_source_jobs(jobs_payload, self.origin)
        producer = next(job for job in jobs if job["name"].startswith("linux ("))
        producer["conclusion"] = "failure"
        responses = {
            f"/actions/runs/{fixtures.CONTROL_RUN}/attempts/1": fixtures._controller_run(),
            f"/actions/runs/{assembly.BUILD_RUN_ID}": run,
            f"/actions/runs/{assembly.BUILD_RUN_ID}/attempts/1": run,
            f"/actions/runs/{assembly.BUILD_RUN_ID}/attempts/1/jobs?per_page=100": jobs_payload,
        }
        self.controller.client.fetch_json.side_effect = lambda suffix: copy.deepcopy(responses[suffix])
        with mock.patch.object(self.controller, "_verify_tag"), mock.patch.object(
            base.publication, "_require_exact_clean_root",
        ), mock.patch.object(base.publication, "_git", return_value=fixtures.SOURCE_TREE), mock.patch.object(
            base.publication, "_require_package_versions",
        ), mock.patch.object(assembly, "extract_original_steps", return_value={name: "" for name in assembly.STEP_SHA256}), mock.patch.object(
            assembly, "adapt_source_identity", side_effect=lambda _name, script: script,
        ), mock.patch.object(assembly.subprocess, "run") as subprocess_run, mock.patch.object(
            self.controller, "_mutate",
        ) as mutation:
            with self.assertRaises(assembly.AssemblyRecoveryError):
                self.controller.recover_assembly()
        subprocess_run.assert_not_called()
        mutation.assert_not_called()
        self.controller.client.download_artifact_zip.assert_not_called()
        self.assertNotIn("assembly_recovery", self.controller.state["checks"])
        self.assertIsNone(self.controller.state["bundle"])

    def test_original_failed_aggregate_cannot_be_relabelled_as_success(self) -> None:
        run = {
            "id": self.origin["source_build_run_id"], "run_attempt": 1,
            "head_sha": fixtures.SOURCE, "head_branch": fixtures.TAG,
            "path": assembly.WORKFLOW_PATH, "event": "workflow_dispatch",
            "display_title": f"Release build {fixtures.TAG} {self.origin['source_build_request_id']}",
            "status": "completed", "conclusion": "failure",
            "repository": fixtures._repo(), "head_repository": fixtures._repo(),
        }
        assembly.validate_source_run(run, self.origin)
        with self.assertRaises(assembly.AssemblyRecoveryError):
            assembly.validate_source_run(dict(run, conclusion="success"), self.origin)


class RecoveryReplayTests(RecoveryFixture):
    def test_same_run_retry_reassembles_exact_retained_bytes_without_dispatching_build(self) -> None:
        self.mark_origin_verified()
        summary, receipt, payloads = self.bundle_fixture()

        def assemble_again(**kwargs):
            destination = kwargs["output_dir"]
            destination.mkdir()
            for name, value in payloads.items():
                (destination / name).write_bytes(value)
            current = copy.deepcopy(receipt)
            current["assembly"] = assembly.assembly_context_from_env(kwargs["env"])
            return copy.deepcopy(summary), current

        with mock.patch.object(self.controller, "_verify_tag"), mock.patch.object(
            assembly, "recover_assembly", side_effect=assemble_again,
        ) as reassemble, mock.patch.object(assembly.collector, "verify_bundle_directory", return_value=summary), mock.patch.object(
            base.publication, "verify_bundle", return_value=summary,
        ), mock.patch.object(base.publication, "_post_build_dispatch") as dispatch:
            self.assertEqual(self.controller.recover_assembly(), 0)
            original_bundle = copy.deepcopy(self.controller.state["bundle"])
            original_receipt = copy.deepcopy(self.controller.state["checks"]["assembly_recovery"])
            shutil.rmtree(self.controller.bundle_dir)
            retried = self.make_controller(attempt=2)
            retried._load()
            with mock.patch.object(retried, "_verify_tag"):
                self.assertEqual(retried.recover_assembly(), 0)
        self.assertEqual(reassemble.call_count, 2)
        dispatch.assert_not_called()
        self.assertEqual(retried.state["bundle"], original_bundle)
        self.assertEqual(retried.state["checks"]["assembly_recovery"], original_receipt)
        self.assertEqual(retried.state["checks"]["recovery_last_verified_attempt"], 2)
        self.assertFalse(retried.state["effects"])

    def test_existing_matching_assets_are_reconciled_on_retry_without_upload(self) -> None:
        summary, receipt, _payloads = self.install_bundle()
        intent = self.controller._draft_intent()
        release_id = 54321
        self.controller.state["release_id"] = release_id
        self.controller.state["effects"]["draft"] = fixtures._effect(intent, status="succeeded")
        expected = {**receipt["public_inputs"], **receipt["generated_public_files"]}
        release = {
            **intent, "id": release_id, "author": {"login": base.BOT_LOGIN, "id": base.BOT_ID},
            "published_at": None,
            "assets": [
                {"id": index, "name": name, "size": item["size"], "state": "uploaded",
                 "digest": "sha256:" + item["sha256"]}
                for index, (name, item) in enumerate(sorted(expected.items()), 1000)
            ],
        }
        self.controller._save()
        with mock.patch.object(base.publication, "verify_bundle", return_value=summary):
            with mock.patch.object(self.controller, "_verify_tag"), mock.patch.object(
                self.controller, "_find_release", return_value=release,
            ), mock.patch.object(self.controller, "_mutate") as first_mutation:
                self.assertEqual(self.controller.prepare_upload(), 0)
                self.assertEqual(self.controller.upload_assets(), 0)
            retried = self.make_controller(attempt=2)
            retried._load()
            with mock.patch.object(retried, "_verify_tag"), mock.patch.object(
                retried, "_find_release", return_value=release,
            ), mock.patch.object(retried, "_mutate") as next_mutation:
                self.assertEqual(retried.prepare_upload(), 0)
                self.assertEqual(retried.upload_assets(), 0)
        first_mutation.assert_not_called()
        next_mutation.assert_not_called()
        self.assertEqual(set(retried.state["assets"]), set(expected))
        self.assertTrue(all(retried.state["effects"][f"asset:{name}"]["status"] == "succeeded" for name in expected))


class RecoveryTagTests(RecoveryFixture):
    def test_exact_original_tag_is_only_observed_by_the_new_journal(self) -> None:
        ref, tag = _original_tag(self.origin)
        self.assertEqual(tag["sha"], self.origin["tag_object_sha"])
        self.controller.client.fetch_json.return_value = tag
        with mock.patch.object(self.controller, "_mutate") as mutation:
            self.controller._verify_tag(ref)
        mutation.assert_not_called()
        self.assertNotEqual(self.controller.state["journal_id"], self.origin["tag_journal_id"])
        self.assertNotIn("tag-ref", self.controller.state["effects"])
        self.assertNotIn("tag-object", self.controller.state["effects"])

    def test_unknown_lightweight_or_moved_tag_is_rejected_without_mutation(self) -> None:
        ref, tag = _original_tag(self.origin)
        self.controller.client.fetch_json.return_value = tag
        for obj in (
            {"type": "commit", "sha": fixtures.SOURCE},
            {"type": "tag", "sha": "e" * 40},
        ):
            changed = dict(ref, object=obj)
            with self.subTest(obj=obj), mock.patch.object(
                self.controller, "_mutate",
            ) as mutation, self.assertRaises(base.ReleaseControlError):
                self.controller._verify_tag(changed)
            mutation.assert_not_called()

    def test_tag_payload_cannot_change_source_date_or_original_journal(self) -> None:
        ref, tag = _original_tag(self.origin)
        altered = [
            dict(tag, object={"type": "commit", "sha": fixtures.CONTROL}),
            dict(tag, tag="v0.5.1"),
            dict(tag, message=tag["message"].replace(self.origin["tag_journal_id"], "another-journal")),
            dict(tag, tagger=dict(tag["tagger"], date="2020-01-01T00:00:00Z")),
        ]
        for changed in altered:
            self.controller.client.fetch_json.return_value = changed
            with self.subTest(changed=changed), self.assertRaises(base.ReleaseControlError):
                self.controller._verify_tag(ref)


if __name__ == "__main__":
    unittest.main()
