import { useState } from "react";
import { act, fireEvent, queryHelpers, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../i18n/locale";
import { DesktopMantineProvider } from "../components/DesktopMantineProvider";
import { PRODUCT_LOCALES } from "../i18n/product";
import { RUNNER_CAPABILITIES_MESSAGES, runnerCapabilitiesText } from "../i18n/runner-capabilities";
import type { DesktopState, RunnerSettings } from "../models/topology";
import { codingAgentIsActive, EMPTY_CODING_AGENTS, type CodingAgentProfile, type CodingAgentRequest, type SshResource, type SshResourcesSnapshot } from "../models/runner-capabilities";
import { CodingAgentsPanel } from "./extensions/CodingAgentsPanel";
import { SshResourcesPanel } from "./extensions/SshResourcesPanel";
import { RunnerCapabilityAuthorization } from "./extensions/RunnerCapabilityAuthorization";

const api = vi.hoisted(() => ({ prepareCodexCodingAgent: vi.fn(), saveCodingAgent: vi.fn(), removeCodingAgent: vi.fn(), runnerSettings: vi.fn(), restartOwnedRunner: vi.fn(), sshResources: vi.fn(), registerSshResource: vi.fn(), removeSshResource: vi.fn(), inspectSshConnection: vi.fn(), probeSshConnection: vi.fn(), authorizeRunnerCapabilities: vi.fn(), runnerCapabilityAuthorization: vi.fn() }));
const query = vi.hoisted(() => vi.fn());
vi.mock("../lib/desktop-api", () => ({ desktopApi: api }));
vi.mock("./workspace/WorkspaceContext", () => ({ workspaceQuery: query }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
const target = { config_path: "/fixture/runner.toml", client_id: "fixture", server_url: "http://127.0.0.1:62645" };
const settings: RunnerSettings = { target, paths: { instruction_files: [], skill_roots: [] }, file_access: { configured_roots: [], effective_roots: ["/fixture"], using_default_roots: true, allow_cwd_anywhere: false }, plugin_ids: [], can_restart: true };
const profile: CodingAgentProfile = { provider_id: "pi", name: "Pi Agent", executable: "/fixture/pi-acp", args: ["--acp"], enabled: true, env_from_env: {}, allowed_config_options: [] };
function state(): DesktopState {
  return {
    topology: { experience: "full", server: { kind: "local" }, runner: { kind: "local" }, exposure: { kind: "none" }, enrollment: { kind: "managed_pairing" } },
    project: { path: "/fixture", allowed_root: "/fixture", is_git_repository: true, runtime_project_id: "agent:fixture:project" },
    readiness: { runtime_ready: true, ready_for_chatgpt: false, server: "ready", runner: "ready", exposure: "local_ready", project: "ready", summary: "Ready", summary_kind: "runtime_ready_local_only", next_action: "", next_action_kind: "choose_connection" },
    openai_tunnel_config: { source: "file", tunnel_id_present: true, api_key_present: true, saved_tunnel_id: "fixture", effective_tunnel_id: "fixture" },
    activity_sequence: 0, openai_tunnel_configured: true, regular_tunnel_available: true, runtime_autostart: true, preferred_connection: "no_chat_gpt",
    tunnel_proxy: { mode: "auto", custom_url: null, effective_source: "direct", effective_proxy_present: false, system_proxy_detected: false },
    coding_agents: { ...EMPTY_CODING_AGENTS, profiles: [] },
  };
}
function inventory(resources: SshResource[] = [], observation = "first"): SshResourcesSnapshot {
  return { runner: "fixture", available: true, setup_supported: true, observation_id: observation, resources, error_kind: null };
}
function resource(name: string, source: "static" | "managed" = "managed", pending = false): SshResource {
  return { name, source, active: !pending, pending_restart: pending };
}
function Harness({ mode = "acp", initial = state() }: { mode?: "acp" | "ssh"; initial?: DesktopState }) {
  const [snapshot, setSnapshot] = useState(initial);
  return <LocaleProvider><DesktopMantineProvider env="test">{mode === "acp"
    ? <CodingAgentsPanel state={snapshot} onState={setSnapshot} settings={settings} onRestarted={() => undefined} />
    : <SshResourcesPanel state={snapshot} onState={setSnapshot} settings={settings} onRestarted={() => undefined} />}</DesktopMantineProvider></LocaleProvider>;
}
beforeEach(() => {
  vi.resetAllMocks(); localStorage.setItem("webcodex.desktop.locale", "en-US");
  api.runnerSettings.mockResolvedValue(settings);
  api.runnerCapabilityAuthorization.mockResolvedValue({ target, can_authorize: true, coding_agents: true, ssh_resources: true });
  api.restartOwnedRunner.mockResolvedValue(state());
  api.sshResources.mockResolvedValue(inventory());
  query.mockResolvedValue({ client_id: "fixture", connected: true, coding_agent_providers: [] });
});

describe("Desktop Coding Agents", () => {
  it("saves desired configuration with names-only environment then explicitly restarts and observes Active", async () => {
    const captured: CodingAgentRequest[] = [];
    const saved = state(); saved.coding_agents = { ...EMPTY_CODING_AGENTS, revision: 1, profiles: [profile], restart_required: true };
    api.saveCodingAgent.mockImplementation(async request => { captured.push(structuredClone(request)); return saved; });
    api.restartOwnedRunner.mockImplementation(async () => {
      query.mockResolvedValue({ client_id: "fixture", connected: true, coding_agent_providers: [{ provider_id: "pi", name: "Pi Agent" }] });
      return { ...saved, coding_agents: { ...saved.coding_agents, restart_required: false } };
    });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add Coding Agent" }));
    const dialog = screen.getByRole("dialog", { name: "Add coding agent" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Pi Agent" } });
    fireEvent.change(within(dialog).getByLabelText("Provider ID"), { target: { value: "pi" } });
    fireEvent.change(within(dialog).getByLabelText("Executable"), { target: { value: "/fixture/pi-acp" } });
    fireEvent.change(within(dialog).getByLabelText("Arguments"), { target: { value: '["--acp"]' } });
    fireEvent.click(within(dialog).getByText("Advanced"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Environment Mapping" }));
    fireEvent.change(within(dialog).getByLabelText("Child Environment Variable 1"), { target: { value: "OPENAI_API_KEY" } });
    fireEvent.change(within(dialog).getByLabelText("Runner Environment Variable 1"), { target: { value: "SUB2API_API_KEY" } });
    expect(within(dialog).queryByLabelText(/secret value|private value|api key/i)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ target, expected_revision: 0, previous_id: null, profile: { ...profile, env_from_env: { OPENAI_API_KEY: "SUB2API_API_KEY" } }, global_settings: null });
    expect(captured[0].profile).not.toHaveProperty("env");
    expect(screen.getByText("Saved · Restart Runner to apply")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Pi Agent" })).queryByText(/Configured · Active/)).not.toBeInTheDocument();
    expect(api.restartOwnedRunner).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Restart Runner" }));
    await waitFor(() => expect(api.restartOwnedRunner).toHaveBeenCalledExactlyOnceWith(target));
    await waitFor(() => expect(within(screen.getByRole("article", { name: "Pi Agent" })).getByText("Configured · Active")).toBeInTheDocument());
    expect(query).toHaveBeenLastCalledWith({ kind: "runner_details" });
  });

  it("leaves environment empty until the user chooses the PATH/HOME shortcut and saves only names", async () => {
    const initial = state(); initial.coding_agents = { ...EMPTY_CODING_AGENTS, profiles: [profile] };
    api.saveCodingAgent.mockResolvedValue(initial);
    render(<Harness initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Pi Agent" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/ACP agents start with a cleared environment/)).toBeVisible();
    expect(within(dialog).queryByLabelText("Child Environment Variable 1")).not.toBeInTheDocument();
    expect(api.saveCodingAgent).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Missing PATH/HOME Mappings" }));
    expect(within(dialog).getByLabelText("Child Environment Variable 1")).toBeVisible();
    expect(within(dialog).getByLabelText("Child Environment Variable 1")).toHaveValue("PATH");
    expect(within(dialog).getByLabelText("Runner Environment Variable 2")).toHaveValue("HOME");
    expect(within(dialog).getByRole("button", { name: "Add Missing PATH/HOME Mappings" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.saveCodingAgent).toHaveBeenCalledWith(expect.objectContaining({ profile: { ...profile, env_from_env: { PATH: "PATH", HOME: "HOME" } } })));
    expect(api.restartOwnedRunner).not.toHaveBeenCalled();
  });

  it("saves no implicit environment mappings when the shortcut is not selected", async () => {
    const initial = state(); initial.coding_agents = { ...EMPTY_CODING_AGENTS, profiles: [profile] };
    api.saveCodingAgent.mockResolvedValue(initial);
    render(<Harness initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Pi Agent" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.saveCodingAgent).toHaveBeenCalledWith(expect.objectContaining({ profile })));
  });

  it("preserves case-insensitive destinations and user-entered Runner sources while adding only missing names", async () => {
    const initial = state(); initial.coding_agents = { ...EMPTY_CODING_AGENTS, profiles: [{ ...profile, env_from_env: { path: "CUSTOM_PATH" } }] };
    api.saveCodingAgent.mockResolvedValue(initial);
    render(<Harness initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Pi Agent" }));
    fireEvent.click(screen.getByText("Advanced"));
    fireEvent.change(screen.getByLabelText("Runner Environment Variable 1"), { target: { value: "MY_NODE_PATH" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Missing PATH/HOME Mappings" }));
    expect(screen.getByLabelText("Child Environment Variable 1")).toHaveValue("path");
    expect(screen.getByLabelText("Runner Environment Variable 1")).toHaveValue("MY_NODE_PATH");
    expect(screen.getByLabelText("Child Environment Variable 2")).toHaveValue("HOME");
    expect(screen.queryByLabelText("Child Environment Variable 3")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.saveCodingAgent).toHaveBeenCalledWith(expect.objectContaining({ profile: { ...profile, env_from_env: { path: "MY_NODE_PATH", HOME: "HOME" } } })));
  });

  it("adds only the available mapping slot, then allows the remaining name after a row is removed", async () => {
    const env = Object.fromEntries(Array.from({ length: 63 }, (_, i) => [`VAR_${i}`, `SOURCE_${i}`]));
    const initial = state(); initial.coding_agents = { ...EMPTY_CODING_AGENTS, profiles: [{ ...profile, env_from_env: env }] };
    api.saveCodingAgent.mockResolvedValue(initial);
    render(<Harness initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Pi Agent" }));
    const dialog = screen.getByRole("dialog");
    // getByLabelText rebuilds jsdom's document-wide label associations after each
    // row mutation. Query the existing aria-labels directly for this large form.
    const queryControl = (label: string) => queryHelpers.queryByAttribute("aria-label", dialog, label);
    const control = (label: string) => {
      const element = queryControl(label);
      if (!element) throw queryHelpers.getElementError(`Missing control: ${label}`, dialog);
      return element;
    };
    fireEvent.click(control("Add Missing PATH/HOME Mappings"));
    expect(control("Child Environment Variable 64")).toHaveValue("PATH");
    expect(queryControl("Child Environment Variable 65")).not.toBeInTheDocument();
    expect(control("Add Missing PATH/HOME Mappings")).toBeDisabled();
    expect(control("Add Environment Mapping")).toBeDisabled();
    fireEvent.click(control("Remove Environment Mapping 1"));
    fireEvent.click(control("Add Missing PATH/HOME Mappings"));
    expect(control("Child Environment Variable 65")).toHaveValue("HOME");
    expect(control("Add Missing PATH/HOME Mappings")).toBeDisabled();
    fireEvent.click(control("Save"));
    const { VAR_0: _removed, ...remaining } = env;
    await waitFor(() => expect(api.saveCodingAgent).toHaveBeenCalledWith(expect.objectContaining({ profile: { ...profile, env_from_env: { ...remaining, PATH: "PATH", HOME: "HOME" } } })));
  });

  it("never invents Active from desired state, another Runner or a stale provider name", async () => {
    expect(codingAgentIsActive(profile, null)).toBe(false);
    expect(codingAgentIsActive(profile, { client_id: "fixture", connected: false, coding_agent_providers: [profile] })).toBe(false);
    expect(codingAgentIsActive(profile, { client_id: "fixture", connected: true, coding_agent_providers: [{ provider_id: "pi", name: "Old Pi" }] })).toBe(false);
    const initial = state(); initial.coding_agents = { ...EMPTY_CODING_AGENTS, revision: 1, profiles: [profile] };
    query.mockResolvedValue({ client_id: "other-runner", connected: true, coding_agent_providers: [profile] });
    render(<Harness initial={initial} />);
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    expect(within(screen.getByRole("article", { name: "Pi Agent" })).queryByText("Configured · Active")).not.toBeInTheDocument();
  });

  it("edits only a Desktop-owned ID and fences removal against the opened revision", async () => {
    const initial = state(); initial.coding_agents = { ...EMPTY_CODING_AGENTS, revision: 7, profiles: [profile] };
    api.saveCodingAgent.mockResolvedValue(initial); api.removeCodingAgent.mockResolvedValue(state());
    query.mockResolvedValue({ client_id: "fixture", connected: true, coding_agent_providers: [profile, { provider_id: "operator", name: "Operator Agent" }] });
    render(<Harness initial={initial} />);
    await screen.findByText("Operator Agent");
    expect(screen.queryByRole("button", { name: "Edit Operator Agent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Operator Agent" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Pi Agent" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Pi Local" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.saveCodingAgent).toHaveBeenCalledWith(expect.objectContaining({ expected_revision: 7, previous_id: "pi", target }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Pi Agent" }));
    expect(api.removeCodingAgent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Remove Pi Agent" }));
    await waitFor(() => expect(api.removeCodingAgent).toHaveBeenCalledExactlyOnceWith(target, "pi", 7));
    expect(api.restartOwnedRunner).not.toHaveBeenCalled();
  });

  it("fails ownership conflicts without echoing backend secrets and never auto retries", async () => {
    const initial = state(); initial.coding_agents = { ...EMPTY_CODING_AGENTS, profiles: [profile] };
    api.saveCodingAgent.mockRejectedValue({ code: "coding_agent_ownership_conflict", message: "private-fixture-sentinel" });
    render(<Harness initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Pi Agent" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("nothing was overwritten"));
    expect(document.body.textContent).not.toContain("private-fixture-sentinel");
    expect(api.saveCodingAgent).toHaveBeenCalledTimes(1);
    expect(api.restartOwnedRunner).not.toHaveBeenCalled();
  });
});

describe("Desktop SSH Resources", () => {
  it("shows authoritative Managed/Static/pending state and never offers static removal", async () => {
    api.sshResources.mockResolvedValue(inventory([resource("managed"), resource("static", "static"), resource("pending", "managed", true)]));
    render(<Harness mode="ssh" />);
    await screen.findByRole("article", { name: "static" });
    expect(within(screen.getByRole("article", { name: "static" })).getByText("From config file · Loaded in Runner · Read only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove static" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove managed" })).toBeEnabled();
    expect(within(screen.getByRole("article", { name: "pending" })).getByText("Managed by WebCodex · Configured · Restart required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart Runner" })).toBeEnabled();
  });

  it("adds with a fresh observation, clears target/cwd, then removes using another fresh observation", async () => {
    let rows: SshResource[] = []; let revision = 0;
    api.sshResources.mockImplementation(async () => inventory(rows, `obs-${++revision}`));
    api.registerSshResource.mockImplementation(async () => { rows = [resource("temporary")]; return { success: true, error_kind: null, restart_required: false, inventory: inventory(rows, "after-register") }; });
    api.removeSshResource.mockResolvedValue({ success: true, error_kind: null, restart_required: false, inventory: inventory([], "after-remove") });
    render(<Harness mode="ssh" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add SSH Resource" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add SSH Resource" }));
    await screen.findByRole("dialog", { name: "Add SSH resource" });
    fireEvent.click(screen.getByRole("combobox", { name: "Connection Type" }));
    fireEvent.click(await screen.findByRole("option", { name: "OpenSSH alias" }));
    fireEvent.change(screen.getByLabelText("Resource Name"), { target: { value: "temporary" } });
    fireEvent.change(screen.getByLabelText("Target"), { target: { value: "fixture-user@fixture-private-host" } });
    fireEvent.change(screen.getByLabelText("Default Working Directory"), { target: { value: "/fixture-private/cwd" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("article", { name: "temporary" });
    expect(api.registerSshResource).toHaveBeenCalledExactlyOnceWith({ expected: target, observation_id: "obs-2", name: "temporary", connection: { kind: "alias", target: "fixture-user@fixture-private-host" }, default_cwd: "/fixture-private/cwd" });
    expect(document.body.textContent).not.toContain("fixture-private-host");
    expect(document.body.textContent).not.toContain("/fixture-private/cwd");
    expect(screen.queryByLabelText("Target")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove temporary" }));
    await screen.findByRole("dialog", { name: "Remove temporary" });
    expect(api.removeSshResource).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Remove temporary" }));
    await waitFor(() => expect(api.removeSshResource).toHaveBeenCalledExactlyOnceWith(target, "obs-3", "temporary"));
    await waitFor(() => expect(screen.queryByRole("article", { name: "temporary" })).not.toBeInTheDocument());
    expect(api.restartOwnedRunner).not.toHaveBeenCalled();
  });

  it("separates a verified connection from loaded configuration and clears verification on restart", async () => {
    const fingerprint = `SHA256:${"A".repeat(43)}`;
    let rows: SshResource[] = [];
    api.sshResources.mockImplementation(async () => inventory(rows, "observed"));
    api.inspectSshConnection.mockResolvedValue({ success: true, error_kind: null, inspection: {
      challenge_id: "fixture-challenge", expires_at: Math.floor(Date.now() / 1000) + 300,
      host_keys: [{ algorithm: "ssh-ed25519", fingerprint }],
    } });
    api.probeSshConnection.mockResolvedValue({ success: true, error_kind: null, verified: true });
    api.registerSshResource.mockImplementation(async () => {
      rows = [resource("production", "managed", true)];
      return { success: true, error_kind: null, restart_required: true, inventory: inventory(rows, "saved") };
    });
    api.restartOwnedRunner.mockImplementation(async () => { rows = [resource("production")]; return state(); });
    render(<Harness mode="ssh" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add SSH Resource" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add SSH Resource" }));
    await screen.findByRole("dialog", { name: "Add SSH resource" });
    fireEvent.change(screen.getByLabelText("Resource Name"), { target: { value: "production" } });
    fireEvent.change(screen.getByLabelText("Host or IP Address"), { target: { value: "192.0.2.10" } });
    fireEvent.change(screen.getByLabelText("SSH Username"), { target: { value: "operator" } });
    fireEvent.change(screen.getByLabelText("SSH Password"), { target: { value: "fixture-only-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify SSH Host" }));
    fireEvent.click(await screen.findByRole("radio", { name: `Trust ${fingerprint}` }));
    fireEvent.click(screen.getByRole("button", { name: "Test SSH Connection" }));
    await screen.findByText("Connection verified");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const saved = await screen.findByRole("article", { name: "production" });
    expect(within(saved).getByText("Connection verified")).toBeInTheDocument();
    expect(within(saved).queryByText(/Loaded in Runner/)).not.toBeInTheDocument();
    expect(api.restartOwnedRunner).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Restart Runner" }));
    await waitFor(() => expect(api.restartOwnedRunner).toHaveBeenCalledExactlyOnceWith(target));
    const loaded = await screen.findByRole("article", { name: "production" });
    expect(within(loaded).getByText(/Loaded in Runner/)).toBeInTheDocument();
    expect(within(loaded).getByText("Connection not verified")).toBeInTheDocument();
    expect(within(loaded).queryByText("Connection verified")).not.toBeInTheDocument();
  });

  it("discards an open SSH credential form when the selected Runner changes", async () => {
    const view = (currentSettings: RunnerSettings) => <LocaleProvider><DesktopMantineProvider env="test"><SshResourcesPanel state={state()} settings={currentSettings} onState={() => undefined} onRestarted={() => undefined} /></DesktopMantineProvider></LocaleProvider>;
    const rendered = render(view(settings));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add SSH Resource" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add SSH Resource" }));
    await screen.findByRole("dialog", { name: "Add SSH resource" });
    fireEvent.change(screen.getByLabelText("SSH Password"), { target: { value: "fixture-private-draft" } });
    rendered.rerender(view({ ...settings, target: { ...target, client_id: "another-runner" } }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.registerSshResource).not.toHaveBeenCalled(); expect(api.probeSshConnection).not.toHaveBeenCalled();
  });

  it.each(["canonical", "ipc"])("keeps %s unknown outcomes visible until Refresh without retrying", async kind => {
    api.sshResources.mockResolvedValue(inventory([resource("temporary")]));
    if (kind === "canonical") api.removeSshResource.mockResolvedValue({ success: false, error_kind: "ssh_resource_outcome_unknown", restart_required: false, inventory: inventory([], "fresh") });
    else api.removeSshResource.mockRejectedValue({ message: "private-ipc-error" });
    render(<Harness mode="ssh" />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove temporary" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Remove temporary" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Operation status uncertain"));
    expect(api.removeSshResource).toHaveBeenCalledTimes(1);
    expect(api.registerSshResource).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("private-ipc-error");
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh SSH Resources" })).toBeEnabled());
    api.sshResources.mockResolvedValue(inventory([], "confirmed"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh SSH Resources" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(api.removeSshResource).toHaveBeenCalledTimes(1);
  });

  it.each(["acp", "ssh"] as const)("%s uses shared explicit local authorization, independently of SSH inventory", async mode => {
    api.runnerCapabilityAuthorization.mockResolvedValue({ target, can_authorize: true, coding_agents: false, ssh_resources: false });
    // Coding Agents must work without *any* SSH inventory, capability or request.
    api.sshResources.mockRejectedValue(new Error("ssh-unavailable-fixture"));
    api.authorizeRunnerCapabilities.mockImplementation(async () => {
      api.runnerCapabilityAuthorization.mockResolvedValue({ target, can_authorize: true, coding_agents: true, ssh_resources: true });
      api.sshResources.mockResolvedValue(inventory([], "authorized"));
      return { target, can_authorize: true, coding_agents: true, ssh_resources: true };
    });
    render(<Harness mode={mode} />);
    fireEvent.click(await screen.findByRole("button", { name: "Authorize Runner Capabilities" }));
    expect(api.authorizeRunnerCapabilities).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Authorize Runner capabilities" });
    expect(within(dialog).getByText(/Existing tokens, expiry/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Authorize Runner Capabilities" }));
    await waitFor(() => expect(api.authorizeRunnerCapabilities).toHaveBeenCalledExactlyOnceWith(target));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Authorize Runner Capabilities" })).not.toBeInTheDocument());
    expect(api.registerSshResource).not.toHaveBeenCalled(); expect(api.restartOwnedRunner).not.toHaveBeenCalled();
    if (mode === "acp") expect(api.sshResources).not.toHaveBeenCalled();
    else await waitFor(() => expect(screen.getByRole("button", { name: "Add SSH Resource" })).toBeEnabled());
  });

  it("Coding Agents grant failures only reobserve scopes and require an explicit retry", async () => {
    api.runnerCapabilityAuthorization.mockResolvedValue({ target, can_authorize: true, coding_agents: false, ssh_resources: true });
    api.authorizeRunnerCapabilities.mockRejectedValue({ message: "private-grant-sentinel" });
    render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Authorize Runner Capabilities" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Authorize Runner Capabilities" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Authorization was not confirmed"));
    expect(api.authorizeRunnerCapabilities).toHaveBeenCalledTimes(1);
    expect(api.runnerCapabilityAuthorization).toHaveBeenCalledTimes(2);
    expect(api.sshResources).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("private-grant-sentinel");
    api.runnerCapabilityAuthorization.mockResolvedValue({ target, can_authorize: true, coding_agents: true, ssh_resources: true });
    fireEvent.click(screen.getByRole("button", { name: "Refresh Runner Authorization" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(api.authorizeRunnerCapabilities).toHaveBeenCalledTimes(1);
  });

  it("never offers local operator grant for remote connections or silently retries failed grants", async () => {
    const denied = { ...inventory(), available: false, observation_id: null, error_kind: "insufficient_scope" };
    api.runnerCapabilityAuthorization.mockResolvedValue({ target, can_authorize: false, coding_agents: false, ssh_resources: false });
    api.sshResources.mockResolvedValue(denied);
    render(<Harness mode="ssh" />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Authorize Runner Capabilities" })).not.toBeInTheDocument();
    expect(api.authorizeRunnerCapabilities).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add SSH Resource" })).toBeDisabled();
  });
});

it("connection replacement discards an open shared authorization confirmation", async () => {
  api.runnerCapabilityAuthorization.mockResolvedValue({ target, can_authorize:true, coding_agents:false, ssh_resources:false });
  const renderFlow=(value: RunnerSettings) => <LocaleProvider><DesktopMantineProvider><RunnerCapabilityAuthorization settings={value} capability="coding_agents" disabled={false} onAuthorized={() => undefined} /></DesktopMantineProvider></LocaleProvider>;
  const view=render(renderFlow(settings));
  fireEvent.click(await screen.findByRole("button", {name:"Authorize Runner Capabilities"}));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  const replaced={...settings,target:{...target,client_id:"replacement"}};
  api.runnerCapabilityAuthorization.mockResolvedValue({target:replaced.target,can_authorize:true,coding_agents:false,ssh_resources:false});
  view.rerender(renderFlow(replaced));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(api.authorizeRunnerCapabilities).not.toHaveBeenCalled();
  expect(api.sshResources).not.toHaveBeenCalled();
});

it("provides every capability label in every supported locale", () => {
  for (const [key, values] of Object.entries(RUNNER_CAPABILITIES_MESSAGES)) {
    expect(values).toHaveLength(PRODUCT_LOCALES.length);
    for (const locale of PRODUCT_LOCALES) expect(runnerCapabilitiesText(locale, key as keyof typeof RUNNER_CAPABILITIES_MESSAGES).trim()).not.toBe("");
  }
});


describe("Desktop approval and Codex setup flows", () => {
  it("explicitly grants only approval capability and submits the exact selected callback through the native bridge", async () => {
    let granted = false;
    const authorization = () => ({ target, can_authorize: true, coding_agents: true, ssh_resources: false, permission_approval_granted: granted, permission_approval_grant_available: !granted });
    api.runnerCapabilityAuthorization.mockImplementation(async () => authorization());
    api.authorizeRunnerCapabilities.mockImplementation(async () => { granted = true; return authorization(); });
    query.mockImplementation(async request => request.kind === "coding_agent_runs" ? {
      authorization: { can_run: true, can_approve: granted },
      runs: [{ run_id: "wc_agent_run_test", runtime_project_id: "agent:fixture:project", provider_id: "codex", state: "waiting_permission", observation_revision: 2, pending_permission: {
        request_id: "wc_agent_permission_test", label: "Run the tests?", details: "npm test\nWorking directory: /fixture", expires_at: Math.floor(Date.now()/1000) + 300,
        options: [{ option_id: "exact-provider-choice", name: "Approve command", kind: "allow_once" }],
      } }],
    } : request.kind === "coding_agent_permission" ? { success: true, output: { response_accepted: true } } : { client_id: "fixture", connected: true, coding_agent_providers: [] });
    render(<Harness />); fireEvent.click(screen.getByRole("button", { name: "Review Coding Approvals" }));
    await screen.findByText("Run the tests?");
    expect(screen.getByRole("article", { name: "Run the tests?" }).querySelector("pre")?.textContent).toBe("npm test\nWorking directory: /fixture");
    expect(screen.getByRole("button", { name: /Allow once/ })).toBeDisabled();
    expect(api.authorizeRunnerCapabilities).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Authorize Coding Approvals" }));
    const dialog = screen.getByRole("dialog"); const consent = within(dialog).getByRole("checkbox");
    expect(consent).not.toBeChecked();
    expect(within(dialog).getByText(/Any client that holds this credential/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Confirm Authorize Coding Approvals" });
    expect(confirm).toBeDisabled(); fireEvent.click(consent); fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(api.authorizeRunnerCapabilities).toHaveBeenCalledExactlyOnceWith(target, "coding_approval"));
    await waitFor(() => expect(screen.getByRole("button", { name: /Allow once/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Allow once/ }));
    await screen.findByText("One-time approval received — waiting for the agent to continue");
    expect(query.mock.calls.filter(([request]) => request.kind === "coding_agent_permission")).toEqual([[{
      kind: "coding_agent_permission", expected: target, run_id: "wc_agent_run_test", request_id: "wc_agent_permission_test", outcome: "selected", option_id: "exact-provider-choice",
    }]]);
    expect(api.restartOwnedRunner).not.toHaveBeenCalled();
  });

  it("prepares Codex automatically, saves and enables only on the next explicit action, then exposes Runner restart", async () => {
    const generated: CodingAgentProfile = { provider_id: "codex-app-server", name: "Codex app-server (experimental)", executable: "/fixture/python3", args: ["/fixture/adapter.py", "serve", "--experimental", "--receipt", "/fixture/receipt.json"], enabled: false, env_from_env: { PATH: "PATH", HOME: "HOME" }, allowed_config_options: [] };
    api.prepareCodexCodingAgent.mockResolvedValue({ target, expected_revision: 0, codex_version: "0.1.0-fixture", profile: generated });
    const saved = state(); saved.coding_agents = { ...EMPTY_CODING_AGENTS, revision: 1, profiles: [{ ...generated, enabled: true }], restart_required: true };
    api.saveCodingAgent.mockResolvedValue(saved);
    render(<Harness />); fireEvent.click(screen.getByRole("button", { name: "Configure Codex" }));
    expect(api.prepareCodexCodingAgent).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Python Executable").closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Prepare Codex Configuration" }));
    const save = await screen.findByRole("button", { name: "Save and Enable Codex" });
    expect(api.prepareCodexCodingAgent).toHaveBeenCalledExactlyOnceWith({ target, expected_revision: 0, codex_args: [], allow_network: false });
    expect(api.saveCodingAgent).not.toHaveBeenCalled(); expect(api.authorizeRunnerCapabilities).not.toHaveBeenCalled(); expect(api.restartOwnedRunner).not.toHaveBeenCalled();
    fireEvent.click(save); fireEvent.click(save);
    await waitFor(() => expect(api.saveCodingAgent).toHaveBeenCalledExactlyOnceWith({ target, expected_revision: 0, previous_id: null, profile: { ...generated, enabled: true }, global_settings: null }));
    await screen.findByText("Saved · Restart Runner to apply");
    expect(generated.enabled).toBe(false); expect(api.restartOwnedRunner).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Restart Runner" })).toBeEnabled();
  });

  it("does not expose arbitrary diagnostic text or retry unavailable Python automatically", async () => {
    api.prepareCodexCodingAgent.mockRejectedValue({code: "codex_python_unavailable", message: "private-diagnostic-sentinel"});
    render(<Harness />); fireEvent.click(screen.getByRole("button", { name: "Configure Codex" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare Codex Configuration" }));
    await screen.findByText(/Python 3.10\+ was not found/);
    expect(screen.queryByText(/private-diagnostic-sentinel/)).not.toBeInTheDocument();
    expect(api.prepareCodexCodingAgent).toHaveBeenCalledTimes(1); expect(api.saveCodingAgent).not.toHaveBeenCalled();
  });

  it("rejects more than the canonical eight launcher arguments before native setup", async () => {
    render(<Harness />); fireEvent.click(screen.getByRole("button", { name: "Configure Codex" }));
    fireEvent.click(screen.getByText("Advanced"));
    fireEvent.change(screen.getByLabelText("Codex launcher arguments (JSON)"), {target:{value:JSON.stringify(Array(9).fill("argument"))}});
    fireEvent.click(screen.getByRole("button", { name: "Prepare Codex Configuration" }));
    await screen.findByRole("alert"); expect(api.prepareCodexCodingAgent).not.toHaveBeenCalled();
  });

  it("discards an old connection's prepared Codex profile before it can be saved", async () => {
    let finish!: (value: unknown) => void; api.prepareCodexCodingAgent.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const draw = (value: RunnerSettings) => <LocaleProvider><DesktopMantineProvider><CodingAgentsPanel state={state()} onState={() => undefined} settings={value} onRestarted={() => undefined} /></DesktopMantineProvider></LocaleProvider>;
    const view = render(draw(settings)); fireEvent.click(screen.getByRole("button", {name:"Configure Codex"})); fireEvent.click(screen.getByRole("button", {name:"Prepare Codex Configuration"}));
    view.rerender(draw({...settings,target:{...target,client_id:"replacement"}}));
    await act(async () => finish({ target, expected_revision: 0, codex_version: "fixture", profile: { ...profile, enabled: false } }));
    expect(screen.queryByRole("button",{name:"Save and Enable Codex"})).not.toBeInTheDocument(); expect(api.saveCodingAgent).not.toHaveBeenCalled();
  });
});
