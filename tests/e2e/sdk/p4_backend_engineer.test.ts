import { describe, expect, it } from "vitest";
import { createClient } from "../../../packages/sdk/src/index.ts";
import { openCassette } from "./_lib/cassette.ts";

describe("P4 — Backend Engineer · SDK contract", () => {
  it("recovers from a transient 5xx then attaches Idempotency-Key on every mutation", async () => {
    const { fetch, assertConsumed } = openCassette("p4_backend_engineer");

    const seen: { method: string; path: string; idemKey: string | null }[] = [];
    const fetchWithCapture: typeof fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      const headers = new Headers(init?.headers ?? {});
      seen.push({
        method: (init?.method ?? "GET").toUpperCase(),
        path: url.pathname,
        idemKey: headers.get("idempotency-key"),
      });
      return fetch(input, init);
    };

    const client = createClient({
      apiKey: "sk_live_p4_e2e",
      baseUrl: "https://staging.example.com",
      fetch: fetchWithCapture,
    });

    const result = await client.ask({
      goal: "regression rows since last release",
      dbId: "db_e2e_p4",
    });
    if ("kind" in result) throw new Error("expected ask path, got create");
    expect(result.status).toBe("ok");
    expect(result.rows).toHaveLength(1);
    expect(result.trace.cache_hit).toBe(true);

    const askCalls = seen.filter((s) => s.path === "/v1/ask");
    expect(askCalls).toHaveLength(2);
    const [firstAsk, secondAsk] = askCalls;
    if (!firstAsk || !secondAsk) throw new Error("unreachable: askCalls.length is 2");
    for (const c of askCalls) {
      expect(c.idemKey).toBeTruthy();
      expect(c.idemKey?.length ?? 0).toBeGreaterThan(8);
    }
    // Same Idempotency-Key across retries lets server-side dedupe collapse them to one effect.
    expect(firstAsk.idemKey).toBe(secondAsk.idemKey);

    const write = await client.ask({
      goal: "insert a row into regressions",
      dbId: "db_e2e_p4",
    });
    if ("kind" in write) throw new Error("expected ask path, got create");
    const writeCalls = seen.filter((s, i) => s.path === "/v1/ask" && i >= askCalls.length);
    expect(writeCalls).toHaveLength(1);
    const [writeCall] = writeCalls;
    if (!writeCall) throw new Error("unreachable: writeCalls.length is 1");
    expect(writeCall.idemKey).toBeTruthy();
    expect(writeCall.idemKey).not.toBe(firstAsk.idemKey);

    assertConsumed();
  });
});
