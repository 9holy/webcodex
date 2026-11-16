#!/usr/bin/env python3
"""Fixed Windows v0.5.10 authority using the reviewed staged publication gates.

Only this entry's source/proof pins may change during finalization. The request
cannot select another source, workflow, asset scope, or acceptance policy.
"""
from __future__ import annotations

from pathlib import Path
import sys

if __package__:
    from . import release_github_actions as base
    from . import release_github_actions_v058 as staged
else:
    # Preserve one validation error class across the script and shared worker.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scripts import release_github_actions as base
    from scripts import release_github_actions_v058 as staged


# Final source and successful proof attempts must be fixed in reviewed control
# code. Unfinished or mismatched requests still forbid publication.
SPEC = base.ReleaseSpec(
    {**base.PINNED_REQUEST,
     "version": "0.5.10", "tag": "v0.5.10", "source_ref": "release/v0.5.10",
     "platform_scope": "windows",
     "source_sha": "0000000000000000000000000000000000000000",
     "source_tree": "0000000000000000000000000000000000000000",
     "ci_run_id": 1, "ci_run_attempt": 1,
     "evidence_run_id": 1, "evidence_run_attempt": 1,
     "notes_path": ".github/release-requests/v0.5.10-notes.md",
     "notes_sha256": "4ce754d303a32a0e7f7b301bb0051462b9d5bdcb5f2865e3cf3bf41de7d71c23"},
    ".github/release-requests/v0.5.10.json",
    ".github/workflows/release-publish-v0510.yml",
)


def require_finalized(spec: base.ReleaseSpec) -> None:
    request = spec.pinned_request
    base._require(
        request["version"] == "0.5.10" and request["tag"] == "v0.5.10"
        and request["source_ref"] == "release/v0.5.10"
        and spec.request_path == ".github/release-requests/v0.5.10.json"
        and spec.workflow_path == ".github/workflows/release-publish-v0510.yml"
        and spec.platform_scope == "windows"
        and request["source_sha"] != "0" * 40 and request["source_tree"] != "0" * 40
        and request["ci_run_id"] > 1 and request["evidence_run_id"] > 1,
        "v0.5.10 固定源码或成功验收 pins 尚未完成审核；不执行任何发布操作。",
    )


class StagedController(staged.StagedController):
    def run(self, stage: str, wait_secs: int = 0) -> int:
        require_finalized(self.spec)
        # Replace only the v0.5.8 entry guard. The original dispatcher still
        # authenticates, locks, restores and validates source. All Windows scope,
        # acceptance, promotion and latest-preservation methods remain inherited.
        return base.Controller.run(self, stage, wait_secs)


if __name__ == "__main__":
    raise SystemExit(base.main(spec=SPEC, controller_type=StagedController))
