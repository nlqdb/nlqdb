// Cerebras — strict-$0 planner-tier upgrade (SK-LLM-023). Serves OpenAI's
// gpt-oss-120b on wafer-scale silicon: a frontier-class open-weight
// reasoning model (≈ o4-mini parity) at the highest throughput of any
// provider (~3,000 tok/s), so it leads the `plan` / `schema_infer` chains
// and almost always wins the SK-LLM-014 hedge before the head-start fires.
// Model id verified against the live `/v1/models` for our key (2026-06).
//
// Free tier (verified 2026-06): 1M tokens/day, no card, 30 RPM; model
// context window is 131K. On a 429 (the 30 RPM cap) or an over-long schema
// the call 4xx's → the router fails over to Gemini next in chain, so the
// chain degrades gracefully.
// OpenAI-compatible chat-completions, so it reuses `openAICompatibleChat`.

import type { LLMOperation, Provider } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://api.cerebras.ai/v1";

// One model across ops: only `plan` / `schema_infer` route to Cerebras in
// the chains, but every op needs a default for `provider.model()`.
const DEFAULT_MODEL = "gpt-oss-120b";

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
