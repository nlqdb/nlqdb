// SK-GTM-001 / SK-GTM-003 — the canonical owner of every GTM/PMF
// metric definition (GLOBAL-038). All numbers are computed from the
// control-plane D1; the population split (real strangers vs
// founder/test accounts) is part of each metric, so a metric that
// "doesn't name its population" can't exist here. Do NOT re-derive
// this SQL elsewhere (scorecard pulls, loop prompts) — read
// `GET /v1/admin/metrics` instead.
//
// Timestamp units are normalized in this module and nowhere else:
//   user.createdAt          TEXT ISO-8601 (Better Auth)
//   databases.*             INTEGER unixepoch seconds
//   anon_adoptions.*        INTEGER unixepoch seconds
//   chat_message.created_at INTEGER milliseconds (Date.now())

// Founder/test account patterns — the scorecard row #2 exclusion list,
// previously re-typed by hand on every /daily pull. `lower(email)` is
// applied in SQL so casing in the stored row can't leak an internal
// account into the stranger count.
const INTERNAL_EMAIL_SQL = `(
  lower(u.email) = 'omer@salfati.group'
  OR lower(u.email) LIKE 'omer.hochman@%'
  OR lower(u.email) LIKE '%@nlqdb.com'
  OR lower(u.email) LIKE '%@example.com'
  OR lower(u.email) LIKE '%@preview.dev'
)`;

const DAY_SECONDS = 86_400;
const RETENTION_WINDOW_DAYS = 7;
// Below this many activated strangers a Sean-Ellis "very disappointed"
// survey is noise, not signal (founder-playbook §2 runs it manually).
const SEAN_ELLIS_MIN_ACTIVATED = 10;

export type GtmMetrics = {
  generatedAt: string;
  users: {
    total: number;
    strangers: number;
    internal: number;
    newestSignupAt: string | null;
    newestStrangerSignupAt: string | null;
    signupsByDay: Array<{ day: string; total: number; strangers: number }>;
  };
  funnel: {
    anonDbsTotal: number;
    dbsTotal: number;
    dbsCreated7d: number;
    adoptionsTotal: number;
    adoptions7d: number;
    /** anon DB → adopted-into-account share, all-time. */
    adoptionRate: number | null;
  };
  activation: {
    /** DBs that received ≥ 1 routed /v1/ask (first10_asks > 0). */
    dbsStarted: number;
    /** DBs with ≥ 1 successful answer in their first 10 asks. */
    dbsActivated: number;
    /** DBs with ≥ 2 asks — the scorecard row #5 session-retention unit. */
    dbsWithSecondAsk: number;
    /** SK-ONBOARD-006's canonical KPI: SUM(first10_ok)/SUM(first10_asks). */
    first10SuccessRate: number | null;
    /** Real strangers owning ≥ 1 DB. */
    strangersWithDb: number;
    /** Real strangers with ≥ 1 successful answer — the GTM north-star. */
    activatedStrangers: number;
  };
  retention: {
    dbsActive7d: number;
    dbsActive30d: number;
    /** Real strangers with any activity in the last 7 days. */
    strangersActive7d: number;
    /** Real strangers whose latest activity is ≥ 7 days after signup. */
    strangersRetained7d: number;
  };
  pmf: {
    premiumInterest: number;
    payingCustomers: number;
    customersByStatus: Record<string, number>;
    seanEllis: {
      runnable: boolean;
      activatedStrangers: number;
      minActivated: number;
    };
  };
  /** Daily headline history (SK-GTM-003), newest first, ≤ 90 rows. */
  trend: Array<{ day: string; [key: string]: unknown }>;
};

type CountsRow = Record<string, number | string | null>;

