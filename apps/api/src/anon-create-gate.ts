// WS5 fix C — anon create-cap gate, split into peek + commit.
//
// Today's behaviour (post-PR #146): the route handler peeks the
// per-IP create bucket, runs Turnstile when the burst gate trips,
// and records the create BEFORE the orchestrator runs. A failed
// orchestrator (LLM `ambiguous_goal`, `plan_invalid`, compile error,
// …) burned the user's cap with nothing to show for it. WS8's
// SK-ANON-012 lowers the cap to 1/device, which would turn any
// typo-driven failure into a hard lockout.
//
// The split here:
//   * `peekAnonCreateGate` runs at gate entry — peeks the buckets,
//     verifies Turnstile when the burst gate trips, returns a
//     typed decision. **No `recordCreate` side effect.**
//   * `commitAnonCreate` is a one-line wrapper around the limiter's
//     `recordCreate`, called by the route handler after the
//     orchestrator returns `result.ok === true` (or after the
//     speculative-create reconciler commits an ok result).
//
// Both halves no-op for non-anon principals (SK-ANON-006 keeps
// `principal.kind` out of the orchestrator; this module is the
// route-layer home for the anon-conditional logic). The pure
// `verifyTurnstile` dep is injected so tests can stub it without
// reaching for `vi.mock`.

import type { AnonCreateVerdict, AnonRateLimiter } from "./anon-rate-limit.ts";
import type { verifyTurnstile as verifyTurnstileFn } from "./turnstile.ts";

export type AnonPeekAllowed = Extract<AnonCreateVerdict, { ok: true }>;
export type AnonPeekRateLimited = Extract<AnonCreateVerdict, { ok: false }>;

export type AnonCreateGateDecision =
  | { kind: "skip" }
  | { kind: "allow"; peek: AnonPeekAllowed }
  | { kind: "rate_limited"; peek: AnonPeekRateLimited }
  | { kind: "challenge_required"; peek: AnonPeekAllowed };

export type AnonCreateGateDeps = {
  limiter: AnonRateLimiter;
  verifyTurnstile: typeof verifyTurnstileFn;
};

export type AnonCreateGateInput = {
  principalKind: "anon" | "user";
  ip: string;
  turnstileSecret: string | undefined;
  turnstileToken: string | null;
};

export async function peekAnonCreateGate(
  deps: AnonCreateGateDeps,
  input: AnonCreateGateInput,
): Promise<AnonCreateGateDecision> {
  if (input.principalKind !== "anon") return { kind: "skip" };
  const peek = await deps.limiter.peekCreate(input.ip);
  if (!peek.ok) return { kind: "rate_limited", peek };
  if (peek.needsChallenge) {
    const verify = await deps.verifyTurnstile(
      input.turnstileToken,
      input.turnstileSecret,
      input.ip,
    );
    // SK-ANON-009 — fail-open when the secret is unset (dev / tests).
    // Production always has it; the route handler still enforces the
    // production-configured contract through verifyTurnstile itself.
    const allowed = verify.ok || verify.reason === "unconfigured";
    if (!allowed) return { kind: "challenge_required", peek };
  }
  return { kind: "allow", peek };
}

export async function commitAnonCreate(
  deps: Pick<AnonCreateGateDeps, "limiter">,
  input: Pick<AnonCreateGateInput, "principalKind" | "ip">,
): Promise<void> {
  if (input.principalKind !== "anon") return;
  await deps.limiter.recordCreate(input.ip);
}
