#!/usr/bin/env python3
"""Read-only repository acceptance of frozen public Windows release bytes.

Only explicitly selected, reviewed fixed controllers may dispatch this worker.
The worker installs on disposable native runners; it cannot publish, promote,
overwrite, or repair release assets. The controller checks its bounded report.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile

if __package__:
    from . import release_github_actions as control
    from . import verify_public_release as public
else:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scripts import release_github_actions as control
    from scripts import verify_public_release as public

WORKFLOW = "release-windows-acceptance.yml"
PLATFORMS = ("win32-x64", "win32-arm64")
SCENARIOS = ("fresh", "unconfigured", "configured")
V056_SCENARIOS = (*SCENARIOS, "v054_unconfigured", "v054_configured")
V054_SOURCE = "1af9bb5321edcdc16a4f1a5be65d0611ef19964a"
V054_INSTALLERS = {
    "win32-x64": ("6dbaa9075541d44a2c4f22075409abdb43f25a0a41f50aa26fc73cc137f9cc8e", 34433088),
    "win32-arm64": ("b233872dc776d2a706235ac5fcc593b7949f7b38d878dd7de099ec7e513ad180", 30388573),
}
MAX_REQUEST_BYTES = 64 * 1024
MAX_REPORT_BYTES = 192 * 1024
PINNED = {
    "win32-x64": (
        "dcc391d0c26e3334c60967c269fffff20312e2b059e61f3f1140779ffacdb6c6",
        "7a43d294780f8af8a3e22853d81065ccca4546fda1e8316156a2dad9b9c812ab",
        "95cb8d1d9b3756e531a48f85032d7aeb0771fe141ec09940b308f25fdc6a1be6"),
    "win32-arm64": (
        "9d3692b3d9309b82ec987565d140dd9226a6d1473d2e67e5f9d675a3250a52b2",
        "fb1df58e03411df2ef195dea2c3bff960538d792a203c08a3f5c40475056fa59",
        "8afad1e47fd515913030dc94a15af0bb6a8f34b7d741086d4dbd7fe6a5a4c0c9"),
}
require = control._require


def scenarios_for_request(request: dict) -> tuple[str, ...]:
    if (request.get("tag"), request.get("controller_workflow")) in {
            ("v0.5.6", ".github/workflows/release-publish-v056.yml"),
            ("v0.5.7", ".github/workflows/release-publish-v057.yml")}:
        return V056_SCENARIOS
    return SCENARIOS


def request_digest(request: dict) -> str:
    return hashlib.sha256(control._json_bytes(request)).hexdigest()


def run_name(request: dict) -> str:
    return f"Verify Windows release {request['tag']} {request['request_id']}"


def artifact_name(platform: str, run_id: int, attempt: int) -> str:
    require(platform in PLATFORMS and control._positive_int(run_id) and control._positive_int(attempt),
            "Windows 验收附件身份无效。")
    return f"windows-release-acceptance-{platform}-{run_id}-{attempt}"


def validate_request(request: dict, spec: control.ReleaseSpec) -> None:
    fields = {"schema_version", "repo", "repo_id", "tag", "source_sha", "control_sha", "request_id",
              "controller_run_id", "controller_workflow", "release_id", "tag_object_sha",
              "build_run_id", "build_run_attempt", "release_body_sha256", "assets"}
    require(isinstance(request, dict) and set(request) == fields
            and type(request.get("schema_version")) is int and request["schema_version"] == 1,
            "Windows 验收请求字段无效。")
    for key in ("repo", "repo_id", "tag", "source_sha"):
        require(type(request[key]) is type(spec.pinned_request[key]) and request[key] == spec.pinned_request[key],
                "Windows 验收请求不属于已审核的固定源码。")
    require(request["controller_workflow"] == spec.workflow_path
            and re.fullmatch(r"wa_[0-9a-f]{32}", str(request["request_id"])) is not None,
            "Windows 验收控制器或请求身份无效。")
    require(all(control._positive_int(request[key]) for key in
                ("controller_run_id", "release_id", "build_run_id", "build_run_attempt")),
            "Windows 验收运行或 Release 编号无效。")
    require(all(re.fullmatch(r"[0-9a-f]{40}", str(request[key])) is not None
                for key in ("source_sha", "control_sha", "tag_object_sha"))
            and re.fullmatch(r"[0-9a-f]{64}", str(request["release_body_sha256"])) is not None,
            "Windows 验收摘要无效。")
    assets = request["assets"]
    require(isinstance(assets, dict) and 1 <= len(assets) <= 33, "Windows 验收缺少冻结资产。")
    for name, asset in assets.items():
        control._validate_asset_description(asset)
        require(name == asset["name"], "Windows 验收资产索引无效。")
    if spec.platform_scope == "windows":
        version = spec.pinned_request["version"]
        expected = {"SHA256SUMS", "manifest.json", "webcodex-release-manifest.json"}
        for platform in PLATFORMS:
            expected.update((public.canonical_archive_name(version, platform),
                             public.canonical_source_manifest_name(version, platform),
                             public.canonical_installer_name(version, f"{platform}-exe"),
                             public.canonical_desktop_name(version, platform)))
        require(set(assets) == expected, "Windows 单独发布必须冻结两架构的完整 11 项资产。")
    require(len(control._json_bytes(request)) <= MAX_REQUEST_BYTES, "Windows 验收请求超出大小限制。")


def select_release_spec(request: dict) -> control.ReleaseSpec:
    """Select one code-owned authority; request fields never define its pins."""
    require(isinstance(request, dict), "Windows 验收请求必须是固定身份对象。")
    identity = (request.get("tag"), request.get("controller_workflow"))
    if identity == ("v0.5.4", ".github/workflows/release-publish-v054.yml"):
        from scripts.release_github_actions_v054 import SPEC, require_finalized
    elif identity == ("v0.5.5", ".github/workflows/release-publish-v055.yml"):
        from scripts.release_github_actions_v055 import SPEC, require_finalized
    elif identity == ("v0.5.6", ".github/workflows/release-publish-v056.yml"):
        from scripts.release_github_actions_v056 import SPEC, require_finalized
    elif identity == ("v0.5.7", ".github/workflows/release-publish-v057.yml"):
        from scripts.release_github_actions_v057 import SPEC, require_finalized
    else:
        raise control.ReleaseControlError("Windows 验收请求不属于已审核的固定发布入口。")
    require_finalized(SPEC)
    validate_request(request, SPEC)
    return SPEC


def validate_run(run: dict, request: dict, *, run_id: int, attempt: int, owner_id: int) -> None:
    require(control._positive_int(run_id) and control._positive_int(attempt), "Windows 验收运行编号无效。")
    expected = {"id": run_id, "run_attempt": attempt, "path": f".github/workflows/{WORKFLOW}",
                "event": "workflow_dispatch", "head_branch": "main", "head_sha": request["control_sha"],
                "display_title": run_name(request)}
    require(all(type(run.get(key)) is type(value) and run.get(key) == value for key, value in expected.items()),
            "Windows 验收运行、尝试次数或控制源码不一致。")
    for key in ("repository", "head_repository"):
        require(run.get(key, {}).get("id") == request["repo_id"]
                and run.get(key, {}).get("full_name") == request["repo"], "Windows 验收运行来自其他仓库。")
    require(run.get("actor", {}).get("id") == control.BOT_ID
            and run.get("actor", {}).get("login") == control.BOT_LOGIN,
            "Windows 验收必须来自已绑定发布器的机器 dispatch。")
    if attempt > 1:
        require(run.get("triggering_actor", {}).get("id") == owner_id
                and run.get("triggering_actor", {}).get("login") == request["repo"].split("/")[0],
                "Windows 验收重跑必须由仓库所有者发起。")


def validate_public_assets(release: dict, request: dict, *, platform_scope: str = "all") -> dict:
    require(release.get("id") == request["release_id"] and bool(release.get("published_at"))
            and release.get("name") == f"WebCodex {request['tag']}"
            and release.get("author", {}).get("id") == control.BOT_ID
            and release.get("author", {}).get("login") == control.BOT_LOGIN
            and hashlib.sha256(str(release.get("body", "")).encode()).hexdigest() == request["release_body_sha256"],
            "Windows 验收 Release 身份或说明已改变。")
    assets = public.validate_github_assets(release, request["tag"][1:], unified_installers=True,
                                           expected_prerelease=True,
                                           **control.release_scope.metadata(platform_scope))
    require(set(assets) == set(request["assets"]), "预发布资产集合与冻结记录不同。")
    base = f"https://github.com/{request['repo']}/releases/download/{request['tag']}"
    for name, asset in assets.items():
        control.validate_asset(asset, request["assets"][name])
        require(asset.get("browser_download_url") == f"{base}/{name}", "预发布资产 URL 不属于固定 Release。")
    return assets


def validate_report(report: dict, request: dict, platform: str, run_id: int, attempt: int) -> None:
    require(isinstance(report, dict) and type(report.get("schema_version")) is int and report["schema_version"] == 1
            and report.get("kind") == "windows-release-acceptance"
            and report.get("request_sha256") == request_digest(request)
            and report.get("platform") == platform and type(report.get("workflow_run_id")) is int
            and report["workflow_run_id"] == run_id and type(report.get("workflow_run_attempt")) is int
            and report["workflow_run_attempt"] == attempt and report.get("passed") is True,
            "Windows 原生验收报告身份不符或未通过。")
    scenarios = report.get("scenarios")
    expected_scenarios = scenarios_for_request(request)
    require(isinstance(scenarios, dict) and set(scenarios) == set(expected_scenarios)
            and all(value is True for value in scenarios.values()), "Windows 规定的完整安装场景未全部通过。")
    programs = validate_configured_report(report.get("configured"), request, platform)
    if expected_scenarios == SCENARIOS:
        return
    exits = report.get("scenario_exit_codes", {})
    require(isinstance(exits, dict) and set(exits) == set(expected_scenarios)
            and all(type(value) is int and value == 0 for value in exits.values()),
            "Windows 五种实际安装 helper 未全部成功退出。")
    previous_hash, previous_size = V054_INSTALLERS[platform]
    version = request["tag"][1:]
    # This receipt records the frozen inputs passed to the existing real PS
    # helper. Exit 0 also requires its installed hashes, identity and cleanup.
    expected = {
        "previous_version": "0.5.4", "previous_source_sha": V054_SOURCE,
        "previous_installer_sha256": previous_hash, "previous_installer_size": previous_size,
        "candidate_installer_sha256": request["assets"][f"webcodex-unified-v{version}-{platform}.exe"]["sha256"],
        "candidate_source_manifest_sha256": request["assets"][f"webcodex-source-v{version}-{platform}.json"]["sha256"],
        "program_sha256": programs,
    }
    receipt = report.get("v054_unconfigured")
    require(isinstance(receipt, dict) and set(receipt) == set(expected)
            and all(type(receipt.get(key)) is type(value) and receipt.get(key) == value
                    for key, value in expected.items()),
            "0.5.4 未配置升级未绑定固定旧安装包及候选四程序验证输入。")
    native = report.get("v054_configured")
    require(validate_configured_report(native, request, platform) == programs,
            "两次配置升级的候选四程序摘要不同。")
    from scripts.windows_unified_upgrade_smoke import PLATFORMS as native_platforms
    _, target, architecture = native_platforms[platform]
    previous = native.get("upstream_runtime")
    expected = {
        "version": "0.5.4", "git_commit": V054_SOURCE, "git_dirty": False,
        "target": target, "architecture": architecture,
    }
    require(isinstance(previous, dict) and set(previous) == set(expected)
            and all(type(previous.get(key)) is type(value) and previous.get(key) == value
                    for key, value in expected.items())
            and native.get("inputs", {}).get("previous_installer_sha256") == previous_hash,
            "实际配置升级并非固定的 0.5.4 安装及对应原生架构。")
    outer = native.get("candidate_outer", {})
    require(isinstance(outer, dict) and type(outer.get("exit_code")) is int and outer["exit_code"] == 0
            and all(outer.get(key) is True for key in ("exact_native_programs", "private_state_preserved",
                "original_directory_preserved", "unrelated_process_alive")),
            "0.5.4 配置升级未证实实际程序替换及原状态、目录和无关进程保持。")


def validate_configured_report(native: dict, request: dict, platform: str) -> dict:
    require(isinstance(native, dict) and native.get("platform") == platform
            and native.get("mode") == "verify_candidate" and native.get("passed") is True
            and native.get("complete_upgrade_verified") is True
            and native.get("verdict") == "verified_real_unified_upgrade"
            and native.get("cleanup", {}).get("complete") is True,
            "分类或 harness 成功不能替代真实完整包升级验收。")
    candidate = native.get("candidate_runtime", {})
    require(candidate.get("version") == request["tag"][1:]
            and candidate.get("git_commit") == request["source_sha"] and candidate.get("git_dirty") is False,
            "Windows 原生升级报告的候选源码不一致。")
    version = request["tag"][1:]
    installer = f"webcodex-unified-v{version}-{platform}.exe"
    require(native.get("inputs", {}).get("candidate_installer_sha256") == request["assets"][installer]["sha256"],
            "Windows 实际验收安装包不是冻结的公开字节。")
    manifest = native.get("candidate_source_manifest", {})
    require(isinstance(manifest, dict), "Windows manifest 验收报告无效。")
    expected = {"sha256": request["assets"][f"webcodex-source-v{version}-{platform}.json"]["sha256"],
                "version": version, "source_sha": request["source_sha"], "platform": platform,
                "source_workflow_run_id": request["build_run_id"],
                "source_workflow_ref": f"{request['repo']}/.github/workflows/release-build.yml@refs/tags/{request['tag']}",
                "runtime_archive_bytes_verified": True}
    require(all(type(manifest.get(key)) is type(value) and manifest.get(key) == value
                for key, value in expected.items()), "Windows 原生升级未核对公开 source manifest 和同 run Runtime 字节。")
    programs = manifest.get("program_sha256", {})
    require(isinstance(programs, dict) and set(programs) == {"webcodex", "webcodex-server", "webcodex-runner", "webcodex-desktop"}
            and all(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) for value in programs.values()),
            "Windows 原生升级报告缺少四个程序摘要。")
    return programs


def _download(url: str, path: Path, expected: str, size: int | None = None) -> None:
    actual_size, actual_digest = public.download_file(url, path, public.MAX_INSTALLER_BYTES, 120)
    require(actual_digest == expected and (size is None or actual_size == size), "Windows 验收下载字节或大小不符。")


def helper_failure(stdout: bytes, stderr: bytes) -> dict:
    """Project known helper failures into fixed codes, never return child text."""
    output = stdout + b"\n" + stderr
    patterns = (
        ("installed_program_hash", rb"installed (?:webcodex|webcodex-server|webcodex-runner|webcodex-desktop) bytes differ from the frozen public source manifest"),
        ("runtime_identity", rb"unexpected installed webcodex(?:-server|-runner)?\.exe identity"),
        ("installation_directory", rb"(?:custom Desktop InstallLocation mismatch|upstream Desktop did not honor the isolated custom installation directory)"),
        ("data_preservation", rb"upstream-to-candidate upgrade changed the existing Desktop data fixture"),
        ("unrelated_process", rb"upstream-to-candidate upgrade terminated an unrelated same-name process"),
        ("registry_missing", rb"(?:Desktop installer|upstream Desktop) did not register"),
        ("cleanup", rb"(?:Desktop uninstall entry remained|Desktop installer-owned (?:payload|files) remained|Desktop install directory remained)"),
        ("desktop_architecture", rb"(?:installed Desktop executable is not a PE image|installed Desktop must use the Windows GUI subsystem|installed Desktop executable has an invalid PE|installed Desktop architecture mismatch)"),
    )
    result = {"code": next((code for code, pattern in patterns if re.search(pattern, output)), "unknown_helper_failure")}
    match = re.search(rb"(?:Desktop silent install|pinned upstream Desktop installer) failed with exit code (-?[0-9]{1,11})(?![0-9])", output)
    if match is not None:
        value = int(match[1])
        if -(2 ** 31) <= value <= 2 ** 32 - 1:
            result.update(code="installer_exit", installer_exit_code=value)
    # A CLI may emit a structured diagnostic during preflight. Only the same
    # bounded code vocabulary used by the native regression can leave this worker.
    from scripts.windows_unified_upgrade_smoke import DIAGNOSTIC_CODES
    codes = {value.decode("ascii") for value in re.findall(rb'"code"\s*:\s*"([a-z_]{1,64})"', output)}
    safe = sorted(codes.intersection(DIAGNOSTIC_CODES))
    if safe:
        result["product_diagnostic_codes"] = safe
    return result


def execute(request: dict, platform: str, root: Path, report: dict, *, spec: control.ReleaseSpec) -> None:
    from scripts import windows_unified_upgrade_smoke as smoke
    env = os.environ
    report["phase"] = "identity"
    validate_request(request, spec)
    native_arch = env.get("PROCESSOR_ARCHITEW6432") or env.get("PROCESSOR_ARCHITECTURE", "")
    require(os.name == "nt" and native_arch.upper() == smoke.PLATFORMS[platform][0], "必须使用对应架构的原生 Windows runner。")
    require(env.get("GITHUB_REPOSITORY") == request["repo"] and env.get("GITHUB_SHA") == request["control_sha"]
            and env.get("GITHUB_WORKFLOW_SHA") == request["control_sha"]
            and env.get("GITHUB_REF") == "refs/heads/main"
            and env.get("GITHUB_WORKFLOW_REF") == f"{request['repo']}/.github/workflows/{WORKFLOW}@refs/heads/main"
            and env.get("GITHUB_ACTOR") == control.BOT_LOGIN, "Windows worker 控制身份不一致。")
    run_id, attempt = int(env["GITHUB_RUN_ID"]), int(env["GITHUB_RUN_ATTEMPT"])
    client = control.collector.GitHubClient(request["repo"], env.get("GH_TOKEN") or env.get("GITHUB_TOKEN"), 60)
    validate_run(client.fetch_json(f"/actions/runs/{run_id}/attempts/{attempt}"), request,
                 run_id=run_id, attempt=attempt, owner_id=spec.pinned_request["owner_id"])
    parent = client.fetch_json(f"/actions/runs/{request['controller_run_id']}")
    require(parent.get("id") == request["controller_run_id"] and parent.get("path") == spec.workflow_path
            and parent.get("head_sha") == request["control_sha"]
            and parent.get("head_branch") == "main" and parent.get("repository", {}).get("id") == request["repo_id"]
            and parent.get("head_repository", {}).get("id") == request["repo_id"]
            and parent.get("event") in {"push", "workflow_dispatch"}
            and parent.get("actor", {}).get("id") == spec.pinned_request["owner_id"]
            and parent.get("actor", {}).get("login") == spec.pinned_request["owner"], "Windows 验收发布器身份不一致。")
    tag = client.fetch_json(f"/git/ref/tags/{request['tag']}")
    require(tag.get("object", {}).get("type") == "tag" and tag["object"].get("sha") == request["tag_object_sha"], "验收 tag 对象发生变化。")
    annotated = client.fetch_json(f"/git/tags/{request['tag_object_sha']}")
    require(annotated.get("object", {}).get("type") == "commit"
            and annotated["object"].get("sha") == request["source_sha"], "验收 tag 不属于固定源码。")
    build = client.fetch_json(f"/actions/runs/{request['build_run_id']}/attempts/{request['build_run_attempt']}")
    require(build.get("id") == request["build_run_id"] and build.get("run_attempt") == request["build_run_attempt"]
            and build.get("path") == ".github/workflows/release-build.yml" and build.get("event") == "workflow_dispatch"
            and build.get("head_sha") == request["source_sha"] and build.get("head_branch") == request["tag"]
            and build.get("repository", {}).get("id") == request["repo_id"]
            and build.get("head_repository", {}).get("id") == request["repo_id"]
            and build.get("status") == "completed" and build.get("conclusion") == "success", "验收原生构建身份或成功证据不符。")
    assets = validate_public_assets(client.fetch_json(f"/releases/{request['release_id']}"), request,
                                    **control.release_scope.metadata(spec.platform_scope))
    report["phase"] = "download"
    root.mkdir(parents=True, exist_ok=False)
    version = request["tag"][1:]
    selected = {
        "installer": f"webcodex-unified-v{version}-{platform}.exe",
        "runtime": f"webcodex-v{version}-{platform}.tar.gz",
        "manifest": f"webcodex-source-v{version}-{platform}.json",
    }
    paths = {}
    for key, name in selected.items():
        paths[key] = root / name
        _download(assets[name]["browser_download_url"], paths[key], request["assets"][name]["sha256"], request["assets"][name]["size"])
    public.inspect_archive(paths["runtime"], platform, root / "candidate-runtime")
    previous_hash, published_hash, runtime_hash = PINNED[platform]
    fixtures = {
        "previous": (f"https://github.com/yyjeqhc/webcodex/releases/download/v0.5.0/webcodex-desktop-v0.5.0-{platform}-setup.exe", previous_hash),
        "published": (f"https://github.com/9holy/webcodex/releases/download/v0.5.3/webcodex-unified-v0.5.3-{platform}.exe", published_hash),
        "published_runtime": (f"https://github.com/9holy/webcodex/releases/download/v0.5.3/webcodex-v0.5.3-{platform}.tar.gz", runtime_hash),
    }
    for key, (url, digest) in fixtures.items():
        paths[key] = root / url.rsplit("/", 1)[1]
        _download(url, paths[key], digest)
    include_v054 = scenarios_for_request(request) == V056_SCENARIOS
    if include_v054:
        name = f"webcodex-desktop-v0.5.4-{platform}-setup.exe"
        paths["previous_v054"] = root / name
        _download(f"https://github.com/9holy/webcodex/releases/download/v0.5.4/{name}",
                  paths["previous_v054"], *V054_INSTALLERS[platform])
    public.inspect_archive(paths["published_runtime"], platform, root / "published-runtime")
    manifest = smoke.verify_candidate_manifest(paths["manifest"], request["assets"][selected["manifest"]]["sha256"],
        version=version, source=request["source_sha"], platform=platform,
        build_run_id=request["build_run_id"], runtime_dir=root / "candidate-runtime" / platform)
    built_at = manifest.get("artifacts", {}).get("webcodex", {}).get("build_info", {}).get("built_at")
    require(isinstance(built_at, (str, int)) and str(built_at).isdigit() and int(built_at) > 0, "候选 manifest 缺少构建时间。")
    # Children need public HTTPS, never repository or artifact credentials.
    child_env = {key: value for key, value in env.items() if key not in
                 {"GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"}}
    scripts = Path(__file__).resolve().parent
    hashes = root / "expected-program-hashes.json"
    program_hashes = {name: record["sha256"] for name, record in manifest["artifacts"].items()}
    hashes.write_bytes(control._json_bytes(program_hashes))
    require(bool(env.get("APPDATA")), "原生 runner 缺少默认配置路径。")
    default_environment = Path(env["APPDATA"]) / "webcodex" / "environment"
    require(not default_environment.exists(), "全新验收 runner 已有默认 Environment；不接触已有环境。")
    # Use the actual per-user installation parent's ACL, as the configured
    # native regression does; RUNNER_TEMP is only a download workspace.
    install_root = Path(tempfile.mkdtemp(prefix="webcodex-acceptance-", dir=env["LOCALAPPDATA"]))
    desktop_scenarios = [("fresh", None, None), ("unconfigured", paths["previous"], previous_hash)]
    if include_v054:
        desktop_scenarios.append(("v054_unconfigured", paths["previous_v054"], V054_INSTALLERS[platform][0]))
    for scenario, previous_installer, installer_hash in desktop_scenarios:
        report["phase"] = scenario
        require(not (default_environment / "environment.json").exists(), "未配置升级场景出现了已有 Environment。")
        command = ["pwsh", "-NoLogo", "-NoProfile", "-NonInteractive", "-File", str(scripts / "desktop_install_windows_smoke.ps1"),
                   "-Installer", str(paths["installer"]), "-Version", version, "-SourceSha", request["source_sha"],
                   "-BuiltAt", str(built_at), "-Platform", platform, "-InstallDir", str(install_root / f"{scenario} Desktop"),
                   "-ExpectedProgramHashes", str(hashes)]
        if previous_installer is not None:
            command.extend(["-PreviousInstaller", str(previous_installer), "-PreviousInstallerSha256", installer_hash])
        result = smoke.run_command(command, f"real {scenario} outer", timeout=600, env=child_env)
        report.setdefault("scenario_exit_codes", {})[scenario] = result.returncode
        if result.returncode:
            report.setdefault("helper_failures", {})[scenario] = helper_failure(result.stdout, result.stderr)
        require(result.returncode == 0, f"Windows {scenario} 完整安装包验收失败。")
        report["scenarios"][scenario] = True
        if scenario == "v054_unconfigured":
            report[scenario] = {
                "previous_version": "0.5.4", "previous_source_sha": V054_SOURCE,
                "previous_installer_sha256": installer_hash, "previous_installer_size": V054_INSTALLERS[platform][1],
                "candidate_installer_sha256": request["assets"][selected["installer"]]["sha256"],
                "candidate_source_manifest_sha256": request["assets"][selected["manifest"]]["sha256"],
                "program_sha256": program_hashes,
            }
    install_root.rmdir()  # Only the empty directory this worker created.
    configured_scenarios = [("configured", paths["previous"], previous_hash)]
    if include_v054:
        configured_scenarios.append(("v054_configured", paths["previous_v054"], V054_INSTALLERS[platform][0]))
    for scenario, previous_installer, installer_hash in configured_scenarios:
        report["phase"] = scenario
        native_report = root / f"{scenario}-report.json"
        command = [sys.executable, str(scripts / "windows_unified_upgrade_smoke.py"), "--verify-candidate", "--platform", platform,
                   "--previous-installer", str(previous_installer), "--previous-installer-sha256", installer_hash]
        if scenario == "configured":
            command.extend(["--published-installer", str(paths["published"]), "--published-installer-sha256", published_hash,
                            "--published-cli", str(root / "published-runtime" / platform / "webcodex.exe")])
        else:
            command.extend(["--previous-version", "0.5.4"])
        command.extend([
            "--candidate-installer", str(paths["installer"]), "--candidate-installer-sha256", request["assets"][selected["installer"]]["sha256"],
            "--candidate-cli", str(root / "candidate-runtime" / platform / "webcodex.exe"),
            "--candidate-version", version, "--candidate-source-sha", request["source_sha"],
            "--candidate-build-run-id", str(request["build_run_id"]),
            "--candidate-source-manifest", str(paths["manifest"]),
            "--candidate-source-manifest-sha256", request["assets"][selected["manifest"]]["sha256"],
            "--report", str(native_report)])
        result = smoke.run_command(command, f"real {scenario} outer", timeout=1200, env=child_env)
        report.setdefault("scenario_exit_codes", {})[scenario] = result.returncode
        if native_report.is_file():
            report[scenario] = control._read_json(native_report)
        require(result.returncode == 0, f"Windows {scenario} 完整安装包验收失败。")
        report["scenarios"][scenario] = True
    validate_public_assets(client.fetch_json(f"/releases/{request['release_id']}"), request,
                           **control.release_scope.metadata(spec.platform_scope))
    report["passed"] = True
    validate_report(report, request, platform, run_id, attempt)
    report["phase"] = "complete"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", required=True, choices=PLATFORMS)
    parser.add_argument("--inputs-root", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args(argv)
    report = {"schema_version": 1, "kind": "windows-release-acceptance", "platform": args.platform,
              "workflow_run_id": int(os.environ.get("GITHUB_RUN_ID", "0")),
              "workflow_run_attempt": int(os.environ.get("GITHUB_RUN_ATTEMPT", "0")),
              "passed": False, "scenarios": dict.fromkeys(SCENARIOS, False)}
    try:
        raw = os.environ.get("WEBCODEX_WINDOWS_ACCEPTANCE_REQUEST", "").encode()
        require(0 < len(raw) <= MAX_REQUEST_BYTES, "缺少有界固定 Windows 验收请求。")
        request = control._parse_json(raw)
        spec = select_release_spec(request)
        report["request_sha256"] = request_digest(request)
        report["scenarios"] = dict.fromkeys(scenarios_for_request(request), False)
        execute(request, args.platform, args.inputs_root.absolute(), report, spec=spec)
    except Exception as error:
        # Native CLI stdout/stderr and generated Environment credentials are not logs.
        report["passed"] = False
        report["failure_type"] = type(error).__name__
    finally:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        payload = control._json_bytes(report)
        if len(payload) > MAX_REPORT_BYTES:
            report["passed"] = False
            payload = control._json_bytes({"passed": False, "failure_type": "ReportLimit"})
        args.report.write_bytes(payload)
    print(json.dumps({"passed": report["passed"], "platform": args.platform, "report": str(args.report)}))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
