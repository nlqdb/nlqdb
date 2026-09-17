import { env, SELF } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { recordPivotInterest } from "../src/pivot-interest.ts";

const base = "https://example.com/v1/pivot/interest";

afterEach(async () => {
  await env.DB.prepare("DELETE FROM pivot_interest").run();
});

describe("recordPivotInterest", () => {
  it("normalizes and deduplicates email addresses", async () => {
    const input = {
      email: " Maya@Example.com ",
      source: "home",
      userId: null,
      clientIp: "198.51.100.1",
    };
    expect((await recordPivotInterest(env.DB, env.KV, input)).status).toBe(200);
    expect(
      (
        await recordPivotInterest(env.DB, env.KV, {
          ...input,
          email: "maya@example.com",
        })
      ).status,
    ).toBe(200);

    const rows = await env.DB.prepare(
      "SELECT email, source, COUNT(*) AS n FROM pivot_interest",
    ).all<{ email: string; source: string; n: number }>();
    expect(rows.results).toEqual([{ email: "maya@example.com", source: "home", n: 1 }]);
  });

  it("enriches an anonymous signup with the account id on a later signed-in submit", async () => {
    await recordPivotInterest(env.DB, env.KV, {
      email: "maya@example.com",
      source: "home",
      userId: null,
      clientIp: "198.51.100.2",
    });
    await recordPivotInterest(env.DB, env.KV, {
      email: "maya@example.com",
      source: "app",
      userId: "u_maya",
      clientIp: "198.51.100.2",
    });

    const row = await env.DB.prepare(
      "SELECT user_id, source FROM pivot_interest WHERE email = 'maya@example.com'",
    ).first<{ user_id: string; source: string }>();
    expect(row).toEqual({ user_id: "u_maya", source: "home" });
  });

  it("rejects invalid email and source values", async () => {
    const common = { userId: null, clientIp: "198.51.100.3" };
    expect(
      await recordPivotInterest(env.DB, env.KV, {
        ...common,
        email: "not-an-email",
        source: "home",
      }),
    ).toEqual({ status: 400, reason: "invalid_email" });
    expect(
      await recordPivotInterest(env.DB, env.KV, {
        ...common,
        email: "maya@example.com",
        source: "other",
      }),
    ).toEqual({ status: 400, reason: "invalid_source" });
  });
});

describe("POST /v1/pivot/interest", () => {
  it("accepts an anonymous email and returns a privacy-neutral response", async () => {
    const res = await SELF.fetch(base, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "198.51.100.4",
      },
      body: JSON.stringify({ email: "reader@example.com", source: "home" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  it("rejects a missing email without storing a row", async () => {
    const res = await SELF.fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "home" }),
    });
    expect(res.status).toBe(400);
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM pivot_interest").first<{
      n: number;
    }>();
    expect(count?.n).toBe(0);
  });
});
