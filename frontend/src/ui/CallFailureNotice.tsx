import { failureNextStepText, failureReasonText, legacyCallFailure, type CallFailure } from "./callFailure.js";

/** Friendly summaries do not fetch forensic traces or full captured payloads. */
export function CallFailureNotice({ failure: provided, toolName, t }: {
  failure?: CallFailure | null; toolName?: string | null; t: (value: string) => string;
}) {
  const failure = provided ?? legacyCallFailure;
  return <section className="call-failure-notice" data-call-outcome={failure.outcome} aria-label={t("Why this call failed")}>
    <p>{t(failureReasonText(failure))}</p>
    {failure.outcome === "call_failed" && <p>{t("The call returned an error; this record does not establish whether execution started.")}</p>}
    <p className="call-failure-next"><strong>{t("What to do next")}</strong> {t(failureNextStepText(failure))}</p>
    {toolName === "finish_coding_task" && <p className="call-failure-context">{t("This is the task closeout call. Its failure does not establish that a deployment or background process failed.")}</p>}
  </section>;
}

export function CallFailureDiagnostics({ failure, t }: { failure?: CallFailure; t: (value: string) => string }) {
  if (!failure) return null;
  const facts = [["Error category", failure.error_kind], ["Failure category", failure.failure_kind],
    ["Recorded execution state", failure.execution_state], ["Recorded recovery guidance", failure.recovery_kind]];
  return <dl className="call-failure-diagnostics">{facts.filter(([, value]) => value).map(([label, value]) =>
    <div key={label}><dt>{t(label!)}</dt><dd><code>{value}</code></dd></div>)}</dl>;
}
