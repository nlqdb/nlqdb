/**
 * @module @nlqdb/sdk
 *
 * Typed HTTP client for the nlqdb /v1 API.
 *
 * Two auth modes (mutually exclusive):
 *   - `apiKey: 'sk_…'`         server-to-server (Node, Bun, Workers)
 *   - `withCredentials: true`  browser, riding the session cookie
 *
 * Runtime-agnostic: only depends on global fetch.
 *
 * Error contract: every method throws `NlqdbApiError` on failure —
 * non-2xx, network failure, abort, and non-JSON proxy response. The
 * error carries a discriminant `code` (mirrors the API's
 * `error.status`, plus SDK-only sentinels `unknown_error`,
 * `non_json_response`, `network_error`, `aborted`) and the HTTP
 * status (0 for transport-level failures). Consumers `try/catch` and
 * discriminate on `err.code`.
 */

// Request body for `client.ask()` / `askStream()` — the plain-English goal plus optional routing hints.
export type AskRequest = {
  goal: string;
  // SK-ASK-009 / SK-HDC-011: `dbId` is optional. When omitted the API
  // resolves it deterministically (0 dbs → CREATE, 1 → auto-target)
  // or via a cheap-tier LLM disambiguator on 2+ DBs (≥ 0.7 confidence
  // → auto-target with `selected_db` echo on the response; below →
  // 409 ambiguous_db with `candidate_dbs` for the surface to render).
  dbId?: string;
  // SK-DB-010: when the request routes the create branch (no dbId,
  // 0 DBs, or kind=create), `engine` overrides the classifier's
  // pick. Ignored on the query / write branches. Power-user escape
  // hatch per `GLOBAL-015`; absent path is the goal-first default
  // per `GLOBAL-020`.
  engine?: Engine;
  // SK-ONBOARD-004: when the API returned `requires_confirm: true`
  // for a destructive plan, the surface re-sends the same request
  // with `confirm: true`. The orchestrator skips its confidence
  // gate on the second hop and runs the SQL.
  confirm?: boolean;
};

// SK-ASK-009: response echo when the API auto-targeted a DB on the
// caller's behalf (single-DB auto-target OR LLM disambiguator pick
// ≥ 0.7 confidence). Surfaces render attribution + a one-click switch.
export type SelectedDbEcho = {
  id: string;
  slug: string;
  confidence: number;
  reason: string;
};

// SK-TRUST-002 — every successful `/v1/ask` response carries this
// block. The compiled SQL + cache state live here, not at the top
// level. Surfaces render it as an always-present (collapsed by
// default) trace pane.
export type Trace = {
  sql: string;
  plan_id: string;
  confidence: number;
  model: string;
  cache_hit: boolean;
};

// Success envelope from `/v1/ask` — the query/write branch of `AskResponse`, carrying rows + `trace`.
export type AskOk = {
  status: "ok";
  rows: Record<string, unknown>[];
  rowCount: number;
  summary?: string;
  // SK-ONBOARD-004: present on destructive-plan replies that
  // haven't been approved yet. The diff fields drive the diff-chip
  // preview the surface renders before second-Enter / Approve.
  requires_confirm?: boolean;
  diff?: AskDiff;
  // SK-ASK-009: present when the API auto-targeted a DB. Absent on
  // requests that pinned `dbId` directly.
  selected_db?: SelectedDbEcho;
  // SK-TRUST-002 — always present.
  trace: Trace;
};

// SK-HDC-001 / SK-ASK-009: when `kind=create` (or 0 DBs with kind=
// query|write), the API returns this envelope instead of `AskOk`.
// The chat surface narrows on `kind` to switch into "DB created"
// mode, append the new DB to the rail, and re-pin `dbId` for the
// next send.
export type AskCreateResult = {
  kind: "create";
  db: string;
  // Human-readable name for the freshly-minted DB. Surfaces render
  // this; `db` (the wire id) and `schemaName` stay for technical /
  // URL contexts. Derived server-side from `db` via `displayName()`.
  displayName: string;
  schemaName: string;
  // SK-DB-010 — engine the orchestrator resolved. Always present.
  engine: Engine;
  pkLive: string | null;
  // SchemaPlan from the typed-plan compiler (`SK-HDC-002`). Surfaces
  // that don't render the plan (current chat) ignore it; CreateForm
  // narrows it via its own `CreateResult` type.
  plan: unknown;
  // One entry per sample row — mirrors the API's `SampleRow` shape
  // (`packages/db/src/types.ts`). Surfaces that want a per-table
  // view group on `table` themselves.
  sampleRows: { table: string; values: Record<string, unknown> }[];
};

// Discriminator: `AskOk` carries `status: "ok"`, `AskCreateResult`
// carries `kind: "create"`. Callers narrow on whichever fits.
export type AskResponse = AskOk | AskCreateResult;

// Plain-English preview of a destructive plan. Values are derived
// server-side (validator + EXPLAIN) — surfaces never compute a
// "this will affect N rows" themselves; that would be a
// silent-lie risk under GLOBAL-011.
export type AskDiff = {
  verb: "UPDATE" | "DELETE" | "INSERT" | "DDL";
  table: string;
  affectedRows: number;
  summary: string;
};

// Per-step trace event, mirrors the API's OrchestrateEvent set
// extended with a `confirm_required` step for the destructive
// gate. Surfaces wire `onTrace` into the live trace UI; SK-SDK-007
// is the canonical contract for this shape.
export type TraceStep =
  | "cache_lookup"
  | "plan"
  | "validate"
  | "exec"
  | "summarize"
  | "confirm_required"
  | "selected_db";

// One event from the `askStream()` trace channel; surfaces narrow on `type` to drive the live trace pane.
export type TraceEvent =
  | { type: "plan_pending" }
  // SK-TRUST-002 — the `plan` event carries the full trace block so
  // SSE consumers accumulate one record instead of stitching it.
  | { type: "plan"; trace: Trace }
  | { type: "rows"; rows: Record<string, unknown>[]; rowCount: number }
  | { type: "summary"; summary: string }
  | { type: "confirm_required"; diff: AskDiff }
  | { type: "selected_db"; db: SelectedDbEcho }
  | { type: "error"; error: ApiErrorBody }
  | { type: "done"; status: "ok" };

// SK-DB-010 — engine the create path resolved (classifier-default or
// explicit override). Surfaces echo it back to the caller; the CLI
// renders it after `nlq new`, the chat surface stores it on the rail
// row, the MCP tool returns it per row from `nlqdb_list_databases`.
export type Engine = "postgres" | "clickhouse";

// One DB row in a `listDatabases` response. `pkLive` is the
// publishable per-DB key used to inline into `<nlq-data>` snippets
// (SK-WEB-007); when null the surface falls back to the anonymous
// device's pk_live (SK-ANON-006).
export type DatabaseSummary = {
  id: string;
  slug: string;
  // Human-readable rendering of the dbId (e.g. `orders tracker`). The
  // `slug` field stays for URL / technical contexts; `displayName` is
  // what surfaces show in headers, the rail, and the create reply.
  displayName: string;
  name?: string;
  schemaName?: string;
  // SK-DB-010 — the engine column on the row. Surfaces narrow on
  // this when rendering badges or routing power-user `run` calls.
  engine: Engine;
  pkLive: string | null;
  lastQueriedAt: number | null;
  createdAt: number;
};

