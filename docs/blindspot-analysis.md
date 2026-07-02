# Blindspot analysis — 2026-07-02

A durable record of an adversarial, multi-agent audit of the nlqdb repo and
its agent operating process. Multiple agents were pointed at the docs, the
code, and the `.claude/` process surface with a mandate to find
**unknown-unknowns** — rules the system assumes are enforced but aren't, and
promises the docs make that the code can't keep. This file is the standing
tracker for what that pass found, what got fixed here, and what still needs
a human decision.

## The meta-pattern (the core unknown-unknown)

**The process optimizes for what it measures and can see; every unmeasured
rule silently rots.** The `/daily` loop regenerates `docs/scorecard.md`, so
anything on the scorecard gets attention. Everything *not* on it drifts:

- **All quality gates are honor-system prose.** `.claude/` has no
  `settings.json` and no hooks — nothing mechanically enforces the §8 gates,
  the D4 20 KB cap, the §5 auto-load, or "format+lint before commit." They
  hold only as long as an agent reads and chooses to obey them. Several had
  quietly stopped holding (dead §5 rows, a root `bun run typecheck` that
  errored "script not found", docs over their caps).
- **`/weekly` has never run.** `docs/weekly-review.md` has no git history —
  the weekly direction check that is supposed to set the scorecard's "weekly
  focus number" never existed, while `/daily` has run 127+ times. The
  strategic reset that would catch "we're pointed the wrong way" is the one
  ritual that never fired.
- **Effort followed the visible lever, not the north-star.** ~42% of the
  last 80 commits are `/solve` | `/vs` | `/blog` SEO surfaces (the
  agent-movable daily lever) while the engine north-star sat **dark** —
  eval dispatch has been 403-blocked since run 126 and nobody could move it,
  so the loop kept pushing the number it *could* move. Motion, not progress.

The unifying lesson: **a rule that isn't measured, hooked, or on the
scorecard is not actually part of the system** — it is a hope. Either wire
it in or expect it to decay.

## Fixed in this PR

Documentation / process (this agent):

- **Four dead §5 path-map rows** in `CLAUDE.md` pointed at directories that
  don't exist, so their "mandatory pre-read" auto-load never fired: auth
  (`routes/auth/**` → `apps/api/src/auth/**`), stripe-billing (`billing/**`
  → `apps/api/src/stripe/**`), plan-cache (`plan-cache/**` →
  `apps/api/src/ask/plan-cache.ts`), premium-tier (all-phantom
  `billing/premium/**` · `ask/model-picker.ts` · `llm/src/chains/{paid,premium}.ts`
  → real `byollm-account.ts` · `ask/byollm.ts` · `llm-router.ts`), plus a
  phantom `ask/classifier.ts` removed from the hosted-db-create row.
- **§4 project map completed** — added the real workspaces it omitted:
  `cli-shim`, `email`, `nlqdb-rb`, `nlqdb-rs`, `platform-db`, and the whole
  `tools/*` workspace.
- **Three orphaned FEATURE.md files** (`byo-connect`, `frontier-keys`,
  `multi-engine-adapter`) had no §5 row, so edits to their code bypassed the
  mandatory pre-read. Added rows pointing at their real code paths;
  byo-connect flagged security-sensitive (egress + sealed-secret).
- **Scorecard phantom target** — the "Spider 0.1852 vs 0.75" framing cited a
  0.75 floor that exists nowhere in GLOBAL-025 or the phase plan. Corrected
  to the canonical GLOBAL-025 floors (Spider free ≥0.15, which 0.1852 already
  clears; frontier ≥0.25). The real below-floor engine number is **BIRD
  0.520 vs its ≥0.60 Phase 2 floor**.
- **Scorecard E-03 relabel** — "E-03…E-07 (RLS, …)" read as "no RLS shipped,"
  but per-tenant `tenant_isolation` RLS is live for provisioned DBs; the
  unshipped item is specifically **per-agent** `app.agent_id` RLS. Relabeled.
- **Dependabot → Renovate** — `phase-plan.md` §8 cited "Dependabot monthly";
  the repo uses `renovate.json5` (no `dependabot.yml`). Fixed.
- **guidelines.md wrong-tenant overstatement** — "Enforced at the connection
  pool, not app code. No branch to take." was absolute, but BYO Postgres runs
  user SQL with no `search_path`/RLS. Softened to: provisioned DBs get
  per-tenant RLS; the BYO path runs against the user's own single-tenant DB
  (bounded — no shared surface to cross).
- **Root `package.json` scripts** — added `typecheck`, `test`, `build` that
  fan out across workspaces (`bun run --filter '*' <script>`). Before this,
  the single most-repeated instruction in the whole process — `bun run
  typecheck && bun run lint && bun run test` at root (CLAUDE.md §7/§8,
  `/daily`) — errored "script not found." Verified: `bun run typecheck` now
  invokes all 22 per-package typechecks; `test` dispatches identically.

Backend security (sibling agent, same pass) — all **live-verified** against
the app's own Neon HTTPS SQL API, full `apps/api` suite green (864 passed):

- **CRIT cross-tenant isolation — breach reproduced live, fix verified
  closed.** Hosted queries ran as the shared `neondb_owner`, which *owns the
  tenant tables and so bypassed RLS entirely* (no `FORCE`) — isolation rested
  on nothing but schema-qualification, and a `set_config` CTE or
  `pg_policies` read defeated even that. Fix runs every user query under
  `SET LOCAL ROLE tenant_<hash>` (least privilege; cross-schema reads now
  fail closed, spoofed `app.tenant_id` returns 0 rows), plus `set_config` /
  `current_setting` / `set` added to the validator denylist as
  defense-in-depth. **⚠ Deploy caveat:** breaking on the ~151 existing prod
  DBs until a one-time role backfill (`GRANT tenant_<h> TO neondb_owner WITH
  SET TRUE` + table/sequence privileges) runs — must land before/with the
  deploy. New DBs are covered by the provisioner fix.
