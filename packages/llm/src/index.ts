export type {
  ByollmCredential,
  ByollmRouterOptions,
  ByollmSource,
  DispatchInputs,
  DispatchLane,
  DispatchSelection,
} from "./byollm-dispatch.ts";
export {
  buildByollmRouter,
  dispatchLaneAttributes,
  selectDispatchLane,
} from "./byollm-dispatch.ts";
// SK-PREMIUM-013 — canonical model catalog (the only home for user-facing
// model strings; surfaces receive it over the wire via `GET /v1/models`).
export {
  type CatalogModel,
  type CatalogPreset,
  MODEL_CATALOG,
  type ModelCatalog,
  type ModelLane,
  type ModelPreset,
} from "./catalog.ts";
// Similarity-retrieved few-shot exemplar selection (SK-LLM-041, DAIL §4.1).
export {
  type Exemplar,
  maskedTokens,
  maskedTokensWithSchema,
  maskQuestion,
  maskSchemaIdentifiers,
  maskWithSchema,
  questionSimilarity,
  type SchemaExemplar,
  selectExemplars,
  selectExemplarsForSchema,
} from "./few-shot-select.ts";
// Founder-funded frontier lane (SK-FRONTIER-001..004) — DORMANT: the
// shipped `HAS_FRONTIER_API_KEYS` is `false`, so `selectFrontierLane`
// returns `null` before touching any key/env/KV. apps/api wires these
// primitives behind the gate later.
export { type FrontierEligibilityCtx, isFrontierEligible } from "./frontier/eligibility.ts";
export { HAS_FRONTIER_API_KEYS } from "./frontier/gate.ts";
export {
  ACTIVE_TIER_KEY,
  advanceActiveTier,
  type FrontierKv,
  NO_ACTIVE_TIER,
  readActiveTier,
  resetActiveTier,
} from "./frontier/pointer.ts";
export {
  buildFrontierRouter,
  frontierLaneAttributes,
  onTierExhausted,
  type SelectFrontierArgs,
  selectFrontierLane,
} from "./frontier/select.ts";
export {
  type FrontierEnv,
  type FrontierProvider,
  type FrontierTier,
  frontierTiers,
} from "./frontier/tiers.ts";
// Curated retrieval pool + the per-lever T9 ablation that wires it into the
// planner system prompt (SK-LLM-041 half (b), DAIL §4.1).
export {
  buildPlanSystem,
  PLAN_EXEMPLAR_POOL,
  type PlanBucket,
  type PlanExemplar,
  retrievePlanExemplars,
} from "./plan-exemplar-pool.ts";
export type { ByollmProviderOptions } from "./providers/byollm.ts";
export { createByollmProvider } from "./providers/byollm.ts";
export type { CerebrasProviderOptions } from "./providers/cerebras.ts";
export { createCerebrasProvider } from "./providers/cerebras.ts";
export type { GeminiProviderOptions } from "./providers/gemini.ts";
export { createGeminiProvider } from "./providers/gemini.ts";
export type { GroqProviderOptions } from "./providers/groq.ts";
export { createGroqProvider } from "./providers/groq.ts";
export type { MistralProviderOptions } from "./providers/mistral.ts";
export { createMistralProvider } from "./providers/mistral.ts";
export type { OpenRouterProviderOptions } from "./providers/openrouter.ts";
export { createOpenRouterProvider } from "./providers/openrouter.ts";
export type { WorkersAIProviderOptions } from "./providers/workers-ai.ts";
export { createWorkersAIProvider } from "./providers/workers-ai.ts";
export type {
  AttemptRecord,
  LLMChains,
  LLMRouter,
  LLMRouterOptions,
} from "./router.ts";
export {
  AllProvidersFailedError,
  createLLMRouter,
  DEFAULT_TIMEOUTS_MS,
  NoConfiguredProvidersError,
  NoProviderError,
} from "./router.ts";
// Schema pruning (SK-LLM-037) + its tokenizer — the latter is reused by the
// SK-QUAL-015 column-coverage harness so its recall ceiling is faithful to the
// pruner's own goal/identifier matching.
export { pruneSchemaForGoal, schemaTokens, wordTokens } from "./schema-prune.ts";
export {
  type CallOpts,
  type EngineClassifyRequest,
  type EngineClassifyResponse,
  type FailoverReason,
  type FetchLike,
  type LLMOperation,
  type PlanRequest,
  type PlanResponse,
  type Provider,
  ProviderError,
  type ProviderName,
  type RouteDbCandidate,
  type RouteKind,
  type RouteRecentTable,
  type RouteRequest,
  type RouteResponse,
  type SchemaInferRequest,
  type SchemaInferResponse,
  type SummarizeRequest,
  type SummarizeResponse,
} from "./types.ts";
