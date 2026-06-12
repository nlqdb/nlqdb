# WS-03 — SDK + framework wrappers

**Scope:** `packages/sdk/`, `packages/{react,next,vue,nuxt,svelte,sveltekit,astro,solid}/`.
**Pre-reads:** `docs/features/sdk/FEATURE.md`,
`docs/features/framework-wrappers/FEATURE.md`, GLOBAL-001, GLOBAL-002,
GLOBAL-012 (files under `docs/decisions/`).
**Default KPI:** UX (developer + coding-agent DX).
**Constraints:** GLOBAL-001 (SDK is the only HTTP client), SK-SDK-008
(wire-layer retry), SK-SDK-005 (silent 401 refresh), GLOBAL-005
(Idempotency-Key on mutations), SK-FW-001 (one core, thin idiomatic
adapters).

Verified strengths to preserve: zero-dep SDK, discriminated-union auth
(`apiKey` XOR `withCredentials`), auto idempotency keys reused across
retries, typed `NlqdbApiError` with `code` discriminant. SvelteKit's
`nlqdbLoad` already wraps the SDK correctly — use it as the reference
adapter.

---

## WS03-T1 (P1) — Nuxt `useNlq()` hand-rolls HTTP, bypassing the SDK

- **Files:** `packages/nuxt/src/runtime/composables.ts:26-43`
- **Problem:** `useNlq()` calls Nuxt's `useFetch` directly against
  `/v1/ask` with a hand-built bearer header. This is a straight
  GLOBAL-001 violation (code wrong, decision right → conform the code):
  no SK-SDK-008 retry, no idempotency key, no normalized
  `NlqdbApiError` envelope, no 401 refresh. It is the **only** wrapper
  that bypasses the SDK.
- **Fix:** Rewrite `useNlq()` to call `createClient().ask()` from
  `@nlqdb/sdk` inside Nuxt's async-data lifecycle (keep the duck-typed
  ambient-global pattern the file already uses to stay typecheck-clean),
  returning the same `{ data, error }` shape. Cache one client per
  baseUrl+key. If SSR semantics make this awkward, the alternative is
  deleting the composable and adding a `@nlqdb/nuxt/server` factory
  mirroring `packages/sveltekit/src/server.ts` — pick whichever is
  *simpler* (CLAUDE.md P5); either way no hand-rolled `fetch` to `/v1/*`
  may remain.
- **Accept:** `grep -rn "v1/ask" packages/nuxt/src` shows no direct HTTP;
  retry/idempotency tests (mirror `packages/sdk/test`) pass; README
  example updated.

## WS03-T2 (P1) — Public SDK methods have no JSDoc (agents read types first)

- **Files:** `packages/sdk/src/index.ts` — the `NlqClient` interface
  (~lines 514-606) and `createClient`
- **Problem:** ~16 public methods (`ask`, `askStream`, `runSql`,
  `listDatabases`, `createDatabase`, `deleteDatabase`, `mintKey`,
  `listKeys`, `revokeKey`, `listChat`, `postChat`, `getKeyStatus`,
  `redeemOAuthBridgeCode`, `setByollm`, `getByollmStatus`, `clearByollm`)
  carry only `//` line comments, which don't surface in IDE hover or to
  coding agents. The whole file has 3 `/** */` blocks. For an AI-first
  SDK this is the documentation surface.
- **Fix:** Add a JSDoc block per public method: one-sentence endpoint
  summary, the union discriminator to check (`AskResponse` =
  `AskOk | AskCreateResult`), retry/idempotency behaviour where
  non-obvious, key `ApiErrorCode`s to handle, and auth requirements —
  notably mark `setByollm`/`getByollmStatus`/`clearByollm` as
  session-only (`withCredentials: true`; throws on bearer-key clients,
  SK-SDK-011). Convert the existing `//` comments rather than duplicating
  them. Also add one JSDoc line per exported component in
  `packages/react/src/index.ts` (and mirrors) while in here.
- **Accept:** Hover on every `NlqClient` method shows docs;
  `bun run typecheck` green; no behaviour change.

## WS03-T3 (P2) — Next server route rewrites the error envelope shape

- **Files:** `packages/next/src/server.ts` (~line 42)
- **Problem:** `createAskRoute` returns
  `{ error: { status: err.code, message: err.message, ...err.body } }` —
  injecting the SDK's internal `err.message` string into what should be
  the canonical API envelope (`{ error: ApiErrorBody }`). Surfaces
  consuming the route get a shape that differs from calling the API
  directly (GLOBAL-002 parity).
- **Fix:** Drop the `message: err.message` rewrite; emit
  `{ error: { status: err.code, ...(err.body ?? {}) } }`. If `err.body`
  carries a `message`, it passes through untouched.
- **Accept:** Route error responses byte-match the API envelope for a
  mocked 429 and 404; tests updated.

## WS03-T4 (P2) — Cross-framework naming drift is undocumented

- **Files:** `packages/astro/src/NlqData.astro` + `NlqAction.astro`
  (kebab-case `api-key` prop — deliberate, see the file comment),
  `packages/svelte/README.md` (Svelte 5 lowercase callbacks: `onload`,
  not `onLoad`), `packages/nuxt/README.md` (template example never binds
  the key).
- **Problem:** Per SK-FW-001 adapters are idiomatic per framework, so the
  drift itself is allowed — but nothing tells a developer (or an agent
  copying between frameworks) that Astro wants `api-key`, Svelte wants
  `onload`, React wants `apiKey`/`onLoad`. The Nuxt README's template
  snippet renders nothing if copy-pasted because no key is ever bound.
- **Fix:** (a) Astro: also accept `apiKey` as a prop alias (map to the
  same attribute) — two-line change per component — and document both
  spellings. (b) Svelte README: one explicit note that Svelte 5 event
  callbacks are lowercase, with the full list. (c) Nuxt README: complete
  the example with `:api-key` bound from
  `useRuntimeConfig().public.nlqdb.publishableKey`, and state that
  `publishableKey` is a browser-safe `pk_live_*`. (d) Add a 4-row
  "naming across frameworks" table to
  `docs/features/framework-wrappers/FEATURE.md` *only if* it's not
  already inferable — otherwise keep it README-level (CLAUDE.md D5).
- **Accept:** Each README example works by copy-paste; Astro accepts both
  prop spellings with a test.

## WS03-T5 (P2) — SDK byollm validation errors state the problem, not the fix

- **Files:** `packages/sdk/src/index.ts` (`buildByollmHeader`,
  ~lines 1207-1225)
- **Problem:** Throws like "`byollm` values must not contain control
  characters." name what's wrong but not the next action (GLOBAL-012
  spirit: message + next step).
- **Fix:** Append the action to each message, e.g. "…must not contain
  control characters — re-paste the key without hidden CR/LF characters."
- **Accept:** All three throw-sites end with an action; tests updated.

## WS03-T6 (P3) — Document the `err.code` vs `err.message` discipline

- **Files:** `packages/sdk/src/index.ts` (`NlqdbApiError` JSDoc),
  `packages/sdk/README.md`
- **Problem:** `err.message` formats vary by path ("…→ 429 rate_limited"
  vs "…network error"); surfaces that render it verbatim get unstable
  copy. The stable contract is `err.code`/`err.httpStatus`/`err.body`.
- **Fix:** One JSDoc paragraph on the class + one README line: "Branch on
  `err.code`; treat `err.message` as debug text." Don't churn the message
  formats themselves.
- **Accept:** Documented in both places; no runtime change.