- **Write-CTE bypasses closed** — `WITH x AS (INSERT/UPDATE/DELETE …) SELECT`
  now counts as a write for both the read-only gate *and* the SK-TRUST-001
  confirm/preview gate; `/v1/run` forces anon principals read-only;
  `UPDATE`-without-`WHERE` rejected (symmetric with the existing `DELETE`
  guard); 10s `statement_timeout` on hosted/BYO/memory exec paths.
- **Idempotency-Key** added to `POST /v1/keys` and `POST /v1/databases`
  (GLOBAL-005), reusing the `/v1/db/connect` KV-dedupe pattern.
- **Fail-closed guards** — Turnstile now fails closed in prod when
  unconfigured (open only in dev); the Stripe `MOCK_STRIPE` signature bypass
  is hard-guarded off in prod; `adoptApiKeys` re-keys only `pk_live` rows.

CI / tests (sibling agent): **`events` added to the CI matrix** (11 tests
that never ran in CI now do); **19 SDK tests** added to the single sanctioned
HTTP client (was 1) — stream assembly, idempotency-key generation, error
envelope, no-body-leak. **Correction to the original audit:** `auth-internal`
and `platform-db` are docs-only *placeholders* (no `src/`, no `package.json`,
marked "not yet implemented"), not untested code — the real auth logic lives
in `apps/api/src/auth.ts`, which is covered. They were correctly **not** wired
into CI (would fail on a missing `package.json`); they become CI gaps only
once implemented.

## Deferred — needs design (track as GH issues)

These are promises or risks the audit surfaced that require a **founder
decision or a design**, not a doc edit. None is safe to silently implement.

- **Real user-DB backups + a restore drill.** Pricing sells 7-/30-day
  backups that do not exist; only `.envrc` is backed up. Need a backup
  target, retention, and a tested restore — before the claim is load-bearing
  for a paying customer.
- **Incident-response / breach playbook.** None exists. Stripe live-mode is
  near and GDPR's 72-hour breach-notification clock would already apply.
- **GLOBAL-031 KEK rotation procedure.** Undesigned as it goes live —
  key-encryption-key rotation for the sealed secret envelope has no runbook.
- **Hard LLM-spend ceiling + atomic anon rate limits.** Current KV counters
  are non-atomic and fail **open** — under contention or KV lag they
  under-count, so both spend and anon abuse can exceed their intended caps.
- **GDPR erasure / export path.** The privacy policy being generated will
  promise data-subject rights (erasure, export) the system currently can't
  honor end-to-end.
- **`/privacy` + `/terms`** are still pre-beta drafts — must be real before
  live-mode billing and public signup.
- **SDK silent-refresh (GLOBAL-009 / SK-SDK-005) is documented but not built.**
  The SDK feature doc points at a `packages/sdk/src/fetch.ts` refresh path that
  does not exist; a 401 surfaces straight through instead of a silent
  `POST /v1/auth/refresh` + retry. A `// TODO(bug):` test documents the current
  behavior. Fixing it needs the `/v1/auth/refresh` contract — a behavior change,
  not a test.
- **Duplicate migration ordinal `0012`.** `0012_anon_adoption_db_id.sql` and
  `0012_api_keys_sk_columns.sql` share a prefix; D1 applies in filename order,
  so a tie risks divergent apply order across envs. Both are near-certainly
  already applied to prod (repo is at 0020), so renaming is unsafe — instead
  add a CI check that fails on duplicate ordinal prefixes and use zero-padded
  unique ordinals going forward.

## How to prompt agents better

The pass also showed *why* agents miss things — the prompts don't hand them
the context that would let them not miss. Five concrete changes:

1. **Give real, working commands.** An agent told to run `bun run
   typecheck && bun run lint && bun run test` and hitting "script not found"
   wastes a turn or, worse, skips the gate. Commands in the guide must
   actually run (this PR fixes the root scripts; keep them true).
2. **Hand agents the human-blocked / dead-end list up front.** The engine
   eval has been 403-blocked since run 126; an agent that discovers this
   itself burns a session. Surface `blocked-by-human.md` at task start so
   agents don't re-attempt known dead ends.
3. **Name specific SK-/GLOBAL-IDs, not whole features.** "Read the ask
   feature" implies ~74 KB of pre-read for a one-line change. Point at the
   exact `SK-*`/`GLOBAL-*` the edit touches so the agent reads what's
   load-bearing, not everything.
4. **Tell agents what recent runs already tried.** The scorecard is
   *overwritten* each `/daily` with no changelog, so an agent can't see that
   last week already tried the lever it's about to pull. Keep a short
   "recently tried / didn't move" list.
5. **State the decision direction when it's genuinely the founder's call.**
   Agents stall or guess on founder-level choices (pricing, GDPR posture).
   Say "this is yours to decide; here are the options" so the agent files it
   as an open question instead of inventing an answer.

**Recommendation:** revive `/weekly` with teeth — an enforced, scheduled
direction check that sets the scorecard's weekly focus and audits gate
compliance — or run a periodic adversarial blindspot pass like this one.
The unmeasured rots; schedule the thing that looks at the unmeasured.
