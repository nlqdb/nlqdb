# @nlqdb/sdk

Typed HTTP client wrapping the nlqdb `/v1/*` API. Tiny, zero-dep,
runtime-agnostic — only depends on global `fetch` (browsers, Node ≥
18, Bun, Cloudflare Workers).

Phase 0 — first consumer is `apps/web`; second is `packages/elements`.
Published to npm as `@nlqdb/sdk` (docs/architecture.md §5.1).

## Install

```sh
bun add @nlqdb/sdk
# or: npm i @nlqdb/sdk
```

## Auth

Two mutually-exclusive modes — pick one:

```ts
// Server-side (Node, Bun, Workers): pass a bearer key.
const server = createClient({ apiKey: process.env.NLQDB_API_KEY! });

// Browser: ride the session cookie. NEVER pass `apiKey` from a
// browser bundle — server-side keys are not safe to ship to clients.
const browser = createClient({ withCredentials: true });
```

Passing both is a runtime error. The discriminated-union types
enforce this at compile time too; the runtime guard catches `as any`
escapes and JS callers.

## BYOLLM — route asks through your own provider key

Bring your own LLM key and `ask()` / `askStream()` dispatch through it
at 0% markup (`SK-SDK-010`):

```ts
const client = createClient({
  withCredentials: true, // signed-in only — never a bearer or anonymous call
  byollm: { provider: "anthropic", model: "claude-sonnet-4-6", key: "sk-ant-…" },
});
```

`provider` is one of `openai` / `anthropic` / `google-ai-studio`. The
key is sent only on `/v1/ask`, never on other endpoints. `createClient`
throws if `byollm` is paired with `apiKey` (the API rejects the lane on
bearer keys), if any part is empty or holds a control character, or if
`provider` / `model` contain a `:` (the key may — it is the unsplit
remainder).

Prefer to **store** the key once instead of passing it on every call?
The account-stored verbs persist one credential server-side (sealed at
rest) so every later session dispatches through it (`SK-SDK-011`):

```ts
const client = createClient({ withCredentials: true });
await client.setByollm({ provider: "anthropic", model: "claude-sonnet-4-6", key: "sk-ant-…" });
await client.getByollmStatus(); // { configured: true, credential: { provider, model, last4, updatedAt } }
await client.clearByollm();     // { ok: true, cleared: true }
```

The stored key is write-only — no verb ever returns it (`last4` is the
only display field). These verbs are signed-in only, so they throw
unless the client was built with `withCredentials: true`.

## Surface

```ts
client.ask({ goal, dbId }, { signal? })           // POST /v1/ask
client.runSql({ db, sql }, { signal?, idempotencyKey? }) // POST /v1/run
client.databases.connect({ engine, connectionUrl, name? }) // POST /v1/db/connect
client.listChat({ signal? })                       // GET  /v1/chat/messages
client.postChat({ goal, dbId }, { signal? })       // POST /v1/chat/messages
client.setByollm({ provider, model, key })         // POST   /v1/keys/byollm
client.getByollmStatus()                           // GET    /v1/keys/byollm
client.clearByollm()                               // DELETE /v1/keys/byollm
```

`runSql` is the `GLOBAL-015` escape hatch: same allow-list as `/v1/ask`
(SELECT / INSERT / UPDATE / DELETE / WITH / EXPLAIN / SHOW); DDL is
rejected. Use it when the LLM-emitted SQL is the wrong shape and you
want to hand-write the query — the response carries the same `trace`
block as `ask()`.

`databases.connect` is the bring-your-own-database verb
(`SK-DBCONN-001`): connect your own Postgres or ClickHouse and query it
in plain English. The `connectionUrl` is the same trust class as a
provider key — it rides the request body only, is sealed at rest
server-side, and never appears in a URL, log, or thrown-error message.
Account-only: an anonymous call rejects with `connect_requires_account`.

```ts
const db = await client.databases.connect({
  engine: "postgres",
  connectionUrl: "postgresql://user:pass@db.example.com:5432/app",
  name: "prod replica",
});
// { dbId, name, engine, schemaPreview, pkLive }
```

`AbortSignal` is plumbed end-to-end. SSE consumer for `/v1/ask` is
not yet shipped — `ask()` calls the buffered JSON path.

## Errors

Every method throws `NlqdbApiError` on every failure path — non-2xx
responses, network failures, aborts, and non-JSON proxy bodies.

```ts
import { NlqdbApiError } from "@nlqdb/sdk";

try {
  await client.ask({ goal, dbId });
} catch (err) {
  if (err instanceof NlqdbApiError) {
    switch (err.code) {
      case "rate_limited":      // err.body.limit, err.body.count
      case "db_not_found":
      case "sql_rejected":      // err.body.reason
      case "invalid_json":      // string-form envelope, normalized
      case "network_error":     // httpStatus === 0, transport failure
      case "aborted":           // httpStatus === 0, AbortSignal fired
      case "non_json_response": // proxy / CDN returned HTML, body suppressed
      case "unknown_error":     // 5xx with no parseable envelope
    }
  }
}
```

`err.code` mirrors the API's `error.status` discriminant (with a few
SDK-only sentinels for transport failures — see above). Branch on
`err.code` (or `err.httpStatus` / `err.body`) — never on `err.message`:
its format varies by path (`"… → 429 rate_limited"` vs `"… network
error"`), so a UI that renders it verbatim gets unstable copy. Treat
`err.message` as debug text; render `err.body.message` or a
`code`-derived CTA instead. `err.httpStatus === 0` means no response was
received.

Non-JSON response bodies (HTML 503 pages from a misconfigured proxy
etc.) deliberately do **not** echo into the thrown error message —
proxy/CDN internals could leak. Only `code: "non_json_response"` and
the HTTP status surface.
