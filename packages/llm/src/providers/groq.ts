// Groq — strict-$0 hot-path classification + 70B summarization.
// DESIGN §8.1 free-tier limits: 14,400 RPD on Llama 3.1 8B Instant,
// 1,000 RPD on Llama 3.3 70B / Qwen3 32B.

import type { LLMOperation, Provider } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  classify: "llama-3.1-8b-instant",
  plan: "llama-3.3-70b-versatile",
  summarize: "llama-3.3-70b-versatile",
  schema_infer: "llama-3.3-70b-versatile",
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
