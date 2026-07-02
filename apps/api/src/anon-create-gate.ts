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
  // True in production/canary (`NODE_ENV`). Gates the fail-open path: an
  // unconfigured Turnstile secret fails OPEN in dev but CLOSED in prod.
  // Optional (defaults to dev/fail-open) so non-prod callers and tests
  // keep the prior behaviour; the prod route always passes it.
  isProd?: boolean;
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
  // Fail-open on `unconfigured` (missing secret) ONLY outside production —
  // useful in `wrangler dev`/tests where the secret is absent. In
  // production/canary an unset secret must NOT silently disable the bot
  // floor (that would let a bot flood anon creates), so it fails CLOSED to
  // a challenge. A configured secret always requires a valid token.
  const turnstileAllowed = verify.ok || (verify.reason === "unconfigured" && !input.isProd);

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
