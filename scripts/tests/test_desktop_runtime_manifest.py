from __future__ import annotations
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import sys

SCRIPT = Path(__file__).resolve().parents[1] / "desktop_runtime_manifest.py"
spec = importlib.util.spec_from_file_location("desktop_runtime_manifest", SCRIPT)
manifest = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = manifest
spec.loader.exec_module(manifest)

class DesktopRuntimeManifestTests(unittest.TestCase):
    def builds(self, ranges=((1, 2), (1, 3), (2, 4))):
        return [{"schema_version": 1, "binary": name, "version": "0.5.0", "git_commit": str(index) * 12, "git_dirty": False,
                 "desktop_runtime_contract": {"min_generation": pair[0], "max_generation": pair[1]}, "future_field": True}
                for index, (name, pair) in enumerate(zip(manifest.BINARIES, ranges))]

    def test_manifest_uses_advertised_common_range_not_a_copied_generation(self):
        value = manifest.from_builds(self.builds(), "0.5.0")
        self.assertEqual(value["desktop_runtime_contract"], {"min_generation": 2, "max_generation": 2})

    def test_different_source_revisions_are_not_a_contract_failure(self):
        self.assertEqual(manifest.from_builds(self.builds(), "0.5.0")["runtime_version"], "0.5.0")

    def test_disjoint_or_invalid_ranges_fail_release_validation(self):
        for ranges in [((1, 1), (2, 2), (2, 2)), ((0, 1), (1, 1), (1, 1)), ((3, 1), (1, 1), (1, 1))]:
            with self.subTest(ranges=ranges), self.assertRaises(manifest.ManifestError):
                manifest.from_builds(self.builds(ranges), "0.5.0")

    def test_unknown_schema_wrong_binary_and_wrong_official_release_version_fail(self):
        for key, value in [("schema_version", 2), ("binary", "wrong"), ("version", "0.6.0")]:
            builds = self.builds(); builds[0][key] = value
            with self.subTest(key=key), self.assertRaises(manifest.ManifestError):
                manifest.from_builds(builds, "0.5.0")

    def test_additive_fields_are_accepted_but_missing_fields_not_inferred(self):
        value = manifest.from_builds(self.builds(), "0.5.0")
        value["future_field"] = "ignored"
        self.assertEqual(manifest.validate(value, "0.5.0")["schema_version"], 1)
        del value["desktop_runtime_contract"]
        with self.assertRaises(manifest.ManifestError): manifest.validate(value, "0.5.0")

    def test_booleans_are_not_numeric_generations(self):
        with self.assertRaises(manifest.ManifestError): manifest.contract({"min_generation": True, "max_generation": 1})


