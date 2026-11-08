#!/usr/bin/env python3
"""Fixed v0.5.4 preview, native Windows acceptance, then stable publication.

The source/proof pins below must be finalized in reviewed control code. A JSON
request cannot select another source or disable the public acceptance stage.
"""
from __future__ import annotations

import copy
import hashlib
from pathlib import Path
import stat
import sys
import tempfile
import time
import zipfile

if __package__:
    from . import release_github_actions as base
    from . import release_windows_acceptance as windows
else:
    # Keep one module/class identity when this entry point is run as a script;
    # worker validation errors must reach the controller's bounded error handler.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scripts import release_github_actions as base
    from scripts import release_windows_acceptance as windows


# Exact source and successful push proofs reviewed for this fixed release.
SPEC = base.ReleaseSpec(
    {**base.PINNED_REQUEST,
     "version": "0.5.4", "tag": "v0.5.4", "source_ref": "release/v0.5.4",
     "source_sha": "1af9bb5321edcdc16a4f1a5be65d0611ef19964a", "source_tree": "ab8ae1168ec8a62ec33dd0f0ede4b9eb410e62d0",
     "ci_run_id": 42453724794, "ci_run_attempt": 1,
     "evidence_run_id": 42453724875, "evidence_run_attempt": 1,
     "notes_path": ".github/release-requests/v0.5.4-notes.md",
     "notes_sha256": "b6c9da772c6268d221c53b8556525c9505a48bb1f8d93b007aef73e95058e7f6"},
    ".github/release-requests/v0.5.4.json",
    ".github/workflows/release-publish-v054.yml",
)

require = base._require


def digest(value: dict) -> str:
    return hashlib.sha256(base._json_bytes(value)).hexdigest()


def require_finalized(spec: base.ReleaseSpec) -> None:
    request = spec.pinned_request
    require(request["tag"] == "v0.5.4"
            and spec.workflow_path == ".github/workflows/release-publish-v054.yml"
            and request["source_sha"] != "0" * 40 and request["source_tree"] != "0" * 40
            and request["ci_run_id"] > 1 and request["evidence_run_id"] > 1,
            "v0.5.4 固定源码或成功验收 pins 尚未完成审核；不执行任何发布操作。")


