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
     'source_sha': 'db9ac2d1d4a35549c6cdede9fe0f4db3f40210d4',
     'source_tree': '3147b7a84b17ed13303a945c62017d7e89b8f24a',
     'ci_run_id': 42396171237,
     'ci_run_attempt': 1,
     'evidence_run_id': 42396171186,
     'evidence_run_attempt': 1,
     'github_only': True,
     'include_unified_installers': True,
     'include_runtime_installers': False,
     'notes_path': '.github/release-requests/v0.5.3-notes.md',
     'notes_sha256': 'a4d43fcc95b2e29d9d1639ddf9af3f428d40893ed3a7b56b26a400431a1e8d1f'},
    ".github/release-requests/v0.5.3.json",
    ".github/workflows/release-publish-v053.yml",
)


if __name__ == "__main__":
    raise SystemExit(main(spec=SPEC))
