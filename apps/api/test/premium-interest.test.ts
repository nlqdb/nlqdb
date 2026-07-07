// `POST /v1/premium/interest` — auth-gate behaviour for the "Count me in"
// hosted-premium interest capture (SK-PREMIUM-013's subscribe door).
// Mirrors `byollm-endpoints.test.ts`: SELF.fetch proves the route is
// session-only, so "whoever clicked" is always a real account identity —
// never an anon or `sk_*` bearer.

import { env, SELF } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { recordPremiumInterest } from "../src/premium-interest.ts";

const base = "https://example.com/v1/premium/interest";

afterEach(async () => {
  await env.DB.prepare("DELETE FROM premium_interest").run();
});

describe("recordPremiumInterest — dedup by account", () => {
  it("first insert reports firstTime; a repeat is deduped and stores no new row", async () => {
    const first = await recordPremiumInterest(env.DB, "u1", "a@example.com");
    expect(first).toEqual({ firstTime: true });

    const again = await recordPremiumInterest(env.DB, "u1", "a@example.com");
    expect(again).toEqual({ firstTime: false });

    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM premium_interest WHERE user_id = 'u1'",
    ).first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it("persists the account email and a null email when the session has none", async () => {
    await recordPremiumInterest(env.DB, "u2", "b@example.com");
    await recordPremiumInterest(env.DB, "u3", null);

    const rows = await env.DB.prepare(
      "SELECT user_id, email FROM premium_interest ORDER BY user_id",
    ).all<{ user_id: string; email: string | null }>();
    expect(rows.results).toEqual([
      { user_id: "u2", email: "b@example.com" },
      { user_id: "u3", email: null },
    ]);
  });
});

describe("/v1/premium/interest — auth gate", () => {
  it("POST returns 401 without a session", async () => {
    const res = await SELF.fetch(base, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects an anon bearer (interest must carry an account identity)", async () => {
    const res = await SELF.fetch(base, {
      method: "POST",
      headers: { authorization: "Bearer anon_abcdef0123456789" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an sk_live bearer (no notification from a leaked key)", async () => {
    const res = await SELF.fetch(base, {
      method: "POST",
      headers: { authorization: "Bearer sk_live_doesnotexist" },
    });
    expect(res.status).toBe(401);
  });
});
