---
name: sdk
description: `@nlqdb/sdk` — the only HTTP client; browser-cookie vs server-bearer; auto-refresh.
when-to-load:
  globs:
    - packages/sdk/**
  topics: [sdk, client, fetch-wrapper, auto-refresh]
---

# Feature: Sdk

**One-liner:** `@nlqdb/sdk` — the only HTTP client; browser-cookie vs server-bearer; auto-refresh.
**Status:** implemented
**Owners (code):** `packages/sdk/**`
**Cross-refs:** docs/architecture.md §3.1 (code-surfaces matrix) · `docs/features/ask-pipeline/FEATURE.md` (HTTP API happy path) · docs/architecture.md §3 (TypeScript SDK row) · packages/sdk/README.md

## Touchpoints — read this skill before editing

- `packages/sdk/**`

## Decisions

### SK-SDK-001 — Two mutually-exclusive auth modes, picked at construction time

- **Decision:** `createClient()` accepts either `{ apiKey }` (server-only bearer) or `{ withCredentials: true }` (browser cookie). Passing both is a runtime error; passing neither leaves the call unauthenticated (anonymous-mode path). The discriminated-union types enforce this at compile time and the runtime guard catches `as any` escapes.
- **Core value:** Seamless auth, Bullet-proof, Simple
- **Why:** A bearer key shipped to a browser bundle is a leak. A cookie attached server-side breaks for headless callers. Forcing the choice at construction time makes mis-use a build error or a first-call error, never a silent leak. It is also the precondition for `GLOBAL-002` parity (every surface picks one of these two modes; the SDK refuses to muddle them).
- **Consequence in code:** `packages/sdk/src/client.ts` exports a discriminated-union `ClientConfig`; the constructor throws `NlqdbApiError({ code: "config_invalid" })` if both fields are set; README explicitly forbids passing `apiKey` from a browser bundle. Surfaces (`apps/web`, `packages/elements`) use `withCredentials`; CLI / MCP / events-worker use `apiKey`.
- **Alternatives rejected:**
  - Single `auth` field that auto-detects environment — the detection is fragile (Workers, Bun, Edge runtimes all look "server-ish") and a wrong guess silently leaks the key.
  - Two separate exports (`createBrowserClient` / `createServerClient`) — doubles the API surface for no semantic gain; we keep one export with one config shape.
- **Source:** canonical here · also referenced in `packages/sdk/README.md` ("Auth")

### SK-SDK-002 — Every method throws `NlqdbApiError` on every failure path

- **Decision:** Every public method on the client throws a single error class — `NlqdbApiError` — for non-2xx responses, network failures, aborts, and non-JSON proxy bodies. Callers discriminate on `err.code` (a string union mirroring the API's `error.status` plus a small set of SDK-only sentinels: `network_error`, `aborted`, `non_json_response`, `unknown_error`).
- **Core value:** Bullet-proof, Simple, Effortless UX
- **Why:** Mixed return shapes (`{ data, error }` vs. throw) push branching logic into every caller, drift between methods, and lose `Promise` ergonomics (`await` no longer means "got a result"). One throw + one error class + one discriminant string keeps caller code small and parity (`GLOBAL-002`) trivial: every surface maps the same `code` to the same UX.
- **Consequence in code:** `packages/sdk/src/errors.ts` exports `NlqdbApiError` with `code`, `httpStatus`, and `body` fields. Tests cover every code path including transport failures (`httpStatus === 0`). Callers `switch (err.code)` — never parse `err.message`. Non-JSON response bodies are deliberately not echoed into `err.message` (proxy/CDN internals could leak); only `code: "non_json_response"` and the HTTP status surface.
- **Alternatives rejected:**
  - `Result<T, E>` return tuples — fights against `await`, doubles the call-site code, and library users have to remember which methods return tuples.
  - Multiple error classes (`NetworkError`, `RateLimitError`, …) — `instanceof` chains drift; one class with a string discriminant is easier to maintain and forward-compatible.
- **Source:** canonical here · also referenced in `packages/sdk/README.md` ("Errors")

### SK-SDK-003 — `AbortSignal` is plumbed end-to-end on every method

- **Decision:** Every method on the client accepts `{ signal?: AbortSignal }` and threads it into the underlying `fetch`. An aborted call throws `NlqdbApiError({ code: "aborted", httpStatus: 0 })`.
- **Core value:** Effortless UX, Honest latency, Bullet-proof
- **Why:** Long-running calls (`/v1/ask` against cold caches) outlive the user's intent — they navigate away, change tabs, retype. Without abort plumbing, in-flight requests keep burning rate-limit budget and the surface re-renders stale results when they finally resolve. Aborts also let the live-trace UI (`GLOBAL-011`) cancel cleanly when the user starts a new question.
- **Consequence in code:** Every method signature exposes `signal?` in its options object. The fetch wrapper passes it through unchanged. Tests cover the abort path explicitly; CI rejects new methods that omit the signal parameter.
- **Alternatives rejected:**
  - Library-managed timeouts (no signal) — surfaces want different timeouts per surface; one-size timeout is wrong everywhere.
  - Cancellation tokens (custom type) — `AbortSignal` is the platform primitive; rolling our own multiplies the number of cancel surfaces a caller has to learn.

### SK-SDK-004 — Zero deps, runtime-agnostic, only depends on global `fetch`

- **Decision:** `@nlqdb/sdk` has zero runtime dependencies. It assumes a global `fetch` (browsers, Node ≥ 18, Bun, Cloudflare Workers, Deno) and nothing else. No bundled polyfill, no `node-fetch` shim.
- **Core value:** Free, Simple, Bullet-proof
- **Why:** Every dep on the critical path is one more way the SDK can break, get a CVE, or bloat the bundle. The Workers free-tier ceiling (`GLOBAL-013`) means every byte counts on `apps/api` and on `packages/elements`. Zero deps is the most aggressive defense.
- **Consequence in code:** `packages/sdk/package.json` has empty `dependencies`. CI fails any PR that adds one. The bundle is < ~5 KB gzipped on the published path. New helpers go inline; if a feature genuinely needs a library, it goes in a sibling package, not the SDK.
- **Alternatives rejected:**
  - Bundle a `fetch` polyfill for Node 16- — Node 18 has been LTS for years; we don't carry that ballast.
  - Adopt `ky` / `axios` for retry helpers — we control the retry semantics ourselves (`SK-SDK-005`); a library would hide them.

### SK-SDK-005 — Refresh-on-401 retries silently; surfaces never see a 401

- **Decision:** When a `withCredentials` call returns 401, the SDK calls `POST /v1/auth/refresh` once and retries the original request. If refresh succeeds, the original 401 never surfaces. If refresh fails, the SDK throws `NlqdbApiError({ code: "unauthorized" })`; the surface is responsible for re-initiating the seamless re-auth path (web: `/sign-in?return_to=…`; CLI: re-runs device flow).
- **Core value:** Seamless auth, Effortless UX, Bullet-proof
- **Why:** A user-visible 401 is a regression (`GLOBAL-009`). Refresh logic in every surface drifts; centralizing it in the SDK is the only way parity (`GLOBAL-002`) holds. The retry is one — never a loop — to bound the worst case at "one extra round-trip".
- **Consequence in code:** `packages/sdk/src/fetch.ts` wraps every call with the 401-refresh-retry. The bearer-key path does not refresh (server keys are rotated, not refreshed). Tests cover refresh-success, refresh-fail, and the "refresh response itself returns 401" deadlock.
- **Alternatives rejected:**
  - Per-surface refresh logic — drifts across web / CLI / MCP within a quarter; contradicts `GLOBAL-002`.
  - Aggressive proactive refresh (refresh before expiry on every call) — wastes the auth server's budget and still doesn't catch revocation events.

### SK-SDK-006 — Auto-generate `Idempotency-Key` for retried mutations

- **Decision:** Every mutating helper (`postChat`, anything that POSTs / PATCHes / DELETEs) accepts an optional `idempotencyKey`. If the caller doesn't supply one and the SDK retries the call (network error, transient 5xx), it auto-generates a key the first time and reuses it across retries.
- **Core value:** Bullet-proof, Honest latency
- **Why:** The API requires `Idempotency-Key` on every mutation (`GLOBAL-005`). Asking surface authors to generate one for every call is the path to "client retries without keys" which the GLOBAL explicitly bans. The SDK generating it once-and-reusing-it on retry keeps the contract intact without surface-level ceremony.
- **Consequence in code:** Mutating methods accept `idempotencyKey?: string`. The retry path memoizes the key on the first attempt. CI checks every new mutating method for the parameter. Bearer-key callers (`apps/events-worker`, CLI) are encouraged to pass deterministic keys (job-id, command-hash) for cross-process replay safety.
- **Alternatives rejected:**
  - Make `idempotencyKey` required — surfaces that don't retry don't need to think about it; required adds friction for the 80% case.
  - Hash the request body as the key — misses semantic duplicates (same intent, different timestamp / nonce / client clock); `GLOBAL-005` rejects this explicitly.

### SK-SDK-007 — `onTrace` hook surfaces ask-pipeline trace events to the caller

- **Decision:** The SDK exposes an `onTrace?: (event: TraceEvent) => void` option on `ask()`. Every ask-pipeline step (`cache_lookup`, `plan`, `validate`, `exec`, `summarize`) fires a typed event when it begins and ends, with timings. Surfaces wire `onTrace` into their UI.
- **Core value:** Honest latency, Effortless UX
- **Why:** The "live trace" requirement (`GLOBAL-011`) means every surface needs the same per-step timing data. A bespoke streaming protocol per surface is fragmentation; one typed callback in the SDK is the single source of truth.
- **Consequence in code:** `packages/sdk/src/types.ts` defines `TraceEvent`. `apps/web` chat panel and `apps/cli` TTY trace both consume `onTrace`. New ask-pipeline steps add their event to the type union in the same PR.
- **Alternatives rejected:**
  - Surface-specific SSE wiring — duplicates parsing logic on every surface.
  - Polling an OTel endpoint — too much round-trip latency; `onTrace` is fire-and-forget local.

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-001** — SDK is the only HTTP client.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
- **GLOBAL-009** — Tokens refresh silently — never surface a 401.
- **GLOBAL-012** — Errors are one sentence with the next action.
- **GLOBAL-014** — OTel span on every external call (DB, LLM, HTTP, queue).

## Open questions / known unknowns

- **SSE consumer for `/v1/ask`.** The README explicitly notes this is not yet shipped (`ask()` calls the buffered JSON path). Decision deferred until the trace-streaming UX in `apps/web` requires it; the `onTrace` hook (SK-SDK-007) will be the consumer.
- **Bundle-size budget enforcement.** `GLOBAL-013` caps the Workers bundle at 3 MiB compressed but doesn't pin a per-package budget for `@nlqdb/sdk`. Implicit target is < ~5 KB gzipped; should we land an explicit CI assertion?
- **Python / Go / Rust SDKs.** `docs/architecture.md §3` lists them as Phase 2. We have not yet decided whether they share this skill or earn their own (`SK-SDK-PY-NNN` etc.). Revisit when the Python SDK starts.
- **`postChat` / `listChat` typed-error coverage.** The README enumerates the chat-related error codes; some are SDK-side sentinels (`network_error`, `aborted`) and may need reconciling with the API's canonical error catalog when chat surfaces formalize.
