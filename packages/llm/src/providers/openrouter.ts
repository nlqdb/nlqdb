// OpenRouter — universal :free fallback when Gemini/Groq are out.
// docs/architecture.md §7.1: 50 RPD without credits / 1000 RPD after a one-time
// $10 deposit (kept even if balance falls back to $0). Same OpenAI-compat shape
// as Groq, different host. SK-LLM-015: code-gen ops (plan, schema_infer) default
// to `qwen/qwen3-coder:free` (480B MoE, 1M context) for SQL/SchemaPlan quality;
// text + intent ops stay on Llama for speed.

import type { LLMOperation, Provider } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  route: "meta-llama/llama-3.1-8b-instruct:free",
  plan: "qwen/qwen3-coder:free",
  summarize: "meta-llama/llama-3.3-70b-instruct:free",
  schema_infer: "qwen/qwen3-coder:free",
  engine_classify: "meta-llama/llama-3.1-8b-instruct:free",
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
