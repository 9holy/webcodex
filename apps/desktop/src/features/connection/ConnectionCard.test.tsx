import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CONNECTIONS_TOOLS_MESSAGES, connectionsToolsText } from "../../i18n/connections-tools";
import { LocaleProvider } from "../../i18n/locale";
import { PRODUCT_LOCALES } from "../../i18n/product";
import { connectionFixture } from "../../test/connections-fixtures";
import { ConnectionCard } from "./ConnectionCard";

const path = "C:\\Users\\example\\AppData\\Local\\webcodex\\runtime\\regular-tunnel-runtime";

beforeEach(() => {
  localStorage.removeItem("webcodex.desktop.locale");
});

describe("Connection advanced details", () => {
  it.each(PRODUCT_LOCALES)("keeps the two-column metadata and translated labels in %s", (locale) => {
    localStorage.setItem("webcodex.desktop.locale", locale);
    const profile = connectionFixture({
      runtime_directory: path,
      startup_timings_ms: { cli_total: 5540, initial_poll: 5510, poll_attempts: 1, poll_request_ms: 5502 },
      tunnel_ready: null,
      local_mcp_ready: null,
      process_ready: true,
      process_started: true,
      command_diagnostics: { rejected_commands: 2, terminal_response_delivery_failures: 1 },
      lifecycle: "error", last_error: "tunnel_unavailable", ready: false,
      reason_code: "tunnel_restart_uncertain", failure_stage: "tunnel_recovery",
    });
    const { container } = render(
      <LocaleProvider>
        <ConnectionCard
          profile={profile}
          canStart={true}
          busy={false}
          copied={false}
          onAction={() => undefined}
          onEdit={() => undefined}
          onDelete={() => undefined}
          onCopy={() => undefined}
          onSettings={() => undefined}
        />
      </LocaleProvider>,
    );
    const details = container.querySelector("dl.connection-meta-grid");
    expect(details).not.toBeNull();
    const children = Array.from(details!.children);
    expect(children.length % 2).toBe(0);
    for (let index = 0; index < children.length; index += 2) {
      expect(children[index].tagName).toBe("DT");
      expect(children[index + 1].tagName).toBe("DD");
    }
    const pairs = new Map(Array.from(details!.querySelectorAll("dt"), (dt) => [
      dt.textContent,
      dt.nextElementSibling?.textContent,
    ]));
    for (const key of [
      "profileId", "pid", "processStarted", "processReady", "cliStartup",
      "firstControlPlanePoll", "initialPollRequests", "pollHttpTime",
      "pollRetryWait", "otherStartupWork", "tunnelReady",
      "localMcpReady", "mcpAddress", "runtimeDirectory",
      "rejectedCommands", "terminalDeliveryFailures",
    ] as const) {
      expect(pairs.has(connectionsToolsText(locale, key))).toBe(true);
    }
    expect(pairs.get(connectionsToolsText(locale, "processReady"))).toBe(connectionsToolsText(locale, "yes"));
    expect(pairs.get(connectionsToolsText(locale, "localMcpReady"))).toBe("—");
    expect(pairs.get(connectionsToolsText(locale, "pollRetryWait"))).toBe("8 ms");
    expect(pairs.get(connectionsToolsText(locale, "runtimeDirectory"))).toBe(path);
    expect(pairs.get(connectionsToolsText(locale, "rejectedCommands"))).toBe("2");
    expect(pairs.get(connectionsToolsText(locale, "terminalDeliveryFailures"))).toBe("1");
    expect(container.textContent).toContain(connectionsToolsText(locale, "restartUncertainRecovery"));
    expect(details?.querySelectorAll("dd.connection-meta-path code")).toHaveLength(2);
    expect(details?.querySelector("dd.connection-meta-path code:last-child")).toBeTruthy();
  });

  it("shows polling separately from local access and waits for automatic recovery while the process is running", () => {
    localStorage.setItem("webcodex.desktop.locale", "zh-CN");
    const ready = connectionFixture({ lifecycle: "running", ready: true, tunnel_ready: true, local_mcp_ready: true });
    const card = (profile: typeof ready) => <LocaleProvider>
      <ConnectionCard profile={profile} canStart={true} busy={false} copied={false}
        onAction={() => undefined} onEdit={() => undefined} onDelete={() => undefined}
        onCopy={() => undefined} onSettings={() => undefined} />
    </LocaleProvider>;
    const { container, rerender } = render(card(ready));
    const checks = () => Array.from(container.querySelectorAll("dl.connection-checks dd"), (check) => check.textContent);
    expect(checks()).toEqual(["轮询正常", "可访问"]);

    rerender(card({ ...ready, ready: false, tunnel_ready: false, last_error: "tunnel_unavailable", reason_code: "tunnel_unavailable" }));
    expect(checks()).toEqual(["等待轮询自动恢复", "可访问"]);
    expect(container.querySelector(".connection-recovery")).toBeNull();

    rerender(card(ready));
    expect(checks()).toEqual(["轮询正常", "可访问"]);
  });

  it("omits unavailable optional diagnostics without creating empty labels", () => {
    const profile = connectionFixture({ startup_timings_ms: null, local_mcp_ready: null, runtime_directory: null });
    const { container } = render(
      <LocaleProvider>
        <ConnectionCard profile={profile} canStart={true} busy={false} copied={false}
          onAction={() => undefined} onEdit={() => undefined} onDelete={() => undefined}
          onCopy={() => undefined} onSettings={() => undefined} />
      </LocaleProvider>,
    );
    const details = container.querySelector("dl.connection-meta-grid")!;
    const labels = Array.from(details.querySelectorAll("dt"), (dt) => dt.textContent);
    expect(labels).not.toContain(CONNECTIONS_TOOLS_MESSAGES.initialPollRequests[1]);
    expect(labels).not.toContain(CONNECTIONS_TOOLS_MESSAGES.runtimeDirectory[1]);
    expect(labels).not.toContain(CONNECTIONS_TOOLS_MESSAGES.rejectedCommands[1]);
    expect(labels).not.toContain(CONNECTIONS_TOOLS_MESSAGES.terminalDeliveryFailures[1]);
    expect(Array.from(details.querySelectorAll("dt")).find(dt => dt.textContent === CONNECTIONS_TOOLS_MESSAGES.localMcpReady[1])?.nextElementSibling?.textContent).toBe("—");
  });
});
