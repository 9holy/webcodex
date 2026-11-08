#!/usr/bin/env python3
"""Fixed v0.5.5 authority using the reviewed staged publication gates.

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


# FINALIZED: exact-source CI and native evidence succeeded. These six
# source/proof values and the reviewed notes digest are fixed for publication.
SPEC = base.ReleaseSpec(
    {**base.PINNED_REQUEST,
     "version": "0.5.5", "tag": "v0.5.5", "source_ref": "release/v0.5.5",
     "source_sha": "a596cec372232b1aa008cef676f61a8170fbf239",
     "source_tree": "3c93ce69bbc6f4476f8afeeec964bd8b9f2c7e74",
     "ci_run_id": 42479388426, "ci_run_attempt": 1,
     "evidence_run_id": 42479388862, "evidence_run_attempt": 1,
     "notes_path": ".github/release-requests/v0.5.5-notes.md",
     "notes_sha256": "0488e3d2718be04bb72bb2c86eb9e4be4cb50c0e476df50ee8fbfabdaa8b76c9"},
    ".github/release-requests/v0.5.5.json",
    ".github/workflows/release-publish-v055.yml",
)


def require_finalized(spec: base.ReleaseSpec) -> None:
    request = spec.pinned_request
    base._require(
        request["version"] == "0.5.5" and request["tag"] == "v0.5.5"
        and request["source_ref"] == "release/v0.5.5"
        and spec.request_path == ".github/release-requests/v0.5.5.json"
        and spec.workflow_path == ".github/workflows/release-publish-v055.yml"
        and request["source_sha"] != "0" * 40 and request["source_tree"] != "0" * 40
        and request["ci_run_id"] > 1 and request["evidence_run_id"] > 1,
        "v0.5.5 固定源码或成功验收 pins 尚未完成审核；不执行任何发布操作。",
    )


class StagedController(staged.StagedController):
    def run(self, stage: str, wait_secs: int = 0) -> int:
        require_finalized(self.spec)
        # Replace only the v0.5.4 entry guard. The unchanged base dispatcher still
        # authenticates, locks, restores, validates source, and calls the inherited
        # staged method; no publication or acceptance gate is overridden.
        return base.Controller.run(self, stage, wait_secs)


if __name__ == "__main__":
    raise SystemExit(base.main(spec=SPEC, controller_type=StagedController))
