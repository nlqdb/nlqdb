// Google AI Studio (Gemini) — strict-$0 plan workhorse + hard-plan
// fallback. DESIGN §8.1 free-tier limits: 500 RPD on Flash, 100 RPD
// on Pro. Wire format is Google's, not OpenAI's.

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
import { parseJsonResponse } from "./openai-compatible.ts";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  classify: "gemini-2.5-flash",
  plan: "gemini-2.5-flash",
  summarize: "gemini-2.5-flash",
};

export type GeminiProviderOptions = {
  apiKey: string;
  models?: Partial<Record<LLMOperation, string>>;
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

async function geminiCall(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userText: string,
  jsonResponse: boolean,
  callOpts?: CallOpts,
): Promise<string> {
  const fetchFn = callOpts?.fetch ?? globalThis.fetch;
  const url = `${BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0,
      ...(jsonResponse ? { responseMimeType: "application/json" } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
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

  let parsed: GeminiResponse;
  try {
    parsed = (await res.json()) as GeminiResponse;
  } catch {
    throw new ProviderError("response not JSON", "parse");
  }
  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new ProviderError("response missing candidates[0].content.parts[0].text", "parse");
  }
  return text;
}

export function createGeminiProvider(opts: GeminiProviderOptions): Provider {
  const models = { ...DEFAULT_MODELS, ...opts.models };

  return {
    name: "gemini",
    model: (op) => models[op],
    async classify(req: ClassifyRequest, callOpts?: CallOpts): Promise<ClassifyResponse> {
      const raw = await geminiCall(
        opts.apiKey,
        models.classify,
        CLASSIFY_SYSTEM,
        buildClassifyUser(req),
        true,
        callOpts,
      );
      return parseJsonResponse<ClassifyResponse>(raw);
    },
    async plan(req: PlanRequest, callOpts?: CallOpts): Promise<PlanResponse> {
      const raw = await geminiCall(
        opts.apiKey,
        models.plan,
        PLAN_SYSTEM,
        buildPlanUser(req),
        true,
        callOpts,
      );
      return parseJsonResponse<PlanResponse>(raw);
    },
    async summarize(req: SummarizeRequest, callOpts?: CallOpts): Promise<SummarizeResponse> {
      const raw = await geminiCall(
        opts.apiKey,
        models.summarize,
        SUMMARIZE_SYSTEM,
        buildSummarizeUser(req),
        false,
        callOpts,
      );
      return { summary: raw.trim() };
    },
  };
}
