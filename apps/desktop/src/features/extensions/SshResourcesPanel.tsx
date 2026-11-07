import { useEffect, useRef, useState } from "react";
import { desktopApi } from "../../lib/desktop-api";
import type { DesktopState, RunnerSettings } from "../../models/topology";
import type { SshMutationResult, SshResource, SshResourceError, SshResourcesSnapshot } from "../../models/runner-capabilities";
import { useProduct } from "../../i18n/product";
import { useConnectionsTools } from "../../i18n/connections-tools";
import { useRunnerCapabilitiesText } from "../../i18n/runner-capabilities";
import { useSshConnectionText } from "../../i18n/ssh-connections";
import { WorkspaceDialog } from "../workspace/WorkspaceDialog";
import { RunnerCapabilityAuthorization } from "./RunnerCapabilityAuthorization";
import { SshConnectionEditor, type ObservedSshTarget } from "./SshConnectionEditor";
import { sshErrorText } from "./ssh-errors";

export function SshResourcesPanel({ state, onState, settings, onRestarted }: {
  state: DesktopState; onState: (state: DesktopState) => void; settings: RunnerSettings | null; onRestarted: () => void;
}) {
  const p = useProduct(); const c = useConnectionsTools(); const r = useRunnerCapabilitiesText(); const s = useSshConnectionText();
  const [inventory, setInventory] = useState<SshResourcesSnapshot | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<SshResourceError | null>(null);
  const [restartRequired, setRestartRequired] = useState(false);
  const [editor, setEditor] = useState<ObservedSshTarget | null>(null);
  const [deleting, setDeleting] = useState<(ObservedSshTarget & { resource: SshResource }) | null>(null);
  const [verifiedResource, setVerifiedResource] = useState<string | null>(null);
  const submitting = useRef(false); const sequence = useRef(0); const mounted = useRef(true);
  const disabled = busy || Boolean(state.current_operation);

  useEffect(() => {
    mounted.current = true;
    const current = ++sequence.current;
    setInventory(null); setError(null); setEditor(null); setDeleting(null); setVerifiedResource(null); setRestartRequired(false);
    void desktopApi.sshResources().then(value => { if (mounted.current && current === sequence.current) setInventory(value); })
      .catch(() => { if (mounted.current && current === sequence.current) setError("ssh_resource_registry_unavailable"); });
    return () => { mounted.current = false; ++sequence.current; };
  }, [settings?.target.client_id, settings?.target.config_path, settings?.target.server_url]);

  const observe = async (action?: "add" | SshResource) => {
    if (submitting.current || state.current_operation) return;
    submitting.current = true; setBusy(true); setError(null); setVerifiedResource(null);
    const current = ++sequence.current;
    try {
      const target = action ? (await desktopApi.runnerSettings()).target : null;
      const value = await desktopApi.sshResources();
      if (!mounted.current || current !== sequence.current) return;
      setInventory(value);
      if (action && target && value.available && value.observation_id && value.runner === target.client_id) {
        const observed = { expected: target, observationId: value.observation_id };
        if (action === "add") setEditor(observed);
        else {
          const resource = value.resources.find(resource => resource.name === action.name);
          if (resource?.source === "managed") setDeleting({ ...observed, resource });
          else setError(resource ? "ssh_resource_static_read_only" : "ssh_resource_not_found");
        }
      }
    } catch { if (mounted.current && current === sequence.current) setError("ssh_resource_registry_unavailable"); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  };
  const mutate = async (operation: () => Promise<SshMutationResult>, verifiedName?: string) => {
    if (submitting.current || state.current_operation) return;
    submitting.current = true; const current = ++sequence.current; setBusy(true); setError(null); setVerifiedResource(null);
    // Targets exist only in this form's transient request, never inventory/history.
    setEditor(null); setDeleting(null);
    try {
      const result = await operation();
      if (!mounted.current || current !== sequence.current) return;
      setInventory(result.inventory); setError(result.error_kind);
      if (result.restart_required) setRestartRequired(true);
      if (result.success && verifiedName) setVerifiedResource(verifiedName);
    } catch {
      // Lost native IPC may follow a committed operation. Read once, never resend.
      if (mounted.current && current === sequence.current) { setError("ssh_resource_outcome_unknown"); setInventory(null); }
      try { const value = await desktopApi.sshResources(); if (mounted.current && current === sequence.current) setInventory(value); } catch { /* explicit Refresh remains available */ }
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  };
  const restart = async () => {
    if (submitting.current || state.current_operation) return;
    submitting.current = true; const attempt = ++sequence.current; setBusy(true); setError(null); setInventory(null); setVerifiedResource(null);
    try {
      const current = await desktopApi.runnerSettings();
      if (!settings || !current.can_restart || current.target.client_id !== settings.target.client_id || current.target.server_url !== settings.target.server_url || current.target.config_path !== settings.target.config_path) throw new Error("runner_changed");
      const next = await desktopApi.restartOwnedRunner(current.target);
      if (!mounted.current || attempt !== sequence.current) return;
      onState(next); onRestarted();
      const value = await desktopApi.sshResources();
      if (mounted.current && attempt === sequence.current) { setInventory(value); setRestartRequired(false); }
    } catch { if (mounted.current && attempt === sequence.current) setError("ssh_resource_registry_unavailable"); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  };
  const needsRestart = restartRequired || Boolean(inventory?.resources.some(resource => resource.pending_restart));
  const visibleError = error ?? inventory?.error_kind;
  return <div role="presentation" aria-busy={busy}>
    <div className="extension-toolbar"><button type="button" className="primary-button" aria-label="Add SSH Resource" disabled={disabled || !settings || !inventory?.available} onClick={() => void observe("add")}>{r("addSshResource")}</button><button type="button" className="secondary-button" aria-label="Refresh SSH Resources" disabled={disabled} onClick={() => void observe()}>{p("refresh")}</button></div>
    <p className="workspace-notice">{r("sshPrivacy")}</p>
    {visibleError && <p role="alert" className="workspace-notice">{sshErrorText(visibleError, r, s)}</p>}
    <RunnerCapabilityAuthorization settings={settings} capability="ssh_resources" disabled={disabled} onAuthorized={() => void observe()} />
    {!inventory && !visibleError && <p role="status">{p("loading")}</p>}
    {needsRestart && <div className="extension-apply-bar" role="status"><span>{r("restartRequired")}</span><button type="button" className="secondary-button" aria-label="Restart Runner" disabled={disabled || !settings?.can_restart} onClick={() => void restart()}>{p("restartRunner")}</button></div>}
    {inventory?.available && inventory.resources.map(resource => <article className="extension-row" key={resource.name} aria-labelledby={`ssh-resource-${resource.name}`} data-ssh-resource-name={resource.name}>
      <div><h3 id={`ssh-resource-${resource.name}`}>{resource.name}</h3><p>{r(resource.source)} · {resource.active ? s("loaded") : c("configured")}{resource.pending_restart ? ` · ${r("restartRequired")}` : ""}{resource.source === "static" ? ` · ${r("readOnly")}` : ""}</p><p>{s(verifiedResource === resource.name ? "verified" : "notVerified")}</p></div>
      {resource.source === "managed" && <button type="button" className="text-button" aria-label={`Remove ${resource.name}`} disabled={disabled || !inventory.observation_id} onClick={() => void observe(resource)}>{c("remove")}</button>}
    </article>)}
    {inventory?.available && !inventory.resources.length && <p className="workspace-empty">{r("noResources")}</p>}
    {inventory?.available && inventory.resources.length > 0 && <p className="workspace-notice">{s("loadedHelp")} {s("chatHelp")} {s("remoteServicesHelp")}</p>}
    {editor && <SshConnectionEditor key={editor.observationId} observed={editor} busy={disabled} setupSupported={inventory?.setup_supported === true} canChooseKey={Boolean(settings?.can_restart)} onClose={() => setEditor(null)} onSubmit={request => mutate(() => desktopApi.registerSshResource(request), request.connection.kind === "direct" ? request.name : undefined)} />}
    {deleting && <WorkspaceDialog title={`${c("remove")} ${deleting.resource.name}`} onClose={() => setDeleting(null)} busy={busy}><p>{r("removeResourceHelp")}</p><div className="connection-actions"><button type="button" className="danger-button" aria-label={`Confirm Remove ${deleting.resource.name}`} disabled={disabled} onClick={() => void mutate(() => desktopApi.removeSshResource(deleting.expected, deleting.observationId, deleting.resource.name))}>{c("remove")}</button><button type="button" className="secondary-button" disabled={disabled} onClick={() => setDeleting(null)}>{p("cancel")}</button></div></WorkspaceDialog>}
  </div>;
}
