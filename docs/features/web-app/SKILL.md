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
**Status:** partial (Phase 1 — sign-in UI, chat surface, anon-mode web flow remaining; these are the Phase 1 exit gate)
**Owners (code):** `apps/web/**`
**Cross-refs:** docs/architecture.md §3.1 (marketing site) · docs/architecture.md §3.2 (platform web app) · docs/runbook.md §10 (P1, P3, P5) · docs/architecture.md §10 §4 (Phase 1 web slices)

## Touchpoints — read this skill before editing

- `apps/web/**`

## Decisions

### SK-WEB-001 — Astro static-first with React islands; one project for marketing + product

- **Decision:** `apps/web` is a single Astro project. Marketing pages (`nlqdb.com`) ship as static-first Astro routes (0 KB JS by default); product pages (`app.nlqdb.com`) are Astro routes with React islands for chat, dashboard, and key management.
- **Core value:** Free, Fast, Simple
- **Why:** A single project gives one build, one deploy, one set of components, one design system. The Lighthouse 100/100/100/100 target on the marketing site requires static-first; the product surface needs interactive islands. Astro is the only popular framework that does both without forking the project. Also keeps `GLOBAL-013` (≤3 MiB Workers bundle) attainable — static pages contribute ~0 to the worker bundle.
- **Consequence in code:** `apps/web` has one `astro.config.mjs`, one `package.json`. React appears only inside `*.tsx` islands; routes are `*.astro`. State in islands is URL-first (every chat is permalinkable) plus a small Zustand store. No global Redux. Marketing pages must remain JS-free unless an island is genuinely required.
- **Alternatives rejected:**
  - Two projects (Next.js for product, Astro for marketing) — duplicated tokens, components, and deploys; double the surface area to keep in sync.
  - Next.js for everything — heavier client bundles by default; misses the static-marketing message.

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
- **Consequence in code:** `apps/web/src/components/CodePanel.astro` carries one snippet per surface (HTML, React, Vue, Agent, curl). Each has a copy button that emits `home.snippet_copied` to LogSnag. New surfaces add a tab here; surfaces not yet shipped carry an honest "Phase 2" badge — no fake working claims. Mirror the snippets in `/code-samples.txt` so non-JS crawlers see the same proof.
- **Alternatives rejected:**
  - Hero video / animated explainer — opaque to crawlers, slow to first paint, ages badly.
  - Logo wall — irrelevant in pre-PMF, dilutes the "code is the proof" message.

### SK-WEB-004 — Demo endpoint `POST /v1/demo/ask`: no auth, canned fixtures, server-owned

- **Status:** superseded by `SK-WEB-008`. The reproduction that prompted the supersession: submitting "Create a new workspace named omer" to the canned-fixture endpoint returned the orders-aggregation default with summary line *"Today's orders aggregated by drink (matching 'Create a new workspace named omer')"* — fixtures lying by accident under SK-WEB-003's "above the fold is runnable proof" mandate. The free-LLM-proxy concern that motivated this skill is now addressed by the global anon cap (`SK-ANON-010`) layered on the per-IP cap (`SK-ANON-004`).
- **Decision:** The marketing-site live `<nlq-data>` and any third-party "try this in a scratch HTML" embed point at `endpoint="https://app.nlqdb.com/v1/demo/ask"`. The endpoint takes no auth, is CORS-permissive, returns canned fixtures keyed off the goal substring, and rate-limits per-IP at 10/min so it can't be abused as an LLM stand-in. The element stays pure — no demo branch in client code; the "demo" semantic lives server-side in `apps/api/src/demo.ts`.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** The marketing site needs a live demo that costs us nothing per visitor and can't be turned into a free LLM proxy. Canned fixtures keep it free. Server-side semantics keep the embed code identical to what real users ship — paste-this-in-prod is the same code paste-this-on-marketing renders. Per-IP rate limit defends against abuse.
- **Consequence in code:** `apps/api/src/demo.ts` owns the fixture map and the rate limit. `packages/elements` has zero "isDemo" branches. Real users' embeds hit `/v1/ask` with a session cookie or `pk_live_` key; the marketing site's embed hits `/v1/demo/ask` purely by virtue of its `endpoint` attribute. Per `docs/architecture.md §3`, the demo endpoint is the *first* shipped surface row.
- **Alternatives rejected:**
  - LLM behind the demo endpoint — turns the marketing site into a free Claude proxy.
  - Per-visitor anonymous DB on the marketing site — works but burns Neon Free capacity for window-shoppers; canned fixtures are cheaper.

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
- **Consequence in code:** Chat panel components render three children per reply: `<Answer>`, `<Data>`, `<Trace>`. `<Trace>` consumes the SDK's `onTrace` hook (per the sdk skill, `SK-SDK-007`). In-place edit + re-run is supported on the answer; Cmd+/ toggles the trace globally; Cmd+K opens the palette.
- **Alternatives rejected:**
  - Spinner + final answer (no trace) — `GLOBAL-011` explicitly rejects this.
  - Markdown blob with everything inline — harder to copy data, harder to deep-link.

