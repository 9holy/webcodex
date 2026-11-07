import type { RuntimeV2Client } from "./client.js";
import { codingAgentDecisionResponse, type CodingAgentPermissionClient, type CodingAgentPermissionInventory, type CodingAgentPermissionToolResult } from "../../ui/codingAgentPermissions.js";

export function codingAgentPermissionClient(client: RuntimeV2Client): CodingAgentPermissionClient {
  return {
    list: signal => client.post<CodingAgentPermissionInventory>("coding-agent-runs", {}, signal, { observation: true }),
    respond: async (decision, signal) => codingAgentDecisionResponse(await client.postAt<CodingAgentPermissionToolResult>("/api/tools/", "call", { tool: "respond_coding_agent_permission", params: decision }, signal)),
  };
}
