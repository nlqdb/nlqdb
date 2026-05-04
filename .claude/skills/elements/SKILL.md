---
name: elements
description: `<nlq-data>` web component for framework-free embedding.
when-to-load:
  globs:
    - packages/elements/**
  topics: [elements, web-component, nlq-data, embedding, cdn]
---

# Feature: Elements

**One-liner:** `<nlq-data>` web component for framework-free embedding.
**Status:** implemented (Slice 10 — `<nlq-data>` v0.1; `<nlq-action>` deferred to Phase 2)
**Owners (code):** `packages/elements/**`
**Cross-refs:** docs/architecture.md §3.5 (the bet) · §14.5 (happy path) · docs/architecture.md §3 (matrix) · `packages/elements/README.md`

## Touchpoints — read this skill before editing

- `packages/elements/src/element.ts` (custom-element class + lifecycle)
- `packages/elements/src/fetch.ts` (single `POST /v1/ask` call)
- `packages/elements/src/render.ts` + `templates.ts` (the safe template registry)
- `packages/elements/src/parse.ts` (attribute parsing — `refresh="60s"` etc.)
- `packages/elements/build.ts` (esbuild config; bundle size budget)
- `packages/elements/dist/v1.js` (the published CDN bundle)

## Decisions

### SK-ELEM-001 — Single web component name `<nlq-data>` registered on first import

- **Decision:** The package registers exactly one custom element today: `<nlq-data>`. The first script-tag or workspace import calls `customElements.define("nlq-data", NlqDataElement)`; subsequent imports are a no-op (idempotent registration). The future write counterpart is `<nlq-action>` (Phase 2 — Slice 11+); no other elements ship under this package.
- **Core value:** Simple, Effortless UX, Goal-first
- **Why:** The pitch is "drop one HTML tag, get a backend" — adding more tags fragments that story. Idempotent registration means a page that imports the package twice (e.g. via two unrelated bundles or a CDN tag plus a workspace import) doesn't throw `NotSupportedError: this name has already been used`. One name, one mental model, one failure mode.
- **Consequence in code:** `packages/elements/src/index.ts` is the only place `customElements.define` is called. New element types require a new package slot under `packages/elements/` *or* an explicit decision in `docs/decisions.md` to expand the surface (per `GLOBAL-017`-style discipline). CI tests assert that double-import is a no-op.
- **Alternatives rejected:**
  - Auto-define a family of related elements per import — more cognitive load for the embedder; if they only want `<nlq-data>` they shouldn't have `<nlq-action>` registered.
  - Defer registration to a function call (`registerElements()`) — adds boilerplate to the marketing pitch ("drop one tag" becomes "drop one tag and call this thing").

### SK-ELEM-002 — Attribute-driven; observed attributes are `goal`, `db`, `query`, `api-key`, `endpoint`, `template`, `refresh`

- **Decision:** All input flows through HTML attributes. Observed: `goal` (NL goal — required for goal-first form), `db` (explicit DB id — required for power-user form), `query` (explicit NL query against an explicit DB), `api-key` (`pk_live_…`), `endpoint` (override of `https://app.nlqdb.com/v1/ask`), `template` (`table` / `list` / `kv` in v0.1; `card-grid` / `chart` later), `refresh` (poll interval, e.g. `10s`, `60s`, `5m`). A change to any of `goal`, `db`, `query`, `api-key`, `endpoint`, `template` schedules an update; `refresh` re-arms the timer only.
- **Core value:** Goal-first, Simple, Effortless UX
- **Why:** HTML attributes are the framework-free contract — they work in static HTML, every framework's templating, every CMS's HTML field, every page builder. Anything beyond attributes (props, methods, events) requires JavaScript; embedding into a marketing page or no-code builder must work without that. The two attribute-shapes (`goal` alone vs `db` + `query`) realise the goal-first / power-user duality from `docs/architecture.md §0.1`.
- **Consequence in code:** `observedAttributes` is the canonical list. `attributeChangedCallback` dispatches to (a) `setupRefresh()` for `refresh`, (b) `scheduleUpdate()` for the fetch-relevant subset (`FETCH_ATTRS`). Adding a new attribute requires a `parse.ts` entry, a slot in the fetch payload (`fetch.ts`), an `observedAttributes` row, and a `FETCH_ATTRS`-vs-refresh-only classification. No DOM-property-only options.
- **Alternatives rejected:**
  - Property-only API (`el.goal = "..."`) — breaks the static-HTML embed story.
  - JSON config attribute (`<nlq-data config='{"goal": "...", ...}'>`) — bigger HTML, harder to template-inject, error-prone for non-developer embedders.

### SK-ELEM-003 — `POST /v1/ask` is the only network call; defaults to `https://app.nlqdb.com/v1/ask`

- **Decision:** Each render fetches via `POST /v1/ask` with the request body assembled from attributes. Default endpoint is `https://app.nlqdb.com/v1/ask`. The `endpoint` attribute overrides for self-hosters and preview deploys (e.g. `endpoint="https://app.nlqdb.com/v1/demo/ask"` for the marketing-site demo, or `endpoint="https://pr-42.preview.nlqdb-elements.pages.dev/v1/ask"` for PR previews). The element does **not** speak directly to Postgres or any database; it only speaks to the API.
- **Core value:** Simple, Bullet-proof
- **Why:** A single endpoint is the smallest network surface — no auth-shape branching, no per-template URL paths, no client-side query construction. Letting the embedder override the endpoint covers self-hosting, the public demo path (`/v1/demo/ask`, see `apps/api/src/demo.ts`), and PR previews without forking the element. Talking to the API rather than directly to Postgres is what makes `pk_live_*` keys safe — see SK-ELEM-005.
- **Consequence in code:** `fetch.ts` constructs exactly one URL from `endpoint` (or `DEFAULT_ENDPOINT`) and one POST. No `GET` paths, no other endpoints called. CI test asserts no `fetch()` call inside `packages/elements/` references a path other than the configured endpoint. **Security warning** (`README.md`): never bind `endpoint=` to user-controlled input — the element sends `api-key` to whatever URL `endpoint` resolves to.
- **Alternatives rejected:**
  - Direct Postgres connection from the browser — leaks the connection string; no rate-limit / allowlist; contradicts the entire ask-pipeline story.
  - SSE-only transport — Phase 0 ships polling; SSE upgrade is a Phase 1+ enhancement (deferred per README "What's NOT in v0.1").

### SK-ELEM-004 — Safe template registry (`table`, `list`, `kv` in v0.1) — LLM never returns raw HTML

- **Decision:** Rendered output goes through a small fixed template registry. v0.1 ships three templates: `table`, `list`, `kv`. v1+ adds `card-grid` and `chart`. The API returns `{ answer, data, ...trace }`; the element renders client-side via the chosen template. The LLM never returns raw HTML to the browser — XSS is structurally impossible because the templates control every element creation.
- **Core value:** Bullet-proof, Simple, Creative
- **Why:** A "render whatever JSON the LLM gives you" approach is one prompt-injection away from script execution. Constraining output to a registry makes XSS unreachable: the templates accept typed JSON and produce DOM, and there's no path for an attacker to inject `<script>` because we never `innerHTML` a value we didn't validate. The template registry also gives us a finite, testable visual surface — every embedder gets predictable HTML structure.
- **Consequence in code:** `templates.ts` is the only module that creates DOM nodes from response data. New templates are added there with explicit type contracts. Reviewers reject any `el.innerHTML = response.data` style code path. The DESIGN §3.5 promise ("`render: "html"`" with server-side HTML) is **deferred**: today the API returns rows + the element renders client-side from templates. Server-side `render: "html"` is in `README.md`'s "What's NOT in v0.1" list.
- **Alternatives rejected:**
  - LLM-rendered HTML returned in the response — XSS in one line; we'd be one prompt-injection from a global compromise of every embed.
  - Render-by-template-string (Mustache, Handlebars) — adds a parser to the bundle, contradicts `GLOBAL-013`'s 6 KB ceiling.

### SK-ELEM-005 — `pk_live_*` publishable keys: read-only, per-DB, origin-pinned, rate-limited

- **Decision:** The element authenticates with a `pk_live_*` publishable key passed as `api-key=`. The API treats `pk_live_*` as **read-only**, scoped to a single DB, **origin-pinned** (rejects requests from origins other than the registered allow-list for that key), and rate-limited per `.claude/skills/rate-limit/SKILL.md`. Same-origin cookie sessions also work when the embedding page is on `app.nlqdb.com` itself, but `__Host-` cookies don't transmit cross-origin so this only covers internal-tools use cases. **Writes require `<nlq-action>` with a signed write-token (Phase 2).**
- **Core value:** Bullet-proof, Effortless UX, Free
- **Why:** A leaked `pk_live_*` from a public marketing page must not be a compromise vector — read-only + origin-pinning + rate-limit means the worst case is an attacker reading the same data the marketing page already shows, at the same rate the marketing page is allowed. This is the only safe shape for an in-HTML credential. Cross-origin cookies are explicitly out (`credentials: include` + `__Host-` is browser-blocked), so `pk_live_*` is the only path for third-party embeds.
- **Consequence in code:** The element sends `Authorization: Bearer <api-key>` only. It warns to console when `api-key` is sent over plain HTTP. The element does NOT attempt write operations — `<nlq-data>` is reads-only by construction; writes will land via `<nlq-action>` Phase 2. **Until Slice 11 lands `pk_live_*` issuance, cross-origin embeds 401** (the bearer is sent but the API ignores it today). The element surfaces this honestly via `nlq-data:error` with `data-kind="auth"`.
- **Alternatives rejected:**
  - Embed `sk_live_*` (secret keys) — server-only secret in HTML; one-line credential leak.
  - No origin-pinning — leaked keys exfiltrate data from any origin until rotated.
  - Browser-side write capability via `pk_live_*` — read-only is the structural defence; writes require a signed short-lived token.

### SK-ELEM-006 — Single ESM bundle at `dist/v1.js`; CDN-first distribution

- **Decision:** The element ships as a single ESM file at `packages/elements/dist/v1.js`, published via Cloudflare Pages project `nlqdb-elements` (currently `nlqdb-elements.pages.dev/v1.js`; eventual `elements.nlqdb.com/v1.js`). Embedders use a `<script type="module" src="https://elements.nlqdb.com/v1.js"></script>` tag. Workspace consumers can `import "@nlqdb/elements"` for the same registration side-effect.
- **Core value:** Effortless UX, Free, Simple
- **Why:** A single ESM file is the framework-free distribution path: one `<script>` tag, no bundler, no npm install, no build step on the embedder's side. ESM gives import-once semantics so accidental double-loads no-op. Cloudflare Pages is free and gives sticky PR-preview URLs (`pr-<N>.nlqdb-elements.pages.dev/v1.js`) so embedders can test against unmerged changes.
- **Consequence in code:** `build.ts` produces exactly one output: `dist/v1.js`. No CommonJS, no UMD, no per-template chunked output. Versioning lives in the URL path (`/v1.js` is the v1 surface; v2 ships at a separate path). Workspace consumers re-export the same module so behaviour is byte-identical between CDN and import paths.
- **Alternatives rejected:**
  - Multiple chunks per template — defeats the "one tag, one fetch" pitch and adds HTTP-2 multiplexing complexity for no gain at this size.
  - npm-only distribution — third-party HTML pages can't depend on `npm install`.

### SK-ELEM-007 — < 6 KB gzipped bundle ceiling enforced in CI

- **Decision:** The CDN bundle is hard-capped at < 6 KB gzipped. CI's `packages/elements (esbuild + bundle-size)` job (`.github/workflows/ci.yml`) fails the build if `gzip -c dist/v1.js | wc -c` reaches 6144 bytes.
- **Core value:** Free, Fast, Simple
- **Why:** Marketing pages — the primary embed target — care about Lighthouse 100s. A multi-KB element loaded on every page above the fold compounds across the funnel. 6 KB is the ceiling at which a `<script type="module">` doesn't move the needle for a tuned page. The cap also forces dependency discipline: no parsers, no big crypto libs, no framework runtimes (the package depends on no third-party runtime today). This is the elements-specific manifestation of `GLOBAL-013`'s bundle discipline.
- **Consequence in code:** Adding a dep requires showing the post-build `dist/v1.js` size. `build.ts` has esbuild minification + tree-shaking on. The package has zero runtime dependencies (verified by `package.json`'s `dependencies` block). CI runs the size check on every PR; reviewers reject any change that pushes the bundle over budget.
- **Alternatives rejected:**
  - Soft warning at 6 KB — bundles only ever grow under soft caps.
  - Separate "lite" and "full" bundles — embedders can't tell which to pick; defeats the one-tag pitch.

### SK-ELEM-008 — `nlq-data:load` and `nlq-data:error` events; `aria-live="polite"` by default

- **Decision:** The element dispatches two custom events: `nlq-data:load` (success — `detail = { rows, cached }`) and `nlq-data:error` (failure — `detail = { kind: "network" | "auth" | "api", status?, error? }`). Both bubble and compose. The host element gets `aria-live="polite"` by default (skipped when the author has set their own value) so screen-reader users get announced state transitions without any author wiring.
- **Core value:** Effortless UX, Bullet-proof, Honest latency
- **Why:** Custom events are the standard custom-element extension point — embedders can listen on the element or on a container without wiring a callback prop. The event detail carries enough context (`kind` slug + optional `status`) to drive a UX response (auth banner, retry, fall-back). `aria-live="polite"` defaulted-on is the accessible default; defaulting it off would mean every embedder has to remember it, which means most won't.
- **Consequence in code:** The event names and `kind` slugs are part of the public API; renames break consumers. Reviewers reject any added event without explicit decision-log entry. `connectedCallback` sets `aria-live="polite"` only when `!this.hasAttribute("aria-live")` — it never overrides an author choice. The error `kind` taxonomy is closed: `network`, `auth`, `api` (with `api` carrying `status` for HTTP-level branching).
- **Alternatives rejected:**
  - Callback props (`onload`, `onerror` attributes) — events compose with the rest of the DOM event system; callbacks don't.
  - No accessibility default — the package would silently ship as inaccessible by default.

### SK-ELEM-009 — `refresh="<duration>"` poll with microtask coalescing; client-side refresh is "dumb"

- **Decision:** `refresh="60s"` re-fetches every 60 s while the element is connected. Multiple synchronous attribute changes coalesce into one fetch via `queueMicrotask`. The minimum poll interval is 250 ms (anything below clamps and warns once). On disconnect, the timer + in-flight request are torn down. **The client does not back off on errors today** — refresh polls hammer at the configured cadence regardless of failure.
- **Core value:** Honest latency, Effortless UX, Simple
- **Why:** Polling is the simplest cross-browser refresh primitive — every browser supports it, no SSE / websocket setup. Microtask coalescing means setting `goal`, `db`, `template` in sequence triggers one fetch, not three (otherwise framework-driven attribute updates would create an N-fetch storm). The 250 ms floor is a hand-grenade defence: `refresh="1ms"` is pure CPU burn for no UX gain. Error-backoff is deliberately deferred — marketing pages don't usually fail in patterns that need backoff, and the bundle budget pushes against per-feature complexity.
- **Consequence in code:** `attributeChangedCallback` and the imperative `refresh()` method both call `scheduleUpdate()`, which is microtask-coalesced. `setupRefresh()` reads `parseRefresh()`'s clamped value. `disconnectedCallback` MUST tear down the timer and abort the in-flight fetch (else the next `connectedCallback` leaks). The "no backoff" gap is documented in `README.md`'s "What's NOT in v0.1".
- **Alternatives rejected:**
  - SSE auto-upgrade today — adds complexity and a parser; deferred to a slice that has a real use-case.
  - Exponential backoff on errors — adds state machine to the element; defer until poll-storm is observed in production.

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-001** — SDK is the only HTTP client.
- **GLOBAL-002** — Behavior parity across surfaces.
- **GLOBAL-013** — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed.

## Open questions / known unknowns

- **`<nlq-data>` does not yet consume `@nlqdb/sdk` (a `GLOBAL-001` debt).** The element today owns its `fetch()` against `endpoint` directly (`packages/elements/src/fetch.ts`). `GLOBAL-001` says elements MUST consume `@nlqdb/sdk`. The size budget (`SK-ELEM-007`) makes pulling the SDK as-is infeasible at 6 KB; the resolution may be a tree-shaken SDK subset or a redefinition of `GLOBAL-001` to permit element-only inlining. **Track and resolve before declaring `<nlq-data>` v1-stable.**
- **`pk_live_*` issuance is a Slice 11 deliverable.** Today, cross-origin embeds 401 because the API ignores the bearer token (`README.md` "Until Slice 11…"). The element exposes this via `nlq-data:error` `data-kind="auth"`, but the migration recipe — origin-allow-list registration, rotation, scope to specific DBs — is not yet documented in `.claude/skills/api-keys/SKILL.md`.
- **`<nlq-action>` writes counterpart.** Phase 2 deliverable. Form-field-to-column inference is the trickiest design problem in this package; capture inference rules in a future SK-ELEM-NNN before the slice opens.
- **Server-side `render: "html"` (DESIGN §3.5).** The promise of "API returns rendered HTML" is deferred — v0.1 templates render client-side. Decide whether server-side rendering ever ships (it conflicts with the bundle budget if the templates ALSO have to ship to the client for hydration).
- **SSE auto-upgrade.** Polling is fine for marketing dashboards; an embed that needs sub-second freshness wants SSE. Decide a trigger: either a `transport="sse"` opt-in or auto-upgrade based on `refresh` value.
- **Error backoff during refresh polling.** Today the timer fires regardless of recent errors — a wedged endpoint generates one request per `refresh` interval forever. Decide a backoff policy (exponential to a ceiling? circuit-break after N consecutive failures?) before high-traffic embeds become a self-inflicted DoS.
- **Theming approach.** v0.1 has no theming knobs — embedders style via descendant CSS or shadow DOM workarounds. Decide whether to expose CSS custom properties, `::part`, or stay strict on "consumer styles via plain CSS".
- **SSR posture.** The element registers on `customElements.define`, which requires a browser. SSR consumers (Astro, Next) currently get the element rendered as `<nlq-data>` with no upgrade until the script tag executes. This is fine for marketing pages; document the gap so framework-aware wrappers know not to expect SSR HTML output today.

## Happy path walkthrough

### §14.5 `<nlq-data>` HTML element

**Default (goal-first, the whole "backend"):**

```html
<script src="https://elements.nlqdb.com/v1.js" type="module"></script>

<nlq-data
  goal="the 5 newest orders, with customer and item"
  api-key="pk_live_xxx"
  template="table"
  refresh="10s"
></nlq-data>
```

That's the entire backend for a live order list. There is no API to write, no schema to define, no JSON to parse, no React to render. The element fetches, renders the table template, and refreshes every 10 seconds.

**Getting `api-key` is never a separate errand.** Every chat surface — web, CLI, MCP — offers a "Copy snippet" action next to any generated query; the copied HTML has the user's `pk_live_` already inlined. The user never has to open the dashboard, find the keys page, click "Reveal", and paste. The key is right there, in the code they were about to use (per `SK-WEB-007`).

**Day-2 (still no backend):**

```html
<form>
  <input name="customer" />
  <input name="drink" />
  <input name="total" />
  <nlq-action
    goal="add an order from this form"
    api-key="pk_live_xxx"
    on-success="reload"
  >Submit</nlq-action>
</form>
```

`<nlq-action>` is the write counterpart. Same template-registry safety model as `<nlq-data>`. The form's field names are inferred into columns automatically.