// Body for `client.createDatabase()` — goal-first (`goal` drives the engine classifier) with an optional explicit `engine` override.
export type CreateDatabaseRequest = {
  name?: string;
  goal?: string;
  // SK-DB-010 — explicit engine override. When omitted the API runs
  // the SK-MULTIENG-002 classifier on `goal` text. Power-user escape
  // hatch per `GLOBAL-015`; absent path is the goal-first default
  // per `GLOBAL-020`. The API rejects unknown engines with
  // `invalid_engine` (400).
  engine?: Engine;
};

// Response from `client.createDatabase()` — surfaces the new dbId, the resolved engine, and the publishable per-DB key.
export type CreateDatabaseResult = {
  dbId: string;
  slug: string;
  // SK-DB-010 — the engine the API actually provisioned. Always
  // present so callers don't have to re-resolve from the slug.
  engine: Engine;
  pkLive: string;
  connectionString?: string;
};

// SK-DBCONN-001 — body for `client.databases.connect()`. Connect a
// bring-your-own Postgres / ClickHouse: the server seals the
// `connection_url` (`GLOBAL-031`), introspects the schema, and returns a
// live, queryable DB. `connectionUrl` is the same trust class as a
// BYOLLM key — HTTPS-only, sent ONLY in the request body, never logged.
export type ConnectDatabaseRequest = {
  engine: Engine;
  // The full DSN to the user's own database. Sealed at rest server-side
  // (`GLOBAL-031`); the SDK transmits it once, in the JSON body, and
  // never embeds it in a URL / log / telemetry value.
  connectionUrl: string;
  name?: string;
};

// SK-DBCONN-001 — response from `client.databases.connect()`. `pkLive`
// is the freshly-minted publishable per-DB key; `schemaPreview` is the
// rendered schema text the surface shows as the connect confirmation.
export type ConnectDatabaseResult = {
  dbId: string;
  name: string;
  engine: string;
  schemaPreview: string;
  pkLive: string | null;
};

// `SK-SDK-009` — raw-SQL escape hatch (`GLOBAL-015`); same allow-list as `ask()`, DDL still rejected.
export type RunSqlRequest = {
  db: string;
  sql: string;
};

// Response from `client.runSql()` — same row/`trace` shape as `AskOk` minus the NL summary.
export type RunSqlResult = {
  status: "ok";
  rows: Record<string, unknown>[];
  rowCount: number;
  trace: Trace;
};

// E-02 — the agent-memory write verb. `client.remember()` materialises a
// typed row into an `agent_memory_v1` preset DB (no LLM in the loop). The
// MCP `nlqdb_remember` tool and `nlq remember` (fast-follow) wrap this.
export type RememberFactPayload = {
  content: string;
  kind?: string;
  tags?: string[];
  source?: Record<string, unknown>;
};
export type RememberEpisodePayload = {
  role: string;
  content: string;
  tool_calls?: Record<string, unknown>;
  tokens?: number;
};
export type RememberEntityPayload = {
  kind: string;
  canonical_name: string;
  properties?: Record<string, unknown>;
};

export type RememberRequest = {
  db: string;
  endUserId?: string;
  threadId?: string;
  ttlSeconds?: number;
} & (
  | { kind: "fact"; payload: RememberFactPayload }
  | { kind: "episode"; payload: RememberEpisodePayload }
  | { kind: "entity"; payload: RememberEntityPayload }
);

// Response from `client.remember()` — the materialised row's identity.
export type RememberResult = {
  status: "ok";
  id: string | number;
  kind: "fact" | "episode" | "entity";
  materialised_at: string;
  expires_at?: string;
};

// Mirror of the API's `AskError` discriminant (apps/api/src/ask/types.ts)
// plus SDK-only sentinels. Open-ended via `(string & {})` so a new API
// status doesn't force an SDK bump to compile — consumers still get
// autocomplete on the known values.
export type ApiErrorCode =
  | "db_not_found"
  | "schema_unavailable"
  | "db_misconfigured"
  | "db_unreachable"
  | "sql_rejected"
  | "llm_failed"
  | "rate_limited"
  | "unauthorized"
  | "invalid_json"
  | "goal_required"
  | "dbId_required"
  | "invalid_body"
  | "invalid_email"
  | "secret_unconfigured"
  // SK-ASK-009: 409 returned when the LLM disambiguator's confidence
  // is below the floor on a 2+ DB tenant. Body carries `candidate_dbs`.
  | "ambiguous_db"
  // SK-ASK-014: 409 returned when the caller pinned `dbId` but the
  // classifier returned `kind=create` (the goal looks like a creation
  // request, e.g. "new table"). Body carries `pinned_db: {id, slug}` —
  // surfaces render a chip with two actions: "Create new database"
  // (re-send without `dbId`) and "Cancel".
  | "clarify_required"
  // SK-SDK-009 / SK-APIKEYS-003 — `/v1/run` rejected the call because
  // the principal is read-only (pk_live tried to write).
  | "forbidden"
  // `SK-SDK-009` — `/v1/run` parse errors distinct from the generic `invalid_json` / `invalid_body`.
  | "sql_required"
  | "sql_too_long"
  | "db_required"
  // SK-DB-010: 400 returned when `engine` is set to a string that's
  // not in the allowed engine set on `/v1/ask` or `/v1/databases`.
  | "invalid_engine"
  // SK-SDK-011: the account-stored BYOLLM verbs — 400 on a mis-shaped
  // credential, 503 when the deployment can't seal keys (KEK unset).
  | "invalid_byollm_key"
  | "byollm_unavailable"
  // E-02: `client.remember()` rejected because the target DB isn't an
  // `agent_memory_v1` preset (409).
  | "wrong_preset"
  // SK-DBCONN-001 — `POST /v1/db/connect` rejections. `connect_requires_account`
  // (403) when the caller isn't signed in (connect is account-only).
  // `invalid_request` (400) covers a mis-shaped body, a bad / non-HTTPS
  // connection URL, or an egress-blocked host (`GLOBAL-035`).
  // `introspection_failed` (502) when the BYO DB couldn't be reached /
  // read; `sealing_unconfigured` (503) when the deployment can't seal
  // secrets (`GLOBAL-031` KEK unset).
  | "connect_requires_account"
  | "invalid_request"
  | "introspection_failed"
  | "sealing_unconfigured"
  // SDK-only sentinels — never sent by the API.
  | "unknown_error"
  | "non_json_response"
  | "network_error"
  | "aborted"
  | (string & {});

// SK-ASK-009: candidate-DB ranking carried on `ambiguous_db` 409
// envelopes. Surface uses these to render an explicit picker.
export type CandidateDb = { id: string; slug: string };

// SK-ASK-014: surfaced on `clarify_required` 409 envelopes — the DB
// the caller had pinned when the classifier decided `kind=create`.
// Null when the pinned id couldn't be resolved (stale URL param).
export type PinnedDb = { id: string; slug: string };

// JSON body the API returns on every non-2xx response; surfaced as `NlqdbApiError.body`.
export type ApiErrorBody = {
  status: ApiErrorCode;
  message?: string;
  reason?: string;
  limit?: number;
  count?: number;
  candidate_dbs?: CandidateDb[];
  // SK-ASK-014 — only present on `clarify_required` envelopes.
  clarification?: "create_or_query_pinned";
  pinned_db?: PinnedDb | null;
};

