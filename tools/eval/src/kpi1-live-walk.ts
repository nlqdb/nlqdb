// Live KPI-1 no-flag routing walk — GLOBAL-041 Phase A, first-insert
// inference rate, measured against PROD from CI (not the daily agent session).
//
// Why this exists: the daily loop cannot measure the live KPI-1 rate. The
// on-prod counters (`asks_extend_ok` / `asks_extend_failed`, SK-SCHEMA-010)
// only move when a *no-flag* write to an unobserved table is sent to
// `/v1/ask` against the dogfood DB — and the daily session's credential
// classifier denies materialising the prod `sk_mcp_` key into an outbound
// call (blocked runs 211-216). CI can: `secrets.NLQDB_API_KEY` crosses only
// the workflow boundary, never the agent's shell. This walk is that path —
// `workflow_dispatch`-only, so it never fires on a merge; it is the button a
// founder or a prod-permitted session presses to finally read the number.
//
// What it measures (preview-only, NON-DESTRUCTIVE): the run-215 gap — does a
// pinned, no-flag, no-confirm write-verb goal naming an UNOBSERVED table route
// to widen-on-write (`route-ask.ts` `reason=pinned_write` → Defense A →
// `extendOnWrite`, returning `requires_confirm:true` + `trace.widen.tables`)
// rather than dead-ending on the `create_or_query_pinned` clarify? A preview
// hop runs the LLM plan + validation but executes NO SQL (SK-ONBOARD-004), so
// nothing lands on prod and the dogfood schema is untouched. The commit hop
// (which moves the D1 counters and is separately proven live, run 214 via
// `forceExtend`) stays out of this walk on purpose: it mutates prod with no
// public table-drop path (dogfood iteration §6.2), so it is not something an
// automated dispatch should do unattended.
//
// The classifier (`classifyExtendPreview`) is a pure function, unit-tested in
// `test/kpi1-live-walk.test.ts` over fixture responses — the live call cannot
// run in CI-without-secret nor from the daily session, so the LOGIC is proven
// deterministically and the walk itself self-skips green when the key/base is
// absent (the memory-sync.yml pattern).
//
// Skill cross-ref: docs/features/schema-widening/FEATURE.md SK-SCHEMA-010;
// docs/features/e2e-coverage/FEATURE.md SK-E2E-004 (workflow_dispatch-only).

export type ProbeResponse = { httpStatus: number; body: unknown };

export type ProbeVerdict = { hit: boolean; reason: string };

// Pure: given one preview `/v1/ask` response, is it a first-insert-inference
// routing HIT (the no-flag write routed into widen-on-write) or a MISS?
//   HIT  — 2xx AskOk carrying `trace.widen.tables` (the preview names the
//          unseen table confirming would create; `ddl` is empty on preview).
//   MISS — `kind=create` (classifier read the write as "make a database"),
//          a 2xx write with no widen (the table was already observed, or the
//          plan was a plain write), a `clarify_required` 409 (dead-ended on
//          the pinned create/query clarify), or any other error envelope.
export function classifyExtendPreview(r: ProbeResponse): ProbeVerdict {
  const body = r.body;
  const ok = r.httpStatus >= 200 && r.httpStatus < 300;
  if (ok && body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (b["kind"] === "create") {
      return { hit: false, reason: "classified_create" };
    }
    const trace = b["trace"];
    const widen =
      trace && typeof trace === "object" ? (trace as Record<string, unknown>)["widen"] : undefined;
    const tables =
      widen && typeof widen === "object" ? (widen as Record<string, unknown>)["tables"] : undefined;
    if (Array.isArray(tables) && tables.length > 0) {
      return { hit: true, reason: "routed_widen" };
    }
    return { hit: false, reason: "ok_no_widen" };
  }
  const code = extractErrorCode(body);
  if (code === "clarify_required") return { hit: false, reason: "clarify_required" };
  return { hit: false, reason: `error:${code ?? String(r.httpStatus)}` };
}

// The error envelope nests the code at `error.code` or carries it top-level
// (mirrors the SDK's `extractError`). Best-effort — an unrecognised body
// yields null and the walk records the HTTP status instead.
function extractErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const err = b["error"];
  if (err && typeof err === "object") {
    const code = (err as Record<string, unknown>)["code"];
    if (typeof code === "string") return code;
  }
  if (typeof b["code"] === "string") return b["code"] as string;
  return null;
}

