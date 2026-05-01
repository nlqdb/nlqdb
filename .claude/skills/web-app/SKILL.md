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
**Status:** implemented (Phase 1, partial — chat surface tabled per pivot 2026-04-28)
**Owners (code):** `apps/web/**`
**Cross-refs:** docs/design.md §3.1 (marketing site) · docs/design.md §3.2 (platform web app) · docs/design.md §14.1, §14.2 (happy paths) · docs/personas.md (P1, P3, P5) · docs/implementation.md §4 (Phase 1 web slices)

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
- **Why:** No persona ever woke up wanting to "create a database" (`docs/personas.md`). The goal-first inversion (`docs/design.md §0.1`) is the most important design principle in the project, and the hero is its most visible expression. Every required input before first value drops the funnel; one input is the floor.
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

- **Decision:** The marketing-site live `<nlq-data>` and any third-party "try this in a scratch HTML" embed point at `endpoint="https://app.nlqdb.com/v1/demo/ask"`. The endpoint takes no auth, is CORS-permissive, returns canned fixtures keyed off the goal substring, and rate-limits per-IP at 10/min so it can't be abused as an LLM stand-in. The element stays pure — no demo branch in client code; the "demo" semantic lives server-side in `apps/api/src/demo.ts`.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** The marketing site needs a live demo that costs us nothing per visitor and can't be turned into a free LLM proxy. Canned fixtures keep it free. Server-side semantics keep the embed code identical to what real users ship — paste-this-in-prod is the same code paste-this-on-marketing renders. Per-IP rate limit defends against abuse.
- **Consequence in code:** `apps/api/src/demo.ts` owns the fixture map and the rate limit. `packages/elements` has zero "isDemo" branches. Real users' embeds hit `/v1/ask` with a session cookie or `pk_live_` key; the marketing site's embed hits `/v1/demo/ask` purely by virtue of its `endpoint` attribute. Per `docs/surfaces.md`, the demo endpoint is the *first* shipped surface row.
- **Alternatives rejected:**
  - LLM behind the demo endpoint — turns the marketing site into a free Claude proxy.
  - Per-visitor anonymous DB on the marketing site — works but burns Neon Free capacity for window-shoppers; canned fixtures are cheaper.

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
- **Consequence in code:** Better Auth config sets `crossSubDomainCookies: true`; the cookie name in tests is `__Secure-session`. Any change to same-origin must restore `__Host-` in the same PR. Documented in `docs/implementation.md §4`.
- **Alternatives rejected:**
  - Keep `__Host-` and force same-origin chat now — too much architecture churn for Phase 1.
  - Issue a separate cookie per subdomain — fragments identity, breaks `GLOBAL-008`.

### SK-WEB-007 — "Copy snippet" inlines the user's `pk_live_` so the key is never a separate errand

