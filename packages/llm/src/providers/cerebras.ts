// Cerebras — strict-$0 planner tier (SK-LLM-023, SK-LLM-048). Serves two
// open-weight models on wafer-scale silicon off one free key: GLM-4.7
// (`zai-glm-4.7`, the planner head per SK-LLM-048, ~1,000 tok/s) and
// gpt-oss-120b (the retained fallback, ~3,000 tok/s). Both card-free. Model
// ids verified against the live `/v1/models` for our key (gpt-oss-120b
// 2026-06; zai-glm-4.7 2026-08).
//
// Free tier (verified live 2026-06): no card, 1M tokens/day, with tight
// per-minute token + request quotas — a `429 token_quota_exceeded` is the
// binding limit (observed live), well before the model's 131K context. On
// a 429 the call fails over to the next provider in chain, so the chain
// degrades gracefully.
// OpenAI-compatible chat-completions, so it reuses `openAICompatibleChat`.

import type { LLMOperation, Provider, ProviderName } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://api.cerebras.ai/v1";

// One model across all ops — Cerebras leads the planner tier
// (SK-LLM-023) and tails the cheap tier as a direct leg (SK-LLM-047).
const DEFAULT_MODEL = "gpt-oss-120b";

// SK-LLM-048 — GLM-4.7, served on the same Cerebras free key (verified live
// against `/v1/models`, 2026-08). A reasoning model, so it is dispatched with
// `reasoning_effort:"low"` + a completion-token ceiling (see createCerebrasGlmProvider).
const GLM_MODEL = "zai-glm-4.7";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  route: DEFAULT_MODEL,
  plan: DEFAULT_MODEL,
  summarize: DEFAULT_MODEL,
  schema_infer: DEFAULT_MODEL,
  engine_classify: DEFAULT_MODEL,
};

export type CerebrasProviderOptions = {
  apiKey: string;
  // AI Gateway override. Path up to (but not including) `/chat/completions`.
  baseUrl?: string;
  models?: Partial<Record<LLMOperation, string>>;
  // SK-LLM-048 — chain-name override so a GLM-4.7 instance and the default
  // gpt-oss-120b instance can both sit in the chain off the same key.
  name?: ProviderName;
  // SK-LLM-048 — reasoning controls, forwarded to the OpenAI-compatible body.
  // gpt-oss-120b leaves both unset; GLM-4.7 sets `reasoning_effort:"low"`.
  reasoningEffort?: "none" | "low" | "medium" | "high";
  maxTokens?: number;
};

export function createCerebrasProvider(opts: CerebrasProviderOptions): Provider {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return createChatProvider({
    name: opts.name ?? "cerebras",
    models: { ...DEFAULT_MODELS, ...opts.models },
    callChat: ({ model, messages, jsonMode, temperature, opts: callOpts }) =>
      openAICompatibleChat(
        {
          url: `${baseUrl}/chat/completions`,
          apiKey: opts.apiKey,
          model,
          messages,
          jsonResponse: jsonMode,
          // Greedy (SK-LLM-024) unless the SK-QUAL-017 sampler overrides.
          temperature: temperature ?? 0,
          reasoningEffort: opts.reasoningEffort,
          maxTokens: opts.maxTokens,
        },
        callOpts,
      ),
  });
}

// SK-LLM-048 — the GLM-4.7 planner head. Same Cerebras key/base as
// `createCerebrasProvider`, distinct chain name `cerebras-glm`, GLM on the two
// planner ops (`plan` / `schema_infer`). `reasoning_effort:"low"` keeps
// reasoning to ~1.1k tokens (≈1.6 s on Cerebras, inside the plan/schema_infer
// budgets); `maxTokens` (sent as `max_completion_tokens`) is the combined
// reasoning+content ceiling so the model can never burn the budget before
// emitting `content`.
export function createCerebrasGlmProvider(
  opts: Pick<CerebrasProviderOptions, "apiKey" | "baseUrl">,
): Provider {
  return createCerebrasProvider({
    ...opts,
    name: "cerebras-glm",
    models: { plan: GLM_MODEL, schema_infer: GLM_MODEL },
    reasoningEffort: "low",
    maxTokens: 3000,
  });
}
