// Groq — strict-$0 hot-path classification + 70B summarization.
// DESIGN §8.1 free-tier limits: 14,400 RPD on Llama 3.1 8B Instant,
// 1,000 RPD on Llama 3.3 70B / Qwen3 32B.

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

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODELS: Record<LLMOperation, string> = {
  classify: "llama-3.1-8b-instant",
  plan: "llama-3.3-70b-versatile",
  summarize: "llama-3.3-70b-versatile",
};

export type GroqProviderOptions = {
  apiKey: string;
  models?: Partial<Record<LLMOperation, string>>;
};

export function createGroqProvider(opts: GroqProviderOptions): Provider {
  const models = { ...DEFAULT_MODELS, ...opts.models };

  return {
    name: "groq",
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
