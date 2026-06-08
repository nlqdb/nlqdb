// The production `DnsResolver` for the BYO connect-time egress guard
// (`GLOBAL-035`): a DNS-over-HTTPS lookup that `guardEgressHostResolved`
// (`egress-guard.ts`) calls to resolve a `needsDnsRecheck` host and re-guard
// every returned address. Workers has no `dns` module, so the resolve is an
// HTTPS request to a public DoH resolver; `egress-guard.ts` stays pure +
// zero-dep by taking this as an injected `DnsResolver`, and this module ships
// ahead of its `connect.ts` callers like the rest of the BYO connect-path
// primitive family (`SK-DB-012`, `SK-MULTIENG-006`, `GLOBAL-031`).
//
// Contract it must honour (`egress-guard.ts` header): return every resolved
// address (A + AAAA) as a bare textual IP — never a name — so the synchronous
// guard can re-classify each one. CNAME / other answer types are dropped here
// (their `data` is a name, which the guard fails closed on anyway); a CNAME
// chain still yields the final A/AAAA records the resolver flattens into the
// same `Answer` array. It must fail loud (`GLOBAL-012`): any transport error,
// non-2xx, malformed body, or timeout throws, which `guardEgressHostResolved`
// turns into a fail-closed "could not be resolved" verdict.
import { SpanStatusCode, trace } from "@opentelemetry/api";

import type { DnsResolver } from "./egress-guard.ts";

// IANA DNS record type codes — the only two that carry a connectable IP in
// their `data` field. https://www.iana.org/assignments/dns-parameters/
const TYPE_A = 1;
const TYPE_AAAA = 28;

// Cloudflare's DoH JSON endpoint (Google-schema compatible, no auth, no card).
// https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/
const DEFAULT_ENDPOINT = "https://cloudflare-dns.com/dns-query";

// A DoH lookup that hangs would stall the whole connect handshake, so bound it.
const DEFAULT_TIMEOUT_MS = 5_000;

export type DohResolverOptions = {
  // Injected for tests; production uses the global Workers `fetch`.
  fetchImpl?: typeof fetch;
  // Override the DoH endpoint (e.g. a self-hosted resolver). Default 1.1.1.1.
  endpoint?: string;
  // Per-query abort deadline; the whole resolve fails closed if either leg trips it.
  timeoutMs?: number;
};

// Build the production DoH-backed `DnsResolver`. No shared state — matches the
// per-request, no-pool shape of the other `packages/db` HTTP clients.
export function createDohResolver(opts: DohResolverOptions = {}): DnsResolver {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const endpoint = (opts.endpoint ?? DEFAULT_ENDPOINT).replace(/\/$/, "");
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const serverAddress = hostOf(endpoint);

  return (hostname: string): Promise<string[]> => {
    const tracer = trace.getTracer("@nlqdb/db");
    // One span per logical resolution — both A + AAAA legs nest under it — so a
    // BYO connect emits a single, non-spammy `dns.resolve` (GLOBAL-014) rather
    // than two per host. Connect-path only, never the /v1/ask hot path.
    return tracer.startActiveSpan(
      "dns.resolve",
      { attributes: { "server.address": serverAddress, "dns.question.name": hostname } },
      async (span) => {
        try {
          // A + AAAA in parallel; either leg throwing fails the whole resolve
          // closed, which is the safe bias for a security control.
          const [a, aaaa] = await Promise.all([
            queryType(fetchImpl, endpoint, hostname, TYPE_A, timeoutMs),
            queryType(fetchImpl, endpoint, hostname, TYPE_AAAA, timeoutMs),
          ]);
          const addresses = [...new Set([...a, ...aaaa])];
          span.setAttribute("dns.answer.count", addresses.length);
          return addresses;
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  };
}

// One DoH JSON query for a single record type, returning the bare IP strings
// from its `Answer` entries of that type. Throws (fail-loud) on transport
// error, non-2xx, timeout, or an unparseable body.
async function queryType(
  fetchImpl: typeof fetch,
  endpoint: string,
  hostname: string,
  type: number,
  timeoutMs: number,
): Promise<string[]> {
  const url = `${endpoint}?name=${encodeURIComponent(hostname)}&type=${type}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`DoH lookup failed: HTTP ${res.status}`);
    }
    // Parse inside the abort window: a slow-streaming body must count against
    // the same deadline as the headers, or the timeout can't fire on it.
    const body = (await res.json()) as { Answer?: unknown };
    // `Status` (NXDOMAIN/SERVFAIL/…) is deliberately ignored — it can only
    // ever shrink the address set the caller re-guards, never widen it.
    return extractAddresses(body, type);
  } finally {
    clearTimeout(timer);
  }
}

// Pull the `data` of every `Answer` entry matching the queried type. Defensive
// against a resolver that returns extra answer types (CNAME, etc.): only the
// requested type's records are kept, and each must be a non-empty string.
function extractAddresses(body: { Answer?: unknown }, type: number): string[] {
  if (!Array.isArray(body.Answer)) return [];
  const out: string[] = [];
  for (const entry of body.Answer) {
    if (entry && typeof entry === "object") {
      const rec = entry as Record<string, unknown>;
      if (rec["type"] === type && typeof rec["data"] === "string" && rec["data"] !== "") {
        out.push(rec["data"]);
      }
    }
  }
  return out;
}

// The endpoint host for the `server.address` span attribute; never throws.
function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}
