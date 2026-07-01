# Worksheet — founder directives 2026-07-01 (de-gate, de-waitlist, pre-beta)

**For a cold agent.** Read `CLAUDE.md` fully first (P1–P5, §5 path map, §8
gates). This worksheet records founder decisions made 2026-07-01 that
supersede parts of the documented canon — that supersession is intentional
and founder-authorized, so P1 is satisfied by this file; update each
decision's canonical home as you go (P3). Work top-down; one PR per item
(or per coherent group). Delete each item's section when merged; delete the
file when empty.

Founder directives being implemented:

1. There is **no access gate** and **no waitlist**. The product is open.
   "Pre-alpha" rebrands to **pre-beta** everywhere.
2. The onboarding KPI "first-query success ≥ 70%" is replaced by
   **"first-10-queries success ≥ 95%"**.
3. The agent-memory pivot (GLOBAL-036) is **one-directional** — remove its
   revert framing.
4. Publishing is autonomous — drafts release to a `/blog` surface; no
   founder review dependency (already encoded in `/daily` step 3).
5. Design partners must not require founder intervention — a plan is
   needed.

---

## W1 — Resolve GLOBAL-027 (gate) canonically

The gate code is already deleted (verified 2026-07-01: no `gatePreAlpha`,
`feature_gated`, `FeatureGatedView`, `apps/api/src/gate/`, or
`flow-004-walk.sh` anywhere in the tree), but GLOBAL-027 is cited by docs
while having **no file under `docs/decisions/` and no row in
`docs/decisions.md`** (index jumps 026 → 028).

- Create `docs/decisions/GLOBAL-027-pre-alpha-gate.md` as a short
  **superseded** record (5-field block, ≤ 15 lines): the gate existed
  (BIRD/Spider-thresholded 403 on anonymous `/v1/ask` + waitlist invite
  valve), was removed, and per founder 2026-07-01 **no access gate may be
  reintroduced**; product is open pre-beta.
- Add the index row to `docs/decisions.md` with status `superseded`.
- Sweep living docs that still describe the gate as current (scorecard,
  FEATURE.md files, `docs/architecture.md`, `docs/phase-plan.md`,
  `docs/research/fable-recommendation.md`). Append-only trackers
  (GLOBAL-028/029 exempt files) keep their historical rows — do not
  rewrite history there.
- **Accept:** `grep -rn 'GLOBAL-027' docs/ .claude/` → every hit is either
  the superseded record, its index row, or an append-only-tracker history
  row; nothing describes the gate as live.

## W2 — Remove the waitlist end-to-end

Still live in code (verified 2026-07-01):

- `apps/api/src/waitlist.ts` + `apps/api/test/waitlist.test.ts` +
  `POST /v1/waitlist` in `apps/api/src/index.ts` (~line 1510) +
  `apps/api/vitest.config.ts` reference.
- D1: migrations `0007_waitlist.sql`, `0015_waitlist_persona.sql` — add a
  new migration dropping the table (prod data: 81 rows, 80 synthetic +
  1 founder — nothing worth keeping; note the drop in `docs/runbook.md` if
  it documents D1 tables).
- `packages/events/src/{index,types}.ts` waitlist event types +
  `apps/events-worker/src/sinks/logsnag.ts` (+ its test) handling.
