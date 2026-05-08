// Tests for `parseAskBody` and the `engine?` validation seam
// (SK-DB-010). Validating engine at the HTTP boundary keeps the
// orchestrator narrow — by the time the body lands in
// `orchestrateDbCreate.args.engine`, we know it's already in the
// allowed `Engine` set.

import type { Context } from "hono";
import { describe, expect, it } from "vitest";
import { isAllowedEngine, parseAskBody } from "../src/http.ts";

function fakeCtx(body: unknown): Context {
  return {
    req: {
      json: async () => body,
    },
  } as unknown as Context;
}

describe("isAllowedEngine", () => {
  it("accepts the allowed engines", () => {
    expect(isAllowedEngine("postgres")).toBe(true);
    expect(isAllowedEngine("clickhouse")).toBe(true);
  });

  it("rejects deferred / unknown engines", () => {
    expect(isAllowedEngine("sqlite")).toBe(false);
    expect(isAllowedEngine("redis")).toBe(false);
    expect(isAllowedEngine("mongodb")).toBe(false);
    expect(isAllowedEngine("")).toBe(false);
    expect(isAllowedEngine(null)).toBe(false);
    expect(isAllowedEngine(undefined)).toBe(false);
    expect(isAllowedEngine(42)).toBe(false);
  });
});

describe("parseAskBody — engine validation (SK-DB-010)", () => {
  it("accepts a body with no engine field (classifier-default path)", async () => {
    const out = await parseAskBody(fakeCtx({ goal: "an orders tracker" }));
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("expected ok");
    expect(out.body.goal).toBe("an orders tracker");
    expect(out.body.engine).toBeUndefined();
  });

  it("accepts an explicit `engine: postgres` override", async () => {
    const out = await parseAskBody(fakeCtx({ goal: "g", engine: "postgres" }));
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("expected ok");
    expect(out.body.engine).toBe("postgres");
  });

  it("accepts an explicit `engine: clickhouse` override", async () => {
    const out = await parseAskBody(fakeCtx({ goal: "events", engine: "clickhouse" }));
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("expected ok");
    expect(out.body.engine).toBe("clickhouse");
  });

  it("rejects an unknown engine string with invalid_engine 400", async () => {
    const out = await parseAskBody(fakeCtx({ goal: "g", engine: "mysql" }));
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("expected error");
    expect(out.error.status).toBe(400);
    expect(out.error.body.error).toBe("invalid_engine");
  });

  it("rejects deferred engines (sqlite/redis) at the wire boundary", async () => {
    for (const engine of ["sqlite", "redis"]) {
      const out = await parseAskBody(fakeCtx({ goal: "g", engine }));
      expect(out.ok).toBe(false);
      if (out.ok) throw new Error("expected error");
      expect(out.error.body.error).toBe("invalid_engine");
    }
  });

  it("rejects non-string engine (number / object / null)", async () => {
    for (const engine of [42, { name: "postgres" }, null]) {
      const out = await parseAskBody(fakeCtx({ goal: "g", engine }));
      expect(out.ok).toBe(false);
      if (out.ok) throw new Error("expected error");
      expect(out.error.body.error).toBe("invalid_engine");
    }
  });
});
