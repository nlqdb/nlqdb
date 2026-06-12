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
**Status:** partial (Phase 1.5 — Phase 1 surfaces shipped; GLOBAL-024 queued wishlist landed via `SK-EVENTS-011` (see `events-pipeline/FEATURE.md`); the wishlist fanout lives in `CodePanel.astro`. `SK-WEB-010` adds the marketing-create Copy-snippet bridge to chat-side Copy snippet).
**Owners (code):** `apps/web/**`
**Cross-refs:** docs/architecture.md §3.1 (marketing site) · docs/architecture.md §3.2 (platform web app) · docs/runbook.md §10 (P1, P3, P5) · docs/phase-plan.md §2 (Phase 1 web slices)

## Touchpoints — read this feature before editing

- `apps/web/**`

## Decisions

### SK-WEB-001 — Astro static-first with React islands; one project for marketing + product; every island ships behind an ErrorBoundary; no blank screens

- **Decision:** `apps/web` is a single Astro project. Marketing pages (`nlqdb.com`) ship as static-first Astro routes (0 KB JS by default); product pages (`app.nlqdb.com`) are Astro routes with React islands for chat, dashboard, and key management. **Every React island is wrapped in `<ErrorBoundary>` (`apps/web/src/components/ErrorBoundary.tsx`) and `Base.astro` ships an inline pre-hydration `boot-fallback` block.** A render throw never produces a blank `<main>`; a chunk-load or top-level eval failure never produces an empty body. Persisted-state loaders (`localStorage` histories) shape-validate before returning hydrated values; mismatched entries are dropped, not trusted. Crashes POST best-effort to `/v1/errors/web` (`apps/api/src/index.ts`) so client-side throws land in the same OTel pipeline as server errors.
- **Core value:** Free, Fast, Simple, Bullet-proof
- **Why:** A single project gives one build, one deploy, one set of components, one design system. The Lighthouse 100/100/100/100 target on the marketing site requires static-first; the product surface needs interactive islands. Astro is the only popular framework that does both without forking the project. Also keeps `GLOBAL-013` (≤3 MiB Workers bundle) attainable — static pages contribute ~0 to the worker bundle. The ErrorBoundary + boot-fallback layer is non-negotiable: production hit a `Cannot read properties of undefined (reading 'sql')` throw in `ChatPanel` against stale persisted history and the entire chat surface vanished with no recovery affordance. A blank screen is the worst possible failure mode — it has no callback to action and no breadcrumb for support. Defence-in-depth (type narrowing + ErrorBoundary + pre-hydration handler + history shape guard) keeps every reachable failure visible.
- **Consequence in code:** `apps/web` has one `astro.config.mjs`, one `package.json`. React appears only inside `*.tsx` islands; routes are `*.astro`. State in islands is URL-first (every chat is permalinkable). No global Redux. Marketing pages must remain JS-free unless an island is genuinely required. **Every island's top-level component renders its children inside `<ErrorBoundary>` (current islands: `ChatPanel`, `CreateForm`, `KeysPanel` — see their `*Inner` split). New islands MUST do the same; reviewers reject otherwise.** `Base.astro` contains a hidden `#boot-fallback` div and inline `error` / `unhandledrejection` listeners that reveal it. Persisted-state loaders (`loadHistory` in `ChatPanel.tsx`, etc.) run a shape guard before returning hydrated values.
- **Alternatives rejected:**
  - Two projects (Next.js for product, Astro for marketing) — duplicated tokens, components, and deploys; double the surface area to keep in sync.
  - Next.js for everything — heavier client bundles by default; misses the static-marketing message.
  - Trust islands not to throw — proven false; any future refactor or stale-schema can break it again.
  - Catch only at the page level — misses islands mounted with `client:only`, which replace rather than enhance the SSR markup.

### SK-WEB-002 — Goal-first hero: one input, no pricing dialog, no signup wall

