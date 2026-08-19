// `connectSupabaseMgmt` — the connect-time core for a Supabase database reached
// over the OAuth / Management-API transport (`SK-DBCONN-003`, Option B). It is
// the mgmt sibling of `connectByoDb`: a pure, deps-injected orchestrator the
// OAuth callback (`oauth/` engine) calls once it holds a project ref + access
// token. It deliberately does NOT route through `connectByoDb` because the
// storage shape differs — a mgmt row seals an OAuth **token** (not a DSN) and
// carries the `SUPABASE_MGMT_BLOB_SENTINEL`, so query-time dispatches to the
// HTTPS transport rather than a socket. Everything else is shared: the same
// `introspectPostgres` + `renderByoPostgresSchema` (one introspection logic,
// `GLOBAL-017`) and the same `mintUniqueDbId` id shape.
//
// Ordering mirrors `connectByoDb`: KEK gate before any I/O; introspection
// proves the token works before anything is persisted; the token is sealed and
// the grant row written only after the `databases` row exists (FK order).
//
// Secrets discipline (`GLOBAL-031` / `GLOBAL-012`): the access/refresh tokens
// are sealed (AAD `dboauth:<dbId>`) and never logged; introspection failures
// collapse to one generic sentence.

import { introspectPostgres, type PostgresQueryFn, renderByoPostgresSchema } from "@nlqdb/db";
import { sealSecret } from "../secret-envelope.ts";
import { BYO_SECRET_REF_SENTINEL, SUPABASE_MGMT_BLOB_SENTINEL } from "./constants.ts";
import { makeSlug, mintUniqueDbId } from "./register-helpers.ts";

// The sealed payload in `db_oauth_grants.token_blob`. Carries everything the
// query-time refresh (`ask/build-deps.ts`) needs: the current access token, the
// refresh token, and the absolute epoch-seconds expiry to decide when to
// refresh. One JSON string, sealed as a unit.
export type SupabaseGrantSecret = {
  accessToken: string;
  refreshToken: string;
  // Absolute expiry (epoch seconds) of `accessToken`.
  expiresAt: number;
};

export type ConnectSupabaseMgmtDeps = {
  // BYO_SECRET_KEK; undefined ⇒ the deployment can't seal ⇒ 503.
  kek: string | undefined;
  d1: D1Database;
  // 6-char suffix for the dbId tail. Injectable so tests pin ids.
  randomSuffix: () => string;
  // Mints a pk_live_ key for the freshly-connected DB. Optional so unit tests
  // skip it; failures are swallowed (the DB is already committed).
  mintPkLive?: (dbId: string, tenantId: string) => Promise<string>;
  // Management-API query factory. Production binds `openSupabaseMgmtPostgres`;
  // tests inject a fake `{ query }`.
  buildMgmtQuery: (projectRef: string, accessToken: string) => { query: PostgresQueryFn };
};

export type ConnectSupabaseMgmtArgs = {
  projectRef: string;
  accessToken: string;
  refreshToken: string;
  // Absolute epoch-seconds expiry of `accessToken` (caller computes it from the
  // token response's `expires_in`).
  expiresAt: number;
  tenantId: string;
  // Display name (defaults to the project ref).
  name?: string;
  // SK-GTM-005 — request self-identified as nlqdb-generated (walker/preview).
  synthetic?: boolean;
};

export type ConnectSupabaseMgmtResult =
  | {
      ok: true;
      dbId: string;
      name: string;
      engine: "postgres";
      schemaPreview: string;
      pkLive: string | null;
    }
  | { ok: false; status: number; message: string };

// Max chars of rendered schema returned as a preview (matches `connectByoDb`).
const SCHEMA_PREVIEW_LIMIT = 4000;

// A Supabase project ref is exactly 20 lowercase alphanumerics. The ref is
// interpolated into the Management-API URL path
// (`/v1/projects/${ref}/database/query`), so anything else — `../`, a slash, a
// scheme, whitespace/CRLF — must be rejected before it can escape the path
// segment to another endpoint. The `/select` ref is caller-supplied, so this is
// a load-bearing guard, not cosmetic.
export function isValidSupabaseRef(ref: string): boolean {
  return /^[a-z0-9]{20}$/.test(ref);
}

