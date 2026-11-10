#!/usr/bin/env python3
"""Read-only, bounded macOS Spotlight sampling; diagnostic evidence, not readiness.

No process arguments or environment values are collected. CPU percentages use
one CPU core as 100%, never the machine's aggregate capacity. This observer does
not change OS settings, stop processes, instrument source, or launch tests.
"""

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

POLL_SECONDS = 2.0
QUIET_SECONDS = 20.0
THRESHOLD_PERCENT = 25.0
GATE_LIMIT_SECONDS = 360.0
WATCH_LIMIT_SECONDS = 3600.0
PS_COMMAND = ["/bin/ps", "-A", "-ww", "-o", "pid=", "-o", "lstart=", "-o", "time=", "-o", "comm="]
LIMITATIONS = [
    "Only named Spotlight processes visible to unprivileged ps are measured; this is not total host CPU or I/O quiescence.",
    "Processes born and exited between polls are invisible. Start time has one-second precision; same-second PID reuse can be indistinguishable.",
    "Birth, exit, changed identity, counter regression, parse/read failure, or a sampling gap resets the quiet interval.",
    "ps is not an atomic snapshot. CPU is cumulative user+system time; a conservative upper estimate includes both endpoint display quanta and the shortest possible sample interval.",
    "Even a passing quiet window does not prove Spotlight caused earlier failures, prevent later noise, or establish a product fix or formal release readiness.",
    "The observer adds a ps invocation every two seconds; watch mode is observational and never changes test execution or its result.",
]


def write_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")
    temporary.replace(path)


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def cpu_time(value):
    """Parse Darwin mm:ss.hh and common [days-]hh:mm:ss[.hh] forms."""
    if not re.fullmatch(r"(?:\d+-)?\d+:\d{2}(?::\d{2})?(?:\.\d+)?", value):
        raise ValueError("invalid cumulative CPU time")
    days = 0
    if "-" in value:
        day_text, value = value.split("-", 1)
        days = int(day_text)
        if value.count(":") != 2:
            raise ValueError("day format requires hours")
    fields = value.split(":")
    seconds = float(fields[-1])
    minutes = int(fields[-2])
    if seconds >= 60 or (len(fields) == 3 and minutes >= 60):
        raise ValueError("invalid CPU time range")
    hours = int(fields[0]) if len(fields) == 3 else 0
    fraction = fields[-1].partition(".")[2]
    quantum = 10.0 ** -len(fraction) if fraction else 1.0
    return days * 86400 + hours * 3600 + minutes * 60 + seconds, quantum


def spotlight(program):
    return program in {"mds", "mds_stores", "mdworker", "mdworker_shared", "mdimport", "mdimport_shared", "mdwrite", "mdbulkimport"} or program.startswith(("mdworker_", "mds_"))


def parse_ps(output):
    """Retain only PID/start/cumulative CPU/basename, never raw command text."""
    if not output.strip():
        raise ValueError("empty ps snapshot")
    rows = {}
    for line_number, line in enumerate(output.splitlines(), 1):
        fields = line.strip().split(None, 7)
        if len(fields) != 8:
            raise ValueError(f"invalid ps row at line {line_number}")
        program = os.path.basename(fields[7])
        if not program:
            raise ValueError(f"missing ps program at line {line_number}")
        # macOS may include PID 0 kernel_task. Unrelated process metadata is
        # not part of the gate; validate identity and counters only for Spotlight.
        if not spotlight(program):
            continue
        pid = int(fields[0])
        start = " ".join(fields[1:6])
        dt.datetime.strptime(start, "%a %b %d %H:%M:%S %Y")
        seconds, quantum = cpu_time(fields[6])
        if pid in rows or pid <= 0:
            raise ValueError(f"invalid ps identity at line {line_number}")
        rows[pid] = {"pid": pid, "start": start, "program": program,
                     "cpu_seconds": seconds, "cpu_quantum_seconds": quantum}
    return rows


def snapshot(timeout):
    start = time.monotonic()
    result = {"utc": utc_now(), "start": start, "processes": {}, "error": None}
    try:
        output = subprocess.check_output(PS_COMMAND, text=True, stderr=subprocess.DEVNULL,
                                         timeout=timeout, env={**os.environ, "LC_ALL": "C"})
        result["processes"] = parse_ps(output)
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        # Do not serialize subprocess output, argv, environment, or raw ps rows.
        result["error"] = type(error).__name__
    result["end"] = time.monotonic()
    return result


