/** A bounded Server-authored explanation, never a command log or retry permit. */
export type CallFailure = {
  outcome: "rejected" | "execution_failed" | "outcome_unknown" | "call_failed";
  reason: string;
  error_kind?: string;
  failure_kind?: string;
  execution_state?: string;
  recovery_kind?: string;
};

export const legacyCallFailure: CallFailure = { outcome: "call_failed", reason: "details_unavailable" };

export function isFailedCallStatus(status?: string): boolean {
  return ["failed", "failure", "error", "timeout", "timed_out"].includes(status?.toLowerCase() ?? "");
}

export function callStatusLabel(status?: string, failure?: CallFailure): string {
  if (["ok", "success", "succeeded", "completed"].includes(status?.toLowerCase() ?? "")) return "Call succeeded";
  if (["cancelled", "canceled"].includes(status?.toLowerCase() ?? "")) return "Call cancelled";
  if (!isFailedCallStatus(status)) return "Result not confirmed";
  switch (failure?.outcome) {
    case "rejected": return "Request rejected";
    case "execution_failed": return "Execution failed";
    case "outcome_unknown": return "Result not confirmed";
    default: return "Call failed";
  }
}

const reasons: Record<string, string> = {
  missing_scope: "The connection is missing a required WebCodex permission.",
  access_denied: "Access was denied by an authorization or local execution policy.",
  host_review_required: "This operation requires its own review in Chat before it can run.",
  session_read_only: "The task session does not permit this write or command.",
  session_closed: "The task session is closed and cannot accept this operation.",
  session_missing: "The requested task session is unavailable to this connection.",
  session_expired: "The task session's retained history has expired.",
  session_mismatch: "The task session belongs to a different project.",
  session_unavailable: "The task session could not be read from storage.",
  project_unavailable: "The project could not be identified or accessed.",
  invalid_input: "The call's inputs do not satisfy this tool's requirements.",
  runner_unavailable: "The Runner was unavailable when this call needed it.",
  unsupported_resource: "The selected execution target does not support these tool options.",
  capability_unavailable: "The selected Runner or execution target does not support the requested capability.",
  runtime_error: "WebCodex recorded a runtime error for this call.",
  approval_changed: "The approval request changed, expired, or was already handled.",
  ssh_authentication: "SSH authentication or the saved login credentials were unavailable.",
  ssh_host_key: "The SSH server identity could not be confirmed with the saved trust.",
  ssh_unavailable: "The SSH connection or the Runner's local SSH client was unavailable.",
  provider_unavailable: "The selected coding agent was unavailable or disabled.",
  execution_error: "The command reported an unsuccessful exit.",
  timeout: "The call reached a time limit.",
  result_unconfirmed: "WebCodex could not confirm the operation's final result.",
  stale_state: "The source or observation changed before the operation could complete.",
  details_unavailable: "This activity record does not contain a specific, safely displayable failure reason.",
};

export function failureReasonText(failure: CallFailure): string {
  const text = reasons[failure.reason];
  return typeof text === "string" ? text : reasons.details_unavailable;
}

export function failureNextStepText(failure: CallFailure): string {
  if (failure.outcome === "outcome_unknown") return "Refresh the linked job or task session before retrying. The operation may already have taken effect.";
  if (failure.outcome === "execution_failed") return "Open the linked job or task session to inspect the command result and correct the reported problem before retrying.";
  if (failure.outcome !== "rejected") return "Refresh the linked job or task session before correcting the recorded problem. This record does not show whether the operation already took effect.";
  switch (failure.reason) {
    case "missing_scope": return "Review this Chat connection's permissions. If its credential or OAuth grant changes, reconnect or reauthorize Chat before trying again.";
    case "access_denied": return "Check the task's permissions and the selected Runner's local access. Update the specific missing permission before retrying.";
    case "host_review_required": return "Refresh the tools available in Chat and request the separately reviewed operation. Do not retry a refused action through another route.";
    case "session_read_only": return "For a write task, ask Chat to reopen the project in a writable task session using the authorized connection.";
    case "session_closed": case "session_missing": case "session_expired": return "Open the project and start or select an available task session before continuing.";
    case "session_mismatch": case "project_unavailable": return "Select the intended project and its task session, then ask Chat to use those current identities.";
    case "invalid_input": return "Ask Chat to correct the tool inputs using the current tool definition, then try the corrected call.";
    case "runner_unavailable": return "Check the Runner connection, then refresh the linked job or task session before deciding whether to retry.";
    case "unsupported_resource": return "Review the tool's requirements for the selected target and correct the unsupported options before preparing another call.";
    case "capability_unavailable": return "Check the capabilities of the selected Runner and execution target before preparing another call.";
    case "runtime_error": return "Open call diagnostics and review the tool inputs and selected execution target before preparing another call.";
    case "approval_changed": return "Refresh Coding agents to see the current approval request. A previous decision is not replayed.";
    case "ssh_authentication": return "Open Extensions > SSH resources, check the login method, and test the connection again.";
    case "ssh_host_key": return "Open Extensions > SSH resources and verify the server fingerprint before confirming any changed identity.";
    case "ssh_unavailable": return "Check the SSH connection and the Runner computer's SSH client permissions, then test the connection in Extensions > SSH resources.";
    case "provider_unavailable": return "Open Extensions > Coding agents and check that the provider is configured, signed in, enabled, and loaded.";
    case "execution_error": return "Open the linked job or task session to inspect the command result and correct the reported problem before retrying.";
    case "stale_state": return "Refresh the file or task state and prepare the operation again against that current state.";
    default: return "Refresh the linked job or task session and inspect call diagnostics if available. Do not assume the operation is safe to repeat.";
  }
}

export function elapsedCallTime(milliseconds: number, t: (value: string) => string): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  if (seconds < 60) return t("{count} s").replace("{count}", String(seconds));
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("{count} min").replace("{count}", String(minutes));
  return t("{hours} h {minutes} min").replace("{hours}", String(Math.floor(minutes / 60))).replace("{minutes}", String(minutes % 60));
}
