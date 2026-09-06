# End goal — nlqdb, finished

The autonomous DBA as the user meets it, flow by flow. Decisions are cited by
ID and never restated here (`CLAUDE.md` P3): [`GLOBAL-041`](decisions/GLOBAL-041-autonomous-dba.md)
(the bet, the three KPIs and their floors, the phase build order),
[`GLOBAL-042`](decisions/GLOBAL-042-dogfood-iteration-loop.md) (the agent
builds a real product on it), [`GLOBAL-025`](decisions/GLOBAL-025-north-star.md)
(the four pillars), and the feature `SK-*` IDs named per step.

## How agents use this doc

Read it before taking a roadmap item and before judging a PR: it **outranks
the roadmap** — a contradicting item is a roadmap bug, fixed in the same PR — and
`CLAUDE.md` P1–P6 outranks it. A gap here is a decision for `docs/blocked-by-human.md`
([`GLOBAL-033`](decisions/GLOBAL-033-resolution-defaults.md)), never a license to
invent; sequencing lives in [`phase-plan.md`](phase-plan.md), and amendments are
deliberate, per [build-with-agents § How to write this](https://github.com/omerhochman/build-with-agents/blob/main/docs/END_GOAL.md#how-to-write-this).

## Personas & entry points

- **Solo builder** (P1 in [`research/personas.md`](research/personas.md)) — one developer shipping an app, entering at `npm i @nlqdb/sdk` or `nlq new` where they would otherwise open a migration file. Success: production traffic, and they never wrote a `CREATE TABLE`.
- **The building agent** (`GLOBAL-042`) — a coding agent building a real product, first target rateme12 ([`001-rateme12.md`](history/dogfood-iterations/001-rateme12.md)), through the public surfaces only. Success: every read and write through nlqdb, zero hand-written DDL, the inferred schema as good as or better than the hand-made one.
- **Operator of a live DB** — the same person a week after launch, entering at `/app/dba`. Success: one click applies a proposal and the affected fingerprint's p95 drops; one click undoes it.

## The happy path

**`npm i @nlqdb/sdk` → an insert whose field nobody modeled** (rows 1–7), then
the DBA acting on a live database (8–10) and a stranger's first answer (11–12).

| # | Sees | Does | Latency |
|---|------|------|---------|
| 1 | `@nlqdb/sdk` README's first snippet: a key, a goal sentence, an `ask()` | `npm i @nlqdb/sdk`; mints an `sk_live_` key (`/app/keys`, or the `nlq login` device flow when headless — `SK-CLI-006` + `SK-AUTH-004`) | — |
| 2 | `createDatabase({ goal })` returns a `dbId` and the schema nlqdb wrote from the goal sentence — there is no `CREATE TABLE` verb on any surface | pastes the app's one-sentence goal | `db-create` provisioning budget (`SK-HDC-010`) |
| 3 | First write: `requires_confirm: true` with a `diff` naming rows and columns affected, plus `trace.sql` (`SK-TRUST-001`, `SK-TRUST-002`) — the same payload on every surface, rendered in a TTY by `nlq`, carried to a host agent as MCP's `confirm_required`, and blocking `<nlq-action>` until accepted (`GLOBAL-003`) | reads the diff, re-sends with `confirm: true` | `/v1/ask` cache-miss SLO ([`performance.md` §1](performance.md)) |
| 4 | The row is in the database; `/app` renders the table the DBA created, its trace pane always present and collapsed by default — no toggle, no tier gate (`SK-TRUST-002`) | reads it back with `ask()` | `/v1/ask` cache-hit SLO |
| 5 | A later write carries a field the schema has never seen. No error: the response's diff names the **added column**, the row is in the same commit (`GLOBAL-041` Phase A; `SK-SCHEMA-008`) | keeps writing the app's own data, unchanged | `/v1/ask` cache-miss SLO — one round trip, no second call |
| 6 | `asks_extend_ok` increments; the rate is on the scorecard and `/app` (`SK-SCHEMA-010`) | nothing | — |
| 7 | Queries written against the old shape still answer; the plan cache re-plans only what the new shape changed (`SK-SCHEMA-005`) | ships | `/v1/ask` cache-hit SLO |
| 8 | `/app/dba`: where the data lives (tables × engine), bottom-line usage and cost, the proposal list, and applied history — the physical, non-destructive changes (index creates) the DBA applied on its own, each with the affected fingerprint's p95 7 days after vs 7 days before (`GLOBAL-041` Phase B items 6–7) | opens one page | `apps/web` page-load budget |
| 9 | A logical proposal (drop / rename / retype / move-to-engine) with a before/after diff, the expected effect, and the inverse recorded at proposal time (Phase B item 3); the applied row bumps its `schema_hash` and carries its span ([`GLOBAL-014`](decisions/GLOBAL-014-otel-on-external-calls.md)) and `Idempotency-Key` ([`GLOBAL-005`](decisions/GLOBAL-005-idempotency-key.md)), so a double-click cannot double-apply | clicks **apply** once | apply budget under `SK-HDC-010` |
| 10 | **Undo** on any applied row — the recorded inverse, not a re-derivation; a change that made things worse is **already undone**, with the measured regression on the row (KPI 3's no-un-undone-regression rule) | clicks once, or nothing | apply budget |
| 11 | nlqdb.com with one input and one-click starter goals (`SK-ONBOARD-008`); then a database created anonymously and the chat, trace pane collapsed | types a goal or clicks a starter, then asks a question | landing → first answer within the `GLOBAL-025` TTFV floors |
| 12 | On sign-in, the same DB and prompt history, adopted onto the account (`recordAnonAdoption`, `SK-ANON-001`) | signs in when they want the key | `/api/auth/callback/github` SLO |

**Not in this flow:** no `CREATE TABLE`, model file, migration file or schema
step of any kind (`GLOBAL-041`); no wizard, plan-picker or email-verification
wall (`SK-ONBOARD-001`); no card ([`GLOBAL-013`](decisions/GLOBAL-013-free-tier-bundle-budget.md));
no advisory tab that only recommends (`GLOBAL-041` rejected recommend-only),
user-authored migration or approval queue; no waitlist or access gate before
the first answer.

## Empty, error, and edge states

Wire copy is one sentence — what happened and the next action
([`GLOBAL-012`](decisions/GLOBAL-012-one-sentence-errors.md)); codes and
copy are canonical in [`error-taxonomy`](features/error-taxonomy/FEATURE.md).

| State | Trigger | Sees | Can do |
|-------|---------|------|--------|
| Empty | New DB, no rows | The schema nlqdb wrote from the goal, and the input; reads answer with 0 rows, not an error | Write the first row |
| Unseen field | A write names a table/column that never existed | The diff, with the added column in it — **not** an error; every existing query and cached plan keeps working | Confirm |
| Ambiguous goal | Plan confidence below its floor | `clarify_required` with the candidate readings as options (`SK-TRUST-003`, [`GLOBAL-040`](decisions/GLOBAL-040-guided-turn-not-dead-end.md)); nothing was executed | Pick a reading — one click, no retyping |
| Stale preview | Confirm arrives after the preview expired | `confirm_expired`; the un-committed data is untouched | Re-preview (one call) |
| Ceiling reached | Per-key `/v1/ask` limit; or free Neon storage across hosted DBs ([`cost-ladder.md`](cost-ladder.md)) | `rate_limited` with when to retry (`SK-RL-001`), or one sentence naming the storage ceiling; reads from cache and existing DBs keep working | Retry after the stated window; or delete a DB from `/app` or the SDK |
| Bad proposal | An applied change regresses p95 beyond KPI 3's tolerance | The auto-undone row in applied history, with both measurements | Nothing required — the workload is back on its pre-apply plan |

A provider outage is not a row: the router fails over its round-robin roster
([`GLOBAL-026`](decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md))
and recoverable failures retry to success
([`GLOBAL-022`](decisions/GLOBAL-022-recoverable-failures-retry-to-success.md)).

## Done looks like

- [ ] Every row above works end to end on `nlqdb.com` / `/app` / the
      published `@nlqdb/sdk`, `nlq` and MCP surfaces, inside the
      [`performance.md` §1](performance.md) SLOs.
- [ ] The three `GLOBAL-041` KPIs are live instruments and stand at their
      floors (first-insert inference, evolution-without-user-action, optimizer
      yield); the `GLOBAL-025` onboarding, UX and performance floors hold at
      the same time.
- [ ] `001-rateme12.md` §6.1 rows R1–R4 are green, and `rateme12.nlqdb.com`
      renders rateme12's journeys with every read and write through
      `@nlqdb/sdk` — zero hand-written DDL, zero copied schema.
- [ ] The post-hoc comparison in that iteration's retro records nlqdb's
      inferred schema as **as good as or better than** the hand-made one
      (`GLOBAL-042` rule 3) — a schema that was never an input during the
      iteration (rule 2; copying would measure copying).
- [ ] Every DBA change — widen, drop, rename, retype, index, engine move — is
      previewed, versioned and undoable, and a stranger reaches a first answer
      with no account, no card and no configuration.

## Non-goals

- **Not an NL→SQL product, and not a recommend-only advisor.** `/v1/ask` is the interface an app whose data was never modeled by hand uses to address it; the DBA is the product, and every proposal carries an apply and an inverse (`GLOBAL-041`).
- **No user-authored migrations, ever.** The engine emits every DDL statement; there is no migration file, folder or CLI verb to write one.
- **No undo-after-commit on user writes.** The diff-then-confirm gate is the user action (`SK-TRUST-001`); undo exists for DBA proposals, whose inverse is recorded before they run.
- **No login wall, waitlist or access gate** ([`GLOBAL-007`](decisions/GLOBAL-007-no-login-wall.md)), no paid dependency on the critical path (`GLOBAL-013`), and no pricing or plan work for the DBA product until Phase B ships (`GLOBAL-041`).
