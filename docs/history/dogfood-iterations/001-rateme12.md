# Dogfood iteration 001 — rateme12 on nlqdb

**Status:** brief (not started) · **Governs:** [`GLOBAL-042`](../../decisions/GLOBAL-042-dogfood-iteration-loop.md) · **Measures:** [`GLOBAL-041`](../../decisions/GLOBAL-041-autonomous-dba.md) Phase A KPI 1
This file is the execution brief; the retro (§7) is appended to it when the iteration ends.

## 1. Goal

Founder, verbatim (2026-09-06):

> a super high priority task is to already build rateme12.nlqdb.com to look like rateme12 but every aspect of db should be replaced with nlqdb sdk

> and the last mile of using the product - either by reading from its db or writing to it, should be when nlqdb is ready for that of course

**Working** for this iteration means: `https://rateme12.nlqdb.com` renders the same primary user journeys as rateme12 (§4 inventory), and every read and write goes through the published `@nlqdb/sdk` against one hosted nlqdb database whose schema nlqdb inferred from the app's own inserts — **zero hand-written DDL, zero model file, zero copied schema**. Two phases: the clone (§5a) starts now and is independent of nlqdb; the data last mile (§5b) starts only when the readiness gate (§6.1) is green. Until then §6.2 is the work queue for the core nlqdb agents.

## 2. Schema quarantine — before opening any file of the clone source

Mechanical; run in this order, in the scratchpad, never in this repo.

1. `git clone` rateme12 into `<scratch>/rateme12-src` (§3). Do **not** open any file yet.
2. List by **name only** (`find … -iname`), never by content, every path matching:
   migrations (`migrations/`, `migrate/`, `db/migrate/`), ORM schema/models (`prisma/`, `*.prisma`, `drizzle/`, `schema.ts`, `schema.rb`, `structure.sql`, `models.py`, `models/`, `entities/`, `typeorm`, `sequelize`, `knex`, `kysely`), `*.sql`, `seeds/`, `fixtures/`, `*.dump`, `*.erd`, `*.graphql`/OpenAPI specs (row-shaped types), `supabase/`, any `docs/**` file named `*db*`/`*schema*`/`*data-model*`, and the backend query/repository layer (`repositories/`, `queries/`, `dao/`, `db/`, `database/`, `*Repository*`, `*Query*`).
3. `mv` every match to `<scratch>/quarantine/` (outside the source tree). Save the list to `<scratch>/quarantine/PATHS.txt`; copy it into §7 of this file. Never open anything in `quarantine/`.
4. **Grey area:** frontend UI props and component code may be read. A type or object that mirrors a table row (id + fields + timestamps) is **not copied** — stop reading that file, add it to `PATHS.txt`, and design the UI shape from the rendered product instead.
5. The real schema is read only **post-hoc**: after §5b works and §7 is written (GLOBAL-042 rule 2).

## 3. Repo access

- The token arrives as `$RATEME12_GH_TOKEN`. Use it **only** as `Authorization: Bearer $RATEME12_GH_TOKEN` in `curl`, or via a git credential helper that reads the env var. Never in a remote URL, shell history file, log, commit, PR body, or doc.
- This proxy may limit `api.github.com` to repo-scoped endpoints (no `/user/repos` listing). **The one open input from the founder: the exact `owner/repo`** of rateme12 — and the live URL if it differs from rateme12's obvious domain.
- Clone with `git -c credential.helper='!f(){ echo username=x-access-token; echo password=$RATEME12_GH_TOKEN; };f' clone https://github.com/<owner>/<repo> <scratch>/rateme12-src`.

## 4. Product inventory — fill on day 1, before §5a step 2

Written from the **live product** and the non-quarantined UI code; nothing here may be derived from quarantined files.

| Item | Value |
|---|---|
| Live URL (look-and-feel reference) | |
| Stack (framework, language, hosting) | |
| Size (files, LOC after quarantine, number of routes) | |
| Routes / pages, in navigation order | |
| Primary user journeys (≤ 5, entry → action → proof of value) | |
| Auth model (who signs in, how; anonymous paths) | |
| External services (email, payments, storage, analytics) | |
| Content types the UI shows (names only, as rendered — not row shapes) | |

