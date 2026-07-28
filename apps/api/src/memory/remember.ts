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
// `set_config('app.tenant_id', …)` the read path uses plus the E-03 scope
// GUCs from `plan.scope`, so both the tenant policy and the restrictive
// `agent_isolation` / `end_user_isolation` / `thread_isolation` policies
// (SK-PIVOT-009) govern the row at write time too.
//
// Sibling: `docs/features/agent-memory-pivot/worksheets/engine/E-02-remember-tool.md`.

import type { RateLimiter } from "../ask/rate-limit.ts";
import { type AskError, DbConfigError, type DbRecord, type QueryResult } from "../ask/types.ts";
import {
  type AgentMemoryV1Table,
  isAgentMemoryV1Db,
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
  // E-03 / SK-PIVOT-009 scoping. All three are optional and
  // server-defaulted (`agentId` falls back to the tenant principal), so the
  // zero-config call still works; supplying them narrows the row's scope
  // AND the RLS GUCs the exec wrapper sets, so the write is checked against
  // the same gate a later read is filtered by. `entities` has no
  // end-user/thread columns, so those are ignored for `kind: "entity"`.
  agentId?: string;
  endUserId?: string;
  threadId?: string;
  // E-04 — TTL on a fact row; the sweep that consumes `expires_at` is
  // that worksheet. Only `facts` carries `expires_at`, so a `ttlSeconds`
  // on an episode/entity is rejected at validation (GLOBAL-012 fail-loud,
  // not a silent drop the caller can't detect).
  ttlSeconds?: number;
} & (
  | { kind: "fact"; payload: FactPayload }
  | { kind: "episode"; payload: EpisodePayload }
  | { kind: "entity"; payload: EntityPayload }
);

// E-03 / SK-PIVOT-009 — the row-level scope a statement executes under.
// `buildHostedExecSteps` turns it into `set_config('app.agent_id', …)` (+
// the opt-in `app.end_user_id` / `app.thread_id`) so the restrictive
// policies the provisioner emitted have something to match. `agentId` is
// always present: an unset GUC is NULL and matches no row (fail-closed), so
// every hosted exec carries at least the tenant-default agent scope.
export type MemoryScope = {
  agentId: string;
  endUserId?: string;
  threadId?: string;
};

export type MemoryInsertPlan = {
  table: AgentMemoryV1Table;
  text: string;
  params: unknown[];
  // The scope the INSERT runs under — the same values the row is tagged
  // with, so the restrictive policies' WITH CHECK (defaulted from `USING`)
  // passes by construction.
  scope: MemoryScope;
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
  // The resolved memory owner: the tenant principal by default, or the
  // caller's optional `args.agentId` sub-agent (E-03 / SK-PIVOT-009 —
  // the handler resolves it, never the caller alone). Narrowing only ever
  // *reduces* what the row is visible to, so no extra authorisation is
  // needed: the tenant literal baked into the policy keeps the account
  // principal sighted either way.
  agentId: string;
  rateLimitBucketKey?: string;
  // Injected so `expires_at` is deterministic in tests.
  nowMs?: number;
};

// Pure, deterministic INSERT builder. Identifiers come only from the
// fixed column allow-list; every caller value is a `$n` bound param.
export function buildRememberInsert(
  args: RememberArgs,
  ctx: { agentId: string; nowMs: number },
): MemoryInsertPlan {
  const scope: MemoryScope = {
    agentId: ctx.agentId,
    ...(args.endUserId !== undefined ? { endUserId: args.endUserId } : {}),
    ...(args.threadId !== undefined ? { threadId: args.threadId } : {}),
  };

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
      scope,
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
      scope,
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
    scope,
  };
}

// SK-PIVOT-010 — anon and `pk_live` have **no memory surface**, so E-03
// designs no anon-token scoping: the preset create is `requireSession` and
// this verb rejects both principal kinds outright. Pure so the mapping is
// pinned by a unit test for every principal kind rather than only by the
// handler it feeds (`index.ts POST /v1/memory/remember`).
//   pk_live → `forbidden` (read-only embed key, SK-APIKEYS-003)
//   anon    → `auth_required` (no account ⇒ no memory DB to write to)
export function memorySurfaceRejection(
  principalKind: "user" | "anon" | "pk_live" | "sk_live" | "sk_mcp",
): "forbidden" | "auth_required" | null {
  if (principalKind === "pk_live") return "forbidden";
  if (principalKind === "anon") return "auth_required";
  return null;
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

  const scope: {
    agentId?: string;
    endUserId?: string;
    threadId?: string;
    ttlSeconds?: number;
  } = {};
  const agentId = b["agentId"];
  const endUserId = b["endUserId"];
  const threadId = b["threadId"];
  const ttlSeconds = b["ttlSeconds"];
  if (agentId !== undefined) {
    if (typeof agentId !== "string" || agentId.length === 0) {
      return { ok: false, reason: "`agentId` must be a non-empty string." };
    }
    scope.agentId = agentId;
  }
  // Empty strings are rejected, not coerced: the RLS policies read an empty
  // scope GUC as "no narrowing" (a placeholder GUC resets to `''`, not NULL),
  // so an empty `endUserId` would silently write a row nothing can narrow to.
  if (endUserId !== undefined) {
    if (typeof endUserId !== "string" || endUserId.length === 0)
      return { ok: false, reason: "`endUserId` must be a non-empty string." };
    scope.endUserId = endUserId;
  }
  if (threadId !== undefined) {
    if (typeof threadId !== "string" || threadId.length === 0)
      return { ok: false, reason: "`threadId` must be a non-empty string." };
    scope.threadId = threadId;
  }
  if (ttlSeconds !== undefined) {
    if (kind !== "fact") {
      return {
        ok: false,
        reason:
          "`ttlSeconds` applies only to kind: fact — episodes and entities never expire; remove it or store the value as a fact.",
      };
    }
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
