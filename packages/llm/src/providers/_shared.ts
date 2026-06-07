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

// SK-LLM-030 — parse a 429's `Retry-After` into milliseconds. RFC 9110
// §10.2.3 permits two forms: delta-seconds (`"30"`) or an HTTP-date
// (`"Wed, 21 Oct 2015 07:28:00 GMT"`). Returns undefined when the header
// is absent or unparseable so the router falls back to its default
// cooldown rather than trusting a bogus value; a past date clamps to 0.
export function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get("retry-after")?.trim();
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const whenMs = Date.parse(raw);
  if (Number.isNaN(whenMs)) return undefined;
  return Math.max(0, whenMs - Date.now());
}

// SK-LLM-030 — the single HTTP-status → FailoverReason mapping point.
// A 429 is an unambiguous "back off now": it maps to `rate_limited` and
// carries the server's `Retry-After` window so the router can open the
// breaker for exactly that long. Every other non-2xx falls back to the
// 5xx/4xx split. `label` is the caller's `POST <url>` prefix so the
// message stays self-describing; the body is read once (best-effort).
// Every provider routes its `!res.ok` branch through here, so all six
// inherit rate-limit handling by construction — no per-provider logic.
export async function httpError(label: string, res: Response): Promise<ProviderError> {
  const message = `${label} → ${res.status}: ${await readBodySafe(res)}`;
  if (res.status === 429) {
    return new ProviderError(message, "rate_limited", {
      status: 429,
      retryAfterMs: parseRetryAfter(res.headers),
    });
  }
  return new ProviderError(message, httpReason(res.status), { status: res.status });
}
