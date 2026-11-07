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
     'source_sha': '883fe91ec125440a689827eb8857d04718331461',
     'source_tree': '708ea772a4d1df97b8cdd5b1077d60772d209fa3',
     'ci_run_id': 42408904129,
     'ci_run_attempt': 1,
     'evidence_run_id': 42408904243,
     'evidence_run_attempt': 1,
     'github_only': True,
     'include_unified_installers': True,
     'include_runtime_installers': False,
     'notes_path': '.github/release-requests/v0.5.3-notes.md',
     'notes_sha256': 'd96534ea9a9b5fe9c97a3453a7db947d470ccb3202c79c78cd4868bce24bc5a8'},
    ".github/release-requests/v0.5.3.json",
    ".github/workflows/release-publish-v053.yml",
)


if __name__ == "__main__":
    raise SystemExit(main(spec=SPEC))
