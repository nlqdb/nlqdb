// Anon create-cap gate, split into peek + commit (WS5 fix C, WS8 SK-ANON-012).
//
// Post-WS8 SK-ANON-012:
//   * The PER-DEVICE CAP is enforced at the TOP of `/v1/ask` for all
//     anon traffic (any kind), not inside this gate. See
//     `apps/api/src/index.ts` — the cap fires before `routeAsk`
//     classifies the request, so kind=query against the user's only
//     anon DB also returns `401 auth_required`.
//   * This gate now ONLY runs the Turnstile bot-floor on the create
//     path (`runCreatePath`).
//     Turnstile retains its place as the bot shield for creates —
//     bots can mint anon-bearer tokens trivially, so the per-device
//     cap doesn't help against them; the captcha does.
//   * `commitAnonCreate` increments the per-device counter after the
//     orchestrator returns `result.ok === true` (WS5 fix C — failed
//     creates / queries don't burn the user's one-call budget). The
//     `/v1/ask` handler also calls it on successful query/write
//     outcomes so any successful 1st anon call consumes the cap.
//
// Both halves no-op for non-anon principals (SK-ANON-006 keeps
// `principal.kind` out of the orchestrator). The pure
// `verifyTurnstile` dep is injected so tests can stub it without
// reaching for `vi.mock`.

import type { AnonRateLimiter } from "./anon-rate-limit.ts";
import type { verifyTurnstile as verifyTurnstileFn } from "./turnstile.ts";

export type AnonCreateGateDecision =
  | { kind: "skip" }
  | { kind: "allow" }
  | { kind: "challenge_required" };

export type AnonCreateGateDeps = {
  limiter: AnonRateLimiter;
  verifyTurnstile: typeof verifyTurnstileFn;
};

export type AnonCreateGateInput = {
  principalKind: "anon" | "user" | "pk_live" | "sk_live" | "sk_mcp";
  // SK-ANON-008 principal id (`anon:<sha256(token)[:16]>` for anon).
  principalId: string;
  // Remote IP — only used as Turnstile's `remoteip` hint (`SK-ANON-007`).
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
  // (not gated on burst count, since the per-device cap auth-walls
  // call #2 anyway).
  const verify = await deps.verifyTurnstile(input.turnstileToken, input.turnstileSecret, input.ip);
  // `unconfigured` (missing secret) fails OPEN in every environment —
  // SK-ANON-009. No client ships a Turnstile widget yet (`solveChallenge`
  // is a stub), so a fail-closed branch turns every anon create into an
  // unrecoverable 428; only set `TURNSTILE_SECRET` in the same release
  // that ships the real widget. A configured secret always requires a
  // valid token; abuse is bounded by the SK-ANON-012 per-device cap,
  // SK-ANON-010 global caps, and the per-IP buckets underneath.
  const turnstileAllowed = verify.ok || verify.reason === "unconfigured";

  if (!turnstileAllowed) return { kind: "challenge_required" };
  return { kind: "allow" };
}

export async function commitAnonCreate(
  deps: Pick<AnonCreateGateDeps, "limiter">,
  input: Pick<AnonCreateGateInput, "principalKind" | "principalId">,
): Promise<void> {
  if (input.principalKind !== "anon") return;
  await deps.limiter.recordDevice(input.principalId);
}
