#!/usr/bin/env python3
"""Fixed Windows v0.5.7 authority using the reviewed staged publication gates.

Only this entry's source/proof pins may change during finalization. The request
cannot select another source, workflow, asset scope, or acceptance policy.
"""
from __future__ import annotations

from pathlib import Path
import sys

if __package__:
    from . import release_github_actions as base
    from . import release_github_actions_v056 as staged
else:
    # Preserve one validation error class across the script and shared worker.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scripts import release_github_actions as base
    from scripts import release_github_actions_v056 as staged


# Fixed source/proof identities; publication still verifies their exact successful runs.
# Keep the six source/proof values and notes digest identical to the fixed request.
SPEC = base.ReleaseSpec(
    {**base.PINNED_REQUEST,
     "version": "0.5.7", "tag": "v0.5.7", "source_ref": "release/v0.5.7",
     "platform_scope": "windows",
     "source_sha": "280410938e523bee708380da10f6c2cc03b0c65a",
     "source_tree": "7f997cccf3a8b1ef54753bb0031afeab54303a27",
     "ci_run_id": 42506601238, "ci_run_attempt": 1,
     "evidence_run_id": 42506601241, "evidence_run_attempt": 1,
     "notes_path": ".github/release-requests/v0.5.7-notes.md",
     "notes_sha256": "b3a4f8b4d4e41addf53bfb6a1b8dc1a8907293fad38fef9f1f592b80a71c491b"},
    ".github/release-requests/v0.5.7.json",
    ".github/workflows/release-publish-v057.yml",
)


def require_finalized(spec: base.ReleaseSpec) -> None:
    request = spec.pinned_request
    base._require(
        request["version"] == "0.5.7" and request["tag"] == "v0.5.7"
        and request["source_ref"] == "release/v0.5.7"
        and spec.request_path == ".github/release-requests/v0.5.7.json"
        and spec.workflow_path == ".github/workflows/release-publish-v057.yml"
        and spec.platform_scope == "windows"
        and request["source_sha"] != "0" * 40 and request["source_tree"] != "0" * 40
        and request["ci_run_id"] > 1 and request["evidence_run_id"] > 1,
        "v0.5.7 固定源码或成功验收 pins 尚未完成审核；不执行任何发布操作。",
    )


class StagedController(staged.StagedController):
    def run(self, stage: str, wait_secs: int = 0) -> int:
        require_finalized(self.spec)
        # Replace only the v0.5.6 entry guard. The original dispatcher still
        # authenticates, locks, restores and validates source. All Windows scope,
        # acceptance, promotion and latest-preservation methods remain inherited.
        return base.Controller.run(self, stage, wait_secs)


if __name__ == "__main__":
    raise SystemExit(base.main(spec=SPEC, controller_type=StagedController))
