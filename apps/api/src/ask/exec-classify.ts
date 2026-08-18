// SK-ASK-027 — SQLSTATE classifier for the `/v1/ask` exec catch.
//
// Before this, exec's catch-all bucketed EVERY unrecognised Postgres error as
// `db_unreachable`: a transient label, so SK-ASK-013 burned three backoff
// retries replaying an error that could never succeed, and the user was told
// "couldn't reach the database — try again" about a foreign-key violation
// (2026-08-18, PG 23503).
//
// SQLSTATE's class (the first two characters) already carries the distinction:
//   08 / 53 / 57 / 58  + transport → genuinely transient, keep retrying
//   23                             → constraint violation, deterministic
//   22                             → data exception, deterministic
//   42P01 / 3F000                  → missing relation (schema-mismatch, prior art)
// Anything else stays in the transient bucket: the conservative choice keeps
// today's behaviour for classes we haven't met, and `recordExecUnreachable`
// logs its SQLSTATE so the next mislabeled class is one grep away.
//
// Lives in its own module (not inline in `orchestrate.ts`) so the happy path
// stays a clean cache → plan → exec arc, and so this table is unit-testable.

import type { ConstraintKind } from "@nlqdb/errors";
import type { AskError } from "./types.ts";

// Postgres constraint-violation SQLSTATEs (class 23) we can phrase precisely.
const CONSTRAINT_KINDS: Record<string, ConstraintKind> = {
  "23503": "fk",
  "23505": "unique",
  "23502": "not_null",
  "23514": "check",
};

export type ExecClassification =
  // Deterministic: return this error, no retry.
  | { kind: "deterministic"; error: AskError }
  // Transient or unrecognised: keep SK-ASK-013's retry + `db_unreachable`.
  | { kind: "transient" };

// Extracts the SQLSTATE from a driver error. `@neondatabase/serverless` and
// `pg` both expose it as `code`; ClickHouse and transport errors have none.
function sqlState(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : undefined;
}

// Constraint / table names come from the tenant's OWN schema, so echoing them
// is safe and is the only way the copy can name a fix. The driver's `detail`
// (which quotes row values) is deliberately not read.
function identifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,120}$/.test(value) ? value : undefined;
}

export function classifyExecError(err: unknown): ExecClassification {
  const state = sqlState(err);
  if (state === undefined) return { kind: "transient" };

  const constraintKind = CONSTRAINT_KINDS[state];
  if (constraintKind !== undefined || state.startsWith("23")) {
    const e = err as { constraint?: unknown; table?: unknown };
    return {
      kind: "deterministic",
      error: {
        code: "constraint_violation",
        ...(constraintKind !== undefined ? { kind: constraintKind } : {}),
        ...withKey("constraint", identifier(e.constraint)),
        ...withKey("table", identifier(e.table)),
      },
    };
  }

  // Class 22 — data exception (bad cast, numeric overflow, divide by zero).
  if (state.startsWith("22")) {
    return { kind: "deterministic", error: { code: "invalid_value", pgCode: state } };
  }

  // Classes 08 (connection), 53 (resources), 57 (operator intervention),
  // 58 (system) — and anything not yet met — keep the transient bucket.
  return { kind: "transient" };
}

function withKey<K extends string>(key: K, value: string | undefined) {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}
