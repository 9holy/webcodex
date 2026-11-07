import { NumberInput, PasswordInput, Radio, Select, TextInput } from "@mantine/core";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { desktopApi } from "../../lib/desktop-api";
import type { SettingsTarget } from "../../models/topology";
import type { SshAuthentication, SshEndpoint, SshHostKeyInspection, SshRegisterRequest, SshResourceError } from "../../models/runner-capabilities";
import { useProduct } from "../../i18n/product";
import { useRunnerCapabilitiesText } from "../../i18n/runner-capabilities";
import { useSshConnectionText } from "../../i18n/ssh-connections";
import { WorkspaceDialog } from "../workspace/WorkspaceDialog";
import { sshErrorText } from "./ssh-errors";

export type ObservedSshTarget = { expected: SettingsTarget; observationId: string };

// Only transient form/request state owns these values. Never persist a draft or
// merge a request into a public inventory, diagnostic state, or DesktopState.
function clearAuthentication(authentication: SshAuthentication) {
  if (authentication.type === "password") authentication.password = "";
  if (authentication.type === "identity_file") authentication.passphrase = undefined;
}
const bytes = (value: string) => new TextEncoder().encode(value).length;
const hasControl = (value: string) => /[\u0000-\u001f\u007f]/.test(value);

export function SshConnectionEditor({ observed, busy, setupSupported, canChooseKey, onClose, onSubmit }: {
  observed: ObservedSshTarget; busy: boolean; setupSupported: boolean; canChooseKey: boolean; onClose: () => void;
  onSubmit: (request: SshRegisterRequest) => Promise<void>;
}) {
  const p = useProduct(); const r = useRunnerCapabilitiesText(); const s = useSshConnectionText();
  const [name, setName] = useState(""); const [mode, setMode] = useState<"direct" | "alias">("direct");
  const [host, setHost] = useState(""); const [port, setPort] = useState<string | number>(22); const [user, setUser] = useState("");
  const [authType, setAuthType] = useState<SshAuthentication["type"]>("password");
  const [password, setPassword] = useState(""); const [keyPath, setKeyPath] = useState(""); const [passphrase, setPassphrase] = useState("");
  const [target, setTarget] = useState(""); const [cwd, setCwd] = useState("");
  const [inspection, setInspection] = useState<SshHostKeyInspection | null>(null);
  const [fingerprint, setFingerprint] = useState(""); const [verified, setVerified] = useState(false); const [expired, setExpired] = useState(false);
  const [working, setWorking] = useState(false); const [error, setError] = useState<SshResourceError | null>(null);
  const inFlight = useRef(false); const mounted = useRef(true);
  const disabled = busy || working;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!inspection) return;
    const remaining = inspection.expires_at * 1000 - Date.now();
    if (remaining <= 0) { setExpired(true); setVerified(false); return; }
    const timer = window.setTimeout(() => { setExpired(true); setVerified(false); }, Math.min(remaining, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [inspection]);
  const invalidateHost = () => { setInspection(null); setFingerprint(""); setVerified(false); setExpired(false); setError(null); };
  const invalidateAuth = () => { setVerified(false); setError(null); };
  const endpoint = (): SshEndpoint | null => {
    const hostname = host.trim(); const username = user.trim(); const number = Number(port);
    if (!hostname || bytes(hostname) > 253 || /[\s,/@\\]/.test(hostname) || hostname.startsWith("-") || hasControl(hostname)
      || !username || bytes(username) > 128 || !/^[A-Za-z0-9_.@\\-]+$/.test(username) || username.startsWith("-")
      || !Number.isInteger(number) || number < 1 || number > 65535) return null;
    return { host: hostname, port: number, user: username };
  };
  const authentication = (): SshAuthentication | null => {
    if (authType === "existing_environment") return { type: "existing_environment" };
    if (authType === "password") return password && bytes(password) <= 4096 && !/[\0\r\n]/.test(password) ? { type: "password", password } : null;
    const path = keyPath.trim();
    return /^(\/|[A-Za-z]:[\\/])/.test(path) && bytes(path) <= 4096 && !hasControl(path) && bytes(passphrase) <= 4096 && !/[\0\r\n]/.test(passphrase)
      ? { type: "identity_file", path, ...(passphrase ? { passphrase } : {}) } : null;
  };
  const requestBase = () => ({ expected: observed.expected, observation_id: observed.observationId });
  const inspect = async () => {
    if (disabled || inFlight.current || !setupSupported) return;
    const destination = endpoint();
    if (!destination) { setError("ssh_resource_invalid"); return; }
    inFlight.current = true; setWorking(true); invalidateHost();
    try {
      const result = await desktopApi.inspectSshConnection({ ...requestBase(), endpoint: destination });
      if (!mounted.current) return;
      if (!result.success || !result.inspection) { setError(result.error_kind ?? "ssh_connection_failed"); return; }
      setInspection(result.inspection); // No fingerprint is selected implicitly.
    } catch { if (mounted.current) setError("ssh_connection_failed"); }
    finally { inFlight.current = false; if (mounted.current) setWorking(false); }
  };
  const probe = async () => {
    if (disabled || inFlight.current || !setupSupported) return;
    const destination = endpoint(); const credentials = authentication();
    if (!destination || !credentials) { setError("ssh_resource_invalid"); return; }
    if (!inspection || expired || inspection.expires_at * 1000 <= Date.now() || !fingerprint) { clearAuthentication(credentials); setError("ssh_host_key_stale"); return; }
    inFlight.current = true; setWorking(true); setError(null); setVerified(false);
    try {
      const result = await desktopApi.probeSshConnection({ ...requestBase(), endpoint: destination, authentication: credentials, host_key: { challenge_id: inspection.challenge_id, fingerprint } });
      if (!mounted.current) return;
      if (result.success && result.verified) setVerified(true);
      else {
        setError(result.error_kind ?? "ssh_connection_failed");
        if (result.error_kind === "ssh_host_key_stale" || result.error_kind === "ssh_host_key_changed") {
          setInspection(null); setFingerprint("");
        }
      }
    } catch { if (mounted.current) setError("ssh_connection_failed"); }
    finally { clearAuthentication(credentials); inFlight.current = false; if (mounted.current) setWorking(false); }
  };
  const chooseKey = async () => {
    if (disabled || inFlight.current || !canChooseKey) return;
    inFlight.current = true; setWorking(true);
    try {
      const selected = await open({ title: s("chooseKey"), multiple: false, directory: false });
      if (mounted.current && typeof selected === "string") { setKeyPath(selected); invalidateAuth(); }
    } catch { if (mounted.current) setError("ssh_resource_invalid"); }
    finally { inFlight.current = false; if (mounted.current) setWorking(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (disabled || inFlight.current) return;
    const resourceName = name.trim(); const defaultCwd = cwd.trim();
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,79}$/.test(resourceName) || resourceName.includes("..") || bytes(defaultCwd) > 4096 || hasControl(defaultCwd)) { setError("ssh_resource_invalid"); return; }
    let connection: SshRegisterRequest["connection"];
    if (mode === "alias") {
      const alias = target.trim();
      if (!alias || bytes(alias) > 512 || alias.startsWith("-") || hasControl(alias)) { setError("ssh_resource_invalid"); return; }
      connection = { kind: "alias", target: alias };
    } else {
      const destination = endpoint(); const credentials = authentication();
      if (!destination || !credentials) { setError("ssh_resource_invalid"); return; }
      if (!setupSupported || !verified || !inspection || expired || inspection.expires_at * 1000 <= Date.now() || !fingerprint) { clearAuthentication(credentials); setError("ssh_host_key_stale"); return; }
      connection = { kind: "direct", endpoint: destination, authentication: credentials, host_key: { challenge_id: inspection.challenge_id, fingerprint } };
    }
    inFlight.current = true; setWorking(true); setPassword(""); setPassphrase(""); setError(null); setVerified(false);
    try { await onSubmit({ ...requestBase(), name: resourceName, connection, default_cwd: defaultCwd || null }); }
    finally {
      if (connection.kind === "direct") clearAuthentication(connection.authentication);
      inFlight.current = false; if (mounted.current) setWorking(false);
    }
  };
  return <WorkspaceDialog title={r("addSshResource")} onClose={onClose} busy={disabled}>
    <form className="profile-editor" onSubmit={event => void submit(event)} aria-busy={disabled} autoComplete="off">
      <TextInput id="ssh-resource-name" label={r("resourceName")} aria-label="Resource Name" value={name} onChange={event => setName(event.currentTarget.value)} required maxLength={80} disabled={disabled} autoFocus spellCheck={false} />
      <Select label={s("connectionType")} aria-label="Connection Type" value={mode} allowDeselect={false} disabled={disabled} data={[{ value: "direct", label: s("direct") }, { value: "alias", label: s("alias") }]}
        onChange={value => { if (value === "direct" || value === "alias") { setMode(value); invalidateHost(); setPassword(""); setPassphrase(""); } }} />
      {mode === "alias" ? <TextInput id="ssh-resource-target" label={r("target")} aria-label="Target" value={target} onChange={event => setTarget(event.currentTarget.value)} required maxLength={512} disabled={disabled} spellCheck={false} description={r("targetHelp")} /> : <>
        {!setupSupported && <p role="alert" className="workspace-notice">{s("operatorUnavailable")}</p>}
        <div className="ssh-endpoint-fields">
          <TextInput label={s("host")} aria-label="Host or IP Address" value={host} onChange={event => { setHost(event.currentTarget.value); invalidateHost(); }} required maxLength={253} disabled={disabled} spellCheck={false} />
          <NumberInput size="md" classNames={{ input: "ui-mantine-input", label: "ui-mantine-label" }} label={s("port")} aria-label="SSH Port" value={port} onChange={value => { setPort(value); invalidateHost(); }} required min={1} max={65535} allowDecimal={false} allowNegative={false} disabled={disabled} />
        </div>
        <TextInput label={s("username")} aria-label="SSH Username" value={user} onChange={event => { setUser(event.currentTarget.value); invalidateHost(); }} required maxLength={128} disabled={disabled} autoComplete="off" spellCheck={false} />
        <Select label={s("authentication")} aria-label="SSH Authentication" value={authType} allowDeselect={false} disabled={disabled}
          data={[{ value: "password", label: s("passwordAuth") }, { value: "identity_file", label: s("keyAuth") }, { value: "existing_environment", label: s("existingAuth") }]}
          onChange={value => { if (value === "password" || value === "identity_file" || value === "existing_environment") { setAuthType(value); setPassword(""); setPassphrase(""); invalidateAuth(); } }} />
        {authType === "password" && <PasswordInput label={s("password")} aria-label="SSH Password" value={password} onChange={event => { setPassword(event.currentTarget.value); invalidateAuth(); }} required maxLength={4096} autoComplete="new-password" disabled={disabled} />}
        {authType === "identity_file" && <>
          <TextInput label={s("identityFile")} aria-label="SSH Private Key File" value={keyPath} onChange={event => { setKeyPath(event.currentTarget.value); invalidateAuth(); }} required maxLength={4096} disabled={disabled} spellCheck={false} />
          {canChooseKey && <button type="button" className="secondary-button" aria-label="Choose SSH Private Key" onClick={() => void chooseKey()} disabled={disabled}>{s("chooseKey")}</button>}
          <PasswordInput label={s("passphrase")} aria-label="SSH Key Passphrase" value={passphrase} onChange={event => { setPassphrase(event.currentTarget.value); invalidateAuth(); }} maxLength={4096} autoComplete="new-password" disabled={disabled} />
        </>}
        <small>{s(authType === "existing_environment" ? "existingHelp" : "secretHelp")}</small>
        <div className="ssh-host-verification">
          <button type="button" className="secondary-button" aria-label="Verify SSH Host" disabled={disabled || !setupSupported} onClick={() => void inspect()}>{s("verifyHost")}</button>
          {inspection && !expired && <fieldset className="ssh-host-keys"><legend>{s("fingerprint")}</legend>
            <p>{s("hostKeyHelp")}</p>
            <Radio.Group value={fingerprint} onChange={value => { setFingerprint(value); setVerified(false); }} aria-label="SSH Host Key Fingerprint">
              {inspection.host_keys.map(key => <Radio key={key.fingerprint} value={key.fingerprint} disabled={disabled} label={<><span>{key.algorithm}</span> <code>{key.fingerprint}</code></>} aria-label={`Trust ${key.fingerprint}`} />)}
            </Radio.Group>
            <button type="button" className="secondary-button" aria-label="Test SSH Connection" disabled={disabled || !fingerprint} onClick={() => void probe()}>{s("trustHost")} · {s("testConnection")}</button>
          </fieldset>}
          {expired && <p role="alert" className="workspace-notice">{s("trustExpired")}</p>}
          {verified && !expired && <p role="status">{s("verified")}</p>}
        </div>
      </>}
      <TextInput id="ssh-resource-cwd" label={r("defaultCwd")} aria-label="Default Working Directory" value={cwd} onChange={event => setCwd(event.currentTarget.value)} maxLength={4096} disabled={disabled} spellCheck={false} />
      {error && <p role="alert" className="workspace-notice">{sshErrorText(error, r, s)}</p>}
      <div className="connection-actions"><button type="submit" className="primary-button" aria-label="Save" disabled={disabled || (mode === "direct" && (!verified || expired))}>{p("save")}</button><button type="button" className="secondary-button" disabled={disabled} onClick={onClose}>{p("cancel")}</button></div>
    </form>
  </WorkspaceDialog>;
}
