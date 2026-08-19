# SK-ERR-001 — One registry owns every error's status, recoverability, params schema, and copy

Parent feature: [`error-taxonomy/FEATURE.md`](../FEATURE.md).

- **Decision:** `packages/errors` declares one entry per wire error code:
  `httpStatus`, `recoverability ∈ {transient, clarify, user_config, operator, bug}`,
  a zod `params` schema, and `message(params)` / `action(params)` builders.
  `renderError(code, params)` is the only way an error becomes words.
  `retryable` is **derived** from `recoverability` — no surface computes it.
  Params are a **closed** schema: bounded enums and slug-shaped identifiers only,
  and `renderError` drops anything the schema doesn't declare.
- **Core value:** Bullet-proof, Effortless UX, Honest latency
- **Why:** Four surfaces (web, CLI, MCP, elements) each kept a table mapping the
  same typed failures to copy, and they had already drifted in both wording and
  coverage. Worse, none of them could do better than guess, because the bounded
  cause the throw site knew was discarded at each boundary. Two production
  failures in one session, 2026-08-17/18:
  - A BYOLLM model with an invalid key returned a provider 401. `packages/llm`
    typed it `auth_denied` (`SK-LLM-039`); `orchestrate.ts` collapsed it to bare
    `{status:"llm_failed"}`; the user read *"Couldn't generate a plan — try
    rephrasing."* Rephrasing can never fix a rejected key.
  - A PG `23503` foreign-key violation hit the exec catch-all, which buckets every
    unrecognised PG error as `db_unreachable` — a *transient* label, so
    `SK-ASK-013` spent three backoff retries replaying a deterministic failure
    before telling the user *"Couldn't reach the database — try again."*
  Both are the same bug: honest data destroyed before it reached the user. The
  registry is where the sentence and the cause meet, once.
  The closed params schema is the security boundary that makes this safe to ship:
  raw provider messages can carry prompt fragments or the key itself, and a PG
  `DETAIL` line quotes the offending row values. Those stay on the OTel span and
  the `SK-ASK-023` KV diag sink, where operators read them and tenants don't.
- **Consequence in code:** `defineError` infers each entry's params type from its
  schema, so a copy builder reading a field the schema doesn't declare fails to
  compile. A bidirectional compile-time guard
  (`packages/errors/test/sdk-parity.test.ts`) asserts the registry and the SDK's
  `ApiErrorCode` union name exactly the same literals — the trick promoted from
  `packages/mcp`'s `ERROR_COPY`, now covering all surfaces. A vitest sweep renders
  every code × representative params and asserts a one-sentence message plus a
  non-empty action (the `GLOBAL-012` lint, executed).
  Adding an error is one entry; adding a *lane* or a *cause* is one enum member.
  `httpStatus` and `recoverability` may be functions of params, which is what lets
  `llm_failed × byollm × auth_denied` be a non-retryable 409 while
  `llm_failed × free × http_5xx` stays a retryable 502.
- **Alternatives rejected:**
  - **Keep copy per surface, thread the cause.** Fixes the guessing but not the
    drift; still four places to edit per new code, and the `GLOBAL-003` parity
    gate stays a manual checklist item.
  - **Codegen a copy table per surface (incl. Go).** Warranted only if offline
    rendering becomes a requirement. The wire already reaches every surface, so
    the seam is left unbuilt.
  - **Put copy in the SDK.** Would bind wording to a client version: a fix would
    ship only to consumers who upgrade, and never to the Go CLI or a raw
    `fetch`.
  - **Free-form `details` instead of a declared schema.** Exactly how raw
    provider text and row values leak. RFC 9457's posture (extensions are a
    declared, closed set) is the right one and is what we adopted.