// Representative first-insert shapes, grounded in the rateme12 dogfood
// workload (mirrors extend-kpi.integration.test.ts): each goal is a WRITE
// naming a table the agent-memory dogfood DB has never observed, so the
// pinned-write route must widen rather than clarify. Preview-only, so the
// names need no per-run salt (nothing is created).
export const WALK_SHAPES: { name: string; goal: string }[] = [
  {
    name: "new-table",
    goal: "Record a rating in the ratings table: a rater gives a profile a star count from 1 to 5. Store the rating id, which profile it targets, and the star count.",
  },
  {
    name: "new-column-family",
    goal: "Store the free-text review body a rater left in the reviews table, alongside the review id and the rating it belongs to.",
  },
  {
    name: "type-varied",
    goal: "Save a leaderboard snapshot in the leaderboard_snapshots table: a snapshot id, the profile id, its average score as a decimal, and the moment it was taken as a timestamp.",
  },
  {
    name: "jsonb",
    goal: "Record a moderation event in the moderation_events table with an event id, the target profile id, and a details object holding the reason and any flags as structured JSON.",
  },
  {
    name: "auth-shaped",
    goal: "Register an app end-user in the app_users table: store a user id, their email, a hashed password, and when they signed up.",
  },
];

const DEFAULT_BASE = "https://app.nlqdb.com";
// The dogfood DB id (GLOBAL-042 iteration 001). Not a secret — an internal id.
const DEFAULT_DB = "db_agent_memory_v1_3a8a72";

// The workflow injects `NLQDB_API_BASE: ${{ vars.NLQDB_API_BASE }}` etc., so an
// UNSET repo var arrives as an empty string, not `undefined`. `??` only falls
// back on null/undefined, so `?? DEFAULT_BASE` left `base=""` and every fetch
// died `URL is invalid` — a false 0/5 (run 218). Treat blank as absent.
export function resolveTarget(env: NodeJS.ProcessEnv): { base: string; dbId: string } {
  const pick = (name: string, fallback: string): string => {
    const raw = env[name];
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return trimmed !== "" ? trimmed : fallback;
  };
  return {
    base: pick("NLQDB_API_BASE", DEFAULT_BASE).replace(/\/$/, ""),
    dbId: pick("NLQDB_DOGFOOD_DB", DEFAULT_DB),
  };
}

async function main(): Promise<void> {
  const key = process.env["NLQDB_API_KEY"];
  const { base, dbId } = resolveTarget(process.env);

  // Self-skip green (memory-sync.yml pattern) so the workflow lights up as a
  // key-present flip, never a red run, when the secret is absent.
  if (!key) {
    console.info("kpi1-live-walk: NLQDB_API_KEY unset — skipping (green no-op).");
    return;
  }

  const lines: string[] = [];
  let ok = 0;
  for (const shape of WALK_SHAPES) {
    let verdict: ProbeVerdict;
    try {
      const res = await fetch(`${base}/v1/ask`, {
        method: "POST",
        // `accept: application/json` skips the summary LLM hop (a routing
        // measurement needs the `trace`, not prose) — cheaper, deterministic.
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Bearer ${key}`,
        },
        // No `forceExtend`, no `confirm` — the no-user-action path. `dbId`
        // pins the DB so a write-verb goal routes `pinned_write`.
        body: JSON.stringify({ goal: shape.goal, dbId }),
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }
      verdict = classifyExtendPreview({ httpStatus: res.status, body: parsed });
    } catch (err) {
      verdict = { hit: false, reason: `network:${(err as Error).message}` };
    }
    if (verdict.hit) ok += 1;
    lines.push(`- \`${shape.name}\`: ${verdict.hit ? "HIT" : "MISS"} (${verdict.reason})`);
    console.info(`kpi1-live-walk ${shape.name}: ${verdict.hit ? "HIT" : "MISS"} ${verdict.reason}`);
  }

  const total = WALK_SHAPES.length;
  const rate = total > 0 ? ok / total : 0;
  const summary = `KPI-1 live no-flag routing: asks_extend_ok=${ok} failed=${total - ok} = ${(rate * 100).toFixed(1)}% (${ok}/${total}) on ${dbId}`;
  console.info(summary);

  const summaryFile = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryFile) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(summaryFile, `## ${summary}\n\n${lines.join("\n")}\n`);
  }
}

// Run only as a script, never on import (keeps the pure classifier testable).
if (import.meta.main) {
  main().catch((err) => {
    console.error("kpi1-live-walk failed:", err);
    process.exit(1);
  });
}
