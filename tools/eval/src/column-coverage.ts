// SK-QUAL-015 — offline column-coverage harness.
//
// The §4 #2 backlog lever (`quality-score-source-of-truth.md`) is "value
// retrieval + column-level pruning (the M-Schema half SK-LLM-037/T19 left)".
// SK-LLM-037 prunes whole *tables* by goal-token match and is recall-monotone
// because the FK closure re-admits join targets. Pruning *columns* by the same
// goal-token rule has no such safety net — a needed column that shares no token
// with the goal is simply dropped — so §4 #2 says the column pruner "needs an
// offline recall harness like T19's first". This is that harness.
//
// It measures the **recall ceiling** of goal-token column pruning: of the
// columns a gold query references, what fraction share a `wordTokens` token
// (the *same* tokenizer the real pruner uses, imported from @nlqdb/llm) with
// the goal+evidence text. The uncovered remainder is split into:
//   - key-like  (id/key/code/ref/link_to_…) — a join/PK column a future
//     FK/PK-protection rule re-admits without the goal naming it, the way
//     SK-LLM-037's FK closure re-admits join *tables*; and
//   - value/measure — a column the goal names by its *value* not its name
//     ("SME" → `Segment`, "CZK" → `Currency`), recoverable only by the
//     value-retrieval half of §4 #2, never by pruning.
//
// Pure + deterministic: reads a BIRD gold JSON (the same file `analyze-mismatches`
// is handed), no keys, no quota, no chain change. A *ceiling*, not the real
// pruner's recall — it counts only qualified `alias.column` references (the
// unambiguous ones) and can't see the full DDL (PK/FK declarations, types),
// so the real pruner with key-protection lands at or above the key-inclusive
// number. The value/measure fraction is the load-bearing finding: it is the
// recall a column pruner *cannot* recover, and it sizes the value-retrieval
// lever directly.

import { wordTokens } from "@nlqdb/llm";

// A qualified reference `alias.column` is unambiguous: whatever follows the dot
// is a column. We deliberately ignore bare (unqualified) identifiers — they
// collide with table names and aliases and would inflate the count with noise
// (the bug this harness avoids, mirroring SK-QUAL-014's quote-aware parser).
const QUALIFIED_COL_RE = /\b[A-Za-z_]\w*\.\s*([A-Za-z_]\w*)/g;

// Strip single-quoted string literals so a value like `'CustomerID'` inside a
// WHERE never reads as a column reference.
function stripLiterals(sql: string): string {
  return sql.replace(/'[^']*'/g, " ");
}

// Qualified column references in a gold SQL, lowercased.
export function goldColumns(sql: string): Set<string> {
  const out = new Set<string>();
  for (const m of stripLiterals(sql).matchAll(QUALIFIED_COL_RE)) {
    const c = (m[1] ?? "").toLowerCase();
    if (c) out.add(c);
  }
  return out;
}

// Standard join/primary-key naming: a column a future FK/PK-protection rule
// re-admits without the goal naming it. Suffix match (not `(^|_)`-anchored) so
// concatenated keys are caught too — BIRD writes `raceId`, `driverId`,
// `CustomerID`, `CDSCode` without a separator. Conventional shapes only, so a
// genuinely value-grounded column rarely lands here (a stray `grid` is noise
// in a split that is secondary colour to the isKeyLike-independent coverage %).
export function isKeyLike(col: string): boolean {
  return /(id|key|code|ref|fk)s?$/i.test(col) || /^(fk_|link_to_)/i.test(col);
}

// True when any token of the column appears in the goal's token set — i.e. a
// goal-token column filter would keep it.
export function coveredByGoal(col: string, goalTokens: Set<string>): boolean {
  for (const t of wordTokens(col)) if (goalTokens.has(t)) return true;
  return false;
}

export type CoverageResult = {
  questions: number;
  total: number;
  covered: number;
  uncoveredKey: number;
  uncoveredValue: number;
  coverage: number; // covered / total
  // Busiest uncovered value/measure columns — the value-retrieval targets.
  topValueMisses: Array<[string, number]>;
};

type GoldEntry = {
  question?: string;
  evidence?: string;
  SQL?: string;
  sql?: string;
};

export function coverage(gold: GoldEntry[]): CoverageResult {
  let total = 0;
  let covered = 0;
  let uncoveredKey = 0;
  let uncoveredValue = 0;
  const valueMisses = new Map<string, number>();

  for (const q of gold) {
    const sql = q.SQL ?? q.sql ?? "";
    if (!sql) continue;
    const goalTokens = wordTokens(`${q.question ?? ""} ${q.evidence ?? ""}`);
    for (const col of goldColumns(sql)) {
      total++;
      if (coveredByGoal(col, goalTokens)) {
        covered++;
      } else if (isKeyLike(col)) {
        uncoveredKey++;
      } else {
        uncoveredValue++;
        valueMisses.set(col, (valueMisses.get(col) ?? 0) + 1);
      }
    }
  }

  return {
    questions: gold.length,
    total,
    covered,
    uncoveredKey,
    uncoveredValue,
    coverage: total === 0 ? 0 : Math.round((covered / total) * 10_000) / 10_000,
    topValueMisses: [...valueMisses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
  };
}

// ---- CLI ----------------------------------------------------------------
// Usage: bun src/column-coverage.ts <gold-questions.json>
//   gold-questions.json — the BIRD `mini_dev_sqlite-*.json` (question + SQL/sql)
// Prints the recall ceiling of goal-token column pruning + the value-miss list.

if (import.meta.main) {
  const [goldPath] = process.argv.slice(2);
  if (!goldPath) {
    console.error("usage: bun src/column-coverage.ts <gold-questions.json>");
    process.exit(2);
  }
  const gold = JSON.parse(await Bun.file(goldPath).text()) as GoldEntry[];
  const r = coverage(gold);
  const pc = (n: number) => `${((n / r.total) * 100).toFixed(1)}%`;
  console.info(`column-coverage — ${r.questions} questions, ${r.total} qualified column refs`);
  console.info(`  covered by goal token (pruner keeps): ${r.covered} (${pc(r.covered)})`);
  console.info(
    `  uncovered, key-like (FK/PK rule re-admits): ${r.uncoveredKey} (${pc(r.uncoveredKey)})`,
  );
  console.info(
    `  uncovered, value/measure (only value retrieval recovers): ${r.uncoveredValue} (${pc(r.uncoveredValue)})`,
  );
  console.info("  top value/measure misses (value-retrieval targets):");
  for (const [c, n] of r.topValueMisses) console.info(`    ${String(n).padStart(3)}  ${c}`);
}