- **Decision:** The marketing-site hero is a single input — *"What are you building?"* — that morphs into a chat via View Transitions. The first chat reply streams; the DB materializes silently. No pricing dialog, no "create your first database" button, no signup wall before first value.
- **Core value:** Goal-first, Effortless UX, Free
- **Why:** No persona ever woke up wanting to "create a database" (`docs/runbook.md §10`). The goal-first inversion (`docs/architecture.md §0.1`) is the most important design principle in the project, and the hero is its most visible expression. Every required input before first value drops the funnel; one input is the floor.
- **Consequence in code:** `apps/web/src/pages/index.astro` is one input + one button + the code panel below. The chat morph happens in-place (View Transitions), not via navigation. The page is 100% functional with JS off (input still submits to a fallback chat URL). No dialog / modal / "are you sure" interrupts first value.
- **Alternatives rejected:**
  - Required signup with "free trial" framing — measurably worse for activation; contradicts `GLOBAL-007`.
  - Region picker + project name on first run — `GLOBAL-020` rejects this explicitly.
  - Marketing copy above the fold, demo below — runnable code is the proof; copy is for closers.

### SK-WEB-003 — Above-the-fold is runnable code, not feature bullets

- **Decision:** Above the fold on `nlqdb.com/` is either a working snippet or proof that snippets work — never feature bullets, logo grids, or "trusted by" strips. The tabbed code-example panel renders against the same demo DB; switching tabs swaps the surface.
- **Core value:** Honest latency, Creative, Goal-first
- **Why:** "The contrast IS the message" — every snippet is the entire backend. Marketing copy that we can't back up with a working snippet is a smell. Working snippets above the fold also do double duty for AEO/GEO (LLM crawlers cite working examples preferentially) and for our own conversion data (which surface visitors copy first is leading signal for framework-wrapper investment).
- **Consequence in code:** `apps/web/src/components/CodePanel.astro` carries one snippet per surface — currently CLI · HTML · React · Vue · SDK · curl · MCP · Swift (canonical list lives in [`apps/web/src/data/snippets.ts`](../../../apps/web/src/data/snippets.ts)). Each has a copy button that emits `home.snippet_copied` to LogSnag with `surface = <snippet id>`. New surfaces add a `Snippet` entry plus one matching `<Fragment slot="…">` in `CodePanel.astro`; surfaces not yet shipped carry an honest Phase 1/2 badge in the matrix below the panel — no fake working claims. Mirror the snippets in `/code-samples.txt` so non-JS crawlers see the same proof.
- **Alternatives rejected:**
  - Hero video / animated explainer — opaque to crawlers, slow to first paint, ages badly.
  - Logo wall — irrelevant in pre-PMF, dilutes the "code is the proof" message.

### SK-WEB-004 — Demo endpoint `POST /v1/demo/ask`: no auth, canned fixtures, server-owned

- **Status:** superseded by `SK-WEB-008` — canned fixtures lied by accident the moment a goal missed the matcher, so the marketing demo now hits the real `/v1/ask` with an anon bearer. The free-LLM-proxy concern this guarded is now covered by the global anon cap (`SK-ANON-010`) over the per-IP cap (`SK-ANON-004`). See `SK-WEB-008` for the live rationale.

### SK-WEB-008 — Demo === real `/v1/ask` with anon bearer; canned fixtures live only in the static carousel

- **Decision:** Supersedes `SK-WEB-004`. The marketing hero, `/app/new`, and any first-party `<nlq-data>` surface all hit `POST /v1/ask` with `Authorization: Bearer anon_<token>` (SK-ANON-008). The `/v1/demo/ask` route is deleted. Canned fixtures continue to exist only in `apps/web/src/components/Carousel.astro` (`SHOWCASE_EXAMPLES`) — pre-rendered HTML strings, no network call. Free-LLM-proxy abuse is prevented by the global anon cap (`SK-ANON-010`, 100/hr / 1000/day / 10k/month) layered on the per-IP buckets (`SK-ANON-004` / `SK-RL-007`).
- **Core value:** Honest latency, Goal-first, Bullet-proof
- **Why:** A canned-fixture demo lies by accident the moment a user types something the regex-matcher doesn't recognise. SK-WEB-003 trades on credibility — "above the fold is runnable proof, not feature bullets" — and an unrelated fixture is the opposite of runnable proof. The reproduction that surfaced this: "Create a new workspace named omer" fell through `apps/api/src/demo.ts`'s five regexes to the orders default and was rendered with a *"matching '<your goal>'"* summary line. The new posture pays a per-call LLM cost (mitigated by the global cap) for the right to never lie. Carousel fixtures keep their place — they're not "answers to your goal", they're "shapes the LLM also produces", and the snippets are visibly static markup.
- **Consequence in code:** `/v1/demo/ask` route + CORS rule deleted from `apps/api/src/index.ts`; `parseGoalBody` dropped from `apps/api/src/http.ts`; `apps/api/src/demo.ts` survives as a library only because `apps/api/src/chat/demo-shortcut.ts` still imports `buildDemoResult` (its file header schedules it for retirement under the same directive). Marketing hero (`apps/web/src/components/Hero.astro`) and `/app/new` (`apps/web/src/pages/app/new.astro`) both render the shared `<CreateForm>` React island. The element (`packages/elements`) keeps zero "isDemo" branches — its `endpoint` attribute now points at `/v1/ask` for marketing too.
- **Alternatives rejected:**
  - Keep `/v1/demo/ask` as a thin alias that auto-mints an anon bearer server-side — backwards-compatible for embeds that hardcoded the URL, but every call still costs a network round-trip and the alias splits rate-limit accounting across two paths. Cleaner to delete.
  - Two endpoints with separate caps (real-LLM `/v1/demo/ask` for marketing, full `/v1/ask` for product) — two budgets, two SDK shapes, two test suites; the global cap solves the abuse case without forking surfaces.
  - Stay on canned fixtures and rewrite the matcher to refuse fall-through — a regex that returns "I don't have a fixture for that" is honest about the demo's limits, but it teaches the user that nlqdb is fixture-bound; flat dishonesty traded for limited honesty.

