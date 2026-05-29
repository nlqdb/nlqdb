// Anthropic Messages API provider for BYOLLM (SK-PREMIUM-008).
// Wire format is Anthropic's, not OpenAI's — native Messages API.

import type { CallOpts, LLMOperation, Provider } from "../types.ts";
import { ProviderError } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { httpReason, readBodySafe, truncate } from "./_shared.ts";
import type { ChatMessage } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  route: "claude-haiku-4-5-20251001",
  plan: "claude-sonnet-4-6",
  summarize: "claude-haiku-4-5-20251001",
  schema_infer: "claude-sonnet-4-6",
  engine_classify: "claude-haiku-4-5-20251001",
};

export type AnthropicProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  models?: Partial<Record<LLMOperation, string>>;
};

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
};

async function anthropicChat(
  apiKey: string,
  base: string,
  model: string,
  messages: ChatMessage[],
  jsonMode: boolean,
  opts: CallOpts,
): Promise<string> {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const url = `${base}/messages`;

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const userMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Anthropic has no native response_format; prefill `{` to steer the model
  // into starting its reply as JSON (documented Anthropic technique for JSON output).
  if (jsonMode) {
    userMessages.push({ role: "assistant", content: "{" });
  }

  const body = {
    model,
    max_tokens: 4096,
    ...(system ? { system } : {}),
    messages: userMessages,
  };

  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") throw new ProviderError("POST anthropic aborted", "timeout");
    throw new ProviderError(`POST anthropic failed: ${e.message}`, "network");
  }

  if (!res.ok) {
    const bodySnippet = await readBodySafe(res);
    throw new ProviderError(
      `POST ${url} → ${res.status}: ${bodySnippet}`,
      httpReason(res.status),
      res.status,
    );
  }

  let parsed: AnthropicResponse;
  try {
    parsed = (await res.json()) as AnthropicResponse;
  } catch {
    throw new ProviderError("POST anthropic → 200 but body not JSON", "parse");
  }

  const text = parsed.content?.find((b) => b.type === "text")?.text;
  if (typeof text !== "string") {
    throw new ProviderError(
      `POST anthropic → 200 missing text block (got ${truncate(JSON.stringify(parsed), 120)})`,
      "parse",
    );
  }
  // Re-prepend the prefill character stripped by the API so parseJsonResponse
  // receives a complete JSON object, not a fragment starting at the second char.
  return jsonMode ? `{${text}` : text;
}

export function createAnthropicProvider(opts: AnthropicProviderOptions): Provider {
  const base = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return createChatProvider({
    name: "anthropic",
    models: { ...DEFAULT_MODELS, ...opts.models },
    callChat: ({ model, messages, jsonMode, opts: callOpts }) =>
      anthropicChat(opts.apiKey, base, model, messages, jsonMode, callOpts),
  });
}
