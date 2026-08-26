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

import { AGENT_MEMORY_V1_VERSION } from "../db-create/presets/agent-memory-v1.ts";

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

// SK-GTM-007 — one channel key per row: utm_source wins, else the
// external referrer host, else 'direct' (captured but unattributed).
// Rows with no source_json at all (pre-instrument, or created via
// CLI/SDK/MCP which don't capture) group as 'untracked' so instrument
// coverage is itself visible. utm_source values are canonical in
// docs/research/acquisition-channels.md.
const SOURCE_CHANNEL_SQL = (col: string) => `COALESCE(
  NULLIF(json_extract(${col}, '$.utm_source'), ''),
  NULLIF(json_extract(${col}, '$.ref'), ''),
  'direct'
)`;

// SK-GTM-008 — the ops memory workload lives on `agent_memory_v1` DBs,
// identified by the version-keyed id prefix the create path mints
// (`isAgentMemoryV1Db`, SK-HDC-020). Matched with `substr(...) = prefix`
// rather than LIKE so the prefix's own underscores can't act as
// single-char wildcards.
const MEMORY_DB_PREFIX = `db_${AGENT_MEMORY_V1_VERSION}_`;

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
    /**
     * Adopted / (live anon DBs + adopted) — bounded [0,1]. Adoption
     * re-tenants the row off `anon:%` and the sweep deletes abandoned
     * anon DBs, so neither is in `anonDbsTotal`; the true created-base
     * also includes swept-abandoned DBs D1 no longer holds, so this
     * slightly overstates the rate (caveat in FEATURE Open questions).
     */
    adoptionRate: number | null;
    /** Live anon DBs stamped `synthetic = 1` (SK-GTM-005 — walker/preview). */
    anonDbsSynthetic: number;
    /** Adoptions by real strangers (adopter email outside the internal set). */
    adoptionsReal: number;
    /**
     * Robot-free adoption rate: real-stranger adoptions /
     * (organic live anon DBs + real-stranger adoptions). Additive
     * sibling of `adoptionRate` (SK-GTM-001 — fields are never
     * repurposed); same swept-abandoned caveat applies.
     */
    adoptionRateReal: number | null;
  };
  /** Unique-people counts (SK-GTM-005) — the founder's headline ask. */
  uniques: {
    /** Unique real-stranger accounts (founder/test excluded; email is UNIQUE). */
    realUsers: number;
    /** Distinct anonymous devices (anon tenant ids) with a live DB. */
    anonDevices: number;
    /** …of which self-identified robots (any DB of the device synthetic). */
    anonDevicesSynthetic: number;
    /** anonDevices − anonDevicesSynthetic. Pre-0023 rows count as organic. */
    anonDevicesOrganic: number;
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
  acquisition: {
    /** DBs whose create captured a first touch (instrument coverage). */
    dbsWithSource: number;
    /** All DBs grouped by channel; 'untracked' = no source captured. */
    dbsBySource: Array<{ source: string; total: number; last7d: number }>;
    /** Real strangers by their earliest captured channel. */
    strangersBySource: Array<{ source: string; strangers: number }>;
    /**
     * SK-GTM-010 — all DBs grouped by the CREATING surface
     * (principal-derived: hero/chat/embed/cli/mcp); 'untracked' = created
     * before the instrument. Orthogonal to `dbsBySource` (channel): this
     * answers which client minted the DB, not which channel brought it.
     */
    dbsBySurface: Array<{ surface: string; total: number; last7d: number }>;
  };
  pmf: {
    premiumInterest: number;
    payingCustomers: number;
    customersByStatus: Record<string, number>;
    seanEllis: {
      runnable: boolean;
      activatedStrangers: number;
      minActivated: number;
      /** In-product Q1 responses recorded (SK-GTM-006), all-time. */
      responses: number;
      byResponse: Record<string, number>;
      /**
       * very_disappointed / (responses − na) — the canonical 40% PMF
       * read. Null until a non-na response exists; noise below
       * `minActivated` respondents (the `runnable` gate).
       */
      veryDisappointedShare: number | null;
    };
  };
  /**
   * SK-GTM-008 — the D1-answerable inputs of the `SK-PIVOT-016` dogfood
   * launch gate, plus the one non-D1 fact the client cannot read (the
   * serving Worker's `MEMORY_PRESET`). Criteria 3–5 have no D1 source at
   * all and are rendered static-with-as-of by the dashboard — nothing
   * here is estimated (GLOBAL-038).
   */
  launchGate: {
    /** `MEMORY_PRESET === "1"` in the Worker serving this request. */
    memoryPresetEnabled: boolean;
    /** `agent_memory_v1` DBs in the registry (any tenant). */
    memoryDbs: number;
    /** …owned by a founder/test account — where the ops workload runs. */
    memoryDbsInternal: number;
    /**
     * Asks/oks summed over memory DBs from the `SK-ONBOARD-006`
     * counters. `first10_asks` saturates at 10 per DB, so `asks` is a
     * LOWER BOUND on the workload's ask volume, never the total — and
     * D1 carries no per-ask surface attribution, so neither number can
     * isolate the public-MCP subset (criterion 1's gap, D-04 owns it).
     */
    memoryFirst10Asks: number;
    memoryFirst10Ok: number;
    /** Criterion 2's instrument: ok/asks over memory DBs; null at N = 0. */
    memoryFirst10SuccessRate: number | null;
    /** Newest activity across memory DBs (ISO), null if never queried. */
    memoryLastQueriedAt: string | null;
  };
  /**
   * SK-GTM-009 — the paying-customer watchlist: one row per `customers`
   * entry so the founder can watch each (early, rare) paying customer's
   * behavior individually. Per-user rows are safe here — the population
   * is bounded (LIMIT 50) and this is a D1 admin read, never an OTel
   * metric (SK-OBS-002/-006 keep user ids out of metric labels).
   */
  customers: Array<{
    email: string;
    /** Founder/test account (INTERNAL_EMAIL_SQL) — a test purchase must
        never masquerade as the first real customer. */
    internal: boolean;
    status: string;
    /** First transition into active/trialing (ISO); null for rows that
        never converted or predate migration 0027. */
    convertedAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    dbs: number;
    /** Lower bounds — the SK-ONBOARD-006 counters saturate at 10/DB. */
    first10Asks: number;
    first10Ok: number;
    /** Latest of any owned-DB query or chat turn (ISO); null if never active. */
    lastActivityAt: string | null;
  }>;
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
  /**
   * The serving Worker's `MEMORY_PRESET` flag — the only non-D1 input
   * (SK-GTM-008). The `GET /v1/admin/metrics` route passes the real
   * flag; the cron snapshot leaves the default because no snapshot key
   * records it, so the default can never be persisted as truth.
   */
  memoryPresetEnabled = false,
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
    dbsBySource,
    dbsBySurface,
    strangersBySource,
    first10,
    strangerDbs,
    adoptions,
    strangerActivity,
    premium,
    customers,
    surveyRows,
    snapshots,
    anonDevices,
    memoryDbs,
    customerRows,
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
        SUM(CASE WHEN tenant_id LIKE 'anon:%' AND synthetic = 1 THEN 1 ELSE 0 END) AS anonSynthetic,
        SUM(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END) AS created7d,
        SUM(CASE WHEN last_queried_at >= ?1 THEN 1 ELSE 0 END) AS active7d,
        SUM(CASE WHEN last_queried_at >= ?2 THEN 1 ELSE 0 END) AS active30d,
        SUM(CASE WHEN source_json IS NOT NULL THEN 1 ELSE 0 END) AS withSource
      FROM databases`)
      .bind(cut7d, cut30d),
    db
      .prepare(`SELECT
        CASE WHEN source_json IS NULL THEN 'untracked'
             ELSE ${SOURCE_CHANNEL_SQL("source_json")} END AS source,
        COUNT(*) AS total,
        SUM(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END) AS last7d
      FROM databases GROUP BY source ORDER BY total DESC, source`)
      .bind(cut7d),
    // SK-GTM-010 — creating surface (principal-derived); NULL = pre-instrument.
    db
      .prepare(`SELECT COALESCE(source_surface, 'untracked') AS surface,
        COUNT(*) AS total,
        SUM(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END) AS last7d
      FROM databases GROUP BY surface ORDER BY total DESC, surface`)
      .bind(cut7d),
    db.prepare(`SELECT src AS source, COUNT(*) AS strangers FROM (
        SELECT COALESCE((
          SELECT ${SOURCE_CHANNEL_SQL("d.source_json")}
          FROM databases d
          WHERE d.tenant_id = u.id AND d.source_json IS NOT NULL
          ORDER BY d.created_at ASC LIMIT 1
        ), 'untracked') AS src
        FROM user u WHERE NOT ${INTERNAL_EMAIL_SQL}
      ) GROUP BY src ORDER BY strangers DESC, src`),
    db.prepare(`SELECT COUNT(*) AS started,
        SUM(CASE WHEN first10_ok > 0 THEN 1 ELSE 0 END) AS activated,
        SUM(CASE WHEN first10_asks >= 2 THEN 1 ELSE 0 END) AS secondAsk,
        SUM(first10_asks) AS asks, SUM(first10_ok) AS ok
      FROM databases WHERE first10_asks > 0`),
    db.prepare(`SELECT COUNT(DISTINCT u.id) AS withDb,
        COUNT(DISTINCT CASE WHEN d.first10_ok > 0 THEN u.id END) AS activated
      FROM user u JOIN databases d ON d.tenant_id = u.id
      WHERE NOT ${INTERNAL_EMAIL_SQL}`),
    // Adoptions split by the adopter's account email — a preview
    // mock-IdP or founder adoption is internal, not a real conversion.
    db
      .prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS last7d,
        SUM(CASE WHEN NOT ${INTERNAL_EMAIL_SQL} THEN 1 ELSE 0 END) AS realAdoptions
      FROM anon_adoptions a JOIN user u ON u.id = a.user_id`)
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
    db.prepare(`SELECT response, COUNT(*) AS n FROM pmf_survey GROUP BY response`),
    db.prepare(`SELECT day, metrics_json FROM gtm_snapshots ORDER BY day DESC LIMIT 90`),
    // SK-GTM-005 — unique anonymous devices: one anon tenant id = one
    // device (SK-ANON-008's sha256 derivation). A device is synthetic
    // when ANY of its DBs carries the flag — one self-identification
    // marks the robot for good.
    db.prepare(`SELECT COUNT(*) AS devices, SUM(isSyn) AS synthetic FROM (
        SELECT tenant_id, MAX(synthetic) AS isSyn FROM databases
        WHERE tenant_id LIKE 'anon:%' GROUP BY tenant_id
      )`),
    // SK-GTM-008 — the `agent_memory_v1` workload behind the
    // SK-PIVOT-016 gate's criteria 1–2. LEFT JOIN so an anon-owned
    // memory DB still counts (its NULL email is simply not internal).
    db
      .prepare(`SELECT COUNT(*) AS dbs,
        SUM(CASE WHEN ${INTERNAL_EMAIL_SQL} THEN 1 ELSE 0 END) AS internalDbs,
        SUM(d.first10_asks) AS asks, SUM(d.first10_ok) AS ok,
        MAX(d.last_queried_at) AS lastQueriedAt
      FROM databases d LEFT JOIN user u ON u.id = d.tenant_id
      WHERE substr(d.id, 1, length(?1)) = ?1`)
      .bind(MEMORY_DB_PREFIX),
    // SK-GTM-009 — the paying-customer watchlist. One row per customers
    // entry (all statuses: an `incomplete` row means someone is
    // mid-checkout, a `canceled` one is churn to learn from). Newest
    // conversion first; unconverted rows sort by their last sync.
    db.prepare(`SELECT u.email AS email,
        CASE WHEN ${INTERNAL_EMAIL_SQL} THEN 1 ELSE 0 END AS internal,
        c.status AS status, c.converted_at AS convertedAt,
        c.current_period_end AS currentPeriodEnd,
        c.cancel_at_period_end AS cancelAtPeriodEnd,
        COUNT(d.id) AS dbs,
        COALESCE(SUM(d.first10_asks), 0) AS asks,
        COALESCE(SUM(d.first10_ok), 0) AS ok,
        MAX(d.last_queried_at) AS lastDbSec,
        (SELECT MAX(m.created_at) FROM chat_message m WHERE m.user_id = c.user_id) AS lastChatMs
      FROM customers c JOIN user u ON u.id = c.user_id
      LEFT JOIN databases d ON d.tenant_id = c.user_id
      GROUP BY c.user_id
      ORDER BY COALESCE(c.converted_at, c.updated_at) DESC LIMIT 50`),
  ]);

  const uc = (userCounts?.results?.[0] ?? null) as CountsRow | null;
  const dc = (dbCounts?.results?.[0] ?? null) as CountsRow | null;
  const f10 = (first10?.results?.[0] ?? null) as CountsRow | null;
  const sdb = (strangerDbs?.results?.[0] ?? null) as CountsRow | null;
  const ad = (adoptions?.results?.[0] ?? null) as CountsRow | null;
  const pi = (premium?.results?.[0] ?? null) as CountsRow | null;
  const dev = (anonDevices?.results?.[0] ?? null) as CountsRow | null;
  const mem = (memoryDbs?.results?.[0] ?? null) as CountsRow | null;
  const memLastSec = num(mem, "lastQueriedAt");

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

  // SK-GTM-009 — watchlist rows. Timestamp units per the module header:
  // customers/databases in seconds, chat_message in milliseconds.
  const customerWatchlist: GtmMetrics["customers"] = [];
  for (const raw of (customerRows?.results ?? []) as CountsRow[]) {
    const convertedSec = num(raw, "convertedAt");
    const periodEndSec = num(raw, "currentPeriodEnd");
    const lastActivitySec = Math.max(
      num(raw, "lastDbSec"),
      Math.floor(num(raw, "lastChatMs") / 1000),
    );
    customerWatchlist.push({
      email: String(raw["email"]),
      internal: num(raw, "internal") === 1,
      status: String(raw["status"]),
      convertedAt: convertedSec > 0 ? new Date(convertedSec * 1000).toISOString() : null,
      currentPeriodEnd: periodEndSec > 0 ? new Date(periodEndSec * 1000).toISOString() : null,
      cancelAtPeriodEnd: num(raw, "cancelAtPeriodEnd") === 1,
      dbs: num(raw, "dbs"),
      first10Asks: num(raw, "asks"),
      first10Ok: num(raw, "ok"),
      lastActivityAt: lastActivitySec > 0 ? new Date(lastActivitySec * 1000).toISOString() : null,
    });
  }

  // SK-GTM-006 — in-product Sean-Ellis Q1 responses. The 40% read
  // excludes "na" (respondents who haven't really used the product),
  // per the canonical survey methodology.
  const surveyByResponse: Record<string, number> = {};
  for (const raw of (surveyRows?.results ?? []) as CountsRow[]) {
    surveyByResponse[String(raw["response"])] = num(raw, "n");
  }
  const surveyResponses = Object.values(surveyByResponse).reduce((a, b) => a + b, 0);
  const surveyScored = surveyResponses - (surveyByResponse["na"] ?? 0);
  const veryDisappointedShare = ratio(surveyByResponse["very_disappointed"] ?? 0, surveyScored);
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
      adoptionRate: ratio(num(ad, "total"), num(dc, "anon") + num(ad, "total")),
      anonDbsSynthetic: num(dc, "anonSynthetic"),
      adoptionsReal: num(ad, "realAdoptions"),
      adoptionRateReal: ratio(
        num(ad, "realAdoptions"),
        num(dc, "anon") - num(dc, "anonSynthetic") + num(ad, "realAdoptions"),
      ),
    },
    uniques: {
      realUsers: total - internal,
      anonDevices: num(dev, "devices"),
      anonDevicesSynthetic: num(dev, "synthetic"),
      anonDevicesOrganic: num(dev, "devices") - num(dev, "synthetic"),
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
    acquisition: {
      dbsWithSource: num(dc, "withSource"),
      dbsBySource: ((dbsBySource?.results ?? []) as CountsRow[]).map((r) => ({
        source: String(r["source"]),
        total: num(r, "total"),
        last7d: num(r, "last7d"),
      })),
      strangersBySource: ((strangersBySource?.results ?? []) as CountsRow[]).map((r) => ({
        source: String(r["source"]),
        strangers: num(r, "strangers"),
      })),
      dbsBySurface: ((dbsBySurface?.results ?? []) as CountsRow[]).map((r) => ({
        surface: String(r["surface"]),
        total: num(r, "total"),
        last7d: num(r, "last7d"),
      })),
    },
    pmf: {
      premiumInterest: num(pi, "n"),
      payingCustomers,
      customersByStatus,
      seanEllis: {
        runnable: activatedStrangers >= SEAN_ELLIS_MIN_ACTIVATED,
        activatedStrangers,
        minActivated: SEAN_ELLIS_MIN_ACTIVATED,
        responses: surveyResponses,
        byResponse: surveyByResponse,
        veryDisappointedShare,
      },
    },
    launchGate: {
      memoryPresetEnabled,
      memoryDbs: num(mem, "dbs"),
      memoryDbsInternal: num(mem, "internalDbs"),
      memoryFirst10Asks: num(mem, "asks"),
      memoryFirst10Ok: num(mem, "ok"),
      memoryFirst10SuccessRate: ratio(num(mem, "ok"), num(mem, "asks")),
      memoryLastQueriedAt: memLastSec > 0 ? new Date(memLastSec * 1000).toISOString() : null,
    },
    customers: customerWatchlist,
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
    // SK-GTM-005 additions (additive keys — older rows simply lack them).
    realUsers: metrics.uniques.realUsers,
    anonDevicesOrganic: metrics.uniques.anonDevicesOrganic,
    anonDbsOrganic: metrics.funnel.anonDbsTotal - metrics.funnel.anonDbsSynthetic,
    adoptionsReal: metrics.funnel.adoptionsReal,
    // SK-GTM-007 — additive key: trend of instrument coverage.
    dbsWithSource: metrics.acquisition.dbsWithSource,
    // SK-GTM-006 — additive keys (SK-GTM-003: never rename/retype).
    seanEllisResponses: metrics.pmf.seanEllis.responses,
    veryDisappointedShare: metrics.pmf.seanEllis.veryDisappointedShare,
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
