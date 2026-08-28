# EK track — the expert-knowledge marketplace ("Become AI")

Execution track for
[`docs/features/expert-knowledge-platform/FEATURE.md`](../FEATURE.md).
Runs **in parallel** with the dogfood gate per `SK-EKP-005` — neither blocks
the other; a slice here never waits on gate progress and never adds to it.
Driven by its own recurring loop,
[`/ek`](../../../../.claude/commands/ek.md) (founder-approved 2026-08-06),
mirroring `/reach` — because `/daily`'s worst-number lever selection has no
EK number to pick and would otherwise starve the track (measured: 3 daily
runs post-lock, 0 EK slices).
Sized and sequenced like the engine/dogfood tracks: one slice per run where
possible, concrete `Done when` boxes, prereqs stated.

Governing decisions (bodies in [`../FEATURE.md`](../FEATURE.md) and
[`SK-PIVOT-023`](../../agent-memory-pivot/decisions/SK-PIVOT-023-two-axis-business-model.md)
— never restated here): `SK-EKP-001` (trust claim + sovereign-hosting
roadmap) · `SK-EKP-002` (fee shape) · `SK-EKP-003` (hybrid repo split) ·
`SK-EKP-004` (pilot = language tutor) · `SK-EKP-005` (parallel tracks) ·
`SK-PIVOT-023` (two-axis business model).

## The repo boundary (SK-EKP-003, applied to slices)

**Public in nlqdb (this repo):** the shared pack runner and its journey
contract (`SK-PIVOT-021`, built as D-08), pack recipes + golden queries,
`agent_memory_v1` and every engine capability (incl. the EK-06 grant
primitive), marketing/trust surfaces, ToS/DPA text.

**Private in `experts`:** the interview question-engine, marketplace UX
(listings, buy flow), fee/payout wiring. It consumes nlqdb only through the
public SDK/API. **How the private surface reuses the public runner**
(published package vs hosted journey embed) is an explicit EK-01/EK-05
design output — do not fake-decide it here.

