// The Postgres spike's ONE applied index (`GLOBAL-043` item 10, roadmap item
// 1b): CI's `spike-attach` job runs this step on every run, and it moves the
// spike one state forward at most. No index yet → apply the heaviest Tier 1
// proposal `CONCURRENTLY` in a low-load moment. Applied → re-read its
// fingerprint since the apply, and once `VERIFY_WINDOW_SEC` has passed judge
// it with the loop's own verify, which runs the stored inverse on a regression
// (KPI C). One index ever: once an nlqdb `CREATE INDEX` is in the DB's
// statement history and no nlqdb index stands, the step is spent.
//
// The spike keeps no ledger (CI holds no D1 to write), so the counters at the
// apply, the proposal and its verdict ride on the index's own `COMMENT` — the
// inverse drops them with the index. Remove this module when the spike's
// verdict is recorded.

import {
  applyProposal,
  type FingerprintWindow,
  judgeApplied,
  type PostgresQueryFn,
  type Proposal,
  type StatementCounters,
  snapshotPostgresStatements,
  statementWindow,
  type Verification,
  verifyApplied,
} from "@nlqdb/db";
import { VERIFY_WINDOW_SEC } from "../dba-verbs.ts";

const NOTE_PREFIX = "nlqdb spike apply: ";

export type SpikeNote = {
  appliedAt: number;
  verifyFrom: Omit<StatementCounters, "query">;
  proposal: Proposal;
  verification?: Verification;
};

export type SpikeStep =
  | { step: "deferred"; reason: string }
  | { step: "spent"; reason: string }
  | { step: "applied"; note: SpikeNote }
  | {
      step: "measured";
      ageSec: number;
      valid: boolean;
      note: SpikeNote;
      // The fingerprint since the apply; null when it hasn't run since.
      after: FingerprintWindow | null;
      // Set once the window has passed and verify judged it.
      verification?: Verification;
    };

export type SpikeLimits = {
  // Other client backends running a statement right now.
  maxActive: number;
  // An open transaction older than this makes `CONCURRENTLY` wait on it.
  longXactSec: number;
};

const DEFAULT_LIMITS: SpikeLimits = { maxActive: 5, longXactSec: 60 };

const NLQDB_INDEXES_SQL = `
SELECT n.nspname AS schema, c.relname AS name, i.indisvalid AS valid,
       obj_description(c.oid, 'pg_class') AS note
FROM pg_catalog.pg_index i
JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname LIKE 'nlqdb\\_%'`;

// A completed nlqdb build stays in the statement history after its inverse
// dropped the index; a failed build is never recorded, so it can retry.
const HISTORY_SQL = `
SELECT count(*)::int AS n FROM pg_stat_statements s
WHERE s.dbid = (SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database())
  AND s.query ~* '^\\s*CREATE INDEX CONCURRENTLY "?nlqdb_'`;

const LOAD_SQL = `
SELECT count(*) FILTER (WHERE state = 'active')::int AS active,
       count(*) FILTER (WHERE xact_start < now() - make_interval(secs => $1))::int AS long_xacts
FROM pg_catalog.pg_stat_activity
WHERE datname = current_database() AND backend_type = 'client backend' AND pid <> pg_backend_pid()`;

// Session-scoped (`CONCURRENTLY` can't run in a transaction) and reset before
// the socket closes, so a session-mode pooler never hands them on.
const TIMEOUTS = ["SET statement_timeout = '90s'", "SET lock_timeout = '10s'"];
const RESET = ["RESET statement_timeout", "RESET lock_timeout"];

// The heaviest Tier 1 proposal by its fingerprint's total time; Tier 0 names
// no fingerprint, so it has no before/after to measure.
export function pickProposal(proposals: Proposal[]): Proposal | null {
  const weight = (p: Proposal) =>
    (p.evidence.workload?.calls ?? 0) * (p.evidence.workload?.meanMs ?? 0);
  return (
    proposals
      .filter((p) => p.tier === 1 && p.evidence.workload)
      .sort((a, b) => weight(b) - weight(a))[0] ?? null
  );
}