// Mirrors apps/api/src/chat/types.ts. Keep these definitions in sync
// when the API's wire shape changes — `truncated` and `kind` are not
// optional, callers narrow off `result.kind`.
export type ChatAssistantSuccess = {
  kind: "ok";
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  cached: boolean;
  summary?: string;
};

// Error branch of `ChatAssistantResult` — a persisted assistant turn whose API call failed.
export type ChatAssistantError = {
  kind: "error";
  status: ApiErrorCode;
  message?: string;
};

// Persisted outcome of one chat turn; surfaces narrow on `kind` to render success rows vs an error chip.
export type ChatAssistantResult = ChatAssistantSuccess | ChatAssistantError;

// One persisted chat turn; the `role` discriminant narrows to a user prompt vs an assistant result.
export type ChatMessage =
  | { id: string; role: "user"; userId: string; dbId: string; goal: string; createdAt: number }
  | {
      id: string;
      role: "assistant";
      userId: string;
      dbId: string;
      createdAt: number;
      result: ChatAssistantResult;
    };

// Minimal fetch shape — just the call signature, not the runtime-
// specific static methods (Bun's `typeof globalThis.fetch` requires a
// `preconnect` method that test stubs shouldn't have to provide).
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

// BYOLLM (`SK-PREMIUM-008`) provider slugs the API accepts on the
// `x-nlq-byollm-key` lane — the AI Gateway compat-endpoint providers
// (`SK-LLM-021`, verified 2026-05). OpenRouter is listed in
// `SK-PREMIUM-008` but not yet on the compat endpoint, so it is not
// here. Open-ended so a new slug doesn't force an SDK bump to compile;
// the trade-off is that an unrecognised slug surfaces as the server's
// one-sentence 400, not at construction — the SDK validates shape, not
// the evolving provider allowlist it would otherwise have to track.
export type ByollmProvider = "openai" | "anthropic" | "google-ai-studio" | (string & {});

// SK-SDK-010 — the caller's own provider key, dispatched at 0% markup
// per `GLOBAL-026`. Server-side this is the `<provider>:<model>:<key>`
// header (`SK-LLM-021`); the SDK takes the parts separately so the
// colon-joining (and its escaping hazards) live in one tested place.
// The key never leaves the caller's process except in the request to
// `/v1/ask`, and only when this is set.
export type ByollmCredential = {
  provider: ByollmProvider;
  // Raw upstream model id (e.g. `gpt-5.2`, `claude-sonnet-4-6`). BYOLLM
  // is the escape hatch where the user owns the model choice, so unlike
  // the hosted `model` preset (`SK-PREMIUM-003`) this is the literal id.
  model: string;
  key: string;
};

// Discriminated so the type system rejects callers that pass both
// auth modes — sending a server-side bearer over a browser cookie is
// a leak waiting to happen. Both-omitted is allowed (anonymous calls
// will 401 at the API).
type ClientOptionsBase = {
  baseUrl?: string;
  fetch?: FetchLike;
  /**
   * `SK-PREMIUM-008` / `SK-LLM-021` — route `ask()` / `askStream()`
   * through your own provider key at 0% markup. Signed-in only: the API
   * rejects this lane on bearer (`apiKey`) and anonymous calls, so it
   * requires `withCredentials: true` — `createClient` throws otherwise.
   */
  byollm?: ByollmCredential;
};

// Argument to `createClient()`; the union picks one auth mode at compile time so a server bearer cannot ride a browser cookie.
export type ClientOptions =
  | (ClientOptionsBase & { apiKey: string; withCredentials?: never })
  | (ClientOptionsBase & { withCredentials: true; apiKey?: never })
  | (ClientOptionsBase & { apiKey?: never; withCredentials?: never });

// Second arg to `askStream()` — abort signal plus the per-step trace listener that feeds live UIs.
export type AskStreamOptions = {
  signal?: AbortSignal;
  // SK-SDK-007: every ask-pipeline step fires once when known.
  // Surfaces wire this into their live trace UI (SK-WEB-005,
  // GLOBAL-011). Returning a value is ignored; throwing is caught
  // so a buggy hook can't take the ask call down with it.
  onTrace?: (event: TraceEvent) => void;
};

// SK-MCP-014 — DO revalidation probe. `apps/mcp/`'s `McpAgent` caches
// the resolved `sk_mcp_*` key for 1 s and refreshes via this method.
// Server-side endpoint is `GET /v1/keys/:hash/status` — session-only,
// scoped to the key owner's tenant.
export type KeyStatus = {
  revoked: boolean;
  revoked_at?: number;
};

// SK-APIKEYS-001 — three key types. The wire-level discriminant on
// `KeyRecord`. Open-ended so a new type added server-side doesn't
// force an SDK bump to compile.
export type KeyType = "pk_live" | "sk_live" | "sk_mcp" | (string & {});

// SK-APIKEYS-010 — one row in `listKeys()`. Plaintext is never present
// (SK-APIKEYS-002); `last4` is the only display affordance. Per-type
// claim fields are nullable: `dbId` is populated for `pk_live`,
// `(mcpHost, deviceId)` for `sk_mcp`, `name` is the optional human
// label for `sk_live`. `revokedAt` is non-null on revoked rows —
// surfaces group active + revoked from the same slice.
export type KeyRecord = {
  id: string;
  keyType: KeyType;
  last4: string;
  name: string | null;
  dbId: string | null;
  mcpHost: string | null;
  deviceId: string | null;
  lastUsedAt: number | null;
  createdAt: number;
  revokedAt: number | null;
};

// SK-APIKEYS-011 — DELETE response. Idempotent: a re-DELETE on an
// already-revoked key returns `alreadyRevoked: true` rather than 404,
// so caller scripts that retry don't have to special-case "is the
// 404 because someone else got there first?". 404 only fires on
// "key id is unknown / not yours" (`key_not_found`).
export type RevokeKeyResult = {
  ok: true;
  alreadyRevoked: boolean;
};

// SK-APIKEYS-007 — `POST /v1/keys` mint. `sk_live` carries an optional
// human `name`; `sk_mcp` carries `(host, device)` claims per
// `SK-APIKEYS-004`. The plaintext lands here exactly once
// (`SK-APIKEYS-002`) — surfaces must copy on the same render or it is
// gone for good.
export type MintKeyRequest =
  | { type: "sk_live"; name?: string }
  | { type: "sk_mcp"; host: string; device: string };

// Response from `client.mintKey()` — the plaintext `key` is present here exactly once (`SK-APIKEYS-002`).
export type MintKeyResult = {
  id: string;
  type: "sk_live" | "sk_mcp";
  // Full plaintext — present exactly once on the mint response, never
  // again. Surfaces render it inside a copy-once affordance and drop
  // the value from memory once dismissed.
  key: string;
  last4: string;
  // Echoes the request claims so a wrapping UI can render the row
  // without a follow-up `listKeys()` round-trip.
  name?: string;
  host?: string;
  device?: string;
};

