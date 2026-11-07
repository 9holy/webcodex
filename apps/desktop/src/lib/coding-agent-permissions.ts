import type { SettingsTarget } from "../models/topology";
import type { WorkspaceRequest } from "../models/workspace";
import { codingAgentDecisionResponse, type CodingAgentPermissionClient, type CodingAgentPermissionInventory, type CodingAgentPermissionResponse, type CodingAgentPermissionToolResult } from "../../../../frontend/src/ui/codingAgentPermissions";

function responseStatus(error: unknown): number {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  return code === "workspace_authentication_required" ? 401 : code === "workspace_permission_denied" ? 403 : code === "workspace_request_changed" ? 409 : 0;
}

export function desktopCodingAgentPermissions(expected: SettingsTarget, query: <T>(request: WorkspaceRequest) => Promise<T>): CodingAgentPermissionClient {
  // Every native request verifies this exact connection before dispatch and
  // fences its response against the runtime and operation generation afterward.
  const send = async <T,>(request: WorkspaceRequest, signal: AbortSignal): Promise<CodingAgentPermissionResponse<T>> => {
    if (signal.aborted) return null;
    try {
      const data = await query<T>(request);
      return signal.aborted ? null : { ok: true, status: 200, data };
    } catch (error) {
      return signal.aborted ? null : { ok: false, status: responseStatus(error), data: null };
    }
  };
  return {
    list: signal => send<CodingAgentPermissionInventory>({ kind: "coding_agent_runs", expected }, signal),
    respond: async (decision, signal) => codingAgentDecisionResponse(await send<CodingAgentPermissionToolResult>({ kind: "coding_agent_permission", expected, ...decision }, signal)),
  };
}
