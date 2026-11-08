#!/usr/bin/env python3
"""Fixed Windows v0.5.6 authority using the reviewed staged publication gates.

Only this entry's source/proof pins may change during finalization. The request
cannot select another source, workflow, asset scope, or acceptance policy.
"""
from __future__ import annotations

from pathlib import Path
import sys

if __package__:
    from . import release_github_actions as base
    from . import release_github_actions_v054 as staged
else:
    # Preserve one validation error class across the script and shared worker.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scripts import release_github_actions as base
    from scripts import release_github_actions_v054 as staged


# Finalization records the reviewed exact-source CI and native evidence.
# Keep the six source/proof values and notes digest identical to the fixed request.
SPEC = base.ReleaseSpec(
    {**base.PINNED_REQUEST,
     "version": "0.5.6", "tag": "v0.5.6", "source_ref": "release/v0.5.6",
     "platform_scope": "windows",
     "source_sha": "6f89d65654af65725bb98a4269d3d99716f9db6c",
     "source_tree": "f5bee0886695a8a60772739e48877226ffe9b4d9",
     "ci_run_id": 42497796231, "ci_run_attempt": 1,
     "evidence_run_id": 42497796371, "evidence_run_attempt": 1,
     "notes_path": ".github/release-requests/v0.5.6-notes.md",
     "notes_sha256": "1869cce6cbe246200ed77e5e7feb6962e42f2f15734f59ac556624df1e93e5f6"},
    ".github/release-requests/v0.5.6.json",
    ".github/workflows/release-publish-v056.yml",
)


def require_finalized(spec: base.ReleaseSpec) -> None:
    request = spec.pinned_request
    base._require(
        request["version"] == "0.5.6" and request["tag"] == "v0.5.6"
        and request["source_ref"] == "release/v0.5.6"
        and spec.request_path == ".github/release-requests/v0.5.6.json"
        and spec.workflow_path == ".github/workflows/release-publish-v056.yml"
        and spec.platform_scope == "windows"
        and request["source_sha"] != "0" * 40 and request["source_tree"] != "0" * 40
        and request["ci_run_id"] > 1 and request["evidence_run_id"] > 1,
        "v0.5.6 固定源码或成功验收 pins 尚未完成审核；不执行任何发布操作。",
    )


