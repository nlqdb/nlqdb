# ClickHouse via Tinybird adapter

The second engine — ClickHouse fronted by [Tinybird](https://www.tinybird.co)
Free Forever (10 GB storage, 1 k reads/day, no card). Pre-read
[`docs/features/multi-engine-adapter/FEATURE.md`](../../../../docs/features/multi-engine-adapter/FEATURE.md)
before editing — `SK-MULTIENG-001..004` are the canonical decisions.

## Construction

```ts
import { createTinybirdAdapter } from "@nlqdb/db";

const db = createTinybirdAdapter({
  token: env.TINYBIRD_TOKEN,            // PIPE:READ scope token
  workspace: "ws_acme",                 // surfaces as db.namespace on the span
  allowlist: {
    pipes: ["events_per_day", "users_overview"],
    tables: ["events", "users"],
  },
  // Optional: override the API base — defaults to `https://api.tinybird.co`.
  apiBase: "https://api.us-east.tinybird.co",
});
```

`token` and `workspace` are required for the production HTTP client.
Tests inject the wire layer directly via `httpClient`:

```ts
const db = createTinybirdAdapter({
  workspace: "ws_test",
  allowlist: { pipes: ["p"], tables: ["t"] },
  httpClient: async (req) => ({ data: [], rows: 0, /* … */ }),
});
```

## Two call shapes

```ts
// 1) Published Pipe — query string parameters bind to the pipe's
//    templated SQL. The SQL lives server-side, so `db.query.text` is
//    deliberately *not* set on the span.
await db.execute({
  engine: "clickhouse",
  pipe: "events_per_day",
  params: { from: "2026-01-01", limit: 30 },
});

// 2) Raw SQL — GLOBAL-015 escape hatch. The validator gates
//    leading verb (SELECT/WITH only) and table references against the
//    allowlist before the request goes out.
await db.execute({
  engine: "clickhouse",
  sql: "SELECT count(*) FROM events",
});
```

A plan with both `pipe` and `sql` (or neither) is rejected at the
adapter boundary — the call shape must be unambiguous.

## OTel attributes (`SK-MULTIENG-004`)

| Attribute | Pipe call | Raw SQL |
|---|---|---|
| `db.system` | `other_sql` | `other_sql` |
| `db.namespace` | workspace | workspace |
| `db.operation.name` | `PIPE_CALL` | first SQL keyword |
| `db.tinybird.pipe` | pipe name | — |
| `db.query.text` | — | the SQL |
| `db.tinybird.query_id` | server-assigned | server-assigned |

Latency lands on `nlqdb.db.duration_ms{operation}` — same histogram
the PG adapter feeds — so dashboards aggregate cleanly across engines.

## Validator (`packages/db/src/clickhouse-tinybird/validator.ts`)

Two modes mirror the call shape:

- **Pipe** — name must be in `allowlist.pipes`. Cross-prefix attempts
  (a name not in your allowlist that contains `__`) are flagged
  separately as `cross_prefix_reference` for tenant-isolation alerting.
- **Raw SQL** — leading verb must be `SELECT` or `WITH`; the AST is
  parsed with `node-sql-parser`'s MySQL dialect (closest fit; ClickHouse
  doesn't have its own dialect there yet). Every referenced table must
  be in `allowlist.tables`. CTE aliases are recognised and excluded from
  the allowlist check.

Parse failures reject — never fall through. Same posture as
`apps/api/src/ask/sql-validate.ts` per `SK-SQLAL-005`.

## Anon-mode posture

**Sign-in-only at launch** per `SK-MULTIENG-004`. The global anon
rate-limit deflects anon traffic away from this adapter; per-prefix
isolation that would unlock `GLOBAL-007` parity is a follow-up SK
block, not part of the W2 launch slice.

## What this adapter does not do

- **Pipe creation / DDL** — owned by the workload analyser (W5).
  This adapter is read-only at launch.
- **db.create wiring** — owned by W3.
- **Anon-mode** — sign-in only at launch (see above).
- **`/v0/sql` POST streaming** — buffered today; `format=ndjson` is a
  future optimisation behind the same `AsyncIterable<Row>` contract
  (`SK-MULTIENG-001`).

## References

- [`docs/features/multi-engine-adapter/FEATURE.md`](../../../../docs/features/multi-engine-adapter/FEATURE.md) — `SK-MULTIENG-001..004`
- [`docs/features/db-adapter/FEATURE.md`](../../../../docs/features/db-adapter/FEATURE.md) — `SK-DB-009/010` shared contract
- [`docs/decisions/GLOBAL-014-otel-on-external-calls.md`](../../../../docs/decisions/GLOBAL-014-otel-on-external-calls.md)
- [`docs/decisions/GLOBAL-015-power-user-escape-hatch.md`](../../../../docs/decisions/GLOBAL-015-power-user-escape-hatch.md)
- [`docs/decisions/GLOBAL-021-external-system-ownership.md`](../../../../docs/decisions/GLOBAL-021-external-system-ownership.md)
- [Tinybird Pipes API](https://www.tinybird.co/docs/api-reference/pipe-api)
- [Tinybird Query API](https://www.tinybird.co/docs/api-reference/query-api)
