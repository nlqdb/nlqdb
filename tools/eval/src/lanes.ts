// Dispatch-lane builders per SK-QUAL-004 / SK-LLM-017 / SK-QUAL-009.
//
// Three lanes:
//   • `free`              — strict-$0 chain + exec-retry (scaffolded).
//   • `frontier`          — single-model frontier, unscaffolded.
//                           Informational ablation reference.
//   • `agentic-frontier`  — same model as `frontier` + exec-retry. The
//                           Phase 2 ≥ 80% BIRD-dev EM floor is reachable
//                           on this lane per `SK-QUAL-009`.

import {
  createCerebrasProvider,
  createGeminiProvider,
  createGroqProvider,
  createLLMRouter,
  createMistralProvider,
  createOpenRouterProvider,
  createWorkersAIProvider,
  type LLMRouter,
} from "@nlqdb/llm";

import type { DispatchLane } from "./types.ts";

// Same env-var names as apps/api/src/llm-router.ts so a CI run shares secrets with production.
export type EvalEnv = {
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  CF_AI_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  // SK-LLM-023 — Cerebras (gpt-oss-120b) leads the planner-tier free chain.
  CEREBRAS_API_KEY?: string;
  // SK-LLM-028 — Mistral is the planner-tier capacity backstop at the chain tail.
  MISTRAL_API_KEY?: string;
  // Distinct env var from OPENROUTER_API_KEY so a fork PR can never accidentally pull a paid frontier key.
  OPENROUTER_FRONTIER_API_KEY?: string;
  FRONTIER_MODEL?: string;
  // Toggle the `agentic-frontier` lane. Same key as `frontier` is reused
  // — same model + exec-retry is the cleanest ablation. Defaults off so
  // a free-only run still ships green.
  RUN_AGENTIC_FRONTIER?: string;
};

// Frontier reference model — Claude Sonnet 4.6 because its published BIRD-dev score is the closest cross-vendor comparable.
export const DEFAULT_FRONTIER_MODEL = "anthropic/claude-sonnet-4.6";

// Production retry budget per `apps/api/src/ask/retry.ts::RETRY_MAX_ATTEMPTS`.
// The eval matches it so the harness measures what production ships.
const AGENTIC_MAX_ATTEMPTS = 3;

// Production hot-path `plan` budget (DEFAULT_TIMEOUTS_MS.plan, SK-ASK-009).
// The free lane keeps it so it measures what ships.
const PROD_PLAN_TIMEOUT_MS = 5_000;

// SK-QUAL-022 — the frontier lanes measure model *capability* (SK-QUAL-004's
// ~77-82% SOTA intent), not the production hot-path budget. A reasoning
// frontier model needs > 5 s on hard BIRD questions; the prod clamp aborted
// Sonnet 4.6 mid-body-read (run 14 diagnosis — tagged `openrouter:parse`,
// scored as an engine miss). A generous ablation budget lets it finish so the
// lane reads competence, not the clamp.
const FRONTIER_PLAN_TIMEOUT_MS = 30_000;

export type Lane = {
  lane: DispatchLane;
  router: LLMRouter;
  modelHint: string;
  // SK-QUAL-009 — inclusive max plan() attempts per question. 1 = no
  // retry. The runner threads this into `withExecRetry`; only lanes
  // with `> 1` actually loop.
  maxAttempts: number;
  // SK-QUAL-022 — per-attempt `plan` timeout. Free = prod clamp; frontier
  // lanes = capability budget. The router enforces it (`timeouts.plan`); this
  // field just mirrors it as an assertable surface, so it's optional — a mock
  // lane needn't set it.
  planTimeoutMs?: number;
};

