#!/usr/bin/env python3
"""Prepare the exact Tauri 2.11.4 NSIS cache for disposable GitHub CI runners.

This does not install a product or alter Tauri's checks. The shared downloader
owns transport and fixed input pins; this module owns archive layout and cache
adoption. Preserve every official ZIP member, then add the separately pinned
plugin. Reuse an existing cache only after comparing its entire tree with those
verified inputs. Never repair, merge into, or replace an existing cache.
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import sys
import tempfile
import zipfile

if __package__:
    from . import download_pinned_ci_input as pinned
else:
    import download_pinned_ci_input as pinned


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TAURI_CLI_VERSION = "2.11.4"
ZIP_ROOT = "nsis-3.11"
PLUGIN = "Plugins/x86-unicode/additional/nsis_tauri_utils.dll"
REQUIRED_FILES = (
    "makensis.exe", "Bin/makensis.exe", "Stubs/lzma-x86-unicode",
    "Stubs/lzma_solid-x86-unicode", PLUGIN, "Include/MUI2.nsh",
    "Include/FileFunc.nsh", "Include/x64.nsh", "Include/nsDialogs.nsh",
    "Include/WinMessages.nsh", "Include/Win/COM.nsh", "Include/Win/Propkey.nsh",
    "Include/Win/RestartManager.nsh",
)
MAX_MEMBERS = 4096
MAX_MEMBER_BYTES = 16 * 1024 * 1024
MAX_EXPANDED_BYTES = 64 * 1024 * 1024
READ_BYTES = 1024 * 1024
REPARSE_POINT = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
RESERVED_NAMES = {"CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$"} | {
    prefix + digit for prefix in ("COM", "LPT") for digit in "123456789¹²³"
}


class PreparationError(RuntimeError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def require(condition: bool, code: str) -> None:
    if not condition:
        raise PreparationError(code)


def _identity(info) -> tuple[int, int]:
    return info.st_dev, info.st_ino


def _is_link(info) -> bool:
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & REPARSE_POINT)


def _directory(path: Path):
    info = path.lstat()
    require(stat.S_ISDIR(info.st_mode) and not _is_link(info), "unsafe_directory")
    return info


def _component(name: str) -> None:
    require(bool(name) and name not in (".", "..") and len(name) <= 255
            and not name.endswith((".", " "))
            and not any(ord(char) < 32 or ord(char) == 127 or char in '<>:"/\\|?*' for char in name)
            and name.split(".", 1)[0].upper() not in RESERVED_NAMES, "unsafe_path")


def _ensure_directory(path: Path) -> Path:
    require(path.is_absolute() and path != Path(path.anchor), "tools_directory_absolute")
    require(".." not in path.parts, "unsafe_path")
    current = Path(path.anchor)
    _directory(current)
    for component in path.parts[1:]:
        _component(component)
        current /= component
        try:
            current.mkdir()
        except FileExistsError:
            pass
        _directory(current)
    return path


@contextmanager
def _regular_file(path: Path):
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and not _is_link(before) and before.st_nlink == 1, "unsafe_file")
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    with os.fdopen(os.open(path, flags), "rb") as stream:
        opened = os.fstat(stream.fileno())
        require(_identity(opened) == _identity(before), "file_changed")
        yield stream
        after = os.fstat(stream.fileno())
        current = path.lstat()
        require(stat.S_ISREG(current.st_mode) and not _is_link(current)
                and _identity(current) == _identity(before)
                and (after.st_size, after.st_mtime_ns, after.st_nlink)
                == (current.st_size, current.st_mtime_ns, current.st_nlink)
                == (before.st_size, before.st_mtime_ns, 1), "file_changed")


def _hash_file(path: Path, limit: int) -> tuple[int, str, str]:
    sha256, sha1, count = hashlib.sha256(), hashlib.sha1(), 0
    with _regular_file(path) as stream:
        require(os.fstat(stream.fileno()).st_size <= limit, "file_size")
        while chunk := stream.read(min(READ_BYTES, limit - count + 1)):
            count += len(chunk)
            require(count <= limit, "file_size")
            sha256.update(chunk)
            sha1.update(chunk)
    return count, sha256.hexdigest(), sha1.hexdigest()


def _project_contract() -> None:
    def object_pairs(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "project_contract")
            result[key] = value
        return result

    def read_json(relative: str, limit: int):
        with _regular_file(PROJECT_ROOT / relative) as stream:
            raw = stream.read(limit + 1)
        require(len(raw) <= limit, "project_contract")
        return json.loads(raw, object_pairs_hook=object_pairs)

    lock = read_json("apps/desktop/package-lock.json", 2 * 1024 * 1024)
    config = read_json("apps/desktop/src-tauri/tauri.conf.json", 64 * 1024)
    require(isinstance(lock, dict) and isinstance(config, dict), "project_contract")
    packages = lock.get("packages", {})
    require(isinstance(packages, dict), "project_contract")
    cli = packages.get("node_modules/@tauri-apps/cli", {})
    require(isinstance(cli, dict) and cli.get("version") == TAURI_CLI_VERSION, "tauri_cli_version")
    bundle = config.get("bundle", {})
    require(isinstance(bundle, dict), "project_contract")
    flags = [name for name in ("useLocalToolsDir", "use-local-tools-dir") if name in bundle]
    require(len(flags) <= 1 and all(bundle[name] is False for name in flags), "tauri_cache_directory")


def _verified_input(key: str, destination: Path) -> tuple[int, str, str]:
    result = pinned.download_asset(key, destination)
    require(isinstance(result, Path) and result == destination, "download_destination")
    asset = pinned.ASSETS[key]
    require(asset.sha1 is not None, "tauri_input_sha1")
    expected = (asset.size, asset.sha256, asset.sha1.lower())
    require(_hash_file(destination, asset.size) == expected, "input_digest")
    return expected


def _archive_entries(archive: zipfile.ZipFile):
    entries = archive.infolist()
    require(0 < len(entries) <= MAX_MEMBERS, "zip_member_count")
    files, directories, names, explicit = {}, {""}, {}, set()

    def reserve(relative: str, kind: str):
        parts = relative.split("/") if relative else []
        for count in range(1, len(parts) + 1):
            path = "/".join(parts[:count])
            node_kind = kind if count == len(parts) else "directory"
            prior = names.setdefault(path.casefold(), (path, node_kind))
            require(prior == (path, node_kind), "zip_path_collision")
            if node_kind == "directory":
                directories.add(path)

    reserve(PLUGIN, "file")
    total = 0
    for entry in entries:
        raw = entry.filename
        require(raw == entry.orig_filename and raw and not raw.startswith("/")
                and "\\" not in raw and "\0" not in raw, "unsafe_zip_path")
        parts = raw[:-1].split("/") if entry.is_dir() else raw.split("/")
        require(parts[0] == ZIP_ROOT and len(parts) <= 16 and len(raw) <= 240, "zip_root_or_depth")
        for part in parts:
            _component(part)
        relative = "/".join(parts[1:])
        require(relative or entry.is_dir(), "zip_root_or_depth")
        require(relative.casefold() not in explicit and relative.casefold() != PLUGIN.casefold(), "zip_duplicate")
        explicit.add(relative.casefold())
        mode = stat.S_IFMT((entry.external_attr >> 16) & 0xffff)
        allowed = (0, stat.S_IFDIR) if entry.is_dir() else (0, stat.S_IFREG)
        require(mode in allowed and not entry.flag_bits & 1
                and not entry.external_attr & REPARSE_POINT
                and (entry.is_dir() or not entry.external_attr & 0x10), "unsafe_zip_entry")
        require(0 <= entry.file_size <= MAX_MEMBER_BYTES, "zip_member_size")
        total += entry.file_size
        require(total <= MAX_EXPANDED_BYTES, "zip_expanded_size")
        if entry.is_dir():
            require(entry.file_size == 0, "zip_directory_data")
        reserve(relative, "directory" if entry.is_dir() else "file")
        if not entry.is_dir():
            files[relative] = entry
    return files, directories


def _extract_tools(archive_path: Path, plugin_path: Path, tree: Path, plugin_digest):
    expected = {}
    with _regular_file(archive_path) as raw, zipfile.ZipFile(raw) as archive:
        files, directories = _archive_entries(archive)
        tree.mkdir()
        for relative in sorted(directories - {""}, key=lambda value: (value.count("/"), value)):
            (tree / relative).mkdir()
        for relative, entry in files.items():
            count, sha256, sha1 = 0, hashlib.sha256(), hashlib.sha1()
            with archive.open(entry) as source, (tree / relative).open("xb") as output:
                while chunk := source.read(min(READ_BYTES, entry.file_size - count + 1)):
                    count += len(chunk)
                    require(count <= entry.file_size, "zip_member_size")
                    output.write(chunk)
                    sha256.update(chunk)
                    sha1.update(chunk)
            require(count == entry.file_size, "zip_member_size")
            expected[relative] = (count, sha256.hexdigest(), sha1.hexdigest())
        with _regular_file(plugin_path) as source, (tree / PLUGIN).open("xb") as output:
            count = 0
            while chunk := source.read(min(READ_BYTES, plugin_digest[0] - count + 1)):
                count += len(chunk)
                require(count <= plugin_digest[0], "plugin_size")
                output.write(chunk)
            require(count == plugin_digest[0], "plugin_size")
        expected[PLUGIN] = plugin_digest
    require(all(name in expected and expected[name][0] > 0 for name in REQUIRED_FILES), "required_tool_file")
    return expected, directories


def _verify_tree(root: Path, expected: dict, directories: set[str]) -> None:
    root_identity = _identity(_directory(root))
    seen_files, seen_directories = set(), {""}
    pending = [(root, "")]
    while pending:
        path, prefix = pending.pop()
        _directory(path)
        with os.scandir(path) as entries:
            for entry in entries:
                _component(entry.name)
                relative = prefix + entry.name
                node = path / entry.name
                if relative in directories:
                    _directory(node)
                    seen_directories.add(relative)
                    pending.append((node, relative + "/"))
                elif relative in expected:
                    require(_hash_file(node, expected[relative][0]) == expected[relative], "cache_file_digest")
                    seen_files.add(relative)
                else:
                    raise PreparationError("unexpected_cache_entry")
    require(seen_files == set(expected) and seen_directories == directories, "cache_tree_incomplete")
    require(_identity(_directory(root)) == root_identity, "cache_changed")


def _rename_no_replace(source: Path, destination: Path) -> None:
    if os.name == "nt":
        # Windows rename fails if a file or directory already occupies the name.
        os.rename(source, destination)
        return
    require(sys.platform.startswith("linux"), "exclusive_adoption_unavailable")
    libc = ctypes.CDLL(None, use_errno=True)
    rename = getattr(libc, "renameat2", None)
    require(rename is not None, "exclusive_adoption_unavailable")
    rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    rename.restype = ctypes.c_int
    if rename(-100, os.fsencode(source), -100, os.fsencode(destination), 1) != 0:
        error = ctypes.get_errno()
        raise OSError(error, "exclusive cache adoption failed")


def prepare_tools(tools_directory: Path) -> dict:
    _project_contract()
    parent = _ensure_directory(tools_directory)
    target = parent / "NSIS"
    if os.path.lexists(target):
        _directory(target)
    stage = Path(tempfile.mkdtemp(prefix=".webcodex-nsis-", dir=parent))
    stage_identity = _identity(_directory(stage))
    try:
        archive, plugin = stage / "nsis-3.11.zip", stage / "nsis_tauri_utils.dll"
        archive_digest = _verified_input("tauri-nsis", archive)
        plugin_digest = _verified_input("tauri-nsis-utils", plugin)
        tree = stage / "NSIS"
        expected, directories = _extract_tools(archive, plugin, tree, plugin_digest)
        require(_hash_file(archive, archive_digest[0]) == archive_digest, "input_changed")
        _verify_tree(tree, expected, directories)
        if os.path.lexists(target):
            _verify_tree(target, expected, directories)
            outcome = "reused"
        else:
            identity = _identity(_directory(tree))
            _rename_no_replace(tree, target)
            require(_identity(_directory(target)) == identity, "cache_changed")
            outcome = "created"
        return {"ok": True, "outcome": outcome, "tauri_cli_version": TAURI_CLI_VERSION,
                "nsis_version": "3.11", "verified_files": len(expected),
                "required_files": len(REQUIRED_FILES), "archive_sha256": archive_digest[1],
                "archive_sha1": archive_digest[2], "plugin_sha256": plugin_digest[1],
                "plugin_sha1": plugin_digest[2]}
    finally:
        # Only the fresh UUID directory we created, never the existing NSIS cache.
        require(_identity(_directory(stage)) == stage_identity, "stage_changed")
        shutil.rmtree(stage)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tools-directory", required=True, type=Path,
                        help="Absolute CI cache parent; Windows default is LOCALAPPDATA/tauri")
    args = parser.parse_args(argv)
    try:
        report = prepare_tools(args.tools_directory)
    except PreparationError as error:
        report = {"ok": False, "code": error.code}
    except pinned.DownloadError as error:
        report = {"ok": False, "code": "download_" + error.code}
    except Exception:
        report = {"ok": False, "code": "tool_preparation_failed"}
    print(json.dumps(report, sort_keys=True))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
