// The one place an API error becomes a response (SK-ERR-001).
//
// Every non-2xx body is `{ error: { code, message, action, retryable, params? } }`,
// rendered from the `@nlqdb/errors` registry. Handlers name a code and hand over
// the cause; they never write user-facing copy inline, and they no longer keep a
// hand-maintained code → HTTP-status switch (the registry owns that too, so the
// two can't drift).

import { type ErrorCode, isErrorCode, type ParamsFor, renderError } from "@nlqdb/errors";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

// What the ask / run / remember orchestrators return: a registry code plus the
// params that code declares. Typed loosely on purpose — each pipeline's own
// union (`AskError`, `RunError`, …) is the precise contract; this is the
// boundary that renders whatever they produced.
export type PipelineError = { code: ErrorCode } & Record<string, unknown>;

export function errorEnvelope(error: PipelineError): {
  body: { error: ReturnType<typeof renderError> };
  httpStatus: ContentfulStatusCode;
} {
  const { code, ...params } = error;
  const { httpStatus, recoverability: _r, ...wire } = renderError(code, params);
  return {
    body: { error: wire as ReturnType<typeof renderError> },
    httpStatus: httpStatus as ContentfulStatusCode,
  };
}

// Render one error straight to a Hono response. Set any headers the code needs
// (X-RateLimit-*, Retry-After) on `c` before calling.
export function errorResponse(c: Context, error: PipelineError): Response {
  const { body, httpStatus } = errorEnvelope(error);
  return c.json(body, httpStatus);
}

// For call sites that only have a code (parse failures, guards).
export function fail<C extends ErrorCode>(
  c: Context,
  code: C,
  params?: Partial<ParamsFor<C>>,
): Response {
  return errorResponse(c, { code, ...(params ?? {}) } as PipelineError);
}

// A code that reached us as a plain string (a sub-orchestrator's `reason`, a
// legacy branch). Renders it when the registry knows it, else `internal_error`
// — never a bare slug with no copy, which is how "Something went wrong"
// used to reach users.
export function failUnknown(c: Context, code: string): Response {
  return errorResponse(c, { code: isErrorCode(code) ? code : "internal_error" });
}
