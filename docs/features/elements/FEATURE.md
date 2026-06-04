---
name: elements
description: `<nlq-data>` + `<nlq-action>` web components for framework-free embedding.
when-to-load:
  globs:
    - packages/elements/**
  topics: [elements, web-component, nlq-data, nlq-action, embedding, cdn]
---

# Feature: Elements

**One-liner:** `<nlq-data>` (reads) and `<nlq-action>` (writes) custom elements for framework-free embedding.
**Status:** partial (Phase 2) — `<nlq-data>` v0.1 implemented (Slice 10); `<nlq-action>` v0.1 ships in this slice. The action element supports preview→confirm via [`SK-TRUST-001`](../trust-ux/FEATURE.md)'s diff hop, cookie-session auth (cross-origin write-token deferred per [`SK-ELEM-011`](decisions/SK-ELEM-011-action-cookie-session-only.md)), and FormData-into-goal serialization ([`SK-ELEM-013`](decisions/SK-ELEM-013-action-form-context-in-goal.md)). Pre-alpha `feature_gated` responses render the waitlist CTA inline on both elements ([`SK-ELEM-014`](decisions/SK-ELEM-014-feature-gated-inline-cta.md)). `card-grid` / `chart` templates and `pk_live_*` cross-origin issuance remain on the original Slice 11+ list.
**Owners (code):** `packages/elements/**`
**Cross-refs:** docs/architecture.md §3.5 (the bet) · §14.5 (happy path) · docs/architecture.md §3 (matrix) · `packages/elements/README.md`

## Touchpoints — read this feature before editing

- `packages/elements/src/element.ts` (`<nlq-data>` class + lifecycle)
- `packages/elements/src/action-element.ts` (`<nlq-action>` class + state machine)
- `packages/elements/src/fetch.ts` (single `POST /v1/ask` call, shared)
- `packages/elements/src/render.ts` + `templates.ts` (read-side template registry)
- `packages/elements/src/action-render.ts` (write-side diff card markup)
- `packages/elements/src/action-goal.ts` (FormData → goal-text suffix; pure)
- `packages/elements/src/parse.ts` (attribute parsing — `refresh="60s"` etc.)
- `packages/elements/build.ts` (esbuild config; bundle size budget)
- `packages/elements/dist/v1.js` (the published CDN bundle)

## Decisions

Canonical bodies live in [`decisions/`](decisions/) — one file per `SK-ELEM-NNN`. The list below is the index; open the linked file for the full five-field block.

- [**SK-ELEM-001**](decisions/SK-ELEM-001-one-name-idempotent-register.md) — One element name per type (`<nlq-data>` + `<nlq-action>`), idempotent registration.
- [**SK-ELEM-002**](decisions/SK-ELEM-002-attribute-driven.md) — Attribute-driven; observed attributes are `goal`, `db`, `query`, `api-key`, `endpoint`, `template`, `refresh`.
- [**SK-ELEM-003**](decisions/SK-ELEM-003-single-network-call.md) — `POST /v1/ask` is the only network call.
- [**SK-ELEM-004**](decisions/SK-ELEM-004-safe-template-registry.md) — Safe template registry; LLM never returns raw HTML.
- [**SK-ELEM-005**](decisions/SK-ELEM-005-pk-live-readonly.md) — `pk_live_*` keys: read-only, per-DB, origin-pinned, rate-limited.
- [**SK-ELEM-006**](decisions/SK-ELEM-006-single-esm-bundle.md) — Single ESM bundle at `dist/v1.js`; CDN-first distribution.
- [**SK-ELEM-007**](decisions/SK-ELEM-007-bundle-size-cap.md) — < 6 KB gzipped bundle ceiling enforced in CI.
- [**SK-ELEM-008**](decisions/SK-ELEM-008-events-and-aria-live.md) — `nlq-data:*` / `nlq-action:*` event taxonomy; `aria-live="polite"` by default.
- [**SK-ELEM-009**](decisions/SK-ELEM-009-refresh-poll.md) — `refresh="<duration>"` poll with microtask coalescing.
- [**SK-ELEM-010**](decisions/SK-ELEM-010-action-click-driven-form-lookup.md) — `<nlq-action>` is click-driven; form association via DOM lookup, not form-associated CE.
- [**SK-ELEM-011**](decisions/SK-ELEM-011-action-cookie-session-only.md) — `<nlq-action>` v0.1 supports cookie-session auth only; cross-origin write-token deferred.
- [**SK-ELEM-012**](decisions/SK-ELEM-012-action-two-click-commit.md) — Two-click commit: preview then Apply (the `SK-TRUST-001` user confirmation).
- [**SK-ELEM-013**](decisions/SK-ELEM-013-action-form-context-in-goal.md) — Form data serialized into the goal text; no new `/v1/ask` shape.
- [**SK-ELEM-014**](decisions/SK-ELEM-014-feature-gated-inline-cta.md) — Render the `feature_gated` waitlist CTA inline; surface the structured 403 body on `kind: "api"` (401 stays `auth`).

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-001** — SDK is the only HTTP client.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-013** — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed.
- **GLOBAL-023** — Trust UX baseline.
  - *In this feature:* `<nlq-action>` blocks `on-success` until the user clicks "Apply" on the rendered diff (per `SK-TRUST-001`; mechanism in [`SK-ELEM-012`](decisions/SK-ELEM-012-action-two-click-commit.md)). `<nlq-data>` exposes the trace via the `el.trace` JS property (per `SK-TRUST-002`). The trace pane lives outside the template render region — templates (`table`, `card-grid`, …) stay simple. See [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md).

## Open questions / known unknowns

- **External pentest before public launch — parked until Phase-1-exit (founder-bet default per `GLOBAL-033`).** `<nlq-data>` is the surface most likely to be embedded on third-party origins; the template registry (`SK-ELEM-006`) and `pk_live_*` origin-pinning (`SK-ELEM-005`, `SK-APIKEYS-003`) are the safety boundaries. The conservative default is to **gate Phase-1-exit on a scoped pentest** (element + `pk_live_` flow + `/v1/ask` contract). Vendor vs. bug-bounty and budget (the one launch line that breaks strict-$0) are the founder's call near launch — recorded here so launch can't slip past it unnoticed.
- **`<nlq-data>` does not yet consume `@nlqdb/sdk` (a `GLOBAL-001` debt).** The element today owns its `fetch()` against `endpoint` directly (`packages/elements/src/fetch.ts`). `GLOBAL-001` says elements MUST consume `@nlqdb/sdk`. The size budget (`SK-ELEM-007`) makes pulling the SDK as-is infeasible at 6 KB; the resolution may be a tree-shaken SDK subset or a redefinition of `GLOBAL-001` to permit element-only inlining. **Track and resolve before declaring `<nlq-data>` v1-stable.**
- **`pk_live_*` issuance is a Slice 11 deliverable.** Today, cross-origin embeds 401 because the API ignores the bearer token (`README.md` "Until Slice 11…"). The element exposes this via `nlq-data:error` `data-kind="auth"`, but the migration recipe — origin-allow-list registration, rotation, scope to specific DBs — is not yet documented in `docs/features/api-keys/FEATURE.md`.
- **`<nlq-action>` cross-origin write-token.** v0.1 ships with cookie-session only ([`SK-ELEM-011`](decisions/SK-ELEM-011-action-cookie-session-only.md)). The follow-up slice that decides the write-token shape (TTL, claim binding, rotation) is the cross-cutting open question tracked in [`api-keys/FEATURE.md`](../api-keys/FEATURE.md); shipping it unblocks third-party HTML embedding of write forms.
- **`<nlq-action>` file uploads.** `FormData` carries `File` values for `<input type="file">`; v0.1 skips them (`SK-ELEM-013` rationale). The upload path (CSV → schema_infer → COPY, or pre-signed R2 URL) is a separate slice — overlaps with the Phase 2 "CSV upload in chat" deliverable.
- **`<nlq-action>` rapid re-submission.** v0.1 cancels any in-flight preview when a new attribute mutation lands, but a user double-clicking the idle button before the first preview returns will fire two preview hops. The second arrives later and overwrites the diff. Defer until observed in production; the cancel/snapshot guard between `confirm` and `applying` already prevents stale commits.
- **Enter-to-submit inside a `<form>`.** A native form's "Enter in any input submits" behaviour only fires when the form has a default submit button (`<button type="submit">`). `<nlq-action>` renders `<button type="button">` so the host stays in full control of the state machine. The trade-off is that pressing Enter in an input does nothing unless the embedder adds their own submit shim. Decide whether to intercept the form's `submit` event in a follow-up slice or document the recommended `<button form="<id>" type="submit" hidden>` workaround.
- **Server-side `render: "html"` (DESIGN §3.5).** The promise of "API returns rendered HTML" is deferred — v0.1 templates render client-side. Decide whether server-side rendering ever ships (it conflicts with the bundle budget if the templates ALSO have to ship to the client for hydration).
- **SSE — opt-in via `transport="sse"`, never auto-upgrade** (resolved per `GLOBAL-033`, wire-format → one way to do each thing). An embed that needs sub-second freshness sets `transport="sse"` explicitly; polling stays the default and `refresh` never silently switches transport (magic auto-upgrade hides a network-behaviour change from the embedder). **Parked until** an embed asks for sub-second freshness — the SSE consumer already exists on `/v1/ask`, so this is wiring, not design.
- **Refresh-poll error backoff — exponential to a ceiling, circuit-break after N failures** (resolved per `GLOBAL-033`, bullet-proof → bound the bad state + pin-a-number → env-tunable, fail-safe). On a failed refresh the poller backs off exponentially from the `refresh` interval to a 5-min ceiling and stops after 10 consecutive failures (surfacing `nlq-data:error`), resuming on the next successful manual reload. **Parked until** the first high-traffic embed lands; values pinned now so the guard is wiring, not a fresh decision.
- **Theming approach.** v0.1 has no theming knobs — embedders style via descendant CSS or shadow DOM workarounds. Decide whether to expose CSS custom properties, `::part`, or stay strict on "consumer styles via plain CSS".
- **SSR posture.** The element registers on `customElements.define`, which requires a browser. SSR consumers (Astro, Next) currently get the elements rendered as `<nlq-data>` / `<nlq-action>` with no upgrade until the script tag executes. This is fine for marketing pages; document the gap so framework-aware wrappers know not to expect SSR HTML output today.

## Happy path walkthrough

User-facing `<nlq-data>` / `<nlq-action>` usage (copy-paste snippet, write
form, `on-success` lifecycle) lives on the docs site sourced from the
canonical e2e example:

- [`docs.nlqdb.com/tutorials/html/`](https://docs.nlqdb.com/tutorials/html/) — tutorial sourced from `examples/html/README.md`.

The "Copy snippet" UX referenced above ships in `SK-WEB-007` — the surface
inlines the user's `pk_live_` into the copied HTML so getting a key is
never a separate errand. The form-field-name → schema-column inference
contract is canonical in [`SK-ELEM-013`](decisions/SK-ELEM-013-action-form-context-in-goal.md).
