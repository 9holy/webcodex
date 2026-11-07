import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodingAgentPermissionPanel } from "../src/ui/CodingAgentPermissionPanel.js";
import { codingAgentPermissionClient } from "../src/runtime-v2/api/coding-agents.js";
import type { RuntimeV2Client } from "../src/runtime-v2/api/client.js";
import { codingAgentDecisionResponse, type CodingAgentPermissionClient, type CodingAgentPermissionInventory } from "../src/ui/codingAgentPermissions.js";

const inventory = (overrides: Partial<CodingAgentPermissionInventory> = {}): CodingAgentPermissionInventory => ({
  authorization: { can_run: true, can_approve: true },
  runs: [{ run_id: "run-A", runtime_project_id: "agent:runner:project", client_id: "runner", provider_id: "codex", state: "waiting_permission", observation_revision: 2,
    pending_permission: { request_id: "request-A", label: "Run the project test command?", details: "Command: npm test\nWorking directory: /projects/example", expires_at: Math.floor(Date.now() / 1000) + 300,
      options: [{ option_id: "provider-allow", name: "Approve this command", kind: "allow_once" }, { option_id: "provider-deny", name: "Reject this command", kind: "reject_once" }, { option_id: "provider-always", name: "Always approve", kind: "allow_always" }] } }],
  ...overrides,
});
const ok = <T,>(data: T) => ({ ok: true, status: 200, data });
const makeClient = () => ({ list: vi.fn().mockResolvedValue(ok(inventory())), respond: vi.fn().mockResolvedValue(ok({ success: true })) });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const allowButton = () => screen.getByRole("button", { name: /Allow once/ });
const mount = (client: CodingAgentPermissionClient, identity = "operator-A") => render(<CodingAgentPermissionPanel identity={identity} client={client} />);
afterEach(() => vi.useRealTimers());

describe("operator coding agent permission lifecycle", () => {
  it("renders bounded provider context and submits its exact one-time option only once", async () => {
    const client = makeClient(); const pending = deferred<ReturnType<typeof ok>>(); client.respond.mockReturnValue(pending.promise);
    mount(client);
    await screen.findByText("Run the project test command?");
    expect(screen.queryByText("Always approve")).toBeNull();
    expect(screen.getAllByText("Authorized")).toHaveLength(2);
    fireEvent.click(allowButton()); fireEvent.click(allowButton());
    await waitFor(() => expect(client.respond).toHaveBeenCalledTimes(1));
    expect(client.respond.mock.calls[0][0]).toEqual({ run_id: "run-A", request_id: "request-A", outcome: "selected", option_id: "provider-allow" });
    expect((allowButton() as HTMLButtonElement).disabled).toBe(true);
    await act(async () => pending.resolve(ok({ success: true })));
    await screen.findByText("One-time approval received — waiting for the agent to continue");
    expect(screen.queryByRole("button", { name: /Allow once/ })).toBeNull();
  });

  it.each([["Deny once", { outcome: "selected", option_id: "provider-deny" }, "One-time denial received — waiting for the agent to continue"], ["Cancel request", { outcome: "cancelled" }, "Cancellation received — waiting for the agent to continue"]])("submits %s as an explicit operator choice", async (label, decision, receipt) => {
    const client = makeClient(); mount(client); await screen.findByText("Run the project test command?");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(String(label)) }));
    await screen.findByText(String(receipt));
    expect(client.respond.mock.calls[0][0]).toEqual({ run_id: "run-A", request_id: "request-A", ...(decision as object) });
  });

  it("requires both run and separate approval authority and offers authorization guidance", async () => {
    const client = makeClient(); client.list.mockResolvedValue(ok(inventory({ authorization: { can_run: true, can_approve: false } })));
    mount(client); await screen.findByText("Not authorized");
    expect((allowButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(allowButton()); expect(client.respond).not.toHaveBeenCalled();
    expect(screen.getByText(/Approval access is separate/)).toBeTruthy();
  });

  it("expires displayed requests and never submits them", async () => {
    vi.useFakeTimers(); const client = makeClient(); const data = inventory(); data.runs[0].pending_permission!.expires_at = Math.floor(Date.now() / 1000) + 1; client.list.mockResolvedValue(ok(data));
    mount(client); await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(1100));
    expect(screen.getByText(/Expired — refresh/)).toBeTruthy();
    fireEvent.click(allowButton()); expect(client.respond).not.toHaveBeenCalled();
  });

  it("keeps unknown writes locked until an explicit fresh observation and does not retry writes", async () => {
    const client = makeClient(); client.respond.mockRejectedValue(new Error("network lost")); mount(client);
    await screen.findByText("Run the project test command?"); fireEvent.click(allowButton());
    await screen.findByText(/Response status is unknown/);
    expect(client.respond).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Allow once/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refresh approvals" }));
    await waitFor(() => expect((allowButton() as HTMLButtonElement).disabled).toBe(false));
    expect(client.respond).toHaveBeenCalledTimes(1);
  });

  it("marks requests removed by another operator as handled without inventing their choice", async () => {
    const client = makeClient(); mount(client); await screen.findByText("Run the project test command?");
    const handled = inventory(); handled.runs[0] = { ...handled.runs[0], state: "running", pending_permission: null, observation_revision: 3 };
    client.list.mockResolvedValue(ok(handled));
    fireEvent.click(screen.getByRole("button", { name: "Refresh approvals" }));
    await screen.findByText("Handled or closed"); expect(screen.queryByText("One-time approval received — waiting for the agent to continue")).toBeNull();
    expect(client.respond).not.toHaveBeenCalled();
  });

  it("does not replay a stale/processed request response", async () => {
    const client = makeClient(); client.respond.mockResolvedValue({ ok: false, status: 409, data: null }); mount(client);
    await screen.findByText("Run the project test command?"); fireEvent.click(allowButton());
    await screen.findByText(/This request has changed/); expect(client.respond).toHaveBeenCalledTimes(1);
  });

  it("clears request content when read authorization is revoked", async () => {
    const client = makeClient(); mount(client); await screen.findByText("Run the project test command?");
    client.list.mockResolvedValue({ ok: false, status: 403, data: null }); fireEvent.click(screen.getByRole("button", { name: "Refresh approvals" }));
    await screen.findByRole("alert"); expect(screen.queryByText("Run the project test command?")).toBeNull();
  });

  it("does not let an old credential's pending read populate a replacement connection", async () => {
    const client = makeClient(); const oldRead = deferred<ReturnType<typeof ok>>(); client.list.mockReturnValueOnce(oldRead.promise).mockResolvedValue(ok(inventory({ runs: [] })));
    const view = mount(client);
    view.rerender(<CodingAgentPermissionPanel identity="operator-B" client={client} />);
    await screen.findByText("No pending permission requests");
    await act(async () => oldRead.resolve(ok(inventory())));
    expect(screen.queryByText("Run the project test command?")).toBeNull();
  });

  it("keeps older run revisions from restoring a completed request", async () => {
    const client = makeClient(); mount(client); await screen.findByText("Run the project test command?");
    const done = inventory(); done.runs[0] = { ...done.runs[0], state: "running", pending_permission: null, observation_revision: 3 };
    client.list.mockResolvedValueOnce(ok(done)).mockResolvedValue(ok(inventory()));
    fireEvent.click(screen.getByRole("button", { name: "Refresh approvals" })); await screen.findByText("Handled or closed");
    fireEvent.click(screen.getByRole("button", { name: "Refresh approvals" })); await waitFor(() => expect(client.list).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole("button", { name: /Allow once/ })).toBeNull();
  });
});

