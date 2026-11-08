"""Execute the actual PowerShell digest gate; a same-architecture old EXE fails."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from scripts.tests.test_verify_public_release import synthetic_pe


@unittest.skipUnless(shutil.which("pwsh"), "PowerShell 7 is required for the native digest gate")
class DesktopDigestExecutionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.installed = self.root / "Desktop"
        self.paths = {"webcodex": "webcodex-runtime/webcodex.exe",
                      "webcodex-server": "webcodex-runtime/webcodex-server.exe",
                      "webcodex-runner": "webcodex-runtime/webcodex-runner.exe", "webcodex-desktop": "WebCodex.exe"}
        hashes = {}
        for name, relative in self.paths.items():
            path = self.installed / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(synthetic_pe(0x8664) + name.encode() + b"candidate")
            hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        self.hashes = self.root / "hashes.json"
        self.hashes.write_text(json.dumps(hashes))
        self.harness = self.root / "check.ps1"
        self.harness.write_text('''param($Source, $Hashes, $Installed)
$ErrorActionPreference = "Stop"
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($Source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw "PowerShell source does not parse" }
foreach ($name in @("Read-ExpectedProgramHashes", "Assert-ExpectedProgramHashes")) {
  $node = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name }, $true)
  if ($null -eq $node) { throw "Missing actual digest gate" }
  . ([scriptblock]::Create($node.Extent.Text))
}
$expected = Read-ExpectedProgramHashes $Hashes
Assert-ExpectedProgramHashes $Installed $expected
''')

    def execute(self):
        source = Path(__file__).resolve().parents[1] / "desktop_install_windows_smoke.ps1"
        return subprocess.run([shutil.which("pwsh"), "-NoLogo", "-NoProfile", "-NonInteractive", "-File", str(self.harness),
                               "-Source", str(source), "-Hashes", str(self.hashes), "-Installed", str(self.installed)],
                              stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)

    def test_four_actual_candidate_hashes_pass(self):
        self.assertEqual(self.execute().returncode, 0)

    def test_same_architecture_old_desktop_fails_before_uninstall(self):
        desktop = self.installed / "WebCodex.exe"
        desktop.write_bytes(synthetic_pe(0x8664) + b"old Desktop same architecture")
        result = self.execute()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"webcodex-desktop", result.stderr)
        self.assertTrue(desktop.exists())

    def test_missing_extra_duplicate_or_oversized_identity_rejected(self):
        good = self.hashes.read_text()
        for invalid in ("{}", good.replace('"webcodex":', '"other":'),
                        good[:-1] + ', "webcodex": "' + "a" * 64 + '"}', " " * 4097 + good):
            self.hashes.write_text(invalid)
            with self.subTest(invalid=invalid[:40]):
                self.assertNotEqual(self.execute().returncode, 0)


if __name__ == "__main__":
    unittest.main()
