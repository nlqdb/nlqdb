// SK-ASK-029 — integrity-constraint classifier for the `/v1/ask` exec catch.
// Postgres SQLSTATE class 23 (`23502` not-null, `23503` foreign key, `23505`
// unique, `23514` check) is deterministic: the values in the statement are
// wrong, so retrying replays the same failure and "Couldn't reach the
// database" is a lie. Sits beside `schema-mismatch.ts` (missing relation) and
// `exec-repair.ts` (re-plannable shapes) so the happy path stays a clean
// cache → plan → exec arc.
//
// Only identifiers are lifted out of the PG message (table, column,
// constraint name) — never the offending values, which would put user data
// in an error body (`GLOBAL-037`).

import { Nonrecoverable } from "./retry.ts";
import { WriteConstraintError, type WriteConstraintKind } from "./types.ts";

const KIND_BY_SQLSTATE: Record<string, WriteConstraintKind> = {
  "23502": "not_null",
  "23503": "foreign_key",
  "23505": "unique",
  "23514": "check",
  "23P01": "exclusion",
};

// Message fallbacks for Neon HTTP responses that drop `.code`. Kept disjoint
// from `schema-mismatch.ts` / `exec-repair.ts` patterns.
const KIND_BY_MESSAGE: [RegExp, WriteConstraintKind][] = [
  [/violates not-null constraint/i, "not_null"],
  [/violates foreign key constraint/i, "foreign_key"],
  [/violates unique constraint|duplicate key value/i, "unique"],
  [/violates check constraint/i, "check"],
  [/violates exclusion constraint/i, "exclusion"],
];

// Returns a `Nonrecoverable` ready to throw when `err` is a constraint
// violation, or `null` otherwise. `Nonrecoverable` (not a bare throw) is what
// bails SK-ASK-013's exec retry — three replays of a rejected value only add
// latency to a certain failure.
export function classifyWriteConstraint(err: unknown): Nonrecoverable | null {
  const code = (err as { code?: string } | null)?.code;
  const msg = err instanceof Error ? err.message : String(err);
  const kind =
    (typeof code === "string" ? KIND_BY_SQLSTATE[code] : undefined) ??
    KIND_BY_MESSAGE.find(([re]) => re.test(msg))?.[1];
  if (!kind) return null;
  return new Nonrecoverable(
    "write_constraint",
    new WriteConstraintError(kind, {
      ...pick("table", /(?:on table|of relation|relation) "([^"]+)"/i, msg),
      // `column "x"` is the not-null shape; FK / unique name the column(s) in
      // the DETAIL line as `Key (x)=(…)` — we take the parenthesised column
      // list only, never the `=(value)` half.
      ...pick("column", /column "([^"]+)"|Key \(([^)]+)\)\s*=/i, msg),
      ...pick("constraint", /constraint "([^"]+)"/i, msg),
    }),
  );
}

function pick(field: string, re: RegExp, msg: string): Record<string, string> {
  const match = re.exec(msg);
  const value = match?.[1] ?? match?.[2];
  return value ? { [field]: value } : {};
}
