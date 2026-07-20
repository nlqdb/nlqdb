// `GET /v1/admin/metrics` — the GLOBAL-038 founder GTM/PMF read.
// Three seams under test:
//   1. The auth gate: session-only (401 for no session / anon / sk_live
//      bearers), 403 for a signed-in non-admin email, 200 only for the
//      SK-GTM-002 allowlist+domain match. Sessions are minted through
//      the real magic-link flow (magic-link.test.ts pattern) because
//      worker-module mocking is broken under vitest-pool-workers.
//   2. computeGtmMetrics: the SK-GTM-001 definitions against seeded D1
//      rows, including the internal-vs-stranger population split.
//   3. writeGtmSnapshot: SK-GTM-003 idempotency (one row per UTC day;
//      first write wins).

import { env, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeGtmMetrics, writeGtmSnapshot } from "../src/admin/gtm-metrics.ts";

const ORIGIN = "https://example.com";
const base = `${ORIGIN}/v1/admin/metrics`;

const DAY = 86_400;

// Storage is shared across tests within this file (single worker), so
// every test starts from a wiped control plane. Children before
// parents — several tables FK-reference user(id).
beforeEach(async () => {
  for (const table of [
    "anon_adoptions",
    "chat_message",
    "customers",
    "premium_interest",
    "gtm_snapshots",
    "databases",
    "user",
  ]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

async function seedUser(id: string, email: string, createdAtIso: string) {
  await env.DB.prepare(
    "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)",
  )
    .bind(id, id, email, createdAtIso, createdAtIso)
    .run();
}

async function seedDb(
  id: string,
  tenantId: string,
  opts: {
    asks?: number;
    ok?: number;
    lastQueriedAt?: number | null;
    synthetic?: boolean;
  } = {},
) {
  await env.DB.prepare(
    "INSERT INTO databases (id, tenant_id, engine, connection_secret_ref, first10_asks, first10_ok, last_queried_at, synthetic) VALUES (?, ?, 'postgres', 'ref', ?, ?, ?, ?)",
  )
    .bind(
      id,
      tenantId,
      opts.asks ?? 0,
      opts.ok ?? 0,
      opts.lastQueriedAt ?? null,
      opts.synthetic ? 1 : 0,
    )
    .run();
}

describe("computeGtmMetrics — SK-GTM-001 definitions", () => {
  it("splits strangers from internal accounts and computes the funnel", async () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const nowSec = Math.floor(now.getTime() / 1000);

    // Internal accounts: founder + company domain + test domain.
    await seedUser("u_founder", "omer@salfati.group", "2026-06-01T00:00:00.000Z");
    await seedUser("u_team", "dev@nlqdb.com", "2026-06-02T00:00:00.000Z");
    await seedUser("u_test", "e2e@example.com", "2026-06-03T00:00:00.000Z");
    // Strangers: one activated + retained, one signed-up-never-queried.
    await seedUser("u_s1", "maya@builders.io", "2026-07-01T00:00:00.000Z");
    await seedUser("u_s2", "aarav@startup.dev", "2026-07-18T00:00:00.000Z");

    // Stranger 1: activated (first10_ok > 0), active now (retained —
    // last activity is ≥ 7 days after the 07-01 signup).
    await seedDb("db_s1", "u_s1", { asks: 6, ok: 5, lastQueriedAt: nowSec - DAY });
    // Founder DB: activated but internal — must not count as stranger.
    await seedDb("db_f1", "u_founder", { asks: 10, ok: 9, lastQueriedAt: nowSec - 40 * DAY });
    // Anonymous DBs: db_a1 was adopted by u_s1 — adoption re-tenants the
    // row off `anon:%` (SK-ANON-003), so it is NO LONGER an anon DB; only
    // db_a2 remains anonymous. The anon_adoptions row is the permanent
    // record of the adoption.
    await seedDb("db_a1", "u_s1", { asks: 1, ok: 1, lastQueriedAt: nowSec - 2 * DAY });
    await seedDb("db_a2", "anon:bbbb000011112222");
    // SK-GTM-005 — one walker device with two synthetic DBs: the device
    // and its rows must be excludable from the organic anon counts.
    await seedDb("db_w1", "anon:cccc000011112222", { synthetic: true });
    await seedDb("db_w2", "anon:cccc000011112222", { synthetic: true });
    await env.DB.prepare(
      "INSERT INTO anon_adoptions (token, user_id, database_id, created_at) VALUES ('tok1', 'u_s1', 'db_a1', ?)",
    )
      .bind(nowSec - 3 * DAY)
      .run();
    // An old founder adoption — internal, so it must count in
    // adoptionsTotal but never in adoptionsReal (SK-GTM-005).
    await env.DB.prepare(
      "INSERT INTO anon_adoptions (token, user_id, database_id, created_at) VALUES ('tok2', 'u_founder', 'db_f1', ?)",
    )
      .bind(nowSec - 30 * DAY)
      .run();

    await env.DB.prepare(
      "INSERT INTO premium_interest (user_id, email) VALUES ('u_s1', 'maya@builders.io')",
    ).run();
    await env.DB.prepare(
      "INSERT INTO customers (user_id, stripe_customer_id, status) VALUES ('u_s1', 'cus_1', 'active')",
    ).run();

    const m = await computeGtmMetrics(env.DB, now);

    expect(m.users.total).toBe(5);
    expect(m.users.internal).toBe(3);
    expect(m.users.strangers).toBe(2);
    expect(m.users.newestStrangerSignupAt).toBe("2026-07-18T00:00:00.000Z");
    // Both strangers signed up inside the 28-day window; one day each.
    const strangerSignups = m.users.signupsByDay.reduce((n, d) => n + d.strangers, 0);
    expect(strangerSignups).toBe(2);

    expect(m.funnel.dbsTotal).toBe(6);
    // db_a2 + the two walker DBs are anonymous — db_a1 was re-tenanted
    // on adoption.
    expect(m.funnel.anonDbsTotal).toBe(3);
    expect(m.funnel.anonDbsSynthetic).toBe(2);
    expect(m.funnel.adoptionsTotal).toBe(2);
    expect(m.funnel.adoptions7d).toBe(1);
    // adopted / (live anon + adopted) = 2 / (3 + 2); bounded [0,1].
    expect(m.funnel.adoptionRate).toBeCloseTo(0.4);
    // The adopter (u_s1) is a real stranger; robot-free rate uses the
    // organic anon base: 1 / (1 organic + 1 adopted).
    expect(m.funnel.adoptionsReal).toBe(1);
    expect(m.funnel.adoptionRateReal).toBeCloseTo(0.5);

    // SK-GTM-005 uniques: 2 stranger accounts; 2 anon devices (bbbb
    // organic, cccc walker-synthetic).
    expect(m.uniques).toEqual({
      realUsers: 2,
      anonDevices: 2,
      anonDevicesSynthetic: 1,
      anonDevicesOrganic: 1,
    });

    expect(m.activation.dbsStarted).toBe(3);
    expect(m.activation.dbsActivated).toBe(3);
    expect(m.activation.dbsWithSecondAsk).toBe(2);
    // (5 + 9 + 1) ok / (6 + 10 + 1) asks
    expect(m.activation.first10SuccessRate).toBeCloseTo(15 / 17);
    expect(m.activation.strangersWithDb).toBe(1);
    expect(m.activation.activatedStrangers).toBe(1);

    expect(m.retention.dbsActive7d).toBe(2);
    expect(m.retention.dbsActive30d).toBe(2);
    expect(m.retention.strangersActive7d).toBe(1);
    expect(m.retention.strangersRetained7d).toBe(1);

    expect(m.pmf.premiumInterest).toBe(1);
    expect(m.pmf.payingCustomers).toBe(1);
    expect(m.pmf.customersByStatus).toEqual({ active: 1 });
    expect(m.pmf.seanEllis.runnable).toBe(false);
    expect(m.pmf.seanEllis.activatedStrangers).toBe(1);
  });

  it("returns zeroes/nulls on an empty control plane (no division blowups)", async () => {
    const m = await computeGtmMetrics(env.DB);
    expect(m.users.total).toBe(0);
    expect(m.funnel.adoptionRate).toBeNull();
    expect(m.funnel.adoptionRateReal).toBeNull();
    expect(m.activation.first10SuccessRate).toBeNull();
    expect(m.retention.strangersRetained7d).toBe(0);
    expect(m.uniques).toEqual({
      realUsers: 0,
      anonDevices: 0,
      anonDevicesSynthetic: 0,
      anonDevicesOrganic: 0,
    });
    expect(m.trend).toEqual([]);
  });
});

describe("writeGtmSnapshot — SK-GTM-003 idempotency", () => {
  it("writes one row per UTC day; the first write wins; trend reads it back", async () => {
    const now = new Date("2026-07-19T04:00:00Z");
    const first = await computeGtmMetrics(env.DB, now);
    await writeGtmSnapshot(env.DB, first);

    await seedUser("u_late", "late@stranger.net", "2026-07-19T05:00:00.000Z");
    const second = await computeGtmMetrics(env.DB, new Date("2026-07-19T06:00:00Z"));
    await writeGtmSnapshot(env.DB, second);

    const rows = await env.DB.prepare("SELECT day, metrics_json FROM gtm_snapshots").all<{
      day: string;
      metrics_json: string;
    }>();
    expect(rows.results.length).toBe(1);
    expect(rows.results[0]?.day).toBe("2026-07-19");
    // First write won — the later user is not in the stored row.
    expect(JSON.parse(rows.results[0]?.metrics_json ?? "{}").usersTotal).toBe(0);

    const withTrend = await computeGtmMetrics(env.DB, new Date("2026-07-20T00:00:00Z"));
    expect(withTrend.trend.length).toBe(1);
    expect(withTrend.trend[0]?.day).toBe("2026-07-19");
  });
});

describe("/v1/admin/metrics — SK-GTM-002 auth gate", () => {
  it("returns 401 without a session", async () => {
    const res = await SELF.fetch(base);
    expect(res.status).toBe(401);
  });

  it("rejects an anon bearer (admin data never rides a bearer)", async () => {
    const res = await SELF.fetch(base, {
      headers: { authorization: "Bearer anon_abcdef0123456789" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an sk_live bearer (a leaked key must not expose metrics)", async () => {
    const res = await SELF.fetch(base, {
      headers: { authorization: "Bearer sk_live_doesnotexist" },
    });
    expect(res.status).toBe(401);
  });

  describe("with real sessions (magic-link mint)", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let logs: string[];

    beforeEach(() => {
      logs = [];
      logSpy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
        logs.push(args.map((a) => String(a)).join(" "));
      });
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    async function sessionCookieFor(email: string): Promise<string> {
      logs.length = 0;
      const sendRes = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/magic-link`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ email, callbackURL: `${ORIGIN}/app` }),
      });
      expect(sendRes.status).toBe(200);
      const joined = logs.join("\n");
      const wrapped = joined.match(/https?:\/\/[^\s"]+\/auth\/continue\?next=([^\s"]+)/);
      if (!wrapped?.[1]) throw new Error(`no magic-link URL in logs:\n${joined}`);
      const verifyRes = await SELF.fetch(decodeURIComponent(wrapped[1]), {
        redirect: "manual",
      });
      const setCookie = verifyRes.headers.get("set-cookie");
      if (!setCookie) throw new Error("expected set-cookie on verify");
      const cookieFirst = setCookie.split(";")[0];
      if (!cookieFirst) throw new Error("expected cookie value");
      return cookieFirst;
    }

    it("403s a signed-in non-admin; 200s an @nlqdb.com session with the metric shape", async () => {
      const strangerCookie = await sessionCookieFor(`t-${crypto.randomUUID()}@example.com`);
      const forbidden = await SELF.fetch(base, { headers: { cookie: strangerCookie } });
      expect(forbidden.status).toBe(403);
      expect(await forbidden.json()).toEqual({ error: "forbidden" });

      const adminCookie = await sessionCookieFor(`ops-${crypto.randomUUID()}@nlqdb.com`);
      const ok = await SELF.fetch(base, { headers: { cookie: adminCookie } });
      expect(ok.status).toBe(200);
      const body = (await ok.json()) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual([
        "activation",
        "funnel",
        "generatedAt",
        "pmf",
        "retention",
        "trend",
        "uniques",
        "users",
      ]);
      // Both minted accounts are internal-pattern emails — the
      // stranger split must classify them as internal, not strangers.
      const users = body["users"] as { total: number; strangers: number };
      expect(users.total).toBe(2);
      expect(users.strangers).toBe(0);
    });
  });
});