function num(row: CountsRow | null | undefined, key: string): number {
  const v = row?.[key];
  return typeof v === "number" ? v : 0;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export async function computeGtmMetrics(
  db: D1Database,
  now: Date = new Date(),
): Promise<GtmMetrics> {
  const nowSec = Math.floor(now.getTime() / 1000);
  const cut7d = nowSec - 7 * DAY_SECONDS;
  const cut30d = nowSec - 30 * DAY_SECONDS;
  // 28 calendar days including today, as 'YYYY-MM-DD' for the TEXT
  // ISO-8601 `user.createdAt` (date-prefix comparison — lexicographic
  // compare against datetime() output would break on the 'T').
  const day28 = new Date(now.getTime() - 27 * DAY_SECONDS * 1000).toISOString().slice(0, 10);

  const [
    userCounts,
    signupDays,
    dbCounts,
    first10,
    strangerDbs,
    adoptions,
    strangerActivity,
    premium,
    customers,
    snapshots,
  ] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN ${INTERNAL_EMAIL_SQL} THEN 1 ELSE 0 END) AS internal,
        MAX(u.createdAt) AS newestAt,
        MAX(CASE WHEN NOT ${INTERNAL_EMAIL_SQL} THEN u.createdAt END) AS newestStrangerAt
      FROM user u`),
    db
      .prepare(`SELECT substr(u.createdAt, 1, 10) AS day, COUNT(*) AS total,
        SUM(CASE WHEN NOT ${INTERNAL_EMAIL_SQL} THEN 1 ELSE 0 END) AS strangers
      FROM user u WHERE substr(u.createdAt, 1, 10) >= ?
      GROUP BY day ORDER BY day`)
      .bind(day28),
    db
      .prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN tenant_id LIKE 'anon:%' THEN 1 ELSE 0 END) AS anon,
        SUM(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END) AS created7d,
        SUM(CASE WHEN last_queried_at >= ?1 THEN 1 ELSE 0 END) AS active7d,
        SUM(CASE WHEN last_queried_at >= ?2 THEN 1 ELSE 0 END) AS active30d
      FROM databases`)
      .bind(cut7d, cut30d),
    db.prepare(`SELECT COUNT(*) AS started,
        SUM(CASE WHEN first10_ok > 0 THEN 1 ELSE 0 END) AS activated,
        SUM(CASE WHEN first10_asks >= 2 THEN 1 ELSE 0 END) AS secondAsk,
        SUM(first10_asks) AS asks, SUM(first10_ok) AS ok
      FROM databases WHERE first10_asks > 0`),
    db.prepare(`SELECT COUNT(DISTINCT u.id) AS withDb,
        COUNT(DISTINCT CASE WHEN d.first10_ok > 0 THEN u.id END) AS activated
      FROM user u JOIN databases d ON d.tenant_id = u.id
      WHERE NOT ${INTERNAL_EMAIL_SQL}`),
    db
      .prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS last7d
      FROM anon_adoptions`)
      .bind(cut7d),
    // Per-stranger latest activity across owned DBs (seconds) and chat
    // (milliseconds); the 7-day retention/active math runs in TS below
    // where the unit conversion is explicit.
    db.prepare(`SELECT u.createdAt AS signupAt,
        (SELECT MAX(d.last_queried_at) FROM databases d WHERE d.tenant_id = u.id) AS lastDbSec,
        (SELECT MAX(m.created_at) FROM chat_message m WHERE m.user_id = u.id) AS lastChatMs
      FROM user u WHERE NOT ${INTERNAL_EMAIL_SQL}`),
    db.prepare(`SELECT COUNT(*) AS n FROM premium_interest`),
    db.prepare(`SELECT status, COUNT(*) AS n FROM customers GROUP BY status`),
    db.prepare(`SELECT day, metrics_json FROM gtm_snapshots ORDER BY day DESC LIMIT 90`),
  ]);

  const uc = (userCounts?.results?.[0] ?? null) as CountsRow | null;
  const dc = (dbCounts?.results?.[0] ?? null) as CountsRow | null;
  const f10 = (first10?.results?.[0] ?? null) as CountsRow | null;
  const sdb = (strangerDbs?.results?.[0] ?? null) as CountsRow | null;
  const ad = (adoptions?.results?.[0] ?? null) as CountsRow | null;
  const pi = (premium?.results?.[0] ?? null) as CountsRow | null;

  let strangersActive7d = 0;
  let strangersRetained7d = 0;
  for (const raw of (strangerActivity?.results ?? []) as CountsRow[]) {
    const signupMs = Date.parse(String(raw["signupAt"] ?? ""));
    const lastDbSec = typeof raw["lastDbSec"] === "number" ? raw["lastDbSec"] : 0;
    const lastChatMs = typeof raw["lastChatMs"] === "number" ? raw["lastChatMs"] : 0;
    const lastActivitySec = Math.max(lastDbSec, Math.floor(lastChatMs / 1000));
    if (lastActivitySec <= 0) continue;
    if (lastActivitySec >= cut7d) strangersActive7d += 1;
    if (
      Number.isFinite(signupMs) &&
      lastActivitySec - Math.floor(signupMs / 1000) >= RETENTION_WINDOW_DAYS * DAY_SECONDS
    ) {
      strangersRetained7d += 1;
    }
  }

  const customersByStatus: Record<string, number> = {};
  for (const raw of (customers?.results ?? []) as CountsRow[]) {
    customersByStatus[String(raw["status"])] = num(raw, "n");
  }
  const payingCustomers = (customersByStatus["active"] ?? 0) + (customersByStatus["trialing"] ?? 0);

  const activatedStrangers = num(sdb, "activated");
  const total = num(uc, "total");
  const internal = num(uc, "internal");

  const trend: GtmMetrics["trend"] = [];
  for (const raw of (snapshots?.results ?? []) as CountsRow[]) {
    try {
      trend.push({
        ...(JSON.parse(String(raw["metrics_json"])) as Record<string, unknown>),
        day: String(raw["day"]),
      });
    } catch {
      // A malformed historical row must never take the endpoint down.
      trend.push({ day: String(raw["day"]) });
    }
  }

  return {
    generatedAt: now.toISOString(),
    users: {
      total,
      strangers: total - internal,
      internal,
      newestSignupAt: (uc?.["newestAt"] as string | null) ?? null,
      newestStrangerSignupAt: (uc?.["newestStrangerAt"] as string | null) ?? null,
      signupsByDay: ((signupDays?.results ?? []) as CountsRow[]).map((r) => ({
        day: String(r["day"]),
        total: num(r, "total"),
        strangers: num(r, "strangers"),
      })),
    },
    funnel: {
      anonDbsTotal: num(dc, "anon"),
      dbsTotal: num(dc, "total"),
      dbsCreated7d: num(dc, "created7d"),
      adoptionsTotal: num(ad, "total"),
      adoptions7d: num(ad, "last7d"),
      adoptionRate: ratio(num(ad, "total"), num(dc, "anon")),
    },
    activation: {
      dbsStarted: num(f10, "started"),
      dbsActivated: num(f10, "activated"),
      dbsWithSecondAsk: num(f10, "secondAsk"),
      first10SuccessRate: ratio(num(f10, "ok"), num(f10, "asks")),
      strangersWithDb: num(sdb, "withDb"),
      activatedStrangers,
    },
    retention: {
      dbsActive7d: num(dc, "active7d"),
      dbsActive30d: num(dc, "active30d"),
      strangersActive7d,
      strangersRetained7d,
    },
    pmf: {
      premiumInterest: num(pi, "n"),
      payingCustomers,
      customersByStatus,
      seanEllis: {
        runnable: activatedStrangers >= SEAN_ELLIS_MIN_ACTIVATED,
        activatedStrangers,
        minActivated: SEAN_ELLIS_MIN_ACTIVATED,
      },
    },
    trend,
  };
}

// SK-GTM-003 — idempotent per-UTC-day headline snapshot. INSERT OR
// IGNORE means both writers (daily cron + authorized dashboard reads)
// are race-safe; the first write of a day wins and rows are never
// updated. Keys are additive-only.
export async function writeGtmSnapshot(db: D1Database, metrics: GtmMetrics): Promise<void> {
  const day = metrics.generatedAt.slice(0, 10);
  const headline = {
    usersTotal: metrics.users.total,
    strangers: metrics.users.strangers,
    anonDbsTotal: metrics.funnel.anonDbsTotal,
    dbsTotal: metrics.funnel.dbsTotal,
    adoptionsTotal: metrics.funnel.adoptionsTotal,
    dbsActivated: metrics.activation.dbsActivated,
    activatedStrangers: metrics.activation.activatedStrangers,
    strangersRetained7d: metrics.retention.strangersRetained7d,
    dbsActive7d: metrics.retention.dbsActive7d,
    first10SuccessRate: metrics.activation.first10SuccessRate,
    premiumInterest: metrics.pmf.premiumInterest,
    payingCustomers: metrics.pmf.payingCustomers,
  };
  await db
    .prepare(`INSERT OR IGNORE INTO gtm_snapshots (day, metrics_json) VALUES (?, ?)`)
    .bind(day, JSON.stringify(headline))
    .run();
}

// Cron entrypoint (SK-GTM-003): compute-then-write, one call from the
// daily `scheduled()` branch. Kept separate so the cron doesn't build
// the full trend payload response shape for no reader.
export async function writeDailyGtmSnapshot(db: D1Database): Promise<void> {
  const metrics = await computeGtmMetrics(db);
  await writeGtmSnapshot(db, metrics);
}
