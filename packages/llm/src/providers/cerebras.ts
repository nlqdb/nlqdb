// Cerebras — strict-$0 planner-tier upgrade (SK-LLM-023). Serves
// Qwen-3-235B-Instruct on wafer-scale silicon: the strongest open-weights
// NL→SQL model in the free chain, at the highest throughput (~1,400 tok/s),
// so it leads the `plan` / `schema_infer` chains and almost always wins the
// SK-LLM-014 hedge before the head-start fires.
//
// Free tier (verified 2026-06): 1M tokens/day, no card, 30 RPM, 8,192-token
// context cap. A schema that overflows the cap 4xx's → the router fails over
// to Gemini next in chain, so large-schema questions degrade gracefully.
// OpenAI-compatible chat-completions, so it reuses `openAICompatibleChat`.

import type { LLMOperation, Provider } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://api.cerebras.ai/v1";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  // Cheap-tier ops keep a small model — only `plan` / `schema_infer` route
  // here in the chains, but every op needs a default for `provider.model()`.
  route: "llama3.1-8b",
  plan: "qwen-3-235b-a22b-instruct-2507",
  summarize: "qwen-3-235b-a22b-instruct-2507",
  schema_infer: "qwen-3-235b-a22b-instruct-2507",
  engine_classify: "llama3.1-8b",
};

export type CerebrasProviderOptions = {
  apiKey: string;
  // AI Gateway override. Path up to (but not including) `/chat/completions`.
  baseUrl?: string;
  models?: Partial<Record<LLMOperation, string>>;
};

export function createCerebrasProvider(opts: CerebrasProviderOptions): Provider {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return createChatProvider({
    name: "cerebras",
    models: { ...DEFAULT_MODELS, ...opts.models },
    callChat: ({ model, messages, jsonMode, opts: callOpts }) =>
      openAICompatibleChat(
        {
          url: `${baseUrl}/chat/completions`,
          apiKey: opts.apiKey,
          model,
          messages,
          jsonResponse: jsonMode,
          temperature: 0,
        },
        callOpts,
      ),
  });
}
