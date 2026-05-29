// Public types for @nlqdb/llm. Operation set tracks PERFORMANCE §4
// row 4 (Slice 4): plan / summarize plus the three op-specific calls.
// `route` is the cheap-tier op that decides `{kind, targetDbId,
// referencedTables}` for `/v1/ask` (SK-ASK-009) — it replaces the
// older `classify` + `disambiguate` pair. `schema_infer` is the
// planner-tier op for hosted db.create's typed-plan pipeline
// (SK-HDC-002, span `llm.schema_infer`). `engine_classify` is the
// cheap-tier op that picks an engine from goal text on db.create per
// `SK-DB-010` / `SK-MULTIENG-002` (span `llm.engine_classify`).
// embed lands later alongside the embeddings pipeline.

// `"byollm"` is the per-tenant bring-your-own-key lane (SK-LLM-016):
// one provider whose upstream model + credentials are supplied by the
// signed-in user and proxied through Cloudflare AI Gateway. The
// upstream model (`openai/gpt-5.2`, `anthropic/claude-4-5-sonnet`, …)
// rides the `llm.model` span attribute, so the single `byollm` label
// keeps the failover/cache metric cardinality bounded.
export type ProviderName = "gemini" | "groq" | "workers-ai" | "openrouter" | "byollm";

export type LLMOperation = "route" | "plan" | "summarize" | "schema_infer" | "engine_classify";

// Reasons surfaced on `nlqdb.llm.failover.total{reason}` — bounded set
// to keep the label cardinality safe (PERFORMANCE §3.3).
//
// `not_configured` covers the case where a chain entry's provider was
// never registered (e.g. `OPENROUTER_API_KEY` unset at boot) — the
// router still falls through to the next entry, so it's a real
// failover from the dashboards' point of view.
//
// `unknown` covers non-ProviderError exceptions surfacing through the
// chain (programmer errors, unexpected throws). Tagged separately so
// dashboards don't lie that we had a network failure when in fact our
// own code threw.
//
// `provider_error` covers application-level failure on a 2xx — e.g.
// Cloudflare Workers AI returns HTTP 200 with `{success:false}`. It's
// not an HTTP-class error, but it's not a transport or parse problem
// either, so it gets its own bucket.
export type FailoverReason =
  | "http_5xx"
  | "http_4xx"
  | "network"
  | "timeout"
  | "parse"
  | "not_configured"
  | "provider_error"
  | "circuit_open"
  // SK-LLM-014 — hedged sibling won the race; this leg was aborted by
  // us, not by a real provider failure. Kept distinct from `timeout`
  // so the circuit breaker doesn't trip the loser on a successful
  // hedge and dashboards can show how often hedging fires.
  | "hedge_lost"
  | "unknown";

// `"sqlite"` is widened here for the `quality-eval` harness only
// (BIRD Mini-Dev ships SQLite fixtures, per SK-QUAL-003). Production
// callers in `apps/api/src/ask/**` still pass `"postgres"`; the LLM
// reads the literal verbatim in the prompt and emits dialect-matching
// SQL.
export type PlanRequest = {
  goal: string;
  schema: string;
  dialect: "postgres" | "sqlite";
  // GLOBAL-022 — when a previous plan attempt's SQL was rejected by the
  // validator (or the LLM call itself failed), the orchestrator passes
  // the prior attempt's SQL + reject reason here so the prompt can
  // produce a different shape. Absent on first attempts. Capped at the
  // builder; providers reuse `buildPlanUser` so no plumbing per provider.
  previousAttempt?: { sql?: string; error: string };
};
// `model` + `confidence` populate SK-TRUST-002's response-level
// `trace` block. `confidence` is a placeholder until the
// `quality-eval` harness (Phase 3) calibrates per-stage floors per
// SK-TRUST-003; providers ship `1.0` today.
export type PlanResponse = { sql: string; model: string; confidence: number };

export type SummarizeRequest = {
  goal: string;
  rows: Record<string, unknown>[];
};
export type SummarizeResponse = { summary: string };

