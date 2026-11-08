"""Compile and execute the actual NSIS control flow in disposable Windows fixtures.

No real installation, service or user PATH is modified. Production registry
references are redirected to one UUID key; lifecycle executables are fixtures.
Native Environment tests separately own service/receipt correctness.
"""
from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock
import uuid

from scripts.tests import test_prepare_windows_unified_installer as fixtures

bootstrap = fixtures.bootstrap
UNINSTALL_KEY = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\WebCodex Desktop"


def nsis_compiler() -> Path | None:
    located = shutil.which("makensis")
    candidates = [Path(located)] if located else []
    for variable, relative in (
        ("LOCALAPPDATA", "tauri/NSIS/makensis.exe"),
        ("ProgramFiles(x86)", "NSIS/makensis.exe"),
        ("ProgramFiles", "NSIS/makensis.exe"),
    ):
        if os.environ.get(variable):
            candidates.append(Path(os.environ[variable]) / relative)
    return next((path for path in candidates if path.is_file()), None)


@unittest.skipUnless(os.name == "nt", "requires native Windows NSIS")
class WindowsInstallerNativeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.compiler = nsis_compiler()
        if cls.compiler is None:
            if os.environ.get("WEBCODEX_REQUIRE_NSIS_TESTS") == "1":
                raise AssertionError("NSIS compiler is required by the Windows installer gate")
            raise unittest.SkipTest("NSIS is installed by the Desktop packaging lane")
        cls.shared = tempfile.TemporaryDirectory(prefix="webcodex-nsis-compiler-")
        cls.addClassCleanup(cls.shared.cleanup)
        cls.program = Path(cls.shared.name) / "coordinator.exe"
        source = Path(cls.shared.name) / "coordinator.cs"
        source.write_text(r'''
using System;
using System.IO;
using System.Reflection;
class Coordinator {
    static int Main(string[] args) {
        string log = Environment.GetEnvironmentVariable("WEBCODEX_NSIS_FIXTURE_LOG");
        string installed = Environment.GetEnvironmentVariable("WEBCODEX_NSIS_FIXTURE_OLD_CLI");
        bool old = String.Equals(Assembly.GetExecutingAssembly().Location, installed,
                                 StringComparison.OrdinalIgnoreCase);
        string action = args.Length > 1 ? args[1] : "missing";
        File.AppendAllText(log, (old ? "old:" : "candidate:") + action + "\n");
        if (old) return 71; // Published upstream rejects the fork's candidate.
        if (action == "installer-classify") {
            string failure = Environment.GetEnvironmentVariable("WEBCODEX_NSIS_FIXTURE_CLASSIFY_ERROR");
            if (!String.IsNullOrEmpty(failure)) {
                Console.Error.WriteLine(failure); return 79;
            }
            Console.WriteLine("{\"kind\":\"environment\"}"); return 0;
        }
        if (action == "installer-verify-same") return 1;
        if (action == "upgrade-preflight" || action == "upgrade-prepare" ||
            action == "installer-verify" || action == "upgrade-finish" ||
            action == "upgrade-rollback") return 0;
        return 72;
    }
}
''', encoding="utf-8")
        script = Path(cls.shared.name) / "compile.ps1"
        script.write_text(
            "param([string]$Source,[string]$Output)\n"
            "$ErrorActionPreference='Stop'\n"
            "$provider = New-Object Microsoft.CSharp.CSharpCodeProvider\n"
            "$parameters = New-Object System.CodeDom.Compiler.CompilerParameters\n"
            "$parameters.GenerateExecutable = $true\n"
            "$parameters.OutputAssembly = $Output\n"
            "$parameters.CompilerOptions = '/platform:x64'\n"
            "$null = $parameters.ReferencedAssemblies.Add('System.dll')\n"
            "$result = $provider.CompileAssemblyFromSource($parameters, [IO.File]::ReadAllText($Source))\n"
            "if ($result.Errors.HasErrors) { throw 'Could not compile the installer coordinator fixture' }\n",
            encoding="utf-8",
        )
        powershell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
        result = subprocess.run(
            [str(powershell), "-NoProfile", "-NonInteractive", "-File", str(script), str(source), str(cls.program)],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60,
        )
        if result.returncode:
            raise AssertionError(f"fixture compiler failed: {result.stderr!r}")

    def setUp(self):
        import winreg
        self.winreg = winreg
        directory = tempfile.TemporaryDirectory(prefix="webcodex-nsis-test-")
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.key = rf"Software\WebCodexInstallerTest-{uuid.uuid4().hex}"
        self.addCleanup(self.remove_registry)
        self.selection = self.root / "selection.txt"
        self.log = self.root / "lifecycle.log"
        self.old_cli = self.root / "upstream" / "webcodex-runtime" / "webcodex.exe"
        self.env = {
            **os.environ,
            "WEBCODEX_NSIS_FIXTURE_LOG": str(self.log),
            "WEBCODEX_NSIS_FIXTURE_OLD_CLI": str(self.old_cli),
        }
        self.candidate = self.root / "candidate"
        infos = fixtures.WindowsUnifiedNsisTests().fixture(
            self.candidate, binary_bytes=self.program.read_bytes(),
        )
        self.inner = self.root / "inner.exe"
        self.compile(
            'Unicode true\nRequestExecutionLevel user\n'
            f'OutFile {bootstrap.nsis_quote(self.inner)}\n'
            'Section\n  SetOutPath "$INSTDIR"\n'
            '  FileOpen $0 "$INSTDIR\\candidate-installed.txt" w\n'
            '  FileWrite $0 "candidate"\n  FileClose $0\nSectionEnd\n',
            "inner",
        )
        self.outer = self.root / "outer.exe"
        with mock.patch.dict(os.environ, fixtures.CI_CONTEXT), \
             mock.patch.object(fixtures.nsis.collector, "probe", side_effect=lambda path, name: infos[name]):
            self.source = bootstrap.render(self.candidate, self.inner, self.outer, "win32-x64")
        self.source = self.source.replace(UNINSTALL_KEY, self.key)
        self.source = self.source.replace('HKCU "Environment"', f'HKCU "{self.key}\\Environment"')
        # Silent installers have no console diagnostics. Keep this trace in the
        # generated test executable only, after the failing branch is selected,
        # without changing any production decisions or their exit codes.
        traced = []
        for number, line in enumerate(self.source.splitlines(), 1):
            if line.strip() == "SetErrorLevel 1":
                traced.extend([
                    '  FileOpen $R9 "$EXEDIR\\fixture-failure.txt" a',
                    f'  FileWriteUTF16LE $R9 "nsis_line={number} instdir=[$INSTDIR] registered=[$WebCodexRegisteredDir] api_result=[$0] classify_code=[$WebCodexClassificationCode]$\\r$\\n"',
                    '  FileClose $R9',
                ])
            traced.append(line)
        self.source = "\n".join(traced) + "\n"

    def remove_registry(self):
        # Only keys created by this fixture; never recurse into a real product key.
        for suffix in ("\\Environment", ""):
            try:
                self.winreg.DeleteKeyEx(self.winreg.HKEY_CURRENT_USER, self.key + suffix,
                                       self.winreg.KEY_WOW64_64KEY)
            except FileNotFoundError:
                pass

    def register(self, directory: Path):
        with self.winreg.CreateKeyEx(self.winreg.HKEY_CURRENT_USER, self.key, 0,
                                    self.winreg.KEY_WRITE | self.winreg.KEY_WOW64_64KEY) as key:
            self.winreg.SetValueEx(key, "InstallLocation", 0, self.winreg.REG_SZ, f'"{directory}"')

    def compile(self, source: str, name: str):
        path = self.root / f"{name}.nsi"
        path.write_text(source, encoding="utf-8-sig")
        result = subprocess.run(
            [str(self.compiler), "/V3", str(path)], stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60,
        )
        self.assertEqual(result.returncode, 0, msg=result.stdout.decode(errors="replace") + result.stderr.decode(errors="replace"))

    def run_installer(self, executable: Path, destination: Path | None = None):
        # NSIS /D= consumes the unquoted remainder of the native command line.
        command = f'"{executable}" /S'
        if destination is not None:
            command += f" /D={destination}"
        result = subprocess.run(
            command, executable=str(executable), env=self.env,
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30,
        )
        diagnostic = self.root / "fixture-failure.txt"
        if result.returncode and diagnostic.exists():
            print("NSIS fixture diagnostic: " + diagnostic.read_text(encoding="utf-16le").strip(), flush=True)
        return result

    def compile_directory_probe(self):
        header = self.source.split('Section "-WebCodexUnifiedBootstrap"', 1)[0]
        self.compile(header + (
            'Function WebCodexUserAbort\nFunctionEnd\n'
            'Section\n  Call WebCodexValidateInstallDir\n'
            '  FileOpen $0 "$EXEDIR\\selection.txt" w\n'
            '  FileWriteUTF16LE $0 "$WebCodexInstallDir"\n  FileClose $0\nSectionEnd\n'
        ), "directory")

    def test_fresh_install_honors_custom_directory_with_spaces(self):
        self.compile_directory_probe()
        destination = self.root / "Chosen folder with spaces"
        self.assertEqual(self.run_installer(self.outer, destination).returncode, 0)
        self.assertEqual(self.selection.read_text(encoding="utf-16le"), str(destination))

    def test_existing_quoted_upstream_location_is_reused_without_d_argument(self):
        self.register(self.old_cli.parent.parent)
        self.compile_directory_probe()
        self.assertEqual(self.run_installer(self.outer).returncode, 0)
        self.assertEqual(self.selection.read_text(encoding="utf-16le"), str(self.old_cli.parent.parent))

    def test_conflicting_d_argument_is_rejected_before_installation(self):
        self.register(self.old_cli.parent.parent)
        self.compile_directory_probe()
        destination = self.root / "Unexpected second installation"
        self.assertNotEqual(self.run_installer(self.outer, destination).returncode, 0)
        self.assertFalse(self.selection.exists())
        self.assertFalse(destination.exists())

    def test_same_existing_directory_is_accepted_explicitly(self):
        self.register(self.old_cli.parent.parent)
        self.compile_directory_probe()
        self.assertEqual(self.run_installer(self.outer, self.old_cli.parent.parent).returncode, 0)

    def test_malformed_existing_path_is_rejected_before_any_command(self):
        self.register(Path(str(self.old_cli.parent.parent) + '"invalid'))
        self.compile_directory_probe()
        self.assertNotEqual(self.run_installer(self.outer).returncode, 0)
        self.assertFalse(self.selection.exists())
        self.assertFalse(self.log.exists())

    def test_configured_upstream_upgrade_uses_candidate_for_entire_transaction(self):
        self.old_cli.parent.mkdir(parents=True)
        shutil.copyfile(self.program, self.old_cli)
        shutil.copyfile(self.program, self.old_cli.parent.parent / "WebCodex.exe")
        self.register(self.old_cli.parent.parent)
        self.compile(self.source, "complete-outer")
        self.assertEqual(self.run_installer(self.outer).returncode, 0)
        self.assertEqual(self.log.read_text().splitlines(), [
            "candidate:installer-classify", "candidate:installer-verify-same",
            "candidate:upgrade-preflight", "candidate:upgrade-prepare",
            "candidate:installer-verify", "candidate:upgrade-finish",
        ])
        self.assertEqual((self.old_cli.parent.parent / "candidate-installed.txt").read_text(), "candidate")

    def test_classification_failure_keeps_bounded_diagnostic_and_stops_before_replacement(self):
        self.env["WEBCODEX_NSIS_FIXTURE_CLASSIFY_ERROR"] = "installer_owner: private-fixture-value"
        self.compile(self.source, "outer")
        destination = self.root / "existing"
        self.assertNotEqual(self.run_installer(self.outer, destination).returncode, 0)
        self.assertEqual(self.log.read_text().splitlines(), ["candidate:installer-classify"])
        self.assertFalse((destination / "candidate-installed.txt").exists())
        diagnostic = (self.root / "fixture-failure.txt").read_text(encoding="utf-16le")
        self.assertIn("classify_code=[installer_owner]", diagnostic)
        self.assertNotIn("private-fixture-value", diagnostic)

    def test_unknown_classification_failure_uses_fixed_generic_code(self):
        self.env["WEBCODEX_NSIS_FIXTURE_CLASSIFY_ERROR"] = "unrecognized-private-value: installer_owner:"
        self.compile(self.source, "outer")
        destination = self.root / "existing"
        self.assertNotEqual(self.run_installer(self.outer, destination).returncode, 0)
        self.assertEqual(self.log.read_text().splitlines(), ["candidate:installer-classify"])
        self.assertFalse((destination / "candidate-installed.txt").exists())
        diagnostic = (self.root / "fixture-failure.txt").read_text(encoding="utf-16le")
        self.assertIn("classify_code=[installer_classify_failed]", diagnostic)
        self.assertNotIn("unrecognized-private-value", diagnostic)

    def test_old_publisher_handoff_reproduces_upgrade_rejection(self):
        self.old_cli.parent.mkdir(parents=True)
        shutil.copyfile(self.program, self.old_cli)
        shutil.copyfile(self.program, self.old_cli.parent.parent / "WebCodex.exe")
        self.register(self.old_cli.parent.parent)
        # Change only the former handoff decision, keeping the real outer
        # preflight/abort sequence. This must fail before the inner installer.
        broken = self.source.replace(
            '  ${ElseIf} $1 == \'{"kind":"environment"}\'\n',
            '  ${ElseIf} $1 == \'{"kind":"environment"}\'\n'
            '    StrCpy $WebCodexTrustedCLI "$WebCodexInstallDir\\webcodex-runtime\\webcodex.exe"\n',
            1,
        )
        self.assertNotEqual(broken, self.source)
        self.compile(broken, "old-handoff")
        self.assertNotEqual(self.run_installer(self.outer).returncode, 0)
        self.assertIn("old:upgrade-preflight", self.log.read_text().splitlines())
        self.assertFalse((self.old_cli.parent.parent / "candidate-installed.txt").exists())

    def test_busy_exact_executable_blocks_without_killing_unrelated_same_name(self):
        selected = self.root / "selected" / "WebCodex.exe"
        other = self.root / "unrelated" / "WebCodex.exe"
        selected.parent.mkdir(); other.parent.mkdir()
        system_cmd = Path(os.environ["SystemRoot"]) / "System32/cmd.exe"
        shutil.copyfile(system_cmd, selected); shutil.copyfile(system_cmd, other)
        probe = self.root / "busy-probe.exe"
        self.compile(
            'Unicode true\nRequestExecutionLevel user\n!include "MUI2.nsh"\n'
            f'OutFile {bootstrap.nsis_quote(probe)}\n'
            f'!include {bootstrap.nsis_quote(bootstrap.INSTALLER_HOOKS)}\n'
            '!insertmacro MUI_LANGUAGE "English"\n!insertmacro MUI_LANGUAGE "SimpChinese"\n'
            f'Section\n!insertmacro WebCodexRequireStopped {bootstrap.nsis_quote(selected)}\nSectionEnd\n',
            "busy",
        )
        running = subprocess.Popen([str(other), "/D", "/C", "set /p fixture="],
                                   stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            self.assertEqual(self.run_installer(probe).returncode, 0)
            self.assertIsNone(running.poll(), "unrelated same-name executable was stopped")
            target = subprocess.Popen([str(selected), "/D", "/C", "set /p fixture="],
                                      stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                self.assertNotEqual(self.run_installer(probe).returncode, 0)
                self.assertIsNone(target.poll(), "installer killed the selected process")
                self.assertIsNone(running.poll(), "installer killed an unrelated process")
            finally:
                target.communicate(input=b"\n", timeout=10)
        finally:
            running.communicate(input=b"\n", timeout=10)

    def test_tauri_installer_and_uninstaller_expand_the_safe_replacement_macro(self):
        probe = self.root / "tauri-context.exe"
        self.compile(
            'Unicode true\nRequestExecutionLevel user\n!include "MUI2.nsh"\n'
            '!macro CheckIfAppIsRunning executableName productName\n'
            '!error "The default kill-by-name macro must be replaced"\n!macroend\n'
            f'!include {bootstrap.nsis_quote(bootstrap.INSTALLER_HOOKS)}\n'
            f'OutFile {bootstrap.nsis_quote(probe)}\n'
            '!insertmacro MUI_PAGE_INSTFILES\n!insertmacro MUI_UNPAGE_INSTFILES\n'
            '!insertmacro MUI_LANGUAGE "English"\n!insertmacro MUI_LANGUAGE "SimpChinese"\n'
            'Section\n!insertmacro CheckIfAppIsRunning "WebCodex.exe" "WebCodex Desktop"\n'
            'WriteUninstaller "$EXEDIR\\uninstall.exe"\nSectionEnd\n'
            'Section Uninstall\n!insertmacro CheckIfAppIsRunning "WebCodex.exe" "WebCodex Desktop"\nSectionEnd\n',
            "tauri-context",
        )
        self.assertEqual(self.run_installer(probe, self.root / "isolated empty directory").returncode, 0)


if __name__ == "__main__":
    unittest.main()
