# End goal — nlqdb, finished

The autonomous DBA as the user meets it, flow by flow. Decisions are cited by
ID and never restated here (`CLAUDE.md` P3): [`GLOBAL-041`](decisions/GLOBAL-041-autonomous-dba.md)
(the bet, the three KPIs and their floors, the phase build order),
[`GLOBAL-042`](decisions/GLOBAL-042-dogfood-iteration-loop.md) (the agent
builds a real product on it), [`GLOBAL-025`](decisions/GLOBAL-025-north-star.md)
(the four pillars), and the feature `SK-*` IDs named per step.

## How agents use this doc

- **Read it before taking a roadmap item and before judging a PR.** The
  question is the same for both: which step of which flow below does this
  move closer to its written state — and does it move any other step away?
- **This doc outranks the roadmap.** A roadmap item that contradicts a flow
  here is a roadmap bug: fix the item in the same PR (rewrite, reorder, or
  delete it); never bend the flow to fit the item.
- **Firm calls outrank this doc.** A flow that needs a firm-call violation
  is a hard stop → `docs/blocked-by-human.md`, with a recommendation.
- **A gap here is a decision, not a license.** Interaction design this doc
  doesn't cover goes through the escalation bar (`CLAUDE.md` P1 +
  [`GLOBAL-033`](decisions/GLOBAL-033-resolution-defaults.md)): propose
  the missing step as an amendment to this doc; never invent it silently in
  code.
- **It describes done, not the order to get there.** Sequencing lives in
  [`phase-plan.md`](phase-plan.md) and `GLOBAL-041`'s build order. This doc
  changes only by deliberate amendment (a steering session, or a PR whose
  stated purpose is the amendment), never as a side effect of shipping.
