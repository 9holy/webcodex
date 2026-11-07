import { useEffect, useState } from "react";
import type { ContinuationSummary } from "../../models/runtime-shell";
import { useShellText } from "../../i18n/runtime-shell";
import { CallFailureDiagnostics, CallFailureNotice } from "../../../../../frontend/src/ui/CallFailureNotice";
import { callStatusLabel, elapsedCallTime, isFailedCallStatus } from "../../../../../frontend/src/ui/callFailure";

export function ContinuationFacts({ value, observedAt }: { value: ContinuationSummary | null; observedAt?: number }) {
  const s = useShellText(); const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  if (!value) return <p className="field-help">{s("No completed meaningful call is available in this bounded observation.")}</p>;
  const elapsed = value.elapsed_ms == null ? null : value.elapsed_ms + Math.max(0, now - (observedAt ?? now));
  const failed = isFailedCallStatus(value.execution);
  const response = value.response_handoff === "handler_returned" ? "Returned to HTTP framework" : value.response_handoff === "stream_started" ? "Response stream started" : "Response handoff not confirmed";
  return <section className="continuation-facts" aria-label={s("Last WebCodex call")}>
    <h3>{s("Last WebCodex call")} <code>{value.tool_name ?? s("Unknown")}</code></h3>
    <p className="call-result-label">{s(callStatusLabel(value.execution, value.failure))}</p>
    {failed && <CallFailureNotice failure={value.failure} toolName={value.tool_name} t={s} />}
    <dl className="runtime-facts"><div><dt>{s(value.response_handoff === "not_confirmed" ? "Time since recorded call" : "Time since response")}</dt><dd>{elapsed == null ? "—" : elapsedCallTime(elapsed, s)}</dd></div></dl>
    {value.response_handoff === "handler_returned" && value.execution === "completed" && value.next_meaningful_call === "not_observed" && <p>{s("WebCodex returned this call. No later tool call is visible in the observed history.")}</p>}
    {value.history_partial && <p className="field-help">{s("Only part of the retained activity is shown.")}</p>}
    <details className="call-technical-details"><summary>{s("Technical details")}</summary>
      <CallFailureDiagnostics failure={value.failure} t={s} />
      <dl className="runtime-facts"><div><dt>{s("Response")}</dt><dd>{s(response)}</dd></div>
        <div><dt>{s("Next meaningful WebCodex call")}</dt><dd>{s(value.next_meaningful_call === "observed" ? "Observed" : "Not observed")}</dd></div>
        {value.service_ms != null && <div><dt>{s("Server processing time")}</dt><dd>{value.service_ms === 0 ? s("Less than 1 ms") : `${value.service_ms} ms`}</dd></div>}</dl>
      <p className="field-help">{s("The gap may include network, Tunnel delivery, Host scheduling, model inference, user actions or time WebCodex cannot observe. Handler return does not confirm Tunnel, MCP Host, or model receipt.")}</p>
    </details>
  </section>;
}