def interval(previous, current):
    result = {"valid": False, "quiet": False, "reason": "initial_snapshot"}
    if current["error"] or (previous and previous["error"]):
        result["reason"] = "snapshot_error"
        return result
    if previous is None:
        return result
    elapsed = current["end"] - previous["end"]
    minimum = current["start"] - previous["end"]
    result.update(elapsed_seconds=elapsed, minimum_interval_seconds=minimum)
    if minimum <= 0 or elapsed > POLL_SECONDS * 2 or any(
        sample["end"] - sample["start"] > POLL_SECONDS for sample in (previous, current)
    ):
        result["reason"] = "sampling_gap_or_slow_snapshot"
        return result
    before, after = previous["processes"], current["processes"]
    old = {(pid, row["start"], row["program"]) for pid, row in before.items()}
    new = {(pid, row["start"], row["program"]) for pid, row in after.items()}
    if old != new:
        result.update(reason="process_birth_exit_or_identity_change", added=len(new - old), removed=len(old - new))
        return result
    deltas = [row["cpu_seconds"] - before[pid]["cpu_seconds"] for pid, row in after.items()]
    if any(delta < 0 for delta in deltas):
        result["reason"] = "cpu_counter_regression"
        return result
    cpu_delta = sum(deltas)
    uncertainty = sum(row["cpu_quantum_seconds"] + before[pid]["cpu_quantum_seconds"] for pid, row in after.items())
    measured = 100.0 * cpu_delta / elapsed
    upper = 100.0 * (cpu_delta + uncertainty) / minimum
    result.update(valid=True, quiet=upper < THRESHOLD_PERCENT,
                  reason="below_threshold" if upper < THRESHOLD_PERCENT else "busy_or_precision_uncertain",
                  cpu_delta_seconds=cpu_delta, cpu_percent_one_core=measured,
                  conservative_cpu_percent_one_core=upper, display_uncertainty_seconds=uncertainty)
    return result


def observe(mode, output, stop_file):
    limit = GATE_LIMIT_SECONDS if mode == "gate" else WATCH_LIMIT_SECONDS
    start = time.monotonic()
    deadline = start + limit
    previous = None
    quiet_since = None
    summary = {"mode": mode, "started_utc": utc_now(), "limit_seconds": limit,
               "poll_seconds": POLL_SECONDS, "required_quiet_seconds": QUIET_SECONDS,
               "threshold_percent_of_one_core": THRESHOLD_PERCENT,
               "gate_uses_conservative_upper_estimate": True, "limitations": LIMITATIONS,
               "samples": 0, "valid_intervals": 0, "quiet_intervals": 0,
               "busy_intervals": 0, "uncertain_intervals": 0, "snapshot_errors": 0,
               "longest_quiet_seconds": 0.0, "outcome": "observer_error", "exit_code": 3}
    result_path = output / f"{mode}-result.json"
    write_json(result_path, {**summary, "outcome": "running", "exit_code": None})
    with (output / f"{mode}-samples.jsonl").open("w", buffering=1) as stream:
        while time.monotonic() < deadline:
            if mode == "watch" and stop_file.exists():
                summary.update(outcome="watch_stopped", exit_code=0)
                break
            current = snapshot(min(5.0, max(0.01, deadline - time.monotonic())))
            delta = interval(previous, current)
            summary["samples"] += 1
            summary["snapshot_errors"] += int(current["error"] is not None)
            if delta["valid"]:
                summary["valid_intervals"] += 1
                summary["quiet_intervals" if delta["quiet"] else "busy_intervals"] += 1
            else:
                summary["uncertain_intervals"] += 1
            if delta["quiet"]:
                if quiet_since is None:
                    # Start at the first complete qualifying sample, not a partial interval.
                    quiet_since = current["end"]
            else:
                quiet_since = None
            quiet_elapsed = 0.0 if quiet_since is None else current["end"] - quiet_since
            summary["longest_quiet_seconds"] = max(summary["longest_quiet_seconds"], quiet_elapsed)
            record = {"utc": current["utc"], "elapsed_seconds": current["end"] - start,
                      "collection_seconds": current["end"] - current["start"],
                      "error": current["error"], "spotlight": list(current["processes"].values()),
                      "interval": delta, "consecutive_quiet_seconds": quiet_elapsed}
            stream.write(json.dumps(record, sort_keys=True) + "\n")
            if mode == "gate" and quiet_elapsed >= QUIET_SECONDS and current["end"] <= deadline:
                summary.update(outcome="quiet_window_observed", exit_code=0)
                break
            previous = current
            delay = min(max(0.0, POLL_SECONDS - (time.monotonic() - current["start"])), max(0.0, deadline - time.monotonic()))
            time.sleep(delay)
        else:
            if mode == "gate" and summary["valid_intervals"] and not summary["snapshot_errors"]:
                summary.update(outcome="infrastructure_busy_or_uncertain_no_quiet_window", exit_code=2)
            else:
                summary.update(outcome="observer_error_or_watch_limit", exit_code=3)
    # Any watch sampling error makes coverage incomplete, independently of the test exit.
    if mode == "watch" and (summary["snapshot_errors"] or not summary["valid_intervals"]):
        summary.update(outcome="watch_incomplete_sampling", exit_code=3)
    summary.update(ended_utc=utc_now(), elapsed_seconds=time.monotonic() - start)
    write_json(result_path, summary)
    print(json.dumps(summary, sort_keys=True), flush=True)
    return summary["exit_code"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("gate", "watch"))
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--stop-file", type=Path)
    args = parser.parse_args()
    if args.mode == "watch" and args.stop_file is None:
        parser.error("watch requires --stop-file")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    try:
        return observe(args.mode, args.output_dir, args.stop_file)
    except Exception as error:
        # Persist a sanitized observer failure; never fabricate a quiet/test pass.
        write_json(args.output_dir / f"{args.mode}-result.json",
                   {"mode": args.mode, "outcome": "observer_error", "exit_code": 3,
                    "error_type": type(error).__name__, "ended_utc": utc_now(), "limitations": LIMITATIONS})
        print("Observer error: " + type(error).__name__, file=sys.stderr)
        return 3


if __name__ == "__main__":
    sys.exit(main())
