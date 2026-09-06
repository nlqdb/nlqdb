# Dogfood iteration NNN — <product> on nlqdb

Copy this file to `NNN-<slug>.md` to open an iteration of
[`GLOBAL-042`](../../decisions/GLOBAL-042-dogfood-iteration-loop.md). Sections
§1, §4, §5 are the iteration's own judgment; §2, §3, §6–§8 are mechanics every
iteration runs the same way — instantiate them, do not rewrite them. The file
is the execution brief; the retro (§7) is appended when the iteration ends.

**Status:** brief (not started) → running → retro written → cleaned up ·
**Governs:** `GLOBAL-042` · **Measures:** [`GLOBAL-041`](../../decisions/GLOBAL-041-autonomous-dba.md) Phase A KPI 1

## 1. Goal

Founder's words verbatim, then one paragraph defining **working** for this
iteration: which journeys render, and that every read and write goes through
the published `@nlqdb/sdk` against one hosted nlqdb database whose schema
nlqdb inferred from the app's own inserts — zero hand-written DDL, zero model
file, zero copied schema.

## 2. Schema quarantine — before opening any file of the clone source

Mechanical; run in this order, in the scratchpad, never in this repo.

1. `git clone` the product into `<scratch>/<slug>-src` (§3). Do **not** open any file yet.
2. List by **name only** (`find … -iname`), never by content, every path matching:
   migrations (`migrations/`, `migrate/`, `db/migrate/`), ORM schema/models (`prisma/`, `*.prisma`, `drizzle/`, `schema.ts`, `schema.rb`, `structure.sql`, `models.py`, `models/`, `entities/`, `typeorm`, `sequelize`, `knex`, `kysely`), `*.sql`, `seeds/`, `fixtures/`, `*.dump`, `*.erd`, `*.graphql`/OpenAPI specs (row-shaped types), `supabase/`, any `docs/**` file named `*db*`/`*schema*`/`*data-model*`, and the backend query/repository layer (`repositories/`, `queries/`, `dao/`, `db/`, `database/`, `*Repository*`, `*Query*`).
3. `mv` every match to `<scratch>/quarantine/` (outside the source tree). Save the list to `<scratch>/quarantine/PATHS.txt`; copy it into §7. Never open anything in `quarantine/`.
4. **Grey area:** frontend UI props and component code may be read. A type or object that mirrors a table row (id + fields + timestamps) is **not copied** — stop reading that file, add it to `PATHS.txt`, and design the UI shape from the rendered product instead.
5. The real schema is read only **post-hoc**: after the last mile works and §7 is written (`GLOBAL-042` rule 2).

## 3. Repo access

The token arrives as an env var (`$<PRODUCT>_GH_TOKEN`). Use it **only** as
`Authorization: Bearer` in `curl`, or via a git credential helper that reads
the env var — never in a remote URL, shell history file, log, commit, PR body
or doc. Clone: `git -c credential.helper='!f(){ echo username=x-access-token; echo password=$<PRODUCT>_GH_TOKEN; };f' clone https://github.com/<owner>/<repo> <scratch>/<slug>-src`.
Record the repo (founder-confirmed) and the live URL here.

## 4. Product inventory — fill on day 1, before the first journey is built

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

Fixed rules, then the iteration's own step list.

- **Where the code lives:** `apps/<slug>/` — a Cloudflare Worker with Static
  Assets (mirror `apps/web/wrangler.toml`), deployed by
  `.github/workflows/deploy-<slug>.yml` copied from `deploy-web.yml`, served at
  `<slug>.nlqdb.com`. It depends on the **published** `@nlqdb/sdk` at a pinned
  version — never `workspace:*`, never an import from `packages/**` or
  `apps/api/**` — so cleanup is `rm -rf` of those paths. TypeScript on Workers
  whatever the product's stack is ([`GLOBAL-013`](../../decisions/GLOBAL-013-free-tier-bundle-budget.md)).
- **One data module:** `apps/<slug>/src/data.ts` is the only file that calls
  the SDK — one exported function per journey read/write, `createClient`
  server-side only. Until the last mile it returns the honest "not connected
  yet" state: no mock rows, no fixtures, no in-memory store (P6).
- **Two phases:** (a) the clone — scaffold, inventory, journeys, look-and-feel,
  visual walk against the live product; (b) the data last mile — starts only
  when §6 is green: hosted DB created from the app's goal sentence through a
  public surface, one vertical slice (write + read) used in the browser on the
  production URL, remaining journeys one per commit, E2E walk under
  `tests/e2e/<slug>/`, founder uses the production URL once. Every
  `schema_mismatch` / `confirm_expired` / `rate_limited` is a §7 number; the
  build never routes around a gap with an internal shortcut.

## 6. Readiness gate

Copy the previous iteration's §6.1 table and re-verify every **Today** cell
against code on day 1, citing files. Rows so far: R1 widen-on-write, R2
headless hosted-DB create from a goal, R3 value-safe write from the app's
Worker, R4 browser reads. Add a row for each new blocker; a row leaves only
when it was green in a shipped iteration. §6.2 lists further gaps to **log,
not fix** inside the iteration.

## 7. Retrospective — filled at the end

- **Dates / wall-clock hours.**
- **Quarantine list** (`PATHS.txt`, verbatim).
- **What went right.** / **What went wrong.**
- **Numbers:** inserts attempted / landed; unseen-field writes hit / missed (KPI 1 rate); `schema_mismatch`, `confirm_expired`, `rate_limited` counts; manual steps (list each); tables and columns nlqdb created; p50/p95 insert latency as seen by the app.
- **Post-hoc schema comparison** (read only now): nlqdb's schema vs the real one — as good / better / worse, and why, per table.
- **Decisions to rethink** (GLOBAL / SK-IDs by ID) — edited per P1/P3 **after** this file is committed, never mid-iteration.
- **The one change for iteration NNN+1.**
- **Leverage verdict** (`GLOBAL-042` §Leverage), three lines:
  `Leverage: invest | spend | spend-with-seams` ·
  `N+1: <what the next iteration costs; the artifact it touches>` ·
  `Category: <name; instance count + where>`. Every manual step in
  **Numbers** that a public surface could have done is a product gap
  (`GLOBAL-003`), not a candidate for an iteration script.

## 8. Cleanup checklist — after §7 is committed

- [ ] Hosted DB deleted (`client.deleteDatabase()` or `/app` typed-name confirm); every `sk_live_` / `pk_live_` minted for the iteration revoked (`/app/keys`).
- [ ] `rm -rf apps/<slug> .github/workflows/deploy-<slug>.yml tests/e2e/<slug>`; `bun run check && bun run typecheck` green.
- [ ] Worker `<slug>` deleted in Cloudflare; `<slug>.nlqdb.com` record removed (founder or CI token).
- [ ] Scratch (`<slug>-src`, `quarantine/`) deleted; iteration branches merged or deleted.
- [ ] [`README.md`](./README.md) index row updated with the outcome.
