import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CodingAgentPermissionClient, CodingAgentPermissionDecision, CodingAgentPermissionInventory, CodingAgentPermissionRun, PendingCodingAgentPermission } from "./codingAgentPermissions.js";
import "./coding-agent-permissions.css";

const words = {
  title: ["Coding agent approvals", "编程代理审批"],
  help: ["Review the provider's request before choosing a one-time response. A credential with explicit approval access is required.", "先核对代理请求，再选择本次操作的响应。审批需要具备明确审批权限的凭据。"],
  refresh: ["Refresh approvals", "刷新审批"], loading: ["Loading approvals…", "正在读取审批…"],
  run: ["Delegate coding work", "委托编程任务"], approve: ["Respond to permission requests", "响应权限请求"],
  available: ["Authorized", "已授权"], unavailable: ["Not authorized", "未授权"],
  denied: ["This credential cannot read approvals. Reconnect with an operator-authorized credential.", "当前凭据无法读取审批，请使用获得操作员授权的凭据重新连接。"],
  grant: ["Approval access is separate from delegation. Open Desktop → Extensions → Coding agents to authorize this connection, or ask your Server operator for approval access.", "审批权限与任务委托分开。请在 Desktop → 扩展 → 编程代理中授权此连接，或请 Server 操作员授予审批权限。"],
  failed: ["Approvals could not be refreshed. Previous requests are read-only until a successful refresh.", "暂时无法刷新审批。成功刷新前，历史请求仅供查看。"],
  empty: ["No pending permission requests", "没有待处理的权限请求"],
  expired: ["Expired — refresh to observe the run's current state", "已过期，请刷新查看任务当前状态"],
  unobserved: ["This request is not in the current inventory. Refresh to observe its status.", "当前列表中未观察到此请求，请刷新确认状态。"],
  handled: ["Handled or closed", "已处理或已关闭"], sending: ["Submitting…", "正在提交…"],
  allowed: ["One-time approval received — waiting for the agent to continue", "单次允许决定已接收，等待代理继续"], rejected: ["One-time denial received — waiting for the agent to continue", "单次拒绝决定已接收，等待代理继续"], cancelled: ["Cancellation received — waiting for the agent to continue", "取消决定已接收，等待代理继续"],
  allow: ["Allow once", "允许一次"], reject: ["Deny once", "拒绝一次"], cancel: ["Cancel request", "取消请求"],
  unknown: ["Response status is unknown. Refresh before choosing again; no response was retried automatically.", "响应结果尚不确定。再次选择前请刷新，系统不会自动重试。"],
  stale: ["This request has changed or was already handled. Refresh to see the current request.", "此请求已变化或已被处理，请刷新查看当前请求。"],
  scope: ["Approval access was denied. Refresh authorization before trying again.", "审批权限被拒绝，请刷新授权状态后再试。"],
  details: ["Requested action", "请求的操作"],
  expires: ["Expires", "过期时间"], project: ["Project", "项目"], runner: ["Runner", "Runner"],
  oneTime: ["The provider did not offer a one-time response. You can cancel this request.", "代理没有提供单次响应选项，你可以取消此请求。"],
  bounded: ["The Server returned a partial inventory. Refresh or inspect the relevant Runner for more requests.", "Server 返回了部分列表，请刷新或查看对应 Runner 的其他请求。"],
} as const;
type Word = keyof typeof words;
type Row = { run: CodingAgentPermissionRun; pending: PendingCodingAgentPermission; result?: Word; locked?: boolean };
const rowKey = (runId: string, requestId: string) => JSON.stringify([runId, requestId]);

// Bounds UI liveness even when a native bridge or a fetch mock ignores abort.
// Aborting a write never implies it was rolled back and never resends it.
function boundedResponse<T>(request: AbortController, send: () => Promise<T>): Promise<T | null> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true; clearTimeout(timer); request.signal.removeEventListener("abort", cancelled); resolve(value);
    };
    const cancelled = () => finish(null);
    const timer = setTimeout(() => request.abort(), 30000);
    request.signal.addEventListener("abort", cancelled, { once: true });
    if (request.signal.aborted) { cancelled(); return; }
    void Promise.resolve().then(send).then(finish, () => finish(null));
  });
}

