// Cloudflare Workers AI — strict-$0 non-US classification fallback
// + future embeddings home. docs/architecture.md §7.1 free-tier limit: 10,000
// Neurons/day. We use the REST endpoint (uniform with the other
// providers) rather than the `AI` Worker binding — keeps the package
// runtime-agnostic and easy to test.

import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  type CallOpts,
  type FetchLike,
  type LLMOperation,
  type Provider,
  ProviderError,
} from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import { gatewayAuthHeader, httpError, truncate } from "./_shared.ts";
import type { ChatMessage } from "./openai-compatible.ts";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  route: "@cf/meta/llama-3.1-8b-instruct",
  plan: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  summarize: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  schema_infer: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  engine_classify: "@cf/meta/llama-3.1-8b-instruct",
};

export type WorkersAIProviderOptions = {
  accountId: string;
  apiToken: string;
  // AI Gateway override. Path up to provider slug; provider appends
  // `/{model}`. Example:
  // https://gateway.ai.cloudflare.com/v1/{acc}/{gw}/workers-ai
  baseUrl?: string;
  // AI Gateway auth token (`cf-aig-authorization`), set when the gateway
  // has Authenticated Gateway enabled (SK-LLM-046). Unset ⇒ no header.
  gatewayToken?: string;
  models?: Partial<Record<LLMOperation, string>>;
  // SK-LLM-055 — stop calling once the Cloudflare account's Workers AI spend
  // today reaches this many neurons. The free 10,000/day is the account's,
  // shared with other Workers on it. Unset ⇒ no check.
  accountNeuronCap?: number;
};

// SK-LLM-055 — the cap value both call sites pass: 3,000 of the account's free
// 10,000 a day stay for the other Workers on the account.
export const WORKERS_AI_ACCOUNT_NEURON_CAP = 7000;

// How long one read of the account's spend is trusted. Analytics lag the
// calls by about a minute anyway.
const SPEND_TTL_MS = 60_000;

const NEURONS_TODAY_QUERY =
  "query ($account: string!, $date: Date!) { viewer { accounts(filter: { accountTag: $account }) { aiInferenceAdaptiveGroups(limit: 1, filter: { date: $date }) { sum { totalNeurons } } } } }";

type NeuronsTodayResponse = {
  data?: {
    viewer?: {
      accounts?: Array<{
        aiInferenceAdaptiveGroups?: Array<{ sum?: { totalNeurons?: number } }>;
      }>;
    };
  } | null;
};

