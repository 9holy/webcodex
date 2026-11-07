#!/usr/bin/env python3
"""Recover only v0.5.2 assembly, then use the existing publication lifecycle.

The immutable tag and native bytes belong to the original production run. This
new owner-triggered run records its own assembly identity and never reports the
failed original aggregate as successful. Ordinary release collection is intact.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

if __package__:
    from . import release_github_actions as base
    from . import recover_release_assembly as recovery
else:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import release_github_actions as base
    import recover_release_assembly as recovery


ORIGIN_PATH = ".github/release-requests/v0.5.2-assembly-recovery.json"
ORIGIN_SHA256 = "1eadff660c06001238a5c15c120f0d6362523b061b3bf7f2738bb83a2f817f59"
RECOVERY_STAGES = ("restore-state", "preflight-recovery", "recover-assembly", *base.STAGES[11:])
FORBIDDEN_EFFECTS = frozenset({"readiness", "build", "tag-object", "tag-ref"})


def _require(value: bool, message: str) -> None:
    base._require(value, message)


class RecoveryController(base.Controller):
    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        path = base._safe_path(self.control_root / ORIGIN_PATH)
        raw = path.read_bytes()
        _require(hashlib.sha256(raw).hexdigest() == ORIGIN_SHA256,
                 "恢复来源清单与已审核的固定散列不一致。")
        self.origin = base._parse_json(raw)
        for key in ("repo", "repo_id", "owner", "owner_id", "version", "tag", "source_sha", "source_tree",
                    "include_unified_installers", "include_runtime_installers"):
            _require(type(self.origin.get(key)) is type(self.request[key])
                     and self.origin.get(key) == self.request[key], "恢复目标与已授权发布请求不一致。")

    def _origin_receipt(self) -> dict:
        return {"origin_sha256": ORIGIN_SHA256,
                "original_publisher_run_id": self.origin["original_publisher_run_id"],
                "source_build_run_id": self.origin["source_build_run_id"],
                "source_build_run_attempt": self.origin["source_build_run_attempt"],
                "readiness_run_id": self.origin["readiness_run_id"],
                "tag_object_sha": self.origin["tag_object_sha"],
                "source_sha": self.origin["source_sha"]}

    def _assembly_context(self) -> dict:
        return recovery.assembly_context_from_env(self.env)

    def _recovery_receipt(self, *, check_files: bool = False) -> dict:
        _require(self.state.get("checks", {}).get("recovery_origin") == self._origin_receipt(),
                 "尚未核验这一份固定恢复来源。")
        receipt = self.state["checks"].get("assembly_recovery")
        _require(isinstance(receipt, dict), "完整恢复汇总尚未通过，不能进入发布。")
        return recovery.validate_receipt(self.origin, receipt, self._assembly_context(),
                                         bundle_dir=self.bundle_dir if check_files else None)

    def _validate_recovery_state(self) -> None:
        _require(not FORBIDDEN_EFFECTS.intersection(self.state.get("effects", {})),
                 "恢复记录不能派发生产构建或把旧 tag 写成新创建的 tag。")
        checks = self.state.get("checks", {})
        if "recovery_origin" in checks:
            _require(checks["recovery_origin"] == self._origin_receipt(), "恢复来源记录发生变化。")
            _require(self.state.get("tag_object_sha") == self.origin["tag_object_sha"],
                     "恢复记录的固定 annotated tag 已变化。")
        if "assembly_recovery" in checks:
            receipt = self._recovery_receipt()
            summary = checks.get("assembly_summary")
            _require(isinstance(summary, dict), "恢复记录缺少已验收的完整包摘要。")
            self._check_summary_identity(summary)
            _require(recovery.canonical_sha256(summary) == receipt["summary_sha256"],
                     "恢复包摘要与完整校验回执的散列不一致。")
        if self.state.get("bundle") is not None or self.state.get("effects") or self.state.get("assets"):
            receipt = self._recovery_receipt()
            expected_bundle = {"workflow_run_id": self.origin["source_build_run_id"],
                               "source_sha": self.request["source_sha"], "tag": self.request["tag"],
                               "sha256sums_sha256": receipt["generated_public_files"]["SHA256SUMS"]["sha256"],
                               "origin_sha256": ORIGIN_SHA256, "assembly_run_id": self.context["run_id"],
                               "assembly_control_sha": self.context["control_sha"]}
            _require(self.state.get("bundle") == expected_bundle,
                     "发布操作的候选包记录与原生产来源及本次恢复回执不一致。")
        if self.state.get("assets"):
            receipt = self._recovery_receipt()
            expected = {**receipt["public_inputs"], **receipt["generated_public_files"]}
            _require(set(self.state["assets"]) == set(expected), "公开附件集合与恢复回执不一致。")
            for name, item in self.state["assets"].items():
                _require(item["sha256"] == expected[name]["sha256"] and item["size"] == expected[name]["size"],
                         "公开附件字节与恢复回执不一致。")

    def _save(self) -> None:
        self._validate_recovery_state()
        super()._save()

    def _validate_child_states(self, root: Path | None = None) -> None:
        _require(not any(((root or self.state_dir) / f"{kind}.json").exists()
                         for kind in ("readiness", "build")),
                 "恢复 checkpoint 不能把原失败生产运行伪装为新的成功子运行。")
        self._validate_recovery_state()

    def run(self, stage: str, wait_secs: int = 0) -> int:
        _require(stage in RECOVERY_STAGES and 0 <= wait_secs <= 60,
                 "此恢复入口不允许创建 tag、派发生产构建或执行未审核阶段。")
        self._authenticate()
        with self._lock():
            if stage == "restore-state":
                return self.restore_state()
            if stage == "preflight-recovery" and not self.journal_path.exists():
                _require(self.context["attempt"] == 1, "重试缺少原恢复运行的 checkpoint；已停止。")
                self.state = base.new_journal(self.request, self.request_digest, self.context)
                self._save()
            else:
                self._load()
            self._validate_child_states()
            self._source()
            method = getattr(self, stage.replace("-", "_"))
            return method(wait_secs) if stage.startswith("status-") else method()

    def _validate_repository_run(self, run: dict, expected: dict, *, owner: bool) -> None:
        _require(all(type(run.get(key)) is type(value) and run.get(key) == value
                     for key, value in expected.items()), "原恢复来源运行的身份或终态不一致。")
        for key in ("repository", "head_repository"):
            repo = run.get(key)
            _require(isinstance(repo, dict) and repo.get("id") == self.request["repo_id"]
                     and repo.get("full_name") == self.request["repo"], "原恢复来源属于错误仓库。")
        principal = (self.request["owner"], self.request["owner_id"]) if owner else (base.BOT_LOGIN, base.BOT_ID)
        for key in ("actor", "triggering_actor"):
            actor = run.get(key)
            _require(isinstance(actor, dict) and (actor.get("login"), actor.get("id")) == principal,
                     "原恢复来源的发起身份不一致。")

    def _original_publication_proofs(self) -> None:
        origin = self.origin
        old = self.client.fetch_json(f"/actions/runs/{origin['original_publisher_run_id']}")
        self._validate_repository_run(old, {
            "id": origin["original_publisher_run_id"], "run_attempt": origin["original_publisher_attempt"],
            "path": base.WORKFLOW_PATH, "head_sha": origin["original_control_sha"],
            "head_branch": "main", "event": "push", "status": "completed", "conclusion": "failure",
        }, owner=True)
        payload = self.client.fetch_json(
            f"/actions/runs/{origin['original_publisher_run_id']}/attempts/1/jobs?per_page=100")
        jobs = payload.get("jobs")
        _require(isinstance(jobs, list) and len(jobs) == 1
                 and jobs[0].get("id") == 128404552109 and jobs[0].get("name") == "publish"
                 and jobs[0].get("status") == "completed" and jobs[0].get("conclusion") == "failure",
                 "原发布运行并非已核实的单一失败控制任务。")
        steps = jobs[0].get("steps")
        _require(isinstance(steps, list)
                 and [item.get("name") for item in steps if item.get("conclusion") == "failure"]
                 == ["Require the exact formal build to succeed"],
                 "原发布运行不是在正式汇总失败处停止。")
        by_name = {item.get("name"): item for item in steps}
        for name in ("Create or reconcile the bound draft", "Upload retained assets without replacing existing bytes",
                     "Publish the verified GitHub Release once", "Dispatch the existing post-publication workflows"):
            _require(by_name.get(name, {}).get("conclusion") == "skipped",
                     "原发布运行已有未纳入本恢复范围的公开副作用。")
        ready = self.client.fetch_json(f"/actions/runs/{origin['readiness_run_id']}")
        self._validate_repository_run(ready, {
            "id": origin["readiness_run_id"], "run_attempt": origin["readiness_run_attempt"],
            "path": base.readiness.READINESS_WORKFLOW_PATH, "head_sha": self.request["source_sha"],
            "head_branch": self.request["source_ref"], "event": "workflow_dispatch",
            "display_title": f"Release readiness {origin['readiness_request_id']} {self.request['source_sha']}",
            "status": "completed", "conclusion": "success",
        }, owner=False)

    def _verify_tag(self, ref: dict | None = None) -> None:
        # Explicitly observe one previously created immutable object. Never
        # manufacture tag-object/tag-ref effects under the new journal identity.
        expected = base.annotated_tag_intent(self.request, {
            "created_at": self.origin["tag_created_at"], "journal_id": self.origin["tag_journal_id"]})
        _require(expected["sha"] == self.origin["tag_object_sha"], "固定 tag 的原始来源内容不一致。")
        value = ref if ref is not None else self._tag_ref()
        _require(isinstance(value, dict) and value.get("ref") == f"refs/tags/{self.request['tag']}"
                 and value.get("object", {}).get("type") == "tag"
                 and value.get("object", {}).get("sha") == expected["sha"],
                 "恢复仅允许保留原 annotated tag；不会移动、删除或创建替代 tag。")
        tag = self.client.fetch_json(f"/git/tags/{expected['sha']}")
        body = expected["payload"]
        _require(tag.get("sha") == expected["sha"] and tag.get("tag") == body["tag"]
                 and tag.get("message") == body["message"]
                 and tag.get("object", {}).get("type") == "commit"
                 and tag.get("object", {}).get("sha") == self.request["source_sha"],
                 "原 tag 的名称、说明或产品源码发生变化。")
        tagger = tag.get("tagger", {})
        _require(tagger.get("name") == body["tagger"]["name"]
                 and tagger.get("email") == body["tagger"]["email"], "原 tag 的签发身份不一致。")
        try:
            epoch = dt.datetime.fromisoformat(str(tagger.get("date", "")).replace("Z", "+00:00")).timestamp()
        except ValueError as exc:
            raise base.ReleaseControlError("原 tag 的时间无效。") from exc
        _require(epoch == self.origin["tag_created_at"], "原 tag 的时间与产物 build timestamp 不一致。")

    def preflight_recovery(self) -> int:
        self._proofs()
        self._original_publication_proofs()
        self._verify_tag()
        release = self._find_release()
        if release is not None:
            base.validate_release_identity(release, self.state, allow_public=True)
        self.state["tag_object_sha"] = self.origin["tag_object_sha"]
        self.state["checks"]["recovery_origin"] = self._origin_receipt()
        self.state["checks"]["preflight"] = {
            "principal": "github-actions-installation", "github_only": True,
            "mode": "fixed-original-artifact-assembly-recovery", "tag_action": "observed-unchanged"}
        self._save()
        print("已核对原发布失败位置、成功源码证明及固定 tag；本次只恢复汇总，不改写原生产结果。")
        return 0

    def _check_summary_identity(self, summary: dict) -> None:
        expected = {"build_kind": "release", "version": self.request["version"],
                    "source_sha": self.request["source_sha"], "tag": self.request["tag"],
                    "workflow_run_id": self.origin["source_build_run_id"],
                    "built_at": self.origin["built_at"], "archive_stem": f"webcodex-v{self.request['version']}"}
        _require(all(type(summary.get(key)) is type(value) and summary.get(key) == value
                     for key, value in expected.items()), "恢复包没有保留真实的原生产来源。")
        _require("installer_manifest_v2" not in summary, "恢复请求不包含额外 Runtime 安装包。")

    def _check_bundle_summary(self, summary: dict) -> None:
        self._check_summary_identity(summary)
        receipt = self._recovery_receipt()
        _require(self.state["checks"].get("assembly_summary") == summary
                 and recovery.canonical_sha256(summary) == receipt["summary_sha256"],
                 "恢复包摘要与已完成的完整校验不一致。")

    @staticmethod
    def _stable_receipt(receipt: dict) -> dict:
        stable = copy.deepcopy(receipt)
        stable["assembly"]["run_attempt"] = 0
        return stable

    def recover_assembly(self) -> int:
        self._verify_tag()
        _require(self.state["checks"].get("recovery_origin") == self._origin_receipt(),
                 "必须先完成固定恢复来源预检。")
        recorded = self.state.get("bundle")
        if self.bundle_dir.exists():
            _require(isinstance(recorded, dict), "已有候选目录缺少恢复记录；不会覆盖或删除。")
            self._recovery_receipt(check_files=True)
            self._bundle_summary()
            print("同一恢复运行的现有候选字节已重新核验。")
            return 0
        summary, receipt = recovery.recover_assembly(
            origin=self.origin, source_root=self.source_root, output_dir=self.bundle_dir,
            client=self.client, env=self.env, timeout=self.timeout)
        self._check_summary_identity(summary)
        recovery.validate_receipt(self.origin, receipt, self._assembly_context(), bundle_dir=self.bundle_dir)
        previous = self.state["checks"].get("assembly_recovery")
        if previous is not None:
            recovery.validate_receipt(self.origin, previous, self._assembly_context())
            _require(self._stable_receipt(previous) == self._stable_receipt(receipt)
                     and self.state["checks"].get("assembly_summary") == summary,
                     "重新汇总的原 artifact 或公开字节与首次验收不同；已停止。")
        sums_sha = base.collector.sha256_file(self.bundle_dir / "SHA256SUMS")
        bundle_record = {"workflow_run_id": self.origin["source_build_run_id"],
                         "source_sha": self.request["source_sha"], "tag": self.request["tag"],
                         "sha256sums_sha256": sums_sha, "origin_sha256": ORIGIN_SHA256,
                         "assembly_run_id": self.context["run_id"],
                         "assembly_control_sha": self.context["control_sha"]}
        _require(recorded is None or recorded == bundle_record, "恢复候选包的来源记录已改变。")
        self.state["checks"]["assembly_recovery"] = previous or receipt
        self.state["checks"]["assembly_summary"] = summary
        self.state["checks"]["recovery_last_verified_attempt"] = self.context["attempt"]
        self.state["bundle"] = bundle_record
        self._save()
        self._bundle_summary()
        print("原生安装包字节保持一致；已重新完成全部汇总、签名来源、校验和及公开清单验收。")
        return 0

    def _draft_intent(self) -> dict:
        intent = super()._draft_intent()
        producer_url = f"https://github.com/{self.request['repo']}/actions/runs/{self.origin['source_build_run_id']}"
        assembly_url = f"https://github.com/{self.request['repo']}/actions/runs/{self.context['run_id']}"
        note = ("## 安装包汇总记录\n\n"
                f"原生程序和安装包来自[原生产运行]({producer_url})，各平台生产任务均已成功。"
                "该运行的最终汇总因校验清单中的目录前缀不一致而停止；"
                f"[本次恢复运行]({assembly_url})保留原 tag 和安装包字节，"
                "仅规范化未公开的校验文件路径，并重新执行完整汇总与文件验收。\n\n")
        marker_at = intent["body"].rfind("<!-- webcodex-release-control:")
        _require(marker_at >= 0, "发布说明缺少本次恢复运行归属标记。")
        intent["body"] = intent["body"][:marker_at] + note + intent["body"][marker_at:]
        return intent


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="固定 v0.5.2 原生产产物的汇总恢复；无参数只显示计划。")
    parser.add_argument("stage", nargs="?", choices=RECOVERY_STAGES)
    parser.add_argument("--plan", action="store_true")
    parser.add_argument("--request", type=Path)
    parser.add_argument("--source-root", type=Path)
    parser.add_argument("--state-dir", type=Path)
    parser.add_argument("--bundle-dir", type=Path)
    parser.add_argument("--wait-secs", type=int, default=0)
    parser.add_argument("--timeout", type=float, default=120)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.plan or args.stage is None:
        print("固定恢复 9holy/webcodex v0.5.2，原生产运行 42373155729 / attempt 1。")
        print("保留已创建的 annotated tag 与全部原生安装包字节，仅修复十个 sidecar 的路径并重新完整验收。")
        print("原生产运行仍记录为 failure；本次组装身份与原生产身份分别记录。")
        print("阶段：" + " → ".join(RECOVERY_STAGES))
        return 0
    if args.request is None or args.source_root is None or args.state_dir is None:
        parser.error("执行阶段需要 --request、--source-root 和 --state-dir")
    try:
        return RecoveryController(args.request, args.source_root, args.state_dir, args.bundle_dir,
                                  args.timeout).run(args.stage, args.wait_secs)
    except base.ReleaseControlError as exc:
        print(f"[assembly-publication] {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        # Do not expose signed storage redirects, HTTP bodies or credentials.
        print(f"[assembly-publication] 恢复验收或发布失败（{type(exc).__name__}）；已停止并保留记录。", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
