import { beforeEach, describe, expect, it, vi } from "vitest";
import { desktopApi } from "./desktop-api";

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => native);
const target = { client_id: "runner", config_path: "/private/runner.toml", server_url: "http://127.0.0.1:8900" };
beforeEach(() => vi.resetAllMocks());

describe("narrow capability grant IPC", () => {
  it("keeps the existing Runner grant free of optional approval and background scopes", async () => {
    await desktopApi.authorizeRunnerCapabilities(target);
    expect(native.invoke).toHaveBeenCalledExactlyOnceWith("authorize_runner_capabilities", { request: { expected: target, confirmed: true } });
  });
  it.each([
    ["coding_approval", "permission_approval"],
    ["detached_execution", "detached_execution"],
  ] as const)("sends only the explicit %s selector", async (capability, selector) => {
    await desktopApi.authorizeRunnerCapabilities(target, capability);
    expect(native.invoke).toHaveBeenCalledExactlyOnceWith("authorize_runner_capabilities", { request: { expected: target, confirmed: true, [selector]: true } });
  });
});
