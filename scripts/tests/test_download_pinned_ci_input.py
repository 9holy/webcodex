from __future__ import annotations

from dataclasses import replace
from email.message import Message
import hashlib
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock
import urllib.error
import urllib.request

from scripts import download_pinned_ci_input as download


URL = "https://github.com/example/project/releases/download/v1/input.bin"


def asset_for(data: bytes, *, sha1: bool = False) -> download.PinnedAsset:
    return download.PinnedAsset(
        URL, len(data), hashlib.sha256(data).hexdigest(),
        hashlib.sha1(data).hexdigest().upper() if sha1 else None,
    )


class Response(io.BytesIO):
    def __init__(self, data: bytes, status: int, headers=(), *, url: str = URL):
        super().__init__(data)
        self.status = status
        self.headers = Message()
        for name, value in headers:
            self.headers.add_header(name, value)
        self.url = url

    def geturl(self):
        return self.url


def partial(data: bytes, start: int, end: int, total: int) -> Response:
    return Response(data, 206, [("Content-Range", f"bytes {start}-{end}/{total}")])


class TransferTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.output = self.root / "payload"

    def transfer(self, asset, responses):
        opener = mock.Mock()
        opener.open.side_effect = responses
        with mock.patch.object(download.urllib.request, "build_opener", return_value=opener) as build:
            download._download_to_staging(asset, self.output)
        self.assertEqual(len(build.call_args.args), 1)
        self.assertIsInstance(build.call_args.args[0], download.HTTPSOnlyRedirectHandler)
        return opener

    def rejected(self, asset, responses, code):
        with self.assertRaises(download.DownloadError) as raised:
            self.transfer(asset, responses)
        self.assertEqual(raised.exception.code, code)
        self.assertFalse(self.output.exists())
        self.assertEqual(list(self.root.iterdir()), [])

    def test_contiguous_one_mib_ranges_verify_complete_object_and_sha1(self):
        data = b"a" * download.CHUNK_BYTES + b"b" * download.CHUNK_BYTES + b"tail"
        asset = asset_for(data, sha1=True)
        bounds = [(0, download.CHUNK_BYTES - 1),
                  (download.CHUNK_BYTES, 2 * download.CHUNK_BYTES - 1),
                  (2 * download.CHUNK_BYTES, len(data) - 1)]
        opener = self.transfer(asset, [partial(data[a:b + 1], a, b, len(data)) for a, b in bounds])
        self.assertEqual(self.output.read_bytes(), data)
        self.assertEqual(opener.open.call_count, 3)
        for call, (start, end) in zip(opener.open.call_args_list, bounds):
            request = call.args[0]
            self.assertEqual(request.full_url, URL)
            self.assertEqual(dict((k.lower(), v) for k, v in request.header_items()), {
                "range": f"bytes={start}-{end}", "accept-encoding": "identity",
                "user-agent": "webcodex-pinned-ci-input/1",
            })
            self.assertEqual(call.kwargs, {"timeout": download.SOCKET_TIMEOUT_SECONDS})

    def test_first_200_accepts_only_complete_verified_file(self):
        data = b"full" * (download.CHUNK_BYTES // 4 + 1)
        response = Response(data, 200, [("Content-Length", str(len(data)))])
        opener = self.transfer(asset_for(data), [response])
        self.assertEqual(opener.open.call_count, 1)
        self.assertEqual(self.output.read_bytes(), data)

    def test_truncated_or_overlong_range_is_removed(self):
        data = b"expected"
        for body in (data[:-1], data + b"extra"):
            with self.subTest(length=len(body)):
                self.rejected(asset_for(data), [partial(body, 0, len(data) - 1, len(data))], "chunk_length")

    def test_first_200_cannot_supply_only_requested_chunk_or_extra_bytes(self):
        data = b"x" * (download.CHUNK_BYTES + 1)
        for body in (data[:download.CHUNK_BYTES], data + b"extra"):
            with self.subTest(length=len(body)):
                self.rejected(asset_for(data), [Response(body, 200)], "chunk_length")

    def test_content_range_must_match_start_end_total_exactly_once(self):
        data = b"expected"
        invalid = [[], [("Content-Range", "bytes 1-7/8")],
                   [("Content-Range", "bytes 0-6/8")],
                   [("Content-Range", "bytes 0-7/9")],
                   [("Content-Range", "bytes 0-7/*")],
                   [("Content-Range", "bytes 0-7/8"), ("Content-Range", "bytes 0-7/8")]]
        for headers in invalid:
            with self.subTest(headers=headers):
                self.rejected(asset_for(data), [Response(data, 206, headers)], "content_range")

    def test_content_length_if_present_is_exact_and_unique(self):
        data = b"expected"
        for values in (["7"], ["9"], ["8,8"], ["8", "8"]):
            with self.subTest(values=values):
                headers = [("Content-Range", "bytes 0-7/8")]
                headers.extend(("Content-Length", value) for value in values)
                self.rejected(asset_for(data), [Response(data, 206, headers)], "content_length")

    def test_late_200_is_rejected_without_appending_a_second_object(self):
        data = b"x" * (download.CHUNK_BYTES + 1)
        self.rejected(asset_for(data), [
            partial(data[:download.CHUNK_BYTES], 0, download.CHUNK_BYTES - 1, len(data)),
            Response(data, 200),
        ], "http_status")

    def test_complete_size_does_not_bypass_either_hash(self):
        data = b"expected"
        for asset, body, code in (
            (asset_for(data), b"corrupt!", "sha256"),
            (replace(asset_for(data, sha1=True), sha1="0" * 40), data, "sha1"),
        ):
            with self.subTest(code=code):
                self.rejected(asset, [Response(body, 200)], code)

    def test_unexpected_status_or_transformed_body_is_rejected(self):
        data = b"expected"
        for response, code in (
            (Response(data, 204), "http_status"),
            (Response(data, 200, [("Content-Encoding", "gzip")]), "content_encoding"),
            (Response(data, 200, [("Content-Range", "bytes 0-7/8")]), "content_range"),
        ):
            with self.subTest(code=code):
                self.rejected(asset_for(data), [response], code)

    def test_transport_failure_does_not_retry_and_cleans_partial_bytes(self):
        data = b"x" * (download.CHUNK_BYTES + 1)
        opener = mock.Mock()
        opener.open.side_effect = [
            partial(data[:download.CHUNK_BYTES], 0, download.CHUNK_BYTES - 1, len(data)),
            urllib.error.URLError("network failure"),
        ]
        with mock.patch.object(download.urllib.request, "build_opener", return_value=opener):
            with self.assertRaises(urllib.error.URLError):
                download._download_to_staging(asset_for(data), self.output)
        self.assertEqual(opener.open.call_count, 2)
        self.assertFalse(self.output.exists())

    def test_internal_exclusive_open_never_removes_existing_file(self):
        self.output.write_bytes(b"existing")
        with self.assertRaises(FileExistsError):
            self.transfer(asset_for(b"new"), [])
        self.assertEqual(self.output.read_bytes(), b"existing")


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.destination = self.root / "verified.bin"
        self.key = "v8-linux-x64"
        self.data = b"verified fixed object"
        self.asset = asset_for(self.data)

    def test_verified_staging_is_published_once_and_staging_removed(self):
        opener = mock.Mock()
        opener.open.return_value = Response(self.data, 200)

        def worker(key, staging, error_file, deadline):
            self.assertFalse(self.destination.exists())
            download._download_to_staging(self.asset, staging)

        with mock.patch.object(download, "ASSETS", {self.key: self.asset}), \
                mock.patch.object(download, "_run_worker", side_effect=worker), \
                mock.patch.object(download.urllib.request, "build_opener", return_value=opener):
            result = download.download_asset(self.key, self.destination)
        self.assertEqual(result, self.destination.absolute())
        self.assertEqual(result.read_bytes(), self.data)
        self.assertEqual(list(self.root.iterdir()), [self.destination])

    def test_failed_worker_removes_only_its_staging(self):
        unrelated = self.root / "unrelated"
        unrelated.write_bytes(b"keep")

        def worker(key, staging, error_file, deadline):
            staging.write_bytes(b"partial")
            raise download.DownloadError("transport")

        with mock.patch.object(download, "_run_worker", side_effect=worker):
            with self.assertRaisesRegex(download.DownloadError, "transport"):
                download.download_asset(self.key, self.destination)
        self.assertEqual(list(self.root.iterdir()), [unrelated])
        self.assertEqual(unrelated.read_bytes(), b"keep")

    def test_existing_file_or_directory_is_rejected_before_worker(self):
        for is_directory in (False, True):
            with self.subTest(directory=is_directory):
                path = self.root / ("directory" if is_directory else "file")
                if is_directory:
                    path.mkdir()
                else:
                    path.write_bytes(b"keep")
                with mock.patch.object(download, "_run_worker") as worker:
                    with self.assertRaisesRegex(download.DownloadError, "destination_exists"):
                        download.download_asset(self.key, path)
                worker.assert_not_called()
                self.assertTrue(path.is_dir() if is_directory else path.read_bytes() == b"keep")

    def test_destination_created_during_download_is_not_overwritten(self):
        def worker(key, staging, error_file, deadline):
            staging.write_bytes(self.data)
            self.destination.write_bytes(b"foreign")

        with mock.patch.object(download, "ASSETS", {self.key: self.asset}), \
                mock.patch.object(download, "_run_worker", side_effect=worker):
            with self.assertRaisesRegex(download.DownloadError, "destination_exists"):
                download.download_asset(self.key, self.destination)
        self.assertEqual(self.destination.read_bytes(), b"foreign")
        self.assertEqual(list(self.root.iterdir()), [self.destination])

    def test_real_hung_worker_is_killed_reaped_and_partial_staging_cleaned(self):
        processes = []
        real_popen = subprocess.Popen

        def command(key, staging, error_file):
            code = "import pathlib,sys,time; pathlib.Path(sys.argv[1]).write_bytes(b'partial'); time.sleep(30)"
            return [sys.executable, "-I", "-B", "-c", code, str(staging)]

        def popen(*args, **kwargs):
            process = real_popen(*args, **kwargs)
            processes.append(process)
            self.assertFalse(kwargs["shell"])
            self.assertEqual(kwargs["stdin"], subprocess.DEVNULL)
            return process

        started = time.monotonic()
        with mock.patch.object(download, "WHOLE_FILE_TIMEOUT_SECONDS", 0.2), \
                mock.patch.object(download, "_worker_command", side_effect=command), \
                mock.patch.object(download.subprocess, "Popen", side_effect=popen):
            with self.assertRaisesRegex(download.DownloadError, "deadline"):
                download.download_asset(self.key, self.destination)
        self.assertLess(time.monotonic() - started, 5)
        self.assertEqual(len(processes), 1)
        self.assertIsNotNone(processes[0].poll())
        self.assertEqual(list(self.root.iterdir()), [])

    def test_fixed_worker_bootstraps_in_isolated_python_without_network(self):
        error_file = self.root / "error"
        result = subprocess.run(
            download._worker_command("unregistered-key", self.destination, error_file),
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=5, check=False,
        )
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(result.stdout, b"")
        self.assertEqual(result.stderr, b"")
        self.assertEqual(error_file.read_text(), "worker_failed")
        self.assertFalse(self.destination.exists())


class RequestBoundaryTests(unittest.TestCase):
    def test_https_redirects_retain_range_and_reject_credentials_or_downgrade(self):
        handler = download.HTTPSOnlyRedirectHandler()
        request = urllib.request.Request(URL, headers={"Range": "bytes=0-7"})
        redirected = handler.redirect_request(request, None, 302, "Found", {}, "https://release-assets.githubusercontent.com/payload")
        self.assertEqual(redirected.get_header("Range"), "bytes=0-7")
        self.assertIsNone(redirected.get_header("Authorization"))
        for url, code in (
            ("http://github.com/payload", "https_required"),
            ("file:///tmp/payload", "https_required"),
            ("https://user:password@github.com/payload", "url_credentials"),
        ):
            with self.subTest(code=code):
                with self.assertRaisesRegex(download.DownloadError, code):
                    handler.redirect_request(request, None, 302, "Found", {}, url)

    def test_worker_error_report_contains_only_bounded_code(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for error, expected in (
                (urllib.error.URLError("private redirect URL must not escape"), "transport"),
                (urllib.error.HTTPError(URL, 504, "private detail", None, None), "http_504"),
                (RuntimeError("unexpected private detail"), "worker_failed"),
            ):
                with self.subTest(expected=expected):
                    with mock.patch.object(download, "_download_to_staging", side_effect=error):
                        code = download._worker_main("v8-linux-x64", str(root / "payload"), str(root / "error"))
                    self.assertEqual(code, 1)
                    self.assertEqual((root / "error").read_text(), expected)
                    self.assertEqual(download._read_worker_error(root / "error"), expected)

    def test_registry_has_only_six_fixed_official_inputs(self):
        expected = {
            "v8-linux-x64": (38519314, "8aed98637db7e77dc8bfb8bb4759ec5bde472d0bf7943f58e0e62a350945c559", None),
            "desktop-v050-x64": (33737558, "dcc391d0c26e3334c60967c269fffff20312e2b059e61f3f1140779ffacdb6c6", None),
            "unified-v053-x64": (84239842, "7a43d294780f8af8a3e22853d81065ccca4546fda1e8316156a2dad9b9c812ab", None),
            "runtime-v053-x64": (41206322, "95cb8d1d9b3756e531a48f85032d7aeb0771fe141ec09940b308f25fdc6a1be6", None),
            "tauri-nsis": (2361546, "c7d27f780ddb6cffb4730138cd1591e841f4b7edb155856901cdf5f214394fa1", "EF7FF767E5CBD9EDD22ADD3A32C9B8F4500BB10D"),
            "tauri-nsis-utils": (34304, "5ba143b5db4a87d32d6e7802e033330aae56cbceabe0d1e3ba41948385ad4709", "75197FEE3C6A814FE035788D1C34EAD39349B860"),
        }
        self.assertEqual({key: (asset.size, asset.sha256, asset.sha1) for key, asset in download.ASSETS.items()}, expected)
        for asset in download.ASSETS.values():
            self.assertTrue(asset.url.startswith("https://github.com/"))
            download._require_https(asset.url)
        with self.assertRaises(TypeError):
            download.ASSETS["new"] = asset_for(b"arbitrary")
        with self.assertRaisesRegex(download.DownloadError, "unknown_asset"):
            download.download_asset("https://github.com/arbitrary", Path("unused"))


if __name__ == "__main__":
    unittest.main()
