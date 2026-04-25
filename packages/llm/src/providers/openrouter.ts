// OpenRouter — universal :free fallback when Gemini/Groq are out.
// DESIGN §8.1: ~200 RPD across :free models. Same OpenAI-compat shape
// as Groq, different host + a couple of recommended headers.

import {
  buildClassifyUser,
  buildPlanUser,
  buildSummarizeUser,
  CLASSIFY_SYSTEM,
  PLAN_SYSTEM,
  SUMMARIZE_SYSTEM,
} from "../prompts.ts";
import type {
  CallOpts,
  ClassifyRequest,
  ClassifyResponse,
  LLMOperation,
  PlanRequest,
  PlanResponse,
  Provider,
  SummarizeRequest,
  SummarizeResponse,
} from "../types.ts";
import { openAICompatibleChat, parseJsonResponse } from "./openai-compatible.ts";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  classify: "meta-llama/llama-3.1-8b-instruct:free",
  plan: "meta-llama/llama-3.3-70b-instruct:free",
  summarize: "meta-llama/llama-3.3-70b-instruct:free",
};

export type OpenRouterProviderOptions = {
  apiKey: string;
  models?: Partial<Record<LLMOperation, string>>;
};

export function createOpenRouterProvider(opts: OpenRouterProviderOptions): Provider {
  const models = { ...DEFAULT_MODELS, ...opts.models };

  return {
    name: "openrouter",
    model: (op) => models[op],
    async classify(req: ClassifyRequest, callOpts?: CallOpts): Promise<ClassifyResponse> {
      const raw = await openAICompatibleChat(
        {
          url: ENDPOINT,
          apiKey: opts.apiKey,
          model: models.classify,
          messages: [
            { role: "system", content: CLASSIFY_SYSTEM },
            { role: "user", content: buildClassifyUser(req) },
          ],
          jsonResponse: true,
          temperature: 0,
        },
        callOpts,
      );
      return parseJsonResponse<ClassifyResponse>(raw);
    },
    async plan(req: PlanRequest, callOpts?: CallOpts): Promise<PlanResponse> {
      const raw = await openAICompatibleChat(
        {
          url: ENDPOINT,
          apiKey: opts.apiKey,
          model: models.plan,
          messages: [
            { role: "system", content: PLAN_SYSTEM },
            { role: "user", content: buildPlanUser(req) },
          ],
          jsonResponse: true,
          temperature: 0,
        },
        callOpts,
      );
      return parseJsonResponse<PlanResponse>(raw);
    },
    async summarize(req: SummarizeRequest, callOpts?: CallOpts): Promise<SummarizeResponse> {
      const raw = await openAICompatibleChat(
        {
          url: ENDPOINT,
          apiKey: opts.apiKey,
          model: models.summarize,
          messages: [
            { role: "system", content: SUMMARIZE_SYSTEM },
            { role: "user", content: buildSummarizeUser(req) },
          ],
        },
        callOpts,
      );
      return { summary: raw.trim() };
    },
  };
}