### SK-WEB-006 — Cookie is `__Secure-session` with cross-subdomain `Domain=nlqdb.com`

- **Decision:** Sign-in cookie is `__Secure-session` (HttpOnly, Secure, SameSite=Lax) with `Domain=nlqdb.com` so the same session covers `nlqdb.com` and `app.nlqdb.com`. `__Host-` was the earlier draft but is incompatible with `Domain=`; restoring it would require same-origin chat (e.g. bundling `apps/web` into the API Worker).
- **Core value:** Seamless auth, Bullet-proof, Effortless UX
- **Why:** Users sign in on the marketing site and continue to the product on a subdomain — one identity (`GLOBAL-008`) requires one cookie that spans both. `__Host-` is strictly more secure but it forbids the `Domain=` attribute; the cross-subdomain story is the right tradeoff for Phase 1. The decision is documented because it's a deliberate downgrade from a previous draft; future re-architecting (same-origin chat) can restore `__Host-`.
- **Consequence in code:** Better Auth config sets `crossSubDomainCookies: true`; the cookie name in tests is `__Secure-session`. Any change to same-origin must restore `__Host-` in the same PR. Documented in `docs/architecture.md §10 §4`.
- **Alternatives rejected:**
  - Keep `__Host-` and force same-origin chat now — too much architecture churn for Phase 1.
  - Issue a separate cookie per subdomain — fragments identity, breaks `GLOBAL-008`.

### SK-WEB-007 — "Copy snippet" inlines the user's `pk_live_` so the key is never a separate errand

