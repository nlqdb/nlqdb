// Google AI Studio (Gemini) — strict-$0 plan workhorse + hard-plan
// fallback. Free-tier limits: docs/architecture.md §7.1 (3.8 Flash ~20 RPD,
// per key in AI Studio). Wire format is Google's, not OpenAI's.
//
// `GEMINI_API_KEY` is a FREE-TIER key (GLOBAL-013): never link billing on it
// or switch the default model here to a paid one. A denial → rotate to a
// fresh/unflagged free-tier AI Studio key (SK-LLM-039), not billing. Paid
// Gemini (2.5 Pro) belongs to the separate hosted-premium lane (SK-LLM-017;
// v1 is Anthropic-only), on its own credential — never this key.

import { type CallOpts, type LLMOperation, type Provider, ProviderError } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { gatewayAuthHeader, httpError, truncate } from "./_shared.ts";
import type { ChatMessage } from "./openai-compatible.ts";

const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// gemini-2.5-flash is redirected to gemini-3.5-flash-lite on 2026-12-01
// (aistudio.google.com/docs/deprecations); 3.8 Flash is the stable free-tier
// Flash, so the chain keeps a full Flash instead of silently dropping to Lite.
const DEFAULT_MODELS: Record<LLMOperation, string> = {
  route: "gemini-3.8-flash",
  plan: "gemini-3.8-flash",
  summarize: "gemini-3.8-flash",
  schema_infer: "gemini-3.8-flash",
  engine_classify: "gemini-3.8-flash",
};

export type GeminiProviderOptions = {
  apiKey: string;
  // AI Gateway override. Path up to `/models`; provider appends
  // `/{model}:generateContent`. Example:
  // https://gateway.ai.cloudflare.com/v1/{acc}/{gw}/google-ai-studio/v1beta/models
  baseUrl?: string;
  // AI Gateway auth token (`cf-aig-authorization`), set when the gateway
  // has Authenticated Gateway enabled (SK-LLM-046). Unset ⇒ no header.
  gatewayToken?: string;
  models?: Partial<Record<LLMOperation, string>>;
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

// Gemini's chat shape: a single user `contents` block plus a
// `systemInstruction`. We collapse our `[system, user]` messages array
// back into Gemini's structure here so the rest of the package works
// with the OpenAI-shaped messages format.
async function geminiChat(
  apiKey: string,
  base: string,
  model: string,
  messages: ChatMessage[],
  jsonMode: boolean,
  temperature: number | undefined,
  opts: CallOpts,
  gatewayToken?: string,
): Promise<string> {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  // API key passed via `x-goog-api-key` header rather than the
  // (also-supported) `?key=` query param. Keeps the secret out of any
  // path/URL surfaced by `wrangler tail`, span exception messages, or
  // upstream error bodies that echo the request URL.
  const url = `${base}/${encodeURIComponent(model)}:generateContent`;

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const userText = messages
    .filter((m) => m.role !== "system")
    .map((m) => m.content)
    .join("\n");

  const body = {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      // Greedy (SK-LLM-024) unless the SK-QUAL-017 sampler overrides.
      temperature: temperature ?? 0,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
        ...gatewayAuthHeader(gatewayToken),
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") throw new ProviderError(`POST gemini aborted`, "timeout");
    throw new ProviderError(`POST gemini failed: ${e.message}`, "network");
  }

  if (!res.ok) throw await httpError(`POST ${url}`, res);

  let parsed: GeminiResponse;
  try {
    parsed = (await res.json()) as GeminiResponse;
  } catch {
    throw new ProviderError(`POST gemini → 200 but body not JSON`, "parse");
  }
  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new ProviderError(
      `POST gemini → 200 missing candidates[0].content.parts[0].text (got ${truncate(JSON.stringify(parsed), 120)})`,
      "parse",
    );
  }
  return text;
}

export function createGeminiProvider(opts: GeminiProviderOptions): Provider {
  const base = opts.baseUrl ?? DEFAULT_BASE;
  return createChatProvider({
    name: "gemini",
    models: { ...DEFAULT_MODELS, ...opts.models },
    callChat: ({ model, messages, jsonMode, temperature, opts: callOpts }) =>
      geminiChat(
        opts.apiKey,
        base,
        model,
        messages,
        jsonMode,
        temperature,
        callOpts,
        opts.gatewayToken,
      ),
  });
}