### SK-WEB-005 — Three-part chat response: answer + data + trace

- **Decision:** The product chat (`app.nlqdb.com`) renders every reply as three parts: a one-sentence answer in prose, the raw data (table / list / kv / chart), and a collapsible trace (cache lookup → plan → validate → exec → summarize, with timings). The trace is toggled by `Cmd+/`; the palette is `Cmd+K`.
- **Core value:** Honest latency, Effortless UX, Bullet-proof
- **Why:** The trace IS the live-trace surface for `GLOBAL-011` — without it, latency is opaque and users have no way to debug. Always attaching the raw data ensures we never paraphrase away the truth (the answer is a summary; the data is the proof). The answer-first ordering keeps the goal-first promise — the user gets their number before the engineering details.
- **Consequence in code:** Chat panel components render three children per reply: `<Answer>`, `<Data>`, `<Trace>`. `<Trace>` consumes the SDK's `onTrace` hook (per the sdk feature, `SK-SDK-007`). In-place edit + re-run is supported on the answer; Cmd+/ toggles the trace globally; Cmd+K opens the palette. Result-table column headers are rendered through `prettifyHeader()` so LLM-emitted snake_case identifiers display as `Title Case`.
- **Alternatives rejected:**
  - Spinner + final answer (no trace) — `GLOBAL-011` explicitly rejects this.
  - Markdown blob with everything inline — harder to copy data, harder to deep-link.

### SK-WEB-006 — Cookie is `__Secure-session` with cross-subdomain `Domain=nlqdb.com`

- **Status:** Superseded by `SK-WEB-009` once `apps/web` and `apps/api` merged into one same-origin worker. Pre-merge, one identity (`GLOBAL-008`) across two subdomains needed a cookie that spanned both, and `__Host-` can't carry `Domain=` — so the cookie was downgraded to `__Secure-session` + `Domain=nlqdb.com` (Better Auth `crossSubDomainCookies: true`). The merge restores the path to `__Host-`. Historical context for `SK-AUTH-013` / `SK-AUTH-015` lives in those records.

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

