from __future__ import annotations

import copy
import contextlib
import hashlib
import io
import json
import os
import shutil
import stat
import tempfile
import unittest
import urllib.error
import zipfile
from pathlib import Path
from unittest import mock

from scripts import release_github_actions as actions


REPO = "9holy/webcodex"
REPO_ID = 1404596174
OWNER = "9holy"
OWNER_ID = 45361924
SOURCE = "2299ffe5bcc0f3965e11b753fabc3fb558769de8"
SOURCE_TREE = "c1b02a3d3820f595f832105772ecbeb181468db1"
# The publisher is reviewed separately from the already-validated product source.
CONTROL = "b" * 40
CONTROL_RUN = 987654321
WORKFLOW = ".github/workflows/release-publish.yml"
VERSION = "0.5.2"
TAG = f"v{VERSION}"
SOURCE_REF = f"release/{TAG}"
CI_RUN = 42352622976
EVIDENCE_RUN = 42352623048


def _request(**overrides) -> dict:
    result = {
        "schema_version": 1,
        "repo": REPO,
        "repo_id": REPO_ID,
        "owner": OWNER,
        "owner_id": OWNER_ID,
        "version": VERSION,
        "tag": TAG,
        "source_ref": SOURCE_REF,
        "source_sha": SOURCE,
        "source_tree": SOURCE_TREE,
        "ci_run_id": CI_RUN,
        "ci_run_attempt": 1,
        "evidence_run_id": EVIDENCE_RUN,
        "evidence_run_attempt": 1,
        "github_only": True,
        "include_unified_installers": True,
        "include_runtime_installers": False,
        "notes_path": f".github/release-requests/{TAG}-notes.md",
        "notes_sha256": "c97e1af2f06c76ff8696a307e3e2e64c31e2c1aa68bf0bf64b8289813e338e2b",
    }
    result.update(overrides)
    return result


def _repo() -> dict:
    return {
        "id": REPO_ID,
        "full_name": REPO,
        "owner": {"login": OWNER, "id": OWNER_ID},
    }


def _actor() -> dict:
    return {"login": OWNER, "id": OWNER_ID}


def _environment(**overrides) -> dict[str, str]:
    result = {
        "GITHUB_ACTIONS": "true",
        "GITHUB_REPOSITORY": REPO,
        "GITHUB_REPOSITORY_ID": str(REPO_ID),
        "GITHUB_REPOSITORY_OWNER": OWNER,
        "GITHUB_REPOSITORY_OWNER_ID": str(OWNER_ID),
        "GITHUB_ACTOR": OWNER,
        "GITHUB_ACTOR_ID": str(OWNER_ID),
        "GITHUB_TRIGGERING_ACTOR": OWNER,
        "GITHUB_EVENT_NAME": "push",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_SHA": CONTROL,
        "GITHUB_RUN_ID": str(CONTROL_RUN),
        "GITHUB_RUN_ATTEMPT": "1",
        "GITHUB_WORKFLOW_REF": f"{REPO}/{WORKFLOW}@refs/heads/main",
        "GITHUB_WORKFLOW_SHA": CONTROL,
        "GITHUB_SERVER_URL": "https://github.com",
        "GITHUB_API_URL": "https://api.github.com",
    }
    result.update(overrides)
    return result


def _controller_run(**overrides) -> dict:
    result = {
        "id": CONTROL_RUN,
        "run_attempt": 1,
        "path": WORKFLOW,
        "event": "push",
        "head_branch": "main",
        "head_sha": CONTROL,
        "repository": _repo(),
        "head_repository": _repo(),
        "actor": _actor(),
        "triggering_actor": _actor(),
        "html_url": f"https://github.com/{REPO}/actions/runs/{CONTROL_RUN}",
        "status": "in_progress",
        "conclusion": None,
    }
    result.update(overrides)
    return result


def _proof(kind: str, **overrides) -> dict:
    run_id = CI_RUN if kind == "ci" else EVIDENCE_RUN
    path = ".github/workflows/ci.yml" if kind == "ci" else ".github/workflows/release-readiness.yml"
    result = {
        "id": run_id,
        "run_attempt": 1,
        "path": path,
        "event": "push",
        "head_branch": SOURCE_REF,
        "head_sha": SOURCE,
        "repository": _repo(),
        "head_repository": _repo(),
        "actor": _actor(),
        "triggering_actor": _actor(),
        "html_url": f"https://github.com/{REPO}/actions/runs/{run_id}",
        "status": "completed",
        "conclusion": "success",
    }
    result.update(overrides)
    return result


def _context(attempt: int = 1) -> dict:
    return actions.validate_context(
        _environment(GITHUB_RUN_ATTEMPT=str(attempt)),
        _request(),
        _controller_run(run_attempt=attempt),
    )


def _request_digest() -> str:
    return hashlib.sha256(actions._json_bytes(_request())).hexdigest()


def _journal() -> dict:
    return actions.new_journal(_request(), _request_digest(), _context(), now=1700000000)


def _effect(intent: dict, *, status: str = "prepared", attempt: int = 1) -> dict:
    return {"status": status, "attempt": attempt, "intent": intent, "result": None}


def _draft() -> tuple[dict, dict]:
    journal = _journal()
    payload = {
        "tag_name": TAG,
        "name": f"WebCodex {TAG}",
        "body": f"Reviewed release\n\n<!-- {journal['journal_id']} -->\n",
        "draft": True,
        "prerelease": False,
    }
    journal["effects"]["draft"] = _effect(payload, status="succeeded")
    journal["release_id"] = 54321
    release = dict(payload, id=54321, target_commitish="main", author={
        "login": "github-actions[bot]", "id": 41898282,
    }, assets=[], published_at=None)
    return journal, release


class RequestBoundaryTests(unittest.TestCase):
    def test_accepts_explicit_github_only_full_installer_request(self) -> None:
        self.assertEqual(actions.validate_request(_request()), _request())

    def test_committed_request_and_release_notes_match_reviewed_contract(self) -> None:
        root = Path(__file__).resolve().parents[2]
        request = json.loads((root / actions.REQUEST_PATH).read_text(encoding="utf-8"))
        self.assertEqual(actions.validate_request(request), _request())
        notes = (root / request["notes_path"]).read_bytes()
        self.assertEqual(hashlib.sha256(notes).hexdigest(), request["notes_sha256"])

    def test_cannot_expand_publication_scope_or_silently_drop_installers(self) -> None:
        for changed in (
            {"repo": "yyjeqhc/webcodex"},
            {"repo_id": REPO_ID + 1},
            {"owner": "different-owner"},
            {"owner_id": OWNER_ID + 1},
            {"github_only": False},
            {"github_only": "true"},
            {"include_unified_installers": False},
            {"include_runtime_installers": True},
            {"source_ref": "main"},
            {"tag": "v0.5.1"},
            {"command": "unexpected external action"},
        ):
            with self.subTest(changed=changed), self.assertRaises(actions.ReleaseControlError):
                actions.validate_request(_request(**changed))

    def test_rejects_unbound_notes_and_malformed_source_proofs(self) -> None:
        for changed in (
            {"source_sha": SOURCE[:12]},
            {"source_tree": "x" * 40},
            {"ci_run_id": True},
            {"ci_run_attempt": 0},
            {"evidence_run_id": -1},
            {"evidence_run_attempt": "1"},
            {"notes_path": "../release-notes.md"},
            {"notes_path": "https://example.invalid/notes"},
            {"notes_sha256": "c" * 63},
        ):
            with self.subTest(changed=changed), self.assertRaises(actions.ReleaseControlError):
                actions.validate_request(_request(**changed))