// Hosted db.create — goal string in, typed `SchemaPlan` out
// (SK-HDC-002). The provider returns the parsed JSON object the LLM
// emitted, wrapped in `{plan: ...}` so the response shape is uniform
// across operations. Validation against the canonical Zod schema
// lives at the call site (`packages/db/src/types.ts`) — keeping
// `@nlqdb/llm` independent of the engine package avoids a cycle.
export type SchemaInferRequest = { goal: string };
export type SchemaInferResponse = { plan: Record<string, unknown> };

// Engine classification (SK-DB-010 / SK-MULTIENG-002). Cheap-tier op
// that maps a goal string to one of the engines in the engine-fit
// table (currently `postgres` / `clickhouse`). The classifier prompt
// embeds the SK-MULTIENG-002 table verbatim — adding a new engine
// means (a) widening the `Engine` literal in `@nlqdb/db`, (b)
// shipping an adapter, (c) editing the table in `prompts.ts` so the
// LLM knows about it. Caller enforces a confidence floor (default 0.6)
// and falls back to `postgres` below it; explicit `engine` override
// on `db.create` skips this op entirely.
//
// Engine literal lives in `@nlqdb/db` (the engine package) but
// duplicating the union here would create a cycle — keep it as
// `string` and let the route handler narrow against the canonical
// `Engine` type. The provider's `parseJsonResponse` returns whatever
// the LLM emits; the route handler validates the string against the
// allowed set before persisting.
export type EngineClassifyRequest = { goal: string };
export type EngineClassifyResponse = {
  engine: string;
  confidence: number;
};

// Merged `/v1/ask` router (SK-ASK-009). One cheap-tier call decides
// `kind ∈ {create, query, write}`, picks `targetDbId` (or null on
// create), and lists the tables the goal references — all from the
// same prompt that knows the principal's recent tables. Replaces the
// older `classify` + `disambiguate` pair. The route handler enforces
// a confidence floor (`ROUTE_CONFIDENCE_FLOOR = 0.7`) before auto-
// targeting; below the floor it returns `409 candidate_dbs`.
export type RouteDbCandidate = { id: string; slug: string };
export type RouteRecentTable = { dbId: string; table: string };
export type RouteRequest = {
  goal: string;
  dbs: RouteDbCandidate[];
  recentTables: RouteRecentTable[];
};
export type RouteKind = "create" | "query" | "write";
export type RouteResponse = {
  kind: RouteKind;
  // null when kind === "create" or the LLM can't pick.
  targetDbId: string | null;
  // empty when kind === "create".
  referencedTables: string[];
  confidence: number;
  reason: string;
};

// Minimal fetch shape — just the call signature, not the runtime-specific
// static methods (Bun's typeof globalThis.fetch demands a `preconnect`
// method). globalThis.fetch satisfies this; tests pass plain functions.
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type CallOpts = {
  // Test injection point — defaults to globalThis.fetch.
  fetch?: FetchLike;
  signal?: AbortSignal;
};

export type Provider = {
  name: ProviderName;
  // Resolved model string (e.g. "llama-3.1-8b-instant") used as the
  // `llm.model` span attribute. Operation-specific because providers
  // commonly use different models for different jobs.
  model(op: LLMOperation): string;
  route(req: RouteRequest, opts?: CallOpts): Promise<RouteResponse>;
  plan(req: PlanRequest, opts?: CallOpts): Promise<PlanResponse>;
  summarize(req: SummarizeRequest, opts?: CallOpts): Promise<SummarizeResponse>;
  schemaInfer(req: SchemaInferRequest, opts?: CallOpts): Promise<SchemaInferResponse>;
  engineClassify(req: EngineClassifyRequest, opts?: CallOpts): Promise<EngineClassifyResponse>;
};

// Thrown by providers when the upstream call fails. Carries a
// classified `reason` so the router can stamp `nlqdb.llm.failover.total`
// without re-classifying.
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly reason: FailoverReason,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
