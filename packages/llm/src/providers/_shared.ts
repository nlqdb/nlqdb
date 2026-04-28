// Cross-provider helpers. Anything that's not specific to a single
// wire format (OpenAI vs Gemini vs Workers-AI) belongs here so the
// per-provider files stay tiny.

import { redactPii } from "@nlqdb/otel";
import { ProviderError } from "../types.ts";

// Strict JSON parser used by classify/plan responses. Tolerates the
// common-but-annoying ```json fences some models emit despite
// response-format being set in the request.
export function parseJsonResponse<T>(raw: string): T {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new ProviderError(`response not parseable JSON: ${truncate(raw, 200)}`, "parse");
  }
}

// Cap strings before they end up in error messages or logs. Keeps
// transcripts readable without dropping the head of the failure.
export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// Best-effort body read for error messages. Body may already be
// consumed or unreadable — we don't want secondary throws masking the
// original HTTP error, so failures here become a placeholder.
//
// Provider error bodies sometimes echo the request prompt (or other
// caller-supplied content); pipe through `redactPii` before truncate
// so PII doesn't surface in span exception messages or `wrangler tail`
// logs.
export async function readBodySafe(res: Response, max = 200): Promise<string> {
  try {
    const text = await res.text();
    // Keep redactPii inside the try — defense in depth. The patterns
    // are simple and shouldn't throw, but a regex-engine bug or future
    // pattern edit shouldn't surface as an unrelated "unreadable body"
    // either; if redactPii throws we still want a sane fallback.
    return truncate(redactPii(text), max);
  } catch {
    return "<unreadable body>";
  }
}

export function httpReason(status: number): "http_5xx" | "http_4xx" {
  return status >= 500 ? "http_5xx" : "http_4xx";
}
