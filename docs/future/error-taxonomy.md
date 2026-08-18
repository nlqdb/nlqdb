# Error taxonomy — one registry from internal cause to user-facing copy

**Status:** design for founder review (not yet a feature; promote to
`docs/features/error-envelope/` once the open questions below are answered).
**Prompted by:** the 2026-08-17/18 `rateme12345` incidents (see §1).
**Implements:** [`GLOBAL-012`](../decisions/GLOBAL-012-one-sentence-errors.md)
as decreed — `code + message + action` on the wire — which the code never
actually shipped (surfaces get a bare `{status}` today).

## 1. Why (evidence, not hypothetical)

Three production failures in one user session, each honest data destroyed
before it reached the user:

| What the user saw | What actually happened | Where the cause died |
|---|---|---|
| "Couldn't generate a plan — try rephrasing." | BYOLLM model with an invalid API key → provider 401. Rephrasing can never fix it. | `packages/llm` typed it `auth_denied` (SK-LLM-039); `orchestrate.ts` collapsed it to `{status:"llm_failed"}` |
| "Couldn't reach the database — try again." | PG `23503` FK violation (plan invented user_id `00000000-…`). Deterministic; retrying replays it. | exec catch-all maps every unrecognized PG error to `db_unreachable` (transient bucket → 3 wasted backoff retries → wrong copy) |
| "No rows returned." | An approved INSERT silently no-oped (0 rows) / earlier actually committed while the UI said it hadn't | write rowCount vs read rows conflated (fix in flight, separate workstream) |

The pattern: **the bounded, secret-free cause exists at the throw site and
is discarded at each boundary**, so every surface can only render a generic
guess.

## 2. Discovery (design-for-leverage gate)

Queries run: `grep -rn "messageFor|ERROR_COPY|sqlRejectedMessage|errorMessage"
apps packages cli`; `grep -n "llm_failed|db_unreachable" apps/api/src/ask
packages/mcp/src packages/elements/src`; read `packages/llm/src/{types,router}.ts`,
`apps/api/src/ask/{types,orchestrate}.ts`, `cli/internal/cmd/ask.go`.

Existing instances of the category **"typed failure → user copy table"** (≥4,
plus ad-hoc satellites):

1. `apps/web/src/components/chat/error-message.ts` (+ `create-errors.ts`, `CreateForm`, `KeysPanel`)
2. `cli/internal/cmd/ask.go` (`sqlRejectedMessage`, `renderAuthRequired`, …) — Go duplicates
3. `packages/mcp/src/tools.ts` `ERROR_COPY` (has the best mechanism today: compile-time exhaustiveness against the SDK code union)
4. `packages/elements/src/render.ts` `errorMessage`

Four+ parallel copies of the same judgment, already drifted in wording and
coverage. Category proven → the enabling layer is due (ladder rung 3, with a
rung-4 codegen edge for the Go CLI).

Existing assets to reuse, not rebuild:
- `packages/llm` `FailoverReason` — bounded cause enum (`auth_denied`,
  `rate_limited`, `timeout`, `not_configured`, …) already computed per call.
- `AskError` union (`apps/api/src/ask/types.ts`) — the code set, minus causes.
- SK-ASK-023 KV diag sink + OTel spans — where full/raw detail already lives.
- Industry shape: RFC 9457 Problem Details (`type`/`title`/`detail` +
  extensions) — we keep our field names but adopt its structure and its
  security posture (never expose implementation internals; extensions are a
  declared, closed schema).

## 3. Design — one registry, three layers

### Layer 1 — capture: causes survive to the envelope, bounded and secret-free

