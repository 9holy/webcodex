import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopMantineProvider } from "../components/DesktopMantineProvider";
import { LocaleProvider } from "../i18n/locale";
import { PRODUCT_LOCALES } from "../i18n/product";
import { SSH_CONNECTION_MESSAGES, sshConnectionText } from "../i18n/ssh-connections";
import type { SshProbeRequest, SshRegisterRequest } from "../models/runner-capabilities";
import { SshConnectionEditor } from "./extensions/SshConnectionEditor";

const api = vi.hoisted(() => ({ inspectSshConnection: vi.fn(), probeSshConnection: vi.fn() }));
const pickFile = vi.hoisted(() => vi.fn());
vi.mock("../lib/desktop-api", () => ({ desktopApi: api }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: pickFile }));
const target = { config_path: "/fixture/runner.toml", client_id: "fixture", server_url: "http://127.0.0.1:62645" };
const observed = { expected: target, observationId: "fixture-observation" };
const fingerprint = `SHA256:${"A".repeat(43)}`;
const endpoint = { host: "192.0.2.10", port: 22, user: "operator" };
const hostKey = { challenge_id: "fixture-challenge", fingerprint };
const inspection = () => ({ challenge_id: hostKey.challenge_id, expires_at: Math.floor(Date.now() / 1000) + 300, host_keys: [{ algorithm: "ssh-ed25519", fingerprint }] });

function show({ onSubmit = vi.fn(async () => undefined), setupSupported = true, canChooseKey = true, onClose = vi.fn() }: {
  onSubmit?: (request: SshRegisterRequest) => Promise<void>; setupSupported?: boolean; canChooseKey?: boolean; onClose?: () => void;
} = {}) {
  return render(<LocaleProvider><DesktopMantineProvider env="test"><SshConnectionEditor observed={observed} busy={false} setupSupported={setupSupported} canChooseKey={canChooseKey} onSubmit={onSubmit} onClose={onClose} /></DesktopMantineProvider></LocaleProvider>);
}
function fillHost(username = endpoint.user) {
  fireEvent.change(screen.getByLabelText("Resource Name"), { target: { value: "production" } });
  fireEvent.change(screen.getByLabelText("Host or IP Address"), { target: { value: endpoint.host } });
  fireEvent.change(screen.getByLabelText("SSH Username"), { target: { value: username } });
}
async function choose(label: string, value: string) {
  if (label === "Connection Type") {
    const advanced = screen.getByText("Advanced settings").closest("details");
    if (!advanced?.open) fireEvent.click(screen.getByText("Advanced settings"));
  }
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name: value }));
}
async function trustAndProbe() {
  fireEvent.click(screen.getByRole("button", { name: "Verify SSH Host" }));
  fireEvent.click(await screen.findByRole("radio", { name: `Trust ${fingerprint}` }));
  fireEvent.click(screen.getByRole("button", { name: "Test SSH Connection" }));
  await screen.findByText("Connection verified");
}

beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); localStorage.setItem("webcodex.desktop.locale", "en-US");
  api.inspectSshConnection.mockResolvedValue({ success: true, error_kind: null, inspection: inspection() });
  api.probeSshConnection.mockResolvedValue({ success: true, error_kind: null, verified: true });
});

