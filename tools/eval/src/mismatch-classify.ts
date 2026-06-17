// SK-QUAL-014 — offline mismatch classifier.
//
// Buckets a finished report's `mismatch` rows by the structural way the
// predicted SQL diverges from the gold SQL, so a lever can be attributed to
// the error class it moves. Pure text/structure diff: no DB, no LLM, no quota
// (deliberate tradeoff — see SK-QUAL-014). It reads the same shapes the runner
// already records, so it works on any baseline/report JSON without a re-run.

import type { QuestionResult } from "./types.ts";

export type MismatchClass =
  | "table_set" // predicted joins a different set of base tables (schema-linking / join-path)
  | "agg_fn" // different aggregate-function set (COUNT/SUM/AVG/MAX/MIN)
  | "distinct" // DISTINCT present on one side only
  | "group_by" // GROUP BY present on one side only
  | "order_limit" // ORDER BY / LIMIT present on one side only (ranking shape)
  | "subquery" // nested SELECT present on one side only
  | "value_diff"; // same structure on every axis above — a literal / predicate / projection difference

// FROM/JOIN base tables. Handles bare, "quoted", `backtick`, and [bracket]
// identifiers; a `(` after FROM/JOIN is a subquery, captured by the subquery
// axis rather than as a table name.
function baseTables(upperSql: string): Set<string> {
  const out = new Set<string>();
  const re = /\b(?:FROM|JOIN)\s+(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(upperSql))) {
    const name = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").toUpperCase();
    if (name && name !== "SELECT") out.add(name);
  }
  return out;
}

function aggSet(upperSql: string): Set<string> {
  return new Set(["COUNT(", "SUM(", "AVG(", "MAX(", "MIN("].filter((a) => upperSql.includes(a)));
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

// Tags a single predicted/gold pair. A mismatch can diverge on several axes;
// the fallback `value_diff` fires only when every structural axis agrees, which
// isolates literal/predicate/projection errors (the value-retrieval target).
export function classifyMismatch(predicted: string, gold: string): MismatchClass[] {
  const p = predicted.toUpperCase();
  const g = gold.toUpperCase();
  const tags: MismatchClass[] = [];
  if (!setsEqual(baseTables(p), baseTables(g))) tags.push("table_set");
  if (!setsEqual(aggSet(p), aggSet(g))) tags.push("agg_fn");
  if (p.includes(" DISTINCT ") !== g.includes(" DISTINCT ")) tags.push("distinct");
  if (p.includes(" GROUP BY ") !== g.includes(" GROUP BY ")) tags.push("group_by");
  if (
    p.includes(" ORDER BY ") !== g.includes(" ORDER BY ") ||
    p.includes(" LIMIT ") !== g.includes(" LIMIT ")
  )
    tags.push("order_limit");
  // `SELECT` count > 1 ⇒ a nested query exists on that side.
  if ((p.split("SELECT").length > 2) !== (g.split("SELECT").length > 2)) tags.push("subquery");
  if (tags.length === 0) tags.push("value_diff");
  return tags;
}

export type MismatchReport = {
  mismatch_total: number;
  unclassified: number; // mismatch rows with no predicted SQL or no gold SQL
  // Per-axis counts; a mismatch contributes to every axis it diverges on, so
  // these sum to ≥ mismatch_total. `value_diff` is mutually exclusive of the rest.
  by_class: Record<MismatchClass, number>;
};

const EMPTY_COUNTS = (): Record<MismatchClass, number> => ({
  table_set: 0,
  agg_fn: 0,
  distinct: 0,
  group_by: 0,
  order_limit: 0,
  subquery: 0,
  value_diff: 0,
});

export function classifyReport(
  results: Pick<QuestionResult, "outcome" | "predicted_sql" | "question_id">[],
  goldByQuestionId: Map<number, string>,
): MismatchReport {
  const report: MismatchReport = { mismatch_total: 0, unclassified: 0, by_class: EMPTY_COUNTS() };
  for (const r of results) {
    if (r.outcome !== "mismatch") continue;
    report.mismatch_total += 1;
    const gold = goldByQuestionId.get(r.question_id);
    if (!r.predicted_sql || !gold) {
      report.unclassified += 1;
      continue;
    }
    for (const tag of classifyMismatch(r.predicted_sql, gold)) report.by_class[tag] += 1;
  }
  return report;
}

export const _testing = { baseTables, aggSet, classifyMismatch };

// CLI: bun src/mismatch-classify.ts --report <report.json> --gold <bird-gold.json>
// The gold file is the BIRD Mini-Dev questions JSON ({ question_id, SQL }[]).
if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const reportPath = flag("--report");
  const goldPath = flag("--gold");
  if (!reportPath || !goldPath) {
    console.error("usage: --report <report.json> --gold <bird-gold.json>");
    process.exit(2);
  }
  const report = JSON.parse(await Bun.file(reportPath).text()) as {
    results: QuestionResult[];
  };
  const goldRaw = JSON.parse(await Bun.file(goldPath).text()) as {
    question_id: number;
    SQL?: string;
    sql?: string;
  }[];
  const gold = new Map<number, string>();
  goldRaw.forEach((e, i) => gold.set(e.question_id ?? i, e.SQL ?? e.sql ?? ""));
  const out = classifyReport(report.results, gold);
  console.log(`mismatch_total=${out.mismatch_total} unclassified=${out.unclassified}`);
  for (const [k, v] of Object.entries(out.by_class).sort((a, b) => b[1] - a[1])) {
    console.log(`${String(v).padStart(4)}  ${k}`);
  }
}