- **Decision:** Every chat-generated `<nlq-data>` snippet has the user's `pk_live_<dbId>` already inlined when copied. Anonymous users get a temporary `pk_live_` that rotates to a permanent one on sign-in. The user never has to open the dashboard, find the keys page, click "Reveal", and paste.
- **Core value:** Effortless UX, Goal-first, Seamless auth
- **Why:** Getting an API key is the kind of side errand that breaks the goal-first flow. The user wanted an embed; making them collect a key first interrupts the moment. Inlining the key in the chat-copy action keeps the user inside one window. For anonymous users, rotating the key on sign-in is the seamless adoption path (`GLOBAL-007`).
- **Consequence in code:** Chat panel's "Copy snippet" CTA pre-fills `api-key="pk_live_…"` server-side from the user's (or anonymous device's) per-DB key. The temporary anonymous key is rotated to a permanent one on sign-in via the same endpoint that adopts the anonymous DB. Tested end-to-end in `docs/features/elements/SKILL.md`.
- **Alternatives rejected:**
  - Show the key in the chat as text + ask the user to copy it — extra step, easy to lose, leaks into chat history.
  - Require sign-in before "Copy snippet" works — breaks the no-login-wall promise.

## GLOBALs governing this feature

Canonical text in [`docs/decisions.md`](../../docs/decisions.md). The list below names the rules that constrain this feature; any skill-local commentary is nested under the rule.

- **GLOBAL-007** — No login wall before first value.
- **GLOBAL-011** — Honest latency — show the live trace; never spinner-lie.
- **GLOBAL-012** — Errors are one sentence with the next action.
- **GLOBAL-020** — No "pick a region", no config files in the first 60s.

## Open questions / known unknowns

- **Same-origin chat for restoring `__Host-`.** Future architecture change — bundle `apps/web` static assets into the API Worker so chat is same-origin, allowing `__Host-` cookie. No timeline; deferred post-chat-surface launch.
- **Sharing a query result by link.** P1-priority surface per `docs/runbook.md §10` — implementation slice not yet scoped.
- **CSV upload.** Required for P3 (data-curious analyst) per `docs/runbook.md §10`. Deferred to Phase 2 alongside CLI.
- **Plausible vs Plausible-self-hosted.** `docs/architecture.md §3.1` says "Plausible, self-hosted"; `docs/architecture.md §10` lists Plausible without qualifier. Reconcile when wiring web analytics.
- **Marketing-site live ticker source-of-truth.** Data-pipe (which sample, what redaction, which OTel attributes) undecided.

## Happy path walkthroughs

### §14.1 Marketing site (`nlqdb.com`)

```
1. User lands on nlqdb.com.
2. Sees ONE input: "What are you building?"
3. Types: "an orders tracker for my coffee shop"
4. Hits Enter.
5. The page morphs in place into a chat. The first reply streams:
     "Set up. Tell me about an order — what should I track?"
6. User types: "customer name, what they ordered, time, total"
7. The chat replies with the inferred schema, a sample row, and an embed snippet.
   Total elapsed: 22 seconds. No sign-in. No pricing dialog. No "create your
   first database" button.
```

### §14.2 Platform web app (`nlqdb.com/app`)

```
- After step 7 above, a slim bar appears: "Save this — sign in with GitHub."
- User clicks; GitHub OAuth pops; back to the same chat, signed in, DB adopted.
- The left rail now shows one entry: `orders-tracker-a4f` (auto-named).
- User keeps chatting. Cmd+K opens the palette. Cmd+/ toggles the SQL trace.
- Settings → API keys → "Reveal pk_live_..." (publishable, browser-safe).
```

### §15.1 Persona walkthrough — Maya, the Solo Builder

**Goal:** ship a meal-planner side project this weekend.

| Time | Maya does | nlqdb does |
|---|---|---|
| Fri 9:01pm | Lands on `nlqdb.com`, types *"a meal planner — dishes, ingredients, plans for the week"* | Materializes `meal-planner-7c2`, replies with inferred schema in NL, streams a `<nlq-data>` snippet for "this week's plan" **with her `pk_live_` key already inlined** |
| 9:03pm | Pastes the snippet into her existing Next.js project's `page.tsx` | Element fetches, renders an empty table, refreshes every 30s — zero config |
| 9:08pm | Types into the chat: *"add 12 sample dishes with realistic ingredients"* | Inserts 12 rows, returns the IDs and a preview |
| 9:15pm | Adds a `<nlq-action>` form to add new dishes from the UI | Inferred new columns where the form has new fields |
| 11:30pm | Deploys to Vercel. Site is live. | — |
| Sat 10am | Sister tests it. Maya types: *"who used the planner today, and which dishes were added"* | Replies in prose + table |
| Sun 6pm | *"add a `trial_ends_at` field to users, default 14 days from signup"* | Diff preview shown; Maya hits Enter; column added; existing rows backfilled |
| Mon 9am | Signs in to the platform; adopts the anonymous DB; adds a card; switches to Hobby ($10) | DB unpaused, 30-day backups on |

**What Maya never did:** wrote a migration file, opened psql, picked a region, configured Prisma, set up an admin panel, configured backups, wrote a single SQL statement.

**Setup time, old way:** ~1 day. **Setup time, nlqdb:** ~2 minutes.
