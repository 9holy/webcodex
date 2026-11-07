import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopMantineProvider } from "../components/DesktopMantineProvider";
import { LocaleProvider } from "../i18n/locale";
import type { CodingAgentProfile, RunnerCapabilityAuthorizationSnapshot } from "../models/runner-capabilities";
import type { RunnerSettings } from "../models/topology";
import { CodexSetupDialog } from "./extensions/CodexSetupDialog";
import { DetachedExecutionAuthorization } from "./extensions/RunnerCapabilityAuthorization";

const api = vi.hoisted(() => ({ runnerCapabilityAuthorization: vi.fn(), authorizeRunnerCapabilities: vi.fn(), prepareCodexCodingAgent: vi.fn(), saveCodingAgent: vi.fn() }));
vi.mock("../lib/desktop-api", () => ({ desktopApi: api }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
const target = { config_path: "/fixture/runner.toml", client_id: "fixture", server_url: "http://127.0.0.1:8900" };
const settings: RunnerSettings = {
  target, paths: { instruction_files: [], skill_roots: [] }, plugin_ids: [], can_restart: true,
  file_access: { configured_roots: [], default_roots: ["/fixture"], effective_roots: ["/fixture"], using_default_roots: true, allow_cwd_anywhere: false },
};
function authorization(granted = false): RunnerCapabilityAuthorizationSnapshot {
  return { target, can_authorize: true, coding_agents: false, ssh_resources: false, permission_approval_granted: false, permission_approval_grant_available: true, detached_execution_granted: granted, detached_execution_grant_available: !granted };
}
function profile(network: boolean): CodingAgentProfile {
  return { provider_id: "codex-app-server", name: "Codex app-server (experimental)", executable: "/fixture/python3", args: ["/fixture/adapter.py", "serve", "--experimental", "--receipt", "/fixture/receipt.json", ...(network ? ["--network"] : [])], enabled: false, env_from_env: { PATH: "PATH", HOME: "HOME" }, allowed_config_options: [] };
}
function wrap(child: React.ReactNode) {
  return <LocaleProvider><DesktopMantineProvider env="test">{child}</DesktopMantineProvider></LocaleProvider>;
}
const drawAuthorization = (value = settings) => wrap(<DetachedExecutionAuthorization settings={value} disabled={false} />);
const drawCodex = () => wrap(<CodexSetupDialog target={target} revision={3} globals={null} previousId={null} disabled={false} onState={vi.fn()} onSaved={vi.fn()} onClose={vi.fn()} onRefresh={vi.fn()} />);

beforeEach(() => {
  vi.resetAllMocks(); localStorage.setItem("webcodex.desktop.locale", "en-US");
  api.runnerCapabilityAuthorization.mockResolvedValue(authorization());
  api.authorizeRunnerCapabilities.mockResolvedValue(authorization(true));
});

describe("background deployment authorization", () => {
  it("requires separate unchecked consent, prevents duplicate grants, and keeps the resulting status visible", async () => {
    render(drawAuthorization());
    const authorize = await screen.findByRole("button", { name: "Authorize Background Processes" });
    expect(api.authorizeRunnerCapabilities).not.toHaveBeenCalled();
    expect(screen.getByText(/separately authorized Chat or OAuth connection/)).toBeVisible();
    fireEvent.click(authorize);
    const dialog = screen.getByRole("dialog"), consent = within(dialog).getByRole("checkbox");
    const confirm = within(dialog).getByRole("button", { name: "Confirm Authorize Background Processes" });
    expect(consent).not.toBeChecked(); expect(confirm).toBeDisabled();
    expect(within(dialog).getByText(/Operating system privileges/)).toBeVisible();
    fireEvent.click(consent); fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(api.authorizeRunnerCapabilities).toHaveBeenCalledExactlyOnceWith(target, "detached_execution"));
    expect(await screen.findByRole("status")).toHaveTextContent("Background process access is authorized for this connection.");
    expect(screen.queryByRole("button", { name: "Authorize Background Processes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh Background Process Authorization" })).toBeVisible();
  });

  it.each(["remote", "older Server"])("does not offer a local grant for %s", async kind => {
    api.runnerCapabilityAuthorization.mockResolvedValue({ ...authorization(), can_authorize: kind !== "remote", detached_execution_grant_available: false });
    render(drawAuthorization());
    await screen.findByText(/Ask the Server operator for background process access/);
    expect(screen.queryByRole("button", { name: "Authorize Background Processes" })).not.toBeInTheDocument();
    expect(api.authorizeRunnerCapabilities).not.toHaveBeenCalled();
  });

  it("observes an uncertain grant without replaying it or showing private error text", async () => {
    api.authorizeRunnerCapabilities.mockRejectedValue({ message: "private-grant-sentinel" });
    render(drawAuthorization());
    fireEvent.click(await screen.findByRole("button", { name: "Authorize Background Processes" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Authorize Background Processes" }));
    await screen.findByRole("alert");
    await waitFor(() => expect(api.runnerCapabilityAuthorization).toHaveBeenCalledTimes(2));
    expect(api.authorizeRunnerCapabilities).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("private-grant-sentinel");
  });

  it("discards a late grant observation after the selected Runner changes", async () => {
    let complete!: (value: RunnerCapabilityAuthorizationSnapshot) => void;
    api.authorizeRunnerCapabilities.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const view = render(drawAuthorization());
    fireEvent.click(await screen.findByRole("button", { name: "Authorize Background Processes" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Authorize Background Processes" }));
    const replacement = { ...settings, target: { ...target, client_id: "replacement", config_path: "/other/runner.toml" } };
    api.runnerCapabilityAuthorization.mockResolvedValue({ ...authorization(), target: replacement.target });
    view.rerender(drawAuthorization(replacement));
    await act(async () => complete(authorization(true)));
    await screen.findByRole("button", { name: "Authorize Background Processes" });
    expect(screen.queryByText("Background process access is authorized for this connection.")).not.toBeInTheDocument();
    expect(api.authorizeRunnerCapabilities).toHaveBeenCalledExactlyOnceWith(target, "detached_execution");
  });
});

describe("Codex network choice", () => {
  it("starts disabled and saves only the explicitly prepared network-enabled profile", async () => {
    const generated = profile(true);
    api.prepareCodexCodingAgent.mockResolvedValue({ target, expected_revision: 3, codex_version: "fixture", profile: generated });
    api.saveCodingAgent.mockReturnValue(new Promise(() => {}));
    render(drawCodex());
    const network = screen.getByRole("checkbox", { name: "Allow Codex Network Access" });
    expect(network).not.toBeChecked();
    expect(screen.getByText(/Keeps the workspace write sandbox and approval requests/)).toBeVisible();
    fireEvent.click(network); fireEvent.click(screen.getByRole("button", { name: "Prepare Codex Configuration" }));
    const save = await screen.findByRole("button", { name: "Save and Enable Codex" });
    expect(api.prepareCodexCodingAgent).toHaveBeenCalledExactlyOnceWith({ target, expected_revision: 3, codex_args: [], allow_network: true });
    expect(screen.getByText(/Network access will be allowed/)).toBeVisible();
    expect(api.saveCodingAgent).not.toHaveBeenCalled();
    fireEvent.click(save);
    await waitFor(() => expect(api.saveCodingAgent).toHaveBeenCalledExactlyOnceWith({ target, expected_revision: 3, previous_id: null, profile: { ...generated, enabled: true }, global_settings: null }));
    expect(generated.enabled).toBe(false);
  });

  it.each([false, true])("rejects a prepared profile that changes the network choice from %s", async selected => {
    api.prepareCodexCodingAgent.mockResolvedValue({ target, expected_revision: 3, codex_version: "fixture", profile: profile(!selected) });
    render(drawCodex());
    if (selected) fireEvent.click(screen.getByRole("checkbox", { name: "Allow Codex Network Access" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare Codex Configuration" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Runner connection or saved configuration changed");
    expect(screen.queryByRole("button", { name: "Save and Enable Codex" })).not.toBeInTheDocument();
    expect(api.saveCodingAgent).not.toHaveBeenCalled();
  });
});
