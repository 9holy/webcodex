import { useEffect, useRef, useState, type FormEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { desktopApi } from "../../lib/desktop-api";
import type { DesktopState, SettingsTarget } from "../../models/topology";
import type { AcpGlobalSettings, CodexPrepareRequest, PreparedCodexAgent } from "../../models/runner-capabilities";
import { useProduct } from "../../i18n/product";
import { useConnectionsTools } from "../../i18n/connections-tools";
import { useRunnerCapabilitiesText, type RunnerCapabilitiesKey } from "../../i18n/runner-capabilities";
import { WorkspaceDialog } from "../workspace/WorkspaceDialog";

function setupError(value: unknown): RunnerCapabilitiesKey {
  const code = typeof value === "object" && value !== null && "code" in value ? value.code : null;
  if (typeof code !== "string") return "codexSetupFailed";
  if (code === "codex_python_unavailable") return "codexSetupPython";
  if (code === "codex_not_found") return "codexSetupMissing";
  if (["codex_schema_incompatible", "codex_version_mismatch"].includes(code)) return "codexSetupIncompatible";
  if (["coding_agent_state_changed", "runner_settings_changed"].includes(code)) return "codexSetupChanged";
  return "codexSetupFailed";
}

export function CodexSetupDialog({ target, revision, globals, previousId, disabled, onState, onSaved, onClose, onRefresh }: {
  target: SettingsTarget; revision: number; globals: AcpGlobalSettings | null; previousId: string | null; disabled: boolean;
  onState: (state: DesktopState) => void; onSaved: () => void; onClose: () => void; onRefresh: () => void;
}) {
  const p = useProduct(); const c = useConnectionsTools(); const r = useRunnerCapabilitiesText();
  const [python, setPython] = useState(""); const [codex, setCodex] = useState("");
  const [args, setArgs] = useState("[]"); const [version, setVersion] = useState("");
  const [prepared, setPrepared] = useState<PreparedCodexAgent | null>(null);
  const [busy, setBusy] = useState(false); const [saveUncertain, setSaveUncertain] = useState(false);
  const [error, setError] = useState<RunnerCapabilitiesKey | "invalidFields" | null>(null);
  const inFlight = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const choose = async (kind: "python" | "codex") => {
    if (disabled || inFlight.current) return;
    try {
      const selected = await open({ title: r(kind === "python" ? "pythonExecutable" : "codexExecutable"), multiple: false, directory: false });
      if (mounted.current && typeof selected === "string") (kind === "python" ? setPython : setCodex)(selected);
    } catch { if (mounted.current) setError("codexSetupFailed"); }
  };
  const prepare = async (event: FormEvent) => {
    event.preventDefault(); if (inFlight.current || disabled) return;
    let request: CodexPrepareRequest;
    try {
      const argumentsValue: unknown = JSON.parse(args);
      if (!Array.isArray(argumentsValue) || argumentsValue.length > 8 || argumentsValue.some(value => typeof value !== "string" || value.length > 4096 || value.includes("\0")) || argumentsValue.reduce((size, value) => size + value.length + 1, 0) > 16384) throw new Error("invalid");
      if (version.trim() && !/^[A-Za-z0-9.+-]{1,96}$/.test(version.trim())) throw new Error("invalid");
      request = { target, expected_revision: revision, codex_args: argumentsValue, ...(python.trim() ? { python_bin: python.trim() } : {}), ...(codex.trim() ? { codex_bin: codex.trim() } : {}), ...(version.trim() ? { expected_version: version.trim() } : {}) };
    } catch { setError("invalidFields"); return; }
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const value = await desktopApi.prepareCodexCodingAgent(request);
      if (!mounted.current) return;
      if (value.target.client_id !== target.client_id || value.target.config_path !== target.config_path || value.target.server_url !== target.server_url || value.expected_revision !== revision || value.profile.enabled !== false) { setError("codexSetupChanged"); return; }
      setPrepared(value);
    } catch (failure) { if (mounted.current) setError(setupError(failure)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  const save = async () => {
    if (inFlight.current || disabled || saveUncertain || !prepared) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const state = await desktopApi.saveCodingAgent({ target, expected_revision: prepared.expected_revision, previous_id: previousId, profile: { ...prepared.profile, enabled: true }, global_settings: globals });
      if (mounted.current) { onState(state); onSaved(); }
    } catch (failure) { if (mounted.current) {
      const code = typeof failure === "object" && failure !== null && "code" in failure ? failure.code : null;
      setSaveUncertain(true); setError(code === "coding_agent_ownership_conflict" ? "ownershipConflict" : code === "coding_agent_state_changed" ? "codexSetupChanged" : "codexSaveFailed");
    } }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  return <WorkspaceDialog title={r("configureCodex")} onClose={onClose} busy={busy}>
    {prepared ? <div className="profile-editor" aria-busy={busy}>
      <p className="workspace-notice" role="status">{r("codexPrepared")}</p>
      {previousId && <p>{r("codexReplaceSaved")}</p>}
      <details><summary>{p("details")}</summary><p>{r("codexVerifiedVersion")}: <strong>{prepared.codex_version}</strong></p><pre className="codex-prepared-details">{JSON.stringify({ executable: prepared.profile.executable, args: prepared.profile.args, env_from_env: prepared.profile.env_from_env }, null, 2)}</pre></details>
      {error && <p role="alert" className="workspace-notice">{error === "invalidFields" ? c("invalidFields") : r(error)}</p>}
      <div className="connection-actions">{saveUncertain ? <button type="button" className="primary-button" onClick={() => { onClose(); onRefresh(); }}>{p("refresh")}</button> : <button type="button" className="primary-button" aria-label="Save and Enable Codex" disabled={busy || disabled} onClick={() => void save()}>{r("saveEnableCodex")}</button>}<button type="button" className="secondary-button" disabled={busy} onClick={onClose}>{p("cancel")}</button></div>
    </div> : <form className="profile-editor" onSubmit={event => void prepare(event)} aria-busy={busy}>
      <p>{r("codexSetupHelp")}</p><p className="workspace-notice">{r("codexSetupReview")}</p>
      <details><summary>{p("advanced")}</summary>
        <div className="field-group"><label htmlFor="codex-setup-python">{r("pythonExecutable")}</label><input id="codex-setup-python" aria-label="Python Executable" value={python} onChange={event => setPython(event.target.value)} placeholder={r("automaticDetection")} maxLength={1024} disabled={busy || disabled} spellCheck={false} /><button type="button" className="text-button" aria-label="Choose Python Executable" disabled={busy || disabled} onClick={() => void choose("python")}>{p("browse")}</button></div>
        <div className="field-group"><label htmlFor="codex-setup-binary">{r("codexExecutable")}</label><input id="codex-setup-binary" aria-label="Codex Executable" value={codex} onChange={event => setCodex(event.target.value)} placeholder={r("automaticDetection")} maxLength={1024} disabled={busy || disabled} spellCheck={false} /><button type="button" className="text-button" aria-label="Choose Codex Executable" disabled={busy || disabled} onClick={() => void choose("codex")}>{p("browse")}</button></div>
        <div className="field-group"><label htmlFor="codex-setup-args">{r("codexArguments")}</label><textarea id="codex-setup-args" value={args} onChange={event => setArgs(event.target.value)} maxLength={16384} disabled={busy || disabled} rows={2} spellCheck={false} /><small>{r("codexArgumentsHelp")}</small></div><div className="field-group"><label htmlFor="codex-setup-version">{r("codexExpectedVersion")}</label><input id="codex-setup-version" value={version} onChange={event => setVersion(event.target.value)} maxLength={96} disabled={busy || disabled} spellCheck={false} /></div>
      </details>
      {error && <p role="alert" className="workspace-notice">{error === "invalidFields" ? c("invalidFields") : r(error)}</p>}
      <div className="connection-actions"><button type="submit" className="primary-button" aria-label="Prepare Codex Configuration" disabled={busy || disabled}>{r(busy ? "preparingCodex" : "prepareCodex")}</button><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>{p("cancel")}</button></div>
    </form>}
  </WorkspaceDialog>;
}