- **Decision:** The marketing-page create result (`CreateResultView` in `apps/web/src/components/CreateForm.tsx`) renders an embed-snippet block alongside the schema preview. The snippet shows the `<nlq-data>` shape with a goal derived from the primary table and `api-key="pk_live_REPLACE_ME"` as a literal placeholder. A "Copy" button writes the placeholder snippet to the clipboard; a "Sign in to continue →" CTA routes to `/auth/sign-in?return_to=/app`. The real `pk_live_` inlining still happens in one place only — the chat's per-answer Copy snippet (`SK-WEB-007`).
- **Core value:** Goal-first, Effortless UX, Bullet-proof
- **Why:** A fresh visitor lands on the marketing page, types one sentence, and sees their schema render in ~6 seconds (the wow moment). The natural follow-through is "how do I use this from my own page?" — without a snippet affordance there, the user has to click *Open chat →* → sign in → ask a question → find Copy snippet. Five steps before any HTML lands in their clipboard. The snippet-shape-first approach closes the gap to one step: paste the structure now, sign in to fill in the key. Inlining the actual anon `pk_live_` here would 401 on the element's first fetch — the create call already consumed the `SK-ANON-012` 1-call budget, so the embedded `<nlq-data>` would auth-wall before rendering. The CTA is honest about both the seam (sign-in needed) and the destination (the chat's Copy snippet, which inlines the working key per `SK-WEB-007`).
- **Consequence in code:** `CreateForm.tsx` adds a `CreateSnippetView` sub-component rendered inside `CreateResultView` after the schema-preview tables. Snippet text is built client-side from `result.sampleRows[0].table` so the example goal references the actual table the user just created. The Copy button uses `navigator.clipboard.writeText` with a transient *"Copied"* state; clipboard failures (non-secure context, extension policy) are swallowed silently — users can still triple-click the `<pre>`. CSS lives under `.createresult__snippet*` in `apps/web/src/styles/global.css`. `SK-WEB-007` is **not** modified; the chat remains the only surface that inlines a working `pk_live_`. Two `GLOBAL-024` demand-signal events fire from this surface via `apps/web/src/lib/logsnag.ts` `emit()`: `home.snippet_copied` (extends the existing event used by chat / CodePanel; props `{ surface: "create_result" }`) and `home.snippet_signin_cta_clicked` (new; same `surface` prop) — the pair lets the funnel read *snippet-engaged → signed-in* without inferring it from page-view sequence.
- **Alternatives rejected:**
  - **Inline the real anon `pk_live_` on the marketing page.** Per `SK-ANON-012` the device cap is consumed by the create call, so any `<nlq-data>` element embedded with the anon key would 401 on first fetch — silent-broken-embed is the worst possible UX after the wow moment.
  - **Don't show a snippet at all; only show "Open chat →".** Drops to five clicks before the user sees their first HTML; loses the chance to teach the embed shape during the most-engaged moment of the session.
  - **Show a snippet with a working key gated behind a Turnstile.** Doubles the bot-defense surface area and still doesn't let the embed render against the just-created DB (the cap is per-device, not per-IP, and Turnstile doesn't reset it).

### SK-WEB-011 — Post-checkout confirmation banner on `/app`, honest about pending subscription state

- **Decision:** Stripe Checkout's `success_url` is `${origin}/app?checkout=success` (set in `apps/api/src/index.ts`). The `/app` auth-guard script, *after* the session probe passes, reads `?checkout=success`, reveals a dismissible one-time banner, and strips the param via `history.replaceState` so a refresh or shared link never replays it. Copy is exactly *"Payment received — thanks for upgrading. Your new plan is being activated."* — it does **not** claim the plan is already active, nor promise an email receipt (Stripe receipt emails are Dashboard-config-dependent and fire on `invoice.payment_succeeded`, not the checkout redirect), because the `customers` row is `incomplete` until `customer.subscription.created` lands (SK-STRIPE-004). The banner is a `role="status"` live region present (and empty) from page load; the message is **injected** as text on the success branch (not un-hidden pre-filled), which is the path screen readers reliably announce.
- **Core value:** Honest latency, Effortless UX, Seamless auth
- **Why:** A user who just paid lands back on the chat with zero acknowledgement otherwise — the wow-moment equivalent of a slammed door. But overclaiming ("You're on Hobby!") before the subscription confirms would lie on the exact surface where trust is most fragile. Revealing only after the auth guard passes avoids a flash for anon visitors; stripping the param keeps the success state non-permalinkable and non-replayable.
- **Consequence in code:** Markup + scoped styles + reveal live in `apps/web/src/pages/app/index.astro` — no new island, no API call (the webhook drives state). The empty `<aside role="status">` stays in the DOM and the message is injected on reveal (deferred one frame) so screen readers announce it. No analytics event yet; the §6 funnel reads completion from Stripe (`checkout.session.completed`), not a client ping.
- **Alternatives rejected:**
  - Fetch the live subscription status on landing to tailor the copy — adds a round-trip and a new endpoint for a banner; the webhook is the source of truth and "being activated" is honest for both the pending and just-confirmed cases.
  - Leave `?checkout=success` in the URL — a refresh or a shared/bookmarked link would replay the banner, and the success state isn't meaningfully permalinkable.
  - Render the banner server-side / unconditionally and hide with JS — flashes for anon visitors before the auth guard resolves.