class StagedController(staged.StagedController):
    def run(self, stage: str, wait_secs: int = 0) -> int:
        require_finalized(self.spec)
        # Replace only the v0.5.4 entry guard. The unchanged base dispatcher still
        # authenticates, locks, restores, validates source, and calls the inherited
        # staged method. Windows-only overrides retain acceptance gates and
        # preserve the previous all-platform latest instead of selecting this tag.
        return base.Controller.run(self, stage, wait_secs)

    def _latest_identity(self) -> dict:
        value = self.client.fetch_json("/releases/latest")
        base._require(isinstance(value, dict) and base._positive_int(value.get("id"))
                      and isinstance(value.get("tag_name"), str) and 0 < len(value["tag_name"]) <= 160
                      and value.get("draft") is False and value.get("prerelease") is False,
                      "无法确认原全平台 latest；不执行 Windows 单独发布。")
        return {"release_id": value["id"], "tag": value["tag_name"]}

    def _preserved_latest(self) -> dict:
        value = self.state["checks"].get("preserved_latest")
        base._require(isinstance(value, dict) and set(value) == {"release_id", "tag"}
                      and base._positive_int(value["release_id"])
                      and isinstance(value["tag"], str) and 0 < len(value["tag"]) <= 160
                      and value["release_id"] != self.state["release_id"]
                      and value["tag"] != self.request["tag"],
                      "缺少原全平台 latest 的固定身份记录。")
        return dict(value)

    def _verify_preserved_latest(self) -> None:
        base._require(self._latest_identity() == self._preserved_latest(),
                      "原全平台 latest 已变化；停止并保留记录，不修改 latest。")

    def _publication_intent(self, *, promote: bool) -> dict:
        intent = super()._publication_intent(promote=promote)
        intent["preserved_latest"] = self._preserved_latest()
        if promote:
            intent["payload"] = {"prerelease": False, "make_latest": "false"}
        return intent

    def prepare_preview(self) -> int:
        self.verify_draft()
        if "preserved_latest" not in self.state["checks"]:
            base._require("publish-preview" not in self.state["effects"],
                          "已有公开意图缺少原 latest 身份；不重新取得发布权限。")
            self.state["checks"]["preserved_latest"] = self._latest_identity()
            self._preserved_latest()
            self._save()
        self._verify_preserved_latest()
        return super().prepare_preview()

    def verify_preview(self) -> int:
        release = self._owned_release()
        base._require(release["draft"] is False, "Windows 验收需要实际公开的 Release。")
        self._verify_primary_assets(release, complete=True)
        self._verify_preserved_latest()
        if self.state["checks"].get("preview_bytes") is not True:
            base._require(release["prerelease"] is True, "缺少公开预发布的原始字节验收。")
            base.public_verifier.verify_public_release(self.request["version"], self.timeout,
                repo=self.request["repo"], github_only=True, require_unified_installers=True,
                require_runtime_installers=False, expected_prerelease=True, platform_scope="windows")
            self.state["checks"]["preview_bytes"] = True
            self._save()
        return 0

    def prepare_promotion(self) -> int:
        self._verify_preserved_latest()
        return super().prepare_promotion()

    def _verify_latest(self, release: dict) -> None:
        base._require(release.get("draft") is False and release.get("prerelease") is False,
                      "Windows Release 尚未通过正式发布门。")
        self._verify_preserved_latest()

    def promote(self) -> int:
        intent = self._require_publication_intent(promote=True)
        release = self._owned_release()
        self._verify_primary_assets(release, complete=True)
        self._verify_preserved_latest()
        base._require(release["draft"] is False, "不能从草稿跳过公开验收直接发布。")
        if release["prerelease"] is True:
            self._may_execute("promote")
            base._require(self.status_acceptance() == 0, "发布前原 Windows 验收已不再成功。")
            self._require_publication_intent(promote=True)
            release = self._mutate("promote", "PATCH", f"/releases/{release['id']}",
                                   intent["payload"], expected_status=200)
        self._validate_release_identity(release)
        self._verify_latest(release)
        self._record_success("promote", {"release_id": release["id"], "latest": False,
                                         "preserved_latest": self._preserved_latest()})
        self.state["checks"]["promoted"] = True
        self._save()
        print("两架构各五场景已通过；同一 Windows Release 正式公开，原全平台 latest 保持不变。")
        return 0

    def verify_public(self) -> int:
        self._stable_gate()
        return base.Controller.verify_public(self)

    def _post_scope(self) -> dict:
        return {"platform_scope": "windows", "image": "not_applicable", "intel": "not_applicable"}

    def _require_windows_post_scope(self) -> None:
        self._stable_gate()
        base._require(self.state["checks"].get("public_bytes") is True,
                      "Windows 公开资产字节尚未完成验收。")
        base._require(not any(f"post:{kind}" in self.state["effects"] or kind in self.state["post"]
                              for kind in ("image", "intel")),
                      "Windows 发布记录不能包含跨平台派发。")

    def prepare_post(self) -> int:
        self._require_windows_post_scope()
        previous = self.state["checks"].get("post_scope")
        base._require(previous is None or previous == self._post_scope(), "发布范围完成记录已改变。")
        self.state["checks"]["post_scope"] = self._post_scope()
        self._save()
        return 0

    def dispatch_post(self) -> int:
        self._require_windows_post_scope()
        base._require(self.state["checks"].get("post_scope") == self._post_scope(),
                      "Windows 发布范围尚未冻结。")
        return 0

    def status_post(self, wait_secs: int = 0) -> int:
        self.dispatch_post()
        self._verify_primary_assets(self._owned_release(), complete=True)
        print("Windows 安装包公开字节和两架构共十场景均已验收；不分派 Docker 或 Intel Mac，不改变 latest。")
        return 0


if __name__ == "__main__":
    raise SystemExit(base.main(spec=SPEC, controller_type=StagedController))
