import { describe, expect, it } from "vitest";
import { CALL_FAILURE_LANGUAGES, CALL_FAILURE_MESSAGES, translateCallFailureText } from "../src/ui/callFailureMessages.js";
import { elapsedCallTime, failureNextStepText, failureReasonText } from "../src/ui/callFailure.js";
import { translate } from "../src/runtime_i18n.js";

const placeholders = (text: string) => [...text.matchAll(/\{[A-Za-z_]+\}/g)].map(match => match[0]).sort();

describe("shared activity failure translations", () => {
  it.each(["unsupported_resource", "capability_unavailable", "runtime_error"])("explains %s in every locale without overriding uncertain execution", reason => {
    const failure = { outcome: "rejected" as const, reason };
    const explanation = failureReasonText(failure);
    const next = failureNextStepText(failure);
    expect(explanation).not.toBe(failureReasonText({ outcome: "rejected", reason: "unknown_reason" }));
    for (const language of CALL_FAILURE_LANGUAGES) {
      expect(translateCallFailureText(explanation, language)).toBeTruthy();
      expect(translateCallFailureText(next, language)).toBeTruthy();
    }
    expect(failureNextStepText({ ...failure, outcome: "outcome_unknown" })).toContain("may already have taken effect");
    expect(failureNextStepText({ ...failure, outcome: "call_failed" })).toContain("does not show whether the operation already took effect");
  });

  it("provides complete translations and preserves time placeholders in every supported language", () => {
    expect(CALL_FAILURE_LANGUAGES).toEqual(["zh-CN", "zh-TW", "ja-JP", "ko-KR", "de-DE", "fr-FR"]);
    for (const [source, messages] of Object.entries(CALL_FAILURE_MESSAGES)) {
      expect(messages, source).toHaveLength(CALL_FAILURE_LANGUAGES.length);
      for (const [index, language] of CALL_FAILURE_LANGUAGES.entries()) {
        expect(messages[index].trim(), `${language}: ${source}`).not.toBe("");
        expect(placeholders(messages[index]), `${language}: ${source}`).toEqual(placeholders(source));
        expect(translateCallFailureText(source, language)).toBe(messages[index]);
      }
    }
  });

  it("keeps a failed call distinct from an execution failure and preserves existing fallback", () => {
    expect(translate("Call failed", "zh-CN")).toBe("调用失败");
    expect(translate("Execution failed", "zh-CN")).toBe("执行失败");
    expect(translate("Call failed", "zh-TW")).not.toBe(translate("Execution failed", "zh-TW"));
    expect(translateCallFailureText("Call failed", "en")).toBeUndefined();
    expect(translateCallFailureText("Call failed", "en-US")).toBeUndefined();
    expect(translateCallFailureText("An unrelated existing label", "zh-CN")).toBeUndefined();
    expect(translateCallFailureText("Call failed", "unsupported-locale")).toBeUndefined();
    const elapsed = elapsedCallTime(13_731_000, text => translate(text, "zh-CN"));
    expect(elapsed).toContain("3");
    expect(elapsed).toContain("48");
    expect(elapsed).not.toContain("13731");
    expect(elapsed).not.toContain("{");
  });
});
