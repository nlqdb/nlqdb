// The connect-time validation pipeline for a user-supplied BYO connection —
// the fourth and composing member of the BYO connect-path primitive family,
// after the per-engine URL parsers (`SK-DB-012`, `SK-MULTIENG-006`), the
// egress guard (`GLOBAL-035`), and the DoH resolver (`doh-resolver.ts`). It is
// the single entry point both the BYO Postgres (`SK-DB-011`) and BYO ClickHouse
// (`SK-MULTIENG-005`) connect branches call before sealing
// (`GLOBAL-031`) and writing the D1 row, so the parse→guard ordering and its
// fail-loud contract live in one audited place rather than re-assembled per
// engine in the route handler.
//
// What it does, in order (the order is load-bearing):
//   1. Parse + validate the URL *shape* with the engine's parser. This is
//      pure and I/O-free, so a garbage paste fails here — before any network
//      I/O — with the parser's one-sentence next action (`GLOBAL-012`), and
//      its `host` is the only thing we then resolve.
//   2. Guard the parsed `host` against the SSRF/egress ranges, resolving a
//      DNS name through the injected resolver and re-guarding every returned
//      address (`guardEgressHostResolved`, `GLOBAL-035`). A literal
//      private/loopback/metadata host — or a name that resolves to one — is
//      rejected fail-closed before the connector ever touches it.
//
// What it deliberately does NOT do: seal the URL or write D1. Sealing is the
// `apps/api/src/secret-envelope.ts` boundary (`GLOBAL-031`, `GLOBAL-021`);
// keeping it out keeps this module pure + zero-dependency and lets it ship
// ahead of its `connect.ts` callers like the rest of the family. The caller
// seals `rawUrl` verbatim only after this returns `ok` — TLS / sslmode /
// settings query params still ride that sealed blob; the redacted form here is
// the only representation allowed on a span, log, CLI prompt, or SDK envelope.
//
// The DNS resolver is injected (not constructed here) so the module stays
// pure + zero-dep (`GLOBAL-013`, `GLOBAL-021`) and testable without network
// I/O; `connect.ts` supplies `createDohResolver()` (`doh-resolver.ts`).
import { type ParsedClickhouseUrl, parseClickhouseUrl } from "./clickhouse-connection-url.ts";
import { type ParsedConnectionUrl, parseConnectionUrl } from "./connection-url.ts";
import { type DnsResolver, guardEgressHostResolved } from "./egress-guard.ts";

// The two BYO engines that take a user-supplied connection URL. Managed
// Tinybird (`SK-MULTIENG-002`) is a different path and is not a value here.
export type ByoEngine = "postgres" | "clickhouse";

// Engine-tagged parsed connection, so a caller narrows on `engine` and reads
// the engine-specific shape (`secure` exists only for ClickHouse) without a
// cast. `parsed` is exactly what the per-engine parser returned — redacted
// display form plus the connect fields the introspection/adapter step needs.
export type ValidatedByoConnection =
  | { engine: "postgres"; parsed: ParsedConnectionUrl }
  | { engine: "clickhouse"; parsed: ParsedClickhouseUrl };

export type ValidateByoConnectionResult =
  | { ok: true; connection: ValidatedByoConnection }
  | { ok: false; message: string };

// Validate a BYO connection URL end to end: parse the shape, then guard the
// host (resolving + re-guarding a DNS name via `resolve`). Returns the
// engine-tagged parsed connection on success, or a single fail-loud message
// (`GLOBAL-012`) that never echoes the secret. Never throws — a resolver
// failure is folded into a fail-closed verdict by `guardEgressHostResolved`.
export async function validateByoConnection(
  engine: ByoEngine,
  rawUrl: string,
  resolve: DnsResolver,
): Promise<ValidateByoConnectionResult> {
  if (engine === "postgres") {
    const parsed = parseConnectionUrl(rawUrl);
    if (!parsed.ok) return parsed;
    const egress = await guardEgressHostResolved(parsed.parsed.host, resolve);
    if (!egress.ok) return egress;
    return { ok: true, connection: { engine, parsed: parsed.parsed } };
  }

  const parsed = parseClickhouseUrl(rawUrl);
  if (!parsed.ok) return parsed;
  const egress = await guardEgressHostResolved(parsed.parsed.host, resolve);
  if (!egress.ok) return egress;
  return { ok: true, connection: { engine, parsed: parsed.parsed } };
}
