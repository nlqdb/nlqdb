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
