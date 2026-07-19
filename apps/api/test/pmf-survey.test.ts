// Sean-Ellis Q1 PMF survey (SK-GTM-006) — three seams under test:
//   1. The eligibility predicate: ≥ 2 first-10 successes across owned
//      DBs AND most recent activity ≥ 24 h old; answered-ever wins.
//   2. The write: one row per account (`user_id` PK dedup), usage
//      context (query_count / days_since_first) snapshotted at answer.
//   3. The auth gate: both routes are session-only (premium-interest
//      pattern) — anon / sk_live bearers never reach survey state.

import { env, SELF } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { computeGtmMetrics } from "../src/admin/gtm-metrics.ts";
import {
  getPmfSurveyStatus,
  parseSeanEllisResponse,
  recordPmfSurveyResponse,
} from "../src/pmf-survey.ts";

const base = "https://example.com/v1/pmf-survey";
const DAY = 86_400;
const NOW = 1_800_000_000;

afterEach(async () => {
  await env.DB.prepare("DELETE FROM pmf_survey").run();
  await env.DB.prepare("DELETE FROM databases").run();
});

async function seedDb(
  id: string,
  tenantId: string,
  { ok = 0, asks = 0, last = null as number | null, created = NOW - 10 * DAY } = {},
) {
  await env.DB.prepare(
    "INSERT INTO databases (id, tenant_id, engine, connection_secret_ref, first10_asks, first10_ok, last_queried_at, created_at) VALUES (?, ?, 'postgres', 'ref', ?, ?, ?, ?)",
  )
    .bind(id, tenantId, asks, ok, last, created)
    .run();
}

describe("parseSeanEllisResponse", () => {
  it("accepts exactly the four canonical keys", () => {
    for (const v of ["very_disappointed", "somewhat_disappointed", "not_disappointed", "na"]) {
      expect(parseSeanEllisResponse(v)).toBe(v);
    }
    expect(parseSeanEllisResponse("VERY_DISAPPOINTED")).toBeNull();
    expect(parseSeanEllisResponse("")).toBeNull();
    expect(parseSeanEllisResponse(3)).toBeNull();
    expect(parseSeanEllisResponse(undefined)).toBeNull();
  });
});

describe("getPmfSurveyStatus — eligibility predicate", () => {
  it("is eligible with ≥2 successes and last activity ≥24h old", async () => {
    await seedDb("d1", "u1", { ok: 2, asks: 3, last: NOW - DAY - 60 });
    expect(await getPmfSurveyStatus(env.DB, "u1", NOW)).toEqual({
      answered: false,
      eligible: true,
    });
  });

  it("is not eligible below 2 successes", async () => {
    await seedDb("d1", "u1", { ok: 1, asks: 5, last: NOW - 2 * DAY });
    expect((await getPmfSurveyStatus(env.DB, "u1", NOW)).eligible).toBe(false);
  });

  it("is not eligible on day one (last activity <24h ago)", async () => {
    await seedDb("d1", "u1", { ok: 5, asks: 6, last: NOW - DAY + 60 });
    expect((await getPmfSurveyStatus(env.DB, "u1", NOW)).eligible).toBe(false);
  });

  it("sums successes across the account's DBs", async () => {
    await seedDb("d1", "u1", { ok: 1, asks: 1, last: NOW - 3 * DAY });
    await seedDb("d2", "u1", { ok: 1, asks: 2, last: NOW - 2 * DAY });
    expect((await getPmfSurveyStatus(env.DB, "u1", NOW)).eligible).toBe(true);
  });

  it("never re-asks: answered wins over eligibility", async () => {
    await seedDb("d1", "u1", { ok: 4, asks: 6, last: NOW - 2 * DAY });
    await recordPmfSurveyResponse(env.DB, "u1", "a@x.com", "very_disappointed", NOW);
    expect(await getPmfSurveyStatus(env.DB, "u1", NOW)).toEqual({
      answered: true,
      eligible: false,
    });
  });

  it("a user with no DBs is not eligible", async () => {
    expect((await getPmfSurveyStatus(env.DB, "u1", NOW)).eligible).toBe(false);
  });
});

describe("recordPmfSurveyResponse — one row per account + context snapshot", () => {
  it("first insert reports firstTime and stores the usage context", async () => {
    await seedDb("d1", "u1", { ok: 3, asks: 7, last: NOW - 2 * DAY, created: NOW - 9 * DAY });
    const res = await recordPmfSurveyResponse(env.DB, "u1", "a@x.com", "somewhat_disappointed", NOW);
    expect(res).toEqual({ firstTime: true });

    const row = await env.DB.prepare(
      "SELECT email, response, query_count, days_since_first FROM pmf_survey WHERE user_id = 'u1'",
    ).first<{ email: string; response: string; query_count: number; days_since_first: number }>();
    expect(row).toEqual({
      email: "a@x.com",
      response: "somewhat_disappointed",
      query_count: 7,
      days_since_first: 9,
    });
  });

  it("a repeat answer is deduped — the first response is immutable", async () => {
    await recordPmfSurveyResponse(env.DB, "u1", null, "not_disappointed", NOW);
    const again = await recordPmfSurveyResponse(env.DB, "u1", null, "very_disappointed", NOW);
    expect(again).toEqual({ firstTime: false });
    const row = await env.DB.prepare(
      "SELECT response FROM pmf_survey WHERE user_id = 'u1'",
    ).first<{ response: string }>();
    expect(row?.response).toBe("not_disappointed");
  });
});

describe("computeGtmMetrics — SK-GTM-006 seanEllis read", () => {
  it("counts responses and computes the very-disappointed share excluding na", async () => {
    await recordPmfSurveyResponse(env.DB, "u1", null, "very_disappointed", NOW);
    await recordPmfSurveyResponse(env.DB, "u2", null, "not_disappointed", NOW);
    await recordPmfSurveyResponse(env.DB, "u3", null, "na", NOW);
    const metrics = await computeGtmMetrics(env.DB);
    expect(metrics.pmf.seanEllis.responses).toBe(3);
    expect(metrics.pmf.seanEllis.byResponse["very_disappointed"]).toBe(1);
    expect(metrics.pmf.seanEllis.veryDisappointedShare).toBe(0.5);
  });

  it("share is null with no scored responses", async () => {
    const metrics = await computeGtmMetrics(env.DB);
    expect(metrics.pmf.seanEllis.responses).toBe(0);
    expect(metrics.pmf.seanEllis.veryDisappointedShare).toBeNull();
  });
});

describe("/v1/pmf-survey — auth gate", () => {
  it("GET and POST return 401 without a session", async () => {
    expect((await SELF.fetch(base)).status).toBe(401);
    expect((await SELF.fetch(base, { method: "POST" })).status).toBe(401);
  });

  it("rejects an anon bearer (a survey answer is an account opinion)", async () => {
    const res = await SELF.fetch(base, {
      method: "POST",
      headers: { authorization: "Bearer anon_abcdef0123456789" },
      body: JSON.stringify({ response: "na" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an sk_live bearer", async () => {
    const res = await SELF.fetch(base, {
      headers: { authorization: "Bearer sk_live_abcdef0123456789" },
    });
    expect(res.status).toBe(401);
  });
});
