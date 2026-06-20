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

// Single-quoted string literals, case **preserved** ('' is an escaped quote) —
// casing is the value-grounding signal (`'SME'` vs `'Sme'`) the §4 #2a
// value-retrieval lever targets, so we must not lowercase here.
export function literalsIn(sql: string): string[] {
  return [...(sql || "").matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1] ?? "");
}
const multiset = (xs: string[]): string => xs.slice().sort().join("");
// Mask every string literal to a placeholder so two SQLs compare on structure
// alone (whitespace/case-normalised) — the shared "is the structure identical?"
// guard behind both `isLiteralOnly` and `isDateLiteralOnly`.
const maskLiterals = (s: string): string => norm(s).replace(/'(?:[^']|'')*'/g, "'?'");
// Date-canonical literal multiset — collapses the date-encoding diff so a
// date-only mismatch is detectable; used by `isDateLiteralOnly` + the tag.
const dateMultiset = (xs: string[]): string => multiset(xs.map(canonDate));

// True when masking every string literal to a placeholder makes predicted and
// gold byte-identical (whitespace/case-normalised) **and** their literal sets
// actually differ — i.e. the SQL structure is correct and the *only* error is
// the string-literal values. This is the count that sizes the value-retrieval
// lever's standalone ceiling: a `literal_only` mismatch is one a sample-value
// prompt could flip to a match without any reasoning change.
export function isLiteralOnly(predictedSql: string, goldSql: string): boolean {
  return (
    multiset(literalsIn(predictedSql)) !== multiset(literalsIn(goldSql)) &&
    maskLiterals(predictedSql) === maskLiterals(goldSql)
  );
}

// Canonicalise a date-shaped string literal to zero-padded `YYYY-MM-DD`,
// stripping one trailing LIKE wildcard. Non-date literals pass through
// unchanged. So `'2019-8-20'`, `'2019-08-20'`, and `'2019-08-20%'` all collapse
// to `2019-08-20` — the date-encoding equivalence the §4 #2c directive targets.
// A time component is preserved (only the date head is padded) so a date-only
// vs datetime literal is **not** falsely equated.
const DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})(.*?)%?$/;
export function canonDate(lit: string): string {
  const m = lit.match(DATE_RE);
  if (!m) return lit;
  return `${m[1]}-${(m[2] ?? "").padStart(2, "0")}-${(m[3] ?? "").padStart(2, "0")}${m[4] ?? ""}`;
}

// True when the SQL structure is correct and the *only* error is date-encoding
// of string literals — i.e. canonicalising every literal's date head makes the
// literal multisets match while the masked structure is already identical. This
// sizes the §4 #2c date-normalisation directive's **standalone** ceiling: a
// `date_literal_only` mismatch is one a single PLAN_DIRECTIVES bullet could flip
// without any reasoning change. The masked-structure guard keeps `LIKE '…%'` vs
// `= '…'` out — that needs an operator change too, so it is not date-only.
export function isDateLiteralOnly(predictedSql: string, goldSql: string): boolean {
  const pLits = literalsIn(predictedSql);
  const gLits = literalsIn(goldSql);
  return (
    multiset(pLits) !== multiset(gLits) &&
    dateMultiset(pLits) === dateMultiset(gLits) &&
    maskLiterals(predictedSql) === maskLiterals(goldSql)
  );
}

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

  // Literal-grounding axis (the §4 #2a value-retrieval target): the
  // structural tags above never inspect string-literal values, so a
  // wrong/mis-cased constant (`'Sme'` for `'SME'`) used to fall into the
  // `other_predicate_or_value` catch-all undifferentiated. Compare the
  // case-preserved literal multisets directly so the value-grounding mass is
  // counted on its own. `literal_case_only` is the clean value-retrieval win
  // (right value, wrong case); a date-shaped diff (`'2019-8-20'`) is a
  // date-encoding error a directive, not value-sampling, fixes.
  const gLits = literalsIn(goldSql);
  const pLits = literalsIn(predictedSql);
  if (multiset(gLits) !== multiset(pLits)) {
    tags.push("literal_diff");
    const ci = (xs: string[]): string => multiset(xs.map((x) => x.toLowerCase()));
    if (ci(gLits) === ci(pLits)) tags.push("literal_case_only");
    // Date-encoding sub-class of the literal diff (§4 #2c): the whole literal
    // diff vanishes once date heads are canonicalised (`'2019-8-20'` vs
    // `'2019-08-20'`). A directive, not value-sampling, fixes these.
    if (dateMultiset(gLits) === dateMultiset(pLits)) tags.push("date_literal_only");
  }

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
): {
  joined: number;
  total: number;
  tally: Array<[string, number]>;
  literalOnly: number;
  dateLiteralOnly: number;
} {
  const goldById = new Map<number, GoldEntry>();
  gold.forEach((g, i) => {
    goldById.set(g.question_id ?? i, g);
  });
  const mism = results.filter((r) => r.outcome === "mismatch");
  const counts = new Map<string, number>();
  let joined = 0;
  let literalOnly = 0;
  let dateLiteralOnly = 0;
  for (const r of mism) {
    const g = goldById.get(r.question_id);
    if (!g) continue;
    joined++;
    const goldSql = g.SQL ?? g.sql ?? "";
    if (isLiteralOnly(r.predicted_sql, goldSql)) literalOnly++;
    if (isDateLiteralOnly(r.predicted_sql, goldSql)) dateLiteralOnly++;
    for (const t of classifyMismatch(r.predicted_sql, goldSql)) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return {
    joined,
    total: mism.length,
    tally: [...counts.entries()].sort((a, b) => b[1] - a[1]),
    literalOnly,
    dateLiteralOnly,
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
  const { joined, total, tally, literalOnly, dateLiteralOnly } = histogram(
    base.results ?? [],
    gold,
  );
  console.info(`mismatches joined: ${joined} of ${total}`);
  console.info(
    `literal_only (recoverable by value-retrieval alone — structure correct, only string literals differ): ${literalOnly}`,
  );
  console.info(
    `date_literal_only (recoverable by the §4 #2c date-normalisation directive alone — structure correct, only date-encoding of literals differs): ${dateLiteralOnly}`,
  );
  console.info("error-class tally (tags non-exclusive):");
  for (const [k, n] of tally) console.info(`  ${String(n).padStart(3)}  ${k}`);
}
