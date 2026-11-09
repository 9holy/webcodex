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


# Not finalized: bind the exact source and successful proof attempts in a
# separate reviewed control commit. Placeholders forbid publication.
SPEC = base.ReleaseSpec(
    {**base.PINNED_REQUEST,
     "version": "0.5.9", "tag": "v0.5.9", "source_ref": "release/v0.5.9",
     "source_sha": "0000000000000000000000000000000000000000",
     "source_tree": "0000000000000000000000000000000000000000",
     "ci_run_id": 1, "ci_run_attempt": 1,
     "evidence_run_id": 1, "evidence_run_attempt": 1,
     "notes_path": ".github/release-requests/v0.5.9-notes.md",
     "notes_sha256": "0fd7dc4fa81839c375793ab8a3380ce15fee6e6e93e98caf7a10b207fef3990a"},
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