function buildFreeLane(env: EvalEnv): Lane | null {
  const providers = [];
  if (env.CEREBRAS_API_KEY)
    providers.push(createCerebrasProvider({ apiKey: env.CEREBRAS_API_KEY }));
  if (env.GROQ_API_KEY) providers.push(createGroqProvider({ apiKey: env.GROQ_API_KEY }));
  if (env.GEMINI_API_KEY) providers.push(createGeminiProvider({ apiKey: env.GEMINI_API_KEY }));
  if (env.CF_AI_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
    providers.push(
      createWorkersAIProvider({ apiToken: env.CF_AI_TOKEN, accountId: env.CLOUDFLARE_ACCOUNT_ID }),
    );
  }
  if (env.OPENROUTER_API_KEY) {
    providers.push(createOpenRouterProvider({ apiKey: env.OPENROUTER_API_KEY }));
  }
  if (env.MISTRAL_API_KEY) providers.push(createMistralProvider({ apiKey: env.MISTRAL_API_KEY }));
  if (providers.length === 0) return null;
  // Chain order matches apps/api/src/llm-router.ts so the eval measures what
  // production ships — Cerebras-led planner tier per SK-LLM-023, Mistral tail
  // capacity backstop per SK-LLM-028. The router skips any provider whose key
  // is absent, so a partial-key CI run still runs.
  const router = createLLMRouter({
    providers,
    chains: { plan: ["cerebras", "gemini", "groq", "workers-ai", "openrouter", "mistral"] },
    // SK-LLM-030 — honor a 429's full `Retry-After` window (prod caps it
    // for latency). A long server back-off is exactly the signal the
    // resumable runner checkpoints on rather than recording as no_sql.
    maxRateLimitCooldownMs: Number.POSITIVE_INFINITY,
  });
  // Free chain is scaffolded per SK-QUAL-009 so the "scaffolding compounds with the model"
  // bet is testable end-to-end.
  return {
    lane: "free",
    router,
    modelHint: "free-chain",
    maxAttempts: AGENTIC_MAX_ATTEMPTS,
    planTimeoutMs: PROD_PLAN_TIMEOUT_MS,
  };
}

function frontierProvider(env: EvalEnv, model: string) {
  return createOpenRouterProvider({
    apiKey: env.OPENROUTER_FRONTIER_API_KEY ?? "",
    models: { plan: model },
  });
}

function buildFrontierLane(env: EvalEnv): Lane | null {
  if (!env.OPENROUTER_FRONTIER_API_KEY) return null;
  const model = env.FRONTIER_MODEL ?? DEFAULT_FRONTIER_MODEL;
  // One provider per model — SK-LLM-017 will widen this when GPT-5 / Gemini 2.5 Pro join the frontier chain.
  const router = createLLMRouter({
    providers: [frontierProvider(env, model)],
    chains: { plan: ["openrouter"] },
    // SK-QUAL-022 — capability budget, not the prod hot-path clamp.
    timeouts: { plan: FRONTIER_PLAN_TIMEOUT_MS },
  });
  // Unscaffolded — preserves the single-model ablation reference per SK-QUAL-004.
  return {
    lane: "frontier",
    router,
    modelHint: model,
    maxAttempts: 1,
    planTimeoutMs: FRONTIER_PLAN_TIMEOUT_MS,
  };
}

function buildAgenticFrontierLane(env: EvalEnv): Lane | null {
  if (!env.OPENROUTER_FRONTIER_API_KEY) return null;
  // Opt-in: `frontier` may run informationally without firing the
  // agentic loop's 3× provider RPS. Truthy string ("1"/"true"/"yes")
  // opts in.
  const optIn = (env.RUN_AGENTIC_FRONTIER ?? "").toLowerCase();
  if (optIn !== "1" && optIn !== "true" && optIn !== "yes") return null;
  const model = env.FRONTIER_MODEL ?? DEFAULT_FRONTIER_MODEL;
  const router = createLLMRouter({
    providers: [frontierProvider(env, model)],
    chains: { plan: ["openrouter"] },
    // SK-QUAL-022 — capability budget, not the prod hot-path clamp.
    timeouts: { plan: FRONTIER_PLAN_TIMEOUT_MS },
  });
  return {
    lane: "agentic-frontier",
    router,
    modelHint: model,
    maxAttempts: AGENTIC_MAX_ATTEMPTS,
    planTimeoutMs: FRONTIER_PLAN_TIMEOUT_MS,
  };
}

export function buildLanes(env: EvalEnv): Lane[] {
  const lanes: Lane[] = [];
  const free = buildFreeLane(env);
  if (free) lanes.push(free);
  const frontier = buildFrontierLane(env);
  if (frontier) lanes.push(frontier);
  const agenticFrontier = buildAgenticFrontierLane(env);
  if (agenticFrontier) lanes.push(agenticFrontier);
  return lanes;
}

export const _testing = {
  buildFreeLane,
  buildFrontierLane,
  buildAgenticFrontierLane,
  AGENTIC_MAX_ATTEMPTS,
  PROD_PLAN_TIMEOUT_MS,
  FRONTIER_PLAN_TIMEOUT_MS,
};
