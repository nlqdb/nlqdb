# @nlqdb/sdk

Typed HTTP client wrapping the nlqdb `/v1/*` API. Tiny, zero-dep,
runtime-agnostic — only depends on global `fetch` (browsers, Node ≥
18, Bun, Cloudflare Workers).

Phase 0 — first consumer is `apps/web`; second is `packages/elements`.
Published to npm as `@nlqdb/sdk` (DESIGN §5.1).

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

## Surface

```ts
client.ask({ goal, dbId }, { signal? })           // POST /v1/ask
client.listChat({ signal? })                       // GET  /v1/chat/messages
client.postChat({ goal, dbId }, { signal? })       // POST /v1/chat/messages
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
SDK-only sentinels for transport failures — see above). Discriminate
on `code`, not on parsing the message string. `err.httpStatus === 0`
means no response was received.

Non-JSON response bodies (HTML 503 pages from a misconfigured proxy
etc.) deliberately do **not** echo into the thrown error message —
proxy/CDN internals could leak. Only `code: "non_json_response"` and
the HTTP status surface.
