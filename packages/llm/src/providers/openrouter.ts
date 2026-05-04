// OpenRouter — universal :free fallback when Gemini/Groq are out.
// docs/architecture.md §8.1: ~200 RPD across :free models. Same OpenAI-compat shape
// as Groq, different host.

import type { LLMOperation, Provider } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  classify: "meta-llama/llama-3.1-8b-instruct:free",
  plan: "meta-llama/llama-3.3-70b-instruct:free",
  summarize: "meta-llama/llama-3.3-70b-instruct:free",
  schema_infer: "meta-llama/llama-3.3-70b-instruct:free",
};

export type OpenRouterProviderOptions = {
  apiKey: string;
  // AI Gateway override. Path up to (but not including)
  // `/chat/completions` — provider appends that suffix. Example:
  // https://gateway.ai.cloudflare.com/v1/{acc}/{gw}/openrouter/api/v1
  baseUrl?: string;
  models?: Partial<Record<LLMOperation, string>>;
};

export function createOpenRouterProvider(opts: OpenRouterProviderOptions): Provider {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return createChatProvider({
    name: "openrouter",
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
