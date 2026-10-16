# Dogfood iteration 001 — rateme12 on nlqdb

**Status:** running (§5a done 2026-10-14 — the last 2 parity gaps declared out of scope; §5b next, on §6.1 R5) · **Governs:** [`GLOBAL-042`](../../decisions/GLOBAL-042-dogfood-iteration-loop.md) · **Measures:** [`GLOBAL-041`](../../decisions/GLOBAL-041-autonomous-dba.md) Phase A KPI 1
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

## 4. Product inventory — filled at §5a step 2

Written from the **live product** and the non-quarantined UI code; nothing here may be derived from quarantined files.

| Item | Value |
|---|---|
| Live URL (look-and-feel reference) | `https://rateme12.com` (directory) + `https://api.rateme12.com` (API, MCP at `/mcp`) — both live 2026-10-07 |
| Stack (framework, language, hosting) | Astro 7 SSR + React islands, TypeScript, Bun workspaces; two Cloudflare Workers (`rateme12-web` → service binding → `rateme12-api`); D1; Better Auth |
| Size (files, LOC after quarantine, number of routes) | 151 files, ~10.7 K LOC (`.ts`/`.tsx`/`.astro`, incl. tests), 13 page routes + 3 sitemaps |
| Routes / pages, in navigation order | `/` (search + category chips + ranked list) · `/c/[tag]` · `/servers/[id]` · `/publishers/[id]` · `/install` ("Connect an agent") · `/submit` · `/fleet` · `/about` · `/privacy` · `/terms` · `/admin/{duplicates,merges,pipelines}` |
| Primary user journeys (≤ 5, entry → action → proof of value) | 1. Search/browse: `/` → query or category → ranked servers with score + stars. 2. Server page: install snippets per client + "what the web says" signals + version history. 3. Rate: server page → 👍/👎 on the current version (signed in) → review listed. 4. Submit a server: `/submit` (signed in) → listed. 5. Connect an agent: `/install` → MCP endpoint; with a key, `/fleet` shows the agent's usage |
| Auth model (who signs in, how; anonymous paths) | Browsing, search and MCP reads are anonymous. Sign-in (email, GitHub, Google via Better Auth) gates rating, submitting and agent keys; admin pages gated to operators |
| External services (email, payments, storage, analytics) | Turnstile; Cloudflare Web Analytics (pageviews, per `/privacy`); GitHub API + the MCP registry (signal and listing imports, ~32 K servers); IndexNow. No payments, no object storage |
| Content types the UI shows (names only, as rendered — not row shapes) | MCP server, category, publisher, version, install snippet, review (👍/👎), ecosystem signals (stars, contributors, last commit, releases, license), registry listing, agent key, fleet usage, duplicate/merge/pipeline (admin) |

## 5. Build plan