class StagedController(base.Controller):
    stages = (*base.STAGES[:16], "prepare-preview", "publish-preview", "verify-preview",
              "prepare-acceptance", "dispatch-acceptance", "status-acceptance",
              "prepare-promotion", "promote", "verify-public", "prepare-post", "dispatch-post", "status-post")

    def run(self, stage: str, wait_secs: int = 0) -> int:
        require_finalized(self.spec)
        return super().run(stage, wait_secs)

    def _publication_intent(self, *, promote: bool) -> dict:
        intent = {"release_id": self.state["release_id"], "assets_sha256": digest(self.state["assets"]),
                  "tag_object_sha": self.state["tag_object_sha"],
                  "payload": {"prerelease": False, "make_latest": "true"} if promote else
                             {"draft": False, "prerelease": True, "make_latest": "false"}}
        if promote:
            proof = self.state["checks"].get("windows_acceptance")
            require(isinstance(proof, dict) and proof.get("request_sha256") == windows.request_digest(self._windows_request()),
                    "缺少固定公开字节的双架构 Windows 验收证明。")
            intent["acceptance_sha256"] = digest(proof)
        return intent

    def _require_publication_intent(self, *, promote: bool) -> dict:
        key = "promote" if promote else "publish-preview"
        effect = self.state["effects"].get(key)
        require(isinstance(effect, dict) and effect["intent"] == self._publication_intent(promote=promote),
                "公开或推广意图缺失，或冻结身份、字节、验收证明发生变化。")
        return effect["intent"]

    def _validate_release_identity(self, release: dict, *, allow_public: bool = True) -> None:
        if release.get("draft") is True:
            base.validate_release_identity(release, self.state, allow_public=allow_public)
            return
        promote = release.get("prerelease") is False
        self._require_publication_intent(promote=promote)
        base.validate_release_identity(release, self.state, allow_public=allow_public,
            expected_prerelease=not promote, publication_effect="promote" if promote else "publish-preview")

    def _verify_primary_assets(self, release: dict, *, complete: bool, expected_prerelease: bool = False) -> dict:
        self._validate_release_identity(release)
        assets = super()._verify_primary_assets(release, complete=complete,
                                               expected_prerelease=release.get("prerelease") is True)
        if release.get("prerelease") is True:
            require(set(assets) == set(self.state["assets"]), "Windows 验收前预发布资产集合发生变化。")
        return assets

    def prepare_preview(self) -> int:
        self.verify_draft()
        require(self.state["checks"].get("draft") == {
            "release_id": self.state["release_id"], "assets_sha256": digest(self.state["assets"])},
            "未保留完整草稿验收结果。")
        self._prepare("publish-preview", self._publication_intent(promote=False))
        return 0

    def publish_preview(self) -> int:
        intent = self._require_publication_intent(promote=False)
        release = self._owned_release()
        self._verify_primary_assets(release, complete=True)
        if release["draft"] is True:
            self._may_execute("publish-preview")
            self.verify_draft()
            release = self._mutate("publish-preview", "PATCH", f"/releases/{release['id']}",
                                   intent["payload"], expected_status=200)
        self._validate_release_identity(release)
        require(release["draft"] is False, "预发布结果尚未确认；不重复提交。")
        self._record_success("publish-preview", {"release_id": release["id"], "published_at": release["published_at"]})
        print("已核对同一公开预发布；Windows 完整安装验收前不推广 stable/latest。")
        return 0

    def verify_preview(self) -> int:
        release = self._owned_release()
        require(release["draft"] is False, "Windows 验收需要实际公开的 Release。")
        self._verify_primary_assets(release, complete=True)
        if self.state["checks"].get("preview_bytes") is not True:
            require(release["prerelease"] is True, "缺少公开预发布的原始字节验收。")
            base.public_verifier.verify_public_release(self.request["version"], self.timeout, repo=self.request["repo"],
                github_only=True, require_unified_installers=True, require_runtime_installers=False,
                expected_prerelease=True)
            self.state["checks"]["preview_bytes"] = True
            self._save()
        return 0

    def _windows_request(self) -> dict:
        request = {"schema_version": 1, "repo": self.request["repo"], "repo_id": self.request["repo_id"],
            "tag": self.request["tag"], "source_sha": self.request["source_sha"],
            "control_sha": self.context["control_sha"], "request_id": "wa_" + self.state["journal_id"].replace("-", ""),
            "controller_run_id": self.context["run_id"], "controller_workflow": self.spec.workflow_path,
            "release_id": self.state["release_id"], "tag_object_sha": self.state["tag_object_sha"],
            "build_run_id": self.state["bundle"]["workflow_run_id"],
            "build_run_attempt": self.state["checks"].get("acceptance_build_attempt"),
            "release_body_sha256": hashlib.sha256(self.state["effects"]["draft"]["intent"]["body"].encode()).hexdigest(),
            "assets": copy.deepcopy(self.state["assets"])}
        windows.validate_request(request, self.spec)
        return request

    def _post_definition(self, kind: str) -> tuple[str, str]:
        if kind == "windows":
            return windows.WORKFLOW, windows.run_name(self._windows_request())
        return super()._post_definition(kind)

    def _post_identity(self, kind: str) -> dict:
        identity = super()._post_identity(kind)
        if kind == "windows":
            identity["acceptance_request"] = self._windows_request()
        return identity

    def _post_inputs(self, kind: str) -> dict:
        if kind != "windows":
            return super()._post_inputs(kind)
        request = self._post_intent(kind)["acceptance_request"]
        return {"tag": request["tag"], "request_id": request["request_id"],
                "request": base._json_bytes(request).decode()}

    def prepare_acceptance(self) -> int:
        self.verify_preview()
        if "post:windows" in self.state["effects"]:
            self._post_intent("windows")
            return 0
        run_id = self.state["bundle"]["workflow_run_id"]
        run = self.client.fetch_json(f"/actions/runs/{run_id}")
        require(run.get("id") == run_id and base._positive_int(run.get("run_attempt"))
                and run.get("path") == ".github/workflows/release-build.yml" and run.get("event") == "workflow_dispatch"
                and run.get("head_sha") == self.request["source_sha"] and run.get("head_branch") == self.request["tag"]
                and run.get("repository", {}).get("id") == self.request["repo_id"]
                and run.get("status") == "completed" and run.get("conclusion") == "success",
                "Windows 验收缺少同一已成功正式构建运行。")
        self.state["checks"]["acceptance_build_attempt"] = run["run_attempt"]
        require(base.readiness._branch_sha(self.client, "main") == self.context["control_sha"],
                "main 已离开审核控制源码；不分派 Windows 验收。")
        baseline = [run.get("id") for run in self._post_runs("windows")]
        require(all(base._positive_int(value) for value in baseline), "Windows 验收运行列表无效。")
        self._prepare("post:windows", {**self._post_identity("windows"), "not_before": int(time.time()),
                                       "baseline_run_ids": sorted(set(baseline))})
        return 0

    def dispatch_acceptance(self) -> int:
        self.verify_preview()
        self._dispatch_post_kind("windows")
        return 0

    def _acceptance_reports(self, run: dict) -> dict:
        request = self._post_intent("windows")["acceptance_request"]
        run_id, attempt = run["id"], run["run_attempt"]
        windows.validate_run(run, request, run_id=run_id, attempt=attempt, owner_id=self.request["owner_id"])
        payload = self.client.fetch_json(f"/actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100")
        jobs = payload.get("jobs")
        require(isinstance(jobs, list) and payload.get("total_count") == len(jobs) and len(jobs) <= 100,
                "Windows 原生 job 列表不完整。")
        for platform in windows.PLATFORMS:
            matches = [job for job in jobs if isinstance(job, dict) and job.get("name") == f"Windows acceptance ({platform})"]
            require(len(matches) == 1 and matches[0].get("status") == "completed"
                    and matches[0].get("conclusion") == "success", "Windows 两个原生架构 job 必须均成功且未跳过。")
        payload = self.client.fetch_json(f"/actions/runs/{run_id}/artifacts?per_page=100")
        artifacts = payload.get("artifacts")
        require(isinstance(artifacts, list) and payload.get("total_count") == len(artifacts) and len(artifacts) <= 100
                and all(isinstance(item, dict) for item in artifacts), "Windows 验收附件列表不完整或超出限制。")
        proof = {"run_id": run_id, "run_attempt": attempt, "request_sha256": windows.request_digest(request), "reports": {}}
        for platform in windows.PLATFORMS:
            items = [item for item in artifacts if item.get("name") == windows.artifact_name(platform, run_id, attempt)]
            require(len(items) == 1, "Windows 验收报告缺失或重名。")
            item = items[0]
            require(item.get("expired") is False and base._positive_int(item.get("id"))
                    and type(item.get("size_in_bytes")) is int and 0 < item["size_in_bytes"] <= base.MAX_CHECKPOINT_BYTES,
                    "Windows 验收报告已过期或过大。")
            origin = item.get("workflow_run", {})
            require(origin.get("id") == run_id and origin.get("repository_id") == self.request["repo_id"]
                    and origin.get("head_repository_id") == self.request["repo_id"]
                    and origin.get("head_sha") == self.context["control_sha"] and origin.get("head_branch") == "main",
                    "Windows 验收报告来自其他运行或源码。")
            checksum = base.collector._artifact_digest(item.get("digest"))
            with tempfile.TemporaryDirectory(prefix="windows-report-", dir=self.state_dir.parent) as tmp:
                path = Path(tmp) / "report.zip"
                self._download_checkpoint(item, checksum, path)
                with zipfile.ZipFile(path) as archive:
                    members = archive.infolist()
                    require(len(members) == 1, "Windows 验收附件只能包含一份报告。")
                    member = members[0]
                    require(member.filename == "report.json" and not member.is_dir() and not member.flag_bits & 1
                            and stat.S_IFMT(member.external_attr >> 16) in {0, stat.S_IFREG}
                            and 0 < member.file_size <= windows.MAX_REPORT_BYTES, "Windows 验收附件成员不安全。")
                    raw = archive.read(member)
                windows.validate_report(base._parse_json(raw), request, platform, run_id, attempt)
            proof["reports"][platform] = {"artifact_id": item["id"], "artifact_sha256": checksum,
                                           "report_sha256": hashlib.sha256(raw).hexdigest()}
        return proof

    def status_acceptance(self, wait_secs: int = 0) -> int:
        self.verify_preview()
        deadline = time.monotonic() + wait_secs
        while True:
            run = self._post_snapshot("windows")
            require(run is not None, "Windows 验收 dispatch 无法唯一关联；不自动重派。")
            if run.get("status") == "completed":
                if run.get("conclusion") != "success":
                    print("原 Windows 验收运行未成功；保留预发布，不推广 stable/latest。")
                    return 1
                proof = self._acceptance_reports(run)
                frozen = self.state["effects"].get("promote")
                require(frozen is None or frozen["intent"].get("acceptance_sha256") == digest(proof),
                        "推广意图冻结后验收运行或报告发生变化；不替换原验收证明。")
                self.state["checks"]["windows_acceptance"] = proof
                self._save()
                return 0
            if time.monotonic() >= deadline:
                print(f"固定 Windows 验收运行 {run['id']} 仍未结束；预发布保持原状态。")
                return 2
            time.sleep(min(10, max(0.1, deadline - time.monotonic())))

    def prepare_promotion(self) -> int:
        require(self.status_acceptance() == 0, "双架构真实安装验收未通过；不能冻结 stable/latest 推广。")
        self._verify_primary_assets(self._owned_release(), complete=True)
        self._prepare("promote", self._publication_intent(promote=True))
        return 0

    def _verify_latest(self, release: dict) -> None:
        require(release.get("draft") is False and release.get("prerelease") is False, "Release 尚未推广为 stable。")
        latest = self.client.fetch_json("/releases/latest")
        self._validate_release_identity(latest)
        require(latest.get("id") == release["id"] and latest.get("prerelease") is False,
                "GitHub 尚未确认同一 stable Release 为 latest；不重复推广。")

    def promote(self) -> int:
        intent = self._require_publication_intent(promote=True)
        release = self._owned_release()
        self._verify_primary_assets(release, complete=True)
        require(release["draft"] is False, "不能从草稿跳过公开验收直接推广。")
        if release["prerelease"] is True:
            self._may_execute("promote")
            require(self.status_acceptance() == 0, "推广前原 Windows 验收已不再成功。")
            self._require_publication_intent(promote=True)
            release = self._mutate("promote", "PATCH", f"/releases/{release['id']}", intent["payload"], expected_status=200)
        self._validate_release_identity(release)
        self._verify_latest(release)
        self._record_success("promote", {"release_id": release["id"], "latest": True})
        self.state["checks"]["promoted"] = True
        self._save()
        print("双架构真实 Windows 安装已验收；同一 Release 已推广 stable/latest，所有原资产保持不变。")
        return 0

    def _stable_gate(self) -> None:
        require(self.state["checks"].get("promoted") is True, "后续发布必须等待 Windows 验收和 stable 推广。")
        self._verify_latest(self._owned_release())

    def verify_public(self) -> int:
        self._stable_gate()
        return super().verify_public()

    def prepare_post(self) -> int:
        self._stable_gate()
        return super().prepare_post()

    def dispatch_post(self) -> int:
        self._stable_gate()
        return super().dispatch_post()

    def status_post(self, wait_secs: int = 0) -> int:
        self._stable_gate()
        result = super().status_post(wait_secs)
        if result:
            return result
        # v0.5.2/v0.5.3 retain their existing independent Intel delivery policy.
        # This fixed entry waits for both post adapters before declaring success.
        intel = self.state["post"]["intel"]
        if intel.get("status") != "completed":
            return 2
        if intel.get("conclusion") != "success":
            return 1
        assets = self._verify_primary_assets(self._owned_release(), complete=True)
        for platform in base.public_verifier.supplemental_desktop_platforms_for_version(self.request["version"]):
            for name in (base.public_verifier.canonical_desktop_name(self.request["version"], platform),
                         base.public_verifier.canonical_desktop_checksum_name(self.request["version"], platform)):
                require(name in assets and assets[name].get("state") == "uploaded", "Intel DMG 公开资产尚未完成。")
        return 0


if __name__ == "__main__":
    raise SystemExit(base.main(spec=SPEC, controller_type=StagedController))