- **Amendments follow the template's writing rules** — flows not features,
  no adjectives, numbers over vibes, say what isn't there:
  [build-with-agents END_GOAL.md § How to write this](https://github.com/omerhochman/build-with-agents/blob/main/docs/END_GOAL.md#how-to-write-this).

## Personas & entry points

- **Solo builder** (P1 in [`research/personas.md`](research/personas.md)) —
  one developer shipping an app. Reaches for nlqdb at the moment they would
  otherwise open a migration file, via `npm i @nlqdb/sdk` or `nlq new`.
  Success: the app serves production traffic and they never wrote a
  `CREATE TABLE`.
- **The building agent** (`GLOBAL-042`) — a coding agent building a real
  product, first target rateme12
  ([`001-rateme12.md`](history/dogfood-iterations/001-rateme12.md)), through
  the public surfaces only: `@nlqdb/sdk`, `nlq`, MCP. Success: every read and
  write goes through nlqdb with zero hand-written DDL, and the schema nlqdb
  inferred is judged, post-hoc, as good as or better than the hand-made one
  (`GLOBAL-042` rules 1–3).
- **Operator of a live DB** — the same person a week after launch, checking
  what the DBA did while they slept. Entry: `/app/dba`. Success: one click
  applies a proposal and the affected fingerprint's p95 drops; one click
  undoes it.

## The happy path

**Flow A — first app, no data modeling** — solo builder or agent, from
`npm i @nlqdb/sdk` to the insert whose field nobody modeled.

| # | Sees | Does | Latency | Feels — because |
|---|------|------|---------|-----------------|
| 1 | `@nlqdb/sdk` README's first snippet: a key, a goal sentence, an `ask()` | `npm i @nlqdb/sdk`; mints an `sk_live_` key (`/app/keys`, or `nlq login` device flow — `SK-CLI-006` + `SK-AUTH-004`) | — | Nothing to configure — the snippet is the whole setup |
| 2 | `createDatabase({ goal })` returns a `dbId` and the schema nlqdb wrote from the goal sentence | pastes the app's one-sentence goal | `db-create` provisioning budget (`SK-HDC-010`) | No modeling step existed — because there is no `CREATE TABLE` verb on any surface |
| 3 | First write: `requires_confirm: true` with a `diff` naming rows and columns affected, plus `trace.sql` (`SK-TRUST-001`, `SK-TRUST-002`) | reads the diff, re-sends with `confirm: true` | `/v1/ask` cache-miss SLO ([`performance.md` §1](performance.md)) | Safe to run — the committed statement is the previewed one (`SK-TRUST-005`), not a re-plan |
| 4 | The row is in the database; `/app` renders the table the DBA created | reads it back with `ask()` | `/v1/ask` cache-hit SLO | Proof it landed — the trace pane shows the exact SQL that ran |
| 5 | A later write carries a field the schema has never seen. No error: the response's diff names the **added column**, the row is in the same commit (`GLOBAL-041` Phase A; `SK-SCHEMA-008`) | keeps writing the app's own data, unchanged | `/v1/ask` cache-miss SLO — one round trip, no second call | The thing that always cost a migration cost nothing — DDL and `INSERT` committed or rolled back together |
| 6 | `asks_extend_ok` increments; the rate is on the scorecard and `/app` (`SK-SCHEMA-010`) | nothing | — | The claim is measured, not asserted — KPI 1 is a counter, not a demo |
| 7 | Queries written against the old shape still answer; the plan cache re-plans only what the new shape changed (`SK-SCHEMA-005`) | ships | `/v1/ask` cache-hit SLO | Evolution didn't break yesterday's code |

**Not in this flow:** no `CREATE TABLE`, no model file, no migration file, no
schema step of any kind (`GLOBAL-041`); no wizard, plan-picker or
email-verification wall (`SK-ONBOARD-001`); no card
([`GLOBAL-013`](decisions/GLOBAL-013-free-tier-bundle-budget.md)).

**Flow B — the DBA acts** — operator, from an app that has been serving
traffic to an applied index with a measured p95 delta.

| # | Sees | Does | Latency | Feels — because |
|---|------|------|---------|-----------------|
| 1 | `/app/dba`: where the data lives (tables × engine), bottom-line usage and cost, and the proposal list (`GLOBAL-041` Phase B item 6) | opens one page | page-load budget of `apps/web` | Nothing is hidden — the dashboard is the whole state, not a summary |
| 2 | Applied-history: physical, non-destructive changes (index creates) the DBA already applied on its own, each with the p95 of the affected fingerprint 7 days after vs 7 days before (autonomy dial, Phase B item 7) | reads | — | It acted, and showed its work — the delta is measured, not projected |
| 3 | A logical proposal (drop / rename / retype / move-to-engine) with a before/after diff, the expected effect, and the inverse recorded at proposal time (Phase B item 3) | clicks **apply** once | apply budget under `SK-HDC-010` | One decision, not a migration project — the inverse already exists |
| 4 | The applied row, its `schema_hash` bump, its OTel span ([`GLOBAL-014`](decisions/GLOBAL-014-otel-on-external-calls.md)) and its `Idempotency-Key` ([`GLOBAL-005`](decisions/GLOBAL-005-idempotency-key.md)) | nothing | — | A double-click can't double-apply |
| 5 | A change that made things worse is **already undone**, with the measured regression on the row (KPI 3's no-un-undone-regression rule) | nothing | — | Trust survives a bad proposal — the DBA reverts itself |
| 6 | **Undo** on any applied row | clicks once | apply budget | Reversible by construction — undo is the recorded inverse, not a re-derivation |

**Not in this flow:** no advisory tab that only recommends (`GLOBAL-041`
rejected recommend-only); no user-authored migration; no approval queue.

**Flow C — stranger's first answer** — no account, from a landing page to
an answered question.

| # | Sees | Does | Latency | Feels — because |
|---|------|------|---------|-----------------|
| 1 | nlqdb.com with one input and one-click starter goals (`SK-ONBOARD-008`) | types a goal, or clicks a starter | — | No login wall ([`GLOBAL-007`](decisions/GLOBAL-007-no-login-wall.md)) |
| 2 | A database, created anonymously; the chat with the trace pane present and collapsed (`SK-TRUST-002`) | asks a question | landing → first answer within the `GLOBAL-025` TTFV floors | Value before signup — the identity question never came up |
| 3 | On sign-in, the same DB and prompt history, adopted onto the account (`recordAnonAdoption`, `SK-ANON-001`) | signs in when they want the key | `/api/auth/callback/github` SLO | Nothing was re-entered — the anonymous work carried over |

**Not in this flow:** no waitlist, no access gate, no email verification
before the first answer.

## Key screens

- **`/app` chat** — the goal input above the fold; one primary action
  (ask). The trace pane is always present, collapsed by default; write
  answers carry the diff inline. No trace toggle, no tier gate on it
  (`SK-TRUST-002`).
- **`/app/dba`** — proposals and applied history above the fold; one primary
  action per row (apply, or undo). Where data lives and the cost bottom line
  sit alongside. No "advisor" tab that only recommends.
- **`nlq` CLI** — the diff rendered in a TTY, the same payload under
  `--json`; `nlq login` device flow for headless environments.
- **MCP tools** — a `confirm_required` content type carries the diff to the
  host agent; the same verbs as the SDK (`GLOBAL-003` parity).
- **`<nlq-data>` / `<nlq-action>`** — read embeds expose `el.trace`;
  `<nlq-action>` blocks success until the diff is accepted.

## Empty, error, and edge states

Wire copy is one sentence — what happened and the next action
([`GLOBAL-012`](decisions/GLOBAL-012-one-sentence-errors.md)); codes and
copy are canonical in [`error-taxonomy`](features/error-taxonomy/FEATURE.md).

| State | Trigger | The user sees | Can do | Keeps working |
|-------|---------|---------------|--------|---------------|
| Empty | New DB, no rows | The schema nlqdb wrote from the goal, and the input | Write the first row | Reads answer with 0 rows, not an error |
| Unseen field | A write names a table/column that never existed | The diff, with the added column in it — **not** an error | Confirm | Every existing query and cached plan |
| Ambiguous goal | Plan confidence below its floor | `clarify_required` with the candidate readings as options (`SK-TRUST-003`, [`GLOBAL-040`](decisions/GLOBAL-040-guided-turn-not-dead-end.md)) | Pick a reading — one click, no retyping | The session; nothing was executed |
| Stale preview | Confirm arrives after the preview expired | `confirm_expired` | Re-preview (one call) | The un-committed data |
| Rate limited | Per-key `/v1/ask` limit | `rate_limited` with when to retry (`SK-RL-001`) | Retry after the stated window | Reads from cache |
| Provider down | A free-model lane fails | Nothing — the router fails over its round-robin roster ([`GLOBAL-026`](decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)); recoverable failures retry to success ([`GLOBAL-022`](decisions/GLOBAL-022-recoverable-failures-retry-to-success.md)) | Nothing | Everything |
| Bad proposal | An applied change regresses p95 beyond KPI 3's tolerance | The auto-undone row in applied history, with both measurements | Nothing required | The workload, at its pre-apply plan |
| Storage ceiling | Free Neon total across hosted DBs ([`cost-ladder.md`](cost-ladder.md)) | One sentence naming the ceiling and the next action | Delete a DB from `/app` or the SDK | Existing DBs, read and write |

## Done looks like

- [ ] Flows A, B and C work end to end on `nlqdb.com` / `/app` / the
      published `@nlqdb/sdk`, `nlq` and MCP surfaces, inside the
      [`performance.md` §1](performance.md) SLOs.
- [ ] The three `GLOBAL-041` KPIs are live instruments and stand at their
      `GLOBAL-041` floors (first-insert inference, evolution-without-user-action,
      optimizer yield); the `GLOBAL-025` onboarding, UX and performance floors
      hold at the same time.
- [ ] `001-rateme12.md` §6.1 rows R1–R4 are green, and
      `rateme12.nlqdb.com` renders rateme12's journeys with every read and
      write through `@nlqdb/sdk` — zero hand-written DDL, zero copied schema.
- [ ] The post-hoc comparison in that iteration's retro records nlqdb's
      inferred schema as **as good as or better than** the hand-made one
      (`GLOBAL-042` rule 3).
- [ ] Every DBA change — widen, drop, rename, retype, index, engine move —
      is previewed, versioned, undoable, spanned (`GLOBAL-014`) and
      idempotent on apply (`GLOBAL-005`).
- [ ] Every capability above exists on SDK, CLI, MCP and `<nlq-data>`, or
      the gap is tracked in its feature doc
      ([`GLOBAL-003`](decisions/GLOBAL-003-all-surfaces-one-pr.md)).
- [ ] A stranger reaches a first answer with no account, no card and no
      configuration, inside the `GLOBAL-025` TTFV floors.
- [ ] The BIRD/Spider regression alarm is green (`SK-QUAL-002`) — an alarm,
      never a target.

## Non-goals

- **Not an NL→SQL product.** `/v1/ask` is the interface an app whose data
  was never modeled by hand uses to address it; the DBA is the product
  (`GLOBAL-041`).
- **Not a recommend-only advisor.** Every proposal carries an apply and an
  inverse; a dashboard that only suggests is the rejected alternative.
- **No user-authored migrations, ever.** The engine emits every DDL
  statement; there is no migration file, folder or CLI verb to write one.
- **No undo-after-commit on user writes.** The diff-then-confirm gate is
  the user action (`SK-TRUST-001`); undo exists for DBA proposals, whose
  inverse is recorded before they run.
- **No login wall, waitlist or access gate** (`GLOBAL-007`) — and no
  paid dependency on the critical path (`GLOBAL-013`).
- **No pricing or plan work for the DBA product until Phase B ships**; the
  shipped premium tier stays as is (`GLOBAL-041`).
- **The real hand-made schema is never an input during an iteration** —
  post-hoc only, after the retro (`GLOBAL-042` rule 2). Copying would
  measure copying.