## 5. Build plan

**Where the code lives.** `apps/rateme12/` — a Cloudflare Worker with Static Assets (mirror `apps/web/wrangler.toml`, `apps/mcp/wrangler.toml`), deployed by a new `.github/workflows/deploy-rateme12.yml` copied from `deploy-web.yml`. Its `package.json` depends on the **published** `@nlqdb/sdk` at a pinned version (`0.4.0` at writing; re-check `npm view @nlqdb/sdk version`) — never `workspace:*`, never an import from `packages/**` or `apps/api/**`. Cleanup is therefore `rm -rf apps/rateme12 .github/workflows/deploy-rateme12.yml`. The clone is TypeScript on Workers **whatever rateme12's stack is**: only journeys and look-and-feel are cloned ([`GLOBAL-013`](../../decisions/GLOBAL-013-free-tier-bundle-budget.md) $0, ≤ 3 MiB). Note `@nlqdb/sdk`'s `main` points at TypeScript source — wrangler's bundler handles it.

**Domain.** `[[routes]] pattern = "rateme12.nlqdb.com", custom_domain = true` in `wrangler.toml`; `workers_dev = false`. The zone is on Cloudflare, so the first deploy provisions the record if the CI `CLOUDFLARE_API_TOKEN` has Zone → DNS edit. **Founder step:** confirm that scope, or add the record by hand in the Cloudflare dashboard.

### 5a. The clone — starts now, no nlqdb dependency

1. **Scaffold** `apps/rateme12/` (Worker + assets, typecheck/lint in `bun run check`, deploy workflow, custom domain). Ship an honest placeholder page first so the URL is live on day 1.
2. **Inventory** (§4) from the live product.
3. **One data module.** `apps/rateme12/src/data.ts` is the only file that will ever call the SDK. It exports one function per read/write the journeys need (named after the journey action, e.g. `listRatings`, `submitRating`), constructs `createClient({ apiKey })` **server-side only**, and until §5b returns the honest "not connected yet" state — **no mock rows, no fixtures, no in-memory store** (P6: empty states get real design).
4. **Journeys, look-and-feel.** Routes, layout, styling, forms, auth screens, empty/partial/error states, matching the live product side by side. Every form posts to a Worker route that calls `data.ts`.
5. **Visual walk** of every route against the live product; fix parity gaps. The clone is "done" for 5a when a stranger cannot tell the two apart except for the "not connected" states.

### 5b. The last mile — gated on §6.1, strictly after 5a step 5

6. **Hosted DB through the public surface.** Create it from the app's own goal sentence (`createDatabase({ goal })` / `nlq new` / `/app` chat — whichever §6.1 R2 makes available). Record the `dbId` and mint the `sk_live_` as a Worker secret (`wrangler secret put NLQDB_API_KEY`). Never pre-model a field to make KPI 1 look good.
7. **One vertical slice.** Wire one write + its read in `data.ts` through `client.ask()` (preview → `confirm: true`), deploy, use it in the browser on the production URL. Log every `schema_mismatch` / `confirm_expired` / `rate_limited` as a §7 number.
8. **Remaining journeys** in `data.ts`, one per commit, same logging.
9. **E2E walk (P6):** `tests/e2e/rateme12/` — each §4 journey end-to-end on `rateme12.nlqdb.com`; the founder uses the production URL by hand once.
10. **Retro** (§7), then **cleanup** (§8). Only then may the real schema be read (post-hoc comparison goes into §7 "Decisions to rethink").

## 6. nlqdb today — what will bite

Verified against code on 2026-09-06 (`apps/api/src/ask/orchestrate.ts`, `principal.ts`, `packages/sdk/src/index.ts`, `SK-HDC-021`, `SK-APIKEYS-003`, `SK-ELEM-011`, `SK-RL-001`). Each item is a finding to log in §7; the build never routes around one with an internal shortcut.

