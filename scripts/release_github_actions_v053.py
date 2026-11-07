#!/usr/bin/env python3
"""Fixed, reviewed v0.5.3 publication authority for 9holy/webcodex.

The request must match these code-owned facts. It cannot select a different
source, proof, destination, workflow, installer set or release body.
"""

from __future__ import annotations

if __package__:
    from .release_github_actions import ReleaseSpec, main
else:
    from release_github_actions import ReleaseSpec, main


SPEC = ReleaseSpec(
    {'schema_version': 1,
     'repo': '9holy/webcodex',
     'repo_id': 1404596174,
     'owner': '9holy',
     'owner_id': 45361924,
     'version': '0.5.3',
     'tag': 'v0.5.3',
     'source_ref': 'release/v0.5.3',
     'source_sha': '7c92dba432971a2a38421b36901c56b734f5a862',
     'source_tree': '9683cffea61582381a29f57b38007ba9c35de62d',
     'ci_run_id': 42395691579,
     'ci_run_attempt': 1,
     'evidence_run_id': 42395691569,
     'evidence_run_attempt': 1,
     'github_only': True,
     'include_unified_installers': True,
     'include_runtime_installers': False,
     'notes_path': '.github/release-requests/v0.5.3-notes.md',
     'notes_sha256': '7a2df7bde160c04adc59d7f06bc3e8612a8ffc3ee2a1b8960a32046cd25871b2'},
    ".github/release-requests/v0.5.3.json",
    ".github/workflows/release-publish-v053.yml",
)


if __name__ == "__main__":
    raise SystemExit(main(spec=SPEC))
