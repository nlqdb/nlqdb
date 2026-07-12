// Generic provider builder. Every chat-style provider plugs in a
// per-wire-format `callChat` and gets the shared operations
// (route / plan / summarize / schemaInfer / engineClassify) plumbed
// identically — same prompts, same JSON parsing, same `Provider`
// shape.
//
// Each provider file shrinks to ~25 lines of "name + models + how to
// call my API." Adding a 5th provider becomes a config change, not a
// copy-paste of nearly-identical methods.

import { buildPlanSystem } from "../plan-exemplar-pool.ts";
import { buildSchemaInferUser, SCHEMA_INFER_SYSTEM } from "../prompts/schema-inference.ts";
import {
  buildEngineClassifyUser,
  buildPlanUser,
  buildRouteUser,
  buildSummarizeUser,
  ENGINE_CLASSIFY_SYSTEM,
  ROUTE_SYSTEM,
  SUMMARIZE_SYSTEM,
} from "../prompts.ts";
import type {
  CallOpts,
  EngineClassifyResponse,
  LLMOperation,
  PlanResponse,
  Provider,
  ProviderName,
  RouteResponse,
  SchemaInferResponse,
} from "../types.ts";
import { parseJsonResponse } from "./_shared.ts";
import type { ChatMessage } from "./openai-compatible.ts";

export type ChatCallArgs = {
  model: string;
  messages: ChatMessage[];
  // Whether the caller expects strict JSON back. Providers that have
  // a native "JSON mode" (OpenAI-compat `response_format`, Gemini
  // `responseMimeType`) should set it; others should still honour the
  // contract via prompting.
  jsonMode: boolean;
  // SK-QUAL-017 — decoding temperature. Undefined on every call except the
  // self-consistency `plan` sampling path; each provider treats undefined as
  // greedy `0` (the SK-LLM-024 invariant).
  temperature?: number;
  opts: CallOpts;
};

export type ChatProviderImpl = {
  name: ProviderName;
  models: Record<LLMOperation, string>;
  callChat: (args: ChatCallArgs) => Promise<string>;
};

export function createChatProvider(impl: ChatProviderImpl): Provider {
  return {
    name: impl.name,
    model: (op) => impl.models[op],
    async route(req, opts = {}) {
      const raw = await impl.callChat({
        model: impl.models.route,
        messages: [
          { role: "system", content: ROUTE_SYSTEM },
          { role: "user", content: buildRouteUser(req) },
        ],
        jsonMode: true,
        opts,
      });
      return parseJsonResponse<RouteResponse>(raw);
    },
    async plan(req, opts = {}) {
      const model = impl.models.plan;
      const raw = await impl.callChat({
        model,
        messages: [
          // SK-LLM-041 half (b) — default (`retrieveExemplars` unset) returns
          // the static PLAN_SYSTEM byte-for-byte (SK-LLM-024); only the eval's
          // dispatch sets it > 0 to A/B retrieved few-shot.
          {
            role: "system",
            content: buildPlanSystem(req.goal, req.schema, req.retrieveExemplars ?? 0),
          },
          { role: "user", content: buildPlanUser(req) },
        ],
        jsonMode: true,
        // SK-QUAL-017 — only the self-consistency sampler sets this; every
        // production plan() leaves it undefined ⇒ greedy (SK-LLM-024).
        temperature: req.temperature,
        opts,
      });
      // SK-TRUST-002: the trace block wants the model that emitted the
      // plan + a per-plan confidence. Placeholder 1.0 until the
      // `quality-eval` harness calibrates per-stage floors (SK-TRUST-003).
      const parsed = parseJsonResponse<{ sql: string }>(raw);
      return { sql: parsed.sql, model, confidence: 1.0 } satisfies PlanResponse;
    },
    async summarize(req, opts = {}) {
      const raw = await impl.callChat({
        model: impl.models.summarize,
        messages: [
          { role: "system", content: SUMMARIZE_SYSTEM },
          { role: "user", content: buildSummarizeUser(req) },
        ],
        jsonMode: false,
        opts,
      });
      return { summary: raw.trim() };
    },
    async schemaInfer(req, opts = {}) {
      const model = impl.models.schema_infer;
      const raw = await impl.callChat({
        model,
        messages: [
          { role: "system", content: SCHEMA_INFER_SYSTEM },
          { role: "user", content: buildSchemaInferUser(req) },
        ],
        jsonMode: true,
        opts,
      });
      // Caller validates against the canonical Zod schema in
      // `@nlqdb/db/types`. We just hand back the parsed object;
      // wrapping in `{plan}` keeps the response shape uniform with
      // route/plan/summarize.
      const parsed = parseJsonResponse<Record<string, unknown>>(raw);
      // SK-TRUST-002: model + placeholder confidence feed the create
      // response's trace block, same posture as plan() above.
      return { plan: parsed, model, confidence: 1.0 } satisfies SchemaInferResponse;
    },
    async engineClassify(req, opts = {}) {
      const raw = await impl.callChat({
        model: impl.models.engine_classify,
        messages: [
          { role: "system", content: ENGINE_CLASSIFY_SYSTEM },
          { role: "user", content: buildEngineClassifyUser(req) },
        ],
        jsonMode: true,
        opts,
      });
      return parseJsonResponse<EngineClassifyResponse>(raw);
    },
  };
}
