// `nlqdb_remember` — the agent-facing memory **write** primitive
// (agent-memory pivot engine track, worksheet E-02). Additive verb
// alongside the stable `nlqdb_query` / `nlqdb_list_databases` /
// `nlqdb_describe` contract (SK-MCP-002 unchanged): an agent
// materialises a typed memory row directly into the `agent_memory_v1`
// schema (E-01) with **no LLM in the loop** — the payload is
// structured, so the compiler emits a deterministic parameterised
// `INSERT … RETURNING` itself. That preserves the typed-plan trust
// boundary: the LLM never composes this SQL.
//
// Why a dedicated endpoint and not `/v1/run`: a raw-SQL write would
// re-open string-built SQL over arbitrary agent-supplied content. Here
// every value is a bound parameter and every identifier (table +
// column list) is drawn from the fixed `AGENT_MEMORY_V1_COLUMNS`
// allow-list, so the only thing the caller controls is data.
//
// Tenant + preset guard: the write is rejected with `wrong_preset`
// unless the target DB was provisioned from the `agent_memory_v1`
// preset (E-01) — a non-memory DB has no `facts`/`episodes`/`entities`
// tables, so the deterministic INSERT would be meaningless. The exec
// adapter (`build-deps.ts buildMemoryExec`) batches the same
// `set_config('app.tenant_id', …)` the read path uses, so RLS
// (`SK-HDC` provisioner policy) governs the row at write time too.
//
// Sibling: `docs/features/agent-memory-pivot/worksheets/engine/E-02-remember-tool.md`.

import type { RateLimiter } from "../ask/rate-limit.ts";
import { type AskError, DbConfigError, type DbRecord, type QueryResult } from "../ask/types.ts";
import {
  AGENT_MEMORY_V1_VERSION,
  type AgentMemoryV1Table,
} from "../db-create/presets/agent-memory-v1.ts";

export type RememberKind = "fact" | "episode" | "entity";

// `kind` defaults to the literal "fact" so the simplest call —
// `{ content: "user prefers dark mode" }` — works; override it to
// categorise (e.g. "preference", "skill").
export type FactPayload = {
  content: string;
  kind?: string;
  tags?: string[];
  source?: Record<string, unknown>;
};

export type EpisodePayload = {
  role: string;
  content: string;
  tool_calls?: Record<string, unknown>;
  tokens?: number;
};

// `kind` here is the entity *type* (the `entities.kind` column —
// "person" / "project" / …), distinct from the outer table selector.
export type EntityPayload = {
  kind: string;
  canonical_name: string;
  properties?: Record<string, unknown>;
};

export type RememberArgs = {
  db: string;
  // Optional scoping (E-03 will derive `agent_id` from the principal and
  // enforce read isolation; these stay caller-supplied free-form columns
  // until then). `entities` has no end-user/thread columns, so they are
  // ignored for `kind: "entity"`.
  endUserId?: string;
  threadId?: string;
  // E-04 — TTL on a fact row; the sweep that consumes `expires_at` is
  // that worksheet. Ignored for episodes/entities (no `expires_at`).
  ttlSeconds?: number;
} & (
  | { kind: "fact"; payload: FactPayload }
  | { kind: "episode"; payload: EpisodePayload }
  | { kind: "entity"; payload: EntityPayload }
);

export type MemoryInsertPlan = {
  table: AgentMemoryV1Table;
  text: string;
  params: unknown[];
};

export type RememberResult = {
  id: string | number;
  kind: RememberKind;
  materialised_at: string;
  expires_at?: string;
};

export type RememberError = AskError | { status: "wrong_preset" };

export type RememberOutcome =
  | { ok: true; result: RememberResult }
  | { ok: false; error: RememberError };

export type RememberDeps = {
  resolveDb: (id: string, tenantId: string) => Promise<DbRecord | null>;
  execMemory: (db: DbRecord, plan: MemoryInsertPlan, signal?: AbortSignal) => Promise<QueryResult>;
  rateLimiter: RateLimiter;
};

export type RememberRequest = {
  args: RememberArgs;
  // Tenant id (`Principal.id`) — drives `resolveDb` scope.
  userId: string;
  // Server-injected memory owner. Until E-03 ships per-agent identities
  // this is the tenant id; E-03 narrows it without changing this contract.
  agentId: string;
  rateLimitBucketKey?: string;
  // Injected so `expires_at` is deterministic in tests.
  nowMs?: number;
};