- **Decision:** Every chat-generated `<nlq-data>` snippet has the user's `pk_live_<dbId>` already inlined when copied. Anonymous users get a temporary `pk_live_` that rotates to a permanent one on sign-in. The user never has to open the dashboard, find the keys page, click "Reveal", and paste.
- **Core value:** Effortless UX, Goal-first, Seamless auth
- **Why:** Getting an API key is the kind of side errand that breaks the goal-first flow. The user wanted an embed; making them collect a key first interrupts the moment. Inlining the key in the chat-copy action keeps the user inside one window. For anonymous users, rotating the key on sign-in is the seamless adoption path (`GLOBAL-007`).
- **Consequence in code:** Chat panel's "Copy snippet" CTA pre-fills `api-key="pk_live_…"` server-side from the user's (or anonymous device's) per-DB key. The temporary anonymous key is rotated to a permanent one on sign-in via the same endpoint that adopts the anonymous DB. Tested end-to-end in `docs/design.md §14.5`.
- **Alternatives rejected:**
  - Show the key in the chat as text + ask the user to copy it — extra step, easy to lose, leaks into chat history.
  - Require sign-in before "Copy snippet" works — breaks the no-login-wall promise.

## Copies of GLOBAL decisions affecting this feature

### GLOBAL-007 — No login wall before first value

- **Decision:** A first-time visitor — on the web, in the CLI, or via an
  MCP-aware client — gets to a working answer before being asked to sign
  in. Anonymous mode is the default first-touch experience.
- **Core value:** Free, Effortless UX, Goal-first
- **Why:** Login walls kill the activation funnel. Our pitch is "a
  database you talk to" — not "create an account, verify email, choose
  a region, then talk." We can ask for the email after the user has
  already had a `wow`.
- **Consequence in code:** `apps/web` boots into a usable demo without
  a session. CLI's first `nlq ask` accepts an anonymous device, which
  later attaches to a Better Auth identity on first sign-in. The API
  has an explicit anonymous-mode rate-limit tier.
- **Alternatives rejected:**
  - Required signup with "free trial" framing — measurably worse for
    activation.
  - Auth-deferred-but-persistent — same effect as a wall, just delayed
    by one screen.
- **Source:** docs/decisions.md#GLOBAL-007

### GLOBAL-011 — Honest latency — show the live trace; never spinner-lie

- **Decision:** When a request is in flight, surfaces show what is
  actually happening (cache lookup, plan, allowlist, exec, summarize)
  with real timings — not a generic spinner. If a step takes long, we
  say what step.
- **Core value:** Honest latency, Effortless UX
- **Why:** A spinner that hides progress trains users to assume the
  worst. A live trace shows exactly where time goes and turns
  perceived latency into legible, cacheable, debuggable information.
  It also makes us better at performance because we *see* every slow
  step.
- **Consequence in code:** `apps/web` streams trace events from the
  ask-pipeline (or polls the OTel-exposed step state) and renders
  them in order. CLI's TTY mode prints each step as it completes.
  The SDK exposes an `onTrace` hook for surfaces to consume.
- **Alternatives rejected:**
  - Generic spinner with "this is taking longer than usual" — gives
    no information.
  - Hide latency below a threshold — users notice anyway, and lose
    trust when the threshold is wrong.
- **Source:** docs/decisions.md#GLOBAL-011

### GLOBAL-012 — Errors are one sentence with the next action

- **Decision:** Every user-facing error message is one sentence and
  contains an actionable next step. No stack traces in the surface.
  No "an error occurred." No multi-paragraph debug dumps.
- **Core value:** Effortless UX, Honest latency, Simple
- **Why:** Error messages are a UI surface. Long error messages train
  users not to read them; vague ones train users not to trust them.
  One sentence with a next action is read, understood, and acted on.
- **Consequence in code:** Every `throw` / `error()` call in user-
  facing paths returns a `code` (machine-readable) + `message` (one
  sentence) + `action` (what to do). Surfaces render `message` and
  optionally a CTA derived from `action`. Stack traces go to OTel
  spans, not to the user.
- **Alternatives rejected:**
  - Surface the underlying exception — leaks internals, scares users.
  - Generic "something went wrong" — prevents the user from helping
    themselves.
- **Source:** docs/decisions.md#GLOBAL-012

### GLOBAL-020 — No "pick a region", no config files in the first 60s

- **Decision:** First-time use — `npx nlq ask`, opening the web app,
  installing the MCP — completes without any config file, region
  picker, project ID, or environment variable. The path to first
  value is conversational and zero-config.
- **Core value:** Effortless UX, Free, Goal-first
- **Why:** Every required input before first value drops the funnel.
  Users who pick a region are already deciding to commit; we want
  them to decide *after* they've seen value, not before. Defaults
  are good, asked-for defaults are bad.
- **Consequence in code:** CLI's first invocation works against a
  default anonymous device on a default region. Web app boots
  against a demo dataset. MCP install does host detection
  (`packages/mcp/install.ts`) — no JSON the user has to write. Any
  PR that adds a required input to first-touch is rejected.
- **Alternatives rejected:**
  - "Sensible-default config file generated on first run" — still a
    file, still confusing, drifts from the docs.
  - Region picker on signup — half our funnel can't answer it.
- **Source:** docs/decisions.md#GLOBAL-020

## Open questions / known unknowns

- **Chat-surface reactivation timing.** The 2026-04-28 pivot tabled the chat UI on `apps/web`; the backend (`/v1/chat/messages`, `/v1/anon/adopt`, `/api/auth/*`) is tested and dormant. Reactivation is a Phase 1.x or Phase 2 follow-up — no firm date.
- **CSV upload.** Required for P3 (data-curious analyst) per `docs/personas.md`. Listed as Phase 1 priority but tabled with the chat surface. Decision on whether it ships before, with, or after chat reactivation is open.
- **Same-origin chat for restoring `__Host-`.** Tracked as a future architecture change — bundle `apps/web` static assets into the API Worker so chat is same-origin. No timeline.
- **Sharing a query result by link.** P1-priority surface mentioned in `docs/personas.md` ("Sharing a query result as a link") — implementation slice not yet scoped.
- **Plausible vs Plausible-self-hosted decision.** `docs/design.md §3.1` says "Plausible, self-hosted"; `docs/plan.md` lists Plausible without qualifier. Reconcile when wiring web analytics.
- **Marketing-site live ticker source-of-truth.** Anonymized query ticker is described in design but the data-pipe (which sample, what redaction, which OTel attributes) is undecided.
