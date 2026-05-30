# SK-SDK-010 — `byollm` client option carries the caller's own provider key on `ask()` / `askStream()`

Parent feature: [`sdk/FEATURE.md`](../FEATURE.md). Builds on
[`SK-LLM-021`](../../llm-router/decisions/SK-LLM-021-byollm-header-wiring.md)
(the `/v1/ask` wire header). Key-handling parent:
[`SK-PREMIUM-008`](../../premium-tier/decisions/SK-PREMIUM-008-byollm.md).
Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** `createClient()` accepts an optional
  `byollm: { provider, model, key }`. When set, `ask()` and `askStream()`
  send the `x-nlq-byollm-key: <provider>:<model>:<key>` header
  (`SK-LLM-021`) so the request dispatches through the user's own LLM key
  at 0% markup per `GLOBAL-026`. The header is attached to those two
  LLM-dispatching methods only — never to `listDatabases`, `mintKey`,
  etc. — so the secret stays off endpoints that have no use for it. The
  lane is signed-in only (`SK-LLM-021`), so `byollm` requires
  `withCredentials: true`; pairing it with `apiKey` (or no auth) throws at
  construction. The colon-join and its validation live in one tested
  helper: `provider` is lower-cased to match the server, parts must be
  non-empty, `provider` / `model` must not contain the `:` the server
  splits on (the key may, as the unsplit remainder), and no part may
  contain a control char (CR/LF would smuggle extra headers). A mis-shaped
  credential fails loud here (`GLOBAL-012`) rather than as an opaque
  downstream error. An *unrecognised* provider slug is not rejected at
  construction — the typed enum is open-ended so a new slug needs no SDK
  bump, and the server's 400 is the single source of truth for the
  evolving allowlist.
- **Core value:** Free, Effortless UX, Bullet-proof
- **Why:** `SK-LLM-021` wired the header on `/v1/ask` but left every code
  surface (`GLOBAL-001`: the SDK is the only HTTP client) unable to set it
  without hand-rolling fetch — the exact gap tracked in
  `premium-tier/FEATURE.md`. A client-level option (mirroring `inviteCode`)
  is the one-way-to-do-it (`GLOBAL-017`) ergonomics for "I am a BYOLLM
  user, route my asks through my key," and putting the validation +
  signed-in guard in the SDK means the contract is enforced once instead
  of re-discovered per consumer. Construction-time failure beats a request
  the API is guaranteed to 400.
- **Consequence in code:** `packages/sdk/src/index.ts` exports
  `ByollmProvider` + `ByollmCredential`, adds `byollm?` to
  `ClientOptionsBase`, builds + validates the header once in `createClient`
  (throwing on `byollm` without `withCredentials`, or on an empty /
  colon-bearing / control-char-bearing part), and merges it into the
  `ask` + `askStream` requests only. Tests assert header presence on
  `/v1/ask`, absence on `/v1/databases`, the SSE path, provider
  lower-casing, and every construction-time throw.
- **Alternatives rejected:**
  - Per-request `byollm` on `ask(req, opts)` — the key is a persistent
    credential, not a per-call routing hint; a client-level option avoids
    threading the secret through every call site and matches `inviteCode`.
    A per-call override can be added later without breaking this shape.
  - Attach the header to every request (like `inviteCode`) — needlessly
    ships a raw provider key to endpoints that never dispatch an LLM call;
    minimising the secret's blast radius is the safer default.
  - Accept the pre-joined `<provider>:<model>:<key>` string — pushes the
    colon-split hazard onto the caller and loses the typed `provider` enum
    autocomplete.
- **Source:** canonical here · `SK-LLM-021` (wire header) ·
  `SK-PREMIUM-008` (BYOLLM key handling) · `GLOBAL-026` (LLM strategy).
