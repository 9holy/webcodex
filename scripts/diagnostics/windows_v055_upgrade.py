#!/usr/bin/env python3
"""Observe the frozen v0.5.5 Windows upgrade on disposable native runners.

This diagnostic never supplies formal acceptance evidence. It preserves the
reviewed CM55 helper and runs an exactly reversible, observation-only copy.
Only fixed stage names, exit integers and allowlisted CLI codes may leave it.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

CONTROL_SHA = "fa9c6e329109e8a5acdea060b1f0f74764a556d2"
SOURCE_SHA = "a596cec372232b1aa008cef676f61a8170fbf239"
HELPER_SHA256 = "a4cff6bde7c24441b9a9e5289e0e47ad87a977d9a8ad350c76988b794e757d9d"
REQUEST_SHA256 = "a4c6a5d09bc6ad5352cd5d78a7e43494e9b2eb2b0e0d3d3d0146bb9742fd8924"
REQUEST_BYTES = 6132
REQUEST_FILE = Path(__file__).resolve().parent / "fixtures/v055-acceptance-request.json"
PREFIX = "WEBCODEX_V055_DIAG:"
MAX_REPORT_BYTES = 64 * 1024
TOKENS = {"GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"}
DIAGNOSTIC_CODES = (
    "installer_owner", "upgrade_receipt_owner", "package_identity",
    "legacy_installation_incomplete", "unsafe_path", "state_path",
    "environment_io", "io_error", "home_unavailable", "setup_busy",
    "installer_registration", "installer_program_acl",
    "upgrade_restore_security", "upgrade_program_changed",
)


class DiagnosticFailure(RuntimeError):
    """Only code-owned constant messages are passed to this exception."""


def require(condition: bool, code: str) -> None:
    if not condition:
        raise DiagnosticFailure(code)


def read_request(path: Path = REQUEST_FILE) -> dict:
    with path.open("rb") as stream:
        raw = stream.read(REQUEST_BYTES + 1)
    require(len(raw) == REQUEST_BYTES and hashlib.sha256(raw).hexdigest() == REQUEST_SHA256,
            "frozen_request_changed")
    return json.loads(raw)


# This child runs only after the candidate outer has returned nonzero, before
# the original finally. It never performs prepare/finish/rollback. Classification
# can open the existing setup store/lock, so this is not a pre-install probe.
PROBE_SOURCE = r'''import hashlib,json,os,sys
from pathlib import Path
PREFIX = "WEBCODEX_V055_DIAG:classifier="
try:
    context_path = Path(os.environ["WEBCODEX_DIAG_CONTEXT"])
    with context_path.open("rb") as stream:
        raw = stream.read(16385)
    if len(raw) > 16384:
        raise ValueError()
    context = json.loads(raw)
    runtime = sys.argv[1]
    if os.path.normcase(os.path.abspath(runtime)) != os.path.normcase(context["runtime"]):
        raise ValueError()
    cli = Path(context["cli"])
    with cli.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != context["cli_sha256"]:
            raise ValueError()
    sys.path.insert(0, context["control_root"])
    from scripts.windows_unified_upgrade_smoke import run_command, classification
    result = run_command([str(cli), "environment", "installer-classify",
                          "--expected-runtime-dir", runtime, "--json"],
                         "post-failure classifier", timeout=45)
    observed = classification(result)
    value = {key: observed[key] for key in ("exit_code", "kind", "diagnostic_codes")}
except Exception:
    value = {"error": "probe_failed"}
print(PREFIX + json.dumps(value, separators=(",", ":"), sort_keys=True))
'''

PROBE_FUNCTION = r'''
function Invoke-WebCodexFailureObservation {
    try {
        & $env:WEBCODEX_DIAG_PYTHON -B $env:WEBCODEX_DIAG_PROBE (Join-Path $requestedInstallDir "webcodex-runtime") 2>$null
    } catch {
        Write-Output 'WEBCODEX_V055_DIAG:classifier={"error":"probe_failed"}'
    }
}
'''


def observation_insertions() -> tuple[tuple[str, str], ...]:
    previous = '        $previous = Start-Process -FilePath $PreviousInstaller -ArgumentList "/S /D=$requestedInstallDir" -Wait -PassThru\n'
    candidate = '    $installProcess = Start-Process -FilePath $Installer -ArgumentList $installArguments -Wait -PassThru\n'
    return (
        ('$ErrorActionPreference = "Stop"\n', '$ErrorActionPreference = "Stop"\n' + PROBE_FUNCTION),
        (previous, '        Write-Output "WEBCODEX_V055_DIAG:baseline_start"\n' + previous
         + '        Write-Output ("WEBCODEX_V055_DIAG:baseline_exit=" + [string][Int64]$previous.ExitCode)\n'),
        (candidate, '    Write-Output "WEBCODEX_V055_DIAG:candidate_start"\n' + candidate
         + '    Write-Output ("WEBCODEX_V055_DIAG:candidate_exit=" + [string][Int64]$installProcess.ExitCode)\n'
         + '    if ($installProcess.ExitCode -ne 0) { Invoke-WebCodexFailureObservation }\n'),
        ('} finally {\n    if ($unrelatedProcess) {',
         '} finally {\n    Write-Output "WEBCODEX_V055_DIAG:cleanup_start"\n    if ($unrelatedProcess) {'),
        ('}\n\nWrite-Output "Desktop uninstall smoke passed"',
         '    Write-Output "WEBCODEX_V055_DIAG:cleanup_complete"\n}\n\nWrite-Output "Desktop uninstall smoke passed"'),
    )


def instrument_helper(raw: bytes) -> bytes:
    require(hashlib.sha256(raw).hexdigest() == HELPER_SHA256, "control_helper_changed")
    text = raw.decode("utf-8")
    for old, new in observation_insertions():
        require(text.count(old) == 1, "observation_anchor_not_unique")
        text = text.replace(old, new, 1)
    instrumented = text.encode("utf-8")
    for old, new in reversed(observation_insertions()):
        require(text.count(new) == 1, "observation_reverse_not_unique")
        text = text.replace(new, old, 1)
    require(text.encode("utf-8") == raw, "observation_changed_original_bytes")
    return instrumented


def original_helper_bytes(root: Path, child_env: dict[str, str]) -> bytes:
    # Windows checkout line-ending conversion must not redefine the frozen
    # helper digest. Read the exact Git blob; never normalize unknown bytes.
    result = subprocess.run(["git", "-C", str(root), "show", "HEAD:scripts/desktop_install_windows_smoke.ps1"],
                            stdin=subprocess.DEVNULL, capture_output=True, timeout=30, env=child_env)
    require(result.returncode == 0 and len(result.stdout) <= 256 * 1024, "control_helper_blob")
    require(hashlib.sha256(result.stdout).hexdigest() == HELPER_SHA256, "control_helper_changed")
    return result.stdout


def exit_integer(value) -> bool:
    return type(value) is int and -(2 ** 31) <= value <= 2 ** 32 - 1


def fixed_codes(output: bytes) -> list[str]:
    text = output.decode("utf-8", errors="replace")
    return sorted(code for code in DIAGNOSTIC_CODES if re.search(
        rf'(?:"code"\s*:\s*"{re.escape(code)}"|(?<![a-z_]){re.escape(code)}:)', text))


def project_helper(stdout: bytes, stderr: bytes, returncode: int, scenario: str) -> dict:
    require(len(stdout) <= 256 * 1024 and len(stderr) <= 256 * 1024, "helper_output_bound")
    require(exit_integer(returncode) and scenario in ("fresh", "unconfigured"), "helper_result_invalid")
    result = {"helper_exit_code": returncode, "baseline_install": {"started": False, "exit_code": None},
              "candidate_outer": {"started": False, "exit_code": None},
              "cleanup": {"started": False, "complete": False},
              "outer_output_diagnostic_codes": fixed_codes(stdout + b"\n" + stderr)}
    seen = set()
    for line in stdout.decode("utf-8", errors="replace").splitlines():
        if not line.startswith(PREFIX):
            continue
        require(len(line) <= 2048, "observation_line_bound")
        event = line[len(PREFIX):]
        name, _, value = event.partition("=")
        require(name not in seen, "observation_duplicate")
        seen.add(name)
        require(len(seen) <= 7, "observation_count_bound")
        if name == "baseline_start":
            require(not value and scenario == "unconfigured" and not result["candidate_outer"]["started"]
                    and not result["cleanup"]["started"], "baseline_order")
            result["baseline_install"]["started"] = True
        elif name == "baseline_exit":
            require(result["baseline_install"]["started"] and not result["candidate_outer"]["started"] and not result["cleanup"]["started"]
                    and re.fullmatch(r"-?[0-9]{1,11}", value) is not None, "baseline_order")
            code = int(value)
            require(exit_integer(code), "baseline_exit_bound")
            result["baseline_install"]["exit_code"] = code
        elif name == "candidate_start":
            require(not value and not result["cleanup"]["started"]
                    and (scenario == "fresh" or result["baseline_install"]["exit_code"] == 0), "candidate_order")
            result["candidate_outer"]["started"] = True
        elif name == "candidate_exit":
            require(result["candidate_outer"]["started"] and not result["cleanup"]["started"]
                    and re.fullmatch(r"-?[0-9]{1,11}", value) is not None, "candidate_order")
            code = int(value)
            require(exit_integer(code), "candidate_exit_bound")
            result["candidate_outer"]["exit_code"] = code
        elif name == "classifier":
            code = result["candidate_outer"]["exit_code"]
            require(code is not None and code != 0 and not result["cleanup"]["started"], "classifier_order")
            observed = json.loads(value)
            if observed != {"error": "probe_failed"}:
                require(isinstance(observed, dict) and set(observed) == {"exit_code", "kind", "diagnostic_codes"}
                        and exit_integer(observed["exit_code"]) and observed["kind"] in (None, "fresh", "unconfigured", "environment")
                        and isinstance(observed["diagnostic_codes"], list)
                        and len(observed["diagnostic_codes"]) <= len(DIAGNOSTIC_CODES)
                        and len(set(observed["diagnostic_codes"])) == len(observed["diagnostic_codes"])
                        and all(code in DIAGNOSTIC_CODES for code in observed["diagnostic_codes"]), "classifier_projection")
            result["post_failure_classifier"] = observed
        elif name == "cleanup_start":
            require(not value, "cleanup_order")
            result["cleanup"]["started"] = True
        elif name == "cleanup_complete":
            require(not value and result["cleanup"]["started"], "cleanup_order")
            result["cleanup"]["complete"] = True
        else:
            raise DiagnosticFailure("observation_unknown_event")
    if returncode == 0:
        require(result["candidate_outer"]["exit_code"] == 0 and result["cleanup"]["complete"]
                and (scenario == "fresh" or result["baseline_install"]["exit_code"] == 0), "helper_success_incomplete")
    return result


def control_modules(root: Path, child_env: dict[str, str]):
    for argv in (["git", "-C", str(root), "rev-parse", "HEAD"],
                 ["git", "-C", str(root), "diff", "--exit-code", "HEAD", "--", "scripts"]):
        completed = subprocess.run(argv, stdin=subprocess.DEVNULL, capture_output=True, timeout=30, env=child_env)
        require(completed.returncode == 0, "control_checkout_changed")
        if "rev-parse" in argv:
            require(completed.stdout.decode().strip() == CONTROL_SHA, "control_checkout_identity")
    sys.path.insert(0, str(root))
    names = ("release_windows_acceptance", "windows_unified_upgrade_smoke", "verify_public_release")
    modules = tuple(importlib.import_module("scripts." + name) for name in names)
    for module in modules:
        require(Path(module.__file__).resolve().is_relative_to(root / "scripts"), "control_module_origin")
    require(tuple(modules[1].DIAGNOSTIC_CODES) == DIAGNOSTIC_CODES, "diagnostic_vocabulary_changed")
    return modules


def validate_powershell(smoke, helper: Path, child_env: dict[str, str], report: dict) -> None:
    script = ('$tokens=$null; $errors=$null; '
              '[void][System.Management.Automation.Language.Parser]::ParseFile('
              '$env:WEBCODEX_DIAG_OBSERVED_HELPER,[ref]$tokens,[ref]$errors); '
              'Write-Output ([int]$errors.Count); if ($errors.Count -ne 0) { exit 1 }')
    result = smoke.run_command(["pwsh", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
                              "observation syntax", timeout=30,
                              env={**child_env, "WEBCODEX_DIAG_OBSERVED_HELPER": str(helper)})
    count = result.stdout.strip()
    require(re.fullmatch(rb"[0-9]{1,6}", count) is not None, "observation_powershell_parser_output")
    report["powershell_syntax_error_count"] = int(count)
    require(result.returncode == 0 and count == b"0", "observation_powershell_syntax")


def verify_remote(client, worker, request: dict) -> dict:
    tag = client.fetch_json("/git/ref/tags/v0.5.5")
    require(tag.get("object", {}).get("type") == "tag" and tag["object"].get("sha") == request["tag_object_sha"], "tag_changed")
    annotated = client.fetch_json("/git/tags/" + request["tag_object_sha"])
    require(annotated.get("object", {}).get("type") == "commit"
            and annotated["object"].get("sha") == SOURCE_SHA, "tag_source_changed")
    build = client.fetch_json(f'/actions/runs/{request["build_run_id"]}/attempts/{request["build_run_attempt"]}')
    expected = {"id": request["build_run_id"], "run_attempt": request["build_run_attempt"],
                "path": ".github/workflows/release-build.yml", "event": "workflow_dispatch",
                "head_sha": SOURCE_SHA, "head_branch": "v0.5.5", "status": "completed", "conclusion": "success"}
    require(all(type(build.get(k)) is type(v) and build[k] == v for k, v in expected.items())
            and all(build.get(k, {}).get("id") == 1404596174 for k in ("repository", "head_repository")), "formal_build_changed")
    return worker.validate_public_assets(client.fetch_json(f'/releases/{request["release_id"]}'), request)


def execute(args, report: dict) -> int:
    env = os.environ
    expected_arch = {"win32-x64": "AMD64", "win32-arm64": "ARM64"}[args.platform]
    require(os.name == "nt" and (env.get("PROCESSOR_ARCHITEW6432") or env.get("PROCESSOR_ARCHITECTURE", "")).upper() == expected_arch,
            "native_platform_required")
    head, workflow_head, ref = env.get("GITHUB_SHA", ""), env.get("GITHUB_WORKFLOW_SHA", ""), env.get("GITHUB_REF", "")
    workflow_ref = env.get("GITHUB_WORKFLOW_REF", "")
    require(env.get("GITHUB_REPOSITORY") == "9holy/webcodex" and re.fullmatch(r"[0-9a-f]{40}", head) is not None
            and head == workflow_head and head != CONTROL_SHA and ref.startswith("refs/heads/diagnostic/")
            and workflow_ref == "9holy/webcodex/.github/workflows/windows-v055-upgrade-diagnostic.yml@" + ref,
            "diagnostic_workflow_identity")
    report["diagnostic_identity"] = {"head_sha": head, "ref": ref, "workflow_ref": workflow_ref}
    request = read_request()
    control_root = args.control_root.resolve()
    child_env = {key: value for key, value in env.items() if key not in TOKENS}
    child_env["PYTHONDONTWRITEBYTECODE"] = "1"
    worker, smoke, public = control_modules(control_root, child_env)
    worker.select_release_spec(request)  # Pure fixed-request validation; never execute the guarded worker.
    original = original_helper_bytes(control_root, child_env)
    observed_helper = instrument_helper(original)
    report["helper"] = {"control_sha": CONTROL_SHA, "original_sha256": HELPER_SHA256,
                        "observed_copy_sha256": hashlib.sha256(observed_helper).hexdigest(), "reverse_restores_exact_bytes": True}
    report["phase"] = "public_identity"
    client = worker.control.collector.GitHubClient("9holy/webcodex", env.get("GH_TOKEN") or env.get("GITHUB_TOKEN"), 60)
    assets = verify_remote(client, worker, request)
    inputs = args.inputs_root.absolute()
    inputs.mkdir(parents=True, exist_ok=False)
    helper = inputs / "observed-desktop-smoke.ps1"
    helper.write_bytes(observed_helper)
    report["phase"] = "observation_powershell_syntax"
    validate_powershell(smoke, helper, child_env, report)
    selected = {"installer": f"webcodex-unified-v0.5.5-{args.platform}.exe",
                "runtime": f"webcodex-v0.5.5-{args.platform}.tar.gz", "manifest": f"webcodex-source-v0.5.5-{args.platform}.json"}
    paths = {}
    for key, name in selected.items():
        report["phase"] = "download_" + key
        paths[key] = inputs / name
        frozen = request["assets"][name]
        worker._download(assets[name]["browser_download_url"], paths[key], frozen["sha256"], frozen["size"])
    report["phase"] = "download_baseline"
    previous_hash = smoke.UPSTREAM_SHA256[args.platform]
    previous = inputs / f"webcodex-desktop-v0.5.0-{args.platform}-setup.exe"
    worker._download("https://github.com/yyjeqhc/webcodex/releases/download/v0.5.0/" + previous.name, previous, previous_hash)
    public.inspect_archive(paths["runtime"], args.platform, inputs / "candidate-runtime")
    runtime = inputs / "candidate-runtime" / args.platform
    manifest = smoke.verify_candidate_manifest(paths["manifest"], request["assets"][selected["manifest"]]["sha256"],
        version="0.5.5", source=SOURCE_SHA, platform=args.platform, build_run_id=request["build_run_id"], runtime_dir=runtime)
    built_at = manifest["artifacts"]["webcodex"]["build_info"]["built_at"]
    require(str(built_at).isdigit() and int(built_at) > 0, "candidate_build_time")
    build_info = smoke.parse_json(smoke.run_command([str(runtime / "webcodex.exe"), "--build-info-json"],
                                                  "public candidate identity", env=child_env), "public candidate identity")
    require(build_info == manifest["artifacts"]["webcodex"]["build_info"], "candidate_build_identity")
    require(bool(env.get("APPDATA")) and bool(env.get("LOCALAPPDATA")), "native_user_directories")
    default_environment = Path(env["APPDATA"]) / "webcodex/environment"
    require(not default_environment.exists() and smoke.read_registration() is None, "runner_not_clean")
    install_root = Path(tempfile.mkdtemp(prefix="webcodex-acceptance-", dir=env["LOCALAPPDATA"]))
    hashes = inputs / "expected-program-hashes.json"
    hashes.write_text(json.dumps({name: item["sha256"] for name, item in manifest["artifacts"].items()}), encoding="utf-8")
    probe = inputs / "post-failure-classifier.py"
    probe.write_text(PROBE_SOURCE, encoding="utf-8")
    child_env.update(WEBCODEX_DIAG_PYTHON=sys.executable, WEBCODEX_DIAG_PROBE=str(probe))
    report["inputs_verified"] = {"request_sha256": REQUEST_SHA256, "source_sha": SOURCE_SHA,
        "release_id": request["release_id"], "build_run_id": request["build_run_id"], "build_run_attempt": request["build_run_attempt"],
        "installer_sha256": request["assets"][selected["installer"]]["sha256"],
        "manifest_sha256": request["assets"][selected["manifest"]]["sha256"], "baseline_sha256": previous_hash,
        "program_sha256": {name: item["sha256"] for name, item in manifest["artifacts"].items()}}
    report["scenarios"] = {}
    scenarios = ("fresh", "unconfigured") if args.mode == "sequence" else ("unconfigured",)
    exit_code = 0
    for scenario in scenarios:
        report["phase"] = scenario
        require(not (default_environment / "environment.json").exists(), "unexpected_configured_environment")
        destination = install_root / (scenario + " Desktop")
        context = inputs / (scenario + "-classifier-context.json")
        context.write_text(json.dumps({"control_root": str(control_root), "runtime": str(destination / "webcodex-runtime"),
            "cli": str(runtime / "webcodex.exe"), "cli_sha256": manifest["artifacts"]["webcodex"]["sha256"]}), encoding="utf-8")
        child_env["WEBCODEX_DIAG_CONTEXT"] = str(context)
        command = ["pwsh", "-NoLogo", "-NoProfile", "-NonInteractive", "-File", str(helper),
                   "-Installer", str(paths["installer"]), "-Version", "0.5.5", "-SourceSha", SOURCE_SHA,
                   "-BuiltAt", str(built_at), "-Platform", args.platform, "-InstallDir", str(destination),
                   "-ExpectedProgramHashes", str(hashes)]
        if scenario == "unconfigured":
            command += ["-PreviousInstaller", str(previous), "-PreviousInstallerSha256", previous_hash]
        observed = smoke.run_command(command, "diagnostic original helper", timeout=600, env=child_env)
        report["last_helper_exit_code"] = observed.returncode
        report["scenarios"][scenario] = project_helper(observed.stdout, observed.stderr, observed.returncode, scenario)
        if observed.returncode != 0:
            exit_code = observed.returncode
            break  # Preserve the original fresh -> unconfigured stop-on-failure sequence.
    report["fixture_directory_empty"] = not any(install_root.iterdir())
    if report["fixture_directory_empty"]:
        install_root.rmdir()  # Never remove unclassified state or a nonempty directory.
    worker.validate_public_assets(client.fetch_json(f'/releases/{request["release_id"]}'), request)
    report["public_assets_unchanged_after"] = True
    report["observation_complete"] = True
    report["helpers_passed"] = exit_code == 0
    return exit_code


def arguments(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", required=True, choices=("win32-x64", "win32-arm64"))
    parser.add_argument("--mode", required=True, choices=("sequence", "direct"))
    parser.add_argument("--control-root", required=True, type=Path)
    parser.add_argument("--inputs-root", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = arguments(argv)
    report = {"schema_version": 1, "kind": "windows-v055-upgrade-diagnostic", "formal_acceptance": False,
              "platform": args.platform, "mode": args.mode, "phase": "identity", "observation_complete": False,
              "workflow_run_id": int(os.environ.get("GITHUB_RUN_ID", "0")),
              "workflow_run_attempt": int(os.environ.get("GITHUB_RUN_ATTEMPT", "0")),
              "post_failure_classifier_is_outer_failure_evidence": False}
    exit_code = 1
    try:
        exit_code = execute(args, report)
    except Exception as error:
        report["failure_type"] = type(error).__name__
        if isinstance(error, DiagnosticFailure):
            report["failure_code"] = str(error)  # Every caller supplies a fixed code, never raw output.
        code = report.get("last_helper_exit_code")
        if exit_integer(code) and code != 0:
            exit_code = code
    payload = (json.dumps(report, sort_keys=True, separators=(",", ":")) + "\n").encode()
    if len(payload) > MAX_REPORT_BYTES:
        payload = b'{"kind":"windows-v055-upgrade-diagnostic","formal_acceptance":false,"observation_complete":false,"failure_type":"ReportLimit"}\n'
        exit_code = 1
    try:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        with args.report.open("xb") as stream:
            stream.write(payload)
    except OSError:
        print('{"kind":"windows-v055-upgrade-diagnostic","formal_acceptance":false,"failure_type":"ReportWrite"}')
        return 1
    print(json.dumps({"kind": report["kind"], "formal_acceptance": False,
                      "platform": args.platform, "mode": args.mode, "observation_complete": report["observation_complete"]}))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
