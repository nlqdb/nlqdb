// Phase A dogfood workload — GLOBAL-041 build-order step 8, the KPI 1
// instrument. The daily loop's own "Last change" record goes into the hosted
// dogfood DB through `@nlqdb/sdk`, as the run wrote it, never pre-modeled.
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
import { readFileSync } from "node:fs";
import { type AskResponse, createClient, NlqdbApiError } from "@nlqdb/sdk";
import { resolveTarget } from "./kpi1-live-walk.ts";

export type RunRecord = { date: string; run: string; headline: string; details: string };

// The one table the goal names. A name, not a shape: every column is left to
// widen-on-write to infer from the values (GLOBAL-041 — never pre-model).
export const TABLE = "daily_runs";

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

// Pure: the write goal, a leading insert verb + pinned DB so it routes
// `pinned_write` (SK-ASK-014). Only `details` is shortened to fit the cap.
export function buildGoal(r: RunRecord): string {
  const head = `Log this daily run in the ${TABLE} table: run ${r.run}, date ${r.date}, headline "${r.headline}", details "`;
  const room = MAX_GOAL - head.length - 2;
  const details = r.details.length > room ? `${r.details.slice(0, room - 1)}…` : r.details;
  return `${head}${details}".`;
}

export type WriteOutcome = { ok: true; res: AskResponse } | { ok: false; code: string };

export type WriteVerdict = { inSample: boolean; hit: boolean; reason: string };

function widenOf(o: WriteOutcome | undefined): { tables: string[]; rewritten: boolean } {
  const w = o?.ok ? o.res.trace.widen : undefined;
  return { tables: w?.tables ?? [], rewritten: w?.schema_rewritten ?? false };
}

// Pure: is this write in the KPI 1 sample (it referenced an unseen table or
// field), and did it land with no user action? An error is counted in-sample
// as a miss — the verdict never inflates the rate by dropping a failure.
export function classifyWrite(preview: WriteOutcome, commit?: WriteOutcome): WriteVerdict {
  if (!preview.ok) return { inSample: true, hit: false, reason: `preview_error:${preview.code}` };
  if ("kind" in preview.res) return { inSample: true, hit: false, reason: "classified_create" };
  if (commit && !commit.ok)
    return { inSample: true, hit: false, reason: `commit_error:${commit.code}` };
  const pre = widenOf(preview);
  const post = widenOf(commit ?? preview);
  if (pre.tables.length === 0 && post.tables.length === 0) {
    return { inSample: false, hit: false, reason: "seen_fields" };
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

function scorecardAt(ref: string | null): string | null {
  try {
    return ref === null
      ? readFileSync(new URL("../../../docs/scorecard.md", import.meta.url), "utf8")
      : execFileSync("git", ["show", `${ref}:docs/scorecard.md`], { encoding: "utf8" });
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
  const record = parseLastChange(scorecardAt(null) ?? "");
  if (!record) throw new Error("docs/scorecard.md has no parseable `## Last change` entry");

  // A push that left the record unchanged is not a new run — skip, so a
  // scorecard-only follow-up never double-writes. A manual dispatch always writes.
  const prev = parseLastChange(scorecardAt("HEAD~1") ?? "");
  if (process.env["GITHUB_EVENT_NAME"] === "push" && prev?.run === record.run) {
    console.info(`dogfood-write: run ${record.run} already written — skipping.`);
    return;
  }

  const { base, dbId } = resolveTarget(process.env);
  const client = createClient({ apiKey, baseUrl: base });
  const goal = buildGoal(record);
  const preview = await attempt(() => client.ask({ goal, dbId }));
  const needsConfirm =
    preview.ok && "requires_confirm" in preview.res && preview.res.requires_confirm;
  const commit = needsConfirm
    ? await attempt(() => client.ask({ goal, dbId, confirm: true }))
    : undefined;
  const v = classifyWrite(preview, commit);

  const line = `dogfood-write run ${record.run} → ${TABLE} on ${dbId}: ${
    v.inSample ? (v.hit ? "KPI-1 HIT" : "KPI-1 MISS") : "not in sample"
  } (${v.reason})`;
  console.info(line);
  const summaryFile = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryFile) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(summaryFile, `## ${line}\n`);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("dogfood-write failed:", err);
    process.exit(1);
  });
}
