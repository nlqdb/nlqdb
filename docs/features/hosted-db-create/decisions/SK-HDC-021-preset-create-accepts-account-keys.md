# SK-HDC-021 — Preset create accepts any account-scoped principal, not only a session

- **Decision:** `POST /v1/databases` moves from `requireSession`
  (cookie-only) to `requirePrincipal`. On the **`agent_memory_v1` preset
  path** it accepts any account-scoped principal — a `user` session,
  `sk_live`, or `sk_mcp` — because the preset is the authed agent on-ramp
  (SK-HDC-020) and an agent authenticates with an `sk_` key, not a browser
  cookie. `anon` and `pk_live` have no account tenant and are rejected 403
  `account_required` before the body is parsed (preserving the SK-PIVOT-010
  "the wedge does not open the product anonymously" rule for both create
  shapes). The **generic LLM-inferred goal/name create** stays the chat
  surface only: a non-`user` principal there is rejected 403
  `create_requires_session`. This applies the SK-PIVOT-010 amendment
  (2026-08-09, founder-directed live session) in code.
- **Core value:** Bullet-proof, Honest, Simple
- **Why:** The dogfood gate (SK-PIVOT-016) needs nlqdb's own agents to
  provision and fill an `agent_memory_v1` DB through the public surface with
  the repo's `sk_` service credential. The companion write verb
  `POST /v1/memory/remember` already trusts `sk_live`/`sk_mcp`
  (`requirePrincipal`, E-02), so the shipped code had a create-vs-write
  asymmetry: an agent could *write* memory but not *create* the DB it writes
  to — the create call `401`'d because it was cookie-session-only. This
  closes that asymmetry with the narrowest possible widening: only the
  deterministic, LLM-free preset path opens to `sk_` keys; the generic
  inference path (the one that spends LLM tokens and is a human authoring
  action) is untouched.
- **Consequence in code:**
  - `apps/api/src/index.ts` — the route middleware is `requirePrincipal`;
    the handler resolves `tenantId = accountTenantIdFromPrincipal(principal)`
    and 403s `account_required` when null (anon/pk_live). After the preset
    block resolves, `!preset && principal.kind !== "user"` 403s
    `create_requires_session`. Downstream (span `nlqdb.user.id`, the
    `Idempotency-Key` KV namespace, and the orchestrator `tenantId`) now key
    on the resolved `tenantId` instead of `session.user.id`, so `sk_`-created
    memory DBs are owned by the key's tenant exactly as a session create is.
  - Span surface is `surfaceFromPrincipal(principal)` (`mcp`/`cli`/`chat`)
    instead of the hardcoded `"chat"`, so the create span is honest about
    who called it.
  - `apps/api/test/databases-create.test.ts` pins the four seams
    (unauth → 401; anon → 403 `account_required`; `sk_live`/`sk_mcp` + preset
    admitted past auth; `sk_live` generic → 403 `create_requires_session`).
- **Alternatives rejected:**
  - **Open generic goal-create to `sk_` keys too** — widens beyond the
    dogfood need and re-opens the LLM-token-spending inference path to
    headless callers; SK-PIVOT-010 scoped the amendment to the preset path.
  - **A separate `POST /v1/memory/db` endpoint for agents** — contradicts
    SK-HDC-001 / GLOBAL-017 (one create surface); the preset is one input on
    the existing create path.
  - **Keep create session-only and provision the dogfood DB by hand** —
    memory DBs are a system of many DBs and many clients (founder-directed
    2026-08-09); provisioning must be product-automated, never a per-DB human
    step. A manual step also violates rule 4 / GLOBAL-033.

## Remaining (tracked)

- **GLOBAL-003 surface parity (CLI):** `CreateDatabaseRequest` now exposes
  `preset` (typed `client.createDatabase({ preset: "agent_memory_v1" })`), so
  MCP's `nlqdb_remember` self-provisions through the SDK; the remaining gap is
  `nlq db create --preset`, still unshipped. Tracked here as a follow-on slice;
  elements never create.
