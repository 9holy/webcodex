import { useEffect, useRef, useState } from "react";
import { desktopApi } from "../../lib/desktop-api";
import type { RunnerSettings, SettingsTarget } from "../../models/topology";
import type { RunnerCapabilityAuthorizationSnapshot } from "../../models/runner-capabilities";
import { useProduct } from "../../i18n/product";
import { useRunnerCapabilitiesText } from "../../i18n/runner-capabilities";
import { WorkspaceDialog } from "../workspace/WorkspaceDialog";

type Props = {
  settings: RunnerSettings | null;
  capability: "coding_agents" | "ssh_resources" | "permission_approval_granted" | "detached_execution_granted";
  disabled: boolean;
  refreshKey?: number;
  onAuthorized: () => void;
};

export function RunnerCapabilityAuthorization({ settings, ...props }: Props) {
  // Re-pair/connection changes discard a previously opened approval dialog.
  return settings ? <AuthorizationFlow key={props.capability + JSON.stringify(settings.target)} target={settings.target} {...props} /> : null;
}

export function DetachedExecutionAuthorization({ settings, disabled, refreshKey, onAuthorized = () => undefined }: Omit<Props, "capability" | "onAuthorized"> & { onAuthorized?: () => void }) {
  const r = useRunnerCapabilitiesText();
  return <section className="settings-section detached-execution-authorization" aria-label="Long-running Background Processes">
    <h3>{r("detachedExecutionTitle")}</h3>
    <p className="field-help">{r("detachedExecutionHelp")}</p>
    <RunnerCapabilityAuthorization settings={settings} capability="detached_execution_granted" disabled={disabled} refreshKey={refreshKey} onAuthorized={onAuthorized} />
    <p className="field-help">{r("detachedClientBoundary")}</p>
  </section>;
}

function AuthorizationFlow({ target, capability, disabled, refreshKey, onAuthorized }: Omit<Props, "settings"> & { target: SettingsTarget }) {
  const p = useProduct(); const r = useRunnerCapabilitiesText();
  const approvalOnly = capability === "permission_approval_granted";
  const detachedOnly = capability === "detached_execution_granted";
  const separateConsent = approvalOnly || detachedOnly;
  const copy = approvalOnly ? {
    region: "Coding Approval Authorization", action: "Authorize Coding Approvals", confirm: "Confirm Authorize Coding Approvals", refresh: "Refresh Coding Approval Authorization",
    title: "authorizeApprovals", needed: "approvalAuthorizationNeeded", unavailable: "approvalOperatorNeeded", help: "authorizeApprovalsHelp", consent: "approvalConsent",
  } as const : detachedOnly ? {
    region: "Detached Execution Authorization", action: "Authorize Background Processes", confirm: "Confirm Authorize Background Processes", refresh: "Refresh Background Process Authorization",
    title: "authorizeDetached", needed: "detachedAuthorizationNeeded", unavailable: "detachedOperatorNeeded", help: "authorizeDetachedHelp", consent: "detachedConsent",
  } as const : {
    region: "Runner Capability Authorization", action: "Authorize Runner Capabilities", confirm: "Confirm Authorize Runner Capabilities", refresh: "Refresh Runner Authorization",
    title: "authorize", needed: "authorizationNeeded", unavailable: "operatorPairingNeeded", help: "authorizeHelp", consent: "approvalConsent",
  } as const;
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<RunnerCapabilityAuthorizationSnapshot | null>(null);
  const [failed, setFailed] = useState(false); const [unavailable, setUnavailable] = useState(false);
  const [confirming, setConfirming] = useState(false); const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const inFlight = useRef(false); const sequence = useRef(0); const mounted = useRef(true);
  const matches = (value: RunnerCapabilityAuthorizationSnapshot) => value.target.client_id === target.client_id
    && value.target.config_path === target.config_path && value.target.server_url === target.server_url;
  useEffect(() => {
    mounted.current = true; const current = ++sequence.current;
    setStatus(null); setUnavailable(false);
    // Read credential scopes directly. Do not list SSH resources or derive
    // authorization from advertised providers, saved profiles, or a restart.
    void Promise.resolve().then(() => desktopApi.runnerCapabilityAuthorization(target)).then(value => {
      if (!matches(value)) throw new Error("connection_changed");
      if (mounted.current && current === sequence.current) setStatus(value);
    }).catch(() => { if (mounted.current && current === sequence.current) setUnavailable(true); });
    return () => { mounted.current = false; ++sequence.current; };
  }, [target.client_id, target.config_path, target.server_url, revision, refreshKey]);

  const canAuthorize = Boolean(status?.can_authorize && (!approvalOnly || status.permission_approval_grant_available) && (!detachedOnly || status.detached_execution_grant_available));
  const authorize = async () => {
    if (!confirming || !canAuthorize || (separateConsent && !consent) || inFlight.current || disabled) return;
    inFlight.current = true; setBusy(true); setConfirming(false); setFailed(false);
    const current = ++sequence.current;
    try {
      const value = await (approvalOnly ? desktopApi.authorizeRunnerCapabilities(target, "coding_approval") : detachedOnly ? desktopApi.authorizeRunnerCapabilities(target, "detached_execution") : desktopApi.authorizeRunnerCapabilities(target));
      if (!matches(value)) throw new Error("connection_changed");
      if (!mounted.current || current !== sequence.current) return;
      setStatus(value);
      if (value[capability]) onAuthorized();
      else setFailed(true);
    } catch {
      if (!mounted.current || current !== sequence.current) return;
      setFailed(true); setStatus(null);
      // A lost IPC response can follow a committed grant. Observe only; never
      // repeat authorization automatically and never query SSH for this result.
      try {
        const value = await desktopApi.runnerCapabilityAuthorization(target);
        if (mounted.current && current === sequence.current && matches(value)) setStatus(value);
      } catch { /* explicit Refresh remains available */ }
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  if (!failed && status?.[capability] && !detachedOnly) return null;
  return <div className="workspace-notice runner-capability-authorization" aria-label={copy.region}>
    {(unavailable || failed) && <p role="alert">{r(failed ? "authorizeFailed" : "authorizationUnavailable")}</p>}
    {detachedOnly && status?.detached_execution_granted && <p role="status">{r("detachedGranted")}</p>}
    {status && !status[capability] && <>
      <p>{r(canAuthorize ? copy.needed : copy.unavailable)}</p>
      {canAuthorize && <button type="button" className="secondary-button" aria-label={copy.action} disabled={disabled || busy} onClick={() => { setConsent(false); setConfirming(true); }}>{r(copy.title)}</button>}
    </>}
    {(unavailable || failed || status) && <button type="button" className="text-button" aria-label={copy.refresh} disabled={disabled || busy} onClick={() => { setFailed(false); setRevision(value => value + 1); }}>{p("refresh")}</button>}
    {confirming && <WorkspaceDialog title={r(copy.title)} onClose={() => setConfirming(false)} busy={busy}>
      <p>{r(copy.help)}</p>
      {separateConsent && <label className="profile-checkbox"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} />{r(copy.consent)}</label>}
      <div className="connection-actions">
        <button type="button" className="primary-button" aria-label={copy.confirm} disabled={disabled || busy || (separateConsent && !consent)} onClick={() => void authorize()}>{r(copy.title)}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirming(false)}>{p("cancel")}</button>
      </div>
    </WorkspaceDialog>}
  </div>;
}
