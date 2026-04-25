// Cloudflare Workers AI — strict-$0 non-US classification fallback
// + future embeddings home. DESIGN §8.1 free-tier limit: 10,000
// Neurons/day. We use the REST endpoint (uniform with the other
// providers) rather than the `AI` Worker binding — keeps the package
// runtime-agnostic and easy to test.

import {
  buildClassifyUser,
  buildPlanUser,
  buildSummarizeUser,
  CLASSIFY_SYSTEM,
  PLAN_SYSTEM,
  SUMMARIZE_SYSTEM,
} from "../prompts.ts";
import {
  type CallOpts,
  type ClassifyRequest,
  type ClassifyResponse,
  type LLMOperation,
  type PlanRequest,
  type PlanResponse,
  type Provider,
  ProviderError,
  type SummarizeRequest,
  type SummarizeResponse,
} from "../types.ts";
import { type ChatMessage, parseJsonResponse } from "./openai-compatible.ts";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  classify: "@cf/meta/llama-3.1-8b-instruct",
  plan: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  summarize: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
};

export type WorkersAIProviderOptions = {
  accountId: string;
  apiToken: string;
  models?: Partial<Record<LLMOperation, string>>;
};

type WorkersAIResponse = {
  result?: { response?: string };
  success?: boolean;
  errors?: Array<{ code: number; message: string }>;
};

async function workersAICall(
  accountId: string,
  apiToken: string,
  model: string,
  messages: ChatMessage[],
  callOpts?: CallOpts,
): Promise<string> {
  const fetchFn = callOpts?.fetch ?? globalThis.fetch;
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    accountId,
  )}/ai/run/${model}`;

  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ messages }),
      signal: callOpts?.signal,
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") throw new ProviderError("aborted", "timeout");
    throw new ProviderError(`fetch failed: ${e.message}`, "network");
  }

  if (!res.ok) {
    const reason = res.status >= 500 ? "http_5xx" : "http_4xx";
    throw new ProviderError(`http ${res.status}`, reason, res.status);
  }

  let parsed: WorkersAIResponse;
  try {
    parsed = (await res.json()) as WorkersAIResponse;
  } catch {
    throw new ProviderError("response not JSON", "parse");
  }
  if (parsed.success === false) {
    const msg = parsed.errors?.[0]?.message ?? "workers-ai returned success=false";
    throw new ProviderError(msg, "http_4xx");
  }
  const text = parsed.result?.response;
  if (typeof text !== "string") {
    throw new ProviderError("response missing result.response", "parse");
  }
  return text;
}

export function createWorkersAIProvider(opts: WorkersAIProviderOptions): Provider {
  const models = { ...DEFAULT_MODELS, ...opts.models };

  return {
    name: "workers-ai",
    model: (op) => models[op],
    async classify(req: ClassifyRequest, callOpts?: CallOpts): Promise<ClassifyResponse> {
      const raw = await workersAICall(
        opts.accountId,
        opts.apiToken,
        models.classify,
        [
          { role: "system", content: CLASSIFY_SYSTEM },
          { role: "user", content: buildClassifyUser(req) },
        ],
        callOpts,
      );
      return parseJsonResponse<ClassifyResponse>(raw);
    },
    async plan(req: PlanRequest, callOpts?: CallOpts): Promise<PlanResponse> {
      const raw = await workersAICall(
        opts.accountId,
        opts.apiToken,
        models.plan,
        [
          { role: "system", content: PLAN_SYSTEM },
          { role: "user", content: buildPlanUser(req) },
        ],
        callOpts,
      );
      return parseJsonResponse<PlanResponse>(raw);
    },
    async summarize(req: SummarizeRequest, callOpts?: CallOpts): Promise<SummarizeResponse> {
      const raw = await workersAICall(
        opts.accountId,
        opts.apiToken,
        models.summarize,
        [
          { role: "system", content: SUMMARIZE_SYSTEM },
          { role: "user", content: buildSummarizeUser(req) },
        ],
        callOpts,
      );
      return { summary: raw.trim() };
    },
  };
}
