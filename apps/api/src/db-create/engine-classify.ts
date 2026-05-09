// Engine classifier for db.create — maps a goal string to an engine in
// `SK-MULTIENG-002`'s fit-table. Always resolves with a usable engine.

import { ALLOWED_ENGINES, type Engine } from "@nlqdb/db";
import type { LLMRouter } from "@nlqdb/llm";
import { trace } from "@opentelemetry/api";

export const ENGINE_CLASSIFY_CONFIDENCE_FLOOR = 0.6;
export const DEFAULT_ENGINE: Engine = "postgres";

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
  fallbackReason: EngineFallbackReason | null;
};

const SPAN_ATTR_FALLBACK_REASON = "nlqdb.engine_classify.fallback_reason";

function recordFallbackReason(reason: EngineFallbackReason | null): void {
  if (reason === null) return;
  trace.getActiveSpan()?.setAttribute(SPAN_ATTR_FALLBACK_REASON, reason);
}

export async function classifyEngine(
  deps: EngineClassifyDeps,
  goal: string,
): Promise<EngineClassifyResult> {
  let pick: Awaited<ReturnType<LLMRouter["engineClassify"]>>;
  try {
    pick = await deps.llm.engineClassify({ goal });
  } catch {
    recordFallbackReason("provider_failed");
    return { engine: DEFAULT_ENGINE, confidence: 0, fallbackReason: "provider_failed" };
  }

  const candidate = pick.engine as Engine;
  if (!ALLOWED_ENGINES.has(candidate)) {
    const reason: EngineFallbackReason =
      pick.engine === "sqlite" || pick.engine === "redis" ? "deferred" : "unknown_string";
    recordFallbackReason(reason);
    return { engine: DEFAULT_ENGINE, confidence: pick.confidence, fallbackReason: reason };
  }

  if (pick.confidence < ENGINE_CLASSIFY_CONFIDENCE_FLOOR) {
    recordFallbackReason("below_floor");
    return { engine: DEFAULT_ENGINE, confidence: pick.confidence, fallbackReason: "below_floor" };
  }

  return { engine: candidate, confidence: pick.confidence, fallbackReason: null };
}
