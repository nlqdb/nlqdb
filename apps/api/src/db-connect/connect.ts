// `POST /v1/db/connect` orchestrator — "connect your own ClickHouse /
// Postgres DB and query it in English". Pure function: every external
// dependency is injected via `ConnectByoDeps`, so unit tests construct
// stubs and the route handler builds prod deps from the request context
// (`db-connect/build-deps.ts`). Mirrors the deps-injected style of
// `db-create/orchestrate.ts`.
//
// This path is deliberately STANDALONE — it does NOT route through
// `orchestrateDbCreate` / `registerByoDb`. Those assume an authored
// SchemaPlan + compiled DDL (the typed-plan create pipeline); a BYO
// connection has neither — the schema is read out of the live database
// by introspection, not authored by us. So the flow here is its own:
// validate → introspect+render → seal → register.
//
// Ordering is load-bearing (see the numbered steps): the KEK check
// happens BEFORE any network I/O so a misconfigured deployment fails
// fast and cheap; the egress-guarded URL validation happens before the
// blob is sealed or the host is dialled; the secret is sealed only after
// introspection proves the credentials work; the D1 row is written last.
//
// Secrets discipline (GLOBAL-031 / GLOBAL-012): this module never logs
// or echoes the connection URL or password. Introspection failures
// collapse to one generic operator-actionable sentence; the only
// caller-visible identifiers are the engine and the minted dbId.
//
// Related: `docs/architecture.md §3.6.7` (BYO connect), GLOBAL-031
// (secret envelope), GLOBAL-035 (DNS-rebind egress guard, enforced by
// the injected `resolve`).

import {
  type ClickhouseConnSpec,
  type ClickhouseQueryFn,
  type DnsResolver,
  introspectClickhouse,
  introspectPostgres,
  type PostgresQueryFn,
  renderByoClickhouseSchema,
  renderByoPostgresSchema,
  validateByoConnection,
} from "@nlqdb/db";
import { sealSecret } from "../secret-envelope.ts";
import { BYO_SECRET_REF_SENTINEL } from "./constants.ts";

// Re-export the Postgres introspector's query-fn shape under a local
// name so the route + tests reference it without a second @nlqdb/db
// import. It is `PostgresQueryFn` verbatim.
export type PostgresIntrospectQueryFn = PostgresQueryFn;

export type ConnectByoDeps = {
  // Egress-guarded DNS resolver (GLOBAL-035). Forwarded to
  // `validateByoConnection` and the ClickHouse query builder so every
  // connect re-guards the host against rebind.
  resolve: DnsResolver;
  // BYO_SECRET_KEK; undefined ⇒ the deployment can't seal ⇒ 503.
  kek: string | undefined;
  d1: D1Database;
  // 6-char suffix for the dbId tail. Injectable so tests pin ids.
  randomSuffix: () => string;
  // Mints a pk_live_ key for the freshly-connected DB. Optional so unit
  // tests skip it; failures are swallowed (the DB is already committed).
  mintPkLive?: (dbId: string, tenantId: string) => Promise<string>;
  // Engine live-query factories. The ClickHouse one takes a connection
  // spec (host/port/secure/db/user/password); the Postgres one takes the
  // raw URL and returns a query fn the introspector accepts.
  buildClickhouseQuery: (spec: ClickhouseConnSpec) => ClickhouseQueryFn;
  buildPostgresQuery: (rawUrl: string) => PostgresIntrospectQueryFn;
};

export type ConnectByoArgs = {
  engine: "clickhouse" | "postgres";
  connectionUrl: string;
  name?: string;
  tenantId: string;
};

export type ConnectByoResult =
  | {
      ok: true;
      dbId: string;
      name: string;
      engine: string;
      schemaPreview: string;
      pkLive: string | null;
    }
  | { ok: false; status: number; message: string };

// Max chars of rendered schema returned to the caller as a preview. The
// full schema is persisted on the row (`schema_text`); the preview is a
// confirmation affordance, not the planner's input.
const SCHEMA_PREVIEW_LIMIT = 4000;

