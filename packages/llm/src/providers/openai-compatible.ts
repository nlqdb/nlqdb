// Shared chat-completions caller for OpenAI-compatible HTTP APIs
// (Groq, OpenRouter). Lean by design: no SDK deps, just fetch.
//
// Per @nlqdb GUIDELINES §1: we'd rather write 60 lines than pull in
// the OpenAI / Vercel-AI / LangChain SDK trees for what is ultimately
// `POST /v1/chat/completions` with a JSON body.

import { type CallOpts, ProviderError, type TokenUsage } from "../types.ts";
import { httpError, truncate } from "./_shared.ts";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatRequest = {
  url: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  // OpenAI-compat providers honour `response_format: {type:"json_object"}`
  // for structured outputs; we only set it when the caller wants JSON.
  jsonResponse?: boolean;
  // Forwarded into the request body verbatim. Most callers leave this
  // undefined — the provider's defaults are fine.
  temperature?: number;
  // SK-LLM-048 — `reasoning_effort` for reasoning models (GLM-4.7 on
  // Cerebras). Left unset, GLM spends the whole completion on
  // `reasoning_tokens` and returns empty `content` (→ a `parse` error);
  // `"low"` caps reasoning to ~1.1k tokens and yields clean JSON. Non-reasoning
  // models (gpt-oss-120b, Groq, OpenRouter) leave it undefined.
  reasoningEffort?: "none" | "low" | "medium" | "high";
  // Hard ceiling on completion tokens (reasoning + content combined). Needed
  // alongside `reasoningEffort` so a reasoning model can never exhaust the
  // budget before emitting `content`. Sent as `max_completion_tokens` — the
  // only ceiling param Cerebras documents (reasoning-model endpoints reject
  // the legacy `max_tokens`). Undefined ⇒ the provider default.
  maxTokens?: number;
  // Extra request headers, merged *under* the fixed `content-type` /
  // `authorization` (which always win, so a caller can never silently
  // clobber auth). The BYOLLM provider uses this to carry AI Gateway
  // control headers (`cf-aig-cache-key`, `cf-aig-authorization`).
  headers?: Record<string, string>;
  // Optional per-call usage sink for the hosted-premium meter
  // (premium-tier). Invoked with the response's token usage on a
  // successful 200 (best-effort — skipped when the upstream omits
  // `usage`). Free/BYOLLM callers leave it unset. See `parseChatUsage`.
  onUsage?: (usage: TokenUsage) => void;
};

