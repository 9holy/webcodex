#!/usr/bin/env python3
"""Assemble the two native Windows producers without selecting unrelated platforms."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile

if __package__:
    from . import collect_release_bundle as collector
    from . import desktop_runtime_manifest as runtime_manifest
    from . import package_unified_installer as packaging
    from . import prepare_release_metadata as metadata
    from .release_platform_scope import WINDOWS_PLATFORMS
else:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scripts import collect_release_bundle as collector
    from scripts import desktop_runtime_manifest as runtime_manifest
    from scripts import package_unified_installer as packaging
    from scripts import prepare_release_metadata as metadata
    from scripts.release_platform_scope import WINDOWS_PLATFORMS


def assemble(source: Path, output: Path, *, repo: str, version: str, source_sha: str,
             run_id: int, built_at: int, workflow_ref: str) -> dict:
    if (not collector.VERSION_RE.fullmatch(version)
            or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo)
            or not re.fullmatch(r"[0-9a-f]{40}", source_sha)
            or type(run_id) is not int or run_id <= 0
            or type(built_at) is not int or built_at <= 0
            or workflow_ref != f"{repo}/.github/workflows/release-build.yml@refs/tags/v{version}"):
        raise ValueError("Windows assembly requires the exact immutable release identity")

    expected: set[str] = set()
    public: set[str] = set()
    for platform in WINDOWS_PLATFORMS:
        names = (metadata.archive_filename(version, platform), metadata.desktop_filename(version, platform),
                 metadata.installer_filename(version, f"{platform}-exe"), metadata.source_manifest_filename(version, platform))
        public.update(names)
        expected.update(names)
        expected.update(f"{name}.sha256" for name in names)
        stem = f"webcodex-unified-v{version}-{platform}"
        expected.update((f"{stem}.exe.provenance.json", f"{stem}.source-manifest.json", f"{stem}.candidate-SHA256SUMS"))
    children = list(source.iterdir())
    if any(path.is_symlink() or not path.is_file() for path in children) or {p.name for p in children} != expected:
        raise ValueError("Windows same-run candidate set is incomplete or contains unexpected entries")
    for name in public:
        sums = collector._parse_sha256sums(collector._read_bounded(source / f"{name}.sha256", 1024).decode("ascii"), {name})
        if collector.sha256_file(source / name) != sums[name]:
            raise ValueError(f"native Windows candidate checksum mismatch: {name}")

    output.mkdir()
    for name in public:
        shutil.copyfile(source / name, output / name)
    subprocess.run([
        sys.executable, str(Path(metadata.__file__).resolve()), "--version", version,
        "--platform-scope", "windows", "--require-unified-installers", "--repo", repo,
        "--source-sha", source_sha, "--workflow-run-id", str(run_id), "--workflow-ref", workflow_ref,
        "--artifact-dir", str(source), "--output-dir", str(output),
    ], check=True, stdin=subprocess.DEVNULL, timeout=120)

    artifacts, desktops, installers, contracts = {}, {}, {}, []
    for platform in WINDOWS_PLATFORMS:
        archive_name = metadata.archive_filename(version, platform)
        desktop_name = metadata.desktop_filename(version, platform)
        installer_name = metadata.installer_filename(version, f"{platform}-exe")
        source_name = metadata.source_manifest_filename(version, platform)
        source_digest = collector.sha256_file(source / source_name)
        candidate = collector._read_json(source / source_name, collector.MAX_MANIFEST_BYTES)
        evidence = collector._read_json(source / f"{installer_name}.provenance.json", collector.MAX_MANIFEST_BYTES)
        sums = packaging.parse_sha256sums(source / f"webcodex-unified-v{version}-{platform}.candidate-SHA256SUMS")
        marker = candidate["artifacts"]["webcodex"]["build_info"].get("windows_guarded_bootstrap_contract")
        if (type(marker) is not int or marker != 1
                or type(evidence.get("guarded_handoff_version")) is not int or evidence["guarded_handoff_version"] != 1
                or sums.get("source-manifest.json") != source_digest
                or evidence["candidate_manifest_sha256"] != source_digest
                or evidence["inner_installer_sha256"] != collector.sha256_file(source / desktop_name)):
            raise ValueError("Windows bootstrap must contain the exact verified standard Desktop installer")
        for name, record in candidate["artifacts"].items():
            if sums.get(record["path"]) != record["sha256"]:
                raise ValueError(f"Windows candidate does not bind the installed program hash: {name}")
        with tarfile.open(source / archive_name, "r:gz") as archive:
            for member in archive:
                if member.isfile():
                    binary = member.name.removeprefix("./").removesuffix(".exe")
                    stream = archive.extractfile(member)
                    assert stream is not None
                    digest = hashlib.sha256()
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        digest.update(chunk)
                    if digest.hexdigest() != candidate["artifacts"][binary]["sha256"]:
                        raise ValueError(f"Windows runtime archive differs from installed program bytes: {binary}")
        artifacts[platform] = {"filename": archive_name, "sha256": collector.sha256_file(source / archive_name)}
        desktops[platform] = {"filename": desktop_name, "sha256": collector.sha256_file(source / desktop_name)}
        installers[f"{platform}-exe"] = {
            "filename": installer_name, "sha256": collector.sha256_file(source / installer_name),
            "source_manifest_filename": source_name, "source_manifest_sha256": source_digest,
            "inner_sha256": evidence["inner_installer_sha256"], "candidate_manifest_sha256": source_digest,
        }
        contracts.append(runtime_manifest.from_builds(
            [candidate["artifacts"][name]["build_info"] for name in runtime_manifest.BINARIES], version))

    # The manifest advertises the common protocol range from both native builds.
    contract = runtime_manifest.validate({**contracts[0], "desktop_runtime_contract": {
        "min_generation": max(c["desktop_runtime_contract"]["min_generation"] for c in contracts),
        "max_generation": min(c["desktop_runtime_contract"]["max_generation"] for c in contracts),
    }}, version)
    metadata.atomic_write(output / runtime_manifest.NAME, json.dumps(contract, indent=2) + "\n")
    sums_path = output / "SHA256SUMS"
    with sums_path.open("a", encoding="ascii") as stream:
        stream.write(f"{collector.sha256_file(output / runtime_manifest.NAME)}  {runtime_manifest.NAME}\n")
    payload = {
        "platform_scope": "windows", "tag": f"v{version}", "version": version,
        "source_sha": source_sha, "built_at": built_at, "build_kind": "release", "workflow_run_id": run_id,
        "archive_stem": f"webcodex-v{version}", "artifacts": artifacts, "desktop_artifacts": desktops,
        "installer_artifacts": installers,
        "runtime_manifest": {"filename": runtime_manifest.NAME, "sha256": collector.sha256_file(output / runtime_manifest.NAME)},
    }
    metadata.atomic_write(output / "release-build.json", json.dumps(payload, indent=2) + "\n")
    return collector.verify_bundle_directory(
        output, repo=repo, run_id=run_id, expected_source_sha=source_sha, expected_tag=f"v{version}",
        artifact_name=f"webcodex-v{version}-bundle", require_unified_installers=True, platform_scope="windows")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=Path("candidate-input"))
    parser.add_argument("--output-dir", type=Path, default=Path("release-bundle"))
    args = parser.parse_args()
    if (os.environ.get("BUILD_KIND") != "release" or os.environ.get("INCLUDE_UNIFIED_INSTALLERS") != "true"
            or os.environ.get("INCLUDE_RUNTIME_INSTALLERS", "false") != "false"
            or os.environ.get("RELEASE_PLATFORM_SCOPE") != "windows"
            or os.environ["INPUT_TAG"] != f"v{os.environ['VERSION']}"):
        raise SystemExit("Windows assembly requires the explicitly selected Windows full release")
    result = assemble(args.input_dir, args.output_dir, repo=os.environ["GITHUB_REPOSITORY"],
        version=os.environ["VERSION"], source_sha=os.environ["SOURCE_SHA"], run_id=int(os.environ["GITHUB_RUN_ID"]),
        built_at=int(os.environ["WEBCODEX_BUILT_AT"]), workflow_ref=os.environ["GITHUB_WORKFLOW_REF"])
    print(f"Assembled Windows release {result['tag']}: both native architectures, complete installers and source manifests")


if __name__ == "__main__":
    main()
