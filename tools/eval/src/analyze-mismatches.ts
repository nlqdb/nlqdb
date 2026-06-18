// SK-QUAL-014 — offline mismatch error-class classifier.
//
// A canonical eval run records 200+ `mismatch` rows (BIRD 2026-06-12: 236/500)
// but the report only counts them — it never says *how* the predicted SQL
// differs from gold. This pure classifier diffs predicted vs gold SQL on a
// fixed set of structural features so a run's loss mass can be bucketed
// (aggregation grain, DISTINCT grain, join/table count, subquery shape,
// projection width, ...) and the §4 backlog in
// `docs/progress/quality-score-source-of-truth.md` can be prioritised from
// evidence instead of guesswork.
//
// It is deliberately a *surface* diff: tags flag a structural difference, not
// a proven semantic error. `SUM(IIF(...))` vs `COUNT(*)` can be equivalent,
// and BIRD carries known gold-annotation noise (§4 #5), so a tag is a lead to
// read, not a verdict. The quote-aware table parser matters — predicted SQL
// frequently quotes identifiers (`FROM "transactions_1k"`); a bare-word-only
// regex undercounts tables and falsely inflates `fewer_tables` (the bug this
// harness was written to avoid).

const norm = (s: string): string => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
const re = (s: string, r: RegExp): boolean => r.test(s);
const count = (s: string, r: RegExp): number => (s.match(r) || []).length;

// `"name"` / `` `name` `` / `[name]` / bare — the four quoting forms our
// dialects emit. Bare-word-only matching undercounts quoted tables.
const TABLE_RE = /\b(?:from|join)\s+(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-z_][\w]*))/g;

export function tablesIn(sql: string): Set<string> {
  const set = new Set<string>();
  for (const m of sql.matchAll(TABLE_RE))
    set.add((m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").toLowerCase());
  return set;
}

function selectColumnCount(sql: string): number {
  const m = sql.match(/select\s+(.*?)\s+from\b/s);
  if (!m) return 0;
  let depth = 0;
  let cols = 1;
  for (const ch of m[1] ?? "") {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) cols++;
  }
  return cols;
}

function aggFns(sql: string): Set<string> {
  return new Set([...sql.matchAll(/\b(count|sum|avg|max|min)\s*\(/g)].map((m) => m[1] ?? ""));
}

// Non-exclusive structural-difference tags between a predicted and gold SQL.
// Empty gold returns `[]` (nothing to compare against); empty prediction is
// tagged `empty_pred`.
export function classifyMismatch(predictedSql: string, goldSql: string): string[] {
  const p = norm(predictedSql);
  const g = norm(goldSql);
  if (!g) return [];
  if (!p) return ["empty_pred"];

  const tags: string[] = [];

  if (re(g, /\bdistinct\b/) && !re(p, /\bdistinct\b/)) tags.push("missing_DISTINCT");
  else if (!re(g, /\bdistinct\b/) && re(p, /\bdistinct\b/)) tags.push("extra_DISTINCT");

  if (re(g, /\bhaving\b/) && !re(p, /\bhaving\b/)) tags.push("missing_HAVING");

  if (re(g, /\bgroup by\b/) && !re(p, /\bgroup by\b/)) tags.push("missing_GROUPBY");
  else if (!re(g, /\bgroup by\b/) && re(p, /\bgroup by\b/)) tags.push("extra_GROUPBY");

  const gt = tablesIn(g);
  const pt = tablesIn(p);
  if (pt.size < gt.size) tags.push("fewer_tables");
  else if (pt.size > gt.size) tags.push("more_tables");

  if (selectColumnCount(p) !== selectColumnCount(g)) tags.push("col_count_diff");

  const ga = aggFns(g);
  const pa = aggFns(p);
  if ([...ga].some((a) => !pa.has(a)) || [...pa].some((a) => !ga.has(a))) tags.push("agg_fn_diff");

  if (re(g, /\blimit\b/) !== re(p, /\blimit\b/)) tags.push("limit_diff");
  if (re(g, /\border by\b/) !== re(p, /\border by\b/)) tags.push("orderby_diff");

  if (re(g, /\bcast\s*\(/) && !re(p, /\bcast\s*\(/)) tags.push("missing_CAST");
  if (re(g, /is not null/) && !re(p, /is not null/)) tags.push("missing_NOTNULL");

  const gsub = count(g, /\bselect\b/g);
  const psub = count(p, /\bselect\b/g);
  if (gsub > psub) tags.push("fewer_subqueries");
  else if (gsub < psub) tags.push("more_subqueries");

  if (tags.length === 0) tags.push("other_predicate_or_value");
  return tags;
}

// ---- CLI ----------------------------------------------------------------
// Usage: bun src/analyze-mismatches.ts <baseline.json> <gold-questions.json>
//   baseline.json       — an EvalReport (results[] with question_id + outcome + predicted_sql)
//   gold-questions.json — the BIRD `mini_dev_sqlite-*.json` (question_id + SQL/sql)
// Prints the mismatch error-class histogram (tags non-exclusive).

type GoldEntry = { question_id?: number; SQL?: string; sql?: string };

export function histogram(
  results: Array<{ question_id: number; outcome: string; predicted_sql: string }>,
  gold: GoldEntry[],
): { joined: number; total: number; tally: Array<[string, number]> } {
  const goldById = new Map<number, GoldEntry>();
  gold.forEach((g, i) => {
    goldById.set(g.question_id ?? i, g);
  });
  const mism = results.filter((r) => r.outcome === "mismatch");
  const counts = new Map<string, number>();
  let joined = 0;
  for (const r of mism) {
    const g = goldById.get(r.question_id);
    if (!g) continue;
    joined++;
    for (const t of classifyMismatch(r.predicted_sql, g.SQL ?? g.sql ?? "")) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return {
    joined,
    total: mism.length,
    tally: [...counts.entries()].sort((a, b) => b[1] - a[1]),
  };
}

if (import.meta.main) {
  const [basePath, goldPath] = process.argv.slice(2);
  if (!basePath || !goldPath) {
    console.error("usage: bun src/analyze-mismatches.ts <baseline.json> <gold-questions.json>");
    process.exit(2);
  }
  const base = JSON.parse(await Bun.file(basePath).text());
  const gold = JSON.parse(await Bun.file(goldPath).text());
  const { joined, total, tally } = histogram(base.results ?? [], gold);
  console.info(`mismatches joined: ${joined} of ${total}`);
  console.info("error-class tally (tags non-exclusive):");
  for (const [k, n] of tally) console.info(`  ${String(n).padStart(3)}  ${k}`);
}
