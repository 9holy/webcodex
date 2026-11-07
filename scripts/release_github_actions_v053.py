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
     'source_sha': '75be0577356469c0a31d2a1cf36703f8ec117f42',
     'source_tree': '4dfd86b0c3762459eaf1c4db17ed76b1dcf3c9d6',
     'ci_run_id': 42398644579,
     'ci_run_attempt': 1,
     'evidence_run_id': 42398644721,
     'evidence_run_attempt': 1,
     'github_only': True,
     'include_unified_installers': True,
     'include_runtime_installers': False,
     'notes_path': '.github/release-requests/v0.5.3-notes.md',
     'notes_sha256': '4cdf86e1c3d487cf7c3cf20803f8821fc071722260145b9b809bf68a9e02069f'},
    ".github/release-requests/v0.5.3.json",
    ".github/workflows/release-publish-v053.yml",
)


if __name__ == "__main__":
    raise SystemExit(main(spec=SPEC))