// SK-MCP-013 — cross-Worker bridge. `apps/mcp/`'s `bridgeHandler`
// redeems the one-shot code minted by `apps/api/`'s
// `POST /v1/oauth/mcp-callback`. The code itself is the auth proof
// (128-bit random, 60 s TTL, delete-on-read).
export type OAuthBridgeRedemption = {
  user_id: string;
  mcp_host: string;
  device_id: string;
  bearer: string;
  bearer_hash: string;
};

// SK-SDK-011 — account-stored BYOLLM credential, the persistent
// counterpart to the per-request `byollm` *option* (`SK-SDK-010`). The
// option attaches a key to each `ask()` over `x-nlq-byollm-key`; these
// verbs persist one credential server-side (sealed at rest per
// `GLOBAL-031`) so every later session dispatches through it without
// re-sending the key. One credential per account; `setByollm` upserts.
// The key is write-only — it is never returned by any verb (`last4` is
// the sole display affordance, `SK-APIKEYS-002`).
export type ByollmStoredCredential = {
  provider: string;
  model: string;
  last4: string;
  updatedAt: number;
};

// `getByollmStatus()` result. `{ configured: false }` is the empty
// "add your key" state — distinct from a thrown error (a `503`
// `byollm_unavailable` means the deployment can't store keys at all).
export type ByollmStatusResponse =
  | { configured: false }
  | { configured: true; credential: ByollmStoredCredential };

// `setByollm()` echo — provider/model/last4 only; never the key.
export type ByollmSetResult = {
  configured: true;
  provider: string;
  model: string;
  last4: string;
};

// `clearByollm()` result. Idempotent: `cleared: false` when there was
// nothing stored, so retrying scripts don't have to special-case it.
export type ClearByollmResult = { ok: true; cleared: boolean };

/**
 * The typed client returned by {@link createClient} — the only HTTP
 * surface per `GLOBAL-001`. Every method throws {@link NlqdbApiError} on
 * every failure path; discriminate on `err.code` (`SK-SDK-002`). Recoverable
 * failures (transport, transient 5xx) retry up to 3× automatically
 * (`SK-SDK-008`); a 401 on a `withCredentials` client refreshes and retries
 * silently (`SK-SDK-005`), so surfaces never see one. Mutations
 * auto-generate and reuse an `Idempotency-Key` across retries (`SK-SDK-006`).
 */
export type NlqClient = {
  /**
   * `POST /v1/ask` — answer a plain-English goal. Returns the union
   * `AskOk | AskCreateResult`: narrow on `status === "ok"` (rows + `trace`)
   * vs `kind === "create"` (the goal routed to DB creation). When `req.dbId`
   * is present the API always returns `AskOk`; when omitted it may auto-target
   * or route to create (`SK-ASK-009` / `SK-HDC-011`). Errors worth a branch:
   * `ambiguous_db` (409, `body.candidate_dbs`), `clarify_required` (409),
   * `rate_limited` (429), `db_not_found`, `sql_rejected`. Retries transient
   * failures and auto-keys the POST (`SK-SDK-008`).
   */
  ask(req: AskRequest, opts?: { signal?: AbortSignal }): Promise<AskResponse>;
  /**
   * `POST /v1/ask` (SSE) — streaming variant of {@link ask}. Resolves once the
   * `done` event arrives with the assembled `AskOk`; per-step timings surface
   * via `opts.onTrace` (`SK-SDK-007`). Use this — not {@link ask} — for chat
   * surfaces that want incremental rendering (`GLOBAL-011`). Not retried: a
   * mid-stream retry would re-fire side-effects (`SK-SDK-008`). Does **not**
   * cover the create branch — call {@link ask} when you need `AskCreateResult`.
   */
  askStream(req: AskRequest, opts: AskStreamOptions): Promise<AskOk>;
  /**
   * `GET /v1/chat/messages` — the caller's persisted chat turns, oldest first.
   * Each row's `role` discriminates user prompt vs assistant result. Read-only;
   * not idempotency-keyed.
   */
  listChat(opts?: { signal?: AbortSignal }): Promise<{ messages: ChatMessage[] }>;
  /**
   * `POST /v1/chat/messages` — run a goal and persist both the user prompt and
   * the assistant result as a chat turn. Mutating: auto-keyed on the POST
   * (`SK-SDK-006`). The returned `assistant.result` narrows on `kind`
   * (`"ok"` vs `"error"`).
   */
  postChat(
    req: AskRequest,
    opts?: { signal?: AbortSignal },
  ): Promise<{ user: ChatMessage; assistant: ChatMessage }>;
  /**
   * `GET /v1/databases` — the caller's databases. Each row carries its
   * resolved `engine` and the publishable `pkLive` (or null → fall back to the
   * anonymous device key, `SK-ANON-006`). Read-only.
   */
  listDatabases(opts?: { signal?: AbortSignal }): Promise<{ databases: DatabaseSummary[] }>;
  /**
   * `POST /v1/databases` — create a database. Goal-first: `goal` drives the
   * engine classifier; pass `engine` to override (`GLOBAL-015`). Rejects an
   * unknown engine with `invalid_engine` (400). Mutating: pass `idempotencyKey`
   * for cross-process replay safety, else one is auto-generated (`SK-SDK-006`).
   */
  createDatabase(
    req: CreateDatabaseRequest,
    opts?: { signal?: AbortSignal; idempotencyKey?: string },
  ): Promise<CreateDatabaseResult>;
  /**
   * `DELETE /v1/databases/:id` — destructive removal (`SK-HDC-016`); resolves
   * once the schema and registry row are dropped. Rejects with `db_not_found`
   * when the id is unknown or belongs to another tenant. The UI owns the
   * typed-name confirmation — this wire call assumes intent is already
   * gathered. Mutating: auto-keyed (`SK-SDK-006`).
   */
  deleteDatabase(
    dbId: string,
    opts?: { signal?: AbortSignal; idempotencyKey?: string },
  ): Promise<void>;
  /**
   * Bring-your-own-database verbs (`SK-DBCONN-001`). Namespaced because
   * `GLOBAL-003` parity names the surface `client.databases.connect`.
   */
  databases: {
    /**
     * `POST /v1/db/connect` — connect a bring-your-own Postgres / ClickHouse
     * (`SK-DBCONN-001`). The server validates + egress-guards the host
     * (`GLOBAL-035`), seals the `connectionUrl` at rest (`GLOBAL-031`),
     * introspects the schema, and returns a live, queryable DB. Account-only:
     * an anonymous call rejects with `connect_requires_account` (403). The
     * `connectionUrl` rides the request body only — it is never placed in a
     * URL, log, or telemetry value (same trust class as a BYOLLM key). Other
     * errors worth a branch: `invalid_request` (400, mis-shaped body / bad URL
     * / egress-blocked), `introspection_failed` (502), `sealing_unconfigured`
     * (503). Mutating: auto-keyed (`SK-SDK-006`).
     */
    connect(
      req: ConnectDatabaseRequest,
      opts?: { signal?: AbortSignal; idempotencyKey?: string },
    ): Promise<ConnectDatabaseResult>;
  };
  /**
   * `POST /v1/run` — raw-SQL escape hatch (`SK-SDK-009` / `GLOBAL-015`). Same
   * allow-list and `trace` block as {@link ask}; DDL is rejected. Errors worth
   * a branch: `forbidden` (a read-only `pk_live` tried to write), `sql_rejected`,
   * `sql_too_long`. Mutating (may `INSERT`): auto-keyed (`SK-SDK-006`).
   */
  runSql(
    req: RunSqlRequest,
    opts?: { signal?: AbortSignal; idempotencyKey?: string },
  ): Promise<RunSqlResult>;
  /**
   * `POST /v1/memory/remember` — write a typed memory row into an
   * `agent_memory_v1` preset DB (E-02). No LLM in the loop: the payload is
   * structured, so the server emits a deterministic parameterised INSERT.
   * Rejects a non-preset DB with `wrong_preset` (409) and a read-only
   * `pk_live` with `forbidden`. Mutating: auto-keyed (`SK-SDK-006`).
   */
  remember(
    req: RememberRequest,
    opts?: { signal?: AbortSignal; idempotencyKey?: string },
  ): Promise<RememberResult>;
  /**
   * `GET /v1/keys/:hash/status` — revocation probe (`SK-MCP-014`). `apps/mcp/`'s
   * `McpAgent` calls this every 1 s to re-check `sk_mcp_*` revocation. `keyHash`
   * is the HMAC-SHA256 hex of the plaintext key (never the plaintext), computed
   * via `hmacHex` in the calling Worker. Session-only, tenant-scoped.
   */
  getKeyStatus(keyHash: string, opts?: { signal?: AbortSignal }): Promise<KeyStatus>;
  /**
   * `POST /v1/keys` — mint a new `sk_live_*` or `sk_mcp_*` key (`SK-APIKEYS-007`).
   * Session-only (`withCredentials: true`): a leaked `sk_live_` cannot bootstrap
   * sibling keys. The returned `key` is the plaintext, present exactly once
   * (`SK-APIKEYS-002`) — hand it to the user or the host config on the same
   * render. Mutating: auto-keyed (`SK-SDK-006`).
   */
  mintKey(
    req: MintKeyRequest,
    opts?: { signal?: AbortSignal; idempotencyKey?: string },
  ): Promise<MintKeyResult>;
  /**
   * `GET /v1/keys` — the caller's keys (`SK-APIKEYS-010`), active + revoked,
   * newest first with revoked rows sorted to the bottom. Session-cookie only:
   * a leaked `sk_live_` cannot enumerate sibling keys. Plaintext is never
   * present — `last4` is the only display affordance.
   */
  listKeys(opts?: { signal?: AbortSignal }): Promise<{ keys: KeyRecord[] }>;
  /**
   * `DELETE /v1/keys/:id` — hard-revoke (`SK-APIKEYS-011`). Tenant-scoped: a key
   * id from another tenant rejects as `key_not_found` (404) just like an unknown
   * id, so the call never leaks cross-tenant existence. Idempotent: a re-DELETE
   * returns `alreadyRevoked: true`. Session-only; mutating: auto-keyed.
   */
  revokeKey(
    keyId: string,
    opts?: { signal?: AbortSignal; idempotencyKey?: string },
  ): Promise<RevokeKeyResult>;
  /**
   * `POST /v1/oauth/mcp-callback/redeem` — redeem the one-shot OAuth-bridge code
   * (`SK-MCP-013`), the Worker-to-Worker call from `apps/mcp/`'s `bridgeHandler`.
   * The code itself is the auth proof (128-bit random, 60 s TTL, delete-on-read);
   * no bearer required on the client.
   */
  redeemOAuthBridgeCode(
    code: string,
    opts?: { signal?: AbortSignal },
  ): Promise<OAuthBridgeRedemption>;
  /**
   * `POST /v1/keys/byollm` — upsert the single per-account BYOLLM credential
   * (`SK-SDK-011`), the persistent counterpart to the per-request `byollm`
   * option (`SK-SDK-010`). **Session-only**: throws synchronously unless the
   * client was built with `withCredentials: true` — a decryptable stored key
   * must ride a first-party cookie, never a leakable bearer. The key is sent
   * only on this POST and is never returned by any verb. Errors: `invalid_byollm_key`
   * (400, mis-shaped), `byollm_unavailable` (503, deployment can't seal keys).
   * Mutating: auto-keyed (`SK-SDK-006`).
   */
  setByollm(
    cred: ByollmCredential,
    opts?: { signal?: AbortSignal; idempotencyKey?: string },
  ): Promise<ByollmSetResult>;
  /**
   * `GET /v1/keys/byollm` — status of the stored BYOLLM credential (`SK-SDK-011`).
   * Never returns the key (`SK-APIKEYS-002`); `{ configured: false }` is the empty
   * "add your key" state. **Session-only**: throws unless `withCredentials: true`.
   */
  getByollmStatus(opts?: { signal?: AbortSignal }): Promise<ByollmStatusResponse>;
  /**
   * `DELETE /v1/keys/byollm` — hard-clear the stored BYOLLM credential (instant
   * revocation, `GLOBAL-018`). Idempotent: `cleared: false` when there was nothing
   * to clear. **Session-only**: throws unless `withCredentials: true`. Mutating:
   * auto-keyed (`SK-SDK-006`).
   */
  clearByollm(opts?: { signal?: AbortSignal; idempotencyKey?: string }): Promise<ClearByollmResult>;
};