// `query` must be able to write (DDL, `COMMENT`): open it without `readOnly`.
export async function spikeApplyStep(
  query: PostgresQueryFn,
  proposals: Proposal[],
  nowSec: number,
  limits: SpikeLimits = DEFAULT_LIMITS,
): Promise<SpikeStep> {
  for (const s of TIMEOUTS) await query(s, []);
  try {
    const { rows: applied } = await query(NLQDB_INDEXES_SQL, []);
    if (applied.length > 1)
      throw new Error(`${applied.length} nlqdb indexes stand; the spike applies one`);
    if (applied[0]) return await measure(query, applied[0], nowSec);

    const { rows: history } = await query(HISTORY_SQL, []);
    if (Number(history[0]?.["n"]) > 0)
      return {
        step: "spent",
        reason: "an nlqdb index was built here and is gone (reverted or dropped)",
      };

    const proposal = pickProposal(proposals);
    if (!proposal) return { step: "deferred", reason: "no Tier 1 proposal" };
    const { rows: load } = await query(LOAD_SQL, [limits.longXactSec]);
    const active = Number(load[0]?.["active"]);
    const longXacts = Number(load[0]?.["long_xacts"]);
    if (active > limits.maxActive || longXacts > 0)
      return {
        step: "deferred",
        reason: `busy: ${active} active backends, ${longXacts} transactions open > ${limits.longXactSec} s`,
      };

    try {
      return { step: "applied", note: await apply(query, proposal, nowSec) };
    } catch (err) {
      // 42P07: a concurrent run's build took the name first; it records the note.
      if ((err as { code?: unknown }).code === "42P07")
        return { step: "deferred", reason: "a concurrent run is building the index" };
      throw err;
    }
  } finally {
    for (const s of RESET) await query(s, []).catch(() => {});
  }
}

async function apply(
  query: PostgresQueryFn,
  proposal: Proposal,
  nowSec: number,
): Promise<SpikeNote> {
  await applyProposal(query, proposal);
  const fingerprint = proposal.evidence.workload?.fingerprint ?? "";
  const from = (await snapshotPostgresStatements(query, proposal.schema)).get(fingerprint);
  const note: SpikeNote = {
    appliedAt: nowSec,
    // Not run since the last stats reset: the window counts from zero.
    verifyFrom: {
      calls: from?.calls ?? 0,
      totalMs: from?.totalMs ?? 0,
      sumSquaresMs: from?.sumSquaresMs ?? 0,
      rows: from?.rows ?? 0,
    },
    proposal,
  };
  try {
    await writeNote(query, proposal, note);
  } catch (err) {
    // An index with no counters can never be judged: undo it, the build retries.
    await query(proposal.inverse, []);
    throw err;
  }
  return note;
}

// `COMMENT` takes no bind parameters: the server quotes the identifiers and
// the literal (`format`'s `%I` / `%L`).
async function writeNote(query: PostgresQueryFn, proposal: Proposal, note: SpikeNote) {
  const { rows } = await query(
    "SELECT format('COMMENT ON INDEX %I.%I IS %L', $1::text, $2::text, $3::text) AS ddl",
    [proposal.schema, indexNameOf(proposal), NOTE_PREFIX + JSON.stringify(note)],
  );
  await query(String(rows[0]?.["ddl"]), []);
}

// The name `createIndexProposal` rendered into the DDL.
function indexNameOf(proposal: Proposal): string {
  const quoted = /^CREATE INDEX CONCURRENTLY "((?:[^"]|"")+)"/.exec(proposal.ddl)?.[1];
  if (!quoted) throw new Error("not a Postgres create_index proposal");
  return quoted.replaceAll('""', '"');
}

export function readNote(text: unknown): SpikeNote | null {
  if (typeof text !== "string" || !text.startsWith(NOTE_PREFIX)) return null;
  return JSON.parse(text.slice(NOTE_PREFIX.length)) as SpikeNote;
}

async function measure(
  query: PostgresQueryFn,
  index: Record<string, unknown>,
  nowSec: number,
): Promise<SpikeStep> {
  const note = readNote(index["note"]);
  // Another run's build is in flight, or its note failed and its inverse is pending.
  if (!note) return { step: "deferred", reason: "an nlqdb index stands without its note" };
  const valid = index["valid"] === true;
  const ageSec = nowSec - note.appliedAt;
  const fingerprint = note.proposal.evidence.workload?.fingerprint ?? "";
  const window = statementWindow(
    new Map([[fingerprint, { query: "", ...note.verifyFrom }]]),
    await snapshotPostgresStatements(query, note.proposal.schema),
  );
  const after = window.find((w) => w.fingerprint === fingerprint) ?? null;
  const base = { step: "measured" as const, ageSec, valid, after };
  if (note.verification) {
    // A revert verdict on a standing index: a run was cut off mid-drop, so finish it.
    if (note.verification.verdict === "revert") await query(note.proposal.inverse, []);
    return { ...base, note, verification: note.verification };
  }
  // Judged once, like the `dba_verify` job — and only on a window that ran it.
  if (ageSec < VERIFY_WINDOW_SEC || !after) return { ...base, note };
  // The verdict lands on the note before verify's revert drops the index, so a
  // run cancelled mid-`DROP INDEX CONCURRENTLY` never leaves a half-dropped
  // index for the next run to judge afresh (and maybe keep, invalid).
  const judged = { ...note, verification: judgeApplied(note.proposal, window) };
  await writeNote(query, note.proposal, judged);
  const verification = await verifyApplied(query, note.proposal, window);
  return { ...base, note: judged, verification };
}
