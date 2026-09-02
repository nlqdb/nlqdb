// Scheduled jobs on the api Worker (SK-HDC-023). `wrangler.toml` declares
// one cron trigger — `*/4 * * * *` — and every scheduled task is a row in
// `JOBS`, gated by a pure UTC predicate over the *scheduled* minute
// (`controller.scheduledTime`, never wall-clock). Adding a job = adding a
// row; the trigger count stays at one (Cloudflare Free: 5 crons/account).
//
// Day-of-week is JS `getUTCDay()`: 0 = Sun … 6 = Sat.

import { createPipeManagementClient, createTinybirdAdapter } from "@nlqdb/db";
import { writeDailyGtmSnapshot } from "../admin/gtm-metrics.ts";
import { reconcilePremiumMeter } from "../billing/premium/index.ts";
import { sweepAnonDatabases } from "../db-sweep/sweep.ts";
import { runIcpCluster } from "../icp-cluster.ts";
import { runIcpScore } from "../icp-score.ts";
import { runIcpScrape } from "../icp-scrape.ts";
import { runWorkloadAnalyser } from "../workload-analyser/index.ts";

export type Job = {
  name: string;
  when: (t: Date) => boolean;
  run: (env: Cloudflare.Env) => Promise<void>;
};

type When = Job["when"];

export const at =
  (hour: number, minute = 0): When =>
  (t) =>
    t.getUTCHours() === hour && t.getUTCMinutes() === minute;

export const weeklyAt =
  (day: number, hour: number): When =>
  (t) =>
    t.getUTCDay() === day && at(hour)(t);

// Every tick from `fromHour`:00 through `toHour`:59 UTC, Mon–Fri.
export const weekdaysBetween =
  (fromHour: number, toHour: number): When =>
  (t) => {
    const day = t.getUTCDay();
    const hour = t.getUTCHours();
    return day >= 1 && day <= 5 && hour >= fromHour && hour <= toHour;
  };

const info = (body: object) => console.info(JSON.stringify(body));
const warn = (body: object) => console.warn(JSON.stringify(body));
const error = (body: object) => console.error(JSON.stringify(body));

const errMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const JOBS: Job[] = [
  {
    // SK-HDC-014 — one `SELECT 1` every 4 min inside the weekday window
    // keeps Neon Free-tier compute resident (≈44 CU-h/month of the 100
    // budget). Silent on success: 360 fires/day would drown `wrangler tail`.
    name: "neon_keep_warm",
    when: weekdaysBetween(13, 21),
    run: async (env) => {
      if (!env.DATABASE_URL) {
        warn({ msg: "neon_keepwarm_skipped", reason: "DATABASE_URL unset" });
        return;
      }
      // pg-client.ts is WASM-free, so this lazy import cannot hit the
      // module-scope libpg-query crash (SK-ASK-024) on the cron isolate.
      const { keepNeonWarm } = await import("../db-create/pg-client.ts");
      await keepNeonWarm(env.DATABASE_URL);
    },
  },
  {
    // SK-ANON-002 / SK-ANON-012 — D1-only; Postgres schema cleanup is
    // operator territory (`docs/runbook.md §9`).
    name: "anon_db_sweep",
    when: at(4),
    run: async (env) => {
      const sweep = await sweepAnonDatabases(env.DB);
      info({
        msg: "anon_db_sweep",
        evicted_by_age: sweep.evictedByAge.length,
        evicted_by_cap: sweep.evictedByCap.length,
        total_anon_after: sweep.totalAnonAfter,
      });
    },
  },
  {
    // SK-GTM-003 — daily GTM/PMF snapshot (GLOBAL-038); the on-read writer
    // in `GET /v1/admin/metrics` covers a missed day.
    name: "gtm_snapshot",
    when: at(4),
    run: async (env) => {
      await writeDailyGtmSnapshot(env.DB);
      info({ msg: "gtm_snapshot_written" });
    },
  },
  {
    // SK-PREMIUM-017 — ack-and-skips while the meter is dark.
    name: "premium_meter_reconcile",
    when: at(4),
    run: async (env) => {
      const nowSec = Math.floor(Date.now() / 1000);
      const result = await reconcilePremiumMeter(env, env.DB, nowSec - 25 * 3600, nowSec);
      info({ msg: "premium_meter_reconcile", ...result });
    },
  },
  {
    // SK-MIGRATE-001 — daily workload analyser; 04:00 UTC is the quiet
    // window between US/EU peaks. Ack-and-skips without a Tinybird token
    // (SK-EVENTS-005). Outcome rides the `nlqdb.workload_analyser.run` span.
    name: "workload_analyser",
    when: at(4),
    run: async (env) => {
      if (!env.TINYBIRD_TOKEN) return;
      const apiBase = env.TINYBIRD_API_BASE !== undefined ? { apiBase: env.TINYBIRD_API_BASE } : {};
      await runWorkloadAnalyser({
        d1: env.DB,
        tinybird: createTinybirdAdapter({
          token: env.TINYBIRD_TOKEN,
          ...apiBase,
          workspace: "nlqdb",
          // `query_log` only — cross-prefix reads reject per SK-MULTIENG-004.
          allowlist: { tables: ["query_log"], pipes: [] },
        }),
        pipes: createPipeManagementClient({ token: env.TINYBIRD_TOKEN, ...apiBase }),
        now: () => Date.now(),
        newId: () => crypto.randomUUID(),
      });
    },
  },
  {
    // SK-ICP-001..003 — Monday 06:00 UTC scrape → score → cluster. Score
    // and cluster are isolated so a scrape still lands if scoring trips.
    name: "icp_pipeline",
    when: weeklyAt(1, 6),
    run: async (env) => {
      const scrape = await runIcpScrape({
        kv: env.KV,
        logsnagToken: env.LOGSNAG_TOKEN,
        logsnagProject: env.LOGSNAG_PROJECT,
        ghToken: env.GH_TOKEN,
        redditClientId: env.REDDIT_CLIENT_ID,
        redditClientSecret: env.REDDIT_CLIENT_SECRET,
      });
      info({
        msg: "icp_scrape_completed",
        newItems: scrape.newItems,
        skipped: scrape.skipped,
        sources: scrape.sources,
      });
      if (scrape.items.length > 0) {
        const score = await runIcpScore(scrape.items, {
          kv: env.KV,
          groqApiKey: env.GROQ_API_KEY,
          geminiApiKey: env.GEMINI_API_KEY,
        }).catch((err) => {
          error({ msg: "icp_score_failed", message: errMessage(err) });
          return null;
        });
        if (score) info({ msg: "icp_score_completed", ...score });
      }
      if (env.GH_TOKEN) {
        const cluster = await runIcpCluster({
          kv: env.KV,
          groqApiKey: env.GROQ_API_KEY,
          geminiApiKey: env.GEMINI_API_KEY,
          ghToken: env.GH_TOKEN,
          logsnagToken: env.LOGSNAG_TOKEN,
          logsnagProject: env.LOGSNAG_PROJECT,
        }).catch((err) => {
          error({ msg: "icp_cluster_failed", message: errMessage(err) });
          return null;
        });
        if (cluster) info({ msg: "icp_cluster_completed", ...cluster });
      }
    },
  },
];

export const dueJobs = (jobs: Job[], scheduledTime: number): Job[] =>
  jobs.filter((job) => job.when(new Date(scheduledTime)));

// Runs due jobs sequentially in table order. One job failing never skips
// the rest — the failure is logged with the job's name and swallowed.
export async function runDueJobs(
  jobs: Job[],
  scheduledTime: number,
  env: Cloudflare.Env,
): Promise<void> {
  for (const job of dueJobs(jobs, scheduledTime)) {
    try {
      await job.run(env);
    } catch (err) {
      error({ msg: "scheduled_job_failed", job: job.name, message: errMessage(err) });
    }
  }
}
