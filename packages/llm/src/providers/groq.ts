// Groq — strict-$0 hot-path classification + planner-tier summarization.
// llama-3.1-8b-instant + llama-3.3-70b-versatile were decommissioned by Groq
// on 2026-08-16; migrated to the recommended replacements per SK-LLM-003.
// docs/architecture.md §7.1 free-tier limits: 1,000 RPD on gpt-oss-20b /
// gpt-oss-120b (Groq's per-model free cap; route/classify overflow falls
// through to Workers-AI + OpenRouter).

import type { LLMOperation, Provider, ProviderName } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { gatewayAuthHeader } from "./_shared.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

// SK-LLM-053 — Qwen3.6-27B (`qwen/qwen3.6-27b`), served on the same card-free
// Groq key as gpt-oss. A 27B dense coder/reasoner at ~77% SWE-bench Verified
// (above the pulled GLM-4.7's 73.8% and far above gpt-oss-120b's ~30%). It
// emits a short bounded reasoning trace then clean JSON `content` in its
// DEFAULT decoding mode (verified live 2026-08-22, ~1.2 s on a small planner
// prompt) — so, unlike GLM-4.7 on Cerebras, it needs NO `reasoning_effort`.
// The opposite is true here: forcing `reasoning_effort` returns empty
// `content` (a silent `parse` outage, verified 2026-08-22), so this head is
// deliberately dispatched plain.
const QWEN_PLANNER_MODEL = "qwen/qwen3.6-27b";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  // SK-ASK-009 — merged routeAsk rides the cheap-tier model. Prompt
  // is short (goal + dbset + recent-tables MRU), budget is 1500 ms.
  route: "openai/gpt-oss-20b",
  plan: "openai/gpt-oss-120b",
  summarize: "openai/gpt-oss-120b",
  schema_infer: "openai/gpt-oss-120b",
  // Engine classification (SK-DB-010) — short prompt (the engine-fit
  // table + one goal sentence), cheap-tier model, same budget as route.
  engine_classify: "openai/gpt-oss-20b",
};

export type GroqProviderOptions = {
  apiKey: string;
  // AI Gateway override. Path up to (but not including)
  // `/chat/completions` — provider appends that suffix. Example:
  // https://gateway.ai.cloudflare.com/v1/{acc}/{gw}/groq/openai/v1
  baseUrl?: string;
  // AI Gateway auth token (`cf-aig-authorization`), set when the gateway
  // has Authenticated Gateway enabled (SK-LLM-046). Unset ⇒ no header.
  gatewayToken?: string;
  models?: Partial<Record<LLMOperation, string>>;
  // SK-LLM-053 — chain-name override so a Qwen3.6-27B instance and the default
  // gpt-oss instance can both sit in the chain off the same key (mirrors the
  // `createCerebrasGlmProvider` pattern).
  name?: ProviderName;
};

export function createGroqProvider(opts: GroqProviderOptions): Provider {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return createChatProvider({
    name: opts.name ?? "groq",
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

// SK-LLM-053 — the Qwen3.6-27B planner head. Same Groq key/base as
// `createGroqProvider`, distinct chain name `groq-qwen`, Qwen on the two
// planner ops (`plan` / `schema_infer`); the other ops keep the gpt-oss
// defaults but are never named in a chain for this instance. Dispatched plain
// (no `reasoning_effort`) — the model self-bounds its reasoning and returns
// clean JSON `content` in default mode, and forcing the effort param empties
// `content` (verified live 2026-08-22). The slug lives once, here.
export function createGroqQwenProvider(
  opts: Pick<GroqProviderOptions, "apiKey" | "baseUrl" | "gatewayToken">,
): Provider {
  return createGroqProvider({
    ...opts,
    name: "groq-qwen",
    models: { plan: QWEN_PLANNER_MODEL, schema_infer: QWEN_PLANNER_MODEL },
  });
}
