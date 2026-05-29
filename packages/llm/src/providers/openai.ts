// OpenAI provider for BYOLLM (SK-PREMIUM-008). Thin wrapper around
// openai-compatible.ts — OpenAI invented that format, so no translation needed.

import type { LLMOperation, Provider } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  route: "gpt-4o-mini",
  plan: "gpt-4o",
  summarize: "gpt-4o-mini",
  schema_infer: "gpt-4o",
  engine_classify: "gpt-4o-mini",
};

export type OpenAIProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  models?: Partial<Record<LLMOperation, string>>;
};

export function createOpenAIProvider(opts: OpenAIProviderOptions): Provider {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return createChatProvider({
    name: "openai",
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
