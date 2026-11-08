from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock
import warnings
import zipfile

from scripts import prepare_tauri_nsis_ci_tools as tools


class TauriNsisCiToolsTests(unittest.TestCase):
    def setUp(self):
        temporary = self.enterContext(tempfile.TemporaryDirectory())
        self.root = Path(temporary)
        self.parent = self.root / "tauri"
        self.project = self.root / "project"
        (self.project / "apps/desktop/src-tauri").mkdir(parents=True)
        self.write_project()
        self.enterContext(mock.patch.object(tools, "PROJECT_ROOT", self.project))
        self.contents = {name: ("fixture contents: " + name).encode()
                         for name in tools.REQUIRED_FILES if name != tools.PLUGIN}
        self.contents.update({"Contrib/Language files/English.nsh": b"whole ZIP member",
                              "Docs/LICENSE.txt": b"official archive fixture license"})
        self.plugin = b"separately pinned plugin fixture"
        self.assets = dict(tools.pinned.ASSETS)
        self.enterContext(mock.patch.object(tools.pinned, "ASSETS", self.assets))
        self.set_archive(self.make_archive())
        self.assets["tauri-nsis-utils"] = self.pin("tauri-nsis-utils", self.plugin)
        self.download = self.enterContext(mock.patch.object(tools.pinned, "download_asset", side_effect=self.copy_input))

    def write_project(self, version="2.11.4", bundle=None):
        lock = {"packages": {"node_modules/@tauri-apps/cli": {"version": version}}}
        (self.project / "apps/desktop/package-lock.json").write_text(json.dumps(lock))
        (self.project / "apps/desktop/src-tauri/tauri.conf.json").write_text(json.dumps({"bundle": bundle or {}}))

    def pin(self, key, content):
        return tools.pinned.PinnedAsset(self.assets[key].url, len(content), hashlib.sha256(content).hexdigest(),
                                       hashlib.sha1(content).hexdigest().upper())

    def make_archive(self, extra=(), omit=()):
        raw = io.BytesIO()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(raw, "w", zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("nsis-3.11/", b"")
                archive.writestr("nsis-3.11/Docs/empty/", b"")
                for name, content in self.contents.items():
                    if name not in omit:
                        archive.writestr("nsis-3.11/" + name, content)
                for name, content in extra:
                    archive.writestr(name, content)
        return raw.getvalue()

    def set_archive(self, content):
        self.archive = content
        self.assets["tauri-nsis"] = self.pin("tauri-nsis", content)

    def copy_input(self, key, destination):
        with destination.open("xb") as output:
            output.write(self.archive if key == "tauri-nsis" else self.plugin)
        return destination

    def assert_no_stage(self):
        if self.parent.exists():
            self.assertEqual(list(self.parent.glob(".webcodex-nsis-*")), [])

    def test_creates_complete_official_tree_plus_plugin(self):
        result = tools.prepare_tools(self.parent)
        self.assertEqual(result["outcome"], "created")
        self.assertEqual(result["required_files"], 13)
        self.assertEqual(result["verified_files"], len(self.contents) + 1)
        for name, content in self.contents.items():
            self.assertEqual((self.parent / "NSIS" / name).read_bytes(), content)
        self.assertEqual((self.parent / "NSIS" / tools.PLUGIN).read_bytes(), self.plugin)
        self.assertTrue((self.parent / "NSIS/Docs/empty").is_dir())
        self.assertEqual([call.args[0] for call in self.download.call_args_list], ["tauri-nsis", "tauri-nsis-utils"])
        self.assertEqual(result["archive_sha1"], hashlib.sha1(self.archive).hexdigest())
        self.assertEqual(result["plugin_sha1"], hashlib.sha1(self.plugin).hexdigest())
        self.assert_no_stage()

    def test_valid_existing_cache_is_reverified_and_reused_without_writes(self):
        tools.prepare_tools(self.parent)
        cache = self.parent / "NSIS"
        before = {path.relative_to(cache): (path.stat().st_ino, path.stat().st_mtime_ns)
                  for path in cache.rglob("*")}
        unrelated = self.parent / "other-tool-cache"
        unrelated.write_bytes(b"leave other tool caches untouched")
        self.assertEqual(tools.prepare_tools(self.parent)["outcome"], "reused")
        self.assertEqual(before, {path.relative_to(cache): (path.stat().st_ino, path.stat().st_mtime_ns)
                                  for path in cache.rglob("*")})
        self.assertEqual(unrelated.read_bytes(), b"leave other tool caches untouched")
        self.assertEqual(self.download.call_count, 4)
        self.assert_no_stage()

    def test_existing_required_file_mismatch_is_not_overwritten(self):
        tools.prepare_tools(self.parent)
        altered = self.parent / "NSIS/Include/MUI2.nsh"
        altered.write_bytes(b"unrelated existing bytes")
        with self.assertRaisesRegex(tools.PreparationError, "cache_file_digest"):
            tools.prepare_tools(self.parent)
        self.assertEqual(altered.read_bytes(), b"unrelated existing bytes")
        self.assert_no_stage()

    def test_existing_unknown_file_and_directory_are_preserved(self):
        tools.prepare_tools(self.parent)
        unknown = self.parent / "NSIS/private-data"
        unknown.mkdir()
        marker = unknown / "keep.txt"
        marker.write_bytes(b"never merge or delete")
        with self.assertRaisesRegex(tools.PreparationError, "unexpected_cache_entry"):
            tools.prepare_tools(self.parent)
        self.assertEqual(marker.read_bytes(), b"never merge or delete")
        self.assert_no_stage()

    def test_existing_missing_file_fails_without_repair(self):
        tools.prepare_tools(self.parent)
        missing = self.parent / "NSIS/Bin/makensis.exe"
        missing.unlink()
        with self.assertRaisesRegex(tools.PreparationError, "cache_tree_incomplete"):
            tools.prepare_tools(self.parent)
        self.assertFalse(missing.exists())
        self.assert_no_stage()

    def test_cache_reparse_directory_is_rejected(self):
        tools.prepare_tools(self.parent)
        bad = self.parent / "NSIS/Include"
        original = Path.lstat

        def attributes(path, *args, **kwargs):
            info = original(path, *args, **kwargs)
            if path == bad:
                return SimpleNamespace(st_mode=info.st_mode, st_file_attributes=tools.REPARSE_POINT)
            return info

        with mock.patch.object(Path, "lstat", attributes):
            with self.assertRaisesRegex(tools.PreparationError, "unsafe_directory"):
                tools.prepare_tools(self.parent)
        self.assertEqual((bad / "MUI2.nsh").read_bytes(), self.contents["Include/MUI2.nsh"])
        self.assert_no_stage()

    def test_parent_reparse_directory_is_rejected_before_download(self):
        self.parent.mkdir()
        original = Path.lstat

        def attributes(path, *args, **kwargs):
            info = original(path, *args, **kwargs)
            if path == self.parent:
                return SimpleNamespace(st_mode=info.st_mode, st_file_attributes=tools.REPARSE_POINT)
            return info

        with mock.patch.object(Path, "lstat", attributes):
            with self.assertRaisesRegex(tools.PreparationError, "unsafe_directory"):
                tools.prepare_tools(self.parent)
        self.download.assert_not_called()

    def test_unsafe_zip_paths_and_case_aliases_fail_before_adoption(self):
        paths = (
            "nsis-3.11/../escape", "/nsis-3.11/absolute", "C:/nsis-3.11/file",
            "nsis-3.11\\escape", "nsis-3.11/stream:ads", "nsis-3.11/CON",
            "nsis-3.11/trailing. ", "nsis-3.12/file", "nsis-3.11/Include/mui2.nsh",
            "nsis-3.11/makensis.exe", "nsis-3.11/makensis.exe/child", "nsis-3.11/" + tools.PLUGIN,
        )
        for index, name in enumerate(paths):
            with self.subTest(name=name):
                self.parent = self.root / f"unsafe-case-{index}" / "tauri"
                # Windows ZipInfo normalizes backslashes before writing. Mutate
                # both same-length ZIP header names so the fixture stays unsafe.
                placeholder = name.replace("\\", "X")
                raw = self.make_archive([(placeholder, b"bad")])
                if placeholder != name:
                    self.assertEqual(len(placeholder.encode()), len(name.encode()))
                    self.assertEqual(raw.count(placeholder.encode()), 2)
                    raw = raw.replace(placeholder.encode(), name.encode())
                    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                        self.assertEqual(sum(entry.orig_filename == name for entry in archive.infolist()), 1)
                self.set_archive(raw)
                with self.assertRaises(tools.PreparationError):
                    tools.prepare_tools(self.parent)
                self.assertFalse((self.parent / "NSIS").exists())
                self.assertFalse((self.parent / "escape").exists())
                self.assert_no_stage()

    def test_zip_symlink_and_reparse_attributes_are_rejected(self):
        for attributes in ((stat.S_IFLNK | 0o777) << 16, tools.REPARSE_POINT):
            with self.subTest(attributes=attributes):
                entry = zipfile.ZipInfo("nsis-3.11/linked")
                entry.create_system = 3
                entry.external_attr = attributes
                self.set_archive(self.make_archive([(entry, b"outside target")]))
                with self.assertRaisesRegex(tools.PreparationError, "unsafe_zip_entry"):
                    tools.prepare_tools(self.parent)
                self.assertFalse((self.parent / "NSIS").exists())
                self.assert_no_stage()

    def test_embedded_nul_zip_name_is_not_silently_normalized(self):
        raw = self.make_archive([("nsis-3.11/unsafeXname", b"bad")])
        self.set_archive(raw.replace(b"unsafeXname", b"unsafe\0name"))
        with self.assertRaisesRegex(tools.PreparationError, "unsafe_zip_path"):
            tools.prepare_tools(self.parent)
        self.assertFalse((self.parent / "NSIS").exists())

    def test_archive_limits_are_enforced(self):
        for name in ("MAX_MEMBERS", "MAX_MEMBER_BYTES", "MAX_EXPANDED_BYTES"):
            with self.subTest(limit=name), mock.patch.object(tools, name, 1):
                with self.assertRaises(tools.PreparationError):
                    tools.prepare_tools(self.parent)
                self.assertFalse((self.parent / "NSIS").exists())
                self.assert_no_stage()

    def test_missing_official_required_file_is_rejected(self):
        self.set_archive(self.make_archive(omit=["Include/Win/COM.nsh"]))
        with self.assertRaisesRegex(tools.PreparationError, "required_tool_file"):
            tools.prepare_tools(self.parent)
        self.assertFalse((self.parent / "NSIS").exists())
        self.assert_no_stage()

    def test_input_digest_mismatch_rejects_even_a_valid_zip(self):
        pin = self.assets["tauri-nsis"]
        for field in ("sha256", "sha1"):
            with self.subTest(field=field):
                values = dict(url=pin.url, size=pin.size, sha256=pin.sha256, sha1=pin.sha1)
                values[field] = "0" * (64 if field == "sha256" else 40)
                self.assets["tauri-nsis"] = tools.pinned.PinnedAsset(**values)
                with self.assertRaisesRegex(tools.PreparationError, "input_digest"):
                    tools.prepare_tools(self.parent)
                self.assertFalse((self.parent / "NSIS").exists())
                self.assert_no_stage()

    def test_second_download_failure_only_removes_owned_staging(self):
        self.parent.mkdir()
        marker = self.parent / "keep.txt"
        marker.write_bytes(b"existing parent contents")

        def fail_plugin(key, destination):
            if key == "tauri-nsis-utils":
                raise tools.pinned.DownloadError("transport")
            return self.copy_input(key, destination)

        self.download.side_effect = fail_plugin
        with self.assertRaises(tools.pinned.DownloadError):
            tools.prepare_tools(self.parent)
        self.assertEqual(marker.read_bytes(), b"existing parent contents")
        self.assertFalse((self.parent / "NSIS").exists())
        self.assert_no_stage()

    def test_partial_extraction_failure_never_adopts_a_cache(self):
        original = zipfile.ZipFile.open

        def fail_member(archive, name, *args, **kwargs):
            if isinstance(name, zipfile.ZipInfo) and name.filename.endswith("Include/MUI2.nsh"):
                raise zipfile.BadZipFile("fixture read failed")
            return original(archive, name, *args, **kwargs)

        with mock.patch.object(zipfile.ZipFile, "open", fail_member):
            with self.assertRaises(zipfile.BadZipFile):
                tools.prepare_tools(self.parent)
        self.assertFalse((self.parent / "NSIS").exists())
        self.assert_no_stage()

    def test_input_changed_during_extraction_is_not_adopted(self):
        original = tools._extract_tools

        def change_input(archive, plugin, tree, digest):
            result = original(archive, plugin, tree, digest)
            archive.write_bytes(b"changed input")
            return result

        with mock.patch.object(tools, "_extract_tools", change_input):
            with self.assertRaisesRegex(tools.PreparationError, "input_changed"):
                tools.prepare_tools(self.parent)
        self.assertFalse((self.parent / "NSIS").exists())
        self.assert_no_stage()

    def test_cache_created_by_another_actor_is_never_replaced(self):
        def competing_cache(source, destination):
            destination.mkdir()
            (destination / "keep.txt").write_bytes(b"concurrent owner")
            raise FileExistsError("fixture competing cache")

        with mock.patch.object(tools, "_rename_no_replace", competing_cache):
            with self.assertRaises(FileExistsError):
                tools.prepare_tools(self.parent)
        self.assertEqual((self.parent / "NSIS/keep.txt").read_bytes(), b"concurrent owner")
        self.assert_no_stage()

    def test_exclusive_rename_preserves_existing_empty_directory(self):
        source, destination = self.root / "source", self.root / "destination"
        source.mkdir()
        destination.mkdir()
        original = destination.stat().st_ino
        with self.assertRaises(FileExistsError):
            tools._rename_no_replace(source, destination)
        self.assertTrue(source.is_dir())
        self.assertEqual(destination.stat().st_ino, original)

    def test_unsafe_parent_names_are_rejected_before_download(self):
        for parent in (self.root / ".." / "tauri", self.root / "cache.", self.root / "cache:ads"):
            with self.subTest(parent=parent), self.assertRaises(tools.PreparationError):
                tools.prepare_tools(parent)
        self.download.assert_not_called()

    def test_project_version_and_cache_mode_are_guarded_once(self):
        self.write_project(version="2.12.0")
        with self.assertRaisesRegex(tools.PreparationError, "tauri_cli_version"):
            tools.prepare_tools(self.parent)
        for bundle in ({"useLocalToolsDir": True}, {"use-local-tools-dir": True},
                       {"useLocalToolsDir": "false"}, {"useLocalToolsDir": False, "use-local-tools-dir": False}):
            with self.subTest(bundle=bundle):
                self.write_project(bundle=bundle)
                with self.assertRaisesRegex(tools.PreparationError, "tauri_cache_directory"):
                    tools.prepare_tools(self.parent)
        self.download.assert_not_called()

    def test_standalone_cli_import_and_project_root_do_not_depend_on_cwd(self):
        result = subprocess.run([sys.executable, str(Path(tools.__file__)), "--tools-directory", "relative-cache"],
                                cwd=self.root, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=20, check=False)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout), {"ok": False, "code": "tools_directory_absolute"})
        self.assertEqual(result.stderr, b"")

    def test_cli_unexpected_failure_does_not_print_exception_details(self):
        output = io.StringIO()
        with mock.patch.object(tools, "prepare_tools", side_effect=RuntimeError("private fixture detail")), \
                mock.patch("sys.stdout", output):
            self.assertEqual(tools.main(["--tools-directory", str(self.parent)]), 1)
        self.assertEqual(json.loads(output.getvalue()), {"ok": False, "code": "tool_preparation_failed"})


if __name__ == "__main__":
    unittest.main()