// OpenAI-compat `usage` shape (AI Gateway passes the upstream's usage
// through). `prompt_tokens` is the TOTAL input including any cached
// prefix; `prompt_tokens_details.cached_tokens` is the cached subset that
// bills at the cache-read rate. Anthropic's native `cache_creation_input_tokens`
// rides through when the gateway preserves it. Every field is optional —
// providers vary — so we read defensively and default to 0.
type ChatUsage = {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
  prompt_tokens_details?: { cached_tokens?: unknown } | null;
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

// Map an OpenAI-compat `usage` object to the meter's four-class `TokenUsage`.
// `inputTokens` is the NON-cached input (cache reads subtracted) so the meter
// can bill each class at its own rate without double-counting (SK-PREMIUM-002 #7).
export function parseChatUsage(usage: ChatUsage | undefined | null): TokenUsage {
  const promptTotal = num(usage?.prompt_tokens);
  const cacheRead = num(usage?.prompt_tokens_details?.cached_tokens);
  return {
    // Never let a bad `cached_tokens > prompt_tokens` drive input negative.
    inputTokens: Math.max(0, promptTotal - cacheRead),
    outputTokens: num(usage?.completion_tokens),
    cacheReadTokens: cacheRead,
    cacheWriteTokens: num(usage?.cache_creation_input_tokens),
  };
}

// Top-level `error` object shape in an OpenAI-compat 200 body. Every field
// is optional/unknown — providers vary (`{message,code}` vs `{message,type}`
// vs OpenRouter's `{message,metadata:{error_type}}`) — so we read defensively.
type BodyError = {
  message?: unknown;
  code?: unknown;
  type?: unknown;
  metadata?: { error_type?: unknown };
};

// A rate-limit surfaced inside a 200 body (no `Retry-After` header to read,
// since the status was already 200) → `rate_limited` so the router backs off
// and the eval treats it as a capacity pause (checkpoint + resume), never a
// scored `no_sql`. Everything else is an upstream provider failure →
// `provider_error`: a failover/tail-retry signal, not the model's fault.
function classifyBodyError(err: BodyError, label: string): ProviderError {
  const code = typeof err.code === "number" ? err.code : undefined;
  const text = [err.message, err.type, err.metadata?.error_type]
    .filter((v): v is string => typeof v === "string")
    .join(" ")
    .toLowerCase();
  const detail = typeof err.message === "string" ? err.message : JSON.stringify(err);
  const message = `${label} → 200 with error body: ${truncate(detail, 160)}`;
  // Word-scoped rate-limit match: a 429 code, a "rate limit" phrase (covers
  // OpenRouter's `rate_limit_exceeded` error_type), or a standalone 429 token.
  // A bare `.includes("rate")` would false-match "generate"/"accurate", tripping
  // a needless breaker pause on a plain provider failure.
  if (code === 429 || /rate[\s_-]?limit/.test(text) || /\b429\b/.test(text)) {
    return new ProviderError(message, "rate_limited", { status: 429 });
  }
  return new ProviderError(message, "provider_error");
}

export async function openAICompatibleChat(req: ChatRequest, opts?: CallOpts): Promise<string> {
  const fetchFn = opts?.fetch ?? globalThis.fetch;
  const body = {
    model: req.model,
    messages: req.messages,
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}),
    ...(req.maxTokens !== undefined ? { max_completion_tokens: req.maxTokens } : {}),
    ...(req.jsonResponse ? { response_format: { type: "json_object" } } : {}),
  };

  let res: Response;
  try {
    res = await fetchFn(req.url, {
      method: "POST",
      headers: {
        ...req.headers,
        "content-type": "application/json",
        authorization: `Bearer ${req.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") throw new ProviderError(`POST ${req.url} aborted`, "timeout");
    throw new ProviderError(`POST ${req.url} failed: ${e.message}`, "network");
  }

  if (!res.ok) throw await httpError(`POST ${req.url}`, res);

  let parsed: {
    choices?: Array<{ message?: { content?: string } }>;
    error?: BodyError;
    usage?: ChatUsage;
  };
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch (err) {
    // The 200 + headers committed, then the router aborted the body read
    // (per-op `plan` timeout / hedge loss) mid-stream — `res.json()` rejects
    // with an AbortError, not a syntax error. Classify it as `timeout` so the
    // eval's NON_ENGINE_REASONS set (SK-QUAL-020) excludes it from the engine
    // signal, instead of misreading an aborted read as the model emitting junk
    // (a spurious `no_sql`). Diagnosed run 14: the frontier lane's 5 s `plan`
    // clamp aborted Sonnet 4.6 here at 5000–5004 ms, tagged `openrouter:parse`.
    if ((err as Error).name === "AbortError" || opts?.signal?.aborted) {
      throw new ProviderError(`POST ${req.url} aborted reading response body`, "timeout");
    }
    throw new ProviderError(`POST ${req.url} → 200 but body not JSON`, "parse");
  }
  // OpenRouter (and other OpenAI-compat gateways) can commit an HTTP 200 +
  // headers, then have the upstream provider fail mid-request — the status
  // can no longer change, so the failure comes back as a top-level `error`
  // envelope in a 200 body (OpenRouter docs, "Errors and debugging"). Left
  // unhandled it falls through to the generic `parse` branch below and is
  // misread as the model emitting junk (an engine answer-signal), when it is
  // really an infra failure. Classify it by its real nature so a 429-shaped
  // 200 backs off (`rate_limited`) and the rest fail over / tail-retry
  // (`provider_error`) instead of scoring a spurious engine `no_sql`.
  if (parsed.error) throw classifyBodyError(parsed.error, `POST ${req.url}`);
  const content = parsed.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new ProviderError(
      `POST ${req.url} → 200 missing choices[0].message.content (got ${truncate(JSON.stringify(parsed), 120)})`,
      "parse",
    );
  }
  // Best-effort usage report for the hosted-premium meter. Only fires when a
  // sink is wired (premium lane) and the upstream returned a `usage` block; a
  // missing/garbled `usage` maps to all-zeros rather than throwing — the
  // caller treats zero billable tokens as unmetered (no slot, no charge —
  // customer-favouring, same as a plan-cache hit).
  if (req.onUsage && parsed.usage) req.onUsage(parseChatUsage(parsed.usage));
  return content;
}
