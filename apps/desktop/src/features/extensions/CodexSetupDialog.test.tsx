import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopMantineProvider } from "../../components/DesktopMantineProvider";
import { LocaleProvider } from "../../i18n/locale";
import { CodexSetupDialog } from "./CodexSetupDialog";

const api = vi.hoisted(() => ({ prepareCodexCodingAgent: vi.fn(), saveCodingAgent: vi.fn() }));
vi.mock("../../lib/desktop-api", () => ({ desktopApi: api }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
const target = { config_path: "/fixture/runner.toml", client_id: "fixture", server_url: "http://127.0.0.1:62645" };

beforeEach(() => vi.resetAllMocks());

function draw(locale: string) {
  localStorage.setItem("webcodex.desktop.locale", locale);
  render(<LocaleProvider><DesktopMantineProvider env="test">
    <CodexSetupDialog target={target} revision={7} globals={null} previousId={null} disabled={false}
      onState={vi.fn()} onSaved={vi.fn()} onClose={vi.fn()} onRefresh={vi.fn()} />
  </DesktopMantineProvider></LocaleProvider>);
}

const cases = [
  ["codex_not_found", "Codex CLI was not found.", "未找到 Codex CLI。"],
  ["codex_requires_native_executable", "Codex was found, but this launcher is unsupported.", "已找到 Codex 启动器，但不支持此启动方式。"],
  ["codex_npm_layout_invalid", "The selected npm Codex installation is incomplete or unsupported.", "所选 npm Codex 安装不完整或布局不受支持。"],
  ["codex_node_not_found", "npm Codex was found, but native node.exe is unavailable.", "已找到 npm Codex，但未找到原生 node.exe。"],
  ["codex_launcher_arguments_invalid", "Use at most eight fixed launcher arguments, including the npm Codex script.", "固定启动参数最多八项，npm Codex 脚本路径占一项。"],
  ["unknown-private-code", "Codex preparation could not be verified.", "无法确认 Codex 准备结果。"],
] as const;

describe.each(["en-US", "zh-CN"])("Codex discovery diagnostics in %s", locale => {
  it.each(cases)("shows the fixed %s guidance without retry or provider mutation", async (code, english, chinese) => {
    api.prepareCodexCodingAgent.mockRejectedValue({ code, message: "private-diagnostic-sentinel", recovery: "private-path-sentinel" });
    draw(locale);
    fireEvent.click(screen.getByRole("button", { name: "Prepare Codex Configuration" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(locale === "en-US" ? english : chinese);
    expect(alert).not.toHaveTextContent(/private-diagnostic-sentinel|private-path-sentinel|unknown-private-code/);
    expect(api.prepareCodexCodingAgent).toHaveBeenCalledExactlyOnceWith({
      target, expected_revision: 7, codex_args: [], allow_network: false,
    });
    expect(api.saveCodingAgent).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Save and Enable Codex" })).not.toBeInTheDocument();
  });
});