Direct agent push to `experts` is **confirmed working 2026-08-10** (workspace
access landed; this run pushed a branch and PR #1 merged there earlier), so
private-half slices are no longer parked-on-access — they proceed on their own
prereqs (EK-05 boxes 1–3 still gate on EK-04's write-path and EK-06's live
grant execution).

## Sequence

| EK | Slice | Repo | Risk | Runs | Prereqs |
|----|-------|------|------|------|---------|
| [EK-01](EK-01-interview-extraction-design.md) | Interview-extraction research → design record (question generation, answer→row mapping, verification UX, session shape) | nlqdb (design detail → `experts`) | med | 1–2 | — |
| [EK-02](EK-02-grant-primitive-design.md) | Cross-tenant read-grant primitive: research → design record + minted decision | nlqdb | med | 1–2 | — |
| [EK-03](EK-03-trust-surface.md) | Trust surface: public landing + "not allowed" copy on the true floor + ToS/DPA delta (founder reviews legal text) | nlqdb | low | 1–2 | — |
| [EK-04](EK-04-pilot-authoring-rails.md) | Pilot authoring rails: language-tutor expert pack (recipe + golden queries) as runner instance #2's public half | nlqdb | high | multi | EK-01 · D-08 runner exists |
| [EK-05](EK-05-marketplace-surface.md) | Marketplace surface v0: interview product + listings + buy flow + fee wiring (% left symbolic until founder sets it) | **`experts`** | high | multi | EK-01, EK-02, EK-04 · agent access to `experts` |
| [EK-06](EK-06-grant-primitive-impl.md) | Grant primitive implementation: revocable, fail-closed, metered cross-tenant read | nlqdb | high | multi | EK-02 |
| [EK-07](EK-07-sovereign-hosting.md) | Sovereign hosting, 1-click (SK-EKP-001 roadmap): research + design, then build | nlqdb | high | multi | after EK-03; must not delay EK-04–06 |
| [EK-08](EK-08-launch-motion.md) | The marketplace's own launch motion + acceptance criteria (SK-EKP-005: distinct from Show HN) | both | med | 1–2 | EK-04, EK-05 scoped; founder input on motion |
| [EK-09](EK-09-trust-hardening.md) | Trust hardening (**F1-B, founder-chosen 2026-08-07**): knowledge/granted asks skip narration by default + no-training interview provider pin — gates the stronger EK-03 trust copy | nlqdb + `experts` | low–med | 1–2 | narration skip: none · granted half: EK-06 · provider pin: EK-05 |

**Why this order.** EK-01/EK-02 are the two research passes the FEATURE.md's
open questions mandate (`P2`) — everything downstream inherits their design
records, and both are pullable today. EK-03 is independent and cheap: the
trust pillar is "said everywhere," and its copy is already fully constrained
by `SK-EKP-001`, so it needs no upstream design — only founder review of the
legal text. EK-04 before EK-05 because the public rails (pack recipe, write
path, verification) are testable without the private surface, and D-08's
N+1 test says a second pack must reuse the runner without rebuilding
auth/progress/proof/cleanup — the expert pack is that N+1. EK-06 can start
any time after EK-02 but only **earns revenue** once EK-05 exists to sell
grants. EK-07 is a locked roadmap item, deliberately after the marketplace
has a first expert to serve. EK-08 last-scoped but not last-shipped: launch
criteria are written once EK-04/05 shapes are real, and the launch itself is
condition-gated (the repo's idiom — never date-gated).

## Hard rules

- **No marketplace product code in nlqdb** (`SK-EKP-003`). A reviewer
  rejects fee logic, listing UX, or interview-product code landing here;
  the public SDK/API is the only interface `experts` may consume.
- **No fee percentage anywhere** until the founder sets it (`SK-EKP-002`).
  Build with a symbolic/config value; no number in code, docs, or copy.
- **Trust copy never exceeds substance** (`SK-EKP-001`): "not allowed"
  posture; no "can't read" claim; sovereign hosting is a roadmap statement
  until shipped.
- **No regulated professions** (doctor/lawyer/accountant) in any public
  pack until the liability research pass exists (FEATURE.md open question).
- **No new schema, endpoint, or tool per pack** (`SK-PIVOT-007`/`018`) —
  the expert pack is content + recipe on `agent_memory_v1`; the grant
  primitive (EK-06) is generic engine surface added once, not per-pack.
- **The dogfood gate is untouchable from here** (`SK-EKP-005`): no EK slice
  adds a gate criterion, waits on one, or edits `SK-PIVOT-016`.
- **`GLOBAL-037` (as amended 2026-08-07) stands**: LLM egress is three
  enumerated lanes — planning is schema-only; narration is disclosed with
  an opt-out and **skips by default on knowledge/granted paths once EK-09
  ships**; the interview/extraction path is the founder-approved authoring
  carve-out (`INV-EKP-037` in `SK-EKP-007`: own tenant, authoring only,
  no-training provider per F1-B). No slice adds a lane or widens one —
  that is a founder amendment, never a diff.
- **Secrets rule** (`SK-PIVOT-018`): packs store credential metadata, never
  values; interviews must reject secret-shaped answers.

## Tracker

Tick on merge. Durable status (scorecard rows are regenerated; this is not).

- [x] EK-01 — interview-extraction design record
- [x] EK-02 — grant-primitive design record + decision (SK-EKP-008, #919; hardened 2026-08-07 after Fable review)
- [ ] EK-03 — trust surface (landing + copy + ToS/DPA delta)
- [ ] EK-04 — pilot authoring rails (language-tutor expert pack, public half)
  (box 1 golden-query corpus shipped 2026-08-08; interview-source `PackAdapter`
  — instance #2, N+1 box — landed 2026-08-11 with zero runner edits;
  `INV-EKP-037` egress guard shipped 2026-08-12 — box 5; live end-to-end import
  remains, gated on the `experts` interview endpoint)
- [ ] EK-05 — marketplace surface v0 (`experts`) — unparked 2026-08-10 (direct agent push confirmed); box 4 boundary guard landed (experts#2, merged; CI to run it in experts#3, open), boxes 1–3 gated on EK-04/EK-06
- [x] EK-06 — grant primitive implementation (complete 2026-08-28)
  (control plane + all box-2 pure builders shipped; live-PG RLS-bypass kill-test
  shipped 2026-08-23 — `grant-scoping.integration.test.ts` proves owner-rows-only,
  cross-tenant reach denied direct + via JOIN, SELECT-only, FORCE RLS;
  granted-read RESOLVE leg shipped 2026-08-24 — `grant-resolve.ts`
  `resolveGrantedRead` fail-closes to `no_grant`/`owner_db_missing`/`not_grantable`
  and resolves the owner DB from the trusted grant row, hosted-only;
  granted-read EXECUTOR shipped 2026-08-25 — `grant-orchestrate.ts`
  `executeGrantedRead` composes resolve → plan → run → meter → rows-only, pure
  over injected I/O, full reject/meter matrix unit-tested; production I/O wiring
  shipped 2026-08-26 — `grant-ask-io.ts` `buildGrantedReadIo` (node-safe
  composition: active grant behind the ≤30 s status cache, `resolveDb`,
  `recordGrantUsage`, uuid default; unit-tested over a fake D1) +
  `grant-ask-wire.ts` `runGrantExecSteps`/`grantedReadIo(d1)` (Neon runner over
  the pre-built grant exec batch, `db.query`-spanned, fail-closed on a missing
  connection ref); schema-only planning half shipped 2026-08-26 —
  `grant-ask.ts` `orchestrateGrantedAsk` (resolve owner schema → plan the goal
  against the OWNER schema, schema-only, never owner cell values → normalise
  schema-relative → `executeGrantedRead`; pure over injected I/O, full
  reject/schema-only/rows-only matrix unit-tested driving the real executor);
  the buyer `/v1/ask` route branch shipped 2026-08-26..27 — `route-granted-ask.ts`
  `tryGrantedRead`/`renderGrantedAsk` wired on the handler's `db_not_found` branch
  (rows-only 200, `no_grant`→`db_not_found` fail-closed, typed 403/404/409),
  ticking box 2; box-4 live in-flight revocation measurement shipped 2026-08-27 —
  `grant-revocation.integration.test.ts` proves against a live Neon branch that
  the wired granted batch sets `statement_timeout` to the ≤30 s ceiling and that
  Postgres cancels a granted read that outlives it (57014); box-3 route-level live
  usage-emission assertion shipped 2026-08-28 — `grant-usage-route.test.ts` drives
  the real `tryGrantedRead` through the production `buildGrantedReadIo(env.DB)` over
  real Miniflare D1 (migration 0028; only the Neon owner-read injected), proving a
  successful granted read renders rows-only 200 AND emits exactly one attributed
  usage row, a same-key retry re-serves the rows AND records no second event, and a
  scope reject renders 403 AND bills nothing — every EK-06 box now ticked)
- [ ] EK-07 — sovereign hosting 1-click (roadmap)
- [ ] EK-08 — launch motion + acceptance criteria
  (box 1 shipped 2026-08-26 — the six-criterion first-paying-expert launch
  gate, each criterion owned by its proving slice, agent-tightenable /
  founder-loosenable, kept off `SK-PIVOT-016`; boxes 2–3 — motion pick +
  launch bullet — remain)
- [ ] EK-09 — trust hardening (F1-B): narration skip + no-training provider pin
  (box 1 shipped 2026-08-09 — knowledge-DB narration skip by default; box 2 shipped
  2026-08-28 — granted-path asks skip narration by construction now EK-06's granted
  read landed, `route-granted-ask.test.ts` guards it rows-only + size-independent;
  box 3 egress-test extension + provider pin await EK-05)
