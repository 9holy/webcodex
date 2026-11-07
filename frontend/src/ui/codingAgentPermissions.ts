/** Operator-facing projection; no credential, provider session, or authority hash. */
export type CodingAgentPermissionOption = {
  option_id: string;
  name: string;
  kind: "allow_once" | "allow_always" | "reject_once" | "reject_always";
};
export type PendingCodingAgentPermission = {
  request_id: string;
  label: string;
  /** Complete, bounded provider action details; render as untrusted plain text. */
  details: string;
  /** Unix seconds, supplied by the Runner. */
  expires_at: number;
  options: CodingAgentPermissionOption[];
};
export type CodingAgentPermissionRun = {
  run_id: string;
  client_id?: string;
  runtime_project_id: string;
  provider_id: string;
  state: string;
  observation_revision: number;
  pending_permission?: PendingCodingAgentPermission | null;
};
export type CodingAgentPermissionInventory = {
  runs: CodingAgentPermissionRun[];
  authorization: { can_run: boolean; can_approve: boolean };
  truncated?: boolean;
};
export type CodingAgentPermissionDecision = { run_id: string; request_id: string } & (
  | { option_id: string; outcome: "selected" }
  | { outcome: "cancelled"; option_id?: never }
);
export type CodingAgentPermissionResponse<T> = { ok: boolean; status: number; data: T | null } | null;
export type CodingAgentPermissionClient = {
  list: (signal: AbortSignal) => Promise<CodingAgentPermissionResponse<CodingAgentPermissionInventory>>;
  respond: (decision: CodingAgentPermissionDecision, signal: AbortSignal) => Promise<CodingAgentPermissionResponse<unknown>>;
};

export type CodingAgentPermissionToolResult = {
  success: boolean;
  output?: { response_accepted?: boolean; error_code?: string; error_kind?: string; recovery_kind?: string };
};
/** HTTP 200 alone does not mean the canonical tool accepted a decision. */
export function codingAgentDecisionResponse(response: CodingAgentPermissionResponse<CodingAgentPermissionToolResult>): CodingAgentPermissionResponse<unknown> {
  if (!response?.ok) return response;
  if (response.data?.success && response.data.output?.response_accepted === true) return response;
  const kind = response.data?.output?.error_kind;
  const status = kind === "permission_denied" ? 403 :
    kind === "unknown_coding_agent_run" ? 404 :
    ["stale_coding_agent_permission", "coding_agent_permission_not_pending", "coding_agent_permission_response_conflict"].includes(kind ?? "") ? 409 : 0;
  return { ok: false, status, data: null };
}
