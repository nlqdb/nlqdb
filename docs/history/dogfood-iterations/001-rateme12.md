# Dogfood iteration 001 — rateme12 on nlqdb

**Status:** brief (not started) · **Governs:** [`GLOBAL-042`](../../decisions/GLOBAL-042-dogfood-iteration-loop.md) · **Measures:** [`GLOBAL-041`](../../decisions/GLOBAL-041-autonomous-dba.md) Phase A KPI 1
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
- Repo: `omerhochman/rateme12` (founder-confirmed). This proxy may limit `api.github.com` to repo-scoped endpoints, so do not rely on listing. Live URL: confirm with the founder if it differs from rateme12's obvious domain.

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

Fixed rules per [`TEMPLATE.md §5`](./TEMPLATE.md#5-build-plan). Iteration specifics: code in `apps/rateme12/`, workflow `.github/workflows/deploy-rateme12.yml`, `@nlqdb/sdk` pinned at `0.4.0` at writing (re-check `npm view @nlqdb/sdk version`; its `main` points at TypeScript source — wrangler's bundler handles it). Domain: `[[routes]] pattern = "rateme12.nlqdb.com", custom_domain = true` in `wrangler.toml`, `workers_dev = false`. The zone is on Cloudflare, so the first deploy provisions the record if the CI `CLOUDFLARE_API_TOKEN` has Zone → DNS edit. **Founder step:** confirm that scope, or add the record by hand in the Cloudflare dashboard.

### 5a. The clone — starts now, no nlqdb dependency

1. **Scaffold** `apps/rateme12/` (Worker + assets, typecheck/lint in `bun run check`, deploy workflow, custom domain). Ship an honest placeholder page first so the URL is live on day 1.
2. **Inventory** (§4) from the live product.
3. **One data module.** `apps/rateme12/src/data.ts`, one function per journey action (e.g. `listRatings`, `submitRating`), "not connected yet" state until §5b.
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

Single source for these gaps — `CLAUDE.md` §1 points here; every engine PR names the row it moves (`CLAUDE.md` §8 item 7). Update **Today** in the same PR.

| # | Capability | Owner (feature doc · code) | Today | Green when |
|---|---|---|---|---|
| R1 | **Widen-on-write.** A write naming an unobserved table/field lands. | [`schema-widening`](../../features/schema-widening/FEATURE.md) `SK-SCHEMA-008` · `apps/api/src/ask/orchestrate.ts` | **Extend path now wired end-to-end (steps 1–6).** `/v1/ask` absorbs a hosted write to an unobserved table: `orchestrate.ts` Defense A falls through to the preview gate, Defense B calls `deps.extendWrite` to widen + land the write in one Neon transaction and returns `{ok, extendNeeded}` (KPI-1 numerator); `build-deps.ts` wires it lazily (WASM off cold-start, `SK-ASK-024`). Built earlier: extend prompt/op (2), compiler + allow-list (3–4), `buildWidenBatch`/`executeWidenBatch` (5), `widenedSchema`/`rewriteWidenedSchema` D1 CAS (6, `SK-SCHEMA-011`), `extendOnWrite` compose (run 204). **Step 9 E2E extend walk verified against real Postgres (run 206, `widen-walk.integration.test.ts`, 3/3 on a live Neon branch): an insert to an unobserved field and to an unobserved table both land + read back; a doomed write rolls the widen back.** Remaining: trace parity (7); the dogfood-workload live numerator (8) is blocked on `SK-HDC-021` (generic goal-create is session-only, so a headless `/daily` run cannot create the dogfood DB through the public surface). Phase A 7/9. | Phase A steps 1–7 merged; E2E step 9 green; an `ask()` insert with a new field returns `ok` and the column appears in `schema_text`. |
| R2 | **Headless hosted-DB create from a goal.** | [`hosted-db-create`](../../features/hosted-db-create/FEATURE.md) `SK-HDC-021` · `apps/api/src/db-create/`; or [`cli`](../../features/cli/FEATURE.md) `SK-CLI-006` + `SK-AUTH-004` · `cli/internal/cmd/` | `sk_live_` gets 403 `create_requires_session`; `nlq login` device flow unshipped — only a browser session can goal-create. | Either an `sk_live_` goal-create is accepted, or the founder creates the DB in `/app` chat and mints the key (a public-surface step, recorded in §7 as one manual step). |
| R3 | **Value-safe write from the app's Worker.** | [`sdk`](../../features/sdk/FEATURE.md) `SK-SDK-009` · `packages/sdk/src/index.ts`, `apps/api/src/run/orchestrate.ts` | `ask()` writes are NL goals: user-typed values ride the goal text to the LLM planning lane, cost preview + confirm (an LLM plan per uncached insert), 60/min per key. `runSql()` has no `params` — literals must be inlined by the app. | A write primitive that carries values out of band (e.g. `runSql({ sql, params })` or structured values on `ask()`), or an explicit founder ruling that goal-text values are acceptable for this iteration. |
| R4 | **Browser reads.** | [`api-keys`](../../features/api-keys/FEATURE.md) `SK-APIKEYS-003` | `pk_live_` is read-only and accepts any origin (pinning unbuilt); browser writes need an nlqdb cookie session — rateme12's end users are not nlqdb users. | Reads may use `pk_live_` from the browser; **all writes go through the clone's Worker with `sk_live_`** — an architecture rule, not a blocker. Green now. |

### 6.2 Further gaps (log, don't fix inside the iteration)

- The schema is designed once at create from the goal sentence; nothing evolves it afterwards (GLOBAL-041 "Why"). Iteration 001 will therefore measure KPI 1 mostly as misses — that is the honest number.
- No end-user auth primitive: the clone brings its own sign-in (Better Auth on the Worker) and stores its users **through nlqdb** like any other data — the first real test of inference on an auth-shaped insert.
- Framework wrappers (`<NlqData>`/`<NlqAction>`) are React/Vue/Svelte/Astro/Solid drop-ins over `/v1/ask`; useful only for reads with `pk_live_`. Not needed for the Worker path.
- Free Neon: 0.5 GB total across all hosted DBs (`docs/cost-ladder.md`); adopted DBs have no per-DB cap.
- Every mutation needs an `Idempotency-Key`; the SDK auto-generates one per call, so form double-submits are **not** deduped unless `data.ts` passes a deterministic key.
- No `nlq db delete` — cleanup of the hosted DB needs the SDK or the `/app` typed-name confirm (`GLOBAL-003` gap, log in §7).

## 7. Retrospective — filled at the end

Fields per [`TEMPLATE.md §7`](./TEMPLATE.md#7-retrospective--filled-at-the-end). Leverage verdict of this brief at design time (reconciled here when the iteration ends):

```
Leverage: spend-with-seams
N+1: iteration 002 copies TEMPLATE.md and writes only §1, §4, §5 specifics and its §6.1 "Today" column; the seam is docs/history/dogfood-iterations/TEMPLATE.md
Category: a real app built on nlqdb through the public surfaces only — 0 prior instances (queries in GLOBAL-042 §Leverage); one level up, "a workload that exercises nlqdb end to end and measures it" — 7 instances, all JSON-outcome walkers, none builds an app
```

## 8. Cleanup checklist — after §7 is committed

[`TEMPLATE.md §8`](./TEMPLATE.md#8-cleanup-checklist--after-7-is-committed) with `<slug>=rateme12`: hosted DB + both keys, `apps/rateme12` + `deploy-rateme12.yml` + `tests/e2e/rateme12`, Worker `rateme12` + `rateme12.nlqdb.com` record, scratch `rateme12-src` + `quarantine/`, README index row.