describe("SSH connection setup", () => {
  it("offers ordinary host, port, user and password fields without granting trust or saving implicitly", () => {
    show();
    expect(screen.getByLabelText("Host or IP Address")).toBeVisible();
    expect(screen.getByLabelText("SSH Port")).toHaveValue("22");
    expect(screen.getByLabelText("SSH Username")).toBeVisible();
    expect(screen.getByLabelText("SSH Password")).toHaveAttribute("type", "password");
    expect(screen.queryByLabelText("Target")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(api.inspectSshConnection).not.toHaveBeenCalled(); expect(api.probeSshConnection).not.toHaveBeenCalled();
  });

  it("suggests a bounded connection name from the address without overwriting an edited name", () => {
    show();
    const field = screen.getByLabelText("Resource Name");
    fireEvent.change(screen.getByLabelText("Host or IP Address"), { target: { value: endpoint.host } });
    expect(field).toHaveValue("ssh-192-0-2-10");
    fireEvent.change(screen.getByLabelText("Host or IP Address"), { target: { value: "[2001:db8::1]" } });
    expect(field).toHaveValue("ssh-2001-db8-1");
    fireEvent.change(screen.getByLabelText("Host or IP Address"), { target: { value: "服务器" } });
    expect(field).toHaveValue("ssh-server");
    fireEvent.change(screen.getByLabelText("Host or IP Address"), { target: { value: "a".repeat(120) + ".example" } });
    expect((field as HTMLInputElement).value).toHaveLength(80);
    fireEvent.change(field, { target: { value: "my-server" } });
    fireEvent.change(screen.getByLabelText("Host or IP Address"), { target: { value: "another.example" } });
    expect(field).toHaveValue("my-server");
    expect(api.inspectSshConnection).not.toHaveBeenCalled();
  });

  it("explains an invalid edited connection name without saving or contacting a server", () => {
    show();
    fireEvent.change(screen.getByLabelText("Resource Name"), { target: { value: "production..server" } });
    expect(screen.getByText(/avoid consecutive dots/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(api.inspectSshConnection).not.toHaveBeenCalled();
    expect(api.probeSshConnection).not.toHaveBeenCalled();
  });

  it("keeps optional settings collapsed and preserves a directory when they are reopened", () => {
    show();
    expect(screen.getByLabelText("Default Working Directory")).not.toBeVisible();
    expect(screen.getByRole("combobox", { name: "Connection Type" })).not.toBeVisible();
    fireEvent.click(screen.getByText("Advanced settings"));
    const directory = screen.getByLabelText("Default Working Directory");
    expect(directory).toBeVisible();
    fireEvent.change(directory, { target: { value: "/srv/project" } });
    fireEvent.click(screen.getByText("Advanced settings"));
    fireEvent.click(screen.getByText("Advanced settings"));
    expect(directory).toHaveValue("/srv/project");
    expect(api.inspectSshConnection).not.toHaveBeenCalled();
    expect(api.probeSshConnection).not.toHaveBeenCalled();
  });

  it("requires an explicitly chosen fingerprint and a successful test before a write-only save", async () => {
    const probes: SshProbeRequest[] = []; const saved: SshRegisterRequest[] = [];
    api.probeSshConnection.mockImplementation(async request => { probes.push(structuredClone(request)); return { success: true, error_kind: null, verified: true }; });
    const submit = vi.fn(async (request: SshRegisterRequest) => { saved.push(structuredClone(request)); });
    show({ onSubmit: submit }); fillHost();
    fireEvent.change(screen.getByLabelText("SSH Password"), { target: { value: "fixture-only-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify SSH Host" }));
    const trust = await screen.findByRole("radio", { name: `Trust ${fingerprint}` });
    expect(trust).not.toBeChecked();
    expect(api.inspectSshConnection).toHaveBeenCalledExactlyOnceWith({ expected: target, observation_id: observed.observationId, endpoint });
    expect(screen.getByRole("button", { name: "Test SSH Connection" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(trust); fireEvent.click(screen.getByRole("button", { name: "Test SSH Connection" }));
    await screen.findByText("Connection verified");
    expect(probes).toEqual([{ expected: target, observation_id: observed.observationId, endpoint, authentication: { type: "password", password: "fixture-only-password" }, host_key: hostKey }]);
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(saved).toEqual([{ expected: target, observation_id: observed.observationId, name: "production", default_cwd: null,
      connection: { kind: "direct", endpoint, authentication: { type: "password", password: "fixture-only-password" }, host_key: hostKey } }]);
    expect(screen.getByLabelText("SSH Password")).toHaveValue("");
    expect(document.body.textContent).not.toContain("fixture-only-password");
    expect(JSON.stringify(localStorage)).not.toContain("fixture-only-password");
  });

  it.each(["DOMAIN\\operator", "operator@example.org"])("accepts the canonical Windows SSH username %s", async username => {
    show(); fillHost(username);
    fireEvent.click(screen.getByRole("button", { name: "Verify SSH Host" }));
    await screen.findByRole("radio", { name: `Trust ${fingerprint}` });
    expect(api.inspectSshConnection).toHaveBeenCalledWith(expect.objectContaining({ endpoint: { ...endpoint, user: username } }));
  });

  it.each(["192.0.2.0/24", "example.org,another.example", "-F/tmp/ssh-config"])("rejects a non-host destination %s without network calls", badHost => {
    show(); fillHost(); fireEvent.change(screen.getByLabelText("Host or IP Address"), { target: { value: badHost } });
    fireEvent.click(screen.getByRole("button", { name: "Verify SSH Host" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Check the host");
    expect(api.inspectSshConnection).not.toHaveBeenCalled();
  });

  it("invalidates authentication evidence when credentials change and discards trust when the host changes", async () => {
    show(); fillHost(); fireEvent.change(screen.getByLabelText("SSH Password"), { target: { value: "fixture-password-a" } });
    await trustAndProbe();
    fireEvent.change(screen.getByLabelText("SSH Password"), { target: { value: "fixture-password-b" } });
    expect(screen.queryByText("Connection verified")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: `Trust ${fingerprint}` })).toBeChecked();
    fireEvent.change(screen.getByLabelText("Host or IP Address"), { target: { value: "192.0.2.11" } });
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(api.inspectSshConnection).toHaveBeenCalledTimes(1); expect(api.probeSshConnection).toHaveBeenCalledTimes(1);
  });

  it("does not reuse an expired host verification", async () => {
    api.inspectSshConnection.mockResolvedValue({ success: true, error_kind: null, inspection: { ...inspection(), expires_at: Math.floor(Date.now() / 1000) - 1 } });
    show(); fillHost(); fireEvent.click(screen.getByRole("button", { name: "Verify SSH Host" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("expired");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(api.probeSshConnection).not.toHaveBeenCalled();
  });

  it("uses a private key path and optional passphrase without returning them to the list", async () => {
    const probes: SshProbeRequest[] = [];
    api.probeSshConnection.mockImplementation(async request => { probes.push(structuredClone(request)); return { success: true, error_kind: null, verified: true }; });
    pickFile.mockResolvedValue("/fixture/keys/operator");
    show(); fillHost(); await choose("SSH Authentication", "Private key");
    expect(screen.queryByLabelText("SSH Password")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose SSH Private Key" }));
    await waitFor(() => expect(screen.getByLabelText("SSH Private Key File")).toHaveValue("/fixture/keys/operator"));
    fireEvent.change(screen.getByLabelText("SSH Key Passphrase"), { target: { value: "fixture-only-passphrase" } });
    await trustAndProbe();
    expect(probes[0].authentication).toEqual({ type: "identity_file", path: "/fixture/keys/operator", passphrase: "fixture-only-passphrase" });
    expect(document.body.textContent).not.toContain("fixture-only-passphrase");
  });

  it("keeps existing OpenSSH authentication free of hidden credentials and remote viewers cannot pick a local key", async () => {
    show({ canChooseKey: false }); fillHost();
    await choose("SSH Authentication", "Private key");
    expect(screen.queryByRole("button", { name: "Choose SSH Private Key" })).not.toBeInTheDocument();
    await choose("SSH Authentication", "Existing OpenSSH environment");
    expect(screen.queryByLabelText("SSH Password")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("SSH Key Passphrase")).not.toBeInTheDocument();
    await trustAndProbe();
    expect(api.probeSshConnection).toHaveBeenCalledWith(expect.objectContaining({ authentication: { type: "existing_environment" } }));
  });

  it("preserves the explicit alias path without forwarding credentials entered in direct mode", async () => {
    const saved: SshRegisterRequest[] = []; show({ onSubmit: vi.fn(async (request: SshRegisterRequest) => { saved.push(structuredClone(request)); }) });
    fillHost(); fireEvent.change(screen.getByLabelText("SSH Password"), { target: { value: "fixture-discarded" } });
    await choose("Connection Type", "OpenSSH alias");
    fireEvent.change(screen.getByLabelText("Target"), { target: { value: "existing-host-alias" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].connection).toEqual({ kind: "alias", target: "existing-host-alias" });
    expect(JSON.stringify(saved)).not.toContain("fixture-discarded");
    expect(api.inspectSshConnection).not.toHaveBeenCalled(); expect(api.probeSshConnection).not.toHaveBeenCalled();
  });

  it("shows an upgrade action for older Runners without pretending their scope is missing", () => {
    show({ setupSupported: false });
    expect(screen.getByRole("alert")).toHaveTextContent("Update Server and Runner");
    expect(screen.getByRole("button", { name: "Verify SSH Host" })).toBeDisabled();
    expect(document.body.textContent).not.toContain("permission to use");
  });

  it.each([
    ["ssh_authentication_failed", "SSH authentication failed"],
    ["ssh_host_key_changed", "server identity has changed"],
    ["ssh_client_permission_denied", "operating system permissions"],
  ])("shows %s without replaying a failed authentication attempt", async (error_kind, message) => {
    api.probeSshConnection.mockResolvedValue({ success: false, error_kind, verified: false });
    show(); fillHost(); fireEvent.change(screen.getByLabelText("SSH Password"), { target: { value: "fixture-only-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify SSH Host" }));
    fireEvent.click(await screen.findByRole("radio", { name: `Trust ${fingerprint}` }));
    fireEvent.click(screen.getByRole("button", { name: "Test SSH Connection" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(api.probeSshConnection).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("ignores duplicate inspect clicks and late results after closing the dialog", async () => {
    let resolve!: (value: unknown) => void;
    api.inspectSshConnection.mockReturnValue(new Promise(value => { resolve = value; }));
    const rendered = show(); fillHost();
    fireEvent.click(screen.getByRole("button", { name: "Verify SSH Host" }));
    fireEvent.click(screen.getByRole("button", { name: "Verify SSH Host" }));
    expect(api.inspectSshConnection).toHaveBeenCalledTimes(1);
    rendered.unmount();
    await act(async () => resolve({ success: true, error_kind: null, inspection: inspection() }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(api.probeSshConnection).not.toHaveBeenCalled();
  });

  it("has complete messages for every supported Desktop language", () => {
    for (const [key, messages] of Object.entries(SSH_CONNECTION_MESSAGES)) {
      expect(messages).toHaveLength(PRODUCT_LOCALES.length);
      for (const locale of PRODUCT_LOCALES) expect(sshConnectionText(locale, key as keyof typeof SSH_CONNECTION_MESSAGES).trim()).not.toBe("");
    }
  });
});
