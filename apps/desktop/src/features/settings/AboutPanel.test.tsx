import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../i18n/locale";
import type { DesktopState } from "../../models/topology";
import type { MachineBuildInfo, RuntimeSettings } from "../../models/runtime-shell";
import type { RuntimeUpdates } from "../../hooks/useRuntimeUpdates";
import { AboutPanel } from "./AboutPanel";

const api = vi.hoisted(() => ({ desktopBuildInfo: vi.fn(), runtimeSettings: vi.fn(), getState: vi.fn(), recheckRuntime: vi.fn(), openDiagnosticResource: vi.fn() }));
vi.mock("../../lib/desktop-api", () => ({ desktopApi: api }));
const state = { persistent_environment: "alpha", topology: { server: { kind: "local" } }, binaries: { directory: "/runtime", version: "0.5.0", git_commit: "current", source: "bundled" }, current_operation: null } as DesktopState;
const refreshing = { ...state, current_operation: { id: "refresh", kind: "runtime_refresh", phase: "running", started_at_ms: 1, cancellable: false } } as DesktopState;
const busy = { code: "desktop_operation_busy", message: "private native detail", next_action: "Wait" };
const build: MachineBuildInfo = { schema_version: 1, binary: "webcodex-desktop", version: "desktop-current", git_commit: "revision-current", git_dirty: false, built_at: null, target: "aarch64-apple-darwin", architecture: "aarch64", desktop_runtime_contract: { min_generation: 1, max_generation: 1 } };
function runtime(version = "runtime-current"): RuntimeSettings { return { source: { kind: "bundled" }, selection_revision: 1, desktop_contract: build.desktop_runtime_contract, selected: { candidate_id: "", source: { kind: "bundled" }, selection_revision: 1, checked_at_ms: 1, directory: "/runtime", compatibility: "compatible", build_alignment: "exact", advisories: [], error_code: null, fingerprint: "fence", binaries: [{ name: "webcodex-server", present: true, startup_check: "passed", metadata: { ...build, binary: "webcodex-server", version }, sha256: "hash", error_code: null, diagnostics: null }] }, candidate: null, previous_source: null, last_switch: null, unavailable_code: null, active_jobs: 0, can_switch: true, switch_unavailable_reason: null }; }
function view(value = state, updates?: RuntimeUpdates) { return <LocaleProvider><AboutPanel state={value} updates={updates} /></LocaleProvider>; }
function updates(repository: string): RuntimeUpdates {
  return {
    status: {
      release_repository: repository, state: "not_checked", latest: null, update_available: false,
      show_banner: false, cached: false, last_check_at_ms: null, manual_error: null, automatic_download: true,
      download: { phase: "available", version: null, platform: null, downloaded_bytes: 0, total_bytes: null,
        error_kind: null, installation: "source_build", can_install: false, pending_install: false,
        legacy_release: false, cancelled: false },
    },
    local: null, localError: false, checking: false, manualError: false, actionBusy: false, actionError: false,
    refreshLocal: vi.fn().mockResolvedValue(undefined), check: vi.fn().mockResolvedValue(undefined),
    download: vi.fn().mockResolvedValue(undefined), cancelDownload: vi.fn().mockResolvedValue(undefined),
    setAutomaticDownload: vi.fn().mockResolvedValue(undefined), install: vi.fn().mockResolvedValue(undefined),
    remindLater: vi.fn().mockResolvedValue(undefined),
  };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fact(label: string) { return screen.getByText(label, { selector: "dt" }).parentElement!; }
beforeEach(() => {
  vi.resetAllMocks(); localStorage.setItem("webcodex.desktop.locale", "en-US");
  api.desktopBuildInfo.mockResolvedValue(build); api.runtimeSettings.mockResolvedValue(runtime());
  api.getState.mockResolvedValue(state); api.recheckRuntime.mockResolvedValue(runtime("rechecked"));
  api.openDiagnosticResource.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("About observation lifetimes", () => {
  it("displays the native release publisher, including an explicitly customized build", async () => {
    const rendered = render(view(state, updates("9holy/webcodex")));
    await screen.findByText("desktop-current");
    expect(fact("Release source")).toHaveTextContent("9holy/webcodex");
    rendered.rerender(view(state, updates("operator/custom-webcodex")));
    expect(fact("Release source")).toHaveTextContent("operator/custom-webcodex");
    expect(fact("Release source")).not.toHaveTextContent("9holy/webcodex");
    expect(screen.getByText("Based on yyjeqhc/webcodex. Thanks to the upstream author and contributors.")).toBeInTheDocument();
  });

  it("opens publisher resources and upstream attribution through fixed native resource kinds", async () => {
    render(view());
    await screen.findByText("desktop-current");
    for (const [label, kind] of [
      ["Documentation", "documentation"], ["GitHub", "github"], ["Report issue", "report_issue"],
      ["Build from source", "desktop_development"], ["Contribute", "contributing"],
      ["Release notes", "release_notes"], ["Releases", "releases"], ["Upstream project", "upstream_project"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(api.openDiagnosticResource).toHaveBeenLastCalledWith(kind);
    }
    expect(api.openDiagnosticResource).toHaveBeenCalledTimes(8);
  });

  it("recovers both build and Runtime observations after background refresh contention", async () => {
    vi.useFakeTimers(); api.getState.mockResolvedValue(refreshing);
    api.desktopBuildInfo.mockRejectedValueOnce(busy).mockResolvedValueOnce(build);
    api.runtimeSettings.mockRejectedValueOnce(busy).mockResolvedValueOnce(runtime());
    render(view()); await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(fact("Desktop version")).toHaveTextContent("desktop-current");
    expect(fact("Local Runtime file versions")).toHaveTextContent("runtime-current");
    expect(screen.getByRole("button", { name: "Recheck Runtime" })).toBeEnabled();
    expect(api.desktopBuildInfo).toHaveBeenCalledTimes(2); expect(api.runtimeSettings).toHaveBeenCalledTimes(2);
    expect(api.recheckRuntime).not.toHaveBeenCalled();
  });

  it("clears old metadata immediately when the environment changes", async () => {
    const rendered = render(view()); await screen.findByText("desktop-current");
    const desktop = deferred<MachineBuildInfo>(); const local = deferred<RuntimeSettings>();
    api.desktopBuildInfo.mockReturnValueOnce(desktop.promise); api.runtimeSettings.mockReturnValueOnce(local.promise);
    rendered.rerender(view({ ...state, persistent_environment: "beta" }));
    expect(fact("Desktop version")).not.toHaveTextContent("desktop-current");
    expect(fact("Local Runtime file versions")).not.toHaveTextContent("runtime-current");
    await act(async () => { desktop.resolve({ ...build, version: "desktop-beta" }); local.resolve(runtime("runtime-beta")); });
    expect(fact("Desktop version")).toHaveTextContent("desktop-beta");
    expect(fact("Local Runtime file versions")).toHaveTextContent("runtime-beta");
  });

  it("cannot publish an old recheck after the environment changes", async () => {
    const old = deferred<RuntimeSettings>(); api.recheckRuntime.mockReturnValueOnce(old.promise);
    const rendered = render(view());
    await waitFor(() => expect(screen.getByRole("button", { name: "Recheck Runtime" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Recheck Runtime" }));
    api.runtimeSettings.mockResolvedValue(runtime("runtime-beta"));
    rendered.rerender(view({ ...state, persistent_environment: "beta" }));
    await screen.findByText("webcodex-server runtime-beta");
    await act(async () => old.resolve(runtime("stale-recheck")));
    expect(fact("Local Runtime file versions")).toHaveTextContent("runtime-beta");
    expect(screen.queryByText(/stale-recheck/)).not.toBeInTheDocument();
  });

  it("makes exhausted reads unconfirmed without retaining old metadata or error bodies", async () => {
    vi.useFakeTimers(); api.getState.mockResolvedValue(refreshing);
    api.desktopBuildInfo.mockRejectedValue(busy); api.runtimeSettings.mockRejectedValue(busy);
    render(view()); await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
    expect(fact("Desktop version")).toHaveTextContent("Unconfirmed");
    expect(fact("Local Runtime file versions")).toHaveTextContent("Unconfirmed");
    expect(screen.getByRole("alert")).toHaveTextContent("Local Runtime could not be verified.");
    expect(screen.getByRole("button", { name: "Recheck Runtime" })).toBeEnabled();
    expect(api.desktopBuildInfo).toHaveBeenCalledTimes(6); expect(api.runtimeSettings).toHaveBeenCalledTimes(6);
    expect(screen.queryByText("private native detail")).not.toBeInTheDocument();
  });

  it("cancels both retry timers after unmount", async () => {
    vi.useFakeTimers(); api.getState.mockResolvedValue(refreshing);
    api.desktopBuildInfo.mockRejectedValue(busy); api.runtimeSettings.mockRejectedValue(busy);
    const rendered = render(view()); await act(async () => {});
    rendered.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
    expect(api.desktopBuildInfo).toHaveBeenCalledOnce(); expect(api.runtimeSettings).toHaveBeenCalledOnce();
  });

  it("never retries an explicit native Runtime recheck", async () => {
    api.recheckRuntime.mockRejectedValue(busy);
    render(view());
    await waitFor(() => expect(screen.getByRole("button", { name: "Recheck Runtime" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Recheck Runtime" }));
    await screen.findByRole("alert");
    expect(api.recheckRuntime).toHaveBeenCalledOnce(); expect(api.getState).not.toHaveBeenCalled();
  });
});
