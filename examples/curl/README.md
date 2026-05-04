# curl — raw HTTP

No SDK, no CLI, no client library. Three `curl` calls cover read, write, and anonymous mode.

## Read (no `Idempotency-Key` needed)

```bash
curl https://api.nlqdb.com/v1/ask \
  -H "Authorization: Bearer sk_live_..." \
  -d '{"goal": "an orders tracker", "ask": "how many orders today"}'

# 200 {
#   "answer": "12 today",
#   "data": [{"count": 12}],
#   "session": { "db": "orders-tracker-a4f", "key": "pk_live_..." },
#   "trace": { "engine": "postgres", "sql": "...", "ms": 41 }
# }
```

`session.db` and `session.key` come back so the caller *can* go DB-explicit on subsequent calls. They don't have to.

## Write (`Idempotency-Key` required)

```bash
curl https://api.nlqdb.com/v1/ask \
  -H "Authorization: Bearer sk_live_..." \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"ask": "add an order: alice, latte, 5.50"}'
```

The API auto-classifies the call. Reads without a key succeed; writes without a key return `400 idempotency_required` with a curl snippet in the body showing the missing header.

## Anonymous mode (no key, no sign-in)

```bash
curl https://api.nlqdb.com/v1/ask \
  -d '{"goal": "an orders tracker", "ask": "how many orders today"}'

# 200 { ..., "session": { "anonymous_token": "anon_..." } }
```

Subsequent calls pass `Authorization: Bearer anon_...` to reuse the session. 72 h window — same as the web (`docs/architecture.md §4.1`).

## When to use raw curl

- One-liners on a server with no Node / Bun runtime.
- Smoke tests against a fresh deploy.
- CI-job assertions where adding the SDK is overkill.
- Demos / docs / shell screencasts.

For anything beyond a one-liner, prefer `@nlqdb/sdk` (`GLOBAL-001`).

## Power-user path: explicit `db`

```bash
curl https://api.nlqdb.com/v1/ask \
  -H "Authorization: Bearer sk_live_..." \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"db": "orders-tracker-a4f", "ask": "weekly revenue by drink"}'
```

The two-endpoint API (`/v1/ask` + `/v1/run`) is the canonical surface — see `GLOBAL-017`.
