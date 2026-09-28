// Phase A dogfood workload — GLOBAL-041 build-order step 8, the KPI 1
// instrument. The daily loop's own outputs — its run record ("Last change")
// and its new blocked-by-human items — go into the hosted dogfood DB through
// `@nlqdb/sdk`, as the run wrote them, never pre-modeled. GLOBAL-041's third
// kind, the scorecard deltas, waits on the widen grammar admitting a
// reserved-word field (a delta names its `row`; `POSTGRES_RESERVED` refuses it).
//
// Why CI and not the daily session: the session's credential classifier
// denies materialising the prod `sk_mcp_` key into an outbound call (runs
// 211-224). `secrets.NLQDB_API_KEY` crosses only the workflow boundary, so
// `dogfood-write.yml` runs this on every merge that touches the scorecard.
// Unlike `kpi1-live-walk.ts` (preview-only proxy) this COMMITS: a real write
// into the real dogfood DB is the only thing that opens the GLOBAL-041
// 200-insert window and moves the prod `asks_extend_ok/failed` counters.
//
// Skill cross-ref: docs/features/schema-widening/FEATURE.md SK-SCHEMA-010.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { type AskResponse, createClient, NlqdbApiError } from "@nlqdb/sdk";
import { resolveTarget } from "./kpi1-live-walk.ts";

export type RunRecord = { date: string; run: string; headline: string; details: string };

// One goal-named table per output kind. Names, not shapes: every column is
// left to widen-on-write to infer from the values (GLOBAL-041 — never pre-model).
export const TABLE = "daily_runs";
export const BLOCKED_TABLE = "blocked_items";

// One write: the goal-named table and the NL goal that inserts the record.
export type Write = { table: string; goal: string };

// SK-ASK-010 server cap on `goal`.
const MAX_GOAL = 2000;