// A memory-preset DB carries the version-keyed id prefix the create
// path mints (`db_${slug_hint}_<6hex>`, SK-HDC-020). Checking the prefix
// avoids a second round-trip to recompute the schema hash.
export function isAgentMemoryV1Db(dbId: string): boolean {
  return dbId.startsWith(`db_${AGENT_MEMORY_V1_VERSION}_`);
}

// Pure, deterministic INSERT builder. Identifiers come only from the
// fixed column allow-list; every caller value is a `$n` bound param.
export function buildRememberInsert(
  args: RememberArgs,
  ctx: { agentId: string; nowMs: number },
): MemoryInsertPlan {
  if (args.kind === "fact") {
    const expiresAt =
      args.ttlSeconds !== undefined
        ? new Date(ctx.nowMs + args.ttlSeconds * 1000).toISOString()
        : null;
    return {
      table: "facts",
      text:
        "INSERT INTO facts (agent_id, end_user_id, thread_id, kind, content, tags, source, expires_at) " +
        "VALUES ($1, $2, $3, $4, $5, $6::text[], $7::jsonb, $8) " +
        "RETURNING id, created_at AS materialised_at, expires_at",
      params: [
        ctx.agentId,
        args.endUserId ?? null,
        args.threadId ?? null,
        args.payload.kind ?? "fact",
        args.payload.content,
        args.payload.tags ?? [],
        args.payload.source !== undefined ? JSON.stringify(args.payload.source) : null,
        expiresAt,
      ],
    };
  }

  if (args.kind === "episode") {
    return {
      table: "episodes",
      text:
        "INSERT INTO episodes (agent_id, end_user_id, thread_id, role, content, tool_calls, tokens) " +
        "VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) " +
        "RETURNING id, occurred_at AS materialised_at",
      params: [
        ctx.agentId,
        args.endUserId ?? null,
        args.threadId ?? null,
        args.payload.role,
        args.payload.content,
        args.payload.tool_calls !== undefined ? JSON.stringify(args.payload.tool_calls) : null,
        args.payload.tokens ?? null,
      ],
    };
  }

  // entity — upsert on the (agent_id, kind, canonical_name) UNIQUE so
  // re-remembering a known entity refreshes `last_seen_at` instead of
  // throwing a duplicate-key error.
  return {
    table: "entities",
    text:
      "INSERT INTO entities (agent_id, kind, canonical_name, properties, first_seen_at, last_seen_at) " +
      "VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW()) " +
      "ON CONFLICT (agent_id, kind, canonical_name) " +
      "DO UPDATE SET last_seen_at = NOW(), properties = COALESCE(EXCLUDED.properties, entities.properties) " +
      "RETURNING id, first_seen_at AS materialised_at",
    params: [
      ctx.agentId,
      args.payload.kind,
      args.payload.canonical_name,
      args.payload.properties !== undefined ? JSON.stringify(args.payload.properties) : null,
    ],
  };
}

// Request-body validation. Kept pure (no Hono) so the same checks cover
// the HTTP handler and the unit tests. Returns a one-sentence reason on
// failure (GLOBAL-012).
export type ValidateResult = { ok: true; value: RememberArgs } | { ok: false; reason: string };

