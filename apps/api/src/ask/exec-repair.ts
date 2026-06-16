// SK-ASK-022 — execution-guided repair classifier for the `/v1/ask`
// exec catch. A Postgres exec error whose SQLSTATE marks the SQL as
// deterministically malformed-but-fixable (a wrong column, a GROUP BY
// omission, an operator/type mismatch, a bad literal cast) is neither a
// transient (retrying the identical SQL just replays it — SK-ASK-013's
// retry is wasted) nor a missing relation (that's SK-ASK-016/019
// `schema_mismatch`). The fix is to re-plan once with the PG error fed
// back: the plan prompt already diagnoses `previousAttempt.error`
// against the full (unpruned) schema (SK-LLM-018 / SK-LLM-037).
//
// Lives here (not inline in orchestrate) so the happy path stays a clean
// cache → plan → exec arc, mirroring `schema-mismatch.ts`.

// Deterministic, re-plannable SQLSTATE classes. Excludes 42P01 / 3F000
// (schema_mismatch) and connection/transient errors (those keep the
// SK-ASK-013 retry). Each names something the planner can fix given the
// schema + the error text.
const REPLANNABLE_SQLSTATE = new Set([
  "42703", // undefined_column
  "42883", // undefined_function / operator does not exist
  "42803", // grouping_error — column must appear in GROUP BY
  "42P10", // invalid_column_reference (ORDER BY / GROUP BY position)
  "42702", // ambiguous_column
  "42725", // ambiguous_function
  "42P18", // indeterminate_datatype
  "42804", // datatype_mismatch
  "42846", // cannot_coerce
  "22P02", // invalid_text_representation (bad literal cast)
  "42601", // syntax_error (rare past the allowlist, but deterministic)
]);

// Message fallbacks for Neon HTTP responses that drop `.code`. Kept
// disjoint from `schema-mismatch.ts`'s "relation … does not exist" so a
// missing table never misroutes into repair.
const REPLANNABLE_MSG =
  /(column .* does not exist|must appear in the group by|function .* does not exist|operator does not exist|is ambiguous|invalid input syntax for|could not (?:determine|coerce))/i;

// True when `err` is a deterministic-but-re-plannable Postgres exec
// error. Call only after `classifySchemaError` has returned null, so a
// missing relation (42P01) is already handled as `schema_mismatch`.
export function isReplannableExecError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  if (typeof code === "string" && REPLANNABLE_SQLSTATE.has(code)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return REPLANNABLE_MSG.test(msg);
}
