// Pure parse / validate / redact for a user-supplied Postgres connection
// URL — the wire-boundary primitive the BYO Postgres connect path
// (`SK-DB-011`, `architecture.md §3.6.7`) is built on, and the parallel of
// `apps/api/src/secret-envelope.ts`: a pure, dependency-free primitive that
// ships ahead of its callers. `packages/db/` is the canonical owner of
// Postgres (`GLOBAL-021`), so the connection-string shape lives here rather
// than re-implemented inside the route handler.
//
// Contract (`SK-DB-012`):
//   - validate at the wire boundary and fail loud with a one-sentence next
//     action (`GLOBAL-012`) before the URL is handed to the driver or
//     sealed (`GLOBAL-031`) — a clear 400 beats an opaque driver error;
//   - the password never appears in the redacted form, and neither does the
//     query string (libpq URIs may carry `password=` / `sslpassword=` /
//     `sslkey=` there). The redacted form is the only one that may reach a
//     span, log, CLI prompt, or SDK response envelope (§3.6.7). The sealed
//     blob keeps the full original URL, so TLS / sslmode params still apply
//     at connect time.
// Zero new deps: WHATWG `URL` only, so it stays weightless in the Workers
// free-tier bundle (`GLOBAL-013`).

const POSTGRES_SCHEMES = new Set(["postgres:", "postgresql:"]);

const SHAPE_HINT = "postgres://user:password@host:port/database";

export type ParsedConnectionUrl = {
  // Password- and query-stripped display form: `postgres://user@host:port/db`.
  // Safe to log, attach to a span, and echo back to the user.
  redacted: string;
  host: string;
  port: number | null;
  database: string;
  user: string | null;
};

export type ParseConnectionUrlResult =
  | { ok: true; parsed: ParsedConnectionUrl }
  | { ok: false; message: string };

// Parse + validate a Postgres connection URL. Pure + I/O-free. Accepts the
// standard `postgres://` / `postgresql://` libpq URI (a superset stays
// permissive: an absent port, an absent user, query params, and IPv6 hosts
// all pass) and rejects only what a driver could not use — so a malformed
// paste fails here, loudly, instead of as an opaque connect-time error.
export function parseConnectionUrl(raw: string): ParseConnectionUrlResult {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, message: "Connection URL is empty; pass a postgres:// connection string." };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: `Connection URL is malformed; use ${SHAPE_HINT}.` };
  }

  if (!POSTGRES_SCHEMES.has(url.protocol)) {
    // `url.protocol` is normalised and credential-free, so echoing it is safe.
    const scheme = url.protocol.replace(/:$/, "");
    return {
      ok: false,
      message: `Connection URL scheme "${scheme}" is unsupported; use postgres:// or postgresql://.`,
    };
  }
  if (url.hostname === "") {
    return { ok: false, message: `Connection URL is missing a host; use ${SHAPE_HINT}.` };
  }
  // libpq allows a comma-separated host list for failover; WHATWG `URL`
  // keeps the comma in `hostname`, which no driver would accept. Reject it
  // deterministically rather than seal a host string that can't connect —
  // multi-host BYO is a later slice, a deliberate departure per `SK-DB-012`.
  if (url.hostname.includes(",")) {
    return {
      ok: false,
      message: `Connection URL has more than one host, which isn't supported yet; pass a single host (${SHAPE_HINT}).`,
    };
  }

  // A libpq URI carries exactly one path segment — the database name.
  const database = url.pathname.replace(/^\//, "");
  if (database === "") {
    return {
      ok: false,
      message: "Connection URL is missing a database name; append it as postgres://…/database.",
    };
  }
  if (database.includes("/")) {
    return {
      ok: false,
      message: `Connection URL path must be just the database name, not a multi-segment path; use ${SHAPE_HINT}.`,
    };
  }

  const user = url.username === "" ? null : url.username;
  const port = url.port === "" ? null : Number(url.port);
  // `url.host` is `hostname[:port]`, already formatted for IPv6 (`[::1]:5432`).
  const redacted = `${url.protocol}//${user ? `${user}@` : ""}${url.host}/${database}`;

  return { ok: true, parsed: { redacted, host: url.hostname, port, database, user } };
}

// Sentinel returned by `redactConnectionUrl` when the input can't be parsed
// — it is a fixed string, never the raw input, so an unparseable value that
// still embeds a secret can't leak through a log line.
export const UNPARSEABLE_CONNECTION_URL = "<unparseable connection URL>";

// Best-effort redaction for log / error paths: the password- and
// query-stripped display form, or the sentinel above on a parse failure.
// Never throws and never echoes the raw input.
export function redactConnectionUrl(raw: string): string {
  const result = parseConnectionUrl(raw);
  return result.ok ? result.parsed.redacted : UNPARSEABLE_CONNECTION_URL;
}