### 6.1 Readiness gate — all four green before §5b step 6

| # | Capability | Today | Green when |
|---|---|---|---|
| R1 | **Widen-on-write.** A write naming an unobserved table/field lands. | Unbuilt — routes to `schema_mismatch`, bumps `asks_extend_failed` (Phase A 0/9). | Phase A steps 1–7 merged; E2E step 9 green; an `ask()` insert with a new field returns `ok` and the column appears in `schema_text`. |
| R2 | **Headless hosted-DB create from a goal.** | `sk_live_` gets 403 `create_requires_session`; `nlq login` device flow unshipped — only a browser session can goal-create. | Either an `sk_live_` goal-create is accepted, or the founder creates the DB in `/app` chat and mints the key (a public-surface step, recorded in §7 as one manual step). |
| R3 | **Value-safe write from the app's Worker.** | `ask()` writes are NL goals: user-typed values ride the goal text to the LLM planning lane, cost preview + confirm (an LLM plan per uncached insert), 60/min per key. `runSql()` has no `params` — literals must be inlined by the app. | A write primitive that carries values out of band (e.g. `runSql({ sql, params })` or structured values on `ask()`), or an explicit founder ruling that goal-text values are acceptable for this iteration. |
| R4 | **Browser reads.** | `pk_live_` is read-only and accepts any origin (pinning unbuilt); browser writes need an nlqdb cookie session — rateme12's end users are not nlqdb users. | Reads may use `pk_live_` from the browser; **all writes go through the clone's Worker with `sk_live_`** — an architecture rule, not a blocker. Green now. |

### 6.2 Further gaps (log, don't fix inside the iteration)

- The schema is designed once at create from the goal sentence; nothing evolves it afterwards (GLOBAL-041 "Why"). Iteration 001 will therefore measure KPI 1 mostly as misses — that is the honest number.
- No end-user auth primitive: the clone brings its own sign-in (Better Auth on the Worker) and stores its users **through nlqdb** like any other data — the first real test of inference on an auth-shaped insert.
- Framework wrappers (`<NlqData>`/`<NlqAction>`) are React/Vue/Svelte/Astro/Solid drop-ins over `/v1/ask`; useful only for reads with `pk_live_`. Not needed for the Worker path.
- Free Neon: 0.5 GB total across all hosted DBs (`docs/cost-ladder.md`); adopted DBs have no per-DB cap.
- Every mutation needs an `Idempotency-Key`; the SDK auto-generates one per call, so form double-submits are **not** deduped unless `data.ts` passes a deterministic key.

## 7. Retrospective — filled at the end

- **Dates / wall-clock hours.**
- **Quarantine list** (`PATHS.txt`, verbatim).
- **What went right.**
- **What went wrong.**
- **Numbers:** inserts attempted / landed; unseen-field writes hit / missed (KPI 1 rate); `schema_mismatch`, `confirm_expired`, `rate_limited` counts; manual steps (list each); tables and columns nlqdb created; p50/p95 insert latency as seen by the app.
- **Post-hoc schema comparison** (read only now): nlqdb's schema vs the real one — as good / better / worse, and why, per table.
- **Decisions to rethink** (GLOBAL / SK-IDs by ID) — edited per P1/P3 **after** this file is committed, never mid-iteration.
- **The one change for iteration 002.**

## 8. Cleanup checklist — after §7 is committed

- [ ] Hosted DB deleted (`client.deleteDatabase()` or `/app` typed-name confirm — there is no `nlq db delete`); `sk_live_` + `pk_live_` revoked (`/app/keys`).
- [ ] `rm -rf apps/rateme12 .github/workflows/deploy-rateme12.yml tests/e2e/rateme12`; `bun run check && bun run typecheck` green.
- [ ] Worker `rateme12` deleted in Cloudflare; `rateme12.nlqdb.com` record removed (founder or CI token).
- [ ] Scratch (`rateme12-src`, `quarantine/`) deleted; iteration branches merged or deleted.
- [ ] README index row updated with the outcome.
