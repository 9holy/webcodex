"""Packaged adapter is deterministic, complete, and independently executable."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("package_codex_adapter", ROOT / "scripts/package_codex_app_server_adapter.py")
PACKAGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGE)


class CodexAdapterPackageTests(unittest.TestCase):
    def test_deterministic_zipapp_contains_only_runtime_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            first = PACKAGE.package(Path(directory, "first.pyz"))
            second = PACKAGE.package(Path(directory, "second.pyz"))
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with zipfile.ZipFile(first) as archive:
                self.assertEqual(set(archive.namelist()), set(PACKAGE.FILES))
                for name in PACKAGE.FILES:
                    self.assertEqual(archive.read(name), (PACKAGE.SOURCE / name).read_bytes())
            run = subprocess.run([sys.executable, str(first), "--help"], cwd=directory,
                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertIn(b"prepare", run.stdout)
            self.assertIn(b"serve", run.stdout)

    def test_packaged_prepare_emits_packaged_runtime_entry(self):
        import json
        with tempfile.TemporaryDirectory(prefix="webcodex-安装-") as directory:
            package = PACKAGE.package(Path(directory, "codex-adapter.pyz"))
            receipt = Path(directory, "receipt.json")
            fixture = ROOT / "integrations/codex_app_server/tests/fake_codex.py"
            run = subprocess.run([sys.executable, str(package), "prepare", "--experimental",
                "--codex-bin", sys.executable, "--codex-arg", str(fixture), "--receipt", str(receipt)],
                cwd=directory, env=dict(os.environ, PYTHONIOENCODING="ascii"),
                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
            self.assertEqual(run.returncode, 0, run.stderr)
            result = json.loads(run.stdout)
            self.assertEqual(result["profile"]["args"][0], str(package))
            self.assertEqual(result["status"], "ready")
            self.assertTrue(receipt.is_file())


if __name__ == "__main__":
    unittest.main()