### SK-WEB-012 — In-app dunning banner on `/app`, driven by the live `past_due`/`unpaid` status

- **Decision:** After the `/app` auth guard passes, the page reads `GET /v1/billing/status` (SK-STRIPE-009) in the background — off the render path, after the shell paints — and, only when `status` is `past_due` or `unpaid`, reveals a danger-tinted banner: *"Your last payment didn't go through. Update your payment method to keep your plan active."* with an "Update payment method" button that opens the hosted Billing Portal via `openBillingPortal` (SK-STRIPE-008). It is a `role="alert"` live region, empty from load with its text injected on reveal (same announce-on-injection trick as SK-WEB-011). Unlike the checkout banner it is **not dismissible** — the unpaid state is live, so hiding it would only mask an unfixed problem; it clears once a status read comes back healthy. The status fetch + portal open are shared with `/pricing` through `apps/web/src/lib/billing.ts`.
- **Core value:** Honest latency, Effortless UX, Bullet-proof
- **Why:** A failed renewal silently flips the subscription to `past_due`; Stripe retries on its dunning schedule but never redirects the user, so without an in-app signal the first thing a paying customer learns is that their plan stopped working. One cheap indexed read on a page they already open surfaces the one action that fixes it — update the card in the portal — turning an involuntary-churn event into a one-click recovery. This is the in-app half of the stripe-billing dunning open question; the email half stays open.
- **Consequence in code:** Markup + scoped danger-tinted styles + reveal live in `apps/web/src/pages/app/index.astro`; the fetch (`fetchBillingStatus`) and portal open (`openBillingPortal`, 404/503/error outcomes) move to `apps/web/src/lib/billing.ts` and are reused by `/pricing` so neither path duplicates the fetch+redirect. The read is non-blocking (`void fetchBillingStatus(...).then(...)`) so the healthy/free majority pays nothing on the chat's critical render path. (SK-WEB-011's "don't fetch status for a banner" applies only to checkout-success, where a URL param already carries the signal; a payment failure has no redirect, so the live read is the only signal.)
- **Alternatives rejected:**
  - Block the shell reveal on the read — adds a round-trip to every chat load for a banner almost no one sees; the background fire keeps the page instant.
  - Email only, no in-app banner — the user acts fastest where they already work; email deliverability is config-dependent and unproven (it stays the open other half).

### SK-WEB-013 — `/pricing` surfaces a scheduled cancellation; the current-tier CTA becomes one-click "Resubscribe"

**Body:** [`decisions/SK-WEB-013-cancellation-transparency.md`](./decisions/SK-WEB-013-cancellation-transparency.md).
When `GET /v1/billing/status` reports `cancelAtPeriodEnd`, the `/pricing` current-plan badge reads *"Ends {date}"* and that tier's CTA becomes a **"Resubscribe"** via the Billing Portal (Stripe un-cancels) — no silent lapse, no new Stripe call; SK-STRIPE-010's no-double-bill guard still holds.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/) (one file per GLOBAL; index in [`docs/decisions.md`](../../decisions.md)). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-007** — No login wall before first value.
- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
- **GLOBAL-012** — Errors are one sentence with the next action.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.
- **GLOBAL-023** — Trust UX baseline.
  - *In this feature:* the chat panel renders the diff inline before commit (per `SK-TRUST-001`), the trace pane sits below the answer with collapsed-by-default state (per `SK-TRUST-002`), and low-confidence refusals surface as click-to-disambiguate chips (per `SK-TRUST-003`). See [`trust-ux/FEATURE.md`](../trust-ux/FEATURE.md).
- **GLOBAL-034** — Analytics stack (Cloudflare Web Analytics for pageviews; PostHog Phase-2-optional).
- **GLOBAL-032** — Top-5 user flows canonical.
  - *In this feature:* the marketing site hosts four of the canonical-five inbound surfaces (FLOW-001 hero, FLOW-002 `/solve`, FLOW-003 `/vs`, FLOW-004 waitlist), each walked daily by `stranger-test.sh` / `flow-004-walk.sh` under `acquisition-health.yml`, so a template regression surfaces within 24 h.

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
