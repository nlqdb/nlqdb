// Registry primitives for the one error taxonomy (SK-ERR-001).
//
// The registry is the single source of truth for "typed failure → user-facing
// copy". Before it, four surfaces (web, CLI, MCP, elements) each carried their
// own copy table, drifted apart, and each could only guess at a cause the
// throw site already knew — the 2026-08-17/18 incidents where a rejected
// BYOLLM key surfaced as "try rephrasing" and a FK violation as "couldn't
// reach the database".
//
// One entry per code declares everything every surface needs:
//   • `httpStatus`     — the wire status (a function when params change it).
//   • `recoverability` — what kind of thing went wrong, so `retryable` is
//                        derived once instead of guessed per surface.
//   • `params`         — the closed, secret-free extension schema (RFC 9457
//                        posture: extensions are declared, never free-form).
//                        Raw provider / Postgres text never belongs here; it
//                        stays on OTel spans and the KV diag sink.
//   • `message`/`action` — GLOBAL-012: one sentence + the next action.

import type { z } from "zod";

// What kind of failure this is. `retryable` is derived from it, so a surface
// never invents its own retry hint:
//   transient   — will plausibly succeed on retry (provider blip, cold DB).
//   clarify     — deterministic; the *goal* has to change.
//   user_config — deterministic; the user's own settings have to change.
//   operator    — deterministic; whoever runs this deployment has to fix it.
//   bug         — a malformed call; the caller's code has to change.
export type Recoverability = "transient" | "clarify" | "user_config" | "operator" | "bug";

// Value or params-derived — most codes are fixed, a few (llm_failed) depend on
// the cause the throw site captured.
type Derived<P, T> = T | ((params: P) => T);

export type ErrorEntry<P> = {
  httpStatus: Derived<P, number>;
  recoverability: Derived<P, Recoverability>;
  // The schema's INPUT is whatever the throw site happened to have; only its
  // output (`P`) is typed, and that is the whole point — parsing is what turns
  // an unvetted bag of fields into the declared, secret-free params.
  // biome-ignore lint/suspicious/noExplicitAny: unvetted schema input, by design.
  params: z.ZodType<P, z.ZodTypeDef, any>;
  message: (params: P) => string;
  action: (params: P) => string;
};

// Helper so `defineError` infers `P` from the zod schema and each entry's
// builders are checked against it. Without it TS widens `P` to the union of
// every code's params and the copy builders lose their types.
export function defineError<P>(entry: ErrorEntry<P>): ErrorEntry<P> {
  return entry;
}

// The wire shape every non-2xx API response carries under `error`
// (GLOBAL-012 as decreed, RFC 9457-aligned). `params` is present only when
// the code declares fields and the caller supplied them.
export type WireError = {
  code: string;
  message: string;
  action: string;
  retryable: boolean;
  params?: Record<string, unknown>;
};

export function resolve<P, T>(d: Derived<P, T>, params: P): T {
  return typeof d === "function" ? (d as (p: P) => T)(params) : d;
}
