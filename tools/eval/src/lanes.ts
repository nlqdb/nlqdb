// Dispatch-lane builders per SK-QUAL-004 / SK-LLM-017.

import {
  createGeminiProvider,
  createGroqProvider,
  createLLMRouter,
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
  // Distinct env var from OPENROUTER_API_KEY so a fork PR can never accidentally pull a paid frontier key.
  OPENROUTER_FRONTIER_API_KEY?: string;
  FRONTIER_MODEL?: string;
};

// Frontier reference model — Claude Sonnet 4.6 because its published BIRD-dev score is the closest cross-vendor comparable.
export const DEFAULT_FRONTIER_MODEL = "anthropic/claude-sonnet-4.6";

export type Lane = {
  lane: DispatchLane;
  router: LLMRouter;
  modelHint: string;
};

function buildFreeLane(env: EvalEnv): Lane | null {
  const providers = [];
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
  if (providers.length === 0) return null;
  // Chain order matches apps/api/src/llm-router.ts so the eval measures what production ships.
  const router = createLLMRouter({
    providers,
    chains: { plan: ["gemini", "groq", "workers-ai", "openrouter"] },
  });
  return { lane: "free", router, modelHint: "free-chain" };
}

function buildFrontierLane(env: EvalEnv): Lane | null {
  if (!env.OPENROUTER_FRONTIER_API_KEY) return null;
  const model = env.FRONTIER_MODEL ?? DEFAULT_FRONTIER_MODEL;
  // One provider per model — SK-LLM-017 will widen this when GPT-5 / Gemini 2.5 Pro join the frontier chain.
  const provider = createOpenRouterProvider({
    apiKey: env.OPENROUTER_FRONTIER_API_KEY,
    models: { plan: model },
  });
  const router = createLLMRouter({
    providers: [provider],
    chains: { plan: ["openrouter"] },
  });
  return { lane: "frontier", router, modelHint: model };
}

export function buildLanes(env: EvalEnv): Lane[] {
  const lanes: Lane[] = [];
  const free = buildFreeLane(env);
  if (free) lanes.push(free);
  const frontier = buildFrontierLane(env);
  if (frontier) lanes.push(frontier);
  return lanes;
}

export const _testing = { buildFreeLane, buildFrontierLane };
