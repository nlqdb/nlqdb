# Dogfood iteration 001 — rateme12 on nlqdb

**Status:** running (§5a steps 1–2 done 2026-10-07) · **Governs:** [`GLOBAL-042`](../../decisions/GLOBAL-042-dogfood-iteration-loop.md) · **Measures:** [`GLOBAL-041`](../../decisions/GLOBAL-041-autonomous-dba.md) Phase A KPI 1
Instantiates [`TEMPLATE.md`](./TEMPLATE.md) — the mechanics (§2 quarantine, §3 token handling, §5 fixed rules, §7 retro fields, §8 cleanup) live there and are not repeated here. The retro (§7) is appended to this file when the iteration ends.

## 1. Goal

Founder, verbatim (2026-09-06):

> a super high priority task is to already build rateme12.nlqdb.com to look like rateme12 but every aspect of db should be replaced with nlqdb sdk

> and the last mile of using the product - either by reading from its db or writing to it, should be when nlqdb is ready for that of course

**Working** for this iteration means: `https://rateme12.nlqdb.com` renders the same primary user journeys as rateme12 (§4 inventory), and every read and write goes through the published `@nlqdb/sdk` against one hosted nlqdb database whose schema nlqdb inferred from the app's own inserts — **zero hand-written DDL, zero model file, zero copied schema**. Two phases: the clone (§5a) starts now and is independent of nlqdb; the data last mile (§5b) starts only when the readiness gate (§6.1) is green. Until then §6.2 is the work queue for the core nlqdb agents.

## 2. Schema quarantine

