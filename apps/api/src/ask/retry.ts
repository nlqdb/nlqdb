// GLOBAL-022 server-side, per-stage retry helper. Each pipeline stage
// (route, plan, exec) wraps its work in `withStageRetry` so a single
// transient failure — LLM provider chain exhausted, validator rejected
// the LLM's SQL, Neon hiccup mid-exec — never reaches the caller.
//
// Three attempts max per stage. The `fn` callback receives the
// previous attempt's error so prompt-driven stages (plan) can feed it
// into the next prompt as feedback; non-prompt stages (exec) ignore it.
//
// Each retry stamps `nlqdb.retry.attempt` on the active span and
// increments `nlqdb.retry.total{stage, reason}` (per GLOBAL-014).
// Dashboards alert when the retry rate climbs — sustained recovery
// means something is genuinely broken, not just flaky.
//
// Recoverability classification:
//   • Default — retry. Anything we can't classify is treated as transient
//     so rare unknowns don't surface.
//   • `Nonrecoverable` (subclass below) — propagate immediately. Use for
//     config bugs, billing-cap exhaustion, 4xx caller errors.

import { retryTotal } from "@nlqdb/otel";
import { trace } from "@opentelemetry/api";

export type StageName = "route" | "plan" | "exec";

export const RETRY_MAX_ATTEMPTS = 3;

// Tag thrown by `fn` to signal the error must NOT trigger a retry.
// The wrapped error is rethrown unchanged after one attempt. Used for
// 4xx caller errors, config bugs, quota exhaustion — anything where
// retrying just delays surfacing the real problem.
export class Nonrecoverable extends Error {
  constructor(
    message: string,
    override readonly cause: unknown,
  ) {
    super(message);
    this.name = "Nonrecoverable";
  }
}

export type RetryReason =
  | "timeout"
  | "network"
  | "http_5xx"
  | "llm_failed"
  | "sql_rejected"
  | "db_unreachable"
  | "parse"
  | "unknown";

export type WithStageRetryOpts = {
  // Maps an error to a retry reason for the metric label. Lets stages
  // surface their own cardinality-bounded reasons (e.g. plan distinguishes
  // `sql_rejected` from `llm_failed`). Defaults to `classifyDefault`.
  reasonOf?: (err: unknown) => RetryReason;
  // SK-ASK-013 — delay before the NEXT attempt, keyed by the attempt that
  // just failed (1-based). Default (undefined) → instant retry, which is
  // right for plan/route (their transient is an LLM provider that fails
  // over to a sibling immediately). The exec stage opts in: its dominant
  // transient is a scale-to-zero Neon compute (`db_unreachable`) that needs
  // wall-time to resume — instant retries just replay the same cold state.
  backoffMs?: (failedAttempt: number) => number;
  // Injectable sleep so backoff is testable without real timers.
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function withStageRetry<T>(
  stage: StageName,
  fn: (attempt: number, prevError: Error | null) => Promise<T>,
  opts: WithStageRetryOpts = {},
): Promise<T> {
  const reasonOf = opts.reasonOf ?? classifyDefault;
  const sleep = opts.sleep ?? defaultSleep;
  let prevError: Error | null = null;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn(attempt, prevError);
    } catch (err) {
      if (err instanceof Nonrecoverable) {
        throw err.cause instanceof Error ? err.cause : new Error(String(err.cause));
      }
      const wrapped = err instanceof Error ? err : new Error(String(err));
      prevError = wrapped;
      retryTotal().add(1, { stage, reason: reasonOf(wrapped) });
      const span = trace.getActiveSpan();
      // Stamp the highest attempt index reached. Set instead of
      // increment so a per-request value is unambiguous when multiple
      // stages retry inside the same parent span — dashboards read
      // the max across stages, which is what matters for SLO.
      if (span) span.setAttribute("nlqdb.retry.attempt", attempt);
      if (attempt === RETRY_MAX_ATTEMPTS) throw wrapped;
      const wait = opts.backoffMs?.(attempt) ?? 0;
      if (wait > 0) await sleep(wait);
    }
  }
  // Unreachable — the loop either returns on success or throws on the
  // final attempt. Defensive in case the bound is ever raised below 1.
  throw prevError ?? new Error(`withStageRetry(${stage}): exhausted`);
}

// Best-effort classification when the stage hasn't supplied its own.
// Recognised: AbortError → `timeout`; messages mentioning rate-limit /
// 5xx / network. Everything else → `unknown` (still recoverable —
// `Nonrecoverable` is the explicit opt-out).
function classifyDefault(err: unknown): RetryReason {
  if (!(err instanceof Error)) return "unknown";
  if (err.name === "AbortError") return "timeout";
  const msg = err.message.toLowerCase();
  if (msg.includes("timeout") || msg.includes("aborted")) return "timeout";
  if (msg.includes("network") || msg.includes("fetch failed")) return "network";
  if (msg.includes("5xx") || msg.includes("503") || msg.includes("502")) return "http_5xx";
  if (msg.includes("parse")) return "parse";
  return "unknown";
}
