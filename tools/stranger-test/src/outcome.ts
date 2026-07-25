// SK-STRG-010 — separating "the product broke" from "the instrument was
// turned away at the door". Pure functions, no Playwright: the whole
// verdict is decided here so it can be unit-tested and negative-tested.

import type { RunState, StepResult, StepStatus } from "./types.ts";

export type AskOutcome = Extract<StepStatus, "ok" | "blocked" | "fail">;

// A 428 carrying `challenge_required` is Turnstile declining this client,
// not a product break: SK-ANON-012 runs Turnstile on every anon create, and
// a headless Chromium on a GitHub-Actions datacenter IP is exactly the
// client it is built to decline. `apps/api` mints that pair in one place
// (index.ts's anon-create gate) and uses 428 for nothing else, so the match
// is unambiguous.
//
// Both halves are required on purpose. Status-only would score any future
// 428 as blocked; body-only would score a 200 whose payload merely mentions
// the code. Anything else — 401, 429, 500, a bare 428 with an unreadable
// body — stays `fail`, because green-washing a real regression is the one
// failure mode this function must not have.
export function classifyAsk(status: number, body: string): AskOutcome {
  if (status === 200) return "ok";
  if (status === 428 && body.includes("challenge_required")) return "blocked";
  return "fail";
}

// The walk's verdict, derived from the steps themselves rather than tracked
// alongside them: any `fail` anywhere outranks a `blocked`, so an
// instrument-blocked step can never mask a product failure recorded before
// or after it. `failedStep` stays honest too — it names a *failed* step or
// nothing, and a blocked run's stopping point is the `blocked` step in
// `steps`.
export function runOutcome(steps: StepResult[]): { state: RunState; failedStep: number | null } {
  // A walk that observed nothing is not a walk that found nothing wrong.
  if (steps.length === 0) return { state: "failed", failedStep: 0 };
  const failed = steps.find((s) => s.status === "fail");
  if (failed) return { state: "failed", failedStep: failed.step };
  const blocked = steps.some((s) => s.status === "blocked");
  return { state: blocked ? "blocked" : "passed", failedStep: null };
}