- `apps/web/src/lib/email.ts` and any residual web references.
- Docs: scorecard funnel rows (#2 waitlist, invite-valve mentions),
  `docs/features/**` (anonymous-mode, web-app, rate-limit, onboarding),
  architecture/phase-plan prose. Same append-only-tracker exemption as W1.
- **Accept:** `grep -rni 'waitlist' apps/ packages/ cli/ scripts/ docs/
  --include='*.ts' --include='*.tsx' --include='*.astro' --include='*.sql'
  --include='*.md'` → only migration history (0007/0015 stay as applied
  history), the new drop migration, and append-only-tracker rows. §8 gates
  green.

## W3 — Rebrand pre-alpha → pre-beta

Living copy still saying "pre-alpha" (verified): `apps/web/src/`
`components/Footer.astro`, `layouts/Legal.astro`, `data/competitors.ts`,
`pages/{index,manifesto,privacy,terms}.astro`, `pages/llms.txt.ts`;
`apps/coming-soon/{index,privacy,terms}.html`;
`apps/events-worker/src/sinks/logsnag.ts`; plus doc prose
(`docs/blocked-by-human.md`, non-tracker docs).

- Replace with "pre-beta" (match surrounding casing). Where the copy also
  references the gate/waitlist ("no invite needed" etc.), simplify per W1/W2.
- **Accept:** `grep -rni 'pre-alpha\|prealpha' apps/ packages/ docs/ cli/`
  → append-only-tracker history rows only.

## W4 — KPI: first-10-queries success ≥ 95%

- `docs/decisions/GLOBAL-025-north-star.md` onboarding KPI table: replace
  the "First-query success rate … ≥ 70% / ≥ 85%" row with **"First-10-queries
  success rate (per new user/DB, share of their first 10 `/v1/ask` calls
  answered successfully) — floor ≥ 95% (both phases)"**. Update the prose
  mention in the pillar-2 bullet and any copies
  (`grep -rn 'first-query success' docs/`).
- `docs/features/onboarding/FEATURE.md`: update its KPI reference; add an
  SK block only if the instrument decision is non-obvious (P4/D5).
- Instrument: define the measurement from the existing events pipeline
  (`packages/events`) or `/v1/ask` outcome data — success = 2xx with a
  non-refused answer, per-principal ordinal ≤ 10. If the instrument needs
  new code, ship the smallest event/query that yields the number and add
  the scorecard row.
- **Accept:** scorecard shows the new row with a real (or explicitly
  `unmeasured — instrument shipped, awaiting data`) value; no doc still
  says "first-query success ≥ 70%".

## W5 — GLOBAL-036: pivot is one-directional

- Edit `docs/decisions/GLOBAL-036-lead-positioning-analytical-agent-memory.md`:
  remove the revert framing ("reverts in a single `git revert`", "if the
  funnel doesn't follow", the additive-so-revertible rationale sentences).
  State plainly: founder-resolved 2026-07-01, the reposition is permanent;
  forward iteration only.
- Sweep `docs/features/agent-memory-pivot/FEATURE.md` + worksheets for the
  same revert language.
- **Accept:** `grep -rni 'revert' docs/decisions/GLOBAL-036* docs/features/agent-memory-pivot/`
  → no hit describing reverting the pivot.

## W6 — `/blog` surface (publishing without a human)

`/daily` step 3 now publishes queue drafts to `nlqdb.com/blog`; the surface
doesn't exist yet.

- Build it in `apps/web` following the `solve.ts`/`competitors.ts` data-file
  pattern where sensible: a `blog.ts`-style source (or content collection),
  list page + per-post pages, JSON-LD, listed in `llms.txt` (which
  auto-aggregates `/vs` + `/solve` today — extend to `/blog`).
- Per §10.1: new feature home `docs/features/blog/FEATURE.md` (prefix
  `SK-BLOG-NNN`) + §5 path-map row, or fold into `web-app` if genuinely
  small — your call under D5.
- Publish the current queue backlog (newest-first file + archive) as the
  first posts; each published entry is deleted from the queue and its live
  URL recorded in the scorecard's "Shipped distribution".
- Demand-signal on CTAs per GLOBAL-024; analytics per GLOBAL-034.
- **Accept:** ≥ 1 post live end-to-end (build passes, page renders, llms.txt
  lists it), queue entries for published posts removed, scorecard updated.

## W7 — Design-partner motion without founder intervention

`docs/founder-playbook.md` assumes founder-led recruitment and interviews.
The founder wants a motion that runs without them.

- Write `docs/research/design-partners-autonomous.md` (≤ 10 KB): how agents
  recruit, interview, and learn from design partners with zero founder
  involvement. Ground it in what exists: the events pipeline (GLOBAL-024
  demand signals), registered-user emails (transactional, consent-based),
  the `/blog` + `/vs`/`/solve` surfaces, MCP distribution. Candidate
  mechanics — decide per GLOBAL-033, don't leave open: in-product
  Sean-Ellis survey after the Nth successful query (replaces the manual
  founder-playbook cadence); automated post-signup check-in email with a
  reply-to that an agent triages; a public build-log page; feedback
  widget → demand-signal events. Hard constraints: no impersonating a
  human, no unsolicited outreach to people who never touched the product,
  $0.
- Ship the smallest first slice in the same PR if it's daily-run-sized
  (e.g. the in-product survey event); otherwise the plan names the first
  slice for `/daily` to pick up.
- Update `docs/founder-playbook.md` to point at the autonomous plan for
  everything it no longer owns (net-shrink it per D4/D5).
- **Accept:** the plan exists with every mechanic decided (no open
  questions parked), and `founder-playbook.md` no longer describes
  founder-led recruitment as the operating path.

## W8 — Scorecard + loop-source cleanup

- Regenerate `docs/scorecard.md` to the post-directive shape: funnel rows
  = visits / registered real users / DBs with first answer /
  first-10-queries success / session retention; distribution rows = surface
  count **and yield** (referrals, published posts); drop waitlist +
  invite-valve rows; keep engine/ops/E2E rows.
- `docs/research/fable-recommendation.md` §9: the weekly block still
  describes a founder session that approves the queue and sets the focus
  number. Update it to match reality: `/weekly` (`.claude/commands/weekly.md`)
  is the runnable weekly form; publishing is autonomous (daily step 3);
  the founder may override the focus number but nothing waits on them.
- `docs/blocked-by-human.md`: remove any bullet the directives dissolved;
  what remains must be genuinely human-only.
- **Accept:** `grep -rn 'invite-valve\|invite valve\|GATE_OPEN' docs/
  .claude/` → append-only-tracker history only; scorecard reflects the new
  rows; §8 gates green.
