from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else '.')
p=root/'apps/desktop/src/App.test.tsx';s=p.read_text();assert 'RESTORE_DIAGNOSTIC' not in s
s='import { Profiler } from "react";\n'+s
start=s.index('  it.each([false, true])("recreated UI restores state and pending page')
end=s.index('\n  });',start)+len('\n  });')
chunk=s[start:end]
needle='''    renderApp();
    await waitFor(() => expect(api.acknowledgeDesktopNavigation).toHaveBeenCalledWith(8));
    expect(await screen.findByRole("heading", { level: 1, name: "Desktop 设置" })).toBeInTheDocument();
    await waitFor(() => expect(api.shellRestoreOnly).toHaveBeenCalled());
    expect(api.resumeSavedRuntime).not.toHaveBeenCalled();
    expect(api.resumeSavedConnections).not.toHaveBeenCalled();'''
replacement='''    const started = performance.now();
    const cpuStarted = process.cpuUsage();
    const events: Array<{ name: string; elapsedMs: number }> = [];
    const commits: Array<{ phase: string; actualMs: number; baseMs: number; commitMs: number }> = [];
    let styleCalls = 0, styleMs = 0, stage = "start";
    const mark = (name: string) => { events.push({ name, elapsedMs: performance.now() - started }); };
    for (const [name, mock] of Object.entries({
      getState: api.getState, shellRestoreOnly: api.shellRestoreOnly,
      shellBootstrapComplete: api.shellBootstrapComplete,
      readDesktopNavigation: api.readDesktopNavigation,
      acknowledgeDesktopNavigation: api.acknowledgeDesktopNavigation,
      runnerSettings: api.runnerSettings, getLaunchAtLogin: api.getLaunchAtLogin,
      observeChatgptActivity: api.observeChatgptActivity, activity: api.activity,
    })) {
      const implementation = mock.getMockImplementation();
      mock.mockImplementation((...args: unknown[]) => {
        mark(`${name}:called`);
        const value = implementation?.(...args);
        if (value && typeof value.then === "function") {
          void value.then(() => mark(`${name}:resolved`), () => mark(`${name}:rejected`));
        }
        return value;
      });
    }
    const getComputedStyle = window.getComputedStyle.bind(window);
    const styleSpy = vi.spyOn(window, "getComputedStyle").mockImplementation((...args) => {
      const before = performance.now();
      try { return getComputedStyle(...args); }
      finally { styleCalls++; styleMs += performance.now() - before; }
    });
    try {
      stage = "render";
      render(<Profiler id="restored-app" onRender={(_id, phase, actualMs, baseMs, _start, commitTime) => {
        commits.push({ phase, actualMs, baseMs, commitMs: commitTime - started });
      }}><LocaleProvider><App /></LocaleProvider></Profiler>);
      mark("render:return");
      stage = "acknowledgement";
      await waitFor(() => expect(api.acknowledgeDesktopNavigation).toHaveBeenCalledWith(8));
      mark("acknowledgement:asserted");
      stage = "heading";
      expect(await screen.findByRole("heading", { level: 1, name: "Desktop 设置" })).toBeInTheDocument();
      mark("heading:asserted");
      stage = "restore-called";
      await waitFor(() => expect(api.shellRestoreOnly).toHaveBeenCalled());
      mark("restore-called:asserted");
      expect(api.resumeSavedRuntime).not.toHaveBeenCalled();
      expect(api.resumeSavedConnections).not.toHaveBeenCalled();
      stage = "complete";
    } finally {
      styleSpy.mockRestore();
      console.log("RESTORE_DIAGNOSTIC", JSON.stringify({
        runtimeAutostart, stage, wallMs: performance.now() - started,
        cpu: process.cpuUsage(cpuStarted), styleCalls, styleMs, commits, events,
        missingUpdateMocks: ["localUpdateStatus", "checkForUpdates"].filter(name => !(name in api)),
      }));
    }'''
assert chunk.count(needle)==1
s=s[:start]+chunk.replace(needle,replacement)+s[end:]
p.write_text(s)
