"""Windows discovery keeps the existing exact-command compatibility contract."""
import asyncio
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("codex_compatibility", ROOT / "compatibility.py")
compatibility = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(compatibility)
SCHEMA_SPEC = importlib.util.spec_from_file_location("codex_schema_fixture", ROOT / "tests/schema_fixture.py")
schema_fixture = importlib.util.module_from_spec(SCHEMA_SPEC)
SCHEMA_SPEC.loader.exec_module(schema_fixture)


class WindowsDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="codex-安装-space ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.prefix = self.root / "npm prefix"
        self.prefix.mkdir()
        self.shim = self.prefix / "codex.cmd"
        self.shim.write_text("This shell text must never run.\n", encoding="utf-8")
        self.package = self.prefix / "node_modules/@openai/codex"
        (self.package / "bin").mkdir(parents=True)
        self.metadata = self.package / "package.json"
        self.metadata.write_text(json.dumps({"name": "@openai/codex", "bin": {"codex": "bin/codex.js"}}))
        self.script = self.package / "bin/codex.js"
        self.script.write_bytes(b"// fixed Codex launcher fixture\n")
        self.node = self.root / "Node installation/node.exe"
        self.node.parent.mkdir()
        self.node.write_bytes(b"native Node fixture")
        self.native = self.root / "codex.exe"
        self.native.write_bytes(b"native Codex fixture")
        self.receipt = self.root / "receipt.json"
        self.paths = {"codex": str(self.shim), "node.exe": str(self.node)}
        for patch in (
            mock.patch.object(compatibility, "WINDOWS", True),
            mock.patch.object(compatibility.shutil, "which", side_effect=lambda name: self.paths.get(name)),
            mock.patch.dict(compatibility.os.environ, {
                "LOCALAPPDATA": str(self.root / "local"), "APPDATA": str(self.root / "roaming"),
            }),
        ):
            patch.start()
            self.addCleanup(patch.stop)
        self.probes = []

    def resolve(self, binary="codex", arguments=()):
        return compatibility.resolve_command(binary, list(arguments))

    def expected(self, *arguments):
        return [str(self.node.resolve()), str(self.script.resolve()), *arguments]

    def standalone(self):
        path = self.root / "local/Programs/OpenAI/Codex/bin/codex.exe"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"native standalone fixture")
        return path

    async def probe(self, command, **_):
        self.probes.append(command)
        self.assertEqual(command[:2], self.expected())
        if command[2:] == ["--version"]:
            return b"codex-cli 0.167.0-fixture.1\n"
        self.assertEqual(command[2:6], ["app-server", "generate-json-schema", "--experimental", "--out"])
        schema_fixture.write(command[6])
        return b""

    def prepare(self, **kwargs):
        with mock.patch.object(compatibility, "bounded_command", side_effect=self.probe):
            return asyncio.run(compatibility.prepare("codex", [], str(self.receipt), **kwargs))

    def test_path_npm_shim_becomes_fixed_native_node_and_absolute_script(self):
        with mock.patch.object(compatibility.asyncio, "create_subprocess_exec") as execute:
            self.assertEqual(self.resolve(arguments=["--config=fixture"]), self.expected("--config=fixture"))
            execute.assert_not_called()
        self.assertNotIn(str(self.shim), self.resolve())

    def test_explicit_cmd_and_powershell_shims_use_only_their_own_package(self):
        for name in ("codex.cmd", "codex.ps1"):
            with self.subTest(name=name):
                shim = self.prefix / name
                shim.write_text("private-shell-sentinel", encoding="utf-8")
                self.assertEqual(self.resolve(str(shim)), self.expected())

    def test_prefix_node_has_precedence_over_path_node(self):
        local = self.prefix / "node.exe"
        local.write_bytes(b"selected local Node")
        self.assertEqual(self.resolve(), [str(local.resolve()), str(self.script.resolve())])

    def test_native_executable_and_explicit_interpreter_arguments_are_preserved(self):
        self.paths["codex"] = str(self.native)
        self.assertEqual(self.resolve(arguments=["arg"] * 8), [str(self.native), *(["arg"] * 8)])
        self.assertEqual(self.resolve(str(self.node), [str(self.script)]), self.expected())

    def test_default_missing_path_checks_the_official_standalone_exe(self):
        self.paths.pop("codex")
        native = self.standalone()
        self.assertEqual(self.resolve(), [str(native.resolve())])

    def test_default_missing_path_checks_only_the_standard_roaming_npm_layout(self):
        self.paths.pop("codex")
        roaming = self.root / "roaming/npm"
        roaming.parent.mkdir()
        self.prefix.rename(roaming)
        self.prefix = roaming
        self.script = roaming / "node_modules/@openai/codex/bin/codex.js"
        self.assertEqual(self.resolve(), self.expected())

    def test_explicit_missing_path_or_name_never_falls_back_to_another_installation(self):
        self.standalone()
        for binary in (str(self.root / "missing/codex.exe"), "custom-codex"):
            with self.subTest(binary=binary):
                with self.assertRaisesRegex(compatibility.Failure, "^codex_not_found$"):
                    self.resolve(binary)

    def test_path_selected_broken_npm_installation_never_uses_standalone(self):
        self.standalone()
        self.script.unlink()
        with self.assertRaisesRegex(compatibility.Failure, "^codex_npm_layout_invalid$"):
            self.resolve()

    def test_unrecognized_wrapper_is_not_executed_or_retargeted(self):
        for name in ("other.cmd", "codex.bat"):
            with self.subTest(name=name):
                wrapper = self.prefix / name
                wrapper.write_bytes(b"shell must not run")
                with self.assertRaisesRegex(compatibility.Failure, "^codex_requires_native_executable$"):
                    self.resolve(str(wrapper))

    def test_package_identity_entrypoint_and_json_size_are_checked(self):
        invalid = [
            b'{"name":"other","bin":{"codex":"bin/codex.js"}}',
            b'{"name":"@openai/codex","bin":{"codex":"../../other.js"}}',
            b'{"name":"@openai/codex","name":"@openai/codex","bin":{"codex":"bin/codex.js"}}',
            b"{" + b" " * compatibility.MAX_NPM_PACKAGE,
            b"[]", b"{bad json}",
        ]
        for raw in invalid:
            with self.subTest(raw_size=len(raw)):
                self.metadata.write_bytes(raw)
                with self.assertRaisesRegex(compatibility.Failure, "^codex_npm_layout_invalid$"):
                    self.resolve()

    def test_missing_or_non_native_node_has_its_own_diagnostic(self):
        (self.root / "node.cmd").write_bytes(b"shell must not run")
        for node in (None, str(self.root / "node.cmd"), str(self.root / "missing.exe")):
            with self.subTest(node=node):
                self.paths["node.exe"] = node
                with self.assertRaisesRegex(compatibility.Failure, "^codex_node_not_found$"):
                    self.resolve()

    def test_canonical_node_target_must_still_be_native(self):
        target = self.root / "redirected.cmd"
        target.write_bytes(b"shell must not run")
        original = Path.resolve
        def redirected(path, *args, **kwargs):
            return target if path == self.node else original(path, *args, **kwargs)
        with mock.patch.object(Path, "resolve", redirected):
            with self.assertRaisesRegex(compatibility.Failure, "^codex_node_not_found$"):
                self.resolve()

    def test_path_resolution_races_permissions_and_loops_use_fixed_failures(self):
        original = Path.resolve
        for target, code in (
            (self.shim, "codex_not_found"),
            (self.script, "codex_npm_layout_invalid"),
            (self.node, "codex_node_not_found"),
        ):
            for error in (FileNotFoundError, PermissionError, RuntimeError):
                with self.subTest(component=target.name, error=error.__name__):
                    def unavailable(path, *args, **kwargs):
                        if path == target:
                            raise error("private-path-sentinel")
                        return original(path, *args, **kwargs)
                    with mock.patch.object(Path, "resolve", unavailable):
                        with self.assertRaises(compatibility.Failure) as raised:
                            self.resolve()
                    self.assertEqual(str(raised.exception), code)
                    self.assertNotIn("private-path-sentinel", str(raised.exception))

    def test_implicit_script_counts_toward_the_eight_argument_limit(self):
        self.assertEqual(len(self.resolve(arguments=["arg"] * 7)), 9)
        with self.assertRaisesRegex(compatibility.Failure, "^codex_launcher_arguments_invalid$"):
            self.resolve(arguments=["arg"] * 8)

    def test_non_windows_discovery_does_not_use_windows_fallbacks_or_shells(self):
        self.standalone()
        with mock.patch.object(compatibility, "WINDOWS", False):
            with self.assertRaisesRegex(compatibility.Failure, "^codex_requires_native_executable$"):
                self.resolve()
            self.paths.pop("codex")
            with self.assertRaisesRegex(compatibility.Failure, "^codex_not_found$"):
                self.resolve()

    def test_receipt_pins_both_files_and_keeps_the_resolved_command_after_path_changes(self):
        receipt = self.prepare()
        self.assertEqual(receipt["command"], self.expected())
        self.assertEqual(set(receipt["files_sha256"]), set(self.expected()))
        self.assertEqual(receipt["files_sha256"], compatibility.command_files(self.expected()))
        self.assertEqual(json.loads(self.receipt.read_bytes()), receipt)
        with mock.patch.object(compatibility.shutil, "which", side_effect=AssertionError("no rediscovery")), \
                mock.patch.object(compatibility, "bounded_command", side_effect=self.probe):
            verified = asyncio.run(compatibility.verify_receipt(str(self.receipt)))
        self.assertEqual(verified["command"], self.expected())
        self.assertTrue(all(command[:2] == self.expected() for command in self.probes))

    def test_changed_node_or_script_is_rejected_even_when_version_is_unchanged(self):
        self.prepare()
        for path in (self.node, self.script):
            with self.subTest(component=path.name):
                original = path.read_bytes()
                path.write_bytes(original + b"changed")
                try:
                    with mock.patch.object(compatibility, "bounded_command", side_effect=self.probe):
                        with self.assertRaisesRegex(compatibility.Failure, "^codex_binary_changed$"):
                            asyncio.run(compatibility.verify_receipt(str(self.receipt)))
                finally:
                    path.write_bytes(original)

    def test_discovered_installation_still_requires_the_requested_version(self):
        with self.assertRaisesRegex(compatibility.Failure, "^codex_version_mismatch$"):
            self.prepare(expected_version="999")
        self.assertEqual(len(self.probes), 1)
        self.assertFalse(self.receipt.exists())

    def test_incompatible_schema_preserves_the_existing_receipt(self):
        self.receipt.write_bytes(b"previous receipt")
        original_probe = self.probe
        async def incompatible(command, **kwargs):
            result = await original_probe(command, **kwargs)
            if "generate-json-schema" in command:
                schema_fixture.write(command[-1], "incompatible")
            return result
        with mock.patch.object(compatibility, "bounded_command", side_effect=incompatible):
            with self.assertRaisesRegex(compatibility.Failure, "^codex_schema_incompatible$"):
                asyncio.run(compatibility.prepare("codex", [], str(self.receipt)))
        self.assertEqual(self.receipt.read_bytes(), b"previous receipt")

    def test_launcher_change_during_schema_generation_prevents_receipt_publication(self):
        original_probe = self.probe
        async def changing(command, **kwargs):
            result = await original_probe(command, **kwargs)
            if "generate-json-schema" in command:
                self.script.write_bytes(b"replacement launcher")
            return result
        with mock.patch.object(compatibility, "bounded_command", side_effect=changing):
            with self.assertRaisesRegex(compatibility.Failure, "^codex_changed_during_prepare$"):
                asyncio.run(compatibility.prepare("codex", [], str(self.receipt)))
        self.assertFalse(self.receipt.exists())


if __name__ == "__main__":
    unittest.main()
