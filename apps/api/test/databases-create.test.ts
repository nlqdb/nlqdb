// `POST /v1/databases` — the create auth boundary. Any account-scoped
// principal creates, preset or generic; anon and pk_live never do. This
// file pins the seams of that boundary via SELF.fetch against Miniflare's
// real D1:
//
//   - unauth               → 401 (requirePrincipal, before the handler)
//   - anon bearer          → 403 account_required (anon has no tenant —
//                            the SK-PIVOT-010 anon boundary is preserved
//                            for BOTH preset and generic create)
//   - sk_live / sk_mcp + preset → admitted past auth (proven by a
//                            post-auth, pre-provision `invalid_preset`
//                            400 — the full happy path would reach Neon,
//                            which this in-process test can't provision)
//   - sk_live + generic (no preset) → admitted past auth too: headless
//                            `createDatabase({ goal })` is END_GOAL row 1
//   - over the per-key bucket → 429 rate_limited before any LLM/Neon call

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { apiKeyHmacSecret, mintSkLiveKey, mintSkMcpKey } from "../src/api-keys.ts";

const URL = "https://example.com/v1/databases";
const JSON_HEADERS = { "content-type": "application/json" };

async function bodyStatus(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code;
}

describe("POST /v1/databases — create auth boundary", () => {
  it("returns 401 without any credential", async () => {
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ preset: "agent_memory_v1" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an anon bearer with 403 account_required on the preset path", async () => {
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: { ...JSON_HEADERS, authorization: "Bearer anon_abcdef0123456789" },
      body: JSON.stringify({ preset: "agent_memory_v1" }),
    });
    expect(res.status).toBe(403);
    expect(await bodyStatus(res)).toBe("account_required");
  });

  it("rejects an anon bearer on the generic goal path too (anon never creates)", async () => {
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: { ...JSON_HEADERS, authorization: "Bearer anon_abcdef0123456789" },
      body: JSON.stringify({ goal: "a table of orders" }),
    });
    expect(res.status).toBe(403);
    expect(await bodyStatus(res)).toBe("account_required");
  });

  it("admits an sk_live key onto the preset path (past the auth gate)", async () => {
    const { plaintext } = await mintSkLiveKey(
      env.DB,
      apiKeyHmacSecret(env),
      "user_sk_create",
      null,
    );
    // A bogus preset value is rejected AFTER auth but BEFORE any Neon
    // provision — so `invalid_preset` (not 401/403) proves the sk_live
    // principal was admitted onto the create path.
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: { ...JSON_HEADERS, authorization: `Bearer ${plaintext}` },
      body: JSON.stringify({ preset: "not_a_real_preset" }),
    });
    expect(res.status).toBe(400);
    expect(await bodyStatus(res)).toBe("invalid_preset");
  });

  it("admits an sk_mcp key onto the preset path (the dogfood key kind)", async () => {
    const { plaintext } = await mintSkMcpKey(
      env.DB,
      apiKeyHmacSecret(env),
      "user_mcp_create",
      "claude-code",
      "runner-1",
    );
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: { ...JSON_HEADERS, authorization: `Bearer ${plaintext}` },
      body: JSON.stringify({ preset: "not_a_real_preset" }),
    });
    expect(res.status).toBe(400);
    expect(await bodyStatus(res)).toBe("invalid_preset");
  });

  it("admits an sk_live key onto the generic goal path (END_GOAL row 1)", async () => {
    const { plaintext } = await mintSkLiveKey(
      env.DB,
      apiKeyHmacSecret(env),
      "user_sk_generic",
      null,
    );
    // An over-cap goal is rejected AFTER auth but BEFORE the LLM or Neon, so
    // `goal_too_long` (not 403) proves the sk_live principal was admitted.
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: { ...JSON_HEADERS, authorization: `Bearer ${plaintext}` },
      body: JSON.stringify({ goal: "a table of orders ".repeat(200) }),
    });
    expect(res.status).toBe(400);
    expect(await bodyStatus(res)).toBe("goal_too_long");
  });

  it("429s a valid create once the key's per-account bucket is spent (SK-HDC-008)", async () => {
    const { id, plaintext } = await mintSkLiveKey(
      env.DB,
      apiKeyHmacSecret(env),
      "user_sk_ratelimited",
      null,
    );
    // Pre-fill this key's current window to the /v1/ask cap (60/min).
    const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;
    await env.DB.prepare(
      "INSERT INTO rate_limit_buckets (bucket_key, window_start, count) VALUES (?, ?, 60)",
    )
      .bind(`rl:${id}`, windowStart)
      .run();
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: { ...JSON_HEADERS, authorization: `Bearer ${plaintext}` },
      body: JSON.stringify({ goal: "a table of orders" }),
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).not.toBeNull();
    expect(await bodyStatus(res)).toBe("rate_limited");
  });
});
