// Engine classifier for the db.create path. Maps a goal string to one
// of the engines in `SK-MULTIENG-002`'s engine-fit table; the prompt
// itself (`ENGINE_CLASSIFY_SYSTEM` in `packages/llm/src/prompts.ts`)
// embeds that table verbatim so the LLM and the human reviewer
// reference the same source.
//
// Skill cross-refs:
// - `docs/features/db-adapter/FEATURE.md` SK-DB-010 — the `engine?`
//   field on `db.create`. Classifier-default; explicit override skips
//   the LLM call (verifiable via `engineClassify` mock-call assertion
//   in the orchestrator tests).
// - `docs/features/multi-engine-adapter/FEATURE.md` SK-MULTIENG-002 —
//   canonical engine-fit table source.
// - `GLOBAL-014` — every external call has an OTel span. The router's
//   `llm.engine_classify` span (per `engineClassify` route in
//   `packages/llm/src/router.ts`) is the catalog entry.
// - `GLOBAL-020` — no config in the first 60 s. The classifier is the
//   default path; `engine?` override is power-user-only (`GLOBAL-015`).

import { ALLOWED_ENGINES, type Engine } from "@nlqdb/db";
import type { LLMRouter } from "@nlqdb/llm";
import { trace } from "@opentelemetry/api";

// Below this confidence the classifier's pick is not trusted enough
// to override the safe default. Postgres is the documented fallback
// per `SK-DB-010` ("default fallback to `postgres` when confidence
// < 0.6"). The threshold is intentionally not configurable — making
// it a knob would invite drift between the test fixtures and prod.
export const ENGINE_CLASSIFY_CONFIDENCE_FLOOR = 0.6;

// Default engine the classifier falls back to. Postgres is the only
// engine with a shippable Phase-1 adapter and the right fit for the
// "tracker / app data" goals that dominate the persona research
// (`docs/runbook.md §10`).
export const DEFAULT_ENGINE: Engine = "postgres";

// Why the classifier collapsed onto `DEFAULT_ENGINE` instead of using
// the LLM's pick. `null` means the LLM's pick was used as-is.
// Surfaced on the parent OTel span (`nlqdb.engine_classify.fallback_reason`)
// so dashboards can split classifier mis-fires by cause without
// re-running the classifier.
export type EngineFallbackReason =
  | "deferred"
  | "below_floor"
  | "provider_failed"
  | "unknown_string";

export type EngineClassifyDeps = {
  llm: LLMRouter;
};

export type EngineClassifyResult = {
  engine: Engine;
  confidence: number;
  // `null` when the LLM's pick was used; otherwise the reason the
  // classifier collapsed to `DEFAULT_ENGINE`. Mirrors the values
  // emitted on the OTel span so callers can log + tag identically.
  fallbackReason: EngineFallbackReason | null;
};

// Span attribute key for the fallback reason. Stamped on the active
// span (the parent `nlqdb.databases.create` / `nlqdb.ask` span — the
// router's per-call `llm.engine_classify` span has already ended by
// the time we know the post-floor outcome). Cardinality budget:
// 5 values (`null` excluded) — see `docs/performance.md` §3.1.
const SPAN_ATTR_FALLBACK_REASON = "nlqdb.engine_classify.fallback_reason";

function recordFallbackReason(reason: EngineFallbackReason | null): void {
  if (reason === null) return;
  // `getActiveSpan()` is undefined when the orchestrator runs outside
  // a span (unit tests, ad-hoc scripts). In that case there's nothing
  // to record on — the `fallbackReason` field on the return value is
  // still the source of truth for callers that wire their own span.
  trace.getActiveSpan()?.setAttribute(SPAN_ATTR_FALLBACK_REASON, reason);
}

// Run the classifier. Always resolves with a usable `engine`:
//   • LLM picks an allowed engine with confidence ≥ floor → return it
//     with `fallbackReason: null`.
//   • LLM picks an allowed engine below the floor → fall back to
//     `postgres` (`fallbackReason: "below_floor"`) but surface the
//     LLM's confidence so the caller can log it.
//   • LLM picks a *deferred* engine (sqlite/redis listed in the prompt
//     for future-proofing but no adapter today) → fall back to
//     `postgres` (`fallbackReason: "deferred"`).
//   • LLM picks an unknown string → fall back with
//     `fallbackReason: "unknown_string"`.
//   • LLM throws / times out / parse error → fall back to `postgres`
//     with `confidence: 0` and `fallbackReason: "provider_failed"`.
//     The router's OTel span carries the upstream failure; this layer
//     never re-throws.
//
// The router emits `llm.engine_classify` for the call (per
// `packages/llm/src/router.ts`'s `route("engine_classify", …)`); no
// span wrapping needed here. We stamp `nlqdb.engine_classify.fallback_reason`
// on the parent span so dashboards can split fallbacks by cause —
// see `docs/performance.md` §3.1 catalog row.
export async function classifyEngine(
  deps: EngineClassifyDeps,
  goal: string,
): Promise<EngineClassifyResult> {
  let pick: Awaited<ReturnType<LLMRouter["engineClassify"]>>;
  try {
    pick = await deps.llm.engineClassify({ goal });
  } catch {
    // Provider failure / timeout / parse error. The router's OTel span
    // already records the cause; surface a confidence-0 fallback so the
    // create path never blocks on classifier outages.
    recordFallbackReason("provider_failed");
    return { engine: DEFAULT_ENGINE, confidence: 0, fallbackReason: "provider_failed" };
  }

  const candidate = pick.engine as Engine;
  if (!ALLOWED_ENGINES.has(candidate)) {
    // LLM emitted a string outside the allowed set. Distinguish two
    // sub-cases for the dashboard:
    //   • a *deferred* engine listed in the SK-MULTIENG-002 prompt
    //     table but without a Phase-1 adapter — expected drift while
    //     `sqlite` / `redis` are still on the roadmap.
    //   • a hallucinated / typo'd string — a classifier-quality
    //     signal, not a roadmap signal.
    const reason: EngineFallbackReason =
      pick.engine === "sqlite" || pick.engine === "redis" ? "deferred" : "unknown_string";
    recordFallbackReason(reason);
    return { engine: DEFAULT_ENGINE, confidence: pick.confidence, fallbackReason: reason };
  }

  if (pick.confidence < ENGINE_CLASSIFY_CONFIDENCE_FLOOR) {
    // Below-floor pick — engine name was valid but the LLM wasn't
    // sure enough. Fall back to postgres per `SK-DB-010`.
    recordFallbackReason("below_floor");
    return { engine: DEFAULT_ENGINE, confidence: pick.confidence, fallbackReason: "below_floor" };
  }

  return { engine: candidate, confidence: pick.confidence, fallbackReason: null };
}
