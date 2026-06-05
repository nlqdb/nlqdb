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
    // SK-LLM-025 — reasoning models at the chain head (gpt-oss-120b)
    // leak preamble/think-text around the JSON even under
    // response_format, so recover the first balanced object before
    // giving up. Strictly additive: it only runs after strict parse
    // already threw, so it can't regress the happy path.
    const recovered = firstBalancedObject(stripped);
    if (recovered) {
      try {
        return JSON.parse(recovered) as T;
      } catch {
        // fall through — recovered span wasn't valid JSON either.
      }
    }
    throw new ProviderError(`response not parseable JSON: ${truncate(raw, 200)}`, "parse");
  }
}

// Return the first brace-balanced `{…}` span, or null. String-aware so
// braces inside string literals don't unbalance the scan.
function firstBalancedObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
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
