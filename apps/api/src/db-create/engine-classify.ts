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

import type { Engine } from "@nlqdb/db";
import type { LLMRouter } from "@nlqdb/llm";

// Engines we can ship today. `Engine` from `@nlqdb/db` is the
// canonical set (`postgres` + `clickhouse` per W1); the deferred
// engines in the SK-MULTIENG-002 table (`sqlite`, `redis`) are listed
// in the prompt for future-proofing but rejected at this layer until
// their adapters land.
const ALLOWED_ENGINES: ReadonlySet<Engine> = new Set<Engine>(["postgres", "clickhouse"]);

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

export type EngineClassifyDeps = {
  llm: LLMRouter;
};

export type EngineClassifyResult = {
  engine: Engine;
  confidence: number;
};

// Run the classifier. Always resolves with a usable `engine`:
//   • LLM picks an allowed engine with confidence ≥ floor → return it.
//   • LLM picks an allowed engine below the floor → fall back to
//     `postgres` but surface the LLM's confidence so the caller can log
//     it.
//   • LLM throws / times out / picks an unknown string → fall back to
//     `postgres` with `confidence: 0`. The router's OTel span carries
//     the upstream failure; this layer never re-throws.
//
// The router emits `llm.engine_classify` for the call (per
// `packages/llm/src/router.ts`'s `route("engine_classify", …)`); no
// span wrapping needed here.
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
    return { engine: DEFAULT_ENGINE, confidence: 0 };
  }

  const candidate = pick.engine as Engine;
  if (!ALLOWED_ENGINES.has(candidate)) {
    // LLM emitted a string outside the allowed set (deferred engine,
    // typo, hallucination). Same fallback as the failure path; keep
    // the LLM's confidence so dashboards can spot patterns.
    return { engine: DEFAULT_ENGINE, confidence: pick.confidence };
  }

  if (pick.confidence < ENGINE_CLASSIFY_CONFIDENCE_FLOOR) {
    // Below-floor pick — engine name was valid but the LLM wasn't
    // sure enough. Fall back to postgres per `SK-DB-010`.
    return { engine: DEFAULT_ENGINE, confidence: pick.confidence };
  }

  return { engine: candidate, confidence: pick.confidence };
}
