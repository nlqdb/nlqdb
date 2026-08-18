// SK-ASK-030 — data-exception classifier for the `/v1/ask` exec catch.
//
// Postgres SQLSTATE class 22 is "the value doesn't fit": a failed cast, a
// numeric overflow, a divide by zero, an out-of-range date. Like class 23
// (`write-constraint.ts`) it is deterministic — replaying the identical
// statement replays the failure — so it must not land in the catch-all's
// transient `db_unreachable` bucket, which cost the 2026-08-18 incident three
// backoff attempts and told the user to "try again" about a certain failure.
//
// Sits beside `schema-mismatch.ts` (missing relation), `write-constraint.ts`
// (integrity constraints) and `exec-repair.ts` (re-plannable shapes) so the
// happy path stays a clean cache → plan → exec arc, and each classifier's
// table is unit-testable on its own.
//
// Only the SQLSTATE crosses the boundary. The driver's message quotes the
// offending value, which is tenant data (GLOBAL-037), so it stays on the span
// and the KV diag sink.

const DATA_EXCEPTION_MSG =
  /invalid input syntax|out of range|division by zero|cannot be cast|invalid value for/i;

// Returns the SQLSTATE when `err` is a class-22 data exception, else null.
// The message fallback covers Neon's HTTP driver, which drops `.code` on some
// responses (the same gap `write-constraint.ts` compensates for).
export function classifyDataException(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === "string" && /^22[0-9A-Z]{3}$/.test(code)) return code;
  if (typeof code === "string" && code !== "") return null;
  const msg = err instanceof Error ? err.message : String(err);
  return DATA_EXCEPTION_MSG.test(msg) ? "22000" : null;
}
