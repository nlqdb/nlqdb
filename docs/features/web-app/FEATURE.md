---
name: web-app
description: Marketing + product web app — onboarding, anonymous-mode default, demo dataset.
when-to-load:
  globs:
    - apps/web/**
  topics: [web, onboarding, anonymous-mode, demo]
---

# Feature: Web App

**One-liner:** Marketing + product web app — onboarding, anonymous-mode default, demo dataset.
**Status:** partial (Phase 1.5 — Phase 1 surfaces shipped; GLOBAL-024 wishlist landed via `SK-EVENTS-011`; `SK-WEB-010` bridges marketing-create Copy-snippet to the chat-side Copy snippet).
**Owners (code):** `apps/web/**`
**Cross-refs:** docs/architecture.md §3.1–§3.2 (marketing + platform web app) · docs/runbook.md §10 (P1, P3, P5) · docs/phase-plan.md §2 (Phase 1 web slices)

## Touchpoints — read this feature before editing

- `apps/web/**`

## Decisions

### SK-WEB-001 — Astro static-first with React islands; one project for marketing + product; every island ships behind an ErrorBoundary; no blank screens

- **Decision:** `apps/web` is a single Astro project. Marketing pages (`nlqdb.com`) ship as static-first Astro routes (0 KB JS by default); product pages (`app.nlqdb.com`) are Astro routes with React islands for chat, dashboard, and key management. **Every React island is wrapped in `<ErrorBoundary>` (`apps/web/src/components/ErrorBoundary.tsx`) and `Base.astro` ships an inline pre-hydration `boot-fallback` block.** A render throw never produces a blank `<main>`; a chunk-load or top-level eval failure never produces an empty body. Persisted-state loaders (`localStorage` histories) shape-validate before returning hydrated values. Crashes POST best-effort to `/v1/errors/web` so client-side throws land in the same OTel pipeline as server errors.
- **Core value:** Free, Fast, Simple, Bullet-proof
- **Why:** A single project gives one build, one deploy, one component set, one design system. The Lighthouse 100/100/100/100 marketing target needs static-first; the product surface needs interactive islands. Astro is the only popular framework that does both without forking the project, and keeps `GLOBAL-013` (≤3 MiB Workers bundle) attainable — static pages contribute ~0. The ErrorBoundary + boot-fallback layer is non-negotiable: production hit a stale-history throw in `ChatPanel` that vanished the whole chat surface with no recovery affordance. A blank screen is the worst failure mode — no call to action, no breadcrumb. Defence-in-depth (type narrowing + ErrorBoundary + pre-hydration handler + history shape guard) keeps every reachable failure visible.
- **Consequence in code:** `apps/web` has one `astro.config.mjs`, one `package.json`. React appears only inside `*.tsx` islands; routes are `*.astro`. State in islands is URL-first (every chat is permalinkable). No global Redux. Marketing pages stay JS-free unless an island is genuinely required. **Every island's top-level component renders its children inside `<ErrorBoundary>` (`*Inner` split); new islands MUST do the same — reviewers reject otherwise.** `Base.astro` ships the `#boot-fallback` recovery block; persisted-state loaders shape-guard before returning hydrated values.
- **Alternatives rejected:**
  - Two projects (Next.js product + Astro marketing) — duplicated tokens, components, deploys; double the surface.
  - Next.js for everything — heavier client bundles by default; misses the static-marketing message.
  - Page-level-only error catching — misses `client:only` islands, which replace rather than enhance the SSR markup.

### SK-WEB-002 — Goal-first hero: one input, no pricing dialog, no signup wall

- **Status:** Superseded in part by [`SK-WEB-017`](./decisions/SK-WEB-017-connect-first-hero.md). The no-signup-wall floor (GLOBAL-007) and the morph-to-chat behaviour are **retained**; only the "one input is THE hero" structural claim is replaced — the home hero now leads with the SK-WEB-016 `<McpInstall>` row as primary, with the goal input retained as a secondary affordance below it. `/agents` already followed that split; SK-WEB-017 extends it to `/`.
- **Decision:** The marketing-site hero centres a single goal input — *"What are you building?"* — that morphs into a chat via View Transitions (first reply streams; the DB materializes silently). No pricing dialog, no "create your first database" button, no signup wall before first value. (SK-WEB-017 demotes the input from *primary* to *secondary* on the home hero; the no-wall floor and morph behaviour below are retained.)
- **Core value:** Goal-first, Effortless UX, Free
- **Why:** No persona ever woke up wanting to "create a database" (`docs/runbook.md §10`). The goal-first inversion (`docs/architecture.md §0.1`) is core; every required input before first value drops the funnel, so the no-wall floor is non-negotiable.
- **Consequence in code:** The chat morph is in-place (View Transitions), not navigation; the input works with JS off (submits to a fallback chat URL). No dialog / modal / "are you sure" interrupts first value.
- **Alternatives rejected:**
  - Required signup with "free trial" framing — worse for activation; contradicts `GLOBAL-007`.
  - Region picker + project name on first run — `GLOBAL-020` rejects this.

### SK-WEB-003 — Above-the-fold is runnable code, not feature bullets

- **Decision:** Above the fold on `nlqdb.com/` is either a working snippet or proof that snippets work — never feature bullets, logo grids, or "trusted by" strips. The tabbed code-example panel renders against the same demo DB; switching tabs swaps the surface.
- **Core value:** Honest latency, Creative, Goal-first
- **Why:** "The contrast IS the message" — every snippet is the entire backend. Marketing copy that we can't back up with a working snippet is a smell. Working snippets above the fold also do double duty for AEO/GEO (LLM crawlers cite working examples preferentially) and for our own conversion data (which surface visitors copy first is leading signal for framework-wrapper investment).
- **Consequence in code:** `apps/web/src/components/CodePanel.astro` carries one snippet per surface — currently CLI · HTML · React · Vue · SDK · curl · MCP · Swift (canonical list lives in [`apps/web/src/data/snippets.ts`](../../../apps/web/src/data/snippets.ts)). Each has a copy button that emits `home.snippet_copied` to LogSnag with `surface = <snippet id>`. New surfaces add a `Snippet` entry plus one matching `<Fragment slot="…">` in `CodePanel.astro`; surfaces not yet shipped carry an honest Phase 1/2 badge in the matrix below the panel — no fake working claims. Mirror the snippets in `/code-samples.txt` so non-JS crawlers see the same proof.
- **Alternatives rejected:**
  - Hero video / animated explainer — opaque to crawlers, slow to first paint, ages badly.
  - Logo wall — irrelevant in pre-PMF, dilutes the "code is the proof" message.

### SK-WEB-004 — Demo endpoint `POST /v1/demo/ask`: no auth, canned fixtures, server-owned

- **Status:** Superseded by `SK-WEB-008` (canned fixtures lied on a matcher miss; the demo now hits real `/v1/ask` with an anon bearer). See `SK-WEB-008` for the live rationale.

### SK-WEB-008 — Demo === real `/v1/ask` with anon bearer; canned fixtures live only in the static carousel

- **Decision:** Supersedes `SK-WEB-004`. The marketing hero, `/app/new`, and any first-party `<nlq-data>` surface all hit `POST /v1/ask` with `Authorization: Bearer anon_<token>` (SK-ANON-008). The `/v1/demo/ask` route is deleted. Canned fixtures continue to exist only in `apps/web/src/components/Carousel.astro` (`SHOWCASE_EXAMPLES`) — pre-rendered HTML strings, no network call. Free-LLM-proxy abuse is prevented by the global anon cap (`SK-ANON-010`, 100/hr / 1000/day / 10k/month) layered on the per-IP buckets (`SK-ANON-004` / `SK-RL-007`).
- **Core value:** Honest latency, Goal-first, Bullet-proof
- **Why:** A canned-fixture demo lies by accident the moment a user types something the regex-matcher doesn't recognise — the opposite of SK-WEB-003's "above the fold is runnable proof". (Repro: "Create a new workspace named omer" fell through `demo.ts`'s regexes to the orders default under a *"matching '<your goal>'"* line.) The new posture pays a per-call LLM cost (capped) for the right to never lie. Carousel fixtures keep their place — visibly static "shapes the LLM produces", not "answers to your goal".
- **Consequence in code:** `/v1/demo/ask` route + CORS rule deleted from `apps/api/src/index.ts`; `parseGoalBody` dropped from `apps/api/src/http.ts`; `apps/api/src/demo.ts` survives only as a library (`buildDemoResult`, imported by `chat/demo-shortcut.ts`, scheduled for retirement). Marketing hero and `/app/new` both render the shared `<CreateForm>` island; the element (`packages/elements`) keeps zero "isDemo" branches — its `endpoint` points at `/v1/ask` for marketing too.
- **Alternatives rejected:**
  - A thin `/v1/demo/ask` alias that auto-mints an anon bearer — still a round-trip and splits rate-limit accounting across two paths; cleaner to delete.
  - Two endpoints with separate caps — two budgets, two SDK shapes, two test suites; the global cap solves abuse without forking surfaces.
  - Keep canned fixtures but refuse fall-through — honest about limits, but teaches that nlqdb is fixture-bound.

### SK-WEB-005 — Three-part chat response: answer + data + trace

- **Decision:** The product chat (`app.nlqdb.com`) renders every reply as three parts: a one-sentence answer in prose, the raw data (table / list / kv / chart), and a collapsible trace (cache lookup → plan → validate → exec → summarize, with timings). The trace is toggled by `Cmd+/`; the palette is `Cmd+K`.
- **Core value:** Honest latency, Effortless UX, Bullet-proof
- **Why:** The trace IS the live-trace surface for `GLOBAL-011` — without it, latency is opaque and users have no way to debug. Always attaching the raw data ensures we never paraphrase away the truth (the answer is a summary; the data is the proof). The answer-first ordering keeps the goal-first promise — the user gets their number before the engineering details.
- **Consequence in code:** Chat panel components render three children per reply: `<Answer>`, `<Data>`, `<Trace>`. `<Trace>` consumes the SDK's `onTrace` hook (per the sdk feature, `SK-SDK-007`). In-place edit + re-run is supported on the answer; Cmd+/ toggles the trace globally; Cmd+K opens the palette. Result-table column headers are rendered through `prettifyHeader()` so LLM-emitted snake_case identifiers display as `Title Case`.
- **Alternatives rejected:**
  - Spinner + final answer (no trace) — `GLOBAL-011` explicitly rejects this.
  - Markdown blob with everything inline — harder to copy data, harder to deep-link.

### SK-WEB-006 — Cookie is `__Secure-session` with cross-subdomain `Domain=nlqdb.com`

- **Status:** Superseded by `SK-WEB-009` once `apps/web` and `apps/api` merged into one same-origin worker (the merge removes the cross-subdomain `Domain=` need). See `SK-WEB-009` for the live cookie posture.

### SK-WEB-009 — Host-only `__Secure-…session` cookie on `app.nlqdb.com` after the web/API merge

- **Decision:** After `apps/web` is served from the same Cloudflare Worker as `apps/api` (Workers Static Assets `[assets]` binding pointing at `apps/web/dist`), Better Auth's `crossSubDomainCookies` block is removed. The session cookie has no `Domain=` attribute, making it host-only on `app.nlqdb.com`. Better Auth still hardcodes the `__Secure-` prefix in v1.6.9 (`node_modules/better-auth/dist/cookies/index.mjs:30`), so the literal cookie name is `__Secure-${cookiePrefix}.session_token` — the browser-prefix protection that matters in practice (Secure attribute required, no cross-subdomain travel) is enforced by `__Secure-` plus host-only.
- **Core value:** Bullet-proof, Seamless auth, Effortless UX
- **Why:** Pre-merge the cookie travelled across two eTLD+1s (`nlqdb.com` ↔ `app.nlqdb.com`) via the `Domain=.nlqdb.com` attribute, but Workers-Versions previews land on a third eTLD+1 (`*-nlqdb-web.omer-hochman.workers.dev`) that was never inside the cookie scope. Browser third-party-cookie partitioning then dropped the cookie on cross-eTLD+1 fetches into the API, surfacing as a 401 in preview branches and the `SK-AUTH-015` OAuth-state bug. Collapsing the product UI + API onto one origin makes every product-side request first-party, so the cookie no longer has to travel. Marketing on `nlqdb.com` loses the cross-subdomain UX (authed visitors see "Sign in") — accepted because the marketing-side authed signal was always best-effort and is now delivered by the product's own auth guard at `/app`.
- **Consequence in code:** `apps/api/src/auth.ts` drops `crossSubDomainCookies`, keeps `cookiePrefix: "__Secure"` (Better Auth 1.6.9 limitation — see Open questions). `apps/api/wrangler.toml` adds `[assets]` pointing at `../web/dist`. `apps/web/src/lib/session.ts` and `chat-client.ts` default `apiBase` to `""` (same-origin). The OAuth-init wrapper at `/api/auth/oauth-init/:provider` (`SK-AUTH-015`) is retained — it is harmless when same-origin and still required for any future cross-origin entry. PRs that re-introduce a `Domain=` attribute (or any other cross-subdomain cookie shape) on the production session cookie are rejected.
- **Alternatives rejected:**
  - **Keep two workers and `Domain=.nlqdb.com` indefinitely** — cookie still travels cross-origin for previews; browser-partitioning trend widens.
  - **Literal `__Host-…session` cookie now** — Better Auth 1.6.9 hardcodes the `__Secure-` prefix; tracked as an open question.
  - **Set `Domain=app.nlqdb.com` explicitly** — equivalent in browser semantics, but a future `__Host-` promotion would also have to strip Domain.

### SK-WEB-007 — "Copy snippet" inlines the user's `pk_live_` so the key is never a separate errand

- **Decision:** Every chat-generated `<nlq-data>` snippet has the user's `pk_live_<dbId>` already inlined when copied. Anonymous users get a temporary `pk_live_` that rotates to a permanent one on sign-in. The user never has to open the dashboard, find the keys page, click "Reveal", and paste.
- **Core value:** Effortless UX, Goal-first, Seamless auth
- **Why:** Getting an API key is the kind of side errand that breaks the goal-first flow. The user wanted an embed; making them collect a key first interrupts the moment. Inlining the key in the chat-copy action keeps the user inside one window. For anonymous users, rotating the key on sign-in is the seamless adoption path (`GLOBAL-007`).
- **Consequence in code:** Chat panel's "Copy snippet" CTA pre-fills `api-key="pk_live_…"` server-side from the user's (or anonymous device's) per-DB key. The temporary anonymous key is rotated to a permanent one on sign-in via the same endpoint that adopts the anonymous DB. Tested end-to-end in `docs/features/elements/FEATURE.md`. The marketing-page create-result surfaces the *shape* of the same snippet but defers key inlining to the chat — see `SK-WEB-010`.
- **Alternatives rejected:**
  - Show the key in the chat as text + ask the user to copy it — extra step, easy to lose, leaks into chat history.
  - Require sign-in before "Copy snippet" works — breaks the no-login-wall promise.

### SK-WEB-010 — Marketing-page Copy-snippet shows the embed shape; key inlining stays in the chat

**Body:** [`decisions/SK-WEB-010-marketing-copy-snippet-shape.md`](./decisions/SK-WEB-010-marketing-copy-snippet-shape.md).
The marketing create result (`CreateResultView`) renders an embed snippet with `api-key="pk_live_REPLACE_ME"` placeholder + a "Sign in to continue →" CTA; the real `pk_live_` inlining stays in one place only — the chat's per-answer Copy snippet (`SK-WEB-007`) — because the anon device cap (`SK-ANON-012`) is consumed by the create call, so a live anon key would 401. Two `GLOBAL-024` events fire so the funnel reads *snippet-engaged → signed-in*.

### SK-WEB-011 — Post-checkout confirmation banner on `/app`, honest about pending subscription state

**Body:** [`decisions/SK-WEB-011-checkout-success-banner.md`](./decisions/SK-WEB-011-checkout-success-banner.md).
`/app?checkout=success` reveals a dismissible one-time `role="status"` banner after the auth guard passes — copy claims payment received, **not** plan-active (the subscription may still be `incomplete` per SK-STRIPE-004) — and strips the param via `history.replaceState` so it never replays.

### SK-WEB-012 — In-app dunning banner on `/app`, driven by the live `past_due`/`unpaid` status

**Body:** [`decisions/SK-WEB-012-dunning-banner.md`](./decisions/SK-WEB-012-dunning-banner.md).
After the `/app` auth guard passes, a non-blocking `GET /v1/billing/status` read reveals a **non-dismissible** `role="alert"` banner on `past_due`/`unpaid` with an "Update payment method" Billing-Portal button (`lib/billing.ts`, shared with `/pricing`); it clears once a status read comes back healthy.

### SK-WEB-013 — `/pricing` surfaces a scheduled cancellation; the current-tier CTA becomes one-click "Resubscribe"

**Body:** [`decisions/SK-WEB-013-cancellation-transparency.md`](./decisions/SK-WEB-013-cancellation-transparency.md).
When `GET /v1/billing/status` reports `cancelAtPeriodEnd`, the `/pricing` current-plan badge reads *"Ends {date}"* and that tier's CTA becomes a **"Resubscribe"** via the Billing Portal (Stripe un-cancels) — no silent lapse; SK-STRIPE-010's no-double-bill guard still holds.

### SK-WEB-014 — Homepage declares its brand entity: Organization + WebSite JSON-LD, no SearchAction

**Body:** [`decisions/SK-WEB-014-site-entity-json-ld.md`](./decisions/SK-WEB-014-site-entity-json-ld.md).
`nlqdb.com/` (root only) emits `Organization` + `WebSite` JSON-LD (`apps/web/src/lib/site-jsonld.ts`) with stable `@id`s; every page's `SoftwareApplication` names that Organization as `publisher` by `@id` so crawlers consolidate one brand entity. No `SearchAction` — the goal-first hero (`SK-WEB-002`) has no GET `q` entrypoint.

### SK-WEB-015 — Three-beat homepage + quiet-brutalism token system

**Status:** superseded — the three-beat IA on `/` by [`SK-WEB-018`](./decisions/SK-WEB-018-two-door-home.md) (two-door home), and the quiet-brutalism **token system by [`SK-WEB-020`](./decisions/SK-WEB-020-calm-token-system.md)** (the calm system), site-wide.

**Body:** [`decisions/SK-WEB-015-three-beat-quiet-brutalism.md`](./decisions/SK-WEB-015-three-beat-quiet-brutalism.md).
One quiet-brutalism token system in `global.css` (neutrals + one accent gated to three lime moments per fold, three faces, five type steps, two widths, two gaps) and a three-beat homepage IA — WHAT (hero) → HOW (`Demo.astro` live `/v1/ask` + snippet) → WHY (`Replaces.astro` + one CTA). Off-`/` blocks (`AgentMemoryBand`, `AlsoWorksFor`, `ResearchReceipts`, `ManifestoExcerpt`) removed; `/vs/*` and `/solve/*` collapse to one what-we-replace template; one motion moment per page, `prefers-reduced-motion`-gated.

### SK-WEB-016 — One-click MCP install affordance: shared `<McpInstall>` at five venues, deep-link where supported

**Body:** [`decisions/SK-WEB-016-mcp-install-affordance.md`](./decisions/SK-WEB-016-mcp-install-affordance.md).
A shared MCP-install surface (host descriptors in `lib/mcp-install.ts`) renders host buttons — Cursor/VS Code via deep-link, Claude Code/Codex via command, Claude/Windsurf/Zed via paste-ready per-host JSON — at five venues: Door A of the two-door home, `/agents` hero (under the form), post-create `CreateResultView`, `/integrations`, and the **`/app` chat window** ("Install MCP" trigger in the `LeftRail` → focus-trapped popover). Rendered by `McpInstall.astro` (marketing SSR) and the shared React `McpInstallView` (`components/McpInstallView.tsx`, imported by the post-create view + the chat popover so the React venues can't drift). One promoted button per row (`SK-WEB-015`/`SK-WEB-020`); `pk_live_REPLACE_ME` placeholder + sign-in nudge on anon surfaces (`SK-ANON-012` / `SK-WEB-010`); `SK-WEB-002` kept (install only after the CTA, never on the homepage hero).

### SK-WEB-017 — Connect-first hero on the agent-memory home; goal input retained as secondary

**Status:** superseded in part by [`SK-WEB-018`](./decisions/SK-WEB-018-two-door-home.md) — the connect-first vertical hero on `/` is replaced by the two-door chooser; SK-WEB-017's `<McpInstall>`-primacy is **absorbed into Door A**.

**Body:** [`decisions/SK-WEB-017-connect-first-hero.md`](./decisions/SK-WEB-017-connect-first-hero.md).
The home hero leads with the SK-WEB-016 `<McpInstall compact>` row of host buttons ("Connect it to your agent.") as the **primary** affordance; the goal text input (`<CreateForm>`) is retained below it as a quieter secondary ("Or spin one up yourself —") separated by a `--rule` line. The form still posts to `/v1/ask` (SK-ANON-008), still morphs to chat, still requires no sign-in (GLOBAL-007) — only its visual primacy demotes. Supersedes SK-WEB-002's "one input IS the hero" claim in place (no-signup-wall floor + morph-to-chat retained). Closes the gap WS-13 / SK-PIVOT-013 left — the headline strings now match the hero's primary action.

### SK-WEB-018 — Two-door home: agent-memory door + question-your-ClickHouse door

**Body:** [`decisions/SK-WEB-018-two-door-home.md`](./decisions/SK-WEB-018-two-door-home.md).
The home (`/`) becomes a responsive two-door chooser (side-by-side wide, stacked narrow): **Door A** "Use as agent memory" (the SK-WEB-016 `<McpInstall>` host row, click→reveal-fallback-in-place, plus a quiet *"or just describe your data →"* link to `/app/new`) and **Door B** "Question your ClickHouse" (CTA → sign-in → `/app/connect`). Replaces the SK-WEB-015 / SK-WEB-017 three-beat-on-`/` IA (now rendered in the SK-WEB-020 calm token system; SK-WEB-017's McpInstall primacy absorbed into Door A); the literal expression of GLOBAL-036's dual front door; GLOBAL-007 preserved via the `/app/new` link.

### SK-WEB-019 — `/app/connect`: auth-guarded BYO-connect page + `ConnectForm.tsx`

**Body:** [`decisions/SK-WEB-019-connect-page.md`](./decisions/SK-WEB-019-connect-page.md).
`/app/connect` is auth-guarded (anon → `/auth/sign-in?return_to=/app/connect`) and mounts `ConnectForm.tsx`: an engine select (default ClickHouse), a `type="password"` connection-URL field **never persisted** client-side, posting `{ engine, connection_url, name? }` to `/v1/db/connect` with `credentials:"include"`. On success it renders the schema preview then a "Question it now →" CTA to `/app?db=<dbId>`. The product-side landing for Door B (`SK-WEB-018`); backend is [`SK-DBCONN-001`](../byo-connect/FEATURE.md). Reached from Door B and from a "Connect existing DB" affordance in the `/app` chat-window `LeftRail` (Postgres / ClickHouse chips that deep-link `?engine=` so `ConnectForm` preselects the engine) — one connect page, no second flow (`GLOBAL-017`).

### SK-WEB-020 — Calm token system (supersedes SK-WEB-015's quiet-brutalism tokens)

**Body:** [`decisions/SK-WEB-020-calm-token-system.md`](./decisions/SK-WEB-020-calm-token-system.md).
`global.css` is re-based from quiet-brutalism to a **calm** system site-wide: near-black low-chroma neutrals, ONE jade accent (`#3ecf8e`, ~10% / 60-30-10) replacing acid lime, system fonts for body + display (Source Serif 4 dropped; `--display` aliases `--sans`; `--mono` kept for code/data), ~12px radius, two-layer soft shadows (`--shadow-1/2/3`, `--ring`), and expo-out reduced-motion-gated entrances. Legacy aliases (`--shadow-hard`, `--border-strong`, `--bg-elev`, …) remap to the calm ladder so un-swept `<style>` blocks render calm automatically. The home layout is `styles/home2.css` (scoped `.home2`); `styles/chat.css` + `styles/keys.css` and every marketing page are swept (1px rules, radius, `--ring` focus, `--accent-soft` tints). Retains SK-WEB-015's spirit (one accent moment per band, mono demoted, one token source, one-motion-moment budget) and all SK-WEB-018 IA + GLOBAL-007 / SK-WEB-003 invariants.

### SK-WEB-021 — `/architecture`: interactive 3D system map on its own route, never on `/`

**Body:** [`decisions/SK-WEB-021-architecture-3d-map.md`](./decisions/SK-WEB-021-architecture-3d-map.md).
One route (`/architecture/`) renders the system as a three.js zoom-to-detail map (island `ArchitectureMap.tsx`) above a prose walkthrough, both from `src/data/architecture.ts` (mirrors `docs/architecture.md` §2). three.js is dynamic-imported on this route only; wheel-zoom is click-to-activate and one-finger touch keeps scrolling (scroll-trap guards); motion is reduced-motion-gated. Never a homepage background — that would contradict SK-WEB-018 / SK-WEB-020 / SK-WEB-001 at once; the home page gets only the 0-JS "Under the hood" poster band linking to the route.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-007** — No login wall before first value.
- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
- **GLOBAL-012** — Errors are one sentence with the next action.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.
- **GLOBAL-023** — Trust UX baseline.
  - *In this feature:* the chat panel renders the diff inline before commit (per `SK-TRUST-001`), the trace pane sits below the answer with collapsed-by-default state (per `SK-TRUST-002`), and low-confidence refusals surface as click-to-disambiguate chips (per `SK-TRUST-003`). See [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md).
- **GLOBAL-034** — Analytics stack (Cloudflare Web Analytics for pageviews; PostHog Phase-2-optional).
- **GLOBAL-032** — Canonical user flows.
  - *In this feature:* the marketing site hosts three of the canonical inbound surfaces (FLOW-001 hero, FLOW-002 `/solve`, FLOW-003 `/vs`), each walked daily by `stranger-test.sh` under `acquisition-health.yml`, so a template regression surfaces within 24 h.

## Open questions / known unknowns

- **Promote session cookie name to literal `__Host-…session` — Parked until Better Auth exposes the prefix.** Same-origin chat shipped (`SK-WEB-009`); Better Auth v1.6.9 hardcodes `__Secure-` (`cookies/index.mjs:30`) with no override. Edge-rewrite `Set-Cookie` only if an audit demands it.
- **Sharing a query result by link — Parked until the P1 share slice** (`GLOBAL-033`, reuse): renders the existing plan-cache entry (`GLOBAL-006`) read-only — no new store/auth, so it is wiring.
- **CSV upload — Parked until Phase 2** (`GLOBAL-033`); P3 per `docs/runbook.md §10`.

## Happy path walkthroughs

The marketing site (`nlqdb.com`) and the platform web app
(`nlqdb.com/app`) are themselves the demo — the user-facing flow is what
they will see when they visit. The canonical "first 22 seconds" copy and
the post-sign-in adoption flow live in
[`docs/research/personas.md` §P1 (Maya, the Solo Builder)](../../research/personas.md);
internal contracts those flows depend on are the `SK-WEB-*` and
[`SK-ONBOARD-*`](../onboarding/FEATURE.md) decisions.