Run [`TEMPLATE.md §2`](./TEMPLATE.md#2-schema-quarantine--before-opening-any-file-of-the-clone-source) with `<slug>=rateme12` before opening any file of the source. `PATHS.txt` is copied into §7.

## 3. Repo access

- Token: `$RATEME12_GH_TOKEN`, handled per [`TEMPLATE.md §3`](./TEMPLATE.md#3-repo-access).
- Repo: `omerhochman/rateme12` (founder-confirmed; cloned 2026-10-07). Live URL in §4.

## 4. Product inventory — fill on day 1, before §5a step 2

Written from the **live product** and the non-quarantined UI code; nothing here may be derived from quarantined files.

| Item | Value |
|---|---|
| Live URL (look-and-feel reference) | `https://rateme12.com` (directory) + `https://api.rateme12.com` (API, MCP at `/mcp`) — both live 2026-10-07 |
| Stack (framework, language, hosting) | Astro 7 SSR + React islands, TypeScript, Bun workspaces; two Cloudflare Workers (`rateme12-web` → service binding → `rateme12-api`); D1; Better Auth |
| Size (files, LOC after quarantine, number of routes) | 151 files, ~10.7 K LOC (`.ts`/`.tsx`/`.astro`, incl. tests), 13 page routes + 3 sitemaps |
| Routes / pages, in navigation order | `/` (search + category chips + ranked list) · `/c/[tag]` · `/servers/[id]` · `/publishers/[id]` · `/install` ("Connect an agent") · `/submit` · `/fleet` · `/about` · `/privacy` · `/terms` · `/admin/{duplicates,merges,pipelines}` |
| Primary user journeys (≤ 5, entry → action → proof of value) | 1. Search/browse: `/` → query or category → ranked servers with score + stars. 2. Server page: install snippets per client + "what the web says" signals + version history. 3. Rate: server page → 👍/👎 on the current version (signed in) → review listed. 4. Submit a server: `/submit` (signed in) → listed. 5. Connect an agent: `/install` → MCP endpoint; with a key, `/fleet` shows the agent's usage |
| Auth model (who signs in, how; anonymous paths) | Browsing, search and MCP reads are anonymous. Sign-in (email, GitHub, Google via Better Auth) gates rating, submitting and agent keys; admin pages gated to operators |
| External services (email, payments, storage, analytics) | Turnstile; GitHub API + the MCP registry (signal and listing imports, ~32 K servers); IndexNow; R2 (one mention). No payments |
| Content types the UI shows (names only, as rendered — not row shapes) | MCP server, category, publisher, version, install snippet, review (👍/👎), ecosystem signals (stars, contributors, last commit, releases, license), registry listing, agent key, fleet usage, duplicate/merge/pipeline (admin) |

## 5. Build plan

Fixed rules per [`TEMPLATE.md §5`](./TEMPLATE.md#5-build-plan). Iteration specifics: code in `apps/rateme12/`, workflow `.github/workflows/deploy-rateme12.yml`, `@nlqdb/sdk` pinned at `0.4.0` at writing (re-check `npm view @nlqdb/sdk version`; its `main` points at TypeScript source — wrangler's bundler handles it). Domain: `[[routes]] pattern = "rateme12.nlqdb.com", custom_domain = true` in `wrangler.toml`, `workers_dev = false`. The first deploy provisions the record — the CI token already does the same for `docs.nlqdb.com`.

### 5a. The clone — starts now, no nlqdb dependency

1. ✅ **Scaffold** (2026-10-07): `apps/rateme12/` serves an honest "not connected yet" placeholder (`noindex`) as static assets; `deploy-rateme12.yml` deploys it on merge.
2. ✅ **Inventory** (2026-10-07): §4, from the live product and the non-quarantined UI. The directory's ~32 K servers arrive by import, not by user writes — the §5b workload must say which rows the clone writes through `ask()` and which it imports.
3. **One data module.** `apps/rateme12/src/data.ts`, one function per journey action (e.g. `listRatings`, `submitRating`), "not connected yet" state until §5b. The first `.ts` file also adds `tsconfig.json` + a `typecheck` script — `bun run typecheck` silently skips a workspace without one.
4. **Journeys, look-and-feel.** Routes, layout, styling, forms, auth screens, empty/partial/error states, matching the live product side by side. Every form posts to a Worker route that calls `data.ts`.
5. **Visual walk** of every route against the live product; fix parity gaps. The clone is "done" for 5a when a stranger cannot tell the two apart except for the "not connected" states.

### 5b. The last mile — gated on §6.1, strictly after 5a step 5

6. **Hosted DB through the public surface.** Create it from the app's own goal sentence (`createDatabase({ goal })` / `nlq new` / `/app` chat — whichever §6.1 R2 makes available). Record the `dbId` and mint the `sk_live_` as a Worker secret (`wrangler secret put NLQDB_API_KEY`). Never pre-model a field to make KPI 1 look good.
7. **One vertical slice.** Wire one write + its read in `data.ts` through `client.ask()` (preview → `confirm: true`), deploy, use it in the browser on the production URL. Log every `schema_mismatch` / `confirm_expired` / `rate_limited` as a §7 number.
8. **Remaining journeys** in `data.ts`, one per commit, same logging.
9. **E2E walk (P6):** `tests/e2e/rateme12/` — each §4 journey end-to-end on `rateme12.nlqdb.com`; the founder uses the production URL by hand once.
10. **Retro** (§7), then **cleanup** (§8). Only then may the real schema be read (post-hoc comparison goes into §7 "Decisions to rethink").

## 6. nlqdb today — what will bite

Verified against code on 2026-09-06 (`apps/api/src/ask/orchestrate.ts`, `principal.ts`, `packages/sdk/src/index.ts`, `SK-APIKEYS-003`, `SK-ELEM-011`, `SK-RL-001`). Each item is a finding to log in §7; the build never routes around one with an internal shortcut.

### 6.1 Readiness gate — all four green before §5b step 6

Single source for these gaps — `CLAUDE.md` §1 points here; every engine PR names the row it moves (`CLAUDE.md` §8 item 7). Update **Today** in the same PR.

| # | Capability | Owner (feature doc · code) | Today | Green when |
|---|---|---|---|---|
| R1 | **Widen-on-write.** A write naming an unobserved table/field lands. | [`schema-widening`](../../features/schema-widening/FEATURE.md) `SK-SCHEMA-008` · `apps/api/src/ask/orchestrate.ts` | **Live, no user action; strict walk 10/10 (run 224).** A pinned-DB write goal naming an unobserved table routes `pinned_write` in `route-ask.ts` (SK-ASK-014 refined — create-shaped goals still clarify). The first plan is told the goal-named new table (`newTable`), and a plan that still hijacks an existing table re-plans (`wrong_write_target`). Widen-on-write then compiles and runs the DDL + insert in one transaction and rewrites `schema_hash` (SK-SCHEMA-008/011), with `trace.widen` parity (SK-TRUST-002); confirm landed live on prod in run 214. **`e2e-kpi1-live.yml` on deployed `de56f37`: 10/10** ([36212596504](https://github.com/nlqdb/nlqdb/actions/runs/36212596504), [36212675584](https://github.com/nlqdb/nlqdb/actions/runs/36212675584), 5/5 each, `auth-shaped` included); strict walks were 7/10 on `091912f`. The walk is preview-only over 5 fixed shapes. **Formal dogfood sample: 2 HIT / 1 MISS** (run 230's first `scorecard_deltas` insert HIT `landed_widened`). Run 225 missed (`schema_mismatch`, the extend plan renamed the INSERT's columns); run 226's fix HIT on its merge. Run 228 closes the reserved-word miss class: a write-dictated name like `row` / `user` / `order` is admitted and quoted (agent-side `dogfood-delta` 3/3). Since run 230 the dogfood writer also sends each changed scorecard row to `scorecard_deltas`. Run-by-run history: `git log`. | Executor + no-flag route live ✅. ✅ **Live walk ≥ 95 % (10/10).** KPI 1's formal exit (190/200 real first-inserts, `GLOBAL-041`) is tracked in the scorecard, not here. |
| R2 | **Headless hosted-DB create from a goal.** | [`hosted-db-create`](../../features/hosted-db-create/FEATURE.md) `SK-HDC-008` · `apps/api/src/index.ts` `POST /v1/databases` | **Green in code (run 231).** Any account key (`sk_live_`/`sk_mcp_`) goal-creates through `createDatabase({ goal })`, and each create pays the `/v1/ask` per-account limiter. Pinned by `apps/api/test/databases-create.test.ts`; a live create lands with the next Deploy API. | ✅ An `sk_live_` goal-create is accepted. |
| R3 | **Value-safe write from the app's Worker.** | [`sdk`](../../features/sdk/FEATURE.md) `SK-SDK-015` · `packages/sdk/src/index.ts`, `apps/api/src/run/orchestrate.ts` | **Green in code (run 232).** `runSql({ sql, params })` binds user-typed values to `$1…$n` through the Postgres driver; the SQL and `trace` never carry them (`apps/api/src/run/orchestrate.test.ts` pins an injection-shaped value). Writes that need inference still go through `ask()`: a `runSql` INSERT into an unseen table errors, it does not widen. Run 233: a goal-created `created_at` now defaults to `now()` (`SK-HDC-015`), so an app INSERT that omits it lands — app-shaped INSERTs on 9 free-chain schemas 13/26 → 26/26. | ✅ A write primitive carries values out of band. |
| R4 | **Browser reads.** | [`api-keys`](../../features/api-keys/FEATURE.md) `SK-APIKEYS-003` | `pk_live_` is read-only and accepts any origin (pinning unbuilt); browser writes need an nlqdb cookie session — rateme12's end users are not nlqdb users. | Reads may use `pk_live_` from the browser; **all writes go through the clone's Worker with `sk_live_`** — an architecture rule, not a blocker. Green now. |

### 6.2 Further gaps (log, don't fix inside the iteration)

- The schema is designed once at create from the goal sentence; nothing evolves it afterwards (GLOBAL-041 "Why"). Iteration 001 will therefore measure KPI 1 mostly as misses — that is the honest number.
- No end-user auth primitive: the clone brings its own sign-in (Better Auth on the Worker) and stores its users **through nlqdb** like any other data — the first real test of inference on an auth-shaped insert.
- Framework wrappers (`<NlqData>`/`<NlqAction>`) are React/Vue/Svelte/Astro/Solid drop-ins over `/v1/ask`; useful only for reads with `pk_live_`. Not needed for the Worker path.
- Free Neon: 0.5 GB total across all hosted DBs (`docs/cost-ladder.md`); adopted DBs have no per-DB cap.
- Every mutation needs an `Idempotency-Key`; the SDK auto-generates one per call, so form double-submits are **not** deduped unless `data.ts` passes a deterministic key.
- No `nlq db delete` — cleanup of the hosted DB needs the SDK or the `/app` typed-name confirm (`GLOBAL-003` gap, log in §7).

## 7. Retrospective — filled at the end

Fields per [`TEMPLATE.md §7`](./TEMPLATE.md#7-retrospective--filled-at-the-end).

**Quarantine `PATHS.txt` (2026-10-07, §2; never opened):** `packages/db`, `apps/api/src` (whole backend — its query layer), `apps/web/src/lib/query.ts` + `query.test.ts`, `e2e/{identity,merge-log,near-duplicate,owner-aliases,ranking}-fixture.sql`.

Leverage verdict of this brief at design time (reconciled here when the iteration ends):

```
Leverage: spend-with-seams
N+1: iteration 002 copies TEMPLATE.md and writes only §1, §4, §5 specifics and its §6.1 "Today" column; the seam is docs/history/dogfood-iterations/TEMPLATE.md
Category: a real app built on nlqdb through the public surfaces only — 0 prior instances (queries in GLOBAL-042 §Leverage); one level up, "a workload that exercises nlqdb end to end and measures it" — 7 instances, all JSON-outcome walkers, none builds an app
```

## 8. Cleanup checklist — after §7 is committed

[`TEMPLATE.md §8`](./TEMPLATE.md#8-cleanup-checklist--after-7-is-committed) with `<slug>=rateme12`: hosted DB + both keys, `apps/rateme12` + `deploy-rateme12.yml` + `tests/e2e/rateme12`, Worker `rateme12` + `rateme12.nlqdb.com` record, scratch `rateme12-src` + `quarantine/`, README index row.