export async function connectByoDb(
  deps: ConnectByoDeps,
  args: ConnectByoArgs,
): Promise<ConnectByoResult> {
  // a. KEK gate FIRST — before any network I/O. A deployment that can't
  //    seal the connection must not dial the user's host only to fail at
  //    the persist step (503 = well-formed request, platform not ready).
  if (!deps.kek) {
    return {
      ok: false,
      status: 503,
      message:
        "Connection sealing is not configured on this deployment; set BYO_SECRET_KEK and retry.",
    };
  }

  // b. Validate the URL shape + egress-guard the host (GLOBAL-035). The
  //    message is already a single safe sentence that never echoes the
  //    secret — pass it straight through.
  const v = await validateByoConnection(args.engine, args.connectionUrl, deps.resolve);
  if (!v.ok) {
    return { ok: false, status: 400, message: v.message };
  }

  // c. Mint the dbId. Slug from the caller's name, else the target
  //    database, else a generic fallback — normalised to a safe
  //    identifier. Re-mint on a D1 id collision (bounded retries).
  const slug = makeSlug(args.name ?? v.connection.parsed.database ?? "byo");
  const dbId = await mintUniqueDbId(deps.d1, slug, deps.randomSuffix);
  if (!dbId) {
    return {
      ok: false,
      status: 502,
      message: "Could not allocate a database id; retry in a moment.",
    };
  }

  // d. Read the live schema by introspection, then render it to the
  //    planner-facing text + a stable hash. Any failure here (bad creds,
  //    unreachable host, permission error) collapses to one generic
  //    sentence — never the URL, password, or driver error detail.
  let rendered: { schemaText: string; schemaHash: string };
  try {
    if (v.connection.engine === "clickhouse") {
      const parsed = v.connection.parsed;
      const password = passwordFromUrl(args.connectionUrl);
      const spec: ClickhouseConnSpec = {
        host: parsed.host,
        port: parsed.port,
        secure: parsed.secure,
        database: parsed.database,
        user: parsed.user,
        password,
      };
      const query = deps.buildClickhouseQuery(spec);
      const schema = await introspectClickhouse(query, parsed.database);
      rendered = renderByoClickhouseSchema(schema);
    } else {
      const query = deps.buildPostgresQuery(args.connectionUrl);
      // Schema defaults to "public" — the conventional Postgres schema.
      const schema = await introspectPostgres(query, "public");
      rendered = renderByoPostgresSchema(schema);
    }
  } catch {
    return {
      ok: false,
      status: 502,
      message:
        "Could not read the database schema; check the credentials and that the host is reachable.",
    };
  }

  // e. Seal the raw URL only after introspection proved it works.
  const blob = await sealSecret(args.connectionUrl, {
    kek: deps.kek,
    context: `dbconn:${dbId}`,
  });

  // f. Register the row. `connection_secret_ref` is the BYO sentinel
  //    (there is no env var to resolve); the sealed URL rides
  //    `connection_blob`. Seed the three timestamps with unixepoch() so
  //    the row matches the hosted-create shape.
  await deps.d1
    .prepare(
      "INSERT INTO databases " +
        "(id, tenant_id, engine, connection_secret_ref, connection_blob, schema_hash, schema_text, created_at, updated_at, last_queried_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch(), unixepoch())",
    )
    .bind(
      dbId,
      args.tenantId,
      args.engine,
      BYO_SECRET_REF_SENTINEL,
      blob,
      rendered.schemaHash,
      rendered.schemaText,
    )
    .run();

  // g. Mint a pk_live_ key for the copy-snippet CTA. Failure is
  //    non-fatal — the DB is already committed and queryable.
  const pkLive = deps.mintPkLive
    ? await deps.mintPkLive(dbId, args.tenantId).catch(() => null)
    : null;

  return {
    ok: true,
    dbId,
    name: args.name ?? slug,
    engine: args.engine,
    schemaPreview: rendered.schemaText.slice(0, SCHEMA_PREVIEW_LIMIT),
    pkLive,
  };
}

// Normalise an arbitrary name into a safe slug body for the dbId
// (`db_<slug>_<suffix>`). Lowercase, `[a-z0-9_]` only, collapse runs of
// `_`, trim leading/trailing `_`. Falls back to "byo" when the input
// reduces to nothing (e.g. a name of only punctuation).
function makeSlug(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || "byo";
}

// Mint `db_<slug>_<suffix>` and confirm it's free in D1. Re-mints the
// suffix on a true collision (bounded to 3 attempts so a misconfigured
// suffix generator can't loop forever). Returns null if all attempts
// collide. The id format matches the create path's `db_<slug>_<6char>`,
// so `deriveSlug` / `displayName` in databases/list.ts render it cleanly.
async function mintUniqueDbId(
  d1: D1Database,
  slug: string,
  randomSuffix: () => string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const dbId = `db_${slug}_${randomSuffix()}`;
    const existing = await d1
      .prepare("SELECT id FROM databases WHERE id = ?")
      .bind(dbId)
      .first<{ id: string }>();
    if (!existing) return dbId;
  }
  return null;
}

// Extract the password from the raw connection URL. The parsed shapes
// deliberately omit it (they're safe-to-log); the live adapter needs it.
// Falls back to the `?password=` query param (ClickHouse HTTP form) when
// userinfo carries no password. Returns null when neither is present.
function passwordFromUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.password) return decodeURIComponent(u.password);
    const qp = u.searchParams.get("password");
    return qp !== null ? qp : null;
  } catch {
    return null;
  }
}