class ControllerAuthorityTests(unittest.TestCase):
    def test_controller_commit_and_release_source_remain_distinct(self) -> None:
        context = actions.validate_context(_environment(), _request(), _controller_run())
        self.assertEqual(context["control_sha"], CONTROL)
        self.assertEqual(context["run_id"], CONTROL_RUN)
        self.assertNotEqual(context["control_sha"], SOURCE)

    def test_owner_manual_dispatch_uses_the_same_main_fences(self) -> None:
        context = actions.validate_context(
            _environment(GITHUB_EVENT_NAME="workflow_dispatch"),
            _request(),
            _controller_run(event="workflow_dispatch"),
        )
        self.assertEqual(context["control_sha"], CONTROL)

    def test_environment_cannot_substitute_for_verified_run_authority(self) -> None:
        for changed in (
            {"id": CONTROL_RUN + 1},
            {"run_attempt": 2},
            {"head_sha": SOURCE},
            {"head_branch": "release/v0.5.2"},
            {"path": ".github/workflows/ci.yml"},
            {"event": "pull_request"},
            {"repository": dict(_repo(), id=REPO_ID + 1)},
            {"head_repository": dict(_repo(), full_name="other/webcodex")},
            {"actor": dict(_actor(), id=OWNER_ID + 1)},
            {"triggering_actor": {"login": "other", "id": OWNER_ID + 1}},
        ):
            with self.subTest(changed=changed), self.assertRaises(actions.ReleaseControlError):
                actions.validate_context(_environment(), _request(), _controller_run(**changed))

    def test_local_or_untrusted_actions_context_is_rejected(self) -> None:
        for changed in (
            {"GITHUB_ACTIONS": "false"},
            {"GITHUB_REPOSITORY": "other/webcodex"},
            {"GITHUB_REPOSITORY_ID": str(REPO_ID + 1)},
            {"GITHUB_ACTOR_ID": str(OWNER_ID + 1)},
            {"GITHUB_REF": "refs/pull/3/merge"},
            {"GITHUB_EVENT_NAME": "pull_request"},
            {"GITHUB_WORKFLOW_REF": f"{REPO}/{WORKFLOW}@refs/heads/unreviewed"},
            {"GITHUB_API_URL": "https://example.invalid"},
        ):
            with self.subTest(changed=changed), self.assertRaises(actions.ReleaseControlError):
                actions.validate_context(_environment(**changed), _request(), _controller_run())


class SourceEvidenceTests(unittest.TestCase):
    def test_accepts_both_exact_successful_immutable_attempts(self) -> None:
        for kind in ("ci", "evidence"):
            with self.subTest(kind=kind):
                actions.validate_proof_run(_proof(kind), _request(), kind)

    def test_cannot_replace_source_evidence_with_control_ci_or_another_attempt(self) -> None:
        for kind in ("ci", "evidence"):
            for changed in (
                {"id": 1},
                {"run_attempt": 2},
                {"head_sha": CONTROL},
                {"head_branch": "main"},
                {"event": "workflow_dispatch"},
                {"status": "in_progress"},
                {"conclusion": "failure"},
                {"repository": dict(_repo(), id=REPO_ID + 1)},
                {"head_repository": dict(_repo(), full_name="other/webcodex")},
            ):
                with self.subTest(kind=kind, changed=changed), self.assertRaises(actions.ReleaseControlError):
                    actions.validate_proof_run(_proof(kind, **changed), _request(), kind)

    def test_ci_and_expensive_native_evidence_are_not_interchangeable(self) -> None:
        with self.assertRaises(actions.ReleaseControlError):
            actions.validate_proof_run(_proof("ci"), _request(), "evidence")
        with self.assertRaises(actions.ReleaseControlError):
            actions.validate_proof_run(_proof("evidence"), _request(), "ci")


