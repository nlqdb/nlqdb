// `POST /v1/databases` — the create auth boundary (SK-HDC-021).
//
// SK-PIVOT-010 (amended 2026-08-09) widened preset create from
// session-only to any account-scoped principal so nlqdb's own agents can
// provision their `agent_memory_v1` memory DB with an `sk_` key (the
// SK-PIVOT-016 dogfood gate). This file pins the four seams of that
// boundary via SELF.fetch against Miniflare's real D1:
//
//   - unauth               → 401 (requirePrincipal, before the handler)
//   - anon bearer          → 403 account_required (anon has no tenant —
//                            the SK-PIVOT-010 anon boundary is preserved
//                            for BOTH preset and generic create)
//   - sk_live / sk_mcp + preset → admitted past auth (proven by a
//                            post-auth, pre-provision `invalid_preset`
//                            400 — the full happy path would reach Neon,
//                            which this in-process test can't provision)
//   - sk_live + generic (no preset) → 403 create_requires_session (the
//                            LLM-inferred create stays the chat surface)

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { apiKeyHmacSecret, mintSkLiveKey, mintSkMcpKey } from "../src/api-keys.ts";

const URL = "https://example.com/v1/databases";
const JSON_HEADERS = { "content-type": "application/json" };

async function bodyStatus(res: Response): Promise<string | undefined> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code;
}

describe("POST /v1/databases — create auth boundary (SK-HDC-021)", () => {
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

  it("keeps generic (non-preset) create session-only — sk_live gets create_requires_session", async () => {
    const { plaintext } = await mintSkLiveKey(
      env.DB,
      apiKeyHmacSecret(env),
      "user_sk_generic",
      null,
    );
    const res = await SELF.fetch(URL, {
      method: "POST",
      headers: { ...JSON_HEADERS, authorization: `Bearer ${plaintext}` },
      body: JSON.stringify({ goal: "a table of orders" }),
    });
    expect(res.status).toBe(403);
    expect(await bodyStatus(res)).toBe("create_requires_session");
  });
});
