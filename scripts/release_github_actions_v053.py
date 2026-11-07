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
     'source_sha': 'bb8537c1a11bd73a2c09e319d30ad0d08e530bec',
     'source_tree': '6a11ac4fa6886331f7744f642c891bef4f66a407',
     'ci_run_id': 42392395019,
     'ci_run_attempt': 1,
     'evidence_run_id': 42392395089,
     'evidence_run_attempt': 1,
     'github_only': True,
     'include_unified_installers': True,
     'include_runtime_installers': False,
     'notes_path': '.github/release-requests/v0.5.3-notes.md',
     'notes_sha256': '630af199afb78d16d1b0bded7599b6f0c0ae6a514f5ed11ea3d6624c748bfa0c'},
    ".github/release-requests/v0.5.3.json",
    ".github/workflows/release-publish-v053.yml",
)


if __name__ == "__main__":
    raise SystemExit(main(spec=SPEC))
