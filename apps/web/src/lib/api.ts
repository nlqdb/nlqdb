// Tiny `/v1/ask` client used by both the marketing hero and
// `/app/new` (SK-WEB-008 collapsed them onto the same flow).
//
// Always anon-bearer authenticated, goal-only body, returns the
// typed-plan create result (SK-HDC-001) on success. Carries the
// auth_required envelope (SK-ANON-010) for the global-cap soft-
// promotion to sign-in.
//
// Why a hand-rolled client and not `@nlqdb/sdk`: the SDK's surface
// is shaped for `pk_live_<key>` query traffic (the `<nlq-data>`
// element's primary use case — packages/elements/src/fetch.ts). The
// anon-create flow is a one-shot the SDK doesn't model yet; landing
// it in the SDK is its own slice. This helper is the minimum needed
// to wire CreateForm.tsx end-to-end.

import { getOrMintAnonToken } from "./anon";
import { firstTouchSource } from "./attribution";

export type CreateRow = Record<string, string | number | boolean | null>;

export interface CreateResult {
  kind: "create";
  db: string;
  // Human-readable name (e.g. `orders tracker`) the API derives from
  // `db` server-side. Surfaces render this; `db` and `schemaName`
  // stay for technical contexts (trace expander, copy-snippet).
  displayName: string;
  schemaName: string;
  pkLive: string | null;
  // The SchemaPlan summary ships back. `tables` is the provisioned table
  // list (schema source of truth) — CreateResultView renders the table
  // count + one preview per table from it, never from the seed set (which
  // SK-HDC-018/019 may leave partial or empty). Metrics/dimensions are
  // carried for future surfaces (SK-HDC-004).
  plan: {
    tables?: string[];
    metrics?: unknown;
    dimensions?: unknown;
    foreign_keys?: unknown;
  };
  // Matches `SampleRow` in `packages/db/src/types.ts` — one row per
  // entry, with `values` carrying the column → scalar map. The UI
  // groups by table at render time.
  sampleRows: { table: string; values: CreateRow }[];
  // SK-TRUST-002 — always present; `sql` carries the compiled DDL
  // that provisioned the schema. CreateResultView renders it as the
  // collapsed-by-default trace pane (SK-WEB-005 / GLOBAL-023).
  trace: {
    sql: string;
    plan_id: string;
    confidence: number;
    model: string;
    cache_hit: boolean;
  };
}

export type CreateError =
  | { kind: "challenge_required" }
  | { kind: "rate_limited"; retryAfter: number | null }
  | {
      kind: "auth_required";
      signInUrl: string;
      // `window` and `resetAt` are present on the SK-ANON-010 global
      // cap envelope but absent on the SK-ANON-012 per-device cap
      // (the device cap is permanent until adoption — there's no
      // window to wait out). Surfaces only consume `signInUrl`.
      window?: "hour" | "day" | "month";
      resetAt?: number;
    }
  | { kind: "unauthorized" }
  | { kind: "goal_unclear" }
  | { kind: "server_error"; status: number };

export type CreateOutcome = { ok: true; result: CreateResult } | { ok: false; error: CreateError };

interface AuthRequiredEnvelope {
  status: "auth_required";
  signInUrl: string;
  window?: "hour" | "day" | "month";
  resetAt?: number;
}

export async function postAskCreate(
  apiBase: string,
  goal: string,
  options: { turnstileToken?: string | null } = {},
): Promise<CreateOutcome> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${getOrMintAnonToken()}`,
  };
  if (options.turnstileToken) {
    headers["cf-turnstile-response"] = options.turnstileToken;
  }
  const source = firstTouchSource();

  const res = await fetch(`${apiBase.replace(/\/$/, "")}/v1/ask`, {
    method: "POST",
    headers,
    // `credentials: "omit"` is load-bearing: the hero is contractually
    // the anon-first surface (SK-ANON-001). When the hero is served
    // same-origin with the API, the default `same-origin` policy
    // would ride the `__Secure-better-auth.session_token` cookie on
    // every POST — and `requirePrincipal` (SK-ANON-008) gives the
    // cookie precedence over the anon bearer, so a signed-in user
    // submitting from the hero would resolve as their authed self
    // and never hit the SK-ANON-012 device cap. Dropping the cookie
    // forces the request to run as anon unconditionally, which is
    // what the device-cap → sign-in handoff requires.
    credentials: "omit",
    // dbId omitted on purpose — the kind=create classifier branch
    // routes the typed-plan pipeline (SK-HDC-001). `source` is the
    // SK-GTM-007 first-touch attribution — telemetry the server
    // sanitizes-or-drops, never a reason for a create to fail.
    body: JSON.stringify({ goal, ...(source ? { source } : {}) }),
  });

  if (res.status === 428) return { ok: false, error: { kind: "challenge_required" } };
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after"));
    return {
      ok: false,
      error: {
        kind: "rate_limited",
        retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      },
    };
  }
  if (res.status === 401) {
    // The 401 carries TWO shapes: the global-anon-cap envelope
    // (SK-ANON-010, soft auth-redirect) and the bare `unauthorized`
    // shape (cookie revoked / malformed bearer). Distinguish by
    // body. The cap envelope drives the prompt-stash + redirect
    // flow in CreateForm.tsx; bare unauthorized is a hard error.
    try {
      const body = (await res.json()) as { error?: AuthRequiredEnvelope | { status?: string } };
      if (body.error && "status" in body.error && body.error.status === "auth_required") {
        const env = body.error as AuthRequiredEnvelope;
        return {
          ok: false,
          error: {
            kind: "auth_required",
            signInUrl: env.signInUrl,
            ...(env.window !== undefined ? { window: env.window } : {}),
            ...(env.resetAt !== undefined ? { resetAt: env.resetAt } : {}),
          },
        };
      }
    } catch {
      // body wasn't json — fall through to bare unauthorized.
    }
    return { ok: false, error: { kind: "unauthorized" } };
  }
  if (res.status === 422) {
    // The create pipeline reports an unusable goal as `422
    // infer_failed` (SK-HDC): the inferred plan was too shallow
    // (`ambiguous_goal`) or failed validation (`plan_invalid`).
    // Retrying the identical goal fails the same way, so surface the
    // "describe what you want to build" copy — not the transient "try
    // again" of `server_error`. Other 422 kinds (transient
    // `llm_failed`, compile/ddl/embed_failed) fall through below.
    try {
      const body = (await res.json()) as { error?: { kind?: string; reason?: string } };
      if (
        body.error?.kind === "infer_failed" &&
        (body.error.reason === "ambiguous_goal" || body.error.reason === "plan_invalid")
      ) {
        return { ok: false, error: { kind: "goal_unclear" } };
      }
    } catch {
      // body wasn't json — fall through to server_error.
    }
  }
  if (!res.ok) return { ok: false, error: { kind: "server_error", status: res.status } };

  const body = (await res.json()) as CreateResult;
  return { ok: true, result: body };
}
