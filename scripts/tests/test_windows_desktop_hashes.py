"""Execute the actual installed-program capture and strict PowerShell digest gate."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from scripts.tests.test_verify_public_release import synthetic_pe


class DesktopCaptureOrderingTests(unittest.TestCase):
    def test_capture_requires_validated_payload_and_keeps_uninstall_finally(self):
        source = (Path(__file__).resolve().parents[1] / "desktop_install_windows_smoke.ps1").read_text()
        main = source.split("$installedDir = $null", 1)[1]
        capture = main.index("Export-InstalledPrograms $installedDir $CaptureDirectory")
        self.assertEqual(main.count("Export-InstalledPrograms $installedDir $CaptureDirectory"), 1)
        self.assertLess(main.index("$actualDesktopMachine = Get-PeMachine $desktopExe"), capture)
        self.assertLess(main.index('throw "unexpected installed $name.exe identity:'), capture)
        self.assertLess(main.index("Assert-ExpectedProgramHashes $installedDir $expectedHashes"), capture)
        self.assertLess(capture, main.index("} finally {"))
        self.assertIn('Start-Process -FilePath $uninstaller -ArgumentList "/S _?=$installedDir"', main)
        self.assertIn("Desktop install directory remained after deterministic uninstall cleanup", main)
        preflight = source.split("$expectedHashes = Read-ExpectedProgramHashes", 1)[1]
        self.assertLess(preflight.index("$CaptureDirectory = Assert-NewCaptureDirectory $CaptureDirectory"),
                        preflight.index("$installedDir = $null"))
        self.assertIn("if (-not $requestedInstallDir -or $PreviousInstaller)", preflight)


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
        self.harness.write_text('''param($Source, $Hashes, $Installed, $CaptureDirectory, $MutateCaptureSource)
$ErrorActionPreference = "Stop"
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($Source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw "PowerShell source does not parse" }
foreach ($name in @("Resolve-InputPath", "Read-ExpectedProgramHashes", "Get-InstalledProgramPaths",
                    "Assert-ExpectedProgramHashes", "Assert-NewCaptureDirectory", "Export-InstalledPrograms")) {
  $node = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name }, $true)
  if ($null -eq $node) { throw "Missing actual digest gate" }
  . ([scriptblock]::Create($node.Extent.Text))
}
if ($CaptureDirectory) {
  if ($MutateCaptureSource) {
    $script:mutated = $false
    function Get-FileHash($LiteralPath, $Algorithm) {
      $result = Microsoft.PowerShell.Utility\\Get-FileHash -LiteralPath $LiteralPath -Algorithm $Algorithm
      if (-not $script:mutated -and $LiteralPath -ceq $MutateCaptureSource) {
        # Change only this owned fixture, after its first real digest. The actual
        # exporter must detect that its copied bytes no longer match that digest.
        [IO.File]::AppendAllText($LiteralPath, "changed during capture")
        $script:mutated = $true
      }
      return $result
    }
  }
  Export-InstalledPrograms $Installed $CaptureDirectory
  exit 0
}
$expected = Read-ExpectedProgramHashes $Hashes
Assert-ExpectedProgramHashes $Installed $expected
''')

    def execute(self, *extra):
        source = Path(__file__).resolve().parents[1] / "desktop_install_windows_smoke.ps1"
        return subprocess.run([shutil.which("pwsh"), "-NoLogo", "-NoProfile", "-NonInteractive", "-File", str(self.harness),
                               "-Source", str(source), "-Hashes", str(self.hashes), "-Installed", str(self.installed), *extra],
                              stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)

    def test_four_actual_candidate_hashes_pass(self):
        self.assertEqual(self.execute().returncode, 0)

    def test_each_same_architecture_changed_program_fails_before_uninstall(self):
        for name, relative in self.paths.items():
            with self.subTest(program=name):
                program = self.installed / relative
                original = program.read_bytes()
                try:
                    program.write_bytes(synthetic_pe(0x8664) + name.encode() + b"different build")
                    result = self.execute()
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(f"installed {name} bytes differ".encode(), result.stderr)
                    self.assertTrue(program.exists())
                finally:
                    program.write_bytes(original)

    def test_missing_extra_duplicate_or_oversized_identity_rejected(self):
        good = self.hashes.read_text()
        for invalid in ("{}", good.replace('"webcodex":', '"other":'),
                        good[:-1] + ', "webcodex": "' + "a" * 64 + '"}', " " * 4097 + good):
            self.hashes.write_text(invalid)
            with self.subTest(invalid=invalid[:40]):
                self.assertNotEqual(self.execute().returncode, 0)

    def test_capture_exports_only_the_four_actual_installed_programs(self):
        capture = self.root / "Captured Programs"
        (self.installed / "uninstall.exe").write_bytes(b"not a managed program")
        (self.installed / "private-state.json").write_bytes(b"not an installer input")
        expected = {relative: (self.installed / relative).read_bytes() for relative in self.paths.values()}
        result = self.execute("-CaptureDirectory", str(capture))
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
        actual = {path.relative_to(capture).as_posix(): path.read_bytes()
                  for path in capture.rglob("*") if path.is_file()}
        self.assertEqual(actual, expected)
        for relative, content in expected.items():
            self.assertEqual((self.installed / relative).read_bytes(), content)

    def test_capture_refuses_existing_output_without_merging_or_deleting(self):
        capture = self.root / "Already Exists"
        capture.mkdir()
        sentinel = capture / "existing.txt"
        sentinel.write_bytes(b"keep existing output")
        result = self.execute("-CaptureDirectory", str(capture))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"output already exists", result.stderr)
        self.assertEqual(list(capture.iterdir()), [sentinel])
        self.assertEqual(sentinel.read_bytes(), b"keep existing output")

    def test_capture_requires_all_four_files_before_creating_output(self):
        capture = self.root / "Missing Program"
        (self.installed / self.paths["webcodex-desktop"]).unlink()
        self.assertNotEqual(self.execute("-CaptureDirectory", str(capture)).returncode, 0)
        self.assertFalse(capture.exists())

    def test_capture_rejects_a_source_that_changes_after_its_digest(self):
        capture = self.root / "Changed Program"
        source = self.installed / self.paths["webcodex-desktop"]
        result = self.execute("-CaptureDirectory", str(capture), "-MutateCaptureSource", str(source))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"installed webcodex-desktop bytes changed during capture", result.stderr)

    def test_capture_rejects_reparse_programs(self):
        original = self.installed / self.paths["webcodex-desktop"]
        destination = self.root / "redirected.exe"
        original.rename(destination)
        try:
            original.symlink_to(destination)
        except OSError as exc:
            self.skipTest(f"symlink creation is unavailable for this owned fixture: {exc}")
        capture = self.root / "Reparse Program"
        result = self.execute("-CaptureDirectory", str(capture))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"capture requires a nonempty regular file", result.stderr)
        self.assertFalse(capture.exists())


if __name__ == "__main__":
    unittest.main()