const DEFAULT_BASE_URL = "https://app.nlqdb.com";

// SK-LLM-021 — the BYOLLM wire header. Lower-case to match the wire
// (Hono normalises lookups, but the constant stays canonical). The
// value is `<provider>:<model>:<key>`; the server splits on the first
// two colons so a colon in the key survives, which is why the SDK
// rejects a colon in `provider` / `model` rather than emitting a value
// the server would mis-split.
const BYOLLM_HEADER = "x-nlq-byollm-key";

// GLOBAL-022 — wire-layer retry budget. Three attempts per call: the
// first plus two retries. Aligns with the server-side per-stage budget
// so end-to-end transient resilience is high without unbounded loops.
const SDK_MAX_ATTEMPTS = 3;

/**
 * Thrown on every failure path (non-2xx, transport, abort, non-JSON proxy
 * body). **Branch on `err.code`** — the stable contract is
 * `code` / `httpStatus` / `body`. Treat `err.message` as debug text only: its
 * format varies by path (e.g. `"nlqdb: /v1/ask → 429 rate_limited"` vs
 * `"nlqdb: /v1/ask network error"`), so a surface that renders it verbatim
 * gets unstable copy — render `body.message` / a `code`-derived CTA instead
 * (`GLOBAL-012`). `httpStatus === 0` signals a transport-level failure
 * (network / abort) — no response was received.
 */
