#!/usr/bin/env python3
"""Download fixed old CI inputs; this is not the public candidate release gate.

Each request is anonymous and uses the runner's normal urllib network routing.
There are no retries, API downloads, configurable URLs, or integrity overrides.
A separate process bounds the complete transfer and verification on Windows too.
Only a verified, complete file is published, without replacing an existing path.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from types import MappingProxyType
import urllib.error
import urllib.parse
import urllib.request


@dataclass(frozen=True)
class PinnedAsset:
    url: str
    size: int
    sha256: str
    sha1: str | None = None


ASSETS = MappingProxyType({
    "v8-linux-x64": PinnedAsset(
        "https://github.com/denoland/rusty_v8/releases/download/v149.2.0/"
        "librusty_v8_release_x86_64-unknown-linux-gnu.a.gz",
        38519314, "8aed98637db7e77dc8bfb8bb4759ec5bde472d0bf7943f58e0e62a350945c559"),
    "desktop-v050-x64": PinnedAsset(
        "https://github.com/yyjeqhc/webcodex/releases/download/v0.5.0/"
        "webcodex-desktop-v0.5.0-win32-x64-setup.exe",
        33737558, "dcc391d0c26e3334c60967c269fffff20312e2b059e61f3f1140779ffacdb6c6"),
    "unified-v053-x64": PinnedAsset(
        "https://github.com/9holy/webcodex/releases/download/v0.5.3/"
        "webcodex-unified-v0.5.3-win32-x64.exe",
        84239842, "7a43d294780f8af8a3e22853d81065ccca4546fda1e8316156a2dad9b9c812ab"),
    "runtime-v053-x64": PinnedAsset(
        "https://github.com/9holy/webcodex/releases/download/v0.5.3/"
        "webcodex-v0.5.3-win32-x64.tar.gz",
        41206322, "95cb8d1d9b3756e531a48f85032d7aeb0771fe141ec09940b308f25fdc6a1be6"),
    "tauri-nsis": PinnedAsset(
        "https://github.com/tauri-apps/binary-releases/releases/download/"
        "nsis-3.11/nsis-3.11.zip",
        2361546, "c7d27f780ddb6cffb4730138cd1591e841f4b7edb155856901cdf5f214394fa1",
        "EF7FF767E5CBD9EDD22ADD3A32C9B8F4500BB10D"),
    "tauri-nsis-utils": PinnedAsset(
        "https://github.com/tauri-apps/nsis-tauri-utils/releases/download/"
        "nsis_tauri_utils-v0.5.3/nsis_tauri_utils.dll",
        34304, "5ba143b5db4a87d32d6e7802e033330aae56cbceabe0d1e3ba41948385ad4709",
        "75197FEE3C6A814FE035788D1C34EAD39349B860"),
})

CHUNK_BYTES = 1024 * 1024
READ_BYTES = 64 * 1024
SOCKET_TIMEOUT_SECONDS = 30
WHOLE_FILE_TIMEOUT_SECONDS = 180
_ERROR_CODES = frozenset({
    "unknown_asset", "https_required", "url_credentials", "http_status",
    "content_range", "content_length", "content_encoding", "chunk_length",
    "file_size", "sha256", "sha1", "transport", "io_error", "deadline",
    "destination_exists", "destination_parent", "worker_failed",
})


class DownloadError(RuntimeError):
    """A fixed diagnostic code, never a URL, response body, or exception dump."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _require_https(url: str) -> None:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise DownloadError("https_required")
    if parsed.username is not None or parsed.password is not None:
        raise DownloadError("url_credentials")


class HTTPSOnlyRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _require_https(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _single_header(headers, name: str, code: str) -> str | None:
    values = headers.get_all(name, [])
    if len(values) > 1:
        raise DownloadError(code)
    return values[0] if values else None


def _copy_exact(response, output, length: int, sha256, sha1) -> None:
    count = 0
    while True:
        # Read one byte beyond the boundary as well, never an unbounded body.
        chunk = response.read(min(READ_BYTES, length - count + 1))
        if not chunk:
            break
        count += len(chunk)
        if count > length:
            raise DownloadError("chunk_length")
        output.write(chunk)
        sha256.update(chunk)
        if sha1 is not None:
            sha1.update(chunk)
    if count != length:
        raise DownloadError("chunk_length")


def _download_to_staging(asset: PinnedAsset, destination: Path) -> None:
    """Internal worker: its parent enforces the whole-file wall-clock deadline."""
    _require_https(asset.url)
    # Preserve urllib's default proxy handling and the runner's network routing.
    opener = urllib.request.build_opener(HTTPSOnlyRedirectHandler())
    sha256 = hashlib.sha256()
    sha1 = hashlib.sha1() if asset.sha1 is not None else None
    created = False
    try:
        with destination.open("xb") as output:
            created = True
            total = 0
            for start in range(0, asset.size, CHUNK_BYTES):
                end = min(start + CHUNK_BYTES, asset.size) - 1
                request = urllib.request.Request(asset.url, headers={
                    "Range": f"bytes={start}-{end}",
                    "Accept-Encoding": "identity",
                })
                with opener.open(request, timeout=SOCKET_TIMEOUT_SECONDS) as response:
                    _require_https(response.geturl())
                    encoding = _single_header(response.headers, "Content-Encoding", "content_encoding")
                    if encoding is not None and encoding.lower() != "identity":
                        raise DownloadError("content_encoding")
                    content_range = _single_header(response.headers, "Content-Range", "content_range")
                    if response.status == 206:
                        if content_range != f"bytes {start}-{end}/{asset.size}":
                            raise DownloadError("content_range")
                        length = end - start + 1
                    elif response.status == 200 and start == 0:
                        # Some servers ignore Range. Accept only the complete
                        # pinned object, never a 200 response to a later chunk.
                        if content_range is not None:
                            raise DownloadError("content_range")
                        length = asset.size
                    else:
                        raise DownloadError("http_status")
                    content_length = _single_header(response.headers, "Content-Length", "content_length")
                    if content_length is not None and content_length != str(length):
                        raise DownloadError("content_length")
                    _copy_exact(response, output, length, sha256, sha1)
                    total += length
                    if response.status == 200:
                        break
            if total != asset.size:
                raise DownloadError("file_size")
            if sha256.hexdigest() != asset.sha256:
                raise DownloadError("sha256")
            if sha1 is not None and sha1.hexdigest() != asset.sha1.lower():
                raise DownloadError("sha1")
            output.flush()
            os.fsync(output.fileno())
    except BaseException:
        if created:
            destination.unlink(missing_ok=True)
        raise


def _worker_main(key: str, staging: str, error_file: str) -> int:
    try:
        _download_to_staging(ASSETS[key], Path(staging))
        return 0
    except DownloadError as error:
        code = error.code
    except urllib.error.HTTPError as error:
        code = f"http_{error.code}" if 100 <= error.code <= 599 else "http_status"
    except (urllib.error.URLError, TimeoutError):
        code = "transport"
    except OSError:
        code = "io_error"
    except Exception:
        code = "worker_failed"
    try:
        Path(error_file).write_text(code, encoding="ascii")
    except OSError:
        pass
    return 1


def _worker_command(key: str, staging: Path, error_file: Path) -> list[str]:
    # No shell or public worker flag: the supported CLI always uses the deadline.
    code = ("import runpy,sys; m=runpy.run_path(sys.argv[1]); "
            "sys.exit(m['_worker_main'](sys.argv[2],sys.argv[3],sys.argv[4]))")
    return [sys.executable, "-I", "-B", "-c", code,
            str(Path(__file__).resolve()), key, str(staging), str(error_file)]


def _read_worker_error(path: Path) -> str:
    try:
        with path.open("rb") as stream:
            code = stream.read(64).decode("ascii")
    except (OSError, UnicodeError):
        return "worker_failed"
    if code in _ERROR_CODES or (
        len(code) == 8 and code.startswith("http_") and code[5:].isascii()
        and code[5:].isdigit() and 100 <= int(code[5:]) <= 599
    ):
        return code
    return "worker_failed"


def _run_worker(key: str, staging: Path, error_file: Path, deadline: float) -> None:
    process = subprocess.Popen(
        _worker_command(key, staging, error_file), stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False,
    )
    try:
        try:
            status = process.wait(timeout=max(0, deadline - time.monotonic()))
        except subprocess.TimeoutExpired as error:
            raise DownloadError("deadline") from error
        if time.monotonic() >= deadline:
            raise DownloadError("deadline")
        if status != 0:
            raise DownloadError(_read_worker_error(error_file))
    finally:
        if process.poll() is None:
            process.kill()  # Only the exact Python worker created here.
            process.wait(timeout=5)


def download_asset(key: str, destination: Path) -> Path:
    """Return an absolute path only after the fixed input is completely verified.

    The parent must already exist. An existing destination, including a dangling
    symlink, is never removed or overwritten. All partial bytes remain in a new,
    owned staging directory on the destination filesystem and are cleaned on error.
    """
    if key not in ASSETS:
        raise DownloadError("unknown_asset")
    destination = Path(os.path.abspath(destination))
    if os.path.lexists(destination):
        raise DownloadError("destination_exists")
    if not destination.parent.is_dir():
        raise DownloadError("destination_parent")
    deadline = time.monotonic() + WHOLE_FILE_TIMEOUT_SECONDS
    with tempfile.TemporaryDirectory(prefix=".pinned-ci-", dir=destination.parent) as temp:
        staging = Path(temp) / "payload"
        _run_worker(key, staging, Path(temp) / "error", deadline)
        if time.monotonic() >= deadline:
            raise DownloadError("deadline")
        if staging.stat().st_size != ASSETS[key].size:
            raise DownloadError("file_size")
        try:
            # Same-filesystem link is atomic and refuses an existing destination
            # on both Unix and Windows; rename would overwrite on Unix.
            os.link(staging, destination)
        except FileExistsError as error:
            raise DownloadError("destination_exists") from error
    return destination


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", required=True, choices=tuple(ASSETS))
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        download_asset(args.asset, args.output)
    except DownloadError as error:
        print(f"{args.asset}: download failed ({error.code})", file=sys.stderr)
        return 1
    except OSError:
        print(f"{args.asset}: download failed (io_error)", file=sys.stderr)
        return 1
    print(f"{args.asset}: {ASSETS[args.asset].size} bytes and pinned digests verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
