import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { LocaleProvider } from "../../i18n/locale";
import type { WindowDetail } from "../../models/workspace";
import type { CallFailure } from "../../../../../frontend/src/ui/callFailure";
import { ContinuationFacts } from "./ContinuationFacts";
import { continuationFromWindow } from "./window-evidence";

beforeEach(() => { localStorage.setItem("webcodex.desktop.locale", "en-US"); });
afterEach(cleanup);

function show(failure?: CallFailure, tool = "run_process") {
  const now = Date.now();
  const detail = { active_count: 0, activity_truncated: true, activity: [{
    meaningful: true, tool_name: tool, status: "failed", failure, started_at_ms: now - 13_731_000,
    ended_at_ms: now - 13_731_000, request_observed_at_ms: now - 13_731_000,
    response_handed_at_ms: now - 13_731_000, response_streaming: false, service_ms: 0,
  }] } as WindowDetail;
  const value = continuationFromWindow(detail, now);
  render(<LocaleProvider><ContinuationFacts value={value} observedAt={now} /></LocaleProvider>);
  return value;
}

it("shows a recorded rejection and concrete recovery before expandable technical facts", () => {
  const failure: CallFailure = { outcome: "rejected", reason: "missing_scope", error_kind: "insufficient_scope", execution_state: "not_started", recovery_kind: "user_action" };
  expect(show(failure)?.failure).toEqual(failure);
  expect(screen.getByText("Request rejected")).toBeVisible();
  expect(screen.getByText("The connection is missing a required WebCodex permission.")).toBeVisible();
  expect(screen.getByText(/Review this Chat connection's permissions/)).toBeVisible();
  expect(screen.getByText("Returned to HTTP framework")).not.toBeVisible();
  expect(screen.getByText("insufficient_scope")).not.toBeVisible();
  fireEvent.click(screen.getByText("Technical details"));
  expect(screen.getByText("insufficient_scope")).toBeVisible();
  expect(screen.getByText("Returned to HTTP framework")).toBeVisible();
});

it("labels the screenshot-sized delay as time since response, never command runtime", () => {
  show();
  expect(screen.getByText("Time since response")).toBeVisible();
  expect(screen.getByText("3 h 48 min")).toBeVisible();
  expect(screen.queryByText("13731 s")).not.toBeInTheDocument();
  expect(screen.queryByText("Elapsed")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Technical details"));
  expect(screen.getByText("Server processing time")).toBeVisible();
  expect(screen.getByText("Less than 1 ms")).toBeVisible();
});

it("keeps an old finish call failure distinct from deployment and execution failure", () => {
  show(undefined, "finish_coding_task");
  expect(screen.getByText("Call failed")).toBeVisible();
  expect(screen.getByText(/does not contain a specific, safely displayable failure reason/)).toBeVisible();
  expect(screen.getByText(/does not establish whether execution started/)).toBeVisible();
  expect(screen.getByText(/does not establish that a deployment or background process failed/)).toBeVisible();
  expect(screen.queryByText("Execution failed")).not.toBeInTheDocument();
  expect(screen.queryByText("Request rejected")).not.toBeInTheDocument();
});

it("keeps uncertain effects explicit after an HTTP response and does not suggest blind retries", () => {
  show({ outcome: "outcome_unknown", reason: "result_unconfirmed", execution_state: "outcome_unknown" });
  expect(screen.getByText("Result not confirmed")).toBeVisible();
  expect(screen.getByText(/The operation may already have taken effect/)).toBeVisible();
  expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  expect(screen.queryByText("Execution failed")).not.toBeInTheDocument();
});

it("shows an actual failed command only when the projection records execution failure", () => {
  show({ outcome: "execution_failed", reason: "execution_error", execution_state: "completed", failure_kind: "command_exit_nonzero" });
  expect(screen.getByText("Execution failed")).toBeVisible();
  expect(screen.getByText("The command reported an unsuccessful exit.")).toBeVisible();
  expect(screen.getByText(/inspect the command result and correct the reported problem/)).toBeVisible();
});

it("does not turn generic permission or input errors with missing lifecycle into OAuth advice or a retry permit", () => {
  show({ outcome: "call_failed", reason: "access_denied", error_kind: "permission_denied" });
  expect(screen.getByText("Access was denied by an authorization or local execution policy.")).toBeVisible();
  expect(screen.getByText(/before correcting the recorded problem/)).toBeVisible();
  expect(screen.queryByText(/reconnect or reauthorize Chat/)).not.toBeInTheDocument();
  expect(screen.queryByText("Request rejected")).not.toBeInTheDocument();
});