Errors crossing the orchestrator boundary carry **registry-declared params**,
never raw upstream messages (raw provider/PG text stays on spans + KV diag,
exactly as today's security comment in `orchestrate.ts` demands):

- `llm_failed` gains `{ reason: FailoverReason, lane: "free"|"byollm"|"premium"|"frontier", provider?: slug, model?: string }`.
- exec gains a SQLSTATE classifier (extends SK-ASK-016/019's precedent):
  - class `08`/`53`/`57` + transport → `db_unreachable` (genuinely transient; keeps SK-ASK-013 retries)
  - class `23` → new `constraint_violation` `{ kind: fk|unique|not_null|check, constraint, table }` — **Nonrecoverable** (no retry; names come from the tenant's own schema, safe to show them their own identifiers)
  - class `22` → new `invalid_value` `{ pgCode }` — Nonrecoverable
  - `42P01`/`3F000` stay `schema_mismatch` (unchanged)

### Layer 2 — the registry + wire envelope (the engine)

One TypeScript module — `packages/errors` (or a `packages/sdk` sub-path;
decide at implementation) — declaring, per code:

```ts
{ code, httpStatus, recoverability: "transient"|"clarify"|"user_config"|"operator"|"bug",
  params: ZodSchema, message: (p) => string, action: (p) => string }
```

Every API error response becomes (RFC 9457-aligned, GLOBAL-012 shape):

```json
{ "error": { "code": "llm_failed", "message": "Your OpenRouter API key was rejected.",
  "action": "Check the key in Settings → Keys, or switch model back to auto.",
  "retryable": false, "params": { "reason": "auth_denied", "lane": "byollm", "provider": "openrouter", "model": "luna" } } }
```

Copy is **parametric and cause-specific** — the same code renders differently
by params: `llm_failed × byollm × auth_denied` → the key message above;
`llm_failed × free × (chain exhausted)` → "The planning models are unavailable
right now — try again in a minute." (honest; never "rephrase" for a
non-goal problem). `retryable` is derived from `recoverability` so surfaces
stop inventing their own retry hints.

### Layer 3 — surfaces render wire copy; overrides are sparse and typed

- **Default for every surface: render `message` + `action` from the wire.**
- A surface may override *per code* only for genuine voice/affordance needs
  (MCP's tool-name actions, web's clarify chips, CLI lowercase style). The
  override table's keys are type-checked ⊆ registry codes; anything not
  overridden falls back to wire copy — so **a new error code requires zero
  surface edits** and can never regress to "Something went wrong".
- CLI (Go): renders wire `message`/`action` directly; its hand tables shrink
  to formatting. (No codegen needed once wire copy is authoritative — the
  rung-4 JSON-table generation is only warranted if offline rendering ever
  becomes a requirement; leave that seam, don't build it.)
- Trace honesty (GLOBAL-011): a failed step marks only itself failed;
  downstream steps render `skipped`, not a repeated error label (the luna
  transcript showed all five steps stamped `llm_failed`).

### Enforcement (what makes it a rail)

- Compile-time exhaustiveness: registry covers the full `AskError`/SDK code
  union (promote MCP's existing trick into the shared package).
- Vitest in `packages/errors`: every code × representative params renders a
  one-sentence message + non-empty action (GLOBAL-012 lint).
- Test asserting each surface override table's keys ⊆ registry codes.

## 4. Behavioral rule changes riding on it

- **BYOLLM/premium `auth_denied` does not silently fall back to the free
  chain** — the user chose a paid model; degrade only with the failure named
  in the response (consistent with SK-LLM-016 fail-loud, SK-PREMIUM-020's
  surfaced fallback).
- `constraint_violation` is Nonrecoverable in SK-ASK-013's retry loop
  (deterministic), same posture as `schema_mismatch`.

## 5. Leverage verdict

```
Leverage: invest
N+1: a new error = one registry entry (code, params schema, copy builders,
     recoverability); all five surfaces pick it up with zero edits.
Category: "typed failure → user-facing copy"; 4 parallel instances found at
     discovery (web, CLI, MCP, elements) + ad-hoc satellites.
```

Diff-composition target: the migration PR should be >½ deletion of the four
copy tables; ongoing instances become pure judgment (the copy itself).

## 6. Open questions (founder sign-off before implementation — P4/D1)

1. **Wire field rename:** `status` → `code` clean (pre-beta, P5 says
   deprioritize backcompat) or ship both for one release? *Recommend: clean
   rename, one PR across monorepo + CLI.*
2. **Copy source of truth = server** (this design) means user-visible wording
   changes deploy with the API, not the surface. Acceptable? *Recommend: yes —
   that's the point; i18n later hangs off the same registry.*
3. **BYOLLM auth_denied fallback** (§4): confirm no silent free-chain
   downgrade when the user pinned a model. *Recommend: confirm.*

## 7. Implementation slices (after sign-off)

1. `packages/errors` registry + envelope middleware in `apps/api` (codes as
   today, causes where cheap) — surfaces still work untouched (they ignore
   unknown fields).
2. Thread `FailoverReason`/lane through `orchestrate.ts` + `resolveAskRouter`;
   SQLSTATE classifier for exec.
3. Surfaces adopt wire copy; delete the four tables down to sparse overrides.
4. New decision IDs: one `GLOBAL` amendment is NOT needed (GLOBAL-012 already
   decrees the shape); add `SK-ASK-0NN` for the SQLSTATE classifier and an
   SK in `llm-router` for cause propagation, per P3.
