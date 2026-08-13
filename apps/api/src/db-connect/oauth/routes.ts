// Supabase OAuth connect handshake routes (`SK-DBCONN-003`). A credential-
// acquisition front-end to the one connect pipeline: the callback resolves an
// OAuth grant to a project + token and calls `connectSupabaseMgmt` in-process
// (no second data verb — RFC 9700 handshake helpers, like `nlq login`).
//
//   GET  /v1/db/connect/oauth/supabase/start     (requirePrincipal)
//   GET  /v1/db/connect/oauth/supabase/callback  (trusts the KV `state`)
//   GET  /v1/db/connect/oauth/supabase/projects   (requirePrincipal) — picker
//   POST /v1/db/connect/oauth/supabase/select      (requirePrincipal) — picker
//
// Multi-project accounts get a picker: the callback stashes the sealed token in
// KV under a short-lived `pick` id and bounces to `/app/connect?pick=…`; the
// page lists projects (`/projects`) and posts the chosen ref (`/select`). Never
// silently default to the first project — connecting the wrong production DB is
// the worst possible first impression (ux-design.md).

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { RequireSessionVariables } from "../../middleware.ts";
import {
  accountTenantIdFromPrincipal,
  canConnectDatabase,
  type RequirePrincipalVariables,
} from "../../principal.ts";
import { kekFromEnv, openSecret, sealSecret } from "../../secret-envelope.ts";
import { buildConnectSupabaseMgmtDeps } from "../build-deps.ts";
import { connectSupabaseMgmt } from "../connect-supabase-mgmt.ts";
import { codeChallengeS256, generateCodeVerifier, generateState } from "./pkce.ts";
import {
  buildAuthorizeUrl,
  exchangeCode,
  type SupabaseOAuthClient,
  type SupabaseTokens,
} from "./supabase-oauth.ts";
import { listSupabaseProjects } from "./supabase-projects.ts";

// The connect handshake context — matches the app's `AppEnv` (Cloudflare
// bindings + the session/principal variables), so a route handler registered on
// the app types cleanly. `principal` is set by `requirePrincipal`; it is absent
// on the public `/callback`, which reads its tenant from the KV `state` instead.
type ConnectCtx = Context<{
  Bindings: Cloudflare.Env;
  Variables: RequireSessionVariables & RequirePrincipalVariables;
}>;

const KV_STATE_PREFIX = "oauth_connect:";
const KV_PICK_PREFIX = "oauth_pick:";
const HANDSHAKE_TTL_SEC = 600;

// The one exact redirect URI, derived from the request origin (registered on
// the OAuth app for both app.nlqdb.com and localhost dev). Compared exact-match
// by the provider; `/start` and `/callback` must build it identically.
function redirectUri(c: ConnectCtx): string {
  return `${new URL(c.req.url).origin}/v1/db/connect/oauth/supabase/callback`;
}

