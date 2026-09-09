# End goal — nlqdb, finished

The autonomous DBA as the user meets it — every phase the docs plan, no phase
labels in the flow. Shaping every row:
[`GLOBAL-041`](decisions/GLOBAL-041-autonomous-dba.md),
[`GLOBAL-042`](decisions/GLOBAL-042-dogfood-iteration-loop.md),
[`GLOBAL-025`](decisions/GLOBAL-025-north-star.md).

## How agents use this doc

**The top-ranked document in this repo** — it outranks the roadmap, `CLAUDE.md`
P1–P6, every `GLOBAL` and every `FEATURE.md`. Read before taking an item or
judging a PR: whatever contradicts a flow or principle here is the bug, fixed
in that PR (or the founder amends this doc in that PR). A
gap is a [`blocked-by-human.md`](blocked-by-human.md) decision (`GLOBAL-033`),
never a licence to invent.

## Architecture — simple and scalable

The DBA loop — infer → evolve → optimize → show/apply/undo (`GLOBAL-041`) —
runs on one design, never on patches. **Patch-on-patch**: a fix or feature that
adds a conditional, layer, flag, table or special case on top of existing
machinery instead of changing the machinery. Faced with one: stop, re-derive
the simplest design that serves the whole loop, implement that, delete what it
replaces. **Scalable**: that one design holds at 1 table and 1 000 tables,
1 tenant and 10 k tenants — no per-scale rewrite, no per-tenant branch.

## Personas & entry points

- **Solo builder** ([P1](research/personas.md)) — enters at `npm i @nlqdb/sdk`, not a migration file. Wins: production traffic, no `CREATE TABLE`.
- **The building agent** (`GLOBAL-042`) — builds on public surfaces only, first [rateme12](history/dogfood-iterations/001-rateme12.md). Wins: the inferred schema beats the hand-made one.
- **Operator of a live DB** — the same person weeks on, at `/app/dba`. Wins: a click applies a proposal and p95 drops, a click undoes it.

## The happy path

| # | Sees | Does | Latency |
|---|------|------|---------|
| 1 | `createDatabase({ goal })` returns a `dbId` and the schema nlqdb wrote — no surface has a `CREATE TABLE` verb | `npm i @nlqdb/sdk`, mints `sk_live_` (`SK-CLI-006`), pastes one goal sentence | `SK-HDC-010` |
| 2 | First write: `requires_confirm` with a `diff` and `trace.sql` — one payload on every surface (`SK-TRUST-001`, `GLOBAL-003`). Confirmed, the row is in the database and `/app` shows the DBA's table, trace present, never tier-gated (`SK-TRUST-002`) | confirms, reads back | miss, then hit ([`performance.md` §1](performance.md)) |
| 3 | A write with a never-seen field: the diff names the **added column**, the row lands in the same commit (`SK-SCHEMA-008`); old-shape queries still answer, only what changed re-plans (`SK-SCHEMA-005`), `asks_extend_ok` on the [scorecard](scorecard.md) (`SK-SCHEMA-010`) | keeps writing app data | one round trip |
| 4 | `/app/dba` — tables × engine, usage and cost, proposals, applied history with each fingerprint's p95 7 days after vs before | opens one page | page-load |
| 5 | A drop / rename / retype proposal: diff, expected effect, inverse recorded up front (`SK-MIGRATE-003`); apply bumps `schema_hash` (`SK-SCHEMA-009`) under `GLOBAL-014` + `GLOBAL-005`, **undo** replays the inverse, and a change that made things worse is already undone | **apply** or **undo**, once | `SK-HDC-010` |
| 6 | A `move_to_engine` proposal (`SK-MULTIENG-003`) — dual-read verified, reversible after cutover; the trace names the index or Pipe serving each query (`SK-MIGRATE-005`) | applies; queries keep their shape | cache-hit SLO |
| 7 | One model picker everywhere: the free chain, their own key at 0 % markup, or hosted premium with allowance and spend cap (`SK-PREMIUM-008`, `-009`, `-011`) | picks a model, or keeps the default | — |
| 8 | A whole product built this way — `rateme12.nlqdb.com`, every read and write through `@nlqdb/sdk`, schema inferred from its inserts | writes app code, no DDL | — |
| 9 | nlqdb.com: one input and starter goals (`SK-ONBOARD-008`), an anonymous DB, the chat; sign-in adopts it and its history (`SK-ANON-001`) | asks, signs in for a key | `GLOBAL-025` TTFV |

**Not in this flow:** no wizard, plan-picker or verification wall
(`SK-ONBOARD-001`), no advisory-only tab, no approval queue.

## Empty, error, and edge states

| State | Trigger | Sees | Can do |
|-------|---------|------|--------|
| Empty | New DB, no rows | The schema nlqdb wrote; reads answer 0 rows, not an error | Write a row |
| Unseen field | A write names a table or column that never existed | The diff with the added column, not an error; cached plans still hit | Confirm, or re-preview if expired |
| Ambiguous goal | Plan confidence below its floor | `clarify_required` lists the readings (`SK-TRUST-003`, `GLOBAL-040`); nothing ran | Pick one, no retyping |
| Ceiling reached | Per-key limit, premium allowance, or free storage ([`cost-ladder.md`](cost-ladder.md)) | `rate_limited` with when to retry (`SK-RL-001`), or the ceiling named | Retry, upgrade, delete |
| Bad proposal | An applied change regresses p95 past KPI 3's tolerance | The auto-undone row, both measurements on it | Nothing — the old plan is back |

## Done looks like

- [ ] Every row above works on `nlqdb.com`, `/app`, `@nlqdb/sdk`, `nlq` and MCP inside the [`performance.md` §1](performance.md) SLOs, and a stranger gets a first answer with no account, card or config.
- [ ] The `GLOBAL-041` and `GLOBAL-025` KPIs stand at their floors.
- [ ] `rateme12.nlqdb.com` runs on zero hand-written DDL, its retro rating the inferred schema **as good as or better than** the hand-made one it never saw first (`GLOBAL-042` 2–3).
- [ ] Every DBA change — widen, drop, rename, retype, index, engine move — is previewed, versioned, undoable; dual reads agree 100 %.

## Non-goals

- **Not an NL→SQL product, not a recommend-only advisor** (`GLOBAL-041`).
- **No user-authored migrations, ever.** The engine emits every DDL statement; no file, folder or CLI verb writes one.
- **No undo after a committed user write.** Diff-then-confirm is that action (`SK-TRUST-001`); undo belongs to DBA proposals, whose inverse is recorded first.