export class NlqdbApiError extends Error {
  override readonly name = "NlqdbApiError";
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: ApiErrorCode,
    readonly path: string,
    readonly body: ApiErrorBody | null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/**
 * Build the typed {@link NlqClient} — the only entrypoint consumers call
 * directly, and the only HTTP surface per `GLOBAL-001`. Pick exactly one auth
 * mode at construction (`SK-SDK-001`): `{ apiKey }` for a server-side bearer
 * (never ship to a browser bundle — it leaks) **or** `{ withCredentials: true }`
 * for a browser cookie session; passing both throws. Omitting both leaves
 * calls anonymous. The session-only verbs (`setByollm` / `getByollmStatus` /
 * `clearByollm`) and the `byollm` option require `withCredentials: true` and
 * throw otherwise (`SK-SDK-010` / `SK-SDK-011`). Optional `baseUrl` and a custom
 * `fetch` round out the options.
 */
export function createClient(opts: ClientOptions = {}): NlqClient {
  // Defensive runtime guard — the union type above blocks this at
  // compile time, but JS callers (or `as any` escapes) can still slip
  // both through. Failing fast at construction beats a silent
  // dual-auth header in flight.
  const optsAny = opts as { apiKey?: string; withCredentials?: boolean };
  if (optsAny.apiKey && optsAny.withCredentials) {
    throw new Error(
      "@nlqdb/sdk: pass either `apiKey` (server) or `withCredentials: true` (browser), not both. Sending a server-side bearer over a browser cookie risks leaking the key.",
    );
  }

  // SK-SDK-010 — fail loud at construction (GLOBAL-012) when BYOLLM is
  // misconfigured, rather than shipping a request the API will 400. The
  // lane is signed-in only (`SK-LLM-021`), so a bearer / anonymous key
  // can never carry it — require the cookie session.
  const byollmHeader = opts.byollm ? buildByollmHeader(opts.byollm) : undefined;
  if (byollmHeader && !opts.withCredentials) {
    throw new Error(
      "@nlqdb/sdk: `byollm` requires `withCredentials: true` — the API accepts a bring-your-own provider key only on a signed-in session, never a bearer or anonymous call.",
    );
  }

  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetcher = opts.fetch ?? globalThis.fetch;
  const credentials = opts.withCredentials ? ("include" as const) : undefined;

  // SK-SDK-011 — the account-stored BYOLLM verbs hit session-only routes;
  // fail loud here (`GLOBAL-012`) rather than let the API 401 a bearer
  // call. Mirrors the construction-time guard the `byollm` option uses.
  function assertSession(method: string): void {
    if (!opts.withCredentials) {
      throw new Error(
        `@nlqdb/sdk: \`${method}\` requires \`withCredentials: true\` — account-stored BYOLLM keys live behind a signed-in session, never a bearer or anonymous call.`,
      );
    }
  }

  // Hoist auth + content-type once per client. `call` shallow-copies
  // before merging per-request headers — avoids reallocating the
  // Authorization string on every request without coupling to caller
  // mutation patterns.
  const baseHeaders: Record<string, string> = { "content-type": "application/json" };
  if (opts.apiKey) baseHeaders["authorization"] = `Bearer ${opts.apiKey}`;

  async function call<T>(path: string, init: RequestInit): Promise<T> {
    // GLOBAL-022 + SK-SDK-006 — wire-layer retry loop. Up to 3
    // attempts on transport failures and transient 5xx; 4xx surfaces
    // immediately (caller error). For mutations the same
    // `Idempotency-Key` is reused across attempts: auto-generate one
    // if the caller didn't supply it, so the API's dedupe store
    // collapses retries to a single side-effect (`SK-SDK-006`).
    const headers = mergeHeaders(baseHeaders, init.headers);
    const isMutation = (init.method ?? "GET").toUpperCase() !== "GET";
    if (isMutation && !hasHeader(headers, "idempotency-key")) {
      headers["idempotency-key"] = randomId();
    }
    const reqInit: RequestInit = {
      ...init,
      headers,
      ...(credentials ? { credentials } : {}),
    };

    let lastErr: NlqdbApiError | null = null;
    for (let attempt = 1; attempt <= SDK_MAX_ATTEMPTS; attempt++) {
      const result = await sendOnce<T>(fetcher, `${baseUrl}${path}`, path, reqInit);
      if (result.kind === "ok") return result.value;
      lastErr = result.error;
      // Surface 4xx + parse + abort immediately. Aborts cancel the
      // user's intent; 4xx are caller errors retry can't fix.
      if (!isRecoverable(result.error)) throw result.error;
      if (attempt === SDK_MAX_ATTEMPTS) throw result.error;
    }
    throw (
      lastErr ?? new NlqdbApiError(`nlqdb: ${path} retry exhausted`, 0, "unknown_error", path, null)
    );
  }

  async function streamAsk(req: AskRequest, opts: AskStreamOptions): Promise<AskOk> {
    let res: Response;
    try {
      res = await fetcher(`${baseUrl}/v1/ask`, {
        method: "POST",
        headers: {
          ...baseHeaders,
          accept: "text/event-stream",
          ...(byollmHeader ? { [BYOLLM_HEADER]: byollmHeader } : {}),
        },
        body: JSON.stringify(req),
        signal: opts.signal,
        ...(credentials ? { credentials } : {}),
      });
    } catch (err) {
      const aborted =
        (err instanceof Error && err.name === "AbortError") ||
        (typeof DOMException !== "undefined" &&
          err instanceof DOMException &&
          err.name === "AbortError") ||
        opts.signal?.aborted === true;
      throw new NlqdbApiError(
        aborted ? "nlqdb: /v1/ask aborted" : "nlqdb: /v1/ask network error",
        0,
        aborted ? "aborted" : "network_error",
        "/v1/ask",
        null,
        { cause: err },
      );
    }

    // Errors land as JSON, not SSE. The handler returns the JSON
    // body before opening the event stream, so a non-2xx with a
    // JSON `Content-Type` is the normal error path here.
    if (!res.ok) {
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        throw new NlqdbApiError(
          `nlqdb: /v1/ask → ${res.status} non-JSON response`,
          res.status,
          "non_json_response",
          "/v1/ask",
          null,
        );
      }
      const errBody = extractError(parsed);
      const code = errBody?.status ?? "unknown_error";
      throw new NlqdbApiError(
        `nlqdb: /v1/ask → ${res.status} ${code}`,
        res.status,
        code,
        "/v1/ask",
        errBody,
      );
    }

    if (!res.body) {
      throw new NlqdbApiError(
        "nlqdb: /v1/ask → 200 with no stream body",
        res.status,
        "non_json_response",
        "/v1/ask",
        null,
      );
    }

    const fire = (ev: TraceEvent) => {
      try {
        opts.onTrace?.(ev);
      } catch {
        // SK-SDK-007: a hook throw must not poison the stream.
        // Swallow silently — surfaces own their UI errors.
      }
    };

    let trace: Trace | undefined;
    let rows: Record<string, unknown>[] = [];
    let rowCount = 0;
    let summary: string | undefined;
    let requiresConfirm = false;
    let diff: AskDiff | undefined;
    let selectedDb: SelectedDbEcho | undefined;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line. Process each
      // complete frame; stash the trailing partial back in `buf`.
      for (;;) {
        const sep = buf.indexOf("\n\n");
        if (sep === -1) break;
        const frame = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const parsed = parseSseFrame(frame);
        if (!parsed) continue;
        const { event, data } = parsed;
        let payload: unknown;
        try {
          payload = data ? JSON.parse(data) : {};
        } catch {
          continue;
        }
        const traceEvent = toTraceEvent(event, payload);
        if (traceEvent) fire(traceEvent);
        switch (event) {
          case "plan": {
            const p = payload as { trace?: Trace };
            if (p.trace) trace = p.trace;
            break;
          }
          case "rows": {
            const p = payload as { rows?: Record<string, unknown>[]; rowCount?: number };
            rows = p.rows ?? [];
            rowCount = p.rowCount ?? rows.length;
            break;
          }
          case "summary": {
            const p = payload as { summary?: string };
            summary = p.summary;
            break;
          }
          case "confirm_required": {
            const p = payload as { diff?: AskDiff };
            requiresConfirm = true;
            diff = p.diff;
            break;
          }
          case "selected_db": {
            const p = payload as { db?: SelectedDbEcho };
            if (p.db) selectedDb = p.db;
            break;
          }
          case "error": {
            const p = payload as { error?: ApiErrorBody };
            const errBody = p.error ?? null;
            throw new NlqdbApiError(
              `nlqdb: /v1/ask → ${errBody?.status ?? "unknown_error"}`,
              200,
              errBody?.status ?? "unknown_error",
              "/v1/ask",
              errBody,
            );
          }
          case "done":
            // Final frame; loop continues to drain the reader.
            break;
        }
      }
    }

