// Mistral — strict-$0 capacity backstop on the planner-tier chain
// (SK-LLM-028). Sits at the chain tail behind Cerebras → Gemini → Groq →
// Workers-AI → OpenRouter, so it only fires on the ~10% of questions
// where every head provider is rate-limited out (the baseline's
// `all providers in chain failed` no_sql losses). Mistral Large 3
// (`mistral-large-latest`) on the card-free Experiment tier (verified
// live 2026-06: no card, 1B tokens/month renewable, 500K tokens/min) —
// an independent free-tier RPM pool that doesn't share the head chain's
// exhausted quota. OpenAI-compatible, so it reuses `openAICompatibleChat`.

import type { LLMOperation, Provider } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://api.mistral.ai/v1";

// Only `plan` / `schema_infer` route to Mistral in the chains, but every
// op needs a default for `provider.model()`. Mistral Large 3 is the
// strongest card-free reasoning model the Experiment tier exposes.
const DEFAULT_MODEL = "mistral-large-latest";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  route: DEFAULT_MODEL,
  plan: DEFAULT_MODEL,
  summarize: DEFAULT_MODEL,
  schema_infer: DEFAULT_MODEL,
  engine_classify: DEFAULT_MODEL,
};

export type MistralProviderOptions = {
  apiKey: string;
  // AI Gateway override. Path up to (but not including) `/chat/completions`.
  baseUrl?: string;
  models?: Partial<Record<LLMOperation, string>>;
};

export function createMistralProvider(opts: MistralProviderOptions): Provider {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return createChatProvider({
    name: "mistral",
    models: { ...DEFAULT_MODELS, ...opts.models },
    callChat: ({ model, messages, jsonMode, opts: callOpts }) =>
      openAICompatibleChat(
        {
          url: `${baseUrl}/chat/completions`,
          apiKey: opts.apiKey,
          model,
          messages,
          jsonResponse: jsonMode,
          // Greedy decoding parity across the free planner chain (SK-LLM-024).
          temperature: 0,
        },
        callOpts,
      ),
  });
}