export function validateRememberInput(body: unknown): ValidateResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, reason: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const db = b["db"];
  const kind = b["kind"];
  const rawPayload = b["payload"];
  if (typeof db !== "string" || db.length === 0) {
    return { ok: false, reason: "`db` (the agent_memory_v1 database id) is required." };
  }
  if (kind !== "fact" && kind !== "episode" && kind !== "entity") {
    return { ok: false, reason: "`kind` must be one of: fact, episode, entity." };
  }
  if (typeof rawPayload !== "object" || rawPayload === null) {
    return { ok: false, reason: "`payload` must be an object." };
  }
  const p = rawPayload as Record<string, unknown>;

  const scope: { endUserId?: string; threadId?: string; ttlSeconds?: number } = {};
  const endUserId = b["endUserId"];
  const threadId = b["threadId"];
  const ttlSeconds = b["ttlSeconds"];
  if (endUserId !== undefined) {
    if (typeof endUserId !== "string")
      return { ok: false, reason: "`endUserId` must be a string." };
    scope.endUserId = endUserId;
  }
  if (threadId !== undefined) {
    if (typeof threadId !== "string") return { ok: false, reason: "`threadId` must be a string." };
    scope.threadId = threadId;
  }
  if (ttlSeconds !== undefined) {
    if (typeof ttlSeconds !== "number" || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      return { ok: false, reason: "`ttlSeconds` must be a positive number." };
    }
    scope.ttlSeconds = ttlSeconds;
  }

  if (kind === "fact") {
    const content = p["content"];
    const factKind = p["kind"];
    const tags = p["tags"];
    const source = p["source"];
    if (typeof content !== "string" || content.length === 0) {
      return { ok: false, reason: "fact `payload.content` is required." };
    }
    if (factKind !== undefined && typeof factKind !== "string") {
      return { ok: false, reason: "fact `payload.kind` must be a string." };
    }
    if (tags !== undefined && !(Array.isArray(tags) && tags.every((t) => typeof t === "string"))) {
      return { ok: false, reason: "fact `payload.tags` must be an array of strings." };
    }
    const payload: FactPayload = { content };
    if (typeof factKind === "string") payload.kind = factKind;
    if (Array.isArray(tags)) payload.tags = tags as string[];
    if (typeof source === "object" && source !== null) {
      payload.source = source as Record<string, unknown>;
    }
    return { ok: true, value: { db, kind: "fact", payload, ...scope } };
  }

  if (kind === "episode") {
    const role = p["role"];
    const content = p["content"];
    const toolCalls = p["tool_calls"];
    const tokens = p["tokens"];
    if (typeof role !== "string" || role.length === 0) {
      return { ok: false, reason: "episode `payload.role` is required." };
    }
    if (typeof content !== "string" || content.length === 0) {
      return { ok: false, reason: "episode `payload.content` is required." };
    }
    if (tokens !== undefined && typeof tokens !== "number") {
      return { ok: false, reason: "episode `payload.tokens` must be a number." };
    }
    const payload: EpisodePayload = { role, content };
    if (typeof toolCalls === "object" && toolCalls !== null) {
      payload.tool_calls = toolCalls as Record<string, unknown>;
    }
    if (typeof tokens === "number") payload.tokens = tokens;
    return { ok: true, value: { db, kind: "episode", payload, ...scope } };
  }

  // entity
  const entityKind = p["kind"];
  const canonicalName = p["canonical_name"];
  const properties = p["properties"];
  if (typeof entityKind !== "string" || entityKind.length === 0) {
    return { ok: false, reason: "entity `payload.kind` (the entity type) is required." };
  }
  if (typeof canonicalName !== "string" || canonicalName.length === 0) {
    return { ok: false, reason: "entity `payload.canonical_name` is required." };
  }
  const payload: EntityPayload = { kind: entityKind, canonical_name: canonicalName };
  if (typeof properties === "object" && properties !== null) {
    payload.properties = properties as Record<string, unknown>;
  }
  return { ok: true, value: { db, kind: "entity", payload, ...scope } };
}

export async function orchestrateRemember(
  deps: RememberDeps,
  req: RememberRequest,
): Promise<RememberOutcome> {
  const decision = await deps.rateLimiter.check(req.rateLimitBucketKey ?? req.userId);
  if (!decision.allowed) {
    return {
      ok: false,
      error: {
        status: "rate_limited",
        limit: decision.limit,
        count: decision.count,
        resetAt: decision.resetAt,
      },
    };
  }

  const db = await deps.resolveDb(req.args.db, req.userId);
  if (!db) return { ok: false, error: { status: "db_not_found" } };
  if (!isAgentMemoryV1Db(db.id)) return { ok: false, error: { status: "wrong_preset" } };

  const plan = buildRememberInsert(req.args, {
    agentId: req.agentId,
    nowMs: req.nowMs ?? Date.now(),
  });

  let result: QueryResult;
  try {
    result = await deps.execMemory(db, plan);
  } catch (err) {
    if (err instanceof DbConfigError) return { ok: false, error: { status: "db_misconfigured" } };
    return { ok: false, error: { status: "db_unreachable" } };
  }

  const row = (result.rows[0] ?? {}) as Record<string, unknown>;
  const expiresAt = row["expires_at"];
  const out: RememberResult = {
    id: (row["id"] as string | number) ?? "",
    kind: req.args.kind,
    materialised_at: String(row["materialised_at"] ?? ""),
  };
  if (expiresAt !== undefined && expiresAt !== null) {
    out.expires_at = String(expiresAt);
  }
  return { ok: true, result: out };
}
