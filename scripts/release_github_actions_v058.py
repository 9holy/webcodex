#!/usr/bin/env python3
"""Fixed Windows v0.5.8 authority using the reviewed staged publication gates.

Only this entry's source/proof pins may change during finalization. The request
cannot select another source, workflow, asset scope, or acceptance policy.
"""
from __future__ import annotations

from pathlib import Path
import sys

if __package__:
    from . import release_github_actions as base
    from . import release_github_actions_v057 as staged
else:
    # Preserve one validation error class across the script and shared worker.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scripts import release_github_actions as base
    from scripts import release_github_actions_v057 as staged


# Fixed source/proof identities; publication still verifies their exact successful runs.
# Keep the six source/proof values and notes digest identical to the fixed request.
SPEC = base.ReleaseSpec(
    {**base.PINNED_REQUEST,
     "version": "0.5.8", "tag": "v0.5.8", "source_ref": "release/v0.5.8",
     "platform_scope": "windows",
     "source_sha": "9d9200a9da040e1c72f8f627b077285cf954d02b",
     "source_tree": "dcf635afc1b7d5ad669fd756d1f6506f4d72ab17",
     "ci_run_id": 42523755555, "ci_run_attempt": 1,
     "evidence_run_id": 42523756080, "evidence_run_attempt": 2,
     "notes_path": ".github/release-requests/v0.5.8-notes.md",
     "notes_sha256": "7024711b2a96e8a26faff45fd0fa58f5b083356e74f02dd05ab7ec6cbd885f3f"},
    ".github/release-requests/v0.5.8.json",
    ".github/workflows/release-publish-v058.yml",
)


def require_finalized(spec: base.ReleaseSpec) -> None:
    request = spec.pinned_request
    base._require(
        request["version"] == "0.5.8" and request["tag"] == "v0.5.8"
        and request["source_ref"] == "release/v0.5.8"
        and spec.request_path == ".github/release-requests/v0.5.8.json"
        and spec.workflow_path == ".github/workflows/release-publish-v058.yml"
        and spec.platform_scope == "windows"
        and request["source_sha"] != "0" * 40 and request["source_tree"] != "0" * 40
        and request["ci_run_id"] > 1 and request["evidence_run_id"] > 1,
        "v0.5.8 固定源码或成功验收 pins 尚未完成审核；不执行任何发布操作。",
    )


class StagedController(staged.StagedController):
    def run(self, stage: str, wait_secs: int = 0) -> int:
        require_finalized(self.spec)
        # Replace only the v0.5.7 entry guard. The original dispatcher still
        # authenticates, locks, restores and validates source. All Windows scope,
        # acceptance, promotion and latest-preservation methods remain inherited.
        return base.Controller.run(self, stage, wait_secs)


if __name__ == "__main__":
    raise SystemExit(base.main(spec=SPEC, controller_type=StagedController))
