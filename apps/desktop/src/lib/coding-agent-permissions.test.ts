import { describe, expect, it, vi } from "vitest";
import { desktopCodingAgentPermissions } from "./coding-agent-permissions";
const expected = { config_path: "/fixture/runner.toml", client_id: "runner", server_url: "http://127.0.0.1:62645" };
describe("Desktop coding permission transport", () => {
  it("sends only a fixed native vocabulary with the captured connection identity", async () => {
    const query = vi.fn().mockResolvedValue({ success: true, output: { response_accepted: true } });
    const client = desktopCodingAgentPermissions(expected, query); const signal = new AbortController().signal;
    await client.list(signal);
    const response = await client.respond({ run_id: "run", request_id: "request", outcome: "cancelled" }, signal);
    expect(query.mock.calls).toEqual([[{ kind: "coding_agent_runs", expected }], [{ kind: "coding_agent_permission", expected, run_id: "run", request_id: "request", outcome: "cancelled" }]]);
    expect(response?.ok).toBe(true);
  });
  it("requires tool acceptance, maps closed denial codes and never dispatches an aborted decision", async () => {
    const query = vi.fn().mockResolvedValue({ success: false, output: { error_kind: "permission_denied" } });
    const client = desktopCodingAgentPermissions(expected, query); const controller = new AbortController();
    expect((await client.respond({ run_id: "run", request_id: "request", outcome: "cancelled" }, controller.signal))?.status).toBe(403);
    query.mockRejectedValue({ code: "workspace_request_changed", message: "private-text" });
    expect((await client.respond({ run_id: "run", request_id: "request", outcome: "cancelled" }, controller.signal))?.status).toBe(409);
    controller.abort(); expect(await client.respond({ run_id: "run", request_id: "request", outcome: "cancelled" }, controller.signal)).toBeNull();
    expect(query).toHaveBeenCalledTimes(2);
  });
});