// The account's Workers AI neurons so far today (UTC), from Cloudflare's
// GraphQL analytics; null when unreadable (the token lacks Account Analytics
// read, a network fault, an unexpected shape).
async function readNeuronsToday(
  accountId: string,
  apiToken: string,
  fetchFn: FetchLike,
  now: Date,
): Promise<number | null> {
  return trace
    .getTracer("@nlqdb/llm")
    .startActiveSpan("cloudflare.ai.neurons_today", async (span) => {
      try {
        const res = await fetchFn("https://api.cloudflare.com/client/v4/graphql", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiToken}` },
          body: JSON.stringify({
            query: NEURONS_TODAY_QUERY,
            variables: { account: accountId, date: now.toISOString().slice(0, 10) },
          }),
        });
        span.setAttribute("http.response.status_code", res.status);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as NeuronsTodayResponse;
        const accounts = body.data?.viewer?.accounts;
        if (accounts?.length !== 1) throw new Error("no account in the analytics reply");
        const spent = accounts[0]?.aiInferenceAdaptiveGroups?.[0]?.sum?.totalNeurons ?? 0;
        span.setAttribute("nlqdb.workers_ai.neurons_today", spent);
        return spent;
      } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        return null;
      } finally {
        span.end();
      }
    });
}

function msToUtcMidnight(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

// One cached read per provider instance (an isolate, or an eval process).
function createSpendGuard(accountId: string, apiToken: string, cap: number) {
  let cached: { at: number; spent: number | null } | undefined;
  return async (opts: CallOpts): Promise<void> => {
    const now = new Date();
    if (!cached || now.getTime() - cached.at > SPEND_TTL_MS) {
      const spent = await readNeuronsToday(
        accountId,
        apiToken,
        opts.fetch ?? globalThis.fetch,
        now,
      );
      cached = { at: now.getTime(), spent };
    }
    // Unreadable spends nothing: the chain fails over to the next provider.
    if (cached.spent === null)
      throw new ProviderError("workers-ai: account neuron spend unreadable", "provider_error");
    // A daily quota reads as a 429 until 00:00 UTC, so the router's breaker
    // keeps this provider out of the chain until the allocation resets.
    if (cached.spent >= cap)
      throw new ProviderError(
        `workers-ai: account spent ${Math.round(cached.spent)} of its ${cap}-neuron daily cap`,
        "rate_limited",
        { retryAfterMs: msToUtcMidnight(now) },
      );
  };
}

type WorkersAIResponse = {
  // SK-LLM-036 — `response` is a string for prose output, but the
  // llama-3.3-70b plan model returns valid-JSON output pre-parsed as an
  // object (verified live against the REST endpoint, 2026-06-10).
  result?: { response?: string | Record<string, unknown> };
  success?: boolean;
  errors?: Array<{ code: number; message: string }>;
};

async function workersAIChat(
  accountId: string,
  apiToken: string,
  baseUrl: string | undefined,
  model: string,
  messages: ChatMessage[],
  temperature: number | undefined,
  opts: CallOpts,
  gatewayToken?: string,
): Promise<string> {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const url = baseUrl
    ? `${baseUrl}/${model}`
    : `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`;

  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiToken}`,
        // Only meaningful when `baseUrl` is the AI Gateway; harmless direct.
        ...gatewayAuthHeader(gatewayToken),
      },
      // SK-LLM-024 — greedy (temperature 0) decoding parity with the rest
      // of the free planner chain. Workers AI's default is 0.6 (stochastic);
      // single-pass text-to-SQL EX is measured under greedy decoding, and a
      // deterministic leg keeps the weekly baseline reproducible (SK-QUAL-006).
      // The SK-QUAL-017 self-consistency sampler is the only caller that
      // overrides this with temperature > 0, on its separate code path.
      // `max_tokens`: Workers AI stops at 256 completion tokens by default, which
      // cut a long write's INSERT mid-JSON (`parse`). 4096 fits any 2000-char goal.
      body: JSON.stringify({ messages, temperature: temperature ?? 0, max_tokens: 4096 }),
      signal: opts.signal,
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") throw new ProviderError(`POST workers-ai aborted`, "timeout");
    throw new ProviderError(`POST workers-ai failed: ${e.message}`, "network");
  }

  if (!res.ok) throw await httpError(`POST ${url}`, res);

  let parsed: WorkersAIResponse;
  try {
    parsed = (await res.json()) as WorkersAIResponse;
  } catch {
    throw new ProviderError(`POST ${url} → 200 but body not JSON`, "parse");
  }
  // 2xx with success:false is application-level failure — distinct
  // bucket so dashboards can tell it apart from transport errors.
  if (parsed.success === false) {
    const msg = parsed.errors?.[0]?.message ?? "workers-ai returned success=false";
    throw new ProviderError(
      `POST ${url} → 200 success=false: ${truncate(msg, 200)}`,
      "provider_error",
    );
  }
  const text = parsed.result?.response;
  if (typeof text === "string") return text;
  // SK-LLM-036 — re-serialize an object-shaped response so the shared
  // JSON-response parsing sees the same wire shape as every other leg;
  // rejecting it had structurally dead-ended this provider on `plan`.
  if (text !== null && typeof text === "object" && !Array.isArray(text)) {
    return JSON.stringify(text);
  }
  throw new ProviderError(
    `POST ${url} → 200 missing result.response (got ${truncate(JSON.stringify(parsed), 120)})`,
    "parse",
  );
}

export function createWorkersAIProvider(opts: WorkersAIProviderOptions): Provider {
  const guard =
    opts.accountNeuronCap === undefined
      ? undefined
      : createSpendGuard(opts.accountId, opts.apiToken, opts.accountNeuronCap);
  return createChatProvider({
    name: "workers-ai",
    models: { ...DEFAULT_MODELS, ...opts.models },
    callChat: async ({ model, messages, temperature, opts: callOpts }) => {
      await guard?.(callOpts);
      return workersAIChat(
        opts.accountId,
        opts.apiToken,
        opts.baseUrl,
        model,
        messages,
        temperature,
        callOpts,
        opts.gatewayToken,
      );
    },
  });
}
