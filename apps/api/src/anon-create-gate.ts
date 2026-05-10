// Anon create-cap gate, split into peek + commit (WS5 fix C, WS8 SK-ANON-012).
//
// Today's behaviour (post-WS8 SK-ANON-012): the route handler peeks
// the per-device create counter (`anon:create:device:<principalIdHash>`),
// verifies Turnstile unconditionally (SK-ANON-009 fail-open semantics
// intact for dev), and records the create ONLY after the orchestrator
// returns `result.ok === true`. A failed first create (typo / ambiguous
// goal / DDL compile error) no longer burns the user's one-call budget.
//
// The split:
//   * `peekAnonCreateGate` runs at gate entry — verifies Turnstile and
//     peeks the device cap in parallel, returns a typed decision.
//     **No `recordDevice` side effect.** Order of failure preference:
//     Turnstile (bot-floor) → device cap (auth-wall). The Turnstile
//     check runs before the cap so a fresh device still gets the bot
//     shield (bots can mint anon tokens trivially).
//   * `commitAnonCreate` is a one-line wrapper around the limiter's
//     `recordDevice`, called by the route handler after the
//     orchestrator returns `result.ok === true` (or after the
//     speculative-create reconciler commits an ok result).
//
// Both halves no-op for non-anon principals (SK-ANON-006 keeps
// `principal.kind` out of the orchestrator; this module is the
// route-layer home for the anon-conditional logic). The pure
// `verifyTurnstile` dep is injected so tests can stub it without
// reaching for `vi.mock`.

import type { AnonDeviceVerdict, AnonRateLimiter } from "./anon-rate-limit.ts";
import type { verifyTurnstile as verifyTurnstileFn } from "./turnstile.ts";

export type AnonPeekAllowed = Extract<AnonDeviceVerdict, { ok: true }>;
export type AnonPeekDeviceCap = Extract<AnonDeviceVerdict, { ok: false }>;

export type AnonCreateGateDecision =
  | { kind: "skip" }
  | { kind: "allow"; peek: AnonPeekAllowed }
  | { kind: "auth_required"; peek: AnonPeekDeviceCap }
  | { kind: "challenge_required"; peek: AnonDeviceVerdict };

export type AnonCreateGateDeps = {
  limiter: AnonRateLimiter;
  verifyTurnstile: typeof verifyTurnstileFn;
};

export type AnonCreateGateInput = {
  principalKind: "anon" | "user";
  // SK-ANON-008 principal id (`anon:<sha256(token)[:16]>` for anon).
  principalId: string;
  // Remote IP — only used as Turnstile's `remoteip` hint (`SK-ANON-007`).
  // No KV key derives from it post-SK-ANON-012.
  ip: string;
  turnstileSecret: string | undefined;
  turnstileToken: string | null;
};

export async function peekAnonCreateGate(
  deps: AnonCreateGateDeps,
  input: AnonCreateGateInput,
): Promise<AnonCreateGateDecision> {
  if (input.principalKind !== "anon") return { kind: "skip" };

  // SK-ANON-012 — Turnstile runs unconditionally on every anon create
  // (not gated on burst count, since the per-device 1-call cap makes
  // a burst gate redundant). SK-ANON-009 fail-open semantics intact:
  // when the secret is unset (dev / tests) the verify returns
  // `unconfigured` and we treat it as allow-through. Turnstile +
  // device peek run in parallel — both are KV-bound; serializing
  // adds a needless round-trip.
  const [verify, peek] = await Promise.all([
    deps.verifyTurnstile(input.turnstileToken, input.turnstileSecret, input.ip),
    deps.limiter.peekDevice(input.principalId),
  ]);
  const turnstileAllowed = verify.ok || verify.reason === "unconfigured";

  // Turnstile is the bot-floor — runs before the cap check so the
  // floor stays in place even on a fresh device (bots can mint anon
  // tokens trivially).
  if (!turnstileAllowed) return { kind: "challenge_required", peek };
  if (!peek.ok) return { kind: "auth_required", peek };
  return { kind: "allow", peek };
}

export async function commitAnonCreate(
  deps: Pick<AnonCreateGateDeps, "limiter">,
  input: Pick<AnonCreateGateInput, "principalKind" | "principalId">,
): Promise<void> {
  if (input.principalKind !== "anon") return;
  await deps.limiter.recordDevice(input.principalId);
}