// Pure: the scorecard's single-entry `## Last change` record, or null when the
// section is absent or not in the `**date (run N)** — **headline** body` form.
export function parseLastChange(md: string): RunRecord | null {
  const section = md.split(/^## Last change\s*$/m)[1];
  if (!section) return null;
  const entry = section.trim().split(/\n\s*\n/)[0] ?? "";
  const m = entry.match(
    /^\*\*(\d{4}-\d{2}-\d{2}) \(run (\d+)\)\*\*\s*—\s*\*\*(.+?)\*\*\s*([\s\S]*)$/,
  );
  if (!m) return null;
  const [, date = "", run = "", headline = "", details = ""] = m;
  const flat = (s: string) => s.replace(/\s+/g, " ").trim();
  return { date, run, headline: flat(headline), details: flat(details) };
}

const clip = (s: string, room: number) => (s.length > room ? `${s.slice(0, room - 1)}…` : s);

// Pure: the write goal, a leading insert verb + pinned DB so it routes
// `pinned_write` (SK-ASK-014). Only `details` is shortened to fit the cap.
export function buildGoal(r: RunRecord): string {
  const head = `Log this daily run in the ${TABLE} table: run ${r.run}, date ${r.date}, headline "${r.headline}", details "`;
  return `${head}${clip(r.details, MAX_GOAL - head.length - 2)}".`;
}

type Blocked = { title: string; estimate: string; since: string };

// Pure: `docs/blocked-by-human.md` bullets — a `## Title` whose first line
// reads `<estimate> · blocked since <date>`.
export function parseBlocked(md: string): Blocked[] {
  const out: Blocked[] = [];
  for (const m of md.matchAll(/^## (.+)\n+(.+?) · blocked since (\d{4}-\d{2}-\d{2})/gm)) {
    const [, title = "", estimate = "", since = ""] = m;
    out.push({ title: title.trim(), estimate: estimate.trim(), since });
  }
  return out;
}

// Pure: one write per blocked-by-human bullet this run added.
export function blockedWrites(run: string, before: string, after: string): Write[] {
  const seen = new Set(parseBlocked(before).map((b) => b.title));
  return parseBlocked(after)
    .filter((b) => !seen.has(b.title))
    .map((b) => ({
      table: BLOCKED_TABLE,
      goal: clip(
        `Log this blocked-by-human item in the ${BLOCKED_TABLE} table: run ${run}, title "${b.title}", estimate "${b.estimate}", blocked since ${b.since}.`,
        MAX_GOAL,
      ),
    }));
}

export type WriteOutcome = { ok: true; res: AskResponse } | { ok: false; code: string };

export type WriteVerdict = { inSample: boolean; hit: boolean; reason: string };

function widenOf(o: WriteOutcome | undefined): {
  tables: string[];
  rewritten: boolean;
  sql: string;
} {
  const t = o?.ok ? o.res.trace : undefined;
  return {
    tables: t?.widen?.tables ?? [],
    rewritten: t?.widen?.schema_rewritten ?? false,
    sql: t?.sql ?? "",
  };
}

// An INSERT into the goal-named table, schema-qualified and/or quoted or not.
const insertsTable = (table: string) =>
  new RegExp(`\\binsert\\s+into\\s+(?:"?\\w+"?\\.)?"?${table}"?(?![\\w"])`, "i");

// Pure: is this write in the KPI 1 sample (it referenced an unseen table or
// field), and did it land with no user action? An error, or a write the plan
// aimed at any table but the goal-named `table`, is counted in-sample as a
// miss — the verdict never inflates the rate by dropping a failure.
export function classifyWrite(
  table: string,
  preview: WriteOutcome,
  commit?: WriteOutcome,
): WriteVerdict {
  if (!preview.ok) return { inSample: true, hit: false, reason: `preview_error:${preview.code}` };
  if ("kind" in preview.res) return { inSample: true, hit: false, reason: "classified_create" };
  if (commit && !commit.ok)
    return { inSample: true, hit: false, reason: `commit_error:${commit.code}` };
  const pre = widenOf(preview);
  const post = widenOf(commit ?? preview);
  const widened = [...new Set([...pre.tables, ...post.tables])];
  if (widened.length === 0) {
    // No widen: only an INSERT into the goal-named table is "seen" — a read or
    // any other statement that merely names it is a mis-route, kept as a miss.
    return insertsTable(table).test(post.sql)
      ? { inSample: false, hit: false, reason: "seen_fields" }
      : { inSample: true, hit: false, reason: "wrong_target" };
  }
  if (!widened.includes(table)) {
    return { inSample: true, hit: false, reason: `widen_wrong_table:${widened.join(",")}` };
  }
  const landed = commit?.ok && "rowCount" in commit.res && commit.res.rowCount > 0;
  if (landed && post.rewritten) return { inSample: true, hit: true, reason: "landed_widened" };
  return { inSample: true, hit: false, reason: landed ? "landed_no_rewrite" : "not_committed" };
}

async function attempt(fn: () => Promise<AskResponse>): Promise<WriteOutcome> {
  try {
    return { ok: true, res: await fn() };
  } catch (err) {
    const code = err instanceof NlqdbApiError ? err.code : `network:${(err as Error).message}`;
    return { ok: false, code };
  }
}

function fileAt(path: string, ref: string | null): string | null {
  try {
    return ref === null
      ? readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8")
      : execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" });
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const apiKey = process.env["NLQDB_API_KEY"];
  if (!apiKey) {
    console.info("dogfood-write: NLQDB_API_KEY unset — skipping (green no-op).");
    return;
  }
  const record = parseLastChange(fileAt("docs/scorecard.md", null) ?? "");
  if (!record) throw new Error("docs/scorecard.md has no parseable `## Last change` entry");

  // A push that left the record unchanged is not a new run, so it never
  // double-writes the record; its new blocked-by-human bullets still go in.
  // A manual dispatch always writes the record.
  const prev = parseLastChange(fileAt("docs/scorecard.md", "HEAD~1") ?? "");
  const newRun = process.env["GITHUB_EVENT_NAME"] !== "push" || prev?.run !== record.run;
  const blockedAt = (ref: string | null) => fileAt("docs/blocked-by-human.md", ref) ?? "";
  const writes: Write[] = [
    ...(newRun ? [{ table: TABLE, goal: buildGoal(record) }] : []),
    ...blockedWrites(record.run, blockedAt("HEAD~1"), blockedAt(null)),
  ];
  if (writes.length === 0) {
    console.info(`dogfood-write: run ${record.run} already written, no new bullet — skipping.`);
    return;
  }

  const { base, dbId } = resolveTarget(process.env);
  const client = createClient({ apiKey, baseUrl: base });

  // Sequential: each write plans against the schema the previous one widened.
  for (const { table, goal } of writes) {
    const preview = await attempt(() => client.ask({ goal, dbId }));
    const needsConfirm =
      preview.ok && "requires_confirm" in preview.res && preview.res.requires_confirm;
    const commit = needsConfirm
      ? await attempt(() => client.ask({ goal, dbId, confirm: true }))
      : undefined;
    const v = classifyWrite(table, preview, commit);

    const line = `dogfood-write run ${record.run} → ${table} on ${dbId}: ${
      v.inSample ? (v.hit ? "KPI-1 HIT" : "KPI-1 MISS") : "not in sample"
    } (${v.reason})`;
    console.info(line);
    const summaryFile = process.env["GITHUB_STEP_SUMMARY"];
    if (summaryFile) appendFileSync(summaryFile, `## ${line}\n`);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("dogfood-write failed:", err);
    process.exit(1);
  });
}
