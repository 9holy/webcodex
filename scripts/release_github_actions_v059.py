#!/usr/bin/env python3
"""Fixed v0.5.9 authority using the reviewed staged publication gates.

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


# Final source and successful proof attempts are fixed in this reviewed
# control commit. Unfinished or mismatched requests still forbid publication.
SPEC = base.ReleaseSpec(
    {**base.PINNED_REQUEST,
     "version": "0.5.9", "tag": "v0.5.9", "source_ref": "release/v0.5.9",
     "source_sha": "48f9b5ed9d7769f2c0d5013ac9fe5da501d626fe",
     "source_tree": "03ceb24f7298ad0218fa88d3bbc652d8b8225c57",
     "ci_run_id": 42731428931, "ci_run_attempt": 1,
     "evidence_run_id": 42731428947, "evidence_run_attempt": 1,
     "notes_path": ".github/release-requests/v0.5.9-notes.md",
     "notes_sha256": "0767f3bbcc09c197e03442503788d46fcdc177d39d7e42bcb24d88c4949d5ccb"},
    ".github/release-requests/v0.5.9.json",
    ".github/workflows/release-publish-v059.yml",
)


def require_finalized(spec: base.ReleaseSpec) -> None:
    request = spec.pinned_request
    base._require(
        request["version"] == "0.5.9" and request["tag"] == "v0.5.9"
        and request["source_ref"] == "release/v0.5.9"
        and spec.request_path == ".github/release-requests/v0.5.9.json"
        and spec.workflow_path == ".github/workflows/release-publish-v059.yml"
        and spec.platform_scope == "all"
        and request["source_sha"] != "0" * 40 and request["source_tree"] != "0" * 40
        and request["ci_run_id"] > 1 and request["evidence_run_id"] > 1,
        "v0.5.9 固定源码或成功验收 pins 尚未完成审核；不执行任何发布操作。",
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
