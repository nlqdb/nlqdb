import { describe, expect, test } from "bun:test";

// SK-PREMIUM-004 — the free-model nudge must fire only when the free chain
// visibly struggled: a model-quality error (couldn't plan / rejected SQL) or a
// sub-floor confidence. It must NOT fire on infra errors (rate-limit, auth,
// network, db-unreachable) or on confident answers — those would be misleading
// or banner-blindness.

import {
  freeChainStruggled,
  type StruggleInput,
  strugglingModel,
} from "./free-model-nudge-gate.ts";

function errorReply(
  code?: string,
  referencedTables?: string[],
  extra?: { model?: string; traceModel?: string },
): StruggleInput {
  return {
    state: {
      kind: "error",
      code,
      referencedTables,
      ...(extra?.model ? { model: extra.model } : {}),
    },
    ...(extra?.traceModel ? { trace: { model: extra.traceModel } } : {}),
  };
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
    // The plan sat below the confidence floor (SK-TRUST-003), surfaced as the
    // `low_confidence` error — the error twin of the sub-0.7 ok-path struggle.
    expect(freeChainStruggled(errorReply("low_confidence"))).toBe(true);
    // SK-ASK-030 — the model generated SQL whose values didn't fit the columns
    // (a bad cast / range); a frontier model typically avoids it.
    expect(freeChainStruggled(errorReply("invalid_value"))).toBe(true);
    // SK-ASK-016 — pre-flight hallucination: the LLM emitted SQL against a
    // table absent from the DDL, so the envelope carries the hallucinated
    // relations. A model-quality failure, so the nudge fires.
    expect(freeChainStruggled(errorReply("schema_mismatch", ["orders"]))).toBe(true);
  });

  test("does not fire on infra / user-fixable codes", () => {
    for (const code of [
      "rate_limited",
      "unauthorized",
      "network_error",
      "db_unreachable",
      "aborted",
      "db_not_found",
      // Write *outcomes* — the data / intent, not the plan's quality — so a
      // frontier model wouldn't change them. Stay excluded (SK-PREMIUM-004).
      "write_no_rows",
      "write_constraint",
    ]) {
      expect(freeChainStruggled(errorReply(code))).toBe(false);
    }
  });

  test("does not fire on exec-catch schema_mismatch with no referenced tables", () => {
    // SK-ASK-019 — orphaned/dropped-schema (`3F000`) and the `42P01` backstop
    // surface `schema_mismatch` with empty `referencedTables`: an infra failure
    // a frontier model fails identically, so the "switch models" nudge stays
    // silent.
    expect(freeChainStruggled(errorReply("schema_mismatch"))).toBe(false);
    expect(freeChainStruggled(errorReply("schema_mismatch", []))).toBe(false);
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

describe("strugglingModel", () => {
  test("prefers the streamed trace model (the model that produced the plan)", () => {
    // A post-plan failure: `plan` streamed the model before the error landed.
    expect(strugglingModel(errorReply("sql_rejected", [], { traceModel: "deepseek/r1" }))).toBe(
      "deepseek/r1",
    );
    // Trace wins even when the envelope also names an attempted model.
    expect(strugglingModel(errorReply("llm_failed", [], { traceModel: "a/b", model: "c/d" }))).toBe(
      "a/b",
    );
  });

  test("falls back to the llm_failed envelope model when no plan streamed", () => {
    expect(strugglingModel(errorReply("llm_failed", [], { model: "qwen/qwen-2.5" }))).toBe(
      "qwen/qwen-2.5",
    );
  });

  test("reads trace.model on an ok (low-confidence) reply", () => {
    expect(strugglingModel({ state: { kind: "ok", ok: {} }, trace: { model: "x/y" } })).toBe("x/y");
  });

  test("returns null when no real model is known", () => {
    expect(strugglingModel(errorReply("llm_failed"))).toBeNull();
    // A legacy cache row stores only the placeholder — never named as a model.
    expect(strugglingModel(errorReply("sql_rejected", [], { traceModel: "cached" }))).toBeNull();
  });
});