Fixed rules per [`TEMPLATE.md §5`](./TEMPLATE.md#5-build-plan). Iteration specifics: code in `apps/rateme12/`, workflow `.github/workflows/deploy-rateme12.yml`, `@nlqdb/sdk` pinned at `0.4.0` at writing (re-check `npm view @nlqdb/sdk version`; its `main` points at TypeScript source — wrangler's bundler handles it). Domain: `[[routes]] pattern = "rateme12.nlqdb.com", custom_domain = true` in `wrangler.toml`, `workers_dev = false`. The first deploy provisions the record — the CI token already does the same for `docs.nlqdb.com`.

### 5a. The clone — starts now, no nlqdb dependency

1. ✅ **Scaffold** (2026-10-07): `apps/rateme12/` serves an honest "not connected yet" placeholder (`noindex`) as static assets; `deploy-rateme12.yml` deploys it on merge.
2. ✅ **Inventory** (2026-10-07): §4, from the live product and the non-quarantined UI. The directory's ~32 K servers arrive by import, not by user writes — §5b step 8 writes both through `insert()`.
3. ✅ **One data module** (2026-10-08): `apps/rateme12/src/data.ts`, one function per §4 journey action (8), each returning `not_connected` until §5b; rows typed `Record<string, unknown>` so no shape is pre-modelled. `tsconfig.json` clears the base `@nlqdb/*` path alias, so `bun run typecheck` rejects an SDK import no dependency declares. That does not enforce the published pin: as a workspace member, `bun install` (1.4.2) links `packages/sdk` for any pin equal to its version (`"0.4.0"`, `npm:` and renamed aliases alike) and fetches the registry only for a pin that differs (probed 2026-10-08); step 6 carries the check.
4. ✅ **Journeys, look-and-feel** (2026-10-13, 13/13 routes). Routes, layout, styling, forms, auth screens, empty/partial/error states, matching the live product side by side; every form posts to a Worker route that calls `data.ts`. `src/worker.ts` is the Worker `main` and its `ROUTES` table is the route list; every page renders in the product's own shell (`src/layout.ts` + `public/styles.css`) and escapes every interpolated value. Every read shows the honest not-connected state until §5b, and a chip is a category the data names, so only "All" shows. Forms work without a script: tabs are a GET, and the account card (`/submit`, `/install`) POSTs to the Worker, which calls `data.ts` `signIn`. Pages gated to a signed-in or operator account (`/fleet`, `/admin/{duplicates,merges,pipelines}`) show the live signed-out card — the true state while no account can exist. `/install` names the rebuild's own endpoint, `rateme12.nlqdb.com/mcp`, with a notice that it isn't served until §5b. Step 5 carries five parity gaps: the Turnstile widget (needs a site key), the `/install` copy buttons (need a script), its telemetry-hook and hosted-gateway sections (rateme12's own client package and relay, not data), and the 404 (live serves Astro's bare default page; the clone, the shell's card).
5. **Visual walk** of every route against the live product; fix parity gaps. `/install` closed 2026-10-13 (gaps 5 → 2): copy buttons (`public/copy.js`, the clone's one script), the hook and gateway sections, and Cursor's one-click Install. The gateway is the rebuild's own `/gateway`, under the same not-connected notice. Chromium at 1100 px shows the same sections and 7 working copy buttons on both pages. ✅ **Closed 2026-10-14 (founder steer):** the Turnstile widget and the 404 are out of scope — they prove nothing about the DBA. No further look-and-feel work in this iteration.

### 5b. The last mile — gated on §6.1, strictly after 5a step 5

The `/daily` loop runs these steps in order, one per run, with no lever picker (`GLOBAL-041` revision 2026-10-14). Writes use the deterministic `insert()` (§6.1 R5); reads use `ask()`.

6. **Hosted DB through the public surface.** Create it from the app's own goal sentence (`createDatabase({ goal })` / `nlq new` / `/app` chat — whichever §6.1 R2 makes available). Record the `dbId` and mint the `sk_live_` as a Worker secret (`wrangler secret put NLQDB_API_KEY`). Pin `@nlqdb/sdk` to a published version and confirm `apps/rateme12/node_modules/@nlqdb/sdk` resolves into `node_modules/.bun/@nlqdb+sdk@<pin>`, not `packages/sdk` (step 3). Never pre-model a field to make KPI 1 look good.
7. **One vertical slice.** Wire one write (`client.insert()`) + its read (`client.ask()`) in `data.ts`, deploy, use it in the browser on the production URL. Log every `schema_mismatch` / `confirm_expired` / `rate_limited` as a §7 number.
8. **Remaining journeys** in `data.ts`, one per commit, same logging — the registry import (~32 K servers) included, written through `insert()` like any app write: it is the bulk of the KPI-1 sample.
9. **E2E walk (P6):** `tests/e2e/rateme12/` — each §4 journey end-to-end on `rateme12.nlqdb.com`; the founder uses the production URL by hand once.

   **9b. Cutover.** The founder points real rateme12 traffic at the nlqdb-backed build (`blocked-by-human.md`). Proof: consecutive days served with zero hand-written DDL — target 14 — and one optimizer proposal applied on the search route with a measured p95 gain (KPI 3's first reading).
10. **Retro** (§7), then **cleanup** (§8). Only then may the real schema be read (post-hoc comparison goes into §7 "Decisions to rethink").

## 6. nlqdb today — what will bite

Verified against code on 2026-09-06. Each item is a finding to log in §7; the build never routes around one with an internal shortcut.

### 6.1 Readiness gate — all five green before §5b step 6

Single source for these gaps — `CLAUDE.md` §1 points here; every engine PR names the row it moves (`CLAUDE.md` §8 item 7). Update **Today** in the same PR.

| # | Capability | Owner (feature doc · code) | Today | Green when |
|---|---|---|---|---|
| R1 | **Widen-on-write.** A write naming an unobserved table/field lands. | [`schema-widening`](../../features/schema-widening/FEATURE.md) `SK-SCHEMA-008` · `apps/api/src/ask/orchestrate.ts` | **Live, no user action; strict walk 10/10 (run 224).** A pinned-DB write goal naming an unobserved table routes `pinned_write` in `route-ask.ts` (SK-ASK-014 refined — create-shaped goals still clarify). The first plan is told the goal-named new table (`newTable`), and a plan that still hijacks an existing table re-plans (`wrong_write_target`). Widen-on-write then compiles and runs the DDL + insert in one transaction and rewrites `schema_hash` (SK-SCHEMA-008/011), with `trace.widen` parity (SK-TRUST-002); confirm landed live on prod in run 214. **`e2e-kpi1-live.yml` on deployed `de56f37`: 10/10** ([36212596504](https://github.com/nlqdb/nlqdb/actions/runs/36212596504), [36212675584](https://github.com/nlqdb/nlqdb/actions/runs/36212675584), 5/5 each, `auth-shaped` included); strict walks were 7/10 on `091912f`. The walk is preview-only over 5 fixed shapes. The formal KPI-1 sample is R5's `insert()` traffic (`GLOBAL-041`). Run-by-run history: `git log`. | Executor + no-flag route live ✅. ✅ **Live walk ≥ 95 % (10/10).** KPI 1's formal exit (`GLOBAL-041`) is tracked in the scorecard, not here. |
| R2 | **Headless hosted-DB create from a goal.** | [`hosted-db-create`](../../features/hosted-db-create/FEATURE.md) `SK-HDC-008` · `apps/api/src/index.ts` `POST /v1/databases` | **Green in code (run 231).** Any account key (`sk_live_`/`sk_mcp_`) goal-creates through `createDatabase({ goal })`, and each create pays the `/v1/ask` per-account limiter. Pinned by `apps/api/test/databases-create.test.ts`. Prod creates failed 10-14 → 10-16 at Neon's 500-role cap; the `SK-HDC-024` reaper, on since 10-16, had prod at 379 tenant roles by 09:05 UTC (the CI smoke branch's copy, [job 116897664628](https://github.com/nlqdb/nlqdb/actions/runs/38878016057/job/116897664628)). | ✅ An `sk_live_` goal-create is accepted. |
| R3 | **Value-safe write from the app's Worker.** | [`sdk`](../../features/sdk/FEATURE.md) `SK-SDK-015` · `packages/sdk/src/index.ts`, `apps/api/src/run/orchestrate.ts` | **Green in code (run 232).** `runSql({ sql, params })` binds user-typed values to `$1…$n` through the Postgres driver; the SQL and `trace` never carry them (`apps/api/src/run/orchestrate.test.ts` pins an injection-shaped value). Writes that need inference still go through `ask()`: a `runSql` INSERT into an unseen table errors, it does not widen. Run 233: a goal-created `created_at` now defaults to `now()` (`SK-HDC-015`), so an app INSERT that omits it lands — app-shaped INSERTs on 9 free-chain schemas 13/26 → 26/26. | ✅ A write primitive carries values out of band. |
| R4 | **Browser reads.** | [`api-keys`](../../features/api-keys/FEATURE.md) `SK-APIKEYS-003` | `pk_live_` is read-only and accepts any origin (pinning unbuilt); browser writes need an nlqdb cookie session — rateme12's end users are not nlqdb users. | Reads may use `pk_live_` from the browser; **all writes go through the clone's Worker with `sk_live_`** — an architecture rule, not a blocker. Green now. |
| R5 | **Deterministic structured insert.** A write never calls a model. | [`schema-widening`](../../features/schema-widening/FEATURE.md) (its SK lands with the code) · `packages/sdk`, `apps/api/src/db-create/compile-write-ddl.ts` | **Amber — API + SDK built (run 249, `SK-SCHEMA-012`), not deployed.** `POST /v1/insert` + `client.insert()`: types from the values, widen + rows in one transaction, no LLM dependency. Real-Postgres walk of a rateme12-shaped stream (600-server registry import, signals, sign-ins, votes, submissions, keys, usage): **unseen-field inserts landed 11/11**, all 13 calls landed, rows readable as the tenant role. Open: `nlq insert` + MCP twin (`GLOBAL-003`), then the live walk on deploy. | `insert(table, rows)` infers types from the values, widens and lands in one transaction, 0 `llm.*` spans under it; SDK + CLI + MCP (`GLOBAL-003`). |

### 6.2 Further gaps (log, don't fix inside the iteration)

- No end-user auth primitive: the clone brings its own sign-in (Better Auth on the Worker) and stores its users **through nlqdb** like any other data — the first real test of inference on an auth-shaped insert.
- Framework wrappers (`<NlqData>`/`<NlqAction>`) are React/Vue/Svelte/Astro/Solid drop-ins over `/v1/ask`; useful only for reads with `pk_live_`. Not needed for the Worker path.
- Free Neon: 0.5 GB total across all hosted DBs (`docs/cost-ladder.md`); adopted DBs have no per-DB cap.
- Every mutation needs an `Idempotency-Key`; the SDK auto-generates one per call, so form double-submits are **not** deduped unless `data.ts` passes a deterministic key.
- No `nlq db delete` — cleanup of the hosted DB needs the SDK or the `/app` typed-name confirm (`GLOBAL-003` gap, log in §7).

## 7. Retrospective — filled at the end

Fields per [`TEMPLATE.md §7`](./TEMPLATE.md#7-retrospective--filled-at-the-end).

**Quarantine `PATHS.txt` (2026-10-07, §2; never opened):** `packages/db`, `apps/api/src` (whole backend — its query layer), `apps/web/src/lib/query.ts` + `query.test.ts`, `e2e/{identity,merge-log,moderation,near-duplicate,owner-aliases,ranking}-fixture.sql` (`moderation` added 2026-10-09, new upstream).

Leverage verdict of this brief at design time (reconciled here when the iteration ends):

```
Leverage: spend-with-seams
N+1: iteration 002 copies TEMPLATE.md and writes only §1, §4, §5 specifics and its §6.1 "Today" column; the seam is docs/history/dogfood-iterations/TEMPLATE.md
Category: a real app built on nlqdb through the public surfaces only — 0 prior instances (queries in GLOBAL-042 §Leverage); one level up, "a workload that exercises nlqdb end to end and measures it" — 7 instances, all JSON-outcome walkers, none builds an app
```

## 8. Cleanup checklist — after §7 is committed

[`TEMPLATE.md §8`](./TEMPLATE.md#8-cleanup-checklist--after-7-is-committed) with `<slug>=rateme12`: scratch `rateme12-src` + `quarantine/`, README index row. After the §5b 9b cutover the serving build — hosted DB, its key, `apps/rateme12`, `deploy-rateme12.yml`, `tests/e2e/rateme12`, Worker and `rateme12.nlqdb.com` record — stays (`GLOBAL-042` rule 4.3).
