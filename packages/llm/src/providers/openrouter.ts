// OpenRouter — universal :free fallback when Gemini/Groq are out.
// docs/architecture.md §7.1: 50 RPD without credits / 1000 RPD after a one-time
// $10 deposit (kept even if balance falls back to $0). Same OpenAI-compat shape
// as Groq, different host. SK-LLM-045: OpenRouter pulled the SK-LLM-015 Qwen3
// Coder + Llama 3.x `:free` ids from its catalog (verified live 2026-08-08 —
// all three now paid-only); code-gen ops (plan, schema_infer, summarize)
// default to `nvidia/nemotron-3-ultra-550b-a55b:free` (SWE-bench Verified
// 71.9%, 1M context); text + intent ops (route, engine_classify) move to
// `google/gemma-4-26b-a4b-it:free` for speed.

import type { LLMOperation, Provider } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { gatewayAuthHeader } from "./_shared.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  route: "google/gemma-4-26b-a4b-it:free",
  plan: "nvidia/nemotron-3-ultra-550b-a55b:free",
  summarize: "nvidia/nemotron-3-ultra-550b-a55b:free",
  schema_infer: "nvidia/nemotron-3-ultra-550b-a55b:free",
  engine_classify: "google/gemma-4-26b-a4b-it:free",
};

export type OpenRouterProviderOptions = {
  apiKey: string;
  // AI Gateway override. Path up to (but not including)
  // `/chat/completions` — provider appends that suffix. Example:
  // https://gateway.ai.cloudflare.com/v1/{acc}/{gw}/openrouter/api/v1
  baseUrl?: string;
  // AI Gateway auth token (`cf-aig-authorization`), set when the gateway
  // has Authenticated Gateway enabled (SK-LLM-046). Unset ⇒ no header.
  gatewayToken?: string;
  models?: Partial<Record<LLMOperation, string>>;
};

export function createOpenRouterProvider(opts: OpenRouterProviderOptions): Provider {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return createChatProvider({
    name: "openrouter",
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
          headers: gatewayAuthHeader(opts.gatewayToken),
        },
        callOpts,
      ),
  });
}