    if (!trace) {
      // SK-TRUST-002: every successful response is contractually
      // required to carry `trace`. If the server didn't emit a `plan`
      // event before `done`, the stream is malformed.
      throw new NlqdbApiError(
        "nlqdb: /v1/ask stream missing trace block",
        200,
        "non_json_response",
        "/v1/ask",
        null,
      );
    }
    return {
      status: "ok",
      rows,
      rowCount,
      ...(summary !== undefined ? { summary } : {}),
      ...(requiresConfirm ? { requires_confirm: true } : {}),
      ...(diff ? { diff } : {}),
      ...(selectedDb ? { selected_db: selectedDb } : {}),
      trace,
    };
  }

  return {
    ask: (req, callOpts) =>
      call<AskResponse>("/v1/ask", {
        method: "POST",
        body: JSON.stringify(req),
        signal: callOpts?.signal,
        // BYOLLM rides `/v1/ask` only — the key stays off every other
        // endpoint that has no use for it (`SK-SDK-010`).
        ...(byollmHeader ? { headers: { [BYOLLM_HEADER]: byollmHeader } } : {}),
      }),
    askStream: streamAsk,
    runSql: (req, callOpts) =>
      call<RunSqlResult>("/v1/run", {
        method: "POST",
        body: JSON.stringify(req),
        signal: callOpts?.signal,
        ...(callOpts?.idempotencyKey
          ? { headers: { "idempotency-key": callOpts.idempotencyKey } }
          : {}),
      }),
    remember: (req, callOpts) =>
      call<RememberResult>("/v1/memory/remember", {
        method: "POST",
        body: JSON.stringify(req),
        signal: callOpts?.signal,
        ...(callOpts?.idempotencyKey
          ? { headers: { "idempotency-key": callOpts.idempotencyKey } }
          : {}),
      }),
    listChat: (callOpts) =>
      call<{ messages: ChatMessage[] }>("/v1/chat/messages", { signal: callOpts?.signal }),
    postChat: (req, callOpts) =>
      call("/v1/chat/messages", {
        method: "POST",
        body: JSON.stringify(req),
        signal: callOpts?.signal,
      }),
    listDatabases: (callOpts) =>
      call<{ databases: DatabaseSummary[] }>("/v1/databases", { signal: callOpts?.signal }),
    createDatabase: (req, callOpts) =>
      call<CreateDatabaseResult>("/v1/databases", {
        method: "POST",
        body: JSON.stringify(req),
        signal: callOpts?.signal,
        ...(callOpts?.idempotencyKey
          ? { headers: { "idempotency-key": callOpts.idempotencyKey } }
          : {}),
      }),
    deleteDatabase: async (dbId, callOpts) => {
      await call<void>(`/v1/databases/${encodeURIComponent(dbId)}`, {
        method: "DELETE",
        signal: callOpts?.signal,
        ...(callOpts?.idempotencyKey
          ? { headers: { "idempotency-key": callOpts.idempotencyKey } }
          : {}),
      });
    },
    databases: {
      connect: (req, callOpts) =>
        // SK-DBCONN-001 — the `connectionUrl` travels only in the JSON
        // body, never a query string / header / log line (same trust
        // class as the BYOLLM key). `call()` never echoes a request body
        // into the thrown error, so a failure can't leak the URL either.
        call<ConnectDatabaseResult>("/v1/db/connect", {
          method: "POST",
          body: JSON.stringify({
            engine: req.engine,
            connection_url: req.connectionUrl,
            ...(req.name !== undefined ? { name: req.name } : {}),
          }),
          signal: callOpts?.signal,
          ...(callOpts?.idempotencyKey
            ? { headers: { "idempotency-key": callOpts.idempotencyKey } }
            : {}),
        }),
    },
    getKeyStatus: (keyHash, callOpts) =>
      call<KeyStatus>(`/v1/keys/${encodeURIComponent(keyHash)}/status`, {
        signal: callOpts?.signal,
      }),
    mintKey: (req, callOpts) =>
      call<MintKeyResult>("/v1/keys", {
        method: "POST",
        body: JSON.stringify(req),
        signal: callOpts?.signal,
        ...(callOpts?.idempotencyKey
          ? { headers: { "idempotency-key": callOpts.idempotencyKey } }
          : {}),
      }),
    listKeys: (callOpts) => call<{ keys: KeyRecord[] }>("/v1/keys", { signal: callOpts?.signal }),
    revokeKey: (keyId, callOpts) =>
      call<RevokeKeyResult>(`/v1/keys/${encodeURIComponent(keyId)}`, {
        method: "DELETE",
        signal: callOpts?.signal,
        ...(callOpts?.idempotencyKey
          ? { headers: { "idempotency-key": callOpts.idempotencyKey } }
          : {}),
      }),
    redeemOAuthBridgeCode: (code, callOpts) =>
      call<OAuthBridgeRedemption>("/v1/oauth/mcp-callback/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
        signal: callOpts?.signal,
      }),
    setByollm: (cred, callOpts) => {
      assertSession("setByollm");
      // Non-empty guard mirrors `buildByollmHeader` so a mis-shaped
      // credential fails loud here rather than as a guaranteed API 400.
      // The colon / control-char checks the header lane needs don't apply
      // — these parts travel as JSON fields, not a colon-joined header.
      if (!cred.provider || !cred.model || !cred.key) {
        throw new Error(
          "@nlqdb/sdk: `setByollm` requires non-empty `provider`, `model`, and `key`.",
        );
      }
      return call<ByollmSetResult>("/v1/keys/byollm", {
        method: "POST",
        body: JSON.stringify({ provider: cred.provider, model: cred.model, key: cred.key }),
        signal: callOpts?.signal,
        ...(callOpts?.idempotencyKey
          ? { headers: { "idempotency-key": callOpts.idempotencyKey } }
          : {}),
      });
    },
    getByollmStatus: (callOpts) => {
      assertSession("getByollmStatus");
      return call<ByollmStatusResponse>("/v1/keys/byollm", { signal: callOpts?.signal });
    },
    clearByollm: (callOpts) => {
      assertSession("clearByollm");
      return call<ClearByollmResult>("/v1/keys/byollm", {
        method: "DELETE",
        signal: callOpts?.signal,
        ...(callOpts?.idempotencyKey
          ? { headers: { "idempotency-key": callOpts.idempotencyKey } }
          : {}),
      });
    },
  };
}