it("the browser adapter only deduplicates reads; decisions use the mutation path", async () => {
  const post = vi.fn().mockResolvedValue(ok(inventory()));
  const postAt = vi.fn().mockResolvedValue(ok({success:true,output:{response_accepted:true}}));
  const api = codingAgentPermissionClient({ post, postAt } as unknown as RuntimeV2Client); const signal = new AbortController().signal;
  await api.list(signal); await api.respond({ run_id: "r", request_id: "p", outcome: "cancelled" }, signal);
  expect(post.mock.calls).toEqual([["coding-agent-runs", {}, signal, { observation: true }]]);
  expect(postAt.mock.calls).toEqual([["/api/tools/", "call", {tool:"respond_coding_agent_permission", params:{run_id:"r",request_id:"p",outcome:"cancelled"}}, signal]]);
});

it("shows the complete requested action as text, including long commands and HTML-like content", async () => {
  const client = makeClient(); const data = inventory();
  const details = "Command: <script>window.intrusion=true</script>\n" + "inspect details\n".repeat(2000) + "FINAL REQUIRED ARGUMENT";
  data.runs[0].pending_permission!.details = details; client.list.mockResolvedValue(ok(data));
  mount(client); await screen.findByText("Run the project test command?");
  const pre = screen.getByRole("article").querySelector("pre");
  expect(pre?.textContent).toBe(details); expect(pre?.querySelector("script")).toBeNull();
});

it("does not cancel slow reads at the polling interval and bounds a hanging native write", async () => {
  vi.useFakeTimers(); const client = makeClient(); const read = deferred<ReturnType<typeof ok>>(); client.list.mockReturnValueOnce(read.promise);
  mount(client); await act(async () => {});
  await act(async () => vi.advanceTimersByTimeAsync(10000));
  expect(client.list).toHaveBeenCalledTimes(1);
  await act(async () => read.resolve(ok(inventory())));
  client.respond.mockReturnValue(new Promise(() => {}));
  fireEvent.click(allowButton());
  await act(async () => vi.advanceTimersByTimeAsync(30001));
  expect(screen.getByText(/Response status is unknown/)).toBeTruthy();
  expect(client.respond).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "Refresh approvals" }) as HTMLButtonElement).disabled).toBe(false);
});

it("does not claim a missing row in a partial inventory was processed", async () => {
  const client = makeClient(); mount(client); await screen.findByText("Run the project test command?");
  client.list.mockResolvedValue(ok(inventory({ runs: [], truncated: true })));
  fireEvent.click(screen.getByRole("button", { name: "Refresh approvals" }));
  await screen.findByText(/This request is not in the current inventory/);
  expect(screen.queryByText("Handled or closed")).toBeNull();
  expect(screen.queryByRole("button", { name: /Allow once/ })).toBeNull();
});

it("requires a canonical acceptance receipt and uses closed error kinds instead of error text", () => {
  expect(codingAgentDecisionResponse(ok({success:true, output:{}}))?.ok).toBe(false);
  expect(codingAgentDecisionResponse(ok({success:false, output:{error_kind:"permission_denied"}}))?.status).toBe(403);
  expect(codingAgentDecisionResponse(ok({success:false, output:{error_kind:"coding_agent_permission_not_pending"}}))?.status).toBe(409);
  expect(codingAgentDecisionResponse(ok({success:false, output:{error_kind:"unrecognized_private_text"}}))?.status).toBe(0);
});
