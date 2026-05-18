// Dispatch-lane selection per SK-QUAL-004 / SK-LLM-017. Returns the
// router instance to use for a given lane, or null when no provider
// key is configured for that lane (the runner records the lane as
// skipped and the headline delta becomes null).
//
// Lanes:
//   - `free`     : SK-LLM-003's strict-$0 chain — Gemini Flash, Groq,
//                  Workers AI, OpenRouter free. Identical to production.
//   - `frontier` : OpenRouter paid models (Claude Sonnet 4.6, GPT-5,
//                  Gemini 2.5 Pro). Architecturally landed here per
//                  SK-LLM-017 even though the public meter stays dark
//                  until phase-plan.md §6 trips. Requires
//                  `OPENROUTER_FRONTIER_API_KEY` *or* opt-in via env.

import {
  createGeminiProvider,
  createGroqProvider,
  createLLMRouter,
  createOpenRouterProvider,
  createWorkersAIProvider,
  type LLMRouter,
} from "@nlqdb/llm";

import type { DispatchLane } from "./types.ts";

export type EvalEnv = {
  // Free-chain providers — same env-var names as apps/api (single
  // source of truth, so a CI run shares secrets with production).
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  CF_AI_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  // Frontier-chain provider. Distinct env var so a Free PR can never
  // accidentally pull a paid OpenRouter key. When unset, the frontier
  // lane is skipped and the headline delta is reported as `null`.
  OPENROUTER_FRONTIER_API_KEY?: string;
  // Override frontier model. Defaults below.
  FRONTIER_MODEL?: string;
};

// OpenRouter slug for the frontier reference model. Pinned to Claude
// Sonnet 4.6 because the published BIRD-dev SOTA on Claude is the
// closest cross-vendor comparable. Override via env for ad-hoc runs.
export const DEFAULT_FRONTIER_MODEL = "anthropic/claude-sonnet-4.6";

export type Lane = {
  lane: DispatchLane;
  router: LLMRouter;
  // Model string surfaced on every QuestionResult so the report can
  // attribute accuracy to a specific model build, not a chain label.
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
  // Same `plan` chain order as apps/api/src/llm-router.ts so the eval
  // measures what we ship. Providers absent from `providers[]` are
  // dropped silently by createLLMRouter — `not_configured` failovers
  // never count against accuracy.
  const router = createLLMRouter({
    providers,
    chains: { plan: ["gemini", "groq", "workers-ai", "openrouter"] },
  });
  return { lane: "free", router, modelHint: "free-chain" };
}

function buildFrontierLane(env: EvalEnv): Lane | null {
  if (!env.OPENROUTER_FRONTIER_API_KEY) return null;
  const model = env.FRONTIER_MODEL ?? DEFAULT_FRONTIER_MODEL;
  // The OpenRouter provider holds one model per instance; the
  // frontier lane therefore uses a single-provider chain. When more
  // frontier models are added (GPT-5, Gemini 2.5 Pro) the chain will
  // widen — each gets its own provider instance with its own model.
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