@unittest.skipUnless(os.name == "nt" and shutil.which("powershell.exe"), "native Windows PowerShell fixture")
class WindowsDesktopBundleTests(unittest.TestCase):
    bridge_names = ("bridge.mjs", "acp-proxy.mjs", "tools.json", "install.ps1", "README.md", "README.zh-CN.md")
    source_sha = "a" * 40
    built_at = 1700000000

    @classmethod
    def setUpClass(cls):
        # Let Windows PowerShell resolve its own modules when invoked from PowerShell 7.
        cls.native_env = {key: value for key, value in os.environ.items() if key.upper() != "PSMODULEPATH"}
        cls.compiler_temp = tempfile.TemporaryDirectory(prefix="webcodex-bundle-exe-")
        cls.addClassCleanup(cls.compiler_temp.cleanup)
        cls.fixture_exe = Path(cls.compiler_temp.name) / "fixture.exe"
        code = ('using System; using System.IO; class Fixture { static void Main() { '
                'Console.WriteLine(Path.GetFileNameWithoutExtension(Environment.GetCommandLineArgs()[0]) + '
                f'" 0.5.1 (commit {cls.source_sha}, dirty=false, built_at={cls.built_at})");' + ' } }')
        subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
                        "Add-Type -ErrorAction Stop -TypeDefinition '" + code + "' -OutputType ConsoleApplication -OutputAssembly '"
                        + str(cls.fixture_exe).replace("'", "''") + "'"],
                       check=True, capture_output=True, text=True, timeout=45, env=cls.native_env)

    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="webcodex-desktop-bundle-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.script = self.root / "scripts" / "prepare_desktop_bundle.ps1"
        self.script.parent.mkdir()
        shutil.copyfile(SCRIPT.with_name("prepare_desktop_bundle.ps1"), self.script)
        self.bridge = self.root / "integrations" / "codex" / "live-chat-bridge"
        self.bridge.mkdir(parents=True)
        original = SCRIPT.parent.parent / "integrations" / "codex" / "live-chat-bridge"
        for name in self.bridge_names:
            shutil.copyfile(original / name, self.bridge / name)
        for name in ("config.json", "bridge-token", "verification.json", "test-bridge.mjs"):
            (self.bridge / name).write_text("fixture-only excluded content", encoding="utf-8")
        self.bin_dir = self.root / "bin"
        self.bin_dir.mkdir()
        for name in manifest.BINARIES:
            shutil.copyfile(self.fixture_exe, self.bin_dir / f"{name}.exe")
        self.output = self.root / "staged"

    def stage(self, *, corrupt=False):
        quote = lambda value: "'" + str(value).replace("'", "''") + "'"
        command = ""
        if corrupt:
            command = ("function Copy-Item { param($LiteralPath, $Destination) "
                       "Microsoft.PowerShell.Management\\Copy-Item -LiteralPath $LiteralPath -Destination $Destination; "
                       "if ($LiteralPath.EndsWith('bridge.mjs')) { [IO.File]::AppendAllText($Destination, 'changed') } }; ")
        command += (f"& {quote(self.script)} -BinDir {quote(self.bin_dir)} -Version 0.5.1 "
                    f"-SourceSha {self.source_sha} -BuiltAt {self.built_at} -OutputDir {quote(self.output)}")
        return subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
                              capture_output=True, text=True, timeout=45, env=self.native_env)

    def test_stages_only_public_bridge_files_and_preserves_runtime_metadata(self):
        result = self.stage()
        self.assertEqual(result.returncode, 0, result.stderr)
        overlay = json.loads((self.output / "tauri.bundle.conf.json").read_text(encoding="utf-8"))
        resources = overlay["bundle"]["resources"]
        expected = {f"webcodex-runtime/{name}.exe" for name in manifest.BINARIES}
        expected.update(f"codex-live-chat-bridge/{name}" for name in self.bridge_names)
        self.assertEqual(set(resources.values()), expected)
        self.assertEqual(len(resources), 9)
        for source, destination in resources.items():
            original = self.bridge / Path(destination).name if destination.startswith("codex-live-chat-bridge/") else self.bin_dir / Path(destination).name
            self.assertEqual(Path(source).read_bytes(), original.read_bytes())
        bundled = self.output / "resources" / "codex-live-chat-bridge"
        self.assertEqual({item.name for item in bundled.iterdir()}, set(self.bridge_names))
        metadata = json.loads((self.output / "desktop-bundle.json").read_text(encoding="utf-8"))
        self.assertEqual(metadata, {
            "schema_version": 1, "version": "0.5.1", "source_sha": self.source_sha, "built_at": self.built_at,
            "resource_dir": "resources/webcodex-runtime", "files": {
                name: {"filename": f"{name}.exe", "size": self.fixture_exe.stat().st_size,
                       "sha256": hashlib.sha256(self.fixture_exe.read_bytes()).hexdigest()}
                for name in manifest.BINARIES},
        })

    def test_missing_bridge_component_removes_incomplete_bundle(self):
        (self.bridge / "README.zh-CN.md").unlink()
        result = self.stage()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing Desktop chat bridge file", result.stderr)
        self.assertFalse(self.output.exists())

    def test_bridge_copy_corruption_removes_incomplete_bundle(self):
        result = self.stage(corrupt=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("staged Desktop chat bridge byte verification failed", result.stderr)
        self.assertFalse(self.output.exists())

    def test_reparse_bridge_source_is_rejected(self):
        source = self.bridge / "bridge.mjs"
        source.unlink()
        try:
            source.symlink_to(self.bridge / "acp-proxy.mjs")
        except OSError as error:
            self.skipTest(f"Windows symbolic-link privilege unavailable: {error.winerror}")
        result = self.stage()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("regular non-reparse file", result.stderr)
        self.assertFalse(self.output.exists())

if __name__ == "__main__": unittest.main()
