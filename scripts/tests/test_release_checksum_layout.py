"""Exercise the workflow's checksum producers after a flat artifact download.

Only the actual hash producer and consumer shell lines are executed. Synthetic
payloads stand in for already-built installers; no build, signing or network
operation is involved.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/release-build.yml"
CASES = tuple(
    (platform, suffix)
    for platform, suffixes in (
        ("linux-x64", ("json", "deb", "rpm")),
        ("linux-arm64", ("json", "deb", "rpm")),
        ("darwin-x64", ("json", "pkg")),
        ("darwin-arm64", ("json", "pkg")),
    )
    for suffix in suffixes
)


def workflow_step(workflow: str, name: str) -> str:
    matches = re.findall(
        rf"^      - name: {re.escape(name)}\n(.*?)(?=^      - |\Z)",
        workflow,
        re.M | re.S,
    )
    if len(matches) != 1:
        raise AssertionError(f"expected exactly one workflow step: {name}")
    return matches[0]


def matching_line(block: str, *markers: str) -> str:
    matches = [line.strip() for line in block.splitlines() if all(marker in line for marker in markers)]
    if len(matches) != 1:
        raise AssertionError(f"expected one authoritative checksum command containing {markers!r}")
    return matches[0]


class ReleaseChecksumLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        missing = [command for command in ("bash", "sha256sum", "shasum") if not shutil.which(command)]
        if missing:
            raise unittest.SkipTest(f"checksum shell contract requires {', '.join(missing)}")
        workflow = WORKFLOW.read_text(encoding="utf-8")
        cls.producers = {}
        for family, step_name, command in (
            ("linux", "Build and package Linux installer in Ubuntu 22.04 native container", "sha256sum"),
            ("darwin", "Collect and package macOS installer", "shasum -a 256"),
        ):
            block = workflow_step(workflow, step_name)
            for kind, variable in (("source", "$source_name"), ("installer", "$filename")):
                cls.producers[family, kind] = matching_line(block, command, variable, ".sha256", ">")
        assembly = workflow_step(workflow, "Verify and assemble one release bundle")
        cls.consumers = {
            "source": matching_line(assembly, "sha256sum -c", "$platform.json.sha256"),
            "installer": matching_line(assembly, "sha256sum -c", "$installer.sha256"),
        }

    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)

    def run_shell(self, script: str, root: Path, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", "-euo", "pipefail", "-c", script],
            cwd=root,
            env=env,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=10,
        )

    def make_candidate(self, platform: str, suffix: str) -> tuple[Path, dict[str, str], str, str]:
        root = self.root / f"{platform}-{suffix}"
        dist = root / "dist"
        dist.mkdir(parents=True)
        kind = "source" if suffix == "json" else "installer"
        stem = "webcodex-source" if kind == "source" else "webcodex-unified"
        name = f"{stem}-v0.5.2-{platform}.{suffix}"
        payload = f"synthetic checksum fixture: {name}\n".encode("utf-8")
        (dist / name).write_bytes(payload)
        env = {
            "PATH": os.environ.get("PATH", os.defpath),
            "LC_ALL": "C",
            "VERSION": "0.5.2",
            "PLATFORM": platform,
            "platform": platform,
            "source_name": name,
            "filename": name,
            "installer": name,
        }
        produced = self.run_shell(self.producers[platform.split("-", 1)[0], kind], root, env)
        self.assertEqual(produced.returncode, 0, produced.stdout + produced.stderr)

        # upload-artifact roots these paths at dist; download-artifact merges
        # their basenames directly into candidate-input, without a dist folder.
        candidates = root / "candidate-input"
        candidates.mkdir()
        for path in dist.iterdir():
            shutil.copyfile(path, candidates / path.name)
        shutil.rmtree(dist)
        self.assertEqual({path.name for path in candidates.iterdir()}, {name, f"{name}.sha256"})
        self.assertEqual((candidates / name).read_bytes(), payload)
        self.verify(root, env, kind, expected_success=True)
        self.assertEqual(
            (candidates / f"{name}.sha256").read_text(encoding="utf-8"),
            f"{hashlib.sha256(payload).hexdigest()}  {name}\n",
        )
        return root, env, kind, name

    def verify(self, root: Path, env: dict[str, str], kind: str, *, expected_success: bool) -> None:
        result = self.run_shell(self.consumers[kind], root, env)
        self.assertEqual(result.returncode == 0, expected_success, result.stdout + result.stderr)

    def test_actual_producer_sidecars_verify_after_artifact_flattening(self) -> None:
        for platform, suffix in CASES:
            with self.subTest(platform=platform, suffix=suffix):
                self.make_candidate(platform, suffix)

    def test_checksum_entry_filename_tampering_fails(self) -> None:
        for platform, suffix in CASES:
            with self.subTest(platform=platform, suffix=suffix):
                root, env, kind, name = self.make_candidate(platform, suffix)
                sidecar = root / "candidate-input" / f"{name}.sha256"
                sidecar.write_text(sidecar.read_text(encoding="utf-8").replace(name, f"wrong-{name}"), encoding="utf-8")
                self.verify(root, env, kind, expected_success=False)

    def test_checksum_digest_tampering_fails(self) -> None:
        for platform, suffix in CASES:
            with self.subTest(platform=platform, suffix=suffix):
                root, env, kind, name = self.make_candidate(platform, suffix)
                sidecar = root / "candidate-input" / f"{name}.sha256"
                original = sidecar.read_text(encoding="utf-8")
                changed = ("1" if original[0] == "0" else "0") + original[1:]
                sidecar.write_text(changed, encoding="utf-8")
                self.verify(root, env, kind, expected_success=False)

    def test_payload_tampering_fails(self) -> None:
        for platform, suffix in CASES:
            with self.subTest(platform=platform, suffix=suffix):
                root, env, kind, name = self.make_candidate(platform, suffix)
                payload = root / "candidate-input" / name
                payload.write_bytes(payload.read_bytes() + b"tampered")
                self.verify(root, env, kind, expected_success=False)

    def test_old_dist_prefix_is_rejected(self) -> None:
        for platform, suffix in CASES:
            with self.subTest(platform=platform, suffix=suffix):
                root, env, kind, name = self.make_candidate(platform, suffix)
                sidecar = root / "candidate-input" / f"{name}.sha256"
                sidecar.write_text(sidecar.read_text(encoding="utf-8").replace(name, f"dist/{name}"), encoding="utf-8")
                self.verify(root, env, kind, expected_success=False)


if __name__ == "__main__":
    unittest.main()
