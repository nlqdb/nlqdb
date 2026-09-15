// The create path's failures must reach the wire as registry envelopes
// (SK-ERR-001) — the legacy `{kind, reason}` body had no `code`, so the SDK
// surfaced `unknown_error` and the chat fell back to "Something went wrong".

import { describe, expect, it } from "vitest";
import { errorEnvelope } from "../error-envelope.ts";
import { createWireError } from "./wire-error.ts";

describe("createWireError", () => {
  it("renders infer_failed/plan_invalid as a 422 clarify envelope with copy", () => {
    const { body, httpStatus } = errorEnvelope(
      createWireError({
        kind: "infer_failed",
        reason: "plan_invalid",
        details: { issue_count: 2 },
      }),
    );
    expect(httpStatus).toBe(422);
    expect(body.error).toMatchObject({
      code: "infer_failed",
      retryable: false,
      params: { reason: "plan_invalid" },
    });
    expect(body.error.message).toMatch(/didn't pass validation/);
    expect(body.error.action.length).toBeGreaterThan(0);
  });

  it("routes an LLM outage to the shared llm_failed code on the free lane", () => {
    const wire = createWireError({ kind: "infer_failed", reason: "llm_failed" });
    expect(wire).toEqual({ code: "llm_failed", lane: "free" });
    expect(errorEnvelope(wire).httpStatus).toBe(502);
  });

  it("keeps provision_failed honest about rollback", () => {
    const { body, httpStatus } = errorEnvelope(
      createWireError({
        kind: "provision_failed",
        reason: "transaction_failed",
        rolled_back: false,
      }),
    );
    expect(httpStatus).toBe(502);
    expect(body.error.action).toMatch(/delete it/);
  });
});
