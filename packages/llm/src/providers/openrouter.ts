// OpenRouter — universal :free fallback when Gemini/Groq are out.
// DESIGN §8.1: ~200 RPD across :free models. Same OpenAI-compat shape
// as Groq, different host.

import type { LLMOperation, Provider } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  classify: "meta-llama/llama-3.1-8b-instruct:free",
  plan: "meta-llama/llama-3.3-70b-instruct:free",
  summarize: "meta-llama/llama-3.3-70b-instruct:free",
};

export type OpenRouterProviderOptions = {
  apiKey: string;
  endpoint?: string;
  models?: Partial<Record<LLMOperation, string>>;
};

export function createOpenRouterProvider(opts: OpenRouterProviderOptions): Provider {
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  return createChatProvider({
    name: "openrouter",
    models: { ...DEFAULT_MODELS, ...opts.models },
    callChat: ({ model, messages, jsonMode, opts: callOpts }) =>
      openAICompatibleChat(
        {
          url: endpoint,
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