class DurableJournalTests(unittest.TestCase):
    def test_same_run_retry_keeps_unknown_effect_and_original_authority(self) -> None:
        journal = _journal()
        journal["effects"]["tag"] = _effect({"source_sha": SOURCE}, status="unknown")
        restored = actions.validate_journal(journal, _request(), _request_digest(), _context(attempt=2))
        self.assertEqual(restored["effects"]["tag"]["status"], "unknown")
        self.assertEqual(restored["controller"]["control_sha"], CONTROL)
        self.assertEqual(restored["request"]["source_sha"], SOURCE)

    def test_cannot_adopt_another_request_run_or_controller_commit(self) -> None:
        journal = _journal()
        for context in (
            dict(_context(), run_id=CONTROL_RUN + 1),
            dict(_context(), control_sha="d" * 40),
            dict(_context(), actor_id=OWNER_ID + 1),
        ):
            with self.subTest(context=context), self.assertRaises(actions.ReleaseControlError):
                actions.validate_journal(journal, _request(), _request_digest(), context)
        with self.assertRaises(actions.ReleaseControlError):
            actions.validate_journal(journal, _request(), "d" * 64, _context())
        changed = copy.deepcopy(journal)
        changed["request"]["source_sha"] = CONTROL
        with self.assertRaises(actions.ReleaseControlError):
            actions.validate_journal(changed, _request(), _request_digest(), _context())

    def test_effect_state_cannot_claim_a_future_attempt_or_unknown_schema(self) -> None:
        for changed in (
            {"status": "succeeded", "attempt": 2},
            {"status": "succeeded", "attempt": True},
            {"status": "retry-now", "attempt": 1},
        ):
            journal = _journal()
            journal["effects"]["draft"] = dict(_effect({}), **changed)
            with self.subTest(changed=changed), self.assertRaises(actions.ReleaseControlError):
                actions.validate_journal(journal, _request(), _request_digest(), _context())

    def test_atomic_checkpoint_rejects_links_duplicate_fields_and_oversize_json(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = root / "journal.json"
            actions._atomic_json(path, _journal())
            self.assertEqual(actions._read_json(path), _journal())
            if os.name != "nt":
                self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            target = root / "unrelated.json"
            target.write_text("{}", encoding="utf-8")
            path.unlink()
            path.symlink_to(target)
            with self.assertRaises(actions.ReleaseControlError):
                actions._atomic_json(path, _journal())
            self.assertEqual(target.read_text(encoding="utf-8"), "{}")
        with self.assertRaises(actions.ReleaseControlError):
            actions._parse_json(b'{"release_id":1,"release_id":2}')
        with self.assertRaises(actions.ReleaseControlError):
            actions._parse_json(b" " * (actions.MAX_STATE_BYTES + 1))


class PublishedIdentityTests(unittest.TestCase):
    def test_existing_tag_authority_does_not_depend_on_unused_commitish(self) -> None:
        journal, release = _draft()
        # GitHub fills this field from the default branch when a tag already
        # exists. The separate annotated-tag fence owns the release source.
        actions.validate_release_identity(release, journal)
        actions.validate_release_identity(dict(release, target_commitish=CONTROL), journal)

    def test_draft_cannot_be_adopted_from_another_release_or_author(self) -> None:
        journal, release = _draft()
        for changed in (
            {"id": release["id"] + 1},
            {"tag_name": "v0.5.1"},
            {"body": "another publication"},
            {"prerelease": True},
            {"author": _actor()},
        ):
            with self.subTest(changed=changed), self.assertRaises(actions.ReleaseControlError):
                actions.validate_release_identity(dict(release, **changed), journal)
        with self.assertRaises(actions.ReleaseControlError):
            actions.validate_release_identity(release, _journal())

    def test_public_release_requires_own_durable_publication_intent(self) -> None:
        journal, release = _draft()
        public = dict(release, draft=False, published_at="2026-11-07T12:00:00Z")
        with self.assertRaises(actions.ReleaseControlError):
            actions.validate_release_identity(public, journal, allow_public=True)
        journal["effects"]["publish"] = _effect({"release_id": release["id"]}, status="unknown")
        with self.assertRaises(actions.ReleaseControlError):
            actions.validate_release_identity(public, journal)
        actions.validate_release_identity(public, journal, allow_public=True)
        journal["effects"]["publish"]["intent"]["release_id"] += 1
        with self.assertRaises(actions.ReleaseControlError):
            actions.validate_release_identity(public, journal, allow_public=True)

    def test_asset_reconciliation_requires_every_retained_byte_property(self) -> None:
        expected = {"name": "installer.exe", "size": 17, "sha256": "d" * 64}
        asset = {"id": 123, "name": expected["name"], "size": expected["size"],
                 "state": "uploaded", "digest": f"sha256:{expected['sha256']}"}
        actions.validate_asset(asset, expected)
        for changed in (
            {"name": "other.exe"},
            {"size": 18},
            {"state": "starter"},
            {"digest": "sha256:" + "e" * 64},
            {"digest": None},
        ):
            with self.subTest(changed=changed), self.assertRaises(actions.ReleaseControlError):
                actions.validate_asset(dict(asset, **changed), expected)


class ControllerStageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.output = io.StringIO()
        output = contextlib.redirect_stdout(self.output)
        output.__enter__()
        self.addCleanup(output.__exit__, None, None, None)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.controller = self._controller()
        self.controller.state = actions.new_journal(
            self.controller.request, self.controller.request_digest,
            self.controller.context, now=1700000000,
        )
        self.controller.state["checks"]["preflight"] = {"github_only": True}
        self.controller._save()

    def _controller(self, attempt: int = 1) -> actions.Controller:
        control_root = Path(__file__).resolve().parents[2]
        client = mock.Mock(spec=actions.collector.GitHubClient)
        client.repo = REPO
        client.token = "fixture-token"
        client.api_url.side_effect = lambda suffix: f"https://api.github.com/repos/{REPO}{suffix}"
        controller = actions.Controller(
            control_root / actions.REQUEST_PATH,
            self.root / "source",
            self.root / "state",
            self.root / "bundle",
            env=_environment(GITHUB_RUN_ATTEMPT=str(attempt)),
            client=client,
            control_root=control_root,
        )
        controller.context = _context(attempt)
        return controller

    def _prepare_readiness(self) -> None:
        with mock.patch.object(self.controller, "_source_branch"), mock.patch.object(self.controller, "_proofs"):
            self.assertEqual(self.controller.prepare_readiness(), 0)

    def _prepare_tag(self) -> None:
        with mock.patch.object(self.controller, "status_readiness", return_value=0), mock.patch.object(
            self.controller, "_source_branch"
        ), mock.patch.object(self.controller, "_tag_ref", return_value=None), mock.patch.object(
            self.controller, "_find_release", return_value=None
        ):
            self.assertEqual(self.controller.prepare_tag(), 0)

    def _finished_build(self) -> dict:
        with mock.patch.object(self.controller, "status_readiness", return_value=0), mock.patch.object(
            self.controller, "_verify_tag"
        ):
            self.controller.prepare_build()
        child = self.controller._child_state("build")
        child.update(
            run_id=123456789, run_head_sha=SOURCE, source_matches=True,
            run_url=f"https://github.com/{REPO}/actions/runs/123456789",
            run_status="completed", run_conclusion="success", dispatch_state="completed",
        )
        actions.publication._write_state(self.controller.state_dir / "build.json", child)
        return {
            "build_kind": "release", "version": VERSION, "source_sha": SOURCE,
            "tag": TAG, "workflow_run_id": child["run_id"],
            "bundle_artifact_id": 112233, "bundle_artifact_sha256": "a" * 64,
        }

    def _publication(self, *, public: bool = False, assets_present: bool = True) -> tuple[dict, dict]:
        controller = self.controller
        payload = controller._draft_intent()
        controller.state["release_id"] = 54321
        controller.state["effects"]["draft"] = _effect(payload, status="succeeded")
        expected = {"SHA256SUMS": {"name": "SHA256SUMS", "size": 1,
                                   "sha256": hashlib.sha256(b"x").hexdigest()}}
        controller.state["assets"] = expected
        for name, item in expected.items():
            controller.state["effects"][f"asset:{name}"] = _effect({**item, "release_id": 54321})
        digest = hashlib.sha256(actions._json_bytes(expected)).hexdigest()
        controller.state["checks"]["draft"] = {"release_id": 54321, "assets_sha256": digest}
        controller.state["effects"]["publish"] = _effect({
            "release_id": 54321, "assets_sha256": digest,
            "tag_object_sha": controller.state["tag_object_sha"],
        }, status="unknown" if public else "prepared")
        controller._save()
        asset = {"id": 987, "name": "SHA256SUMS", "size": 1, "state": "uploaded",
                 "digest": "sha256:" + expected["SHA256SUMS"]["sha256"]}
        release = dict(payload, id=54321, target_commitish="main", draft=not public,
                       author={"login": "github-actions[bot]", "id": 41898282},
                       assets=[asset] if assets_present else [],
                       published_at="2026-11-07T12:00:00Z" if public else None)
        return expected, release

    def _prepare_post(self) -> dict:
        _expected, release = self._publication(public=True)
        self.controller.state["checks"]["public_bytes"] = True
        with mock.patch.object(self.controller, "_owned_release", return_value=release), mock.patch.object(
            self.controller, "_post_runs", return_value=[]
        ), mock.patch.object(actions.readiness, "_branch_sha", return_value=CONTROL), mock.patch.object(
            actions.time, "time", return_value=1700000000
        ):
            self.assertEqual(self.controller.prepare_post(), 0)
        return release

    def _post_run(self, kind: str, **overrides) -> dict:
        workflow, title = actions.POST_WORKFLOWS[kind]
        result = {
            "id": 501 if kind == "image" else 502, "run_attempt": 1,
            "path": f".github/workflows/{workflow}", "event": "workflow_dispatch",
            "head_branch": "main", "head_sha": CONTROL, "display_title": title,
            "repository": _repo(), "head_repository": _repo(),
            "actor": {"login": "github-actions[bot]", "id": 41898282},
            "triggering_actor": {"login": "github-actions[bot]", "id": 41898282},
            "created_at": "2023-11-14T22:13:21Z", "status": "in_progress", "conclusion": None,
        }
        result.update(overrides)
        return result

    def test_machine_authentication_never_claims_the_human_user_credential(self) -> None:
        client = self.controller.client
        client.fetch_json.side_effect = lambda suffix: (
            dict(_repo(), default_branch="main") if suffix == "" else _controller_run()
        )
        client._fetch_json_url.return_value = {"total_count": 1, "repositories": [_repo()]}
        self.controller._authenticate()
        client._fetch_json_url.assert_called_once_with(
            "https://api.github.com/installation/repositories?per_page=100"
        )
        client.fetch_authenticated_user.assert_not_called()
        self.assertEqual(self.controller.context["actor_id"], OWNER_ID)

    def test_machine_authentication_rejects_broader_or_wrong_installation_scope(self) -> None:
        client = self.controller.client
        client.fetch_json.side_effect = lambda suffix: (
            dict(_repo(), default_branch="main") if suffix == "" else _controller_run()
        )
        for installation in (
            {"total_count": 2, "repositories": [_repo(), dict(_repo(), id=123)]},
            {"total_count": 1, "repositories": [dict(_repo(), id=123)]},
            {"total_count": 0, "repositories": []},
        ):
            client._fetch_json_url.return_value = installation
            with self.subTest(installation=installation), self.assertRaises(actions.ReleaseControlError):
                self.controller._authenticate()
        client._fetch_json_url.side_effect = actions.collector.CollectionError("installation endpoint denied")
        with self.assertRaises(actions.collector.CollectionError):
            self.controller._authenticate()
        client.fetch_authenticated_user.assert_not_called()

    def test_successful_dispatch_is_still_pending_and_cannot_authorize_tagging(self) -> None:
        self._prepare_readiness()
        with mock.patch.object(actions.readiness, "_get_bound_run", return_value=None), mock.patch.object(
            actions.readiness, "_post_dispatch"
        ) as dispatch, mock.patch.object(self.controller, "_source_branch"), mock.patch.object(
            self.controller, "_proofs"
        ), mock.patch.object(self.controller, "_mutate") as mutation:
            self.assertEqual(self.controller.dispatch_readiness(), 0)
            self.assertEqual(self.controller.status_readiness(), 2)
            with self.assertRaises(actions.ReleaseControlError):
                self.controller.prepare_tag()
        dispatch.assert_called_once()
        mutation.assert_not_called()
        self.assertNotIn("tag-ref", self.controller.state["effects"])

    def test_unknown_dispatch_is_durable_and_not_repeated_by_next_attempt(self) -> None:
        self._prepare_readiness()
        with mock.patch.object(actions.readiness, "_get_bound_run", return_value=None), mock.patch.object(
            actions.readiness, "_post_dispatch", side_effect=actions.readiness.DispatchOutcomeUnknown("lost reply")
        ) as dispatch, mock.patch.object(self.controller, "_source_branch"), mock.patch.object(self.controller, "_proofs"):
            with self.assertRaises(actions.ReleaseControlError):
                self.controller.dispatch_readiness()
            recovered = self._controller(attempt=2)
            recovered._load()
            self.assertEqual(recovered.state["effects"]["readiness"]["status"], "unknown")
            self.assertEqual(recovered._child_state("readiness")["dispatch_state"], "unknown")
            with self.assertRaises(actions.ReleaseControlError):
                recovered.dispatch_readiness()
        dispatch.assert_called_once()

    def test_prior_attempt_prepared_intent_does_not_prove_effect_was_unsent(self) -> None:
        self._prepare_readiness()
        recovered = self._controller(attempt=2)
        recovered._load()
        with mock.patch.object(actions.readiness, "_get_bound_run", return_value=None), mock.patch.object(
            actions.readiness, "_post_dispatch"
        ) as dispatch, self.assertRaises(actions.ReleaseControlError):
            recovered.dispatch_readiness()
        dispatch.assert_not_called()

    def test_build_dispatch_keeps_unified_installers_and_excludes_runtime_flavor(self) -> None:
        with mock.patch.object(self.controller, "status_readiness", return_value=0), mock.patch.object(
            self.controller, "_verify_tag"
        ), mock.patch.object(actions.publication, "_get_bound_build_run", return_value=None), mock.patch.object(
            actions.publication, "_post_build_dispatch"
        ) as dispatch:
            self.assertEqual(self.controller.prepare_build(), 0)
            self.assertEqual(self.controller.dispatch_build(), 0)
        dispatch.assert_called_once()
        self.assertEqual(dispatch.call_args.args[1], TAG)
        self.assertTrue(dispatch.call_args.kwargs["include_unified_installers"])
        self.assertFalse(dispatch.call_args.kwargs["include_runtime_installers"])

    def test_bound_build_can_advance_attempt_but_cannot_roll_back_observed_evidence(self) -> None:
        self._finished_build()
        child = self.controller._child_state("build")
        run = {
            "id": child["run_id"], "run_attempt": 2,
            "path": actions.publication.BUILD_WORKFLOW_PATH, "event": "workflow_dispatch",
            "head_branch": TAG, "head_sha": SOURCE, "display_title": child["run_name"],
            "html_url": child["run_url"], "status": "completed", "conclusion": "success",
            "repository": _repo(), "head_repository": _repo(), "triggering_actor": _actor(),
        }
        self.controller.client.fetch_json.return_value = run
        self.assertEqual(self.controller.status_build(), 0)
        self.assertEqual(self.controller.state["checks"]["build"]["run_attempt"], 2)
        self.assertEqual(self.controller.state["effects"]["build"]["result"]["run_attempt"], 2)
        self.controller.client.fetch_json.return_value = dict(run, run_attempt=1)
        with self.assertRaises(actions.ReleaseControlError):
            self.controller.status_build()

    def test_bound_build_attempt_cannot_change_triggering_owner_or_run_id(self) -> None:
        self._finished_build()
        child = self.controller._child_state("build")
        run = {
            "id": child["run_id"], "run_attempt": 2,
            "path": actions.publication.BUILD_WORKFLOW_PATH, "event": "workflow_dispatch",
            "head_branch": TAG, "head_sha": SOURCE, "display_title": child["run_name"],
            "html_url": child["run_url"], "status": "completed", "conclusion": "success",
            "repository": _repo(), "head_repository": _repo(), "triggering_actor": _actor(),
        }
        for changed in (
            {"id": child["run_id"] + 1},
            {"triggering_actor": {"login": "other", "id": 1}},
        ):
            self.controller.client.fetch_json.return_value = dict(run, **changed)
            with self.subTest(changed=changed), self.assertRaises((actions.ReleaseControlError, actions.publication.PublicationError)):
                self.controller.status_build()

    def test_existing_lightweight_or_moved_tag_is_never_replaced(self) -> None:
        self._prepare_tag()
        for obj in (
            {"type": "commit", "sha": SOURCE},
            {"type": "tag", "sha": "e" * 40},
        ):
            ref = {"ref": f"refs/tags/{TAG}", "object": obj}
            with self.subTest(obj=obj), mock.patch.object(self.controller, "_tag_ref", return_value=ref), mock.patch.object(
                self.controller, "_mutate"
            ) as mutation, self.assertRaises(actions.ReleaseControlError):
                self.controller.create_tag()
            mutation.assert_not_called()

    def test_exact_owned_annotated_tag_is_reconciled_without_mutation(self) -> None:
        self._prepare_tag()
        intent = actions.annotated_tag_intent(self.controller.request, self.controller.state)
        payload = intent["payload"]
        tag_object = {"sha": intent["sha"], "tag": TAG, "message": payload["message"],
                      "tagger": payload["tagger"], "object": {"type": "commit", "sha": SOURCE}}
        ref = {"ref": f"refs/tags/{TAG}", "object": {"type": "tag", "sha": intent["sha"]}}
        self.controller.client.fetch_json.return_value = tag_object
        with mock.patch.object(self.controller, "_tag_ref", return_value=ref), mock.patch.object(
            self.controller, "_mutate"
        ) as mutation:
            self.assertEqual(self.controller.create_tag(), 0)
        mutation.assert_not_called()
        self.assertTrue(self.controller.state["checks"]["tag"])

    def test_existing_tag_without_original_journal_cannot_be_adopted(self) -> None:
        ref = {"ref": f"refs/tags/{TAG}", "object": {"type": "tag", "sha": "f" * 40}}
        with self.assertRaises(actions.ReleaseControlError):
            self.controller._verify_tag(ref)
        self.controller.client.fetch_json.assert_not_called()

    def test_latest_expired_checkpoint_cannot_fall_back_to_older_intent(self) -> None:
        recovered = self._controller(attempt=3)
        recovered.journal_path.unlink()
        old = {"name": f"release-control-{TAG}-{CONTROL_RUN}-1-02-readiness-intent", "expired": False}
        latest = {"name": f"release-control-{TAG}-{CONTROL_RUN}-2-99-final", "expired": True}
        recovered.client.fetch_json.return_value = {"total_count": 2, "artifacts": [old, latest]}
        with self.assertRaises(actions.ReleaseControlError):
            recovered.restore_state()
        recovered.client.download_artifact_zip.assert_not_called()

    def test_retry_without_original_checkpoint_does_not_initialize_new_state(self) -> None:
        recovered = self._controller(attempt=2)
        recovered.journal_path.unlink()
        recovered.client.fetch_json.return_value = {"total_count": 0, "artifacts": []}
        with self.assertRaises(actions.ReleaseControlError):
            recovered.restore_state()
        self.assertFalse(recovered.journal_path.exists())

    def test_json_only_retry_recollects_the_same_immutable_bundle_without_rebuild(self) -> None:
        summary = self._finished_build()

        def collect(**kwargs):
            destination = kwargs["output_dir"]
            destination.mkdir()
            (destination / "SHA256SUMS").write_bytes(b"fixed checksums\n")
            return dict(summary)

        with mock.patch.object(self.controller, "_verify_tag"), mock.patch.object(
            self.controller, "status_build", return_value=0
        ), mock.patch.object(actions.collector, "collect_bundle", side_effect=collect) as download, mock.patch.object(
            actions.publication, "_post_build_dispatch"
        ) as dispatch:
            self.assertEqual(self.controller.collect(), 0)
            original = copy.deepcopy(self.controller.state["bundle"])
            shutil.rmtree(self.controller.bundle_dir)
            recovered = self._controller(attempt=2)
            recovered._load()
            with mock.patch.object(recovered, "_verify_tag"), mock.patch.object(recovered, "status_build", return_value=0):
                self.assertEqual(recovered.collect(), 0)
            self.assertEqual(recovered.state["bundle"], original)
        self.assertEqual(download.call_count, 2)
        for call in download.call_args_list:
            self.assertEqual(call.kwargs["run_id"], summary["workflow_run_id"])
            self.assertEqual(call.kwargs["expected_source_sha"], SOURCE)
            self.assertEqual(call.kwargs["expected_tag"], TAG)
            self.assertTrue(call.kwargs["require_unified_installers"])
            self.assertFalse(call.kwargs["require_runtime_installers"])
        dispatch.assert_not_called()

    def test_collected_bundle_cannot_be_retargeted_to_another_source_or_run(self) -> None:
        summary = self._finished_build()
        for changed in (
            {"source_sha": CONTROL}, {"workflow_run_id": summary["workflow_run_id"] + 1},
            {"tag": "v0.5.1"}, {"build_kind": "verification"},
        ):
            with self.subTest(changed=changed), self.assertRaises(actions.ReleaseControlError):
                self.controller._check_bundle_summary(dict(summary, **changed))

    def test_unrecorded_existing_bundle_is_not_deleted_or_replaced(self) -> None:
        self._finished_build()
        self.controller.bundle_dir.mkdir()
        sentinel = self.controller.bundle_dir / "keep.txt"
        sentinel.write_text("unrelated data", encoding="utf-8")
        with mock.patch.object(self.controller, "_verify_tag"), mock.patch.object(
            self.controller, "status_build", return_value=0
        ), mock.patch.object(actions.collector, "collect_bundle") as download, self.assertRaises(actions.ReleaseControlError):
            self.controller.collect()
        download.assert_not_called()
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "unrelated data")

    def test_published_release_replay_verifies_without_drafting_or_reuploading(self) -> None:
        expected, release = self._publication(public=True)
        with mock.patch.object(self.controller, "_verify_tag"), mock.patch.object(
            self.controller, "_find_release", return_value=release
        ), mock.patch.object(self.controller, "_expected_assets", return_value=expected), mock.patch.object(
            self.controller, "_bundle_summary"
        ), mock.patch.object(actions.public_verifier, "validate_github_assets") as public_shape, mock.patch.object(
            actions.publication, "verify_draft_assets"
        ) as draft_verifier, mock.patch.object(self.controller, "_mutate") as mutation:
            for stage in ("prepare_draft", "create_draft", "prepare_upload", "upload_assets", "verify_draft",
                          "prepare_publish", "publish"):
                with self.subTest(stage=stage):
                    self.assertEqual(getattr(self.controller, stage)(), 0)
        mutation.assert_not_called()
        draft_verifier.assert_not_called()
        self.assertTrue(public_shape.called)
        self.assertTrue(self.controller.state["checks"]["published"])

    def test_conflicting_draft_asset_never_gets_deleted_or_overwritten(self) -> None:
        expected, release = self._publication()
        release["assets"][0]["digest"] = "sha256:" + "f" * 64
        with mock.patch.object(self.controller, "_verify_tag"), mock.patch.object(
            self.controller, "_find_release", return_value=release
        ), mock.patch.object(self.controller, "_expected_assets", return_value=expected), mock.patch.object(
            self.controller, "_mutate"
        ) as mutation, self.assertRaises(actions.ReleaseControlError):
            self.controller.upload_assets()
        mutation.assert_not_called()

    def test_unknown_upload_is_only_reconciled_when_exact_existing_bytes_appear(self) -> None:
        expected, release = self._publication(assets_present=False)
        self.controller.bundle_dir.mkdir()
        (self.controller.bundle_dir / "SHA256SUMS").write_bytes(b"x")
        client = actions.collector.GitHubClient(REPO, "fixture-token", 5)
        client.opener = mock.Mock()
        client.opener.open.side_effect = urllib.error.URLError("lost upload response")
        self.controller.client = client
        with mock.patch.object(self.controller, "_verify_tag"), mock.patch.object(
            self.controller, "_find_release", return_value=release
        ), mock.patch.object(self.controller, "_expected_assets", return_value=expected):
            with self.assertRaises(actions.ReleaseControlError):
                self.controller.upload_assets()
        recovered = self._controller(attempt=2)
        recovered._load()
        recovered.client = client
        self.assertEqual(recovered.state["effects"]["asset:SHA256SUMS"]["status"], "unknown")
        with mock.patch.object(recovered, "_verify_tag"), mock.patch.object(
            recovered, "_find_release", return_value=release
        ), mock.patch.object(recovered, "_expected_assets", return_value=expected):
            with self.assertRaises(actions.ReleaseControlError):
                recovered.upload_assets()
            release["assets"] = [{
                "id": 987, "name": "SHA256SUMS", "size": 1, "state": "uploaded",
                "digest": "sha256:" + expected["SHA256SUMS"]["sha256"],
            }]
            self.assertEqual(recovered.upload_assets(), 0)
        client.opener.open.assert_called_once()
        self.assertEqual(recovered.state["effects"]["asset:SHA256SUMS"]["status"], "succeeded")

    def test_public_byte_verification_keeps_fork_and_github_only_delivery(self) -> None:
        _expected, release = self._publication(public=True)
        with mock.patch.object(self.controller, "_owned_release", return_value=release), mock.patch.object(
            self.controller, "_verify_primary_assets"
        ), mock.patch.object(actions.public_verifier, "verify_public_release") as verify:
            self.assertEqual(self.controller.verify_public(), 0)
        verify.assert_called_once_with(VERSION, self.controller.timeout, repo=REPO, github_only=True,
                                       require_unified_installers=True, require_runtime_installers=False)
        self.assertTrue(self.controller.state["checks"]["public_bytes"])

    def test_post_dispatch_uses_returned_run_ids_and_does_not_repeat(self) -> None:
        release = self._prepare_post()

        def response(key, _method, _suffix, _payload, **_kwargs):
            run_id = 501 if key == "post:image" else 502
            return {"workflow_run_id": run_id,
                    "run_url": f"https://api.github.com/repos/{REPO}/actions/runs/{run_id}",
                    "html_url": f"https://github.com/{REPO}/actions/runs/{run_id}"}

        self.controller.client.fetch_json.side_effect = lambda suffix: (
            self._post_run("image") if suffix.endswith("/501") else self._post_run("intel")
        )
        with mock.patch.object(self.controller, "_owned_release", return_value=release), mock.patch.object(
            self.controller, "_post_runs", return_value=[]
        ), mock.patch.object(actions.readiness, "_branch_sha", return_value=CONTROL), mock.patch.object(
            self.controller, "_mutate", side_effect=response
        ) as mutation:
            self.assertEqual(self.controller.dispatch_post(), 0)
            self.assertEqual(self.controller.dispatch_post(), 0)
        self.assertEqual(mutation.call_count, 2)
        for call in mutation.call_args_list:
            self.assertEqual(call.args[3], {"ref": "main", "inputs": {"tag": TAG}, "return_run_details": True})
            self.assertEqual(call.kwargs["expected_status"], 200)
        self.assertEqual(self.controller.state["post"]["image"]["run_id"], 501)
        self.assertEqual(self.controller.state["post"]["intel"]["run_id"], 502)

    def test_unknown_post_dispatch_cannot_repeat_and_requires_unique_new_matching_run(self) -> None:
        release = self._prepare_post()
        self.controller.state["effects"]["post:image"]["status"] = "unknown"
        self.controller._save()
        with mock.patch.object(self.controller, "_owned_release", return_value=release), mock.patch.object(
            self.controller, "_post_runs", return_value=[]
        ), mock.patch.object(self.controller, "_mutate") as mutation, self.assertRaises(actions.ReleaseControlError):
            self.controller.dispatch_post()
        mutation.assert_not_called()
        candidates = [self._post_run("image"), self._post_run("image", id=503)]
        with mock.patch.object(self.controller, "_post_runs", return_value=candidates), self.assertRaises(actions.ReleaseControlError):
            self.controller._post_snapshot("image")
        self.assertNotIn("image", self.controller.state["post"])
        self.controller.state["effects"]["post:image"]["intent"]["baseline_run_ids"] = [500]
        candidates = [self._post_run("image", id=500), self._post_run("image")]
        with mock.patch.object(self.controller, "_post_runs", return_value=candidates):
            self.assertEqual(self.controller._post_snapshot("image")["id"], 501)
        self.assertEqual(self.controller.state["effects"]["post:image"]["status"], "succeeded")

    def test_post_run_identity_cannot_move_control_source_or_retry_owner(self) -> None:
        self._prepare_post()
        for changed in (
            {"head_sha": SOURCE}, {"display_title": "Release server image v0.5.1"},
            {"path": ".github/workflows/ci.yml"}, {"actor": _actor()},
            {"run_attempt": 2, "triggering_actor": {"login": "other", "id": 1}},
        ):
            with self.subTest(changed=changed), self.assertRaises(actions.ReleaseControlError):
                self.controller._validate_post_run("image", self._post_run("image", **changed))
        self.controller._validate_post_run("image", self._post_run("image", run_attempt=2, triggering_actor=_actor()))

    def test_image_workflow_success_is_insufficient_without_anonymous_public_job(self) -> None:
        self._prepare_post()
        run = self._post_run("image", status="completed", conclusion="success")
        for jobs in (
            [],
            [{"name": "verify-public", "status": "completed", "conclusion": "skipped"}],
            [{"name": "verify-public", "status": "completed", "conclusion": "failure"}],
        ):
            self.controller.client.fetch_json.return_value = {"total_count": len(jobs), "jobs": jobs}
            with self.subTest(jobs=jobs), mock.patch.object(actions.public_verifier, "fetch_json") as public_fetch, self.assertRaises(actions.ReleaseControlError):
                self.controller._verify_image_success(run)
            public_fetch.assert_not_called()
        self.assertNotIn("server_image", self.controller.state["checks"])

    def test_image_public_receipt_binds_runtime_source_and_deployment_controller(self) -> None:
        self._prepare_post()
        run = self._post_run("image", status="completed", conclusion="success")
        self.controller.client.fetch_json.return_value = {
            "total_count": 1, "jobs": [{"name": "verify-public", "status": "completed", "conclusion": "success"}],
        }
        metadata = {"source_sha": SOURCE, "deployment_source_sha": CONTROL, "digest": "sha256:" + "e" * 64}
        with mock.patch.object(actions.public_verifier, "fetch_json", return_value={}), mock.patch.object(
            actions.public_verifier, "fetch_bytes", return_value=b"fixture bootstrap"
        ), mock.patch.object(actions.public_verifier, "validate_server_image_release_record", return_value=metadata) as verify:
            self.controller._verify_image_success(run)
            self.assertEqual(self.controller.state["checks"]["server_image"]["anonymous_verification"], "success")
            verify.return_value = dict(metadata, deployment_source_sha=SOURCE)
            with self.assertRaises(actions.ReleaseControlError):
                self.controller._verify_image_success(run)

    def test_pending_intel_supplement_is_not_recorded_as_completed(self) -> None:
        release = self._prepare_post()
        runs = {"image": self._post_run("image", status="completed", conclusion="success"),
                "intel": self._post_run("intel")}
        with mock.patch.object(self.controller, "_owned_release", return_value=release), mock.patch.object(
            self.controller, "_post_snapshot", side_effect=lambda kind: runs[kind]
        ), mock.patch.object(self.controller, "_verify_image_success") as image_check, mock.patch.object(
            self.controller, "_verify_primary_assets"
        ):
            self.assertEqual(self.controller.status_post(), 0)
        image_check.assert_called_once_with(runs["image"])
        self.assertNotIn("intel_desktop", self.controller.state["checks"])


