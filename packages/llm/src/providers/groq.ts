// Groq — strict-$0 hot-path classification + planner-tier summarization.
// llama-3.1-8b-instant + llama-3.3-70b-versatile were decommissioned by Groq
// on 2026-08-16; migrated to the recommended replacements per SK-LLM-003.
// docs/architecture.md §7.1 free-tier limits: 1,000 RPD on gpt-oss-20b /
// gpt-oss-120b (Groq's per-model free cap; route/classify overflow falls
// through to Workers-AI + OpenRouter).

import type { LLMOperation, Provider } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  // SK-ASK-009 — merged routeAsk rides the cheap-tier model. Prompt
  // is short (goal + dbset + recent-tables MRU), budget is 1500 ms.
  route: "openai/gpt-oss-20b",
  plan: "openai/gpt-oss-120b",
  summarize: "openai/gpt-oss-120b",
  schema_infer: "openai/gpt-oss-120b",
  // Engine classification (SK-DB-010) — short prompt (the engine-fit
  // table + one goal sentence), cheap-tier model, same budget as route.
  engine_classify: "openai/gpt-oss-20b",
};

export type GroqProviderOptions = {
  apiKey: string;
  // AI Gateway override. Path up to (but not including)
  // `/chat/completions` — provider appends that suffix. Example:
  // https://gateway.ai.cloudflare.com/v1/{acc}/{gw}/groq/openai/v1
  baseUrl?: string;
  models?: Partial<Record<LLMOperation, string>>;
};

export function createGroqProvider(opts: GroqProviderOptions): Provider {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return createChatProvider({
    name: "groq",
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
        },
        callOpts,
      ),
  });
}
