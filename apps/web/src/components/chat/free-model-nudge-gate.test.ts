import { describe, expect, test } from "bun:test";

// SK-PREMIUM-004 — the free-model nudge must fire only when the free chain
// visibly struggled: a model-quality error (couldn't plan / rejected SQL) or a
// sub-floor confidence. It must NOT fire on infra errors (rate-limit, auth,
// network, db-unreachable) or on confident answers — those would be misleading
// or banner-blindness.

import { freeChainStruggled, type StruggleInput } from "./free-model-nudge-gate.ts";

function errorReply(code?: string): StruggleInput {
  return { state: { kind: "error", code } };
}

function okReply(confidence?: number, traceConfidence?: number): StruggleInput {
  return {
    state: { kind: "ok", ok: { trace: confidence === undefined ? null : { confidence } } },
    trace: traceConfidence === undefined ? null : { confidence: traceConfidence },
  };
}

describe("freeChainStruggled — error path", () => {
  test("fires on model-quality codes", () => {
    expect(freeChainStruggled(errorReply("llm_failed"))).toBe(true);
    expect(freeChainStruggled(errorReply("sql_rejected"))).toBe(true);
  });

  test("does not fire on infra / user-fixable codes", () => {
    for (const code of [
      "rate_limited",
      "unauthorized",
      "network_error",
      "db_unreachable",
      "aborted",
      "schema_mismatch",
      "db_not_found",
    ]) {
      expect(freeChainStruggled(errorReply(code))).toBe(false);
    }
  });

  test("does not fire when the error has no code", () => {
    expect(freeChainStruggled(errorReply(undefined))).toBe(false);
  });
});

describe("freeChainStruggled — ok path", () => {
  test("fires below the 0.7 confidence floor", () => {
    expect(freeChainStruggled(okReply(0.5))).toBe(true);
    expect(freeChainStruggled(okReply(0.69))).toBe(true);
  });

  test("does not fire at or above the floor", () => {
    expect(freeChainStruggled(okReply(0.7))).toBe(false);
    expect(freeChainStruggled(okReply(0.95))).toBe(false);
  });

  test("prefers the streaming trace confidence when present", () => {
    // reply.trace (streaming) low → fires even if ok.trace is high.
    expect(freeChainStruggled(okReply(0.9, 0.4))).toBe(true);
    // reply.trace high → does not fire even if ok.trace is low.
    expect(freeChainStruggled(okReply(0.4, 0.9))).toBe(false);
  });

  test("does not fire when confidence is unknown", () => {
    expect(freeChainStruggled(okReply(undefined))).toBe(false);
  });
});

describe("freeChainStruggled — other reply kinds", () => {
  test("never fires for pending / needs-confirm / ambiguous / clarify / created", () => {
    for (const kind of ["pending", "needs-confirm", "ambiguous", "clarify", "created"]) {
      expect(freeChainStruggled({ state: { kind } })).toBe(false);
    }
  });
});
