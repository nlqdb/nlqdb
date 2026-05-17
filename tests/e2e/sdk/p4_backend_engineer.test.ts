// P4 — Backend Engineer at a Small Startup. SDK contract for Sam's
// cron pipeline. Three assertions per persona README:
//
//   • a recoverable 5xx is silently retried (GLOBAL-022 + SK-SDK-006)
//   • mutating calls carry an Idempotency-Key (GLOBAL-005); the same
//     key is reused across retries so server-side dedupe collapses
//     them to one effect
//   • cache-hit on repeated cron runs (GLOBAL-006 dedupes LLM calls)
//
// (GLOBAL-009 silent token refresh on 401 is enforced ABOVE the SDK
// — the SDK surfaces 401 to the caller; the consuming app / auth
// wrapper re-fetches the token. SDK-level contract is "wire-layer
// retry on transport + 5xx only", per isRecoverable() in the SDK.)
//
// Hermetic — replays `cassettes/p4_backend_engineer.json`.
//
// Persona link: ../personas/P4-backend-engineer/README.md.

import { describe, expect, it } from "vitest";
import { createClient } from "../../../packages/sdk/src/index.ts";
import { openCassette } from "./_lib/cassette.ts";

describe("P4 — Backend Engineer · SDK contract", () => {
  it("recovers from a transient 5xx then attaches Idempotency-Key on every mutation", async () => {
    const { fetch, assertConsumed } = openCassette("p4_backend_engineer");

    // Capture every outbound request so we can assert on the
    // Idempotency-Key header (GLOBAL-005 + SK-SDK-006).
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

    // Step 1 — first ask hits a recoverable 503 and is silently
    // retried (GLOBAL-022). Sam never sees the 503.
    const result = await client.ask({
      goal: "regression rows since last release",
      dbId: "db_e2e_p4",
    });
    if ("kind" in result) throw new Error("expected ask path, got create");
    expect(result.status).toBe("ok");
    expect(result.rows).toHaveLength(1);
    expect(result.trace.cache_hit).toBe(true);

    // We saw two ask calls (the 503 retry). Both carry an
    // Idempotency-Key (GLOBAL-005 — POST is a mutation).
    const askCalls = seen.filter((s) => s.path === "/v1/ask");
    expect(askCalls).toHaveLength(2);
    const [firstAsk, secondAsk] = askCalls;
    if (!firstAsk || !secondAsk) throw new Error("unreachable: askCalls.length is 2");
    for (const c of askCalls) {
      expect(c.idemKey).toBeTruthy();
      expect(c.idemKey?.length ?? 0).toBeGreaterThan(8);
    }
    // Same idempotency key across both attempts of the same call —
    // the retry must NOT mint a fresh key, or server-side dedupe
    // can't collapse retries to one effect (SK-SDK-006).
    expect(firstAsk.idemKey).toBe(secondAsk.idemKey);

    // Step 2 — a write mutation also attaches an Idempotency-Key,
    // distinct from the previous call's.
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
