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
    // Envelope carries the offending value + the allowed list so SDK /
    // CLI consumers can render a precise message without re-fetching
    // the docs.
    if (out.error.body.error !== "invalid_engine") throw new Error("narrow");
    expect(out.error.body.value).toBe("mysql");
    expect(out.error.body.allowed).toEqual(["postgres", "clickhouse"]);
  });

  it("rejects deferred engines (sqlite/redis) at the wire boundary", async () => {
    for (const engine of ["sqlite", "redis"]) {
      const out = await parseAskBody(fakeCtx({ goal: "g", engine }));
      expect(out.ok).toBe(false);
      if (out.ok) throw new Error("expected error");
      expect(out.error.body.error).toBe("invalid_engine");
      if (out.error.body.error !== "invalid_engine") throw new Error("narrow");
      expect(out.error.body.value).toBe(engine);
      expect(out.error.body.allowed).toEqual(["postgres", "clickhouse"]);
    }
  });

  it("rejects non-string engine (number / object / null)", async () => {
    for (const engine of [42, { name: "postgres" }, null]) {
      const out = await parseAskBody(fakeCtx({ goal: "g", engine }));
      expect(out.ok).toBe(false);
      if (out.ok) throw new Error("expected error");
      expect(out.error.body.error).toBe("invalid_engine");
      if (out.error.body.error !== "invalid_engine") throw new Error("narrow");
      expect(out.error.body.value).toEqual(engine);
      expect(out.error.body.allowed).toEqual(["postgres", "clickhouse"]);
    }
  });
});

describe("parseAskBody — model preset validation (SK-PREMIUM-014)", () => {
  it("accepts each preset and carries it on the body", async () => {
    for (const model of ["auto", "fast", "best"]) {
      const out = await parseAskBody(fakeCtx({ goal: "g", model }));
      expect(out.ok).toBe(true);
      if (!out.ok) throw new Error("expected ok");
      expect(out.body.model).toBe(model);
    }
  });

  it("treats an absent or empty model as omitted", async () => {
    for (const body of [{ goal: "g" }, { goal: "g", model: "" }]) {
      const out = await parseAskBody(fakeCtx(body));
      expect(out.ok).toBe(true);
      if (!out.ok) throw new Error("expected ok");
      expect(out.body.model).toBeUndefined();
    }
  });

  it("rejects a named model string with invalid_model 400 — presets only on the wire", async () => {
    const out = await parseAskBody(fakeCtx({ goal: "g", model: "claude-opus-4-8" }));
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("expected error");
    expect(out.error.status).toBe(400);
    expect(out.error.body.error).toBe("invalid_model");
    if (out.error.body.error !== "invalid_model") throw new Error("narrow");
    expect(out.error.body.value).toBe("claude-opus-4-8");
    expect(out.error.body.allowed).toEqual(["auto", "fast", "best"]);
  });

  it("rejects non-string model values (number / object / null)", async () => {
    for (const model of [42, { id: "fast" }, null]) {
      const out = await parseAskBody(fakeCtx({ goal: "g", model }));
      expect(out.ok).toBe(false);
      if (out.ok) throw new Error("expected error");
      expect(out.error.body.error).toBe("invalid_model");
    }
  });
});