class ReleaseSpecTests(unittest.TestCase):
    """A synthetic spec lives only in temporary fixtures, never production input."""

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.control = self.root / "control"
        self.control.mkdir()
        notes = b"Unit-test-only release notes.\n"
        self.request = _request(
            version="0.0.0-spec-test", tag="v0.0.0-spec-test", source_ref="release/v0.0.0-spec-test",
            source_sha="c" * 40, source_tree="d" * 40, ci_run_id=1001, evidence_run_id=1002,
            notes_path=".github/release-requests/v0.0.0-spec-test-notes.md",
            notes_sha256=hashlib.sha256(notes).hexdigest(),
        )
        self.spec = actions.ReleaseSpec(
            self.request, ".github/release-requests/v0.0.0-spec-test.json",
            ".github/workflows/release-publish-spec-test.yml",
        )
        path = self.control / self.spec.request_path
        path.parent.mkdir(parents=True)
        path.write_bytes(actions._json_bytes(self.request))
        (self.control / self.request["notes_path"]).write_bytes(notes)

    def _environment(self, attempt: int = 1) -> dict:
        return _environment(
            GITHUB_RUN_ATTEMPT=str(attempt),
            GITHUB_WORKFLOW_REF=f"{REPO}/{self.spec.workflow_path}@refs/heads/main",
        )

    def _controller(self, attempt: int = 1) -> actions.Controller:
        controller = actions.Controller(
            self.control / self.spec.request_path, self.root / "source", self.root / "state",
            self.root / "bundle", env=self._environment(attempt),
            client=mock.Mock(spec=actions.collector.GitHubClient), control_root=self.control,
            spec=self.spec,
        )
        controller.context = actions.validate_context(
            controller.env, controller.request,
            _controller_run(path=self.spec.workflow_path, run_attempt=attempt), spec=self.spec,
        )
        return controller

    def _with_journal(self) -> actions.Controller:
        controller = self._controller()
        controller.state = actions.new_journal(
            controller.request, controller.request_digest, controller.context, now=1700000000,
        )
        controller._save()
        return controller

    def test_default_release_and_recovery_contract_remain_the_original_fixed_request(self) -> None:
        self.assertEqual(dict(actions.DEFAULT_RELEASE_SPEC.pinned_request), _request())
        self.assertEqual(actions.DEFAULT_RELEASE_SPEC.request_path, actions.REQUEST_PATH)
        self.assertEqual(actions.DEFAULT_RELEASE_SPEC.workflow_path, WORKFLOW)
        self.assertEqual(actions.POST_WORKFLOWS, {
            "image": ("release-image.yml", "Release server image v0.5.2"),
            "intel": ("release-desktop-darwin-x64.yml", "Release macOS Intel Desktop v0.5.2"),
        })
        with self.assertRaises(actions.ReleaseControlError):
            actions.validate_request(self.request)
        self.assertEqual(actions.validate_request(self.request, spec=self.spec), self.request)

    def test_spec_snapshots_authority_and_request_json_cannot_change_it(self) -> None:
        self.request["source_sha"] = "e" * 40
        self.assertEqual(self.spec.pinned_request["source_sha"], "c" * 40)
        with self.assertRaises(TypeError):
            self.spec.pinned_request["source_sha"] = self.request["source_sha"]
        with self.assertRaises(AttributeError):
            self.spec.workflow_path = WORKFLOW
        for changed in (
            {"repo": "other/webcodex"}, {"repo_id": REPO_ID + 1}, {"owner": "other"},
            {"tag": TAG}, {"version": VERSION}, {"source_ref": SOURCE_REF},
            {"source_sha": SOURCE}, {"source_tree": SOURCE_TREE},
            {"ci_run_id": CI_RUN}, {"ci_run_attempt": 2}, {"evidence_run_id": EVIDENCE_RUN},
            {"notes_sha256": "e" * 64}, {"include_runtime_installers": True},
            {"spec": "choose-another-publication"},
        ):
            with self.subTest(changed=changed), self.assertRaises(actions.ReleaseControlError):
                actions.validate_request(dict(self.spec.pinned_request, **changed), spec=self.spec)

    def test_spec_rejects_scope_expansion_inconsistent_identity_and_unsafe_paths(self) -> None:
        for changed in (
            {"repo": "other/webcodex"}, {"github_only": False},
            {"include_unified_installers": False}, {"include_runtime_installers": True},
            {"tag": TAG}, {"source_ref": "main"}, {"source_sha": "short"},
            {"ci_run_id": True}, {"evidence_run_attempt": 0},
            {"notes_path": "../notes.md"}, {"notes_sha256": "e" * 63},
        ):
            with self.subTest(changed=changed), self.assertRaises(actions.ReleaseControlError):
                actions.ReleaseSpec(dict(self.request, **changed), self.spec.request_path, self.spec.workflow_path)
        for request_path, workflow_path in (
            (actions.REQUEST_PATH, self.spec.workflow_path),
            ("../request.json", self.spec.workflow_path),
            (self.spec.request_path, ".github/workflows/../release.yml"),
            (self.spec.request_path, "https://example.invalid/release.yml"),
        ):
            with self.subTest(request_path=request_path, workflow_path=workflow_path), self.assertRaises(actions.ReleaseControlError):
                actions.ReleaseSpec(self.request, request_path, workflow_path)

    def test_controller_requires_code_selected_spec_path_notes_and_verified_workflow(self) -> None:
        with self.assertRaises(actions.ReleaseControlError):
            actions.Controller(
                self.control / self.spec.request_path, self.root / "source", self.root / "state",
                control_root=self.control,
            )
        with self.assertRaises(actions.ReleaseControlError):
            actions.Controller(
                self.control / actions.REQUEST_PATH, self.root / "source", self.root / "state",
                control_root=self.control, spec=self.spec,
            )
        controller = self._controller()
        controller.client.fetch_json.side_effect = [
            _controller_run(path=self.spec.workflow_path), dict(_repo(), default_branch="main"),
        ]
        controller.client._fetch_json_url.return_value = {"total_count": 1, "repositories": [_repo()]}
        controller._authenticate()
        self.assertEqual(controller.context["workflow_path"], self.spec.workflow_path)
        for env, run in (
            (_environment(), _controller_run(path=self.spec.workflow_path)),
            (self._environment(), _controller_run()),
            (self._environment(), _controller_run(path=self.spec.workflow_path, actor={"login": "other", "id": 1})),
        ):
            with self.assertRaises(actions.ReleaseControlError):
                actions.validate_context(env, self.request, run, spec=self.spec)
        (self.control / self.request["notes_path"]).write_bytes(b"changed notes")
        with self.assertRaises(actions.ReleaseControlError):
            self._controller()

    def test_injected_spec_keeps_exact_source_proofs_and_readiness_before_tag(self) -> None:
        controller = self._with_journal()
        proofs = {
            f"/actions/runs/{self.request[f'{kind}_run_id']}/attempts/1": _proof(
                kind, id=self.request[f"{kind}_run_id"], head_sha=self.request["source_sha"],
                head_branch=self.request["source_ref"],
            ) for kind in ("ci", "evidence")
        }
        controller.client.fetch_json.side_effect = proofs.__getitem__
        controller._proofs()
        for field, value in (("conclusion", "failure"), ("run_attempt", 2), ("head_sha", SOURCE)):
            changed = proofs[f"/actions/runs/{self.request['evidence_run_id']}/attempts/1"]
            previous = changed[field]
            changed[field] = value
            with self.subTest(field=field), self.assertRaises(actions.ReleaseControlError):
                controller._proofs()
            changed[field] = previous
        with mock.patch.object(actions.publication, "_require_exact_clean_root") as clean, mock.patch.object(
            actions.publication, "_git", return_value=self.request["source_tree"]
        ), mock.patch.object(actions.publication, "_require_package_versions") as versions:
            controller._source()
        self.assertEqual(clean.call_args_list, [
            mock.call(controller.source_root, self.request["source_sha"]), mock.call(self.control, CONTROL),
        ])
        versions.assert_called_once_with(controller.source_root, self.request["version"], context="GitHub Actions release")
        with mock.patch.object(controller, "status_readiness", return_value=2), mock.patch.object(
            controller, "_mutate"
        ) as mutation, self.assertRaises(actions.ReleaseControlError):
            controller.prepare_tag()
        mutation.assert_not_called()
        self.assertEqual(controller.state["effects"], {})

    def test_injected_spec_restores_only_own_checkpoint_and_preserves_unknown_effects(self) -> None:
        controller = self._with_journal()
        controller.state["effects"]["draft"] = _effect({}, status="unknown")
        controller._save()
        for other_request, other_context in (
            (_request(), _context()),
            (controller.request, dict(controller.context, workflow_path=WORKFLOW)),
            (controller.request, dict(controller.context, run_id=CONTROL_RUN + 1)),
        ):
            with self.assertRaises(actions.ReleaseControlError):
                actions.validate_journal(controller.state, other_request, controller.request_digest, other_context, spec=self.spec)
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as output:
            output.writestr("journal.json", controller.journal_path.read_bytes())
        checkpoint = archive.getvalue()
        controller.journal_path.unlink()
        recovered = self._controller(attempt=2)
        artifact = {
            "id": 9001, "name": f"release-control-{self.request['tag']}-{CONTROL_RUN}-1-99-final-state",
            "expired": False, "size_in_bytes": len(checkpoint),
            "digest": "sha256:" + hashlib.sha256(checkpoint).hexdigest(),
            "workflow_run": {"id": CONTROL_RUN, "repository_id": REPO_ID,
                             "head_repository_id": REPO_ID, "head_sha": CONTROL, "head_branch": "main"},
        }
        recovered.client.fetch_json.side_effect = [
            {"total_count": 1, "artifacts": [artifact]},
            _controller_run(path=self.spec.workflow_path, status="completed"),
        ]
        with mock.patch.object(recovered, "_download_checkpoint", side_effect=lambda _item, _digest, path: path.write_bytes(checkpoint)), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(recovered.restore_state(), 0)
        self.assertEqual(recovered.state["effects"]["draft"]["status"], "unknown")
        with self.assertRaises(actions.ReleaseControlError):
            recovered._may_execute("draft")
        recovered._load()
        self.assertEqual(recovered.state["request"], self.request)

    def test_post_workflows_bind_selected_tag_and_keep_existing_consumers(self) -> None:
        controller = self._with_journal()
        controller.state["checks"]["public_bytes"] = True
        controller.state["release_id"] = 54321
        with mock.patch.object(controller, "_owned_release", return_value={"draft": False}), mock.patch.object(
            controller, "_post_runs", return_value=[]
        ), mock.patch.object(actions.readiness, "_branch_sha", return_value=CONTROL), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(controller.prepare_post(), 0)
        for kind, (workflow, title) in self.spec.post_workflows.items():
            self.assertEqual(workflow, actions.POST_WORKFLOWS[kind][0])
            self.assertTrue(title.endswith(self.request["tag"]))
            intent = controller._post_intent(kind)
            self.assertEqual(intent["tag"], self.request["tag"])
            self.assertEqual(intent["source_sha"], self.request["source_sha"])
            run = _controller_run(
                id=501, path=f".github/workflows/{workflow}", event="workflow_dispatch", display_title=title,
                actor={"login": actions.BOT_LOGIN, "id": actions.BOT_ID},
            )
            controller._validate_post_run(kind, run)
            run["display_title"] = actions.POST_WORKFLOWS[kind][1]
            with self.assertRaises(actions.ReleaseControlError):
                controller._validate_post_run(kind, run)

    def test_thin_entry_point_passes_spec_without_a_json_or_cli_selector(self) -> None:
        output = io.StringIO()
        with mock.patch.object(actions, "Controller") as controller, contextlib.redirect_stdout(output):
            self.assertEqual(actions.main(["--plan"], spec=self.spec), 0)
            controller.assert_not_called()
            controller.return_value.run.return_value = 0
            self.assertEqual(actions.main([
                "preflight", "--request", str(self.control / self.spec.request_path),
                "--source-root", str(self.root / "source"), "--state-dir", str(self.root / "state"),
            ], spec=self.spec), 0)
            self.assertIs(controller.call_args.kwargs["spec"], self.spec)
            controller.return_value.run.assert_called_once_with("preflight", 0)
        self.assertIn(self.request["tag"], output.getvalue())
        self.assertIn(self.request["source_sha"], output.getvalue())
        self.assertNotIn(TAG, output.getvalue())
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as rejected:
            actions.main(["--spec", self.spec.request_path])
        self.assertEqual(rejected.exception.code, 2)


class OfflineEntryPointTests(unittest.TestCase):
    def test_default_plan_and_help_do_not_construct_a_publisher(self) -> None:
        with mock.patch.object(actions, "Controller") as controller, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(actions.main([]), 0)
            self.assertEqual(actions.main(["--plan"]), 0)
            with self.assertRaises(SystemExit) as result:
                actions.main(["--help"])
        self.assertEqual(result.exception.code, 0)
        controller.assert_not_called()


if __name__ == "__main__":
    unittest.main()
