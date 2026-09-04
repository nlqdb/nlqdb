---
name: error-taxonomy
description: One registry from internal cause to user-facing copy — every wire error is {code, message, action, retryable, params} rendered server-side.
when-to-load:
  globs:
    - packages/errors/**
    - apps/api/src/error-envelope.ts
  topics: [errors, error copy, envelope, retryable, GLOBAL-012]
---

# Feature: Error Taxonomy

**One-liner:** One registry from internal cause to user-facing copy — every wire error is `{code, message, action, retryable, params}` rendered server-side.
**Status:** implemented — registry + envelope live on every `/v1/ask`, `/v1/run`, `/v1/memory`, `/v1/db/connect`, `/v1/databases` and parse-error path; all five surfaces render wire copy. Remaining gap: the billing / keys / grants routes still emit the legacy string form `{error:"slug"}` (the SDK normalises it to `{code}` so no surface breaks, but those codes carry no copy) — tracked in Open questions.
**Owners (code):** `packages/errors/**`, `apps/api/src/error-envelope.ts`
**Cross-refs:** [`GLOBAL-012`](../../decisions/GLOBAL-012-one-sentence-errors.md) (canonical — this feature is its implementation) · [`GLOBAL-011`](../../decisions/GLOBAL-011-honest-latency.md) (never claim what we don't know) · [`GLOBAL-003`](../../decisions/GLOBAL-003-all-surfaces-one-pr.md) (surface parity, now automatic) · `ask-pipeline/FEATURE.md` (`SK-ASK-029`/`SK-ASK-030` exec classifiers) · `llm-router/FEATURE.md` (`SK-LLM-051`/`SK-LLM-052` cause propagation) · `trust-ux/FEATURE.md` (`SK-TRUST-006` write outcomes)

## Touchpoints — read this feature before editing

- `packages/errors/**` — the registry
- `apps/api/src/error-envelope.ts` — the only place an error becomes a response
- any surface's error copy: `apps/web/src/components/chat/error-message.ts`,
  `packages/elements/src/{render,action-render}.ts`, `packages/mcp/src/tools.ts`,
  `cli/internal/cmd/ask.go`

## Decisions

### SK-ERR-001 — One registry owns every error's status, recoverability, params schema, and copy

**Body:** [`decisions/SK-ERR-001-error-registry.md`](./decisions/SK-ERR-001-error-registry.md).

### SK-ERR-002 — The wire discriminant is `code`, and copy is server-rendered

**Body:** [`decisions/SK-ERR-002-wire-envelope.md`](./decisions/SK-ERR-002-wire-envelope.md).

### SK-ERR-003 — Surfaces render wire copy; overrides are sparse and type-checked

**Body:** [`decisions/SK-ERR-003-surface-overrides.md`](./decisions/SK-ERR-003-surface-overrides.md).

## GLOBALs governing this feature

- [`GLOBAL-012`](../../decisions/GLOBAL-012-one-sentence-errors.md) — one sentence + the next action.
  - This feature is what finally ships it: the decision was made long before the
    code had anywhere to put a sentence, so surfaces got a bare `{status}` and
    each invented its own wording. The registry is the place the sentence lives.
- [`GLOBAL-011`](../../decisions/GLOBAL-011-honest-latency.md) — never claim something we don't know.
  - Applied twice here: `retryable` is derived from the code's recoverability
    rather than guessed per surface, and a failed trace step marks only itself
    failed (downstream steps render `skipped`).
- [`GLOBAL-003`](../../decisions/GLOBAL-003-all-surfaces-one-pr.md) — every capability reaches SDK + CLI + MCP + elements.
  - Parity is now structural: a new error code is one registry entry and every
    surface picks it up with zero edits, so this gate can no longer be missed.

## Open questions / known unknowns

- **Legacy string-form envelopes.** The billing, key-mint and grants routes still
  return `{error:"no_customer"}`-style bodies. They are operator/dashboard
  surfaces rather than end-user journeys, so they were left out of this slice;
  migrating them is ~25 more registry entries and no code change beyond the call
  sites. Until then their codes render with the surface's generic fallback.
- **i18n.** Copy builders are functions of params, so a locale argument threads
  through one signature. Deliberately not built — there is no second locale yet.

## Happy path walkthrough

1. A throw site produces a bounded cause: the LLM router's `FailoverReason` +
   lane, or a Postgres SQLSTATE classified by
   `ask/{write-constraint,exec-classify,schema-mismatch}.ts`.
2. The orchestrator returns `{code, ...params}` — a variant of its own typed
   union (`AskError`), never a string.
3. `errorEnvelope` renders it through the registry: HTTP status,
   one-sentence `message`, one `action`, `retryable`, and the validated `params`.
4. Every surface prints `message` + `action`. A surface overrides only where its
   next action is genuinely different — an MCP tool name, a CLI command.
