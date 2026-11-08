from __future__ import annotations

import hashlib
import io
import json
import tarfile
import tempfile
import unittest
import urllib.request
import zipfile
from pathlib import Path

from scripts import collect_release_bundle as collector


SOURCE_SHA = "a" * 40
RUN_ID = 123456
VERSION = "0.4.3"
SOURCE_REF = f"release/v{VERSION}"
WINDOWS_PLATFORMS = ("win32-x64", "win32-arm64")


def _archive_bytes(platform: str) -> bytes:
    output = io.BytesIO()
    suffix = ".exe" if platform.startswith("win32-") else ""
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        for binary in collector.BINARIES:
            payload = f"{platform}:{binary}".encode("ascii")
            info = tarfile.TarInfo(f"{binary}{suffix}")
            info.size = len(payload)
            archive.addfile(info, io.BytesIO(payload))
    return output.getvalue()


def _write_bundle(root: Path, tag: str, build_kind: str, *, unified: bool = False, guarded: bool = False, platform_scope: str = "all") -> tuple[str, dict[str, str]]:
    platforms = WINDOWS_PLATFORMS if platform_scope == "windows" else collector.PLATFORMS
    desktop_platforms = WINDOWS_PLATFORMS if platform_scope == "windows" else collector.primary_desktop_platforms_for_version(VERSION)
    installer_targets = {f"{platform}-exe": (platform, "exe") for platform in WINDOWS_PLATFORMS} if platform_scope == "windows" else collector.INSTALLER_TARGETS
    scope_marker = {"platform_scope": "windows"} if platform_scope == "windows" else {}
    stem = (
        f"webcodex-v{VERSION}"
        if build_kind == "release"
        else f"webcodex-{tag}-{SOURCE_SHA[:12]}-v{VERSION}"
    )
    artifact_hashes: dict[str, str] = {}
    artifact_payload: dict[str, dict[str, str]] = {}
    checksum_lines = []
    for platform in platforms:
        filename = f"{stem}-{platform}.tar.gz"
        payload = _archive_bytes(platform)
        (root / filename).write_bytes(payload)
        digest = hashlib.sha256(payload).hexdigest()
        artifact_hashes[platform] = digest
        artifact_payload[platform] = {"filename": filename, "sha256": digest}
        checksum_lines.append(f"{digest}  {filename}")

    desktop_artifacts: dict[str, dict[str, str]] = {}
    for platform in desktop_platforms:
        desktop_name = collector.desktop_artifact_filename(
            VERSION,
            platform,
            build_kind=build_kind,
            tag=tag,
            source_sha=SOURCE_SHA,
        )
        desktop_payload = f"synthetic-{platform}-desktop-artifact".encode("ascii")
        (root / desktop_name).write_bytes(desktop_payload)
        desktop_digest = hashlib.sha256(desktop_payload).hexdigest()
        checksum_lines.append(f"{desktop_digest}  {desktop_name}")
        desktop_artifacts[platform] = {"filename": desktop_name, "sha256": desktop_digest}
    installer_artifacts = {}
    installer_manifest = {}
    if unified:
        source_records = {}
        for platform in platforms:
            source_name = f"webcodex-source-v{VERSION}-{platform}.json"
            guarded_cli_info = {"schema_version": 1, "binary": "webcodex", "version": VERSION, "git_commit": SOURCE_SHA, "git_dirty": False, "windows_guarded_bootstrap_contract": 1}
            source_payload = json.dumps({
                "schema_version": 1,
                "version": VERSION,
                "source_sha": SOURCE_SHA,
                "source_workflow_run_id": RUN_ID,
                "source_workflow_ref": f"{collector.DEFAULT_REPO}/.github/workflows/release-build.yml@refs/tags/v{VERSION}" if guarded else "test/.github/workflows/release-build.yml@refs/tags/v0.4.3",
                **({"artifacts": {"webcodex": {"build_info": guarded_cli_info, "build_info_sha256": hashlib.sha256(json.dumps(guarded_cli_info, sort_keys=True, separators=(",", ":")).encode()).hexdigest()}}} if guarded and platform.startswith("win32-") else {}),
                "platform": platform,
            }).encode()
            (root / source_name).write_bytes(source_payload)
            source_digest = hashlib.sha256(source_payload).hexdigest()
            checksum_lines.append(f"{source_digest}  {source_name}")
            source_records[platform] = (source_name, source_digest)
        for target, (platform, package_format) in installer_targets.items():
            filename = collector.installer_artifact_filename(VERSION, target)
            magic = {
                "deb": b"!<arch>\n",
                "rpm": bytes.fromhex("edabeedb"),
                "pkg": b"xar!",
                "exe": b"MZ",
            }[package_format]
            payload = magic + b"synthetic installer"
            (root / filename).write_bytes(payload)
            digest = hashlib.sha256(payload).hexdigest()
            checksum_lines.append(f"{digest}  {filename}")
            source_name, source_digest = source_records[platform]
            installer_artifacts[target] = {
                "filename": filename,
                "sha256": digest,
                "source_manifest_filename": source_name,
                "source_manifest_sha256": source_digest,
                **({
                    "inner_sha256": hashlib.sha256(b"inner payload").hexdigest(),
                    "candidate_manifest_sha256": source_digest if guarded else hashlib.sha256(b"candidate manifest").hexdigest(),
                } if platform.startswith("win32-") else {}),
            }
            installer_manifest[target] = {
                "platform": platform,
                "format": package_format,
                "filename": filename,
                "url": f"https://github.com/{collector.DEFAULT_REPO}/releases/download/v{VERSION}/{filename}",
                "sha256": digest,
                "source_manifest_url": f"https://github.com/{collector.DEFAULT_REPO}/releases/download/v{VERSION}/{source_name}",
                "source_manifest_sha256": source_digest,
            }
    (root / "SHA256SUMS").write_text("\n".join(checksum_lines) + "\n", encoding="ascii")
    if platform_scope == "all":
        (root / "linux-x64-elf.txt").write_text("ELF x64\n", encoding="utf-8")
        (root / "linux-arm64-elf.txt").write_text("ELF arm64\n", encoding="utf-8")
    release_build = {
        **scope_marker,
        "tag": tag,
        "version": VERSION,
        "source_sha": SOURCE_SHA,
        "built_at": 1234567890,
        "build_kind": build_kind,
        "workflow_run_id": RUN_ID,
        "archive_stem": stem,
        "artifacts": artifact_payload,
        "desktop_artifacts": desktop_artifacts,
        **({"installer_artifacts": installer_artifacts} if unified else {}),
    }
    (root / "release-build.json").write_text(json.dumps(release_build) + "\n", encoding="utf-8")
    if build_kind == "release":
        manifest = {
            **scope_marker,
            "version": VERSION,
            "binaries": list(collector.BINARIES),
            **({"installers": installer_manifest} if unified else {}),
            "artifacts": {
                platform: {
                    "url": f"https://github.com/{collector.DEFAULT_REPO}/releases/download/v{VERSION}/{stem}-{platform}.tar.gz",
                    "sha256": artifact_hashes[platform],
                }
                for platform in platforms
            },
        }
        (root / "manifest.json").write_text(json.dumps(manifest) + "\n", encoding="utf-8")
        if unified:
            checksum_lines.append(f"{collector.sha256_file(root / 'manifest.json')}  manifest.json")
            (root / "SHA256SUMS").write_text("\n".join(checksum_lines) + "\n", encoding="ascii")
    if platform_scope == "windows":
        name = "webcodex-release-manifest.json"
        (root / name).write_text(json.dumps({"schema_version": 1, "release_version": VERSION,
            "runtime_version": VERSION, "desktop_runtime_contract": {"min_generation": 1, "max_generation": 1}}))
        digest = collector.sha256_file(root / name)
        release_build["runtime_manifest"] = {"filename": name, "sha256": digest}
        (root / "release-build.json").write_text(json.dumps(release_build) + "\n", encoding="utf-8")
        checksum_lines.append(f"{digest}  {name}")
        (root / "SHA256SUMS").write_text("\n".join(checksum_lines) + "\n", encoding="ascii")
    return stem, artifact_hashes


class WindowsBundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.stem, _ = _write_bundle(self.root, f"v{VERSION}", "release", unified=True, guarded=True, platform_scope="windows")
        self.kwargs = dict(repo=collector.DEFAULT_REPO, run_id=RUN_ID,
            expected_source_sha=SOURCE_SHA, expected_tag=f"v{VERSION}",
            artifact_name=f"{self.stem}-bundle", require_unified_installers=True,
            platform_scope="windows")

    def verify(self, **changes):
        return collector.verify_bundle_directory(self.root, **(self.kwargs | changes))

    def refresh_checksums(self):
        path = self.root / "SHA256SUMS"
        names = [line.split("  ", 1)[1] for line in path.read_text().splitlines()]
        path.write_text("".join(f"{collector.sha256_file(self.root / name)}  {name}\n" for name in names))

    def test_windows_requires_both_native_architectures_and_explicit_scope(self):
        summary = self.verify()
        self.assertEqual(summary["platform_scope"], "windows")
        self.assertEqual(set(summary["artifacts"]), set(WINDOWS_PLATFORMS))
        self.assertEqual(set(summary["desktop_artifacts"]), set(WINDOWS_PLATFORMS))
        self.assertEqual(set(summary["installer_artifacts"]), {f"{p}-exe" for p in WINDOWS_PLATFORMS})
        self.assertEqual(len(list(self.root.iterdir())), 12)
        for changes in ({"platform_scope": "all"}, {"require_unified_installers": False},
                        {"require_runtime_installers": True}, {"platform_scope": "linux"},
                        {"platform_scope": "Windows"}, {"platform_scope": ""}):
            with self.subTest(changes=changes), self.assertRaises(collector.CollectionError):
                self.verify(**changes)

    def test_windows_scope_marker_cannot_be_omitted_changed_or_inferred(self):
        for filename in ("release-build.json", "manifest.json"):
            path = self.root / filename
            original = path.read_bytes()
            for marker in (None, "all", "linux", "Windows", False):
                with self.subTest(file=filename, marker=marker):
                    document = json.loads(original)
                    if marker is None:
                        document.pop("platform_scope")
                    else:
                        document["platform_scope"] = marker
                    path.write_text(json.dumps(document))
                    self.refresh_checksums()
                    with self.assertRaisesRegex(collector.CollectionError, "scope"):
                        self.verify()
            path.write_bytes(original)
            self.refresh_checksums()

    def test_windows_rejects_each_missing_program_package_source_or_metadata_file(self):
        for path in list(self.root.iterdir()):
            with self.subTest(name=path.name):
                original = path.read_bytes()
                path.unlink()
                with self.assertRaises(collector.CollectionError):
                    self.verify()
                path.write_bytes(original)

    def test_windows_runtime_contract_cannot_be_dropped_from_an_otherwise_consistent_bundle(self):
        path = self.root / "release-build.json"
        build = json.loads(path.read_text()); build.pop("runtime_manifest")
        path.write_text(json.dumps(build))
        (self.root / "webcodex-release-manifest.json").unlink()
        sums = self.root / "SHA256SUMS"
        sums.write_text("".join(line + "\n" for line in sums.read_text().splitlines()
            if not line.endswith("  webcodex-release-manifest.json")))
        with self.assertRaisesRegex(collector.CollectionError, "missing its Runtime compatibility manifest"):
            self.verify()

    def test_windows_rejects_missing_architecture_or_extra_platform_in_each_metadata_set(self):
        path = self.root / "release-build.json"
        original = json.loads(path.read_text())
        for field, missing, extra in (("artifacts", "win32-arm64", "linux-x64"),
                                      ("desktop_artifacts", "win32-arm64", "darwin-arm64"),
                                      ("installer_artifacts", "win32-arm64-exe", "linux-x64-deb")):
            for remove in (True, False):
                with self.subTest(field=field, remove=remove):
                    changed = json.loads(json.dumps(original))
                    if remove:
                        del changed[field][missing]
                    else:
                        changed[field][extra] = dict(changed[field][missing])
                    path.write_text(json.dumps(changed))
                    with self.assertRaises(collector.CollectionError):
                        self.verify()

    def test_windows_rejects_non_windows_runtime_installers_npm_and_unselected_files(self):
        for name in (f"webcodex-v{VERSION}-linux-x64.tar.gz", f"webcodex-desktop-v{VERSION}-darwin-arm64.dmg",
                     f"webcodex-unified-v{VERSION}-linux-x64.deb", f"webcodex-runtime-v{VERSION}-linux-x64.deb",
                     "webcodex-npm.tgz", "linux-x64-elf.txt", "manifest-v2.json"):
            with self.subTest(name=name):
                path = self.root / name
                path.write_bytes(b"unselected fixture")
                with self.assertRaisesRegex(collector.CollectionError, "file set mismatch"):
                    self.verify()
                path.unlink()

    def test_windows_retains_actual_payload_and_source_checksum_validation(self):
        for path in list(self.root.iterdir()):
            if path.name in ("release-build.json", "SHA256SUMS"):
                continue
            with self.subTest(name=path.name):
                original = path.read_bytes()
                path.write_bytes(original + b"changed bytes")
                with self.assertRaisesRegex(collector.CollectionError, "SHA-256"):
                    self.verify()
                path.write_bytes(original)

    def test_windows_rejects_rehashed_foreign_source_run_and_candidate_binding(self):
        platform = "win32-arm64"
        source_path = self.root / f"webcodex-source-v{VERSION}-{platform}.json"
        build_path = self.root / "release-build.json"
        manifest_path = self.root / "manifest.json"
        originals = {path: path.read_bytes() for path in (source_path, build_path, manifest_path)}
        for field, bad in (("source_sha", "b" * 40), ("source_workflow_run_id", RUN_ID + 1),
                           ("source_workflow_ref", f"foreign/repo/.github/workflows/release-build.yml@refs/tags/v{VERSION}"),
                           ("platform", "win32-x64")):
            with self.subTest(field=field):
                source = json.loads(originals[source_path]); source[field] = bad
                source_path.write_text(json.dumps(source))
                digest = collector.sha256_file(source_path)
                build = json.loads(originals[build_path])
                entry = build["installer_artifacts"][f"{platform}-exe"]
                entry["source_manifest_sha256"] = entry["candidate_manifest_sha256"] = digest
                build_path.write_text(json.dumps(build))
                manifest = json.loads(originals[manifest_path])
                manifest["installers"][f"{platform}-exe"]["source_manifest_sha256"] = digest
                manifest_path.write_text(json.dumps(manifest))
                self.refresh_checksums()
                with self.assertRaisesRegex(collector.CollectionError, "same-source outer provenance"):
                    self.verify()
        for path, data in originals.items():
            path.write_bytes(data)
        self.refresh_checksums()
        build = json.loads(originals[build_path])
        build["installer_artifacts"][f"{platform}-exe"]["candidate_manifest_sha256"] = "c" * 64
        build_path.write_text(json.dumps(build))
        with self.assertRaisesRegex(collector.CollectionError, "same-source outer provenance"):
            self.verify()

    def test_explicit_all_retains_the_original_full_contract_without_marker(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stem, _ = _write_bundle(root, f"v{VERSION}", "release", unified=True)
            kwargs = {key: value for key, value in self.kwargs.items() if key != "platform_scope"}
            kwargs["artifact_name"] = f"{stem}-bundle"
            implicit = collector.verify_bundle_directory(root, **kwargs)
            self.assertEqual(implicit, collector.verify_bundle_directory(root, **kwargs, platform_scope="all"))
            self.assertNotIn("platform_scope", implicit)
            self.assertNotIn("platform_scope", json.loads((root / "release-build.json").read_text()))
            self.assertNotIn("platform_scope", json.loads((root / "manifest.json").read_text()))


class RedirectSafetyTests(unittest.TestCase):
    def test_cross_host_redirect_drops_github_api_credentials(self) -> None:
        request = urllib.request.Request(
            "https://api.github.com/repos/yyjeqhc/webcodex/actions/artifacts/1/zip",
            headers={
                "Authorization": "Bearer secret-value",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": collector.API_VERSION,
                "User-Agent": collector.USER_AGENT,
            },
        )
        redirected = collector._SafeRedirectHandler().redirect_request(
            request,
            None,
            302,
            "Found",
            {},
            "https://results-receiver.actions.githubusercontent.com/signed-artifact",
        )
        self.assertIsNotNone(redirected)
        assert redirected is not None
        self.assertIsNone(redirected.get_header("Authorization"))
        self.assertIsNone(redirected.get_header("Accept"))
        self.assertIsNone(redirected.get_header("X-Github-Api-Version"))
        self.assertEqual(redirected.get_header("User-agent"), collector.USER_AGENT)


class ArtifactSelectionTests(unittest.TestCase):
    def test_requires_one_unexpired_bundle_bound_to_run_and_source(self) -> None:
        payload = {
            "total_count": 2,
            "artifacts": [
                {"id": 1, "name": "native-linux", "expired": False},
                {
                    "id": 2,
                    "name": "webcodex-v0.3.8-bundle",
                    "expired": False,
                    "size_in_bytes": 100,
                    "digest": "sha256:" + "b" * 64,
                    "workflow_run": {"id": RUN_ID, "head_sha": SOURCE_SHA},
                },
            ],
        }
        selected = collector.select_bundle_artifact(payload, RUN_ID, SOURCE_SHA)
        self.assertEqual(selected["id"], 2)
        duplicate = json.loads(json.dumps(payload))
        duplicate["artifacts"].append(dict(duplicate["artifacts"][1], id=3, name="other-bundle"))
        duplicate["total_count"] = 3
        with self.assertRaises(collector.CollectionError):
            collector.select_bundle_artifact(duplicate, RUN_ID, SOURCE_SHA)
        expired = json.loads(json.dumps(payload))
        expired["artifacts"][1]["expired"] = True
        with self.assertRaises(collector.CollectionError):
            collector.select_bundle_artifact(expired, RUN_ID, SOURCE_SHA)

    def test_run_requires_success_and_exact_source_independent_of_dispatch_ref(self) -> None:
        run = {
            "id": RUN_ID,
            "status": "completed",
            "conclusion": "success",
            "head_sha": SOURCE_SHA,
            "event": "workflow_dispatch",
            "path": collector.RELEASE_WORKFLOW_PATH,
            "head_branch": f"v{VERSION}",
        }
        collector.validate_run(run, RUN_ID, SOURCE_SHA)
        for key, bad in (("conclusion", "failure"), ("head_sha", "b" * 40)):
            changed = dict(run)
            changed[key] = bad
            with self.assertRaises(collector.CollectionError):
                collector.validate_run(changed, RUN_ID, SOURCE_SHA)

    def test_release_source_ref_validation(self) -> None:
        self.assertEqual(collector.normalize_source_ref("main"), "main")
        self.assertEqual(collector.normalize_source_ref(SOURCE_REF), SOURCE_REF)
        for value in ("feature/x", "release/foo", "refs/heads/main", "release/v0.4.3/extra"):
            with self.assertRaises(collector.CollectionError):
                collector.normalize_source_ref(value)


class BundleTests(unittest.TestCase):
    def test_required_unified_contract_cannot_be_downgraded_to_legacy(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stem, _ = _write_bundle(root, f"v{VERSION}", "release")
            kwargs = dict(repo=collector.DEFAULT_REPO, run_id=RUN_ID,
                          expected_source_sha=SOURCE_SHA, expected_tag=f"v{VERSION}",
                          artifact_name=f"{stem}-bundle")
            collector.verify_bundle_directory(root, **kwargs)
            with self.assertRaisesRegex(collector.CollectionError, "required unified installer"):
                collector.verify_bundle_directory(root, **kwargs, require_unified_installers=True)
            path = root / "release-build.json"
            metadata = json.loads(path.read_text())
            metadata["installer_artifacts"] = None
            path.write_text(json.dumps(metadata))
            for strict in (False, True):
                with self.assertRaisesRegex(collector.CollectionError, "eight unified installer"):
                    collector.verify_bundle_directory(root, **kwargs, require_unified_installers=strict)

    def test_strict_unified_contract_requires_all_sources_manifest_and_checksums(self):
        for missing in ("manifest.json", "SHA256SUMS",
                        f"webcodex-source-v{VERSION}-linux-x64.json",
                        collector.installer_artifact_filename(VERSION, "linux-arm64-rpm")):
            with self.subTest(missing=missing), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                stem, _ = _write_bundle(root, f"v{VERSION}", "release", unified=True)
                kwargs = dict(repo=collector.DEFAULT_REPO, run_id=RUN_ID,
                              expected_source_sha=SOURCE_SHA, expected_tag=f"v{VERSION}",
                              artifact_name=f"{stem}-bundle", require_unified_installers=True)
                collector.verify_bundle_directory(root, **kwargs)
                (root / missing).unlink()
                with self.assertRaises(collector.CollectionError):
                    collector.verify_bundle_directory(root, **kwargs)

    def test_release_bundle_contract_with_eight_unified_installer_targets(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stem, _hashes = _write_bundle(root, f"v{VERSION}", "release", unified=True)
            summary = collector.verify_bundle_directory(
                root,
                repo=collector.DEFAULT_REPO,
                run_id=RUN_ID,
                expected_source_sha=SOURCE_SHA,
                expected_tag=f"v{VERSION}",
                artifact_name=f"{stem}-bundle",
            )
            self.assertEqual(set(summary["installer_artifacts"]), set(collector.INSTALLER_TARGETS))
            self.assertEqual(
                summary["installer_artifacts"]["linux-x64-deb"]["filename"],
                f"webcodex-unified-v{VERSION}-linux-x64.deb",
            )
            self.assertEqual(
                summary["installer_artifacts"]["linux-x64-rpm"]["filename"],
                f"webcodex-unified-v{VERSION}-linux-x64.rpm",
            )
            self.assertEqual(
                summary["installer_artifacts"]["linux-x64-deb"]["source_manifest_sha256"],
                summary["installer_artifacts"]["linux-x64-rpm"]["source_manifest_sha256"],
            )
            (root / summary["installer_artifacts"]["win32-x64-exe"]["filename"]).write_bytes(b"broken")
            with self.assertRaises(collector.CollectionError):
                collector.verify_bundle_directory(
                    root,
                    repo=collector.DEFAULT_REPO,
                    run_id=RUN_ID,
                    expected_source_sha=SOURCE_SHA,
                    expected_tag=f"v{VERSION}",
                    artifact_name=f"{stem}-bundle",
                )

    def test_guarded_capability_must_match_same_built_outer_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stem, _ = _write_bundle(root, f"v{VERSION}", "release", unified=True, guarded=True)
            kwargs = dict(repo=collector.DEFAULT_REPO, run_id=RUN_ID, expected_source_sha=SOURCE_SHA,
                expected_tag=f"v{VERSION}", artifact_name=f"{stem}-bundle")
            summary = collector.verify_bundle_directory(root, **kwargs)
            self.assertNotIn("guarded_handoff_version", summary["installer_artifacts"]["win32-x64-exe"])
            build = json.loads((root / "release-build.json").read_text())
            build["installer_artifacts"]["win32-x64-exe"]["candidate_manifest_sha256"] = "c" * 64
            (root / "release-build.json").write_text(json.dumps(build))
            with self.assertRaisesRegex(collector.CollectionError, "capability does not match"):
                collector.verify_bundle_directory(root, **kwargs)

    def test_release_bundle_rejects_tampered_public_source_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stem, _ = _write_bundle(root, f"v{VERSION}", "release", unified=True)
            source_name = f"webcodex-source-v{VERSION}-linux-x64.json"
            (root / source_name).write_bytes(b"tampered")
            with self.assertRaisesRegex(collector.CollectionError, "source manifest SHA-256 mismatch"):
                collector.verify_bundle_directory(
                    root,
                    repo=collector.DEFAULT_REPO,
                    run_id=RUN_ID,
                    expected_source_sha=SOURCE_SHA,
                    expected_tag=f"v{VERSION}",
                    artifact_name=f"{stem}-bundle",
                )

    def test_release_bundle_contract(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stem, hashes = _write_bundle(root, f"v{VERSION}", "release")
            summary = collector.verify_bundle_directory(
                root,
                repo=collector.DEFAULT_REPO,
                run_id=RUN_ID,
                expected_source_sha=SOURCE_SHA,
                expected_tag=f"v{VERSION}",
                artifact_name=f"{stem}-bundle",
            )
            self.assertEqual(summary["artifacts"], hashes)
            self.assertEqual(summary["build_kind"], "release")
            self.assertNotIn("darwin-x64", summary["desktop_artifacts"])
            self.assertEqual(
                summary["desktop_artifacts"]["darwin-arm64"]["filename"],
                f"webcodex-desktop-v{VERSION}-darwin-arm64.dmg",
            )
            self.assertEqual(
                summary["desktop_artifacts"]["win32-x64"]["filename"],
                f"webcodex-desktop-v{VERSION}-win32-x64-setup.exe",
            )
            self.assertEqual(
                summary["desktop_artifacts"]["win32-arm64"]["filename"],
                f"webcodex-desktop-v{VERSION}-win32-arm64-setup.exe",
            )

    def test_release_bundle_rejects_missing_desktop(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stem, _hashes = _write_bundle(root, f"v{VERSION}", "release")
            metadata = json.loads((root / "release-build.json").read_text(encoding="utf-8"))
            desktop_name = metadata["desktop_artifacts"]["darwin-arm64"]["filename"]
            (root / desktop_name).unlink()
            with self.assertRaises(collector.CollectionError):
                collector.verify_bundle_directory(
                    root,
                    repo=collector.DEFAULT_REPO,
                    run_id=RUN_ID,
                    expected_source_sha=SOURCE_SHA,
                    expected_tag=f"v{VERSION}",
                    artifact_name=f"{stem}-bundle",
                )

    def test_release_bundle_rejects_desktop_digest_drift(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stem, _hashes = _write_bundle(root, f"v{VERSION}", "release")
            metadata = json.loads((root / "release-build.json").read_text(encoding="utf-8"))
            desktop_name = metadata["desktop_artifacts"]["darwin-arm64"]["filename"]
            (root / desktop_name).write_bytes(b"drifted-dmg")
            with self.assertRaises(collector.CollectionError):
                collector.verify_bundle_directory(
                    root,
                    repo=collector.DEFAULT_REPO,
                    run_id=RUN_ID,
                    expected_source_sha=SOURCE_SHA,
                    expected_tag=f"v{VERSION}",
                    artifact_name=f"{stem}-bundle",
                )

    def test_release_bundle_rejects_unexpected_desktop_filename(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stem, _hashes = _write_bundle(root, f"v{VERSION}", "release")
            metadata_path = root / "release-build.json"
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            item = metadata["desktop_artifacts"]["darwin-arm64"]
            old_name = item["filename"]
            bad_name = f"webcodex-desktop-v{VERSION}-macos-arm64.dmg"
            (root / old_name).rename(root / bad_name)
            item["filename"] = bad_name
            metadata_path.write_text(json.dumps(metadata) + "\n", encoding="utf-8")
            with self.assertRaises(collector.CollectionError):
                collector.verify_bundle_directory(
                    root,
                    repo=collector.DEFAULT_REPO,
                    run_id=RUN_ID,
                    expected_source_sha=SOURCE_SHA,
                    expected_tag=f"v{VERSION}",
                    artifact_name=f"{stem}-bundle",
                )

    def test_verification_bundle_has_no_manifest(self) -> None:
        tag = "release-build-test-collector"
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stem, _hashes = _write_bundle(root, tag, "verification")
            summary = collector.verify_bundle_directory(
                root,
                repo=collector.DEFAULT_REPO,
                run_id=RUN_ID,
                expected_source_sha=SOURCE_SHA,
                expected_tag=tag,
                artifact_name=f"{stem}-bundle",
            )
            self.assertEqual(summary["build_kind"], "verification")
            (root / "manifest.json").write_text("{}\n", encoding="utf-8")
            with self.assertRaises(collector.CollectionError):
                collector.verify_bundle_directory(
                    root,
                    repo=collector.DEFAULT_REPO,
                    run_id=RUN_ID,
                    expected_source_sha=SOURCE_SHA,
                    expected_tag=tag,
                    artifact_name=f"{stem}-bundle",
                )

    def test_missing_bundle_metadata_is_a_clean_collection_error(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with self.assertRaises(collector.CollectionError):
                collector.verify_bundle_directory(
                    root,
                    repo=collector.DEFAULT_REPO,
                    run_id=RUN_ID,
                    expected_source_sha=SOURCE_SHA,
                    expected_tag=f"v{VERSION}",
                    artifact_name=f"webcodex-v{VERSION}-bundle",
                )

    def test_bundle_rejects_archive_digest_drift(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stem, _hashes = _write_bundle(root, f"v{VERSION}", "release")
            target = root / f"{stem}-linux-x64.tar.gz"
            target.write_bytes(target.read_bytes() + b"drift")
            with self.assertRaises(collector.CollectionError):
                collector.verify_bundle_directory(
                    root,
                    repo=collector.DEFAULT_REPO,
                    run_id=RUN_ID,
                    expected_source_sha=SOURCE_SHA,
                    expected_tag=f"v{VERSION}",
                    artifact_name=f"{stem}-bundle",
                )

    def test_safe_zip_extraction_rejects_nested_entries(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = root / "artifact.zip"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("../escape", b"bad")
            with self.assertRaises(collector.CollectionError):
                collector.safe_extract_zip(path, root / "extract")
            self.assertFalse((root / "escape").exists())



class RuntimeManifestBundleTests(unittest.TestCase):
    def add_manifest(self, directory: Path, *, corrupt: bool = False) -> None:
        path = directory / "webcodex-release-manifest.json"
        value = {
            "schema_version": 1,
            "release_version": VERSION,
            "runtime_version": VERSION,
            "desktop_runtime_contract": {"min_generation": 1, "max_generation": 1},
        }
        if corrupt:
            value["desktop_runtime_contract"]["min_generation"] = 0
        path.write_text(json.dumps(value) + "\n", encoding="utf-8")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        metadata_path = directory / "release-build.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["runtime_manifest"] = {"filename": path.name, "sha256": digest}
        metadata_path.write_text(json.dumps(metadata) + "\n", encoding="utf-8")
        sums = directory / "SHA256SUMS"
        sums.write_text(
            sums.read_text(encoding="ascii") + f"{digest}  {path.name}\n",
            encoding="ascii",
        )

    def verify(self, directory: Path) -> dict:
        return collector.verify_bundle_directory(
            directory,
            repo=collector.DEFAULT_REPO,
            run_id=RUN_ID,
            expected_source_sha=SOURCE_SHA,
            expected_tag=f"v{VERSION}",
            artifact_name=f"webcodex-v{VERSION}-bundle",
        )

    def test_valid_manifest_is_collected_with_strict_digest_identity(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _write_bundle(root, f"v{VERSION}", "release")
            self.add_manifest(root)
            summary = self.verify(root)
            self.assertEqual(
                summary["runtime_manifest"]["filename"],
                "webcodex-release-manifest.json",
            )

    def test_invalid_contract_rejected_even_when_checksums_match(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _write_bundle(root, f"v{VERSION}", "release")
            self.add_manifest(root, corrupt=True)
            with self.assertRaises(collector.CollectionError):
                self.verify(root)

    def test_present_but_null_manifest_is_not_legacy_absence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _write_bundle(root, f"v{VERSION}", "release")
            path = root / "release-build.json"
            value = json.loads(path.read_text(encoding="utf-8"))
            value["runtime_manifest"] = None
            path.write_text(json.dumps(value) + "\n", encoding="utf-8")
            with self.assertRaises(collector.CollectionError):
                self.verify(root)

if __name__ == "__main__":
    unittest.main()