function oauthClient(c: ConnectCtx): SupabaseOAuthClient | null {
  const clientId = c.env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = c.env.SUPABASE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

// Same-origin bounce back to the connect page with a one-key status. The
// trailing slash is load-bearing: `trailingSlash: "always"` 307-redirects a
// bare `/app/connect`, so omitting it adds a hop on every OAuth return.
function toConnect(c: ConnectCtx, params: Record<string, string>): Response {
  const qs = new URLSearchParams(params).toString();
  return c.redirect(`/app/connect/?${qs}`, 302);
}

// GET /start — begin the OAuth redirect. Account-only (requirePrincipal is
// applied at registration). Absent client ⇒ 503, same shape as the KEK gate.
export async function handleSupabaseStart(c: ConnectCtx): Promise<Response> {
  const principal = c.var.principal;
  const tenantId = accountTenantIdFromPrincipal(principal);
  if (!tenantId || !canConnectDatabase(principal)) {
    return c.json(
      {
        error: {
          status: "connect_requires_account" as const,
          message: "Connecting a database needs an account session or an sk_live key.",
        },
      },
      403,
    );
  }
  const client = oauthClient(c);
  if (!client) {
    return c.json(
      {
        error: {
          status: "oauth_not_configured" as const,
          message: "Supabase connect is not configured on this deployment; paste a URL instead.",
        },
      },
      503,
    );
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const challenge = await codeChallengeS256(codeVerifier);
  await c.env.KV.put(`${KV_STATE_PREFIX}${state}`, JSON.stringify({ tenantId, codeVerifier }), {
    expirationTtl: HANDSHAKE_TTL_SEC,
  });

  return c.redirect(
    buildAuthorizeUrl({
      clientId: client.clientId,
      redirectUri: redirectUri(c),
      state,
      codeChallenge: challenge,
    }),
    302,
  );
}

// GET /callback — exchange the code, then connect (single project) or bounce to
// the picker (multiple). Authorizes via the one-time KV `state`, not a session
// (a redirect can lose the cookie), so the tenant comes from the stored state.
export async function handleSupabaseCallback(c: ConnectCtx): Promise<Response> {
  const providerError = c.req.query("error");
  if (providerError) {
    // access_denied etc. — the user declined on Supabase's screen.
    return toConnect(c, { error: "denied" });
  }
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return toConnect(c, { error: "invalid" });

  const stateKey = `${KV_STATE_PREFIX}${state}`;
  const stored = await c.env.KV.get(stateKey);
  if (!stored) return toConnect(c, { error: "expired" });
  await c.env.KV.delete(stateKey); // one-time use
  const { tenantId, codeVerifier } = JSON.parse(stored) as {
    tenantId: string;
    codeVerifier: string;
  };

  const client = oauthClient(c);
  if (!client) return toConnect(c, { error: "unconfigured" });

  let tokens: SupabaseTokens;
  try {
    tokens = await exchangeCode(client, { code, redirectUri: redirectUri(c), codeVerifier });
  } catch {
    return toConnect(c, { error: "exchange" });
  }

  let projects: Awaited<ReturnType<typeof listSupabaseProjects>>;
  try {
    projects = await listSupabaseProjects(tokens.accessToken);
  } catch {
    return toConnect(c, { error: "projects" });
  }
  if (projects.length === 0) return toConnect(c, { error: "no_projects" });

  // More than one project ⇒ picker. Stash the sealed token in KV and bounce.
  if (projects.length > 1) {
    const kek = kekFromEnv(c.env);
    if (!kek) return toConnect(c, { error: "unconfigured" });
    const pickId = generateState();
    const tokenBlob = await sealSecret(JSON.stringify(tokens), {
      kek,
      context: `oauthpick:${pickId}`,
    });
    await c.env.KV.put(`${KV_PICK_PREFIX}${pickId}`, JSON.stringify({ tenantId, tokenBlob }), {
      expirationTtl: HANDSHAKE_TTL_SEC,
    });
    return toConnect(c, { pick: pickId });
  }

  // Exactly one project — connect it straight through.
  const project = projects[0]!;
  const res = await connectSupabaseMgmt(buildConnectSupabaseMgmtDeps(c.env), {
    projectRef: project.ref,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    tenantId,
    name: project.name,
  });
  return res.ok ? toConnect(c, { connected: res.dbId }) : toConnect(c, { error: "introspection" });
}

// Load + verify a pick stash for the calling tenant, returning the opened token.
async function openPick(
  c: ConnectCtx,
  pickId: string,
  tenantId: string,
): Promise<SupabaseTokens | null> {
  const raw = await c.env.KV.get(`${KV_PICK_PREFIX}${pickId}`);
  if (!raw) return null;
  const { tenantId: owner, tokenBlob } = JSON.parse(raw) as {
    tenantId: string;
    tokenBlob: string;
  };
  if (owner !== tenantId) return null; // never serve another tenant's stash
  const kek = kekFromEnv(c.env);
  if (!kek) return null;
  return JSON.parse(await openSecret(tokenBlob, { kek, context: `oauthpick:${pickId}` }));
}

// GET /projects?pick=… — the picker's data source (account-only).
export async function handleSupabaseProjects(c: ConnectCtx): Promise<Response> {
  const principal = c.var.principal;
  const tenantId = accountTenantIdFromPrincipal(principal);
  if (!tenantId || !canConnectDatabase(principal)) {
    return c.json({ error: { status: "connect_requires_account" as const } }, 403);
  }
  const pickId = c.req.query("pick");
  if (!pickId) return c.json({ error: { status: "invalid_request" as const } }, 400);
  const tokens = await openPick(c, pickId, tenantId);
  if (!tokens) return c.json({ error: { status: "pick_expired" as const } }, 410);
  const projects = await listSupabaseProjects(tokens.accessToken);
  return c.json({ projects });
}

// POST /select {pick, ref, name?} — connect the chosen project (account-only).
export async function handleSupabaseSelect(c: ConnectCtx): Promise<Response> {
  const principal = c.var.principal;
  const tenantId = accountTenantIdFromPrincipal(principal);
  if (!tenantId || !canConnectDatabase(principal)) {
    return c.json({ error: { status: "connect_requires_account" as const } }, 403);
  }
  const body = (await c.req.json().catch(() => null)) as {
    pick?: string;
    ref?: string;
    name?: string;
  } | null;
  if (!body?.pick || !body?.ref) {
    return c.json({ error: { status: "invalid_request" as const } }, 400);
  }
  const tokens = await openPick(c, body.pick, tenantId);
  if (!tokens) return c.json({ error: { status: "pick_expired" as const } }, 410);

  const res = await connectSupabaseMgmt(buildConnectSupabaseMgmtDeps(c.env), {
    projectRef: body.ref,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    tenantId,
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined,
  });
  if (!res.ok)
    return c.json(
      { error: { status: "introspection_failed" as const, message: res.message } },
      res.status as ContentfulStatusCode,
    );
  await c.env.KV.delete(`${KV_PICK_PREFIX}${body.pick}`); // one-time
  return c.json({ db_id: res.dbId, name: res.name, schema_preview: res.schemaPreview });
}
