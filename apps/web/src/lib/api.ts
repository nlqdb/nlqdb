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

export type CreateRow = Record<string, string | number | boolean | null>;

export interface CreateResult {
  kind: "create";
  db: string;
  schemaName: string;
  pkLive: string | null;
  // The full SchemaPlan ships back; we pass it through verbatim
  // since the consumer (CreateForm.tsx) only renders sample rows
  // for now. Future surfaces will render metrics + dimensions too
  // (SK-HDC-004).
  plan: unknown;
  sampleRows: { table: string; rows: CreateRow[] }[];
}

export type CreateError =
  | { kind: "challenge_required" }
  | { kind: "rate_limited"; retryAfter: number | null }
  | { kind: "auth_required"; signInUrl: string; window: "hour" | "day" | "month"; resetAt: number }
  | { kind: "unauthorized" }
  | { kind: "server_error"; status: number };

export type CreateOutcome = { ok: true; result: CreateResult } | { ok: false; error: CreateError };

interface AuthRequiredEnvelope {
  status: "auth_required";
  signInUrl: string;
  window: "hour" | "day" | "month";
  resetAt: number;
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

  const res = await fetch(`${apiBase.replace(/\/$/, "")}/v1/ask`, {
    method: "POST",
    headers,
    // dbId omitted on purpose — the kind=create classifier branch
    // routes the typed-plan pipeline (SK-HDC-001).
    body: JSON.stringify({ goal }),
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
            window: env.window,
            resetAt: env.resetAt,
          },
        };
      }
    } catch {
      // body wasn't json — fall through to bare unauthorized.
    }
    return { ok: false, error: { kind: "unauthorized" } };
  }
  if (!res.ok) return { ok: false, error: { kind: "server_error", status: res.status } };

  const body = (await res.json()) as CreateResult;
  return { ok: true, result: body };
}
