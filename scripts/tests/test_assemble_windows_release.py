from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

from scripts import assemble_windows_release as assembly
from scripts.tests.test_collect_release_bundle import _archive_bytes, WINDOWS_PLATFORMS


class WindowsReleaseAssemblyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "native-inputs"
        self.source.mkdir()
        self.version = json.loads((assembly.metadata.ROOT / "npm/webcodex/package.json").read_text())["version"]
        self.identity = dict(repo="9holy/webcodex", version=self.version, source_sha="a" * 40,
            run_id=123, built_at=456,
            workflow_ref=f"9holy/webcodex/.github/workflows/release-build.yml@refs/tags/v{self.version}")
        self.outputs = 0
        for platform, target, architecture, lower, upper in (
            ("win32-x64", "x86_64-pc-windows-msvc", "x86_64", 1, 3),
            ("win32-arm64", "aarch64-pc-windows-msvc", "aarch64", 2, 4),
        ):
            contract = {"min_generation": lower, "max_generation": upper}
            records = {}
            for binary in (*assembly.metadata.BINARIES, "webcodex-desktop"):
                payload = f"{platform}:{binary}".encode()
                info = {"schema_version": 1, "binary": binary, "version": self.version,
                    "git_commit": self.identity["source_sha"], "git_dirty": False, "built_at": "456",
                    "target": target, "architecture": architecture, "desktop_runtime_contract": contract,
                    "environment_data_format": 1}
                if binary == "webcodex":
                    info["windows_guarded_bootstrap_contract"] = 1
                records[binary] = {"path": f"artifacts/bin/{binary}.exe",
                    "sha256": hashlib.sha256(payload).hexdigest(), "build_info": info,
                    "build_info_sha256": hashlib.sha256(json.dumps(info, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
                    "probe": "native-build-job"}
            source = {"schema_version": 1, "version": self.version, "source_sha": self.identity["source_sha"],
                "source_workflow_run_id": 123, "source_workflow_ref": self.identity["workflow_ref"],
                "platform": platform, "target": target, "architecture": architecture,
                "desktop_runtime_contract": contract, "artifacts": records, "desktop_payload": {}}
            source_name = assembly.metadata.source_manifest_filename(self.version, platform)
            source_raw = (json.dumps(source) + "\n").encode()
            self.write_public(source_name, source_raw)
            self.write_public(assembly.metadata.archive_filename(self.version, platform), _archive_bytes(platform))
            desktop_name = assembly.metadata.desktop_filename(self.version, platform)
            self.write_public(desktop_name, f"MZstandard:{platform}".encode())
            installer_name = assembly.metadata.installer_filename(self.version, f"{platform}-exe")
            self.write_public(installer_name, f"MZouter:{platform}".encode())
            stem = installer_name.removesuffix(".exe")
            (self.source / f"{stem}.source-manifest.json").write_bytes(source_raw)
            source_digest = hashlib.sha256(source_raw).hexdigest()
            evidence = {"schema_version": 1, "guarded_handoff_version": 1,
                "platform": platform, "version": self.version, "source_sha": self.identity["source_sha"],
                "workflow_run_id": 123, "workflow_ref": self.identity["workflow_ref"],
                "candidate_manifest_sha256": source_digest,
                "inner_installer_sha256": assembly.collector.sha256_file(self.source / desktop_name),
                "installer_sha256": assembly.collector.sha256_file(self.source / installer_name)}
            (self.source / f"{installer_name}.provenance.json").write_text(json.dumps(evidence))
            (self.source / f"{stem}.candidate-SHA256SUMS").write_text(
                f"{source_digest}  source-manifest.json\n" + "".join(f"{record['sha256']}  {record['path']}\n" for record in records.values()))

    def write_public(self, name: str, payload: bytes):
        (self.source / name).write_bytes(payload)
        (self.source / f"{name}.sha256").write_text(f"{hashlib.sha256(payload).hexdigest()}  {name}\n")

    def assemble(self, **identity):
        self.outputs += 1
        self.output = self.root / f"bundle-{self.outputs}"
        return assembly.assemble(self.source, self.output, **(self.identity | identity))

    def test_assembles_exact_dual_architecture_bundle_from_unchanged_native_inputs(self):
        before = {path.name: path.read_bytes() for path in self.source.iterdir()}
        self.assertEqual(len(before), 22)
        summary = self.assemble()
        self.assertEqual(summary["platform_scope"], "windows")
        self.assertEqual(set(summary["artifacts"]), set(WINDOWS_PLATFORMS))
        self.assertEqual(set(summary["desktop_artifacts"]), set(WINDOWS_PLATFORMS))
        self.assertEqual(set(summary["installer_artifacts"]), {f"{p}-exe" for p in WINDOWS_PLATFORMS})
        contract = json.loads((self.output / "webcodex-release-manifest.json").read_text())
        self.assertEqual(contract["desktop_runtime_contract"], {"min_generation": 2, "max_generation": 3})
        self.assertEqual(len(list(self.output.iterdir())), 12)
        self.assertEqual(len((self.output / "SHA256SUMS").read_text().splitlines()), 10)
        self.assertEqual(before, {path.name: path.read_bytes() for path in self.source.iterdir()})
        for platform in WINDOWS_PLATFORMS:
            for name in (assembly.metadata.archive_filename(self.version, platform),
                         assembly.metadata.desktop_filename(self.version, platform),
                         assembly.metadata.installer_filename(self.version, f"{platform}-exe"),
                         assembly.metadata.source_manifest_filename(self.version, platform)):
                self.assertEqual((self.output / name).read_bytes(), before[name])

    def test_rejects_each_missing_native_input_before_creating_output(self):
        for path in list(self.source.iterdir()):
            with self.subTest(missing=path.name):
                original = path.read_bytes(); path.unlink()
                with self.assertRaisesRegex(ValueError, "candidate set"):
                    self.assemble()
                self.assertFalse(self.output.exists())
                path.write_bytes(original)

    def test_rejects_non_windows_input_and_wrong_build_identity(self):
        for name in (f"webcodex-v{self.version}-linux-x64.tar.gz", "npm-package.tgz"):
            path = self.source / name; path.write_bytes(b"unexpected")
            with self.subTest(extra=name), self.assertRaisesRegex(ValueError, "candidate set"):
                self.assemble()
            self.assertFalse(self.output.exists()); path.unlink()
        for changed in ({"run_id": True}, {"source_sha": "bad"}, {"repo": "../foreign"},
                        {"workflow_ref": self.identity["workflow_ref"].replace("9holy", "foreign")},
                        {"built_at": 0}):
            with self.subTest(identity=changed), self.assertRaisesRegex(ValueError, "immutable release identity"):
                self.assemble(**changed)
            self.assertFalse(self.output.exists())

    def test_rejects_each_changed_public_candidate_even_with_unmodified_sidecar(self):
        for sidecar in self.source.glob("*.sha256"):
            path = sidecar.with_suffix("")
            original = path.read_bytes(); path.write_bytes(original + b"changed")
            with self.subTest(name=path.name), self.assertRaisesRegex(ValueError, "candidate checksum"):
                self.assemble()
            self.assertFalse(self.output.exists()); path.write_bytes(original)

    def test_rejects_wrong_standard_inner_digest(self):
        name = assembly.metadata.installer_filename(self.version, "win32-arm64-exe") + ".provenance.json"
        path = self.source / name
        evidence = json.loads(path.read_text()); evidence["inner_installer_sha256"] = "b" * 64
        path.write_text(json.dumps(evidence))
        with self.assertRaisesRegex(ValueError, "exact verified standard Desktop"):
            self.assemble()

    def test_guarded_handoff_cannot_be_downgraded_to_a_consistent_legacy_source(self):
        platform = "win32-arm64"
        source_name = assembly.metadata.source_manifest_filename(self.version, platform)
        source = json.loads((self.source / source_name).read_text())
        record = source["artifacts"]["webcodex"]
        record["build_info"].pop("windows_guarded_bootstrap_contract")
        record["build_info_sha256"] = hashlib.sha256(json.dumps(record["build_info"], sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        raw = (json.dumps(source) + "\n").encode()
        self.write_public(source_name, raw)
        installer_name = assembly.metadata.installer_filename(self.version, f"{platform}-exe")
        stem = installer_name.removesuffix(".exe")
        (self.source / f"{stem}.source-manifest.json").write_bytes(raw)
        digest = hashlib.sha256(raw).hexdigest()
        evidence_path = self.source / f"{installer_name}.provenance.json"
        evidence = json.loads(evidence_path.read_text()); evidence.pop("guarded_handoff_version")
        evidence["candidate_manifest_sha256"] = digest
        evidence_path.write_text(json.dumps(evidence))
        sums = self.source / f"{stem}.candidate-SHA256SUMS"
        sums.write_text("".join((digest + line[64:] if line.endswith("  source-manifest.json") else line) + "\n"
            for line in sums.read_text().splitlines()))
        with self.assertRaisesRegex(ValueError, "exact verified standard Desktop"):
            self.assemble()

    def test_candidate_checksum_must_bind_each_of_the_four_installed_programs(self):
        stem = assembly.metadata.installer_filename(self.version, "win32-x64-exe").removesuffix(".exe")
        path = self.source / f"{stem}.candidate-SHA256SUMS"
        original = path.read_text()
        for binary in (*assembly.metadata.BINARIES, "webcodex-desktop"):
            changed = "".join(("0" * 64 + line[64:] if line.endswith(f"  artifacts/bin/{binary}.exe") else line) + "\n" for line in original.splitlines())
            path.write_text(changed)
            with self.subTest(binary=binary), self.assertRaisesRegex(ValueError, "installed program hash"):
                self.assemble()

    def test_recomputed_runtime_archive_checksum_cannot_hide_different_program_bytes(self):
        platform = "win32-arm64"
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
            for binary in assembly.metadata.BINARIES:
                payload = f"{platform}:{binary}".encode() + (b"changed" if binary == "webcodex-runner" else b"")
                member = tarfile.TarInfo(f"{binary}.exe"); member.size = len(payload)
                archive.addfile(member, io.BytesIO(payload))
        self.write_public(assembly.metadata.archive_filename(self.version, platform), buffer.getvalue())
        with self.assertRaisesRegex(ValueError, "archive differs from installed program bytes"):
            self.assemble()

    def test_existing_output_is_never_overwritten(self):
        output = self.root / "existing"
        output.mkdir(); (output / "retained").write_bytes(b"keep")
        with self.assertRaises(FileExistsError):
            assembly.assemble(self.source, output, **self.identity)
        self.assertEqual({path.name: path.read_bytes() for path in output.iterdir()}, {"retained": b"keep"})


if __name__ == "__main__":
    unittest.main()