export async function connectSupabaseMgmt(
  deps: ConnectSupabaseMgmtDeps,
  args: ConnectSupabaseMgmtArgs,
): Promise<ConnectSupabaseMgmtResult> {
  // Reject a malformed project ref before it reaches the URL path (SSRF /
  // path-traversal guard) — cheapest check first, no I/O.
  if (!isValidSupabaseRef(args.projectRef)) {
    return {
      ok: false,
      status: 400,
      message: "That doesn't look like a Supabase project; reconnect and pick a project.",
    };
  }

  // a. KEK gate FIRST — before any network I/O. Without it the token can't be
  //    sealed, so don't dial the user's project only to fail at persist.
  if (!deps.kek) {
    return {
      ok: false,
      status: 503,
      message:
        "Connection sealing is not configured on this deployment; set BYO_SECRET_KEK and retry.",
    };
  }

  // b. Read the live schema over the Management API (read-only), then render it
  //    to planner text + a stable hash. Any failure collapses to one generic
  //    sentence — never the token or the driver error detail (`GLOBAL-012`).
  let rendered: { schemaText: string; schemaHash: string };
  try {
    const { query } = deps.buildMgmtQuery(args.projectRef, args.accessToken);
    const schema = await introspectPostgres(query, "public");
    rendered = renderByoPostgresSchema(schema);
  } catch {
    return {
      ok: false,
      status: 502,
      message:
        "Could not read the database schema; reconnect Supabase and make sure the project is active.",
    };
  }

  // b.1 An empty `public` schema (the only schema introspected) has nothing to
  //     query in English. Fail honestly with the next action rather than mint a
  //     database that silently 0-results at ask-time (`P6`, `GLOBAL-012`). Empty
  //     `schemaText` ⇔ zero rendered CREATE TABLEs ⇔ no tables.
  if (!rendered.schemaText) {
    return {
      ok: false,
      status: 422,
      message:
        "Connected to Supabase, but its public schema has no tables; add a table (or pick a project that has data) and reconnect.",
    };
  }

  // c. Mint the dbId. Slug from the caller's name, else the project ref.
  const slug = makeSlug(args.name ?? args.projectRef);
  const dbId = await mintUniqueDbId(deps.d1, slug, deps.randomSuffix);
  if (!dbId) {
    return {
      ok: false,
      status: 502,
      message: "Could not allocate a database id; retry in a moment.",
    };
  }

  // d. Register the `databases` row. No sealed DSN — the mgmt sentinel in
  //    `connection_blob` routes query-time to the HTTPS transport; the token
  //    lives in `db_oauth_grants` (step e). `connection_secret_ref` keeps the
  //    NOT NULL column satisfied with the BYO sentinel.
  await deps.d1
    .prepare(
      "INSERT INTO databases " +
        "(id, tenant_id, engine, connection_secret_ref, connection_blob, schema_hash, schema_text, synthetic, created_at, updated_at, last_queried_at) " +
        "VALUES (?, ?, 'postgres', ?, ?, ?, ?, ?, unixepoch(), unixepoch(), unixepoch())",
    )
    .bind(
      dbId,
      args.tenantId,
      BYO_SECRET_REF_SENTINEL,
      SUPABASE_MGMT_BLOB_SENTINEL,
      rendered.schemaHash,
      rendered.schemaText,
      args.synthetic ? 1 : 0,
    )
    .run();

  // e. Seal the OAuth token and write the grant row (FK → databases.id, so it
  //    must follow step d). AAD `dboauth:<dbId>` (never `dbconn:` — that's the
  //    DSN context, `GLOBAL-031`).
  const secret: SupabaseGrantSecret = {
    accessToken: args.accessToken,
    refreshToken: args.refreshToken,
    expiresAt: args.expiresAt,
  };
  const tokenBlob = await sealSecret(JSON.stringify(secret), {
    kek: deps.kek,
    context: `dboauth:${dbId}`,
  });
  await deps.d1
    .prepare(
      "INSERT INTO db_oauth_grants (db_id, provider, token_blob, provider_project, created_at) " +
        "VALUES (?, 'supabase', ?, ?, unixepoch())",
    )
    .bind(dbId, tokenBlob, args.projectRef)
    .run();

  // f. Mint a pk_live_ key for the copy-snippet CTA. Failure is non-fatal — the
  //    DB is already committed and queryable.
  const pkLive = deps.mintPkLive
    ? await deps.mintPkLive(dbId, args.tenantId).catch(() => null)
    : null;

  return {
    ok: true,
    dbId,
    name: args.name ?? slug,
    engine: "postgres",
    schemaPreview: rendered.schemaText.slice(0, SCHEMA_PREVIEW_LIMIT),
    pkLive,
  };
}