/** Remount on identity changes so neither requests nor decisions cross credentials. */
export function CodingAgentPermissionPanel(props: {
  identity: string;
  client: CodingAgentPermissionClient;
  language?: string;
  disabled?: boolean;
  refreshKey?: number;
  authorizationAction?: ReactNode;
  onUnauthorized?: () => void;
}) {
  return <PermissionPanel key={props.identity} {...props} />;
}
function PermissionPanel({ client, language = "en", disabled = false, refreshKey, authorizationAction, onUnauthorized }: Parameters<typeof CodingAgentPermissionPanel>[0]) {
  const t = (key: Word) => words[key][language.startsWith("zh") ? 1 : 0];
  const [inventory, setInventory] = useState<CodingAgentPermissionInventory | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<"loading" | "available" | "error" | "denied">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const pending = useRef<string | null>(null);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const manual = useRef(false);
  const mutation = useRef<AbortController | null>(null);
  const observation = useRef<AbortController | null>(null);
  const observedRevisions = useRef(new Map<string, number>());
  const refresh = () => { manual.current = true; setRevision(value => value + 1); };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++epoch.current; mutation.current?.abort(); };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setClock(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden" && !pending.current && !observation.current && !disabled && status !== "denied") setRevision(value => value + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, [disabled, status]);
  useEffect(() => {
    if (disabled || pending.current) return;
    const request = new AbortController(); const current = ++epoch.current;
    const explicit = manual.current; manual.current = false;
    observation.current = request;
    void boundedResponse(request, () => client.list(request.signal)).then(response => {
      if (!mounted.current || current !== epoch.current) return;
      if (response?.status === 401 || response?.status === 403) {
        setRows([]); setInventory(null); setStatus("denied"); observedRevisions.current.clear();
        if (response.status === 401) onUnauthorized?.();
        return;
      }
      if (!response?.ok || !response.data || request.signal.aborted) { setStatus("error"); return; }
      const data = response.data; setInventory(data); setStatus("available"); setClock(Date.now());
      setRows(previous => {
        const next = new Map<string, Row>();
        for (const run of data.runs) {
          const lastRevision = observedRevisions.current.get(run.run_id) ?? -1;
          if (run.observation_revision < lastRevision) {
            for (const row of previous.filter(row => row.run.run_id === run.run_id)) next.set(rowKey(row.run.run_id, row.pending.request_id), row);
            continue;
          }
          observedRevisions.current.set(run.run_id, run.observation_revision);
          if (!run.pending_permission || run.state !== "waiting_permission") continue;
          const key = rowKey(run.run_id, run.pending_permission.request_id);
          const previousRow = previous.find(row => rowKey(row.run.run_id, row.pending.request_id) === key);
          const settled = previousRow?.result && !["unknown", "stale", "scope", "unobserved"].includes(previousRow.result);
          next.set(key, { run, pending: run.pending_permission, ...(settled || (!explicit && previousRow?.locked) ? { result: previousRow.result, locked: true } : {}) });
        }
        // Retain a bounded local receipt, never claim another operator's choice.
        for (const row of previous) {
          const key = rowKey(row.run.run_id, row.pending.request_id);
          if (!next.has(key)) next.set(key, { ...row, result: row.result && !["unknown", "stale", "scope", "unobserved"].includes(row.result) ? row.result : data.runs.some(run => run.run_id === row.run.run_id) ? "handled" : "unobserved", locked: true });
        }
        const all = [...next.values()];
        const retained = [...all.filter(row => !row.locked), ...all.filter(row => row.locked).slice(0, 64)];
        const retainedRuns = new Set(retained.map(row => row.run.run_id));
        for (const runId of observedRevisions.current.keys()) if (!retainedRuns.has(runId)) observedRevisions.current.delete(runId);
        return retained;
      });
    }).catch(() => { if (mounted.current && current === epoch.current) setStatus("error"); })
      .finally(() => { if (observation.current === request) observation.current = null; });
    return () => { request.abort(); if (observation.current === request) observation.current = null; };
  }, [client, disabled, revision, refreshKey, onUnauthorized]);

  const respond = async (row: Row, decision: CodingAgentPermissionDecision, success: Word) => {
    const key = rowKey(row.run.run_id, row.pending.request_id);
    if (pending.current || disabled || row.locked || status !== "available" || !inventory?.authorization.can_approve || !inventory.authorization.can_run || row.pending.expires_at * 1000 <= Date.now()) return;
    pending.current = key; setBusy(key); const current = ++epoch.current;
    const request = new AbortController(); mutation.current = request;
    observation.current?.abort();
    let result: Word = "unknown";
    try {
      const response = await boundedResponse(request, () => client.respond(decision, request.signal));
      if (response?.status === 401 || response?.status === 403) {
        if (mounted.current && current === epoch.current) {
          setRows([]); setInventory(null); setStatus("denied");
          if (response.status === 401) onUnauthorized?.();
        }
        return;
      }
      result = response?.ok ? success : response?.status === 409 || response?.status === 410 || response?.status === 404 ? "stale" : "unknown";
    } catch { /* Unknown writes are observed, never automatically repeated. */ }
    finally {
      if (mutation.current === request) mutation.current = null;
      pending.current = null;
      if (mounted.current && current === epoch.current) { setBusy(null); setRevision(value => value + 1); }
    }
    if (mounted.current && current === epoch.current) setRows(previous => previous.map(value => rowKey(value.run.run_id, value.pending.request_id) === key ? { ...value, result, locked: true } : value));
  };
  return <section className="coding-permission-panel" aria-label={t("title")}>
    <header><div><h2>{t("title")}</h2><p>{t("help")}</p></div><button type="button" className="secondary-button" onClick={refresh} disabled={disabled || Boolean(busy)}>{t("refresh")}</button></header>
    {inventory && <dl className="coding-permission-authority"><div><dt>{t("run")}</dt><dd>{t(inventory.authorization.can_run ? "available" : "unavailable")}</dd></div><div><dt>{t("approve")}</dt><dd>{t(inventory.authorization.can_approve ? "available" : "unavailable")}</dd></div></dl>}
    {inventory && (!inventory.authorization.can_approve || !inventory.authorization.can_run) && <p className="coding-permission-note">{t("grant")}</p>}
    {authorizationAction}
    {status === "loading" && <p role="status">{t("loading")}</p>}
    {(status === "error" || status === "denied") && <p role="alert">{t(status === "denied" ? "denied" : "failed")}</p>}
    {status === "available" && !rows.length && <p role="status">{t("empty")}</p>}
    {inventory?.truncated && <p className="coding-permission-note">{t("bounded")}</p>}
    <div className="coding-permission-requests">{rows.map(row => {
      const key = rowKey(row.run.run_id, row.pending.request_id); const expired = row.pending.expires_at * 1000 <= clock;
      const actionable = !disabled && !busy && status === "available" && inventory?.authorization.can_run && inventory.authorization.can_approve && !expired && !row.locked;
      const options = row.pending.options.filter(option => option.kind === "allow_once" || option.kind === "reject_once");
      return <article key={key} className="coding-permission-request" aria-label={row.pending.label}>
        <h3>{row.pending.label}</h3><p className="coding-permission-context"><strong>{row.run.provider_id}</strong> · {t("project")}: <code>{row.run.runtime_project_id}</code>{row.run.client_id && <> · {t("runner")}: <code>{row.run.client_id}</code></>}</p>
        <div className="coding-permission-details"><h4>{t("details")}</h4><pre>{row.pending.details}</pre></div>
        <p>{t("expires")}: <time dateTime={new Date(row.pending.expires_at * 1000).toISOString()}>{new Date(row.pending.expires_at * 1000).toLocaleString(language.startsWith("zh") ? "zh-CN" : "en")}</time></p>
        {row.result ? <p role="status">{t(row.result)}</p> : expired ? <p role="status">{t("expired")}</p> : busy === key ? <p role="status">{t("sending")}</p> : null}
        {!row.locked && <div className="coding-permission-actions">{options.map(option => <button key={option.option_id} type="button" className={option.kind === "allow_once" ? "primary-button" : "secondary-button"} disabled={!actionable} title={option.name} onClick={() => void respond(row, { run_id: row.run.run_id, request_id: row.pending.request_id, outcome: "selected", option_id: option.option_id }, option.kind === "allow_once" ? "allowed" : "rejected")}>{t(option.kind === "allow_once" ? "allow" : "reject")}<small>{option.name}</small></button>)}<button type="button" className="secondary-button" disabled={!actionable} onClick={() => void respond(row, { run_id: row.run.run_id, request_id: row.pending.request_id, outcome: "cancelled" }, "cancelled")}>{t("cancel")}</button></div>}
        {!row.locked && !options.length && <p className="coding-permission-note">{t("oneTime")}</p>}
      </article>;
    })}</div>
  </section>;
}