// SSE frame parser. Only consumes the subset of the spec the API
// emits: `event:` + `data:` lines, no multi-line `data:`, no `id:`
// or `retry:`. Returns null for comment-only frames.
function parseSseFrame(frame: string): { event: string; data: string } | null {
  let event = "message";
  let data = "";
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data = data ? `${data}\n${value}` : value;
  }
  if (!event && !data) return null;
  return { event, data };
}

function toTraceEvent(event: string, payload: unknown): TraceEvent | null {
  switch (event) {
    case "plan_pending":
      return { type: "plan_pending" };
    case "plan": {
      const p = payload as { trace?: Trace };
      if (!p.trace) return null;
      return { type: "plan", trace: p.trace };
    }
    case "rows": {
      const p = payload as { rows?: Record<string, unknown>[]; rowCount?: number };
      return { type: "rows", rows: p.rows ?? [], rowCount: p.rowCount ?? 0 };
    }
    case "summary": {
      const p = payload as { summary?: string };
      return { type: "summary", summary: p.summary ?? "" };
    }
    case "confirm_required": {
      const p = payload as { diff?: AskDiff };
      if (!p.diff) return null;
      return { type: "confirm_required", diff: p.diff };
    }
    case "selected_db": {
      const p = payload as { db?: SelectedDbEcho };
      if (!p.db) return null;
      return { type: "selected_db", db: p.db };
    }
    case "error": {
      const p = payload as { error?: ApiErrorBody };
      return { type: "error", error: p.error ?? { status: "unknown_error" } };
    }
    case "done":
      return { type: "done", status: "ok" };
    default:
      return null;
  }
}

// Single-attempt request. Returns either the parsed body or a wrapped
// `NlqdbApiError`; the caller's retry loop decides whether to throw.
// Splitting this out keeps the retry loop in `call` focused on
// classification (recoverable vs not) instead of HTTP plumbing.
type SendResult<T> = { kind: "ok"; value: T } | { kind: "err"; error: NlqdbApiError };

async function sendOnce<T>(
  fetcher: FetchLike,
  url: string,
  path: string,
  init: RequestInit,
): Promise<SendResult<T>> {
  let res: Response;
  try {
    res = await fetcher(url, init);
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === "AbortError") ||
      (typeof DOMException !== "undefined" &&
        err instanceof DOMException &&
        err.name === "AbortError") ||
      init.signal?.aborted === true;
    return {
      kind: "err",
      error: new NlqdbApiError(
        aborted ? `nlqdb: ${path} aborted` : `nlqdb: ${path} network error`,
        0,
        aborted ? "aborted" : "network_error",
        path,
        null,
        { cause: err },
      ),
    };
  }
  const text = await res.text();
  let parsed: unknown;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        kind: "err",
        error: new NlqdbApiError(
          `nlqdb: ${path} → ${res.status} non-JSON response`,
          res.status,
          "non_json_response",
          path,
          null,
        ),
      };
    }
  }
  if (!res.ok) {
    const errBody = extractError(parsed);
    const code = errBody?.status ?? "unknown_error";
    return {
      kind: "err",
      error: new NlqdbApiError(
        `nlqdb: ${path} → ${res.status} ${code}`,
        res.status,
        code,
        path,
        errBody,
      ),
    };
  }
  return { kind: "ok", value: parsed as T };
}

// Recoverable = transport failure or transient 5xx. 4xx surfaces
// immediately; aborts cancel the user's intent. `non_json_response`
// from a 5xx counts (proxy returned an HTML error page); from a 2xx
// it doesn't (server bug, retry won't help).
function isRecoverable(err: NlqdbApiError): boolean {
  if (err.code === "aborted") return false;
  if (err.code === "network_error") return true;
  if (err.httpStatus === 0) return false;
  if (err.httpStatus >= 500 && err.httpStatus < 600) return true;
  return false;
}

function mergeHeaders(
  base: Record<string, string>,
  extra: HeadersInit | undefined,
): Record<string, string> {
  const out: Record<string, string> = { ...base };
  if (!extra) return out;
  if (extra instanceof Headers) {
    extra.forEach((v, k) => {
      out[k.toLowerCase()] = v;
    });
    return out;
  }
  if (Array.isArray(extra)) {
    for (const [k, v] of extra) out[k.toLowerCase()] = v;
    return out;
  }
  for (const [k, v] of Object.entries(extra)) out[k.toLowerCase()] = String(v);
  return out;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.hasOwn(headers, name.toLowerCase());
}

// 16-byte random id rendered as 32 hex chars. Used for the auto-
// generated `Idempotency-Key` on retried mutations (`SK-SDK-006`).
// Falls back to `Math.random` only when the global `crypto` is missing
// (very old runtimes); the fallback is sufficient for de-dupe — the
// API treats the key as opaque, not a security boundary.
function randomId(): string {
  const cryptoObj: { getRandomValues?: (b: Uint8Array) => Uint8Array } | undefined = (
    globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }
  ).crypto;
  const bytes = new Uint8Array(16);
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  }
  return out;
}

// SK-SDK-010 — validate + assemble the `x-nlq-byollm-key` value once,
// at construction. Provider is lower-cased to match the server's
// normalisation; provider/model are rejected when empty or when they
// contain the `:` the server splits on (the key may contain `:` because
// it is the unsplit remainder); all parts are rejected if they contain
// a control char (CR/LF would let a value smuggle extra headers, and
// `fetch` would otherwise throw an opaque `TypeError`). Fails loud
// (GLOBAL-012) so a mis-shaped credential surfaces here as one sentence,
// not as an opaque downstream error.
function buildByollmHeader(cred: ByollmCredential): string {
  const provider = cred.provider.trim().toLowerCase();
  const model = cred.model.trim();
  const key = cred.key.trim();
  if (!provider || !model || !key) {
    throw new Error(
      "@nlqdb/sdk: `byollm` requires non-empty `provider`, `model`, and `key` — set all three before constructing the client.",
    );
  }
  if (provider.includes(":") || model.includes(":")) {
    throw new Error(
      "@nlqdb/sdk: `byollm.provider` and `byollm.model` must not contain a colon — pass the bare ids (e.g. `openai`, `gpt-5.2`).",
    );
  }
  const value = `${provider}:${model}:${key}`;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      throw new Error(
        "@nlqdb/sdk: `byollm` values must not contain control characters — re-paste the key without hidden CR/LF characters.",
      );
    }
  }
  return value;
}

// Normalize the API's TWO error envelope shapes into a single
// `ApiErrorBody`:
//
//   1. Structured  — `{ error: { status: "rate_limited", limit, count } }`
//      (orchestrator + chat outcome failures)
//   2. String-form — `{ error: "invalid_json" }`
//      (body-parse failures from apps/api/src/http.ts +
//      `secret_unconfigured` from the billing route)
//
// Returning `null` only on shapes we genuinely don't recognize means
// the consumer's `err.code === "invalid_json"` discriminator works
// for the string-form too — without this, every malformed-body 400
// surfaced as `unknown_error`.
function extractError(parsed: unknown): ApiErrorBody | null {
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as Record<string, unknown>;
  const errEnvelope = body["error"];
  if (typeof errEnvelope === "string") {
    return { status: errEnvelope as ApiErrorCode };
  }
  if (errEnvelope && typeof errEnvelope === "object") {
    const inner = errEnvelope as Record<string, unknown>;
    if (typeof inner["status"] === "string") return inner as ApiErrorBody;
  }
  return null;
}
