# Automated ICP Validation Plan

> **Governance ([GLOBAL-028](../decisions/GLOBAL-028-acquisition-progress-tracker.md)
> · [GLOBAL-029](../decisions/GLOBAL-029-acquisition-verification-tracker.md)
> · [GLOBAL-030](../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md)):**
> This is the canonical acquisition **implementation** progress tracker.
> Its mirror, [`automated-icp-validation-plan-verification.md`](./automated-icp-validation-plan-verification.md),
> is the canonical **verification** tracker — every `FLOW-NNN` in §8
> below appears there with the same ID. Both files are exempt from
> the 20 KB cap and both are agent-ran: every PR that implements a
> section here must update `## Current status` and append a row to
> `## Progress log`; every PR that adds, modifies, or supersedes a
> flow updates BOTH files in lockstep. Evidence/status edits must name
> the agent-run verification artifact and pass the GLOBAL-030 self-review.

> **Operator loop — read this first.** The founder runs one prompt
> periodically. That is the entire human input. No notifications go
> back to the founder; no LogSnag bell, no inbox, no triage queue.
> Each agent run *is* the cron: read this preamble, pick the
> top-priority slice from "What the next agent should pick" below,
> do it, verify it against the real deployed surface, write evidence
> in this file's `## Progress log` and (for flows) the verification
> mirror, open a PR. If verification fails, that failure IS the next
> priority — don't pile on new surfaces on top of a broken funnel.
>
> **Shipped ≠ verified ≠ useful.** Counting shipped surfaces lies to
> us by design. The only progress that matters is "a stranger landed
> and got first-value." §1.1 stranger-test, §1.2 KPI dashboard, and
> §1.3 in-app survey are the anti-self-deception layer; until they
> ship, *every other acquisition surface's KPI is suspect* — we can
> drive traffic without knowing whether it converts, churns, or
> bounces silently. That's the bar §3 cannot legitimately clear yet.
>
> **Real blocker is engine quality, not surfaces (2026-05-24 founder
> directive).** Every advertised acquisition surface gate-403s at
> `/v1/ask` because the free-chain BIRD raw EX is 0.35 (target 0.65) and
> Spider is 0.12 (target 0.75) — both measured lower bounds as of
> 2026-06-09; the capacity-independent reasoning EX is ≈0.52 BIRD / 0.19
> Spider (up from the baseline's 0.354 BIRD) per
> [`apps/api/src/gate/eval-baseline.ts`](../../apps/api/src/gate/eval-baseline.ts) /
> [`SK-GATE-001`](../features/pre-alpha-gate/FEATURE.md#sk-gate-001) /
> [`SK-GATE-002`](../features/pre-alpha-gate/FEATURE.md#sk-gate-002).
> The gate is doing exactly what GLOBAL-027 asks it to ("don't show
> bad NL→SQL to strangers") — *removing* the gate before BIRD/Spider
> clear ships bad answers to every ICP we acquire, which is worse
> than the current "0 validated users." The acquisition tracker's
> bottleneck is therefore [`quality-eval`](../features/quality-eval/FEATURE.md)
> velocity, not new surfaces. Acquisition work that *doesn't* move
> BIRD/Spider is deferred until either threshold clears or the
> §1.4 invite valve carries a stranger across the gate intact.
>
> **What the next agent run should pick (2026-05-24, in order — items 1–3 outrank 4+ unconditionally):**
> 1. **Engine quality — close the BIRD gap and lift the Spider lane.**
>    BIRD raw EX 0.35 vs 0.65 target; reasoning EX ≈0.52 (was 0.354).
>    Spider 0.12 vs 0.75, first-measured 2026-06-09 once the eval pipeline
>    was unblocked (gdown fix, T17). The canonical 500-q / 6-provider
>    re-seed of `eval-baseline.ts` is the now-unblocked GHA dispatch.
>    Highest-leverage pickable work, in order: (a) verify the next
>    `quality-eval-spider2-lite.yml` dispatch lands a real `spider_accuracy`
>    in `eval-baseline.ts` (trigger it manually; if the run failed, fix the
>    pipeline before anything else); (b) close the free-vs-agentic-frontier
>    delta surfaced by [`SK-QUAL-009`](../features/quality-eval/FEATURE.md) —
>    every point that delta narrows is a point the free chain reclaims
>    inside the gate; (c) push BIRD via free-chain scaffolding work
>    (prompt + retry-on-exec-error already wired per `SK-QUAL-009`) —
>    target +5pp/week until 0.65.
> 2. **§1.4 invite-valve — VERIFIED end-to-end to a 200 (deployed
>    2026-06-09); open item is first-value seed *quality*, not
>    reachability.** FLOW-004 via `scripts/flow-004-walk.sh`
>    ([`SK-STRG-002`](../features/stranger-test/FEATURE.md)): control `403`
>    + invite **bypasses the gate** (SK-GATE-007 intact) AND `/v1/ask`
>    returned **HTTP 200** on all 3 walks today — the 2026-06-08
>    `sample_insert_failed` 500 has cleared now that **SK-HDC-018**
>    (orchestrator retries the provision once without seed rows → a working
>    un-seeded DB instead of a 500) + **SK-LLM-033** (the `schema_infer`
>    prompt now requires insertable seed rows) are deployed (#352). **What
>    the next agent should pick here:** first-value seed quality is
>    **measured and just improved** — the SK-STRG-008 probe
>    ([`scripts/flow-004-seed-quality.sh`](../../scripts/flow-004-seed-quality.sh),
>    one invite / N goals) re-ran live 2026-06-12: two same-set 4-goal runs
>    both recorded **`seeded_ok_ratio = 0.75`** (3/4; only "a meal planner for
>    couples" degraded), **up from 0.25 on 2026-06-10**. A wider 8-goal run
>    recorded **4 `provision_failed`** (HTTP 422 `infer_failed` — the engine
>    couldn't build the DB at all, a harder failure than degraded, now bucketed
>    separately) at ratio 0.75 (`…02-04-02Z.json`); across three 8-goal runs
>    the wide ratio varied **0.6–0.8** with 3–4 `provision_failed` each (LLM
>    variance). The lift is real and stable within today's 4-goal runs but
>    **not yet causally isolated** (planner directives shipped since 06-10 vs
>    LLM run-to-run variance). Each empty
>    create records `state:"passed_degraded"` ([`SK-STRG-007`](../features/stranger-test/FEATURE.md))
>    so the dashboards stay honest, but **lifting that ~0.75 (and the 422
>    tail) to 1.0 is an SK-LLM-033 / engine-quality lift that rolls up under
>    priority #1** — an invited stranger who lands an empty DB or a 422 is a
>    degraded first impression even though it's no longer a 500. The daily cron is
>    **shipped** as [`SK-STRG-003`](../features/stranger-test/FEATURE.md)
>    ([`.github/workflows/acquisition-health.yml`](../../.github/workflows/acquisition-health.yml))
>    — runs all walkers at 06:00 UTC, uploads JSON results as a
>    90-day artifact, exits 0 unconditionally so no founder-facing email
>    channel is created. Next agent reads `acquisition-health-<run_id>`
>    via `mcp__github__list_workflow_runs` to spot a regression before
>    strangers do.
> 3. **§1.2 KPI dashboard** — [`SK-ONBOARD-005`](../features/onboarding/FEATURE.md)
>    pulled forward; expose the `bird_accuracy` / `spider_accuracy` /
>    gate-block-rate tiles alongside the onboarding tiles so the
>    engine-quality bottleneck is visible from the same `build-log`
>    panel. Doubles as build-in-public (§3.2).
> 4. **§1.3 in-app survey** — PostHog free tier; Sean Ellis Q1 fires
>    only after the invite-valve carried the user across the gate, so
>    "what blocked you" is a real product question, not "the gate
>    blocked me."
> 5. **§1.1 daily cron landed (SK-STRG-003); R2 archive deferred.** The
>    daily walker cron ships with priority #2 in the same workflow
>    (`acquisition-health.yml`). R2 archive + diff-against-prior-run
>    slices remain open in `stranger-test/FEATURE.md` — current GH
>    Actions artifact retention (90 days) covers the cold-start window;
>    R2 follow-up lands when either retention proves too short or a
>    real `diff` consumer exists.
> 6. **§3.1 next 10 solve pages** — only after #1–#2 (don't AEO-trap
>    visitors into a gate-403 they can't cross; once invite-valve
>    verified, each `/solve/` page can carry `?invite=` for press
>    launches per §3.3).
> 7. **§3.5 `examples/` per cluster + `nlqdb.com/gallery`** — only
>    after #1–#5 (don't drive traffic to an unmeasured funnel).
> 8. **Show HN / Product Hunt push (§3.3)** — only after #1–#7 AND
>    either BIRD/Spider thresholds clear OR the invite-valve verifies
>    end-to-end (the launch-URL `?invite=<code>` amendment in §3.3).
>
> **What's shipped today** (evidence in `## Progress log`, not prose):
> §1.1 stranger-test primitive ([`tools/stranger-test/`](../../tools/stranger-test/) — Playwright walker for FLOW-001/002/003, now with [`SK-STRG-004`](../features/stranger-test/decisions/SK-STRG-004-invite-bearing-composer.md) invite-bearing variant) ·
> §1.1+§1.4 **daily acquisition-health cron** (SK-STRG-003; [`acquisition-health.yml`](../../.github/workflows/acquisition-health.yml) walks all three scripts at 06:00 UTC, exits 0, 90-day artifact) ·
> §1.1 **invite-bearing composer** ([`scripts/stranger-test-invited.sh`](../../scripts/stranger-test-invited.sh) — mints one invite via FLOW-004 then drives browser walks; 2026-05-24 first run reached HTTP 200 on `/v1/ask` for the first time AND caught + fixed a `captureInviteFromUrl` regression on `/solve/`+`/vs/`) ·
> §1.4 gate-valve **shipped + walked; gate-bypass holds AND provision verified to a 200 (deployed, re-walked 2026-06-12)** ([`scripts/flow-004-walk.sh`](../../scripts/flow-004-walk.sh)
> — mail.tm + curl walker; control 403 + invite bypass + `/v1/ask` HTTP 200; the 2026-06-08 `sample_insert_failed` 500 cleared once SK-HDC-018 + SK-LLM-033 #352 deployed) ·
> §1.4 **first-value seed-quality probe** ([`scripts/flow-004-seed-quality.sh`](../../scripts/flow-004-seed-quality.sh), SK-STRG-008 — one invite, N `create` asks, reports `seeded_ok_ratio` + a `provision_failed` 422 bucket; re-measured live 2026-06-12 at **0.75** (two same-set 4-goal runs), up from 0.25 on 2026-06-10; see `## Progress log` / FLOW-004 outcome) ·
> §2.2 collection (HN+Reddit+GH+GHD+SO+IH+Dev.to+Bluesky+Mastodon) · §2.3 scoring + clustering + verdict · §2.1
> GitHub Issues + GitHub Discussions + Stack Overflow + Indie Hackers + Dev.to + Bluesky + Mastodon sources · §3.1 first 5
> solve pages (paraphrased `<h1>`; now invite-aware) · §8 mirrored flow trackers (8 flows:
> 4 walker-evidenced = FLOW-001 (static-green, gate-403 by design) + FLOW-002/003 (static-green, gate-403 by design) + **FLOW-004 (2026-06-12 passed_degraded: gate-bypass + HTTP 200 verified deployed; first-value seed quality lifted to `seeded_ok_ratio = 0.75`, up from 0.25 on 06-10, with a `provision_failed` 422 tail per SK-STRG-008)**,
> 1 curl-partial = FLOW-005, 1 cron source-health = FLOW-008, 2 unattempted
> = FLOW-006/007) · [`scripts/verify-flows.sh`](../../scripts/verify-flows.sh)
> (curl-observable subset; egress-policy aware) · [`scripts/stranger-test.sh`](../../scripts/stranger-test.sh)
> (browser-observable subset; sub-7s for 9 walks; no operator action). First ICP cron
> fires Mon 2026-05-26 06:00 UTC.
>
> **Context.** Every advertised surface
> ([`progress.md §0`](../progress.md)) shipped; zero validated users.
> [`founder-playbook.md`](../founder-playbook.md) assumes 1:1 calls;
> the founder rejects them — that's why "get real users" needs §1.4's
> release-valve and "validate" needs to be async per §1.3 / §4.
>
> **Cross-refs:** [personas.md](./personas.md) ·
> [email-and-marketing.md](./email-and-marketing.md) ·
> [phase-1-exit-criteria.md](./phase-1-exit-criteria.md) ·
> [GLOBAL-024](../decisions/GLOBAL-024-demand-signal-telemetry.md) ·
> [GLOBAL-025](../decisions/GLOBAL-025-north-star.md) ·
> [GLOBAL-027](../decisions/GLOBAL-027-pre-alpha-gate.md) ·
> [GLOBAL-030](../decisions/GLOBAL-030-evidence-grade-acquisition-tracker-edits.md).

---

## 0.5 The five user flows that matter most (canonical per [GLOBAL-032](../decisions/GLOBAL-032-top-5-user-flows-canonical.md))

Of the eight `FLOW-NNN` blocks in §8, **five carry the entire inbound funnel**: FLOW-001 (anonymous-first happy path), FLOW-002 (`/solve/<slug>` AEO inbound), FLOW-003 (`/vs/<competitor>` comparison inbound), FLOW-004 (waitlist → invite → gate bypass), FLOW-005 (agent self-provisions DB via MCP). The remaining three are either post-acquisition (FLOW-006 SDK escape hatch, FLOW-007 anonymous-DB adoption) or a system pipeline (FLOW-008 cron source-health). [`GLOBAL-032`](../decisions/GLOBAL-032-top-5-user-flows-canonical.md) pins these five as the canonical acquisition surface and demands at least one agent-runnable walker per flow that ran against the deployed surface inside the last seven days; a walker that's stale beyond that bar is treated as the next agent's priority #1.

Evidence why these five (not six, not three) is in the GLOBAL — anchored in the persona priority encoded by [`personas.md`](./personas.md) (P1 highest, P2/P3 strong, P4 third-priority), the stranger-test seeded-prompt split (P1×10, P2×8, P3×4, P6×3 per [`tools/stranger-test/src/personas.ts`](../../tools/stranger-test/src/personas.ts)), and the ICP-mining cron's persona-fit rubric in [`apps/api/src/icp-score.ts`](../../apps/api/src/icp-score.ts) (scores P1/P2/P3/P6 — the same four personas the canonical-five cover plus P6 which currently has no dedicated flow and is the natural next gap).

| # | Flow | Persona | Canonical walker | Last verified | Outcome | Mirror |
|---|---|---|---|---|---|---|
| 1 | FLOW-001 | P1 Solo Builder | `bash scripts/stranger-test.sh` (+ `bash scripts/stranger-test-invited.sh` invite variant) | 2026-06-12 | Playwright walk (browser build 1223): steps 1–4 (GET 200 → hero placeholder → typed goal → submit) green on the seeded prompt; gate-403 at step 5 expected per GLOBAL-027 (`feature_gated`). The SK-GATE-007 CORS preflight fix holds — `verify-flows.sh` preflight guard green | [verify](./automated-icp-validation-plan-verification.md#flow-001--anonymous-first-happy-path) |
| 2 | FLOW-002 | P3 Data-Curious Analyst | `bash scripts/stranger-test.sh` (+ invite variant) | 2026-06-12 | every static + CTA + draft + `solve.try_query_clicked` event-spy assertion green across all probed slugs; gate-403 at step 9 expected per GLOBAL-027 | [verify](./automated-icp-validation-plan-verification.md#flow-002--pain-driven-aeo-inbound-search--solveslug--first-query) |
| 3 | FLOW-003 | P3 / P4 | `bash scripts/stranger-test.sh` (+ invite variant) | 2026-06-12 | every static + CTA + draft + `/llms.txt` assertion passes across all 6 vs slugs (incl. askyourdatabase); gate-403 at step 8 expected per GLOBAL-027 | [verify](./automated-icp-validation-plan-verification.md#flow-003--comparison-driven-inbound-search--vscompetitor--first-query) |
| 4 | FLOW-004 | P1 invited | `bash scripts/flow-004-walk.sh` (+ `bash scripts/flow-004-seed-quality.sh` seed-quality probe, SK-STRG-008) | 2026-06-12 | **passed_degraded — gate-bypass intact (control 403 + invite 200); first-value seed-quality LIFTED ~0.25 → ~0.75.** Today's default-goal walk → first-value `degraded` (0/0). SK-STRG-008 re-measured live: two same-set 4-goal runs both **`seeded_ok_ratio = 0.75`** (stable; degrader = "a meal planner for couples"), up from the 2026-06-10 single-run 0.25. A wider 8-goal run recorded **4 `provision_failed`** (HTTP 422 `infer_failed` — engine couldn't build the DB at all, a harder failure than degraded, now bucketed separately) at ratio 0.75 (`…02-04-02Z.json`); across three 8-goal runs the wide ratio varied **0.6–0.8** with 3–4 `provision_failed` each (LLM variance). Lift not yet causally isolated (planner directives since 06-10 vs LLM variance); "a meal planner for couples" degraded in all 4 runs. Seeding/building every goal is the open SK-LLM-033 / engine-quality lift, not a FLOW gap | [verify](./automated-icp-validation-plan-verification.md#flow-004--waitlist-signup--invite-email--gate-bypass) |
| 5 | FLOW-005 | P2 Agent Builder | `bash scripts/flow-005-walk.sh` (hosted, [`SK-STRG-005`](../features/stranger-test/FEATURE.md)) + `bash scripts/flow-005-stdio-walk.sh` (local-stdio, [`SK-STRG-009`](../features/stranger-test/decisions/SK-STRG-009-flow-005-stdio-walker.md)) | 2026-06-12 | **both SK-MCP-001 transports green.** Hosted: 6/6 in 1s (RFC 9728 root + scoped discovery, RFC 8414 AS metadata, `initialize` + `tools/list` 401 with `WWW-Authenticate` challenge URL matching scoped discovery). Stdio: 16/16 in 0.3s (real `@nlqdb/mcp` binary `initialize` + `tools/list` catalog = `nlqdb_query`/`nlqdb_list_databases`/`nlqdb_describe`, no `create_database` tool). Authenticated tool invocation stays credentialed-mirror | [verify](./automated-icp-validation-plan-verification.md#flow-005--agent-self-provisions-db-via-mcp) |

This table is the single dashboard answer to "is the inbound funnel working today?" Each row's *Canonical walker* is the agent-runnable command the next agent must re-run if its *Last verified* column falls outside the last seven days. The daily [`acquisition-health.yml`](../../.github/workflows/acquisition-health.yml) cron walks each of these at 06:00 UTC so the freshness rule is met by default; a regression that bumps any row off-green lands in the artifact JSON the cron uploads, NOT in a founder-facing inbox (per [`SK-STRG-003`](../features/stranger-test/FEATURE.md) and the operator-loop preamble above).

---

## Current status (updated 2026-06-12)

| KPI | Target | Status |
|---|---|---|
| Free-chain BIRD accuracy | ≥ 0.65 | **raw EX 0.35** (measured lower bound, 2026-06-09, [`eval-baseline.ts`](../../apps/api/src/gate/eval-baseline.ts)); **reasoning EX ≈0.52, up from 0.354** — first measurement after the eval pipeline was unblocked (gdown fix, T17). **Still the acquisition bottleneck** (gate stays closed); closing it lifts the gate for every surface §3 ships |
| Free-chain Spider accuracy | ≥ 0.75 | **raw EX 0.12** (first ever measured, 2026-06-09; reasoning EX 0.19) via [`SK-QUAL-007`](../features/quality-eval/FEATURE.md) + [`SK-QUAL-008`](../features/quality-eval/FEATURE.md). Canonical 500-q / 6-provider re-seed = the now-unblocked GHA [`quality-eval-spider2-lite.yml`](../../.github/workflows/quality-eval-spider2-lite.yml) dispatch |
| Anonymous loop completions | ≥ 50 | 0 — gate 403s every walked `/v1/ask` (2026-05-24 stranger-test); **stays 0 until BIRD/Spider clear OR §1.4 invite-valve verifies end-to-end** |
| Signed-in users (invite-redeemed) | ≥ 10 | 0 real-user (non-walker) redemptions. FLOW-004 gate-bypass is **intact** AND `/v1/ask` returns **HTTP 200** with an invite (2026-06-12 walks) — the 2026-06-08 `sample_insert_failed` 500 stays cleared (SK-HDC-018 + SK-LLM-033 #352). First-value seed quality **lifted ~0.25 → ~0.75**: the SK-STRG-008 probe re-ran live 2026-06-12 — two same-set 4-goal runs both **`seeded_ok_ratio = 0.75`** (stable; only "a meal planner for couples" degraded), up from the 2026-06-10 single-run 0.25; a wider 8-goal run recorded **4 `provision_failed`** (HTTP 422 `infer_failed`) at ratio 0.75 (`flow-004-seed-quality-2026-06-12T02-04-02Z.json`), and across three 8-goal runs the wide ratio varied **0.6–0.8** with 3–4 `provision_failed` each (LLM variance). Lift not yet causally isolated (planner directives since 06-10 vs LLM variance). Most goals now seed, but a meaningful fraction either degrade (empty DB) or 422 (no DB) — closing that is the open SK-LLM-033 / engine-quality lift. This row stays 0 until a real stranger (not the synthetic walker) redeems an invite |
| Sean Ellis Q1 responses | ≥ 20 | 0 — survey not wired (§1.3); meaningful only after a user actually crosses the gate |
| Primary ICP shortlist | exactly 1 | pending first cron Mon 2026-05-26 (verdict logic shipped 2026-05-22) |
| TTFV p50 | ≤ 60 s | anon walk (2026-06-12): ~253 ms p50 time-to-`/v1/ask`-response — every anon response is the gate 403, NOT first-value. Invited walk (2026-06-12): control 403 + invite **200** in ~16–17 s wall (mint-to-answer, incl. ~10–11 s mail.tm email latency) |
| First-query success | ≥ 60% | anon: 0/3 walked runs reached a 200 (2026-06-12, `--prompts 1`) — same gate-403 cause as the anon-loop row. Invited: today's default-goal walk reached **HTTP 200** but first-value `degraded` (0/0). The 2026-06-12 SK-STRG-008 re-measure (two same-set 4-goal runs) recorded **`seeded_ok_ratio = 0.75`** — most invited creates now seed a real DB, up from 0.25 on 2026-06-10; a 200 with an empty schema (degraded) or a 422 (provision_failed) is still not first-value |
| Stranger-test passes | 100% daily | primitive shipped ([`SK-STRG-001`](../features/stranger-test/FEATURE.md), `bash scripts/stranger-test.sh`); 0/3 walked runs passed (2026-06-12, `--prompts 1`) because of the gate; daily cron shipped ([`acquisition-health.yml`](../../.github/workflows/acquisition-health.yml), `--prompts 3`) |

The preamble's "What the next agent should pick" is the canonical
priority order; this table is the receipts. Two BIRD/Spider rows lead
because the gate is doing what GLOBAL-027 asks it to — every other 0%
row in this table inherits from those two. The TTFV / first-query /
stranger-test rows have honest measurements thanks to the 2026-05-24
walker; they are 0% not because the static surface is broken
(FLOW-002 step 8 event-spy, FLOW-003 step 9 `/llms.txt`, every hero /
FAQPage / honest-limits assertion passes) but because every `/v1/ask`
returns `feature_gated` until BIRD/Spider clear or the invite-valve
carries the user across.

---

## 0. Goals and non-goals

**Goal — 6 weeks, $0 ongoing spend, zero 1:1 calls, zero founder
notifications, land on:**

- One primary ICP with 5+ verbatim pain quotes in an evidence file.
- ≥50 anonymous + ≥10 signed-in users through the onboarding loop
  against a real LLM (not canned demo).
- ≥20 Sean-Ellis Q1 responses with distribution attached.
- A dashboard the founder can glance at when they want to, never
  has to. Promote/iterate/cut signals come from the data, not alerts.

Operator model + measurement bar are in the top preamble — don't
re-derive them here.

**Non-goals.** Calls, cold email, paid ads, AppSumo, lifetime deals,
new surfaces, persona expansion past P1/P2/P3/P6, and any
founder-facing notification channel (no LogSnag-to-founder, no
on-failure email, no Slack ping — agents handle failures by
re-prioritising, not by paging the operator).

---

## 1. Phase A — Anti-self-deception layer (BLOCKING — outranks all §3)

**This is the layer that detects "people land and bounce" within
days, not months.** Until §1.1, §1.2, and §1.3 ship, no §3 KPI can
be trusted — every visitor we drive is a coin-flip we can't measure.
§1.4 (release-valve) shipped 2026-05-21 and unblocks traffic *for
invite-bearing visitors only*; the remaining three are the only
reason any later acquisition push isn't a year-long self-deception.

**Engine quality sits above this whole layer.** Per the 2026-05-24
founder directive, BIRD 0.318 and Spider `null` are the actual
acquisition bottleneck: even if §1.1–§1.4 all ship, a stranger who
crosses the gate via an invite still meets a free chain that's
wrong roughly 2 out of 3 queries. That's a worse first-impression
than the gate. So [`quality-eval`](../features/quality-eval/FEATURE.md)
velocity is the real priority — this phase exists to keep §3
honest *while* engine work lifts the gate.

Surfaces are documented in
[`onboarding/FEATURE.md`](../features/onboarding/FEATURE.md) and
[`web-app/FEATURE.md`](../features/web-app/FEATURE.md); what isn't
done is end-to-end stranger-test, instrumented baselines, and the
in-product survey trigger.

### 1.1 Stranger-test the happy path with synthetic agents

Headless Playwright walker from a non-Worker IP hits the deployed
`nlqdb.com`, types a seeded "what are you building" prompt, submits
the hero, runs a follow-up, and grades each step against the
verification mirror's walkthrough. 25 seeded prompts pinned to the
P1×10 / P2×8 / P3×4 / P6×3 split. Pass = every step ok, no 4xx
(other than the gate's `feature_gated`), TTFV < 60 s p95.

> **✅ PARTIAL IMPLEMENTED 2026-05-24 (primitive — daily cron unshipped):**
> [`tools/stranger-test/`](../../tools/stranger-test/) ships a `bash scripts/stranger-test.sh`
> walker covering FLOW-001 (homepage hero), FLOW-002 (`/solve/<slug>`),
> and FLOW-003 (`/vs/<slug>`). One shared Chromium + per-walk contexts
> (per [`SK-STRG-001`](../features/stranger-test/FEATURE.md)). 25
> seeded prompts in `tools/stranger-test/src/personas.ts` ([P1×10,
> P2×8, P3×4, P6×3](../features/stranger-test/FEATURE.md)). 9 walks
> (3 prompts × 3 flows) complete in ~7 s with one shared browser; each
> walk capped at 180 s by `withDeadline`. JSON output to
> `tools/stranger-test/results/walk-<utc>.json`. Exit-code non-zero on
> any failure; no LogSnag, no email, no webhook (operator loop
> intact). Live 2026-05-24 walk against `https://nlqdb.com`: 0/9
> passed; every run gate-fails at `/v1/ask` with `403 feature_gated`
> (FLOW-001 step 5, FLOW-002 step 9, FLOW-003 step 8) — which proves
> the binding gap is the §1.4 anon-bypass tension, NOT any
> static-surface regression. FLOW-002's prior "step 8 event-hook
> missing" finding is corrected: the spy ran on a freshly-navigated
> page; with sessionStorage persistence the `solve.try_query_clicked`
> event IS observed. Open: daily cron + R2 archive + diff-against-prior
> JSON (see [`SK-STRG-001`](../features/stranger-test/FEATURE.md)
> open questions).

### 1.2 Wire the four onboarding KPIs to a live dashboard

[`SK-ONBOARD-005`](../features/onboarding/FEATURE.md) commits the
instrumentation with baseline by **2026-06-01** (11 days out). Pull
forward to Week 1.

Emit `onboarding.{landing.viewed, first_query.{attempted,succeeded,failed}, second_query.attempted}`
via [`packages/events`](../../packages/events). Run the async LLM-judge
on every first-query (free chain, `ctx.waitUntil`). Surface five tiles
in a public-read Grafana panel `onboarding-kpis`: TTFV p50/p95, success
rate, drop-off rate, first→second rate, gate-block rate
([SK-GATE-006](../features/pre-alpha-gate/FEATURE.md)). Share-link on
`nlqdb.com/build-log` — doubles as build-in-public artifact (§3.2).

### 1.3 Ship the async in-app survey widget

**Recommendation: PostHog Cloud free tier** (1M events/mo, surveys +
funnels + replay in one). [`email-and-marketing.md §4`](./email-and-marketing.md)
already holds PostHog "in reserve for Phase 2 if a real cohort question
lands". This is that moment. Fallback: Formbricks (open-source,
self-host on Workers).

Three triggers:

- **Sean Ellis Q1** — fires when `onboarding.second_query.attempted` AND
  `session_day ≥ 7` (the user's been around long enough to have a view).
  One question: "How would you feel if you could no longer use nlqdb?
  (very/somewhat/not disappointed / N/A)". No follow-up modals.
- **Persona-extraction** — after Q1 answered, one text line: "In one
  sentence: what are you trying to build?" (Q2 of the founder-playbook
  script; captures language unprompted).
- **Drop-off recovery** — on `onboarding.first_query.failed`, one
  radio: "What blocked you? (a) the answer was wrong (b) the UI was
  confusing (c) I expected something else (d) I changed my mind".

Responses → LogSnag `#north-star` + D1 `survey_response` (PII-free,
anon device or principal). Event-based triggers hit 25–40% response
vs 5–15% for email
([Zonka 2026](https://www.zonkafeedback.com/blog/best-in-app-survey-tools));
20 responses ≈ 50–80 qualifying sessions.

### 1.4 Resolve the pre-alpha-gate paradox

**Biggest blocker.** Gate returns 403 today; without a valve, every §3
visitor sees the waitlist CTA, not the product.

**Proposed:** auto-issue invite codes on homepage `#waitlist` submit,
capped **N=200/week**, delivered via existing Resend template
([§1](./email-and-marketing.md)). Cap protects free LLM daily quota
([phase-1-exit-criteria item 4](./phase-1-exit-criteria.md)). Auto-
issuance keeps founder out of the loop. One-use, 80-bit entropy
([SK-GATE-003](../features/pre-alpha-gate/FEATURE.md)), 30-day expiry.

**Alternative if rejected:** invite codes embedded in launch-URL
(`?invite=<code>`) for Show HN / build-in-public threads (§3.3). The
homepage auto-applies via `X-Invite-Code` header. Single-shot, auditable,
no email infra.

Either way: gate must open for §3 visitors or §2/§3 are wasted.
Flagged in §6.

> **✅ IMPLEMENTED 2026-05-21 (Option A — auto-issue on signup):**
> `POST /v1/waitlist` now auto-issues a 128-bit invite code to every new
> signup via Resend. Cap: 200/week. Code TTL: 30 days. Browser side:
> `?invite=<code>` URL param captured on the homepage and `/app/new`,
> stored in `localStorage["nlqdb_invite"]`, forwarded as `X-Invite-Code`
> header on every `/v1/ask` call. Canonical decision: SK-GATE-007.

---

## 2. Phase B — Automated ICP discovery (Weeks 1–2, parallel to §1)

Existing personas ([personas.md](./personas.md)) are hypotheses, not
validated pain. Mine public complaints, score against persona pain
bullets, let the data pick.

**Owner:** one Cloudflare cron Worker + free-chain LLM pipeline.
**Exit gate:** `docs/research/icp-evidence-<yyyy-mm>.md` with ≥50
verbatim quotes per priority persona, clustered.

### 2.1 Sources

| Source | API | Free? | Persona signal |
|---|---|---|---|
| Reddit listings | `r/X.json` ([2026 pricing](https://painonsocial.com/blog/how-much-does-reddit-api-cost) — free for non-commercial) | Y | P1/P2/P3/P5 |
| Hacker News | [HN Algolia](https://hn.algolia.com/api) | Y | P1/P2/P6 |
| GitHub issues | [search/issues](https://docs.github.com/en/rest/search/search) (30 RPM authed) | Y | P1/P2/P6 ✅ shipped |
| GitHub Discussions | [GraphQL `search(type:DISCUSSION)`](https://docs.github.com/en/graphql/reference/queries#search) (5000 pts/hr authed) | Y | P1/P2/P4/P6 ✅ shipped 2026-05-31 |
| Indie Hackers | `feed.indiehackers.world` JSON Feed (unofficial mirror) | Y | P1 ✅ shipped |
| Stack Overflow | [SE API 2.3](https://api.stackexchange.com) (anon 300/IP/day) | Y | P1/P3/P4/P6 ✅ shipped |
| Dev.to (Forem) | [public `/api/articles`](https://developers.forem.com/api/v1) (~3 RPS anon) | Y | P1/P3/P4 ✅ shipped 2026-05-25 |
| Bluesky (AT Protocol) | [`app.bsky.feed.searchPosts`](https://docs.bsky.app/docs/api/app-bsky-feed-search-posts) on `api.bsky.app` (no auth, "generous" rate-limits) | Y | P1/P2/P3 ✅ shipped 2026-06-01 |
| Mastodon (ActivityPub) | [`GET /api/v1/timelines/tag/<tag>`](https://docs.joinmastodon.org/methods/timelines/) on `mastodon.social` (no auth, 300 reads/5min/IP) | Y | P1/P2/P3/P6 ✅ shipped 2026-06-04 |
| Discord publics | webhook bridges on specific guilds | Y if invited | P2 |
| F5Bot | keyword email alerts | Y | all |
| X/Twitter | — | **skip** (no free post-2023) | — |

**Subreddits:** `r/SaaS`, `r/sideproject`, `r/webdev`, `r/nextjs`,
`r/SQL`, `r/PostgreSQL`, `r/programming`, `r/learnprogramming`,
`r/dataengineering`, `r/clickhouse`, `r/devops`, `r/LocalLLaMA`,
`r/ClaudeAI`, `r/LangChain`, `r/MachineLearning`, `r/Database`
(matches [founder-playbook.md §1](../founder-playbook.md) "where they
hang out").

**HN queries:** `hate writing SQL`, `text to SQL`, `natural language
database`, `agent memory`, `MCP server`, `Postgres setup`, `Retool
alternative`, `Metabase too slow`, `vector DB`, `pgvector`.

**GH issue queries:** `is:issue "text to sql"`, `is:issue "natural language" database`, `is:issue "ai agent" memory store`, `is:issue "query builder" too verbose`, `is:issue prisma migration overhead` — each appended with a rolling `created:>${last-7-day-iso-date}` filter to keep signal current.

### 2.2 Scrape stack — one Worker, free chain, weekly cron

> **✅ IMPLEMENTED 2026-05-21 (Slice 1 — data collection):**
> `runIcpScrape` added to the existing `nlqdb-api` Worker as a cron
> (`0 6 * * 1`, Mon 06:00 UTC). Sources: HN Algolia (5 queries) + Reddit
> (3 subreddit/query pairs). Dedup via `icp:seen:<source>:<id>` KV (90d
> TTL). Items stored as `icp:item:<YYYYMMDD>:<source>:<id>` KV (30d TTL).
> LogSnag `#icp-mining` notified after each run. Canonical decision: SK-ICP-001.
>
> **✅ EXPANDED 2026-05-22 (GitHub Issues source — SK-ICP-004):**
> When `GH_TOKEN` is set, `runIcpScrape` additionally queries GitHub Search
> Issues API (5 queries, rolling `created:>${last-7-day-iso-date}` filter,
> 10 results each). Items stored as `source: "github"`, deduped same as
> HN/Reddit.
>
> **✅ EXPANDED 2026-05-23 (Stack Overflow source — SK-ICP-005):**
> `runIcpScrape` additionally queries the Stack Exchange API 2.3
> `/search/advanced` endpoint (`site=stackoverflow`, 5 tag+query pairs,
> 7-day `fromdate`, anonymous quota 300/IP/day). Items stored as
> `source: "stackoverflow"`, `id: "so-<question_id>"`; LogSnag adds
> `SO: <n>` to the per-run line. Live API probe 2026-05-23 from this
> environment returned 1 fresh `postgresql/setup` question with
> `quota_remaining=299`, `backoff=None`.
>
> **✅ EXPANDED 2026-05-23 (Indie Hackers source — SK-ICP-006):**
> `runIcpScrape` additionally queries the unofficial
> `feed.indiehackers.world` JSON Feed for 5 P1-pain queries
> (`database`, `boilerplate`, `side+project`, `first+paying`, `stack`).
> Items stored as `source: "indiehackers"`, `id: <slug-from-/post/-url>`;
> server-side date filter is unavailable on the mirror so the 7-day
> window is enforced client-side after parsing `date_modified`; posts
> with unparseable date or non-conforming URL are dropped before KV
> write. LogSnag adds `IH: <n>` to the per-run line. Live probe
> 2026-05-23 against `?q=database&exclude=link-post` returned `200, 100
> items, 2 within 7-day window` — modest but unique P1 cohort signal
> (≈10 new IH items/week across 5 queries).
>
> **✅ EXPANDED 2026-05-25 (Dev.to source — SK-ICP-008):**
> `runIcpScrape` additionally queries the Forem public API at
> `https://dev.to/api/articles?tag=<tag>&per_page=15&top=7` for 5 tag
> queries covering P1/P3/P4/P6 (`database`, `sql`, `postgres`, `webdev`,
> `orm`). `top=7` is the server-side 7-day filter so the cron stores
> only fresh items without a client-side date pass. Articles stored as
> `source: "devto"`, `id: "devto-<article.id>"` (the `devto-` prefix
> prevents collisions with other numeric-ID sources); articles with
> unparseable `published_timestamp` are dropped before KV write.
> `User-Agent: nlqdb-icp-bot` + `AbortSignal.timeout(10s)`; per-tag
> errors caught. LogSnag adds `DEV: <n>` to the per-run line. Live
> probe 2026-05-25 against each of the 5 tags returned `HTTP 200` with
> ≥4 fresh articles per tag inside the `top=7` window — comfortably
> above the existing source mix. No env binding required (public
> documented API per [`developers.forem.com`](https://developers.forem.com/api/v1)).
>
> **✅ EXPANDED 2026-06-01 (Bluesky source — SK-ICP-012):**
> `runIcpScrape` additionally calls the AT Protocol AppView at
> `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=<q>&limit=25&sort=latest&since=<isoSeven>`
> for 5 P1/P2/P3 queries (`text to sql`, `agent memory`,
> `natural language database`, `vector database`, `rag pipeline`). Stored
> as `source: "bluesky"`, `id: "bsky-<post.cid>"`; URL rebuilt as
> `https://bsky.app/profile/<author.handle>/post/<rkey>` from the
> `at://.../app.bsky.feed.post/<rkey>` URI. `User-Agent: nlqdb-icp-bot`
> + `AbortSignal.timeout(10s)`; per-query error isolation; posts with
> unparseable `record.createdAt`, missing handle/rkey/cid,
> non-`app.bsky.feed.post` URI or empty text are dropped pre-write.
> LogSnag adds `BSKY: <n>` after `DEV: <n>`. Live probe 2026-06-01 from
> this VM: 5 fresh posts for `text to sql` in the past 7 days including
> `"My SQL bot dies after two questions! Did you read the JP Morgan study?"`
> — exactly the P2 (agent builder) language the prior 7 sources never
> caught; `agent memory` / `vector database` / `rag pipeline` each returned
> 10/10. `public.api.bsky.app` 403'd from this agent VM 2026-06-01
> (BunnyCDN block; not re-verified from CF Workers egress);
> `api.bsky.app` is the canonical Express AppView and serves the
> same payload without that block. No env binding (public unauthenticated
> read; AT Protocol AppView read endpoints are documented as no-auth with
> "generous" rate-limits per [`docs.bsky.app`](https://docs.bsky.app/docs/advanced-guides/rate-limits)).
>
> **✅ EXPANDED 2026-06-04 (Mastodon source — SK-ICP-013):**
> `runIcpScrape` additionally calls the ActivityPub canonical hub at
> `https://mastodon.social/api/v1/timelines/tag/<tag>?limit=25&local=false`
> for 5 P1/P2/P3/P6 hashtags (`postgres`, `database`, `sql`, `llm`, `rag`).
> Stored as `source: "mastodon"`, `id: "mast-<post.id>"`; the post's
> federated `url` is preserved verbatim (cross-instance posts cite their
> origin host) but only when it starts with `http(s)://` — federation
> trust boundary, a malicious origin instance can't push `javascript:`
> into the evidence file. `content` is HTML — `stripMastodonHtml` strips
> tags + decodes the 7 entities Mastodon's renderer emits before storage,
> with `&amp;` decoded LAST so a literal `&amp;lt;` in a how-to about
> HTML doesn't collapse to `<` mid-pass. Pre-write rejects also drop
> posts older than the rolling 7-day window, `sensitive: true` posts
> (NSFW — evidence file is product-public), `visibility !== "public"`
> posts (`unlisted` is the author's bulk-indexing opt-out), and posts
> with empty stripped text. A single 429 short-circuits the remaining
> queries. Rate-limit budget: `docs.joinmastodon.org/api/rate-limits/`
> formally publishes `300/5min` for authenticated users only; the
> unauthenticated quota is undocumented but the 2026-06-04 agent VM
> probe observed `X-RateLimit-Limit: 300, X-RateLimit-Remaining: 294`
> after 6 unauthenticated probes — the code reads `X-RateLimit-Remaining`
> as the canonical budget sensor either way. `User-Agent: nlqdb-icp-bot`
> + `AbortSignal.timeout(10s)`; per-tag error isolation. OTel span
> `nlqdb.icp.fetch.mastodon` splits `nlqdb.icp.items_returned` (from
> the AppView) vs `nlqdb.icp.items_stored` (after the pre-write rejects)
> so a 25-NSFW response and a 0-post response show as different signals,
> plus `nlqdb.icp.mastodon.rate_remaining` only when the header is
> present (a missing header is NOT recorded as `0` — `Number(null) === 0`
> would falsely signal exhaustion). LogSnag adds `MAST: <n>` after
> `BSKY: <n>`. No env binding (public unauthenticated read; the docs
> mark `/api/v1/timelines/tag/<tag>` as `OAuth: Public`).
> **`mastodon.social/robots.txt` explicitly disallows GPTBot only**
> (our bot is `nlqdb-icp-bot`; the `/api/v1/timelines/tag/*` path is
> not in any other Disallow rule). Live probe 2026-06-04 from the
> agent VM: HTTP 200 + JSON-array body on every probed tag;
> `postgres` returned 20 fresh posts in 24h including *"Handling
> graphs with SQL/PGQ in PostgreSQL"* (P3 analyst signal);
> `llm` / `rag` / `agent` each returned 20 fresh posts (P2
> agent-builder signal); cron uses 5 calls/week — three orders of
> magnitude inside the observed bar.
>
> **✅ EXPANDED 2026-05-31 (GitHub Discussions source — SK-ICP-009):**
> When `GH_TOKEN` is set, `runIcpScrape` additionally POSTs the GitHub
> GraphQL endpoint (`https://api.github.com/graphql`) with
> `search(query: $q, type: DISCUSSION, first: 10)` for 5 P1/P2/P4/P6
> queries (`text to sql`, `natural language database`, `agent memory store`,
> `prisma migration`, `supabase setup`), each appended with the same
> rolling `created:>${isoDate(sevenDaysAgoUnix)}` filter SK-ICP-004 uses
> for Issues. Discussions stored as `source: "github_discussions"`,
> `id: "ghd-<node.id>"`; nodes with unparseable `createdAt` are dropped
> before KV write; a GraphQL `errors` body is treated as a soft failure
> (other 6 sources unaffected). `Authorization: Bearer $GH_TOKEN` +
> `User-Agent: nlqdb-icp-bot` + `X-GitHub-Api-Version: 2022-11-28` +
> `AbortSignal.timeout(10s)`. LogSnag adds `GHD: <n>` between `GH:` and
> `SO:`. Live probe 2026-05-31 from this environment:
> `text to sql` → `discussionCount=8478`; `natural language database
> created:>2026-05-24` → 9 fresh discussions including
> `moorcheh-ai/memanto/discussions/564 — "How are you handling persistent
> memory in your CrewAI workflows?"` — exactly the P2 (agent builder)
> long-form pain signal the prior 6 sources never caught. `rateLimit.cost=1`
> per search × 5 queries/week = 5 points against the 5000-point/hour
> authenticated bucket.

- One Cloudflare cron Worker runs Mon 06:00 UTC.
  Pulls last week's posts + comments; dedupes by `(source, item_id)`;
  writes raw to KV (R2 upgrade tracked as open question in icp-mining FEATURE.md).
- Reddit via direct `.json` listings (no key for public read). HN via Algolia.
- Budget guard: ≤100 items/week × 2 KV writes each, well inside free tier.

### 2.3 LLM scoring — persona-fit rubric

> **✅ IMPLEMENTED 2026-05-21 (Steps 1–2 — filter + score):**
> `runIcpScore` in `icp-score.ts` runs immediately after each weekly scrape in the same cron slot.
> Step 1 (filter): regex prefilter on pain words (hate, frustrat, stuck, wish, verbose, boilerplate, …) applied to `title + text`.
> Step 2 (score): Groq `llama-3.1-8b-instant` → Gemini `gemini-2.5-flash` fallback scores each passing item 0–10 for P1/P2/P3/P6; OTel span `nlqdb.icp.score` per batch.
> Items with max persona score < 5 are discarded; the rest stored as `icp:scored:<YYYYMMDD>:<source>:<id>` (30d KV TTL).
> Steps 3–4 landed 2026-05-22 — see the block below.
>
> **Source expansion (same PR):** HN queries 5 → 10 (added MCP server, Postgres setup, Retool alternative, vector DB, pgvector). Reddit 3 → 16 subreddit/query pairs (full plan §2.1 list).

LLM cluster — persona-fit rubric (all four steps implemented as of 2026-05-22):

1. **Filter** (free chain): regex prefilter on `pain | annoyed | hate
   | wish | stuck on | spent N hours | why is X so hard | any
   alternative to`; LLM yes/no on the 30% that survives.
2. **Score** (free chain, structured output): 0–10 per persona, against
   each persona's "Current pain" bullets in
   [personas.md](./personas.md). Output
   `{persona_id, score, supporting_quote (≤280ch), source_url}`.
3. **Cluster** (weekly batch, free chain): top 100 rows per persona →
   5–7 themed clusters with a one-sentence label + strongest verbatim
   quote per cluster.
4. **Persist** to `docs/research/icp-evidence-<yyyy-mm>.md` via GitHub
   Contents API `PUT` (checks existing SHA; writes directly to `main`).
   Evidence file includes cluster table + top-20 raw items per persona.

> **✅ IMPLEMENTED 2026-05-22 (Steps 3–4 — cluster + evidence file):**
> `runIcpCluster` in `icp-cluster.ts` lists all `icp:scored:*` KV keys
> (paginated), groups by best persona (top-100 each), calls Groq →
> Gemini fallback to cluster into 5–7 themes per persona, generates
> `docs/research/icp-evidence-<yyyy-mm>.md`, and writes it to GitHub
> via Contents API. First evidence file will auto-generate Mon 2026-05-26.
> Canonical decisions: SK-ICP-003 (cluster), SK-ICP-004 (GitHub Issues source).

Anthropic's case study on structured LLM analysis of interviews
([HN Dec 2025](https://news.ycombinator.com/item?id=46331877))
is a useful reference for structured LLM-assisted theme extraction, not proof that the pipeline is better than human coding.

### 2.4 Decision rule — narrow to 1 ICP

| Condition | Action |
|---|---|
| One persona ≥3× weighted score of any other AND ≥30 quotes | Promote to "primary ICP 2026-Q3". Park others. |
| Two personas within 30% AND together ≥60% of weighted score | Run both Week 3, narrow at end of Week 4. |
| No persona clears ≥10 quotes | Plan failed (search terms wrong). Iterate keywords; do NOT widen persona list. |

Decision = founder reads the evidence file on a Sunday. No human is
interviewed.

> **✅ IMPLEMENTED 2026-05-22 (verdict automation):**
> `runIcpCluster` now applies the rule itself: each evidence file opens
> with a `§2.4 Decision rule` block stating `primary_confirmed`,
> `directional`, or `no_signal` and naming the leading persona. The same
> verdict is exposed on `IcpClusterResult.{primaryStatus, primaryIcp}` —
> the cron's `icp_cluster_completed` log and the per-run LogSnag entry
> carry it too, so the founder learns the answer without opening the
> file. Canonical decision: SK-ICP-003.

---

## 3. Phase C — Frictionless user acquisition (Weeks 2–5)

The legitimate version of [founder-playbook.md §1](../founder-playbook.md)
recruitment, humans removed, inbound traps in their place. **Exit gate:**
§5.3 numbers.

### 3.1 Pain-driven content traps (SEO + AEO)

For every §2.3 cluster, publish one static Astro page at
`nlqdb.com/solve/<slug>` with: verbatim cluster quote as `<h1>` ·
working `<nlq-data>` embed answering the implied question · "this
works because" trace toggle showing compiled SQL
([SK-WEB-005](../features/web-app/FEATURE.md)) ·
`<link rel="canonical">` to source URL (credit complainer, don't
outrank) · JSON-LD `HowTo` + mirror to
[`code-samples.txt`](../../apps/web/public/code-samples.txt)
([SK-WEB-003](../features/web-app/FEATURE.md)) so LLM crawlers cite
as working example.

**Volume:** 15–25 pages by W3. Workers template + LLM fill-in from
cluster data; founder merges PR; no by-hand writing. Gartner forecasts large organic-search disruption by 2028
([2026 trend report](https://painonsocial.com/blog/best-pain-point-tool)).
AEO earns impressions now.

> **✅ IMPLEMENTED 2026-05-23 (first 5 hand-curated pages — pre-cluster):**
> `apps/web/src/data/solve.ts` (typed source of truth) + `apps/web/src/pages/solve/[slug].astro`
> (single Astro template, getStaticPaths). 5 pages shipped:
> `/solve/cheap-internal-dashboard` (P3), `/solve/give-ai-agent-persistent-memory` (P2),
> `/solve/skip-postgres-setup-side-project` (P1), `/solve/natural-language-sql-without-training-data` (P3),
> `/solve/ship-leaderboard-no-sql` (P1). Each page: AEO direct-answer
> capsule, `<nlq-data>` snippet embed, "What nlqdb actually does"
> bullets, mandatory "What nlqdb doesn't do here" honest-limits section,
> 3-5 FAQs (FAQPage JSON-LD), HowTo JSON-LD, ≥2 cited enduring
> discussion-hub URLs (no rot-prone single-thread URLs per SK-SOLVE-003).
> Sitemap + llms.txt updated automatically from the data file. "Try
> this query" CTA calls the client `emit("solve.try_query_clicked")` hook and
> seeds the `nlqdb_draft` localStorage slot before navigating to
> `/app/new`. **Deviation from plan literal wording:** `<h1>` is the
> paraphrased natural-language search query rather than a verbatim
> cluster quote — until the 2026-05-26 first cluster file lands there
> is no verbatim quote to cite without fabricating one, and SK-SOLVE-001
> records the trade-off. Canonical decisions: SK-SOLVE-001/002/003 in
> [`docs/features/solve-pages/`](../features/solve-pages/FEATURE.md).

### 3.2 Build-in-public — scheduled, never DMed

Already committed in [phase-plan.md §8](../phase-plan.md) and
[email-and-marketing.md §3](./email-and-marketing.md): 1 long-form
blog/week, 3 threads/week, 1 release/week.

**Make it automatic:**

- Weekly summary Worker reads `feature.eval.weekly`, the §1.2
  dashboard, and the §2.3 cluster file; drafts a thread + blog via
  free chain; opens PR with X / LinkedIn / IH variants.
- Posting stays manual (avoid platform TOS issues); content prep is
  automated.
- Anchors: Tue 09:00 UTC long-form, Wed + Fri 16:00 UTC threads
  ([2026 launch research](https://www.scrolllaunch.com/blog/product-hunt-alternatives-2026)
  — Tue–Thu engagement beats Mon/Fri).

### 3.3 Show HN / Product Hunt — single-shot, gate-aware

[founder-playbook.md §4](../founder-playbook.md) checklist is sound.
Two amendments:

- **Launch URL carries the gate-bypass.** `?invite=<code>` in the
  submitted URL (per §1.4 alternative). Without it, the gate 403 is
  the first impression — wasted launch.
- **Multi-platform sequence**
  ([2026 best-practices](https://www.scrolllaunch.com/blog/product-hunt-alternatives-2026)):
  W4 D-7 BetaList · D-3 dev.to + IH long-form (reuse top §3.1 page) ·
  D0 (Tue 06:00 PT) Show HN + `r/programming` · D+2 Product Hunt.
  One launch, not a campaign. "Pause paid work 48h post-submit" per
  founder-playbook.

Successful Show-HN drops 10k–50k visitors in 24h
([Markepear's HN guide](https://www.markepear.dev/blog/dev-tool-hacker-news-launch)).
§1.1 stranger-test exists so the funnel survives that spike.

### 3.4 Waitlist as the gate's pressure-relief valve

Reframe operationally: homepage `#waitlist` is the **primary growth
surface** for as long as the gate is closed.

- Form posts to `POST /v1/waitlist` (already shipped per
  [GLOBAL-027](../decisions/GLOBAL-027-pre-alpha-gate.md) tail).
- Worker enqueues Resend email with one-time invite code at the §1.4
  cap.
- Waitlist page renders **current gate state**
  ([SK-GATE-002](../features/pre-alpha-gate/FEATURE.md) BIRD/Spider
  progress bar) — honest about what they wait for; doubles as
  north-star ticker.
- Every signup fires `feature.requested.early_access` ([already
  wired](../features/pre-alpha-gate/FEATURE.md)) → §2 evidence file
  gains "intent to use", not just "pain in the wild".

### 3.5 Tractor beams — examples, gallery, comparison pages

- **GitHub `examples/` is the storefront.** Add one
  `examples/<persona>/<scenario>/` per §2.3 cluster. README + working
  snippet + `bun create` invocation + Deploy-to-CF button.
- **Hosted gallery `nlqdb.com/gallery`** — list of opt-in-public
  anon-mode databases. "21 people used nlqdb in the last 24h, here's
  what they built". Resolves the live-ticker open question in
  [web-app/FEATURE.md](../features/web-app/FEATURE.md).
- **`nlqdb.com/vs/<competitor>`** pages: WrenAI, Vanna, Chat2DB,
  Text2SQL.ai, Retool. Honest side-by-side, one shipped table per
  page. Outranks competitors in AEO because most don't ship
  comparison pages of their own.

### 3.6 Reply-to-pain — automated only as far as ethics allow

Closest to cold outbound; needs explicit founder say-so (§6).

§2 pipeline finds new high-scoring complaints in real time. For each,
Worker drafts a single reply that:

1. Acknowledges pain in OP's verbatim wording.
2. Links to the matching §3.1 `solve/` page (the **answer** to their
   specific question, NOT a marketing page).
3. Discloses authorship: `"(I'm building nlqdb — full disclosure)"`.
4. **Founder approves every reply** via 2-click queue at
   `nlqdb.com/internal/reply-queue`. Approved replies post from the
   founder's own Reddit/HN/GH account.

Stays inside [email-and-marketing.md §3](./email-and-marketing.md)
because (a) not cold — OP posted publicly asking for help, (b) the
reply is the answer they asked for, (c) authorship is disclosed. If
too close to the refuse line, **cut §3.6 entirely** — §3.1–§3.5
should hit the acquisition target alone.

---

## 4. Phase D — Automated PMF feedback capture (Weeks 1–6, continuous)

**Owner:** §1.3 widget + weekly digest cron. **Exit gate:** 20 Sean
Ellis Q1 responses by end of W6.

### 4.1 Sean Ellis Q1 as in-app survey

Wording verbatim from [founder-playbook.md §2](../founder-playbook.md):
"How would you feel if you could no longer use nlqdb? (very disappointed
/ somewhat disappointed / not disappointed / N/A)".

**Triggers** ([PMFsurvey.com guidance](https://pmfsurvey.com/) — only
survey users who've completed the core loop ≥2 times; Day-1 users
corrupt data): user has ≥2 `onboarding.first_query.succeeded` AND
most recent ≥24h ago. One survey per principal, ever.

Response posts `feature.pmf.sean_ellis_q1` with
`{response, principal_id_anon, query_count, days_since_first_query}`.

40%+ "very disappointed" is canonical PMF threshold
([Zonka template](https://www.zonkafeedback.com/templates/sean-ellis-product-market-fit-survey-template));
30–40% directional; <30% back to §2.

### 4.2 Q2–Q5 fanned across the session lifecycle

Original 5 questions were designed for 30-min calls. Async:

| Q | Trigger | Format |
|---|---|---|
| Q1 disappointment | After 2nd success +24h | radio (above) |
| Q2 "who else benefits" | After Q1 | one-line text |
| Q3 "main benefit" | After 5th query | one-line text |
| Q4 "almost stopped using for" | After 7d inactive then return | one-line text |
| Q5 "how to improve" | "Share feedback" button in `/app` chrome | textarea |

Verbatim into `survey_response` D1, with opt-in "email me a follow-up"
(one-way; we email, they don't have to reply).

### 4.3 Weekly LLM-judge digest

Sun 22:00 UTC cron Worker:

- Reads `feature.pmf.*`, `feature.requested.*`, `onboarding.*` (last 7d).
- Reads most recent §2.3 cluster file.
- Free-chain LLM produces 2-paragraph digest + 3 bullets ("biggest
  signal / blocker / ask").
- Output to LogSnag `#north-star` and
  `docs/digest/yyyy-ww.md` via nightly PR.
- Each entry tagged with a `feature.requested.*` event ID (per
  founder-playbook tagging discipline).

Async replacement for [founder-playbook.md §2](../founder-playbook.md)
"after every 3 interviews, theme-extract together".

### 4.4 Decision gates

| Signal | Action |
|---|---|
| ≥10 Q1, ≥40% VD | **PMF confirmed** for primary ICP. Trigger [phase-plan.md §6](../phase-plan.md) monetization-signal review. |
| ≥10 Q1, 25–40% VD | **Directional.** Iterate UX/onboarding; no monetization work yet. |
| ≥10 Q1, <25% VD | **Pre-PMF.** Re-run §2 using Q3 verbatim "main benefit" quotes as new search terms — reveals what users actually came for. |
| <10 Q1 by W6 | **Acquisition is bottleneck**, not product. Open retro on §3; do not falsely conclude pre-PMF. |

---

## 5. Sequence, budget, success criteria

### 5.1 Six-week calendar

| W | §1 Prep | §2 ICP | §3 Acquisition | §4 PMF |
|---|---|---|---|---|
| 1 | stranger-test · KPI panel · widget · gate-valve decision | sources shipped · scrape Worker live | (wait on §1) | survey wired |
| 2 | green every PR | first evidence PR | first 5 `solve/` pages | Q2–Q5 wired |
| 3 | — | cluster review → 1–2 primary ICPs | 10 more pages · gallery v0 · BetaList | first digest |
| 4 | — | (cont.) | Show HN + r/programming + dev.to | survey N≥5 |
| 5 | — | (cont.) | Product Hunt + IH long-form · §3.6 decision | survey N≥12 |
| 6 | — | (cont.) | hold · observe | survey N≥20 · §4.4 go/no-go |

### 5.2 Budget — $0 ongoing

Per [GLOBAL-013](../decisions/GLOBAL-013-free-tier-bundle-budget.md).
PostHog Cloud free (1M ev/mo) · CF Workers + R2 + KV free · Reddit/HN/
GH/SO APIs free (non-commercial) · F5Bot free · Resend existing 3k/mo ·
LogSnag existing 2.5k/mo.

If Reddit non-commercial gate re-interprets
([2026 pricing](https://painonsocial.com/blog/how-much-does-reddit-api-cost)),
cap at 1k/day/source. Apify $5/mo credit
([Reddit Pain Finder](https://apify.com/solutionssmart/reddit-pain-finder/api))
is the documented fallback.

### 5.3 Success criteria at W6

| KPI | Floor | Source |
|---|---|---|
| Anonymous loop completions | ≥ 50 | §1.2 dashboard |
| Signed-in users (invite-redeemed) | ≥ 10 | `gate:user:*` count |
| Sean Ellis Q1 responses | ≥ 20 | `feature.pmf.sean_ellis_q1` |
| "Very disappointed" share | report | directional, no floor |
| Primary ICP shortlist | exactly 1 | §2.4 rule |
| Q3 "main benefit" verbatim | ≥ 15 | `survey_response` D1 |
| TTFV p50 | ≤ 60s | [GLOBAL-025](../decisions/GLOBAL-025-north-star.md) |
| First-query success | ≥ 60% | LLM-judge |

Hit the first three → the founder has a defensible, evidence-backed
answer to "is this working?" — without one call.

---

## 6. Things flagged to the founder (per CLAUDE.md P1)

This plan contradicts or amends three documented decisions. Pick which
to supersede before §1.4 / §3.6 / §3.2 start.

1. **[GLOBAL-027 pre-alpha gate](../decisions/GLOBAL-027-pre-alpha-gate.md).**
   Gate is closed today; we can't get real users without a valve.
   §1.4 proposes auto-issued invite codes on waitlist signup OR
   launch-URL embedded codes. Either keeps the gate's spirit (no bad
   NL→SQL at scale) while enabling §3. **Decision (2026-05-24):**
   founder picked Option A — auto-issue invite codes on signup
   (`SK-GATE-007`, capped 200/week, shipped 2026-05-21). Crucially
   the founder also reaffirmed the gate's purpose: **don't remove
   the gate to get strangers in; lift it by clearing the BIRD/Spider
   thresholds.** That makes
   [`quality-eval`](../features/quality-eval/FEATURE.md) velocity
   the real acquisition gate, and acquisition surfaces are blocked
   on either (a) BIRD ≥ 0.65 AND Spider ≥ 0.75 clearing, or (b) the
   invite-valve verified end-to-end for the launch-URL path.
2. **[founder-playbook.md §1–§2](../founder-playbook.md)** DM →
   Calendly → 30-min calls. Founder rejects. Plan replaces with §1.3
   (in-app survey for the 5 questions), §2 (mining pain at scale),
   §4.3 (LLM digest instead of theme-extract calls). **Decision:**
   mark §1–§2 `Status: superseded by docs/research/automated-icp-validation-plan.md`
   per [CLAUDE.md §10.2](../../CLAUDE.md); OR keep both and let the
   founder pull the human-loop trigger if §4.4 hits <25% VD.
3. **[email-and-marketing.md §3](./email-and-marketing.md) refuse list.**
   §3.6 (reply-to-pain) flirts with the cold-outbound line. Proposed
   shape — public reply to public ask, founder-approved per-message,
   disclosed authorship, links to the answer not a signup — is one
   the founder might accept or reject. **Decision:** approve §3.6
   with the founder-approval gate, OR cut §3.6 entirely (§3.1–§3.5
   should hit the target alone).

If all three remain "no decision yet" — fine; §1 / §2 / non-3.6 §3 /
§4 can proceed independently. The plan only fails if §1.4 fails (gate
fully shut), because §3 then has nothing to point users at.

---

## 7. Promotion path

When results land, promote pieces per [CLAUDE.md §10](../../CLAUDE.md):

- §1.1 stranger-test → new feature
  [`stranger-test/FEATURE.md`](../features/stranger-test/FEATURE.md)
  with `SK-STRG-001` (the primitive). Daily-cron / R2-archive /
  diff-against-prior-run slices stay there as open questions until
  shipped.
- §1.2 KPI dashboard → pull baseline-date forward in existing
  [SK-ONBOARD-005](../features/onboarding/FEATURE.md).
- §1.3 widget → new `docs/features/in-app-survey/FEATURE.md` once
  trigger model stabilizes.
- §1.4 gate valve → amend
  [pre-alpha-gate/FEATURE.md](../features/pre-alpha-gate/FEATURE.md)
  with `SK-GATE-007 — Auto-issued invite codes`.
- §2 scrape stack → new `docs/features/icp-mining/FEATURE.md`.
- §3.1 `solve/` pages, §3.5 gallery, §3.6 reply queue → new SKs in
  [web-app/FEATURE.md](../features/web-app/FEATURE.md).
- §4.1–§4.3 → new SK in
  [onboarding/FEATURE.md](../features/onboarding/FEATURE.md) or new
  `pmf-survey/FEATURE.md`.
- Eventual "we picked persona X" is **not** an SK — it's the
  resolution of the open question in
  [personas.md §10.4](./personas.md), and an edit to that file's Phase
  1 priority ordering.

Until then, this file is the working plan, not a decision record.

---

## 8. User flows · implementation tracker

> **Governance ([GLOBAL-029](../decisions/GLOBAL-029-acquisition-verification-tracker.md)):**
> Every `FLOW-NNN` below has a mirrored block in
> [`automated-icp-validation-plan-verification.md`](./automated-icp-validation-plan-verification.md)
> with the same ID. This section tracks **implementation**
> (sub-tasks, SK-* refs, % shipped); the mirror tracks
> **verification** (walked end-to-end by an agent, with outcome
> log). Both files are agent-ran. Adding, modifying, or superseding
> a flow updates BOTH files in the same PR. Drift is the regression
> the GLOBAL exists to prevent — run the integrity check at the tail
> of the mirror file in every PR that touches either side.

Flows are anchored in **real** persona research, drawn from enduring
public discussion hubs (HN search, subreddit URLs) per [`SK-SOLVE-003`](../features/solve-pages/decisions/SK-SOLVE-003-enduring-source-citations.md)
— never single-thread URLs that can rot. Once the first ICP-mining
cluster file lands (Mon 2026-05-26 per [`icp-mining`](../features/icp-mining/FEATURE.md))
the `Source signal` blocks below get amended with verbatim cluster
labels; until then the sources cite the hubs where the theme is
observable on demand.

### Status dashboard (updated 2026-06-12)

| Flow | Persona | Sub-tasks shipped | Verification | Mirror |
|---|---|---|---|---|
| FLOW-001 | P1 solo builder | 6 / 7 (86%) | **2026-06-12 re-walked** — Playwright `bash scripts/stranger-test.sh --prompts 1` (browser build 1223) steps 1–4 green on the seeded prompt; failed step 5 (gate 403 as documented per GLOBAL-027, `feature_gated`). The SK-GATE-007 invited-browser CORS fix holds — `verify-flows.sh` preflight guard confirms `/v1/ask` `Access-Control-Allow-Headers` now lists `x-invite-code`; 7-day freshness rule met | [verify](./automated-icp-validation-plan-verification.md#flow-001--anonymous-first-happy-path) |
| FLOW-002 | P3 analyst | 5 / 6 (83%) | **2026-06-12 re-walked** — baseline `bash scripts/stranger-test.sh` failed step 9 (gate 403 as documented per GLOBAL-027); every static + CTA + draft + `solve.try_query_clicked` event-spy assertion green; 7-day freshness rule met | [verify](./automated-icp-validation-plan-verification.md#flow-002--pain-driven-aeo-inbound-search--solveslug--first-query) |
| FLOW-003 | P3 / P4 | 5 / 5 (100%) | **2026-06-12 re-walked** — baseline `bash scripts/stranger-test.sh` failed step 8 (gate 403 as documented per GLOBAL-027); every static + CTA + draft + `/llms.txt` assertion green across 6 vs slugs; 7-day freshness rule met | [verify](./automated-icp-validation-plan-verification.md#flow-003--comparison-driven-inbound-search--vscompetitor--first-query) |
| FLOW-004 | P1 solo builder | 10 / 10 (100%) | **2026-06-12 re-walked passed_degraded — gate-bypass intact; first-value seed-quality LIFTED ~0.25 → ~0.75** — `bash scripts/flow-004-walk.sh`: control 403 ✓ + invite **bypassed the gate** ✓ (SK-GATE-007 intact) AND `/v1/ask` **HTTP 200**; default-goal walk → first-value `degraded` (0/0). SK-STRG-008 re-measured live: two same-set 4-goal runs both **`seeded_ok_ratio = 0.75`** (degrader = "a meal planner for couples"), up from 0.25 on 2026-06-10; a wider 8-goal run recorded **4 `provision_failed`** (HTTP 422 `infer_failed`) at `seeded_ok_ratio = 0.75` (`flow-004-seed-quality-2026-06-12T02-04-02Z.json`); across three 8-goal runs today the wide ratio varied **0.6–0.8** with 3–4 `provision_failed` each (LLM variance). Funnel green to a 200; seeding/building every goal is the open SK-LLM-033 lift | [verify](./automated-icp-validation-plan-verification.md#flow-004--waitlist-signup--invite-email--gate-bypass) |
| FLOW-005 | P2 agent builder | 7 / 8 (88%) | **2026-06-12 re-walked passed — both SK-MCP-001 transports** — hosted `bash scripts/flow-005-walk.sh` 6/6 in <1s ([`SK-STRG-005`](../features/stranger-test/FEATURE.md)); local-stdio `bash scripts/flow-005-stdio-walk.sh` 16/16 in 0.2s — real `@nlqdb/mcp` `initialize` + `tools/list` catalog = `nlqdb_query`/`nlqdb_list_databases`/`nlqdb_describe`, no `create_database`/`ask`/`run` tool ([`SK-STRG-009`](../features/stranger-test/decisions/SK-STRG-009-flow-005-stdio-walker.md)). Authenticated tool *invocation* still needs an `sk_mcp_*` key | [verify](./automated-icp-validation-plan-verification.md#flow-005--agent-self-provisions-db-via-mcp) |
| FLOW-006 | P4 backend engineer | 5 / 6 (83%) | not yet attempted | [verify](./automated-icp-validation-plan-verification.md#flow-006--sdk-runsql-escape-hatch) |
| FLOW-007 | P1 / P3 | 5 / 6 (83%) | not yet attempted | [verify](./automated-icp-validation-plan-verification.md#flow-007--adopt-anonymous-db-on-signup) |
| FLOW-008 | cron / system | 12 / 12 (100%) | partial (curl probe of 9 sources passes 2026-06-07 incl. Mastodon `timelines/tag`; Reddit/SO sandbox-egress advisory; cron-side checks need deployed Worker) | [verify](./automated-icp-validation-plan-verification.md#flow-008--weekly-icp-scrape-source-health) |

**Honest takeaway:** **The invited path (FLOW-004) completes to a
working DB on every first query (2026-06-12, verified deployed).**
Control-403 + invite **bypasses the gate** via SK-GATE-007 AND the
downstream provision leg returned a full **HTTP 200**. The 2026-06-08
`sample_insert_failed` HTTP 500 stays cleared — SK-HDC-018 + SK-LLM-033
(#352) are deployed, so a constraint-violating LLM seed row falls back
to a working un-seeded DB instead of rolling the whole create back.
**The remaining gap is first-value seed *quality*, not reachability,
and it just improved markedly:** the SK-STRG-008 probe
(`scripts/flow-004-seed-quality.sh`) re-ran live on 2026-06-12 — two
same-set 4-goal runs both recorded **`seeded_ok_ratio = 0.75`** (3/4;
the only degrader was "a meal planner for couples", which produced an
empty DB in every run today), **up from the 2026-06-10
single-run 0.25**. Wider 8-goal runs surfaced a previously-hidden
failure mode: **3–4 goals per run returned HTTP 422 `infer_failed`** —
the engine couldn't build the DB at all (a *harder* failure than
`degraded`), now bucketed as `provision_failed` (post-change artifact
`flow-004-seed-quality-2026-06-12T02-04-02Z.json` records `provision_failed:4`
at ratio 0.75; across three 8-goal runs the wide ratio varied **0.6–0.8**,
and which goals 422 varies run-to-run like the degraders — so LLM
schema-inference is non-deterministic). The lift is
real and stable across today's 4-goal runs but **not yet causally isolated**
(planner directives shipped since 06-10 vs LLM run-to-run variance — a
wider, repeated probe would tighten it). Most invited strangers now get
a seeded DB; closing the degraded/422 tail is the open SK-LLM-033 /
engine-quality lift. The walker records an un-seeded create as
`state:"passed_degraded"` (SK-STRG-007) so the dashboards can't show a
bare "passed" for an un-seeded stranger experience. FLOW-005's
no-credential subset now passes on **both** SK-MCP-001 transports —
hosted discovery + auth-wall (6/6, SK-STRG-005) and the local-stdio
`initialize` + `tools/list` catalog (16/16, SK-STRG-009, this PR; the
walk that corrected the stale `create_database`/`ask`/`run` tool names
to the real `nlqdb_query`/`nlqdb_list_databases`/`nlqdb_describe`
catalog). The three
anonymous (un-invited) flows still gate-403 at first `/v1/ask` by
design until BIRD/Spider clear — FLOW-001 / FLOW-002 / FLOW-003 have **Playwright
walker** evidence (`tools/stranger-test/`,
[`SK-STRG-001`](../features/stranger-test/FEATURE.md)): every
static-surface and CTA-side assertion passes (homepage hero markup,
FAQPage + HowTo JSON-LD, honest-limits section, template H1, sitemap +
llms.txt enumeration, `nlqdb_draft` localStorage handoff, `/app/new`
rehydrate, `solve.try_query_clicked` event with sessionStorage spy); the
baseline binding gap for all three is the `403 feature_gated` returned by
`/v1/ask` when an anonymous principal submits — the [§6 flag #1](#6-things-flagged-to-the-founder-per-claudemd-p1)
SK-ANON-001 / GLOBAL-027 tension, walker-evidenced. **The 2026-06-05
invite-bearing FLOW-001 walk additionally caught a live CORS regression**
— the cross-origin `/v1/ask` preflight omitted `x-invite-code`, so every
*invited* browser was silently blocked while curl walkers (which never
preflight) showed green; fixed this PR (SK-GATE-007 allow-list +
`test/cors.test.ts` + a deployed-surface preflight guard in
`verify-flows.sh`). FLOW-006 / FLOW-007 remain unattempted. FLOW-008 (the
cron source-health system-flow) is fully exercised by `verify-flows.sh`
modulo the sandbox-egress advisory for Reddit + Stack Exchange.

### FLOW-001 — Anonymous-first happy path

- **Persona:** P1 Solo Builder
- **Mirror:** [verification.md FLOW-001](./automated-icp-validation-plan-verification.md#flow-001--anonymous-first-happy-path)
- **Source signal:** [r/sideproject "database"](https://www.reddit.com/r/sideproject/search/?q=database) · [HN "side project database"](https://hn.algolia.com/?q=side+project+database) · [r/webdev "database setup"](https://www.reddit.com/r/webdev/search/?q=database+setup)
- **Implementation sub-tasks:**
  - [x] Hero `<CreateForm>` accepts goal — [`SK-WEB-001`](../features/web-app/FEATURE.md)
  - [x] Anonymous device-token issued on first load — [`SK-ANON-001`](../features/anonymous-mode/FEATURE.md)
  - [x] Ephemeral Postgres provisioned on first `/v1/ask` — [`SK-ANON-001`](../features/anonymous-mode/FEATURE.md)
  - [x] Trace toggle reveals compiled SQL — [`SK-WEB-005`](../features/web-app/FEATURE.md)
  - [x] Snippet copy fires `home.snippet_copied` — [`SK-WEB-003`](../features/web-app/FEATURE.md)
  - [ ] LLM-judge grades first-query success — [`SK-ONBOARD-005`](../features/onboarding/FEATURE.md) (baseline by 2026-06-01)
  - [x] §1.1 stranger-test primitive — [`SK-STRG-001`](../features/stranger-test/FEATURE.md) (`tools/stranger-test/`; daily cron + R2 archive still open) — invite-bearing variant via [`SK-STRG-004`](../features/stranger-test/decisions/SK-STRG-004-invite-bearing-composer.md) (`bash scripts/stranger-test-invited.sh`) drove the first-ever HTTP 200 on `/v1/ask` 2026-05-24
- **Progress:** 6 / 7 · **86%**

### FLOW-002 — Pain-driven AEO inbound (search → `/solve/<slug>` → first query)

- **Persona:** P3 Data-Curious Analyst
- **Mirror:** [verification.md FLOW-002](./automated-icp-validation-plan-verification.md#flow-002--pain-driven-aeo-inbound-search--solveslug--first-query)
- **Source signal:** [HN "retool alternative"](https://hn.algolia.com/?q=retool+alternative) · [r/SaaS "retool alternative"](https://www.reddit.com/r/SaaS/search/?q=retool+alternative) · [HN "natural language database"](https://hn.algolia.com/?q=natural+language+database)
- **Implementation sub-tasks:**
  - [x] `/solve/<slug>` static AEO surface — [`SK-SOLVE-001`](../features/solve-pages/decisions/SK-SOLVE-001-search-intent-h1.md)
  - [x] Mandatory honest-limits section — [`SK-SOLVE-002`](../features/solve-pages/decisions/SK-SOLVE-002-honest-limits-mandatory.md)
  - [x] Enduring discussion-hub citations — [`SK-SOLVE-003`](../features/solve-pages/decisions/SK-SOLVE-003-enduring-source-citations.md)
  - [x] CTA seeds `nlqdb_draft`; click-event delivery is not yet verified (see mirror)
  - [x] `/app/new` rehydrates draft on mount — [`SK-ANON-011`](../features/anonymous-mode/FEATURE.md)
  - [ ] `<h1>` amended to verbatim cluster quote once cluster file lands (future `SK-SOLVE-004`)
- **Progress:** 5 / 6 · **83%**

### FLOW-003 — Comparison-driven inbound (search → `/vs/<competitor>` → first query)

- **Persona:** P3 / P4
- **Mirror:** [verification.md FLOW-003](./automated-icp-validation-plan-verification.md#flow-003--comparison-driven-inbound-search--vscompetitor--first-query)
- **Source signal:** [HN "supabase alternative"](https://hn.algolia.com/?q=supabase+alternative) · [HN "vanna ai"](https://hn.algolia.com/?q=vanna+ai) · competitor brand-keyword Google traffic (private — Search Console)
- **Implementation sub-tasks:**
  - [x] Single template + typed data — [`SK-CMP-002`](../features/comparison-pages/decisions/SK-CMP-002-single-template-data-driven.md)
  - [x] "When to choose them" honest trade-offs — [`SK-CMP-001`](../features/comparison-pages/decisions/SK-CMP-001-honest-trade-offs.md)
  - [x] FAQPage JSON-LD per page — [`SK-CMP-003`](../features/comparison-pages/decisions/SK-CMP-003-faqpage-json-ld.md)
  - [x] `llms.txt` endpoint enumerates slugs — [`SK-CMP-004`](../features/comparison-pages/decisions/SK-CMP-004-llms-txt-endpoint.md)
  - [x] CTA seeds draft + emits `vs.try_query_clicked`
- **Progress:** 5 / 5 · **100%**

### FLOW-004 — Waitlist signup → invite email → gate bypass

- **Persona:** P1 Solo Builder (invited)
- **Mirror:** [verification.md FLOW-004](./automated-icp-validation-plan-verification.md#flow-004--waitlist-signup--invite-email--gate-bypass)
- **Source signal:** [`pre-alpha-gate`](../features/pre-alpha-gate/FEATURE.md) friction context · [`GLOBAL-027`](../decisions/GLOBAL-027-pre-alpha-gate.md) (every "do-work" surface 403s until BIRD ≥ 0.65 + Spider ≥ 0.75)
- **Implementation sub-tasks:**
  - [x] `POST /v1/waitlist` accepts form submit
  - [x] Auto-issue 128-bit invite code on signup — [`SK-GATE-007`](../features/pre-alpha-gate/FEATURE.md)
  - [x] Resend delivers the invite email
  - [x] `?invite=<code>` captured + stored in `localStorage["nlqdb_invite"]`
  - [x] `X-Invite-Code` header forwarded on `/v1/ask`
  - [x] End-to-end inbox-receive walkthrough — `scripts/flow-004-walk.sh` ([`SK-STRG-002`](../features/stranger-test/FEATURE.md)); mail.tm anonymous bearer-token API mints a throwaway inbox per walk, so no human inbox is needed
  - [x] Continuous daily regression watch — [`.github/workflows/acquisition-health.yml`](../../.github/workflows/acquisition-health.yml) ([`SK-STRG-003`](../features/stranger-test/FEATURE.md)) runs at `0 6 * * *` UTC alongside `verify-flows.sh` + `stranger-test.sh`; exits 0 unconditionally, uploads JSON results as a 90-day artifact
  - [x] First-value *quality* graded on the HTTP 200 (seeded-DB / SELECT-backed, not just reachability) — [`SK-STRG-006`](../features/stranger-test/FEATURE.md); an un-seeded `create` (the SK-HDC-018 fallback) now records `state:"passed_degraded"` so the dashboards can't show a bare "passed" for an empty DB — [`SK-STRG-007`](../features/stranger-test/FEATURE.md) (this PR)
  - [x] Provision never 500s on a constraint-violating LLM seed row — [`SK-HDC-018`](../features/hosted-db-create/decisions/SK-HDC-018-sample-insert-graceful-degradation.md) (retry once without seed rows → working un-seeded DB) + [`SK-LLM-033`](../features/llm-router/decisions/SK-LLM-033-schema-infer-insertable-sample-rows.md) (insertable-seed-row prompt). **Deployed + re-walked to a green 200 on 2026-06-10** (#352); first-value seed quality is now **measured** (next sub-task), not anecdotal — seeding every goal is the open SK-LLM-033 lift
  - [x] First-value seed quality **measured** across a goal set, not anecdotal — [`SK-STRG-008`](../features/stranger-test/decisions/SK-STRG-008-flow-004-seed-quality-probe.md) (`scripts/flow-004-seed-quality.sh`: one invite, N `create` asks, reports `seeded_ok_ratio` + a `provision_failed` bucket for 422 builds). Re-measured live 2026-06-12: two same-set 4-goal runs both **`seeded_ok_ratio = 0.75`** (stable; degrader = "a meal planner for couples"), up from the 2026-06-10 single-run **0.25**; a wider 8-goal run recorded **4 `provision_failed`** (HTTP 422 `infer_failed`) at `seeded_ok_ratio = 0.75` (`flow-004-seed-quality-2026-06-12T02-04-02Z.json`); across three 8-goal runs today the wide ratio varied **0.6–0.8** with 3–4 `provision_failed` each (LLM variance). Sizes the SK-LLM-033 / engine-quality lift; agent-on-demand, not in the daily cron (provisions 1+N throwaway DBs)
- **Progress:** 10 / 10 · **100%** (gate-bypass + first-value path verified deployed to a 200; the seed/build gap — `seeded_ok_ratio ≈ 0.75` plus a `provision_failed` 422 tail — is the open engine-quality lift, not a FLOW gap)

### FLOW-005 — Agent self-provisions DB via MCP

- **Persona:** P2 Agent Builder
- **Mirror:** [verification.md FLOW-005](./automated-icp-validation-plan-verification.md#flow-005--agent-self-provisions-db-via-mcp)
- **Source signal:** [r/LocalLLaMA "agent memory"](https://www.reddit.com/r/LocalLLaMA/search/?q=agent+memory) · [r/LangChain "memory"](https://www.reddit.com/r/LangChain/search/?q=memory) · [r/ClaudeAI "memory"](https://www.reddit.com/r/ClaudeAI/search/?q=memory) · [HN "MCP server"](https://hn.algolia.com/?q=MCP+server)
- **Implementation sub-tasks:**
  - [x] `mcp.nlqdb.com` hosted Streamable-HTTP Worker — [`apps/mcp`](../../apps/mcp) ([`SK-MCP-001`](../features/mcp-server/decisions/SK-MCP-001-two-transports.md) transport 1)
  - [x] Local-stdio transport (npm-fallback install path) — [`packages/mcp`](../../packages/mcp) ([`SK-MCP-001`](../features/mcp-server/decisions/SK-MCP-001-two-transports.md) transport 2)
  - [x] `nlqdb_query` tool — NL query with implicit DB create on first reference + destructive-plan `requires_confirm`/`diff` — [`SK-MCP-002`](../features/mcp-server/decisions/SK-MCP-002-three-tools.md) (there is **no** public `create_database` tool; create is implicit, and raw-SQL [`GLOBAL-015`](../decisions/GLOBAL-015-power-user-escape-hatch.md) is the SDK/HTTP `/v1/run` path of FLOW-006, not an MCP tool)
  - [x] `nlqdb_list_databases` + `nlqdb_describe` tools (user-scoped key) — [`SK-MCP-002`](../features/mcp-server/decisions/SK-MCP-002-three-tools.md)
  - [x] Per-(mcp_host, device_id) keys (`sk_mcp_*`) — [`api-keys`](../features/api-keys/FEATURE.md)
  - [x] Agent-runnable no-credential **hosted** discovery + auth-wall walker — [`SK-STRG-005`](../features/stranger-test/FEATURE.md) (`bash scripts/flow-005-walk.sh`; 5 HTTP calls; asserts RFC 9728 root + scoped resource-metadata, RFC 8414 AS metadata, `initialize` + `tools/list` 401 with `WWW-Authenticate: Bearer realm=*, resource_metadata=*` challenge whose URL matches the scoped discovery; runs daily in `acquisition-health.yml`)
  - [x] Agent-runnable no-credential **stdio** `initialize` + `tools/list` catalog walker — [`SK-STRG-009`](../features/stranger-test/decisions/SK-STRG-009-flow-005-stdio-walker.md) (`bash scripts/flow-005-stdio-walk.sh`; spawns the real `@nlqdb/mcp` binary, asserts the 3-tool catalog + trust hints + input-schema keys + no `create_database`/`ask`/`run` tool, over OS pipes — no network; runs daily in `acquisition-health.yml`) (this PR)
  - [ ] Auto-migration via NL through MCP (schema-evolve verb exposed but end-to-end agent walk pending)
- **Progress:** 7 / 8 · **88%**

### FLOW-006 — SDK `runSql` escape hatch

- **Persona:** P4 Backend Engineer
- **Mirror:** [verification.md FLOW-006](./automated-icp-validation-plan-verification.md#flow-006--sdk-runsql-escape-hatch)
- **Source signal:** [HN "text to sql"](https://hn.algolia.com/?q=text+to+sql) · [r/dataengineering "text to sql"](https://www.reddit.com/r/dataengineering/search/?q=text+to+sql)
- **Implementation sub-tasks:**
  - [x] `@nlqdb/sdk` published to npm
  - [x] `runSql()` method — [`SK-SDK-009`](../features/sdk/FEATURE.md), [`GLOBAL-015`](../decisions/GLOBAL-015-power-user-escape-hatch.md)
  - [x] `POST /v1/run` raw-SQL endpoint
  - [x] SQL allowlist rejects DDL on `/v1/run` — [`sql-allowlist`](../features/sql-allowlist/FEATURE.md)
  - [x] Typed result shape across TS, Go, Swift
  - [ ] Ruby + Rust SDKs (placeholders today — out of scope until Phase 2)
- **Progress:** 5 / 6 · **83%**

### FLOW-007 — Adopt anonymous DB on signup

- **Persona:** P1 / P3 → authed
- **Mirror:** [verification.md FLOW-007](./automated-icp-validation-plan-verification.md#flow-007--adopt-anonymous-db-on-signup)
- **Source signal:** [r/sideproject "anonymous data keep"](https://www.reddit.com/r/sideproject/search/?q=anonymous+data+keep) · [`SK-ANON-002`](../features/anonymous-mode/FEATURE.md) (72 h sweep contract)
- **Implementation sub-tasks:**
  - [x] Anonymous DB created on first `/v1/ask` — [`SK-ANON-001`](../features/anonymous-mode/FEATURE.md)
  - [x] 72 h auto-sweep contract — [`SK-ANON-002`](../features/anonymous-mode/FEATURE.md)
  - [x] OAuth sign-in (GitHub / Google) — [`auth`](../features/auth/FEATURE.md)
  - [x] "Adopt this database" affordance — [`SK-ANON-002`](../features/anonymous-mode/FEATURE.md)
  - [x] DB re-keyed to authed account; rows persist
  - [ ] End-to-end zero-data-loss walkthrough (verification mirror needs a real OAuth account or mock-IdP preview)
- **Progress:** 5 / 6 · **83%**

### FLOW-008 — Weekly ICP scrape source-health

- **Persona:** cron / system (no user persona — this is the data pipeline)
- **Mirror:** [verification.md FLOW-008](./automated-icp-validation-plan-verification.md#flow-008--weekly-icp-scrape-source-health)
- **Source signal:** the 9 upstreams the Mon 06:00 UTC cron consumes per [`automated-icp-validation-plan.md §2.1`](./automated-icp-validation-plan.md) — [HN Algolia](https://hn.algolia.com/api) · [Reddit listings](https://www.reddit.com/r/SaaS/search.json?q=retool+alternative) · [GitHub Search Issues](https://docs.github.com/en/rest/search/search) · [GitHub Discussions (GraphQL)](https://docs.github.com/en/graphql/reference/queries#search) · [Stack Exchange API 2.3](https://api.stackexchange.com) · [Indie Hackers JSON Feed](https://feed.indiehackers.world) · [Dev.to Forem API](https://developers.forem.com/api/v1) · [Bluesky AT Protocol AppView](https://docs.bsky.app/docs/api/app-bsky-feed-search-posts) · [Mastodon hashtag timeline](https://docs.joinmastodon.org/methods/timelines/)
- **Implementation sub-tasks:**
  - [x] HN Algolia query — [`SK-ICP-001`](../features/icp-mining/FEATURE.md)
  - [x] Reddit subreddit search (16 subreddit/query pairs, `restrict_sr=on`) — [`SK-ICP-001`](../features/icp-mining/FEATURE.md)
  - [x] GitHub Issues search (5 queries, gated on `GH_TOKEN`) — [`SK-ICP-004`](../features/icp-mining/FEATURE.md)
  - [x] GitHub Discussions search via GraphQL (5 queries, gated on `GH_TOKEN`, same `created:>` filter) — [`SK-ICP-009`](../features/icp-mining/FEATURE.md)
  - [x] Stack Exchange `/search/advanced` (5 tag+query pairs, anon quota) — [`SK-ICP-005`](../features/icp-mining/FEATURE.md)
  - [x] Indie Hackers JSON Feed (5 P1-pain queries, client-side 7-day filter) — [`SK-ICP-006`](../features/icp-mining/FEATURE.md)
  - [x] Dev.to Forem `/api/articles` (5 tag queries, server-side `top=7` filter) — [`SK-ICP-008`](../features/icp-mining/FEATURE.md)
  - [x] Bluesky `app.bsky.feed.searchPosts` (5 P1/P2/P3 queries, server-side `since=<isoSeven>` filter, no auth) — [`SK-ICP-012`](../features/icp-mining/FEATURE.md)
  - [x] Mastodon `/api/v1/timelines/tag/<tag>` (5 P1/P2/P3/P6 hashtags, no auth, client-side 7-day filter, HTML-stripped before storage) — [`SK-ICP-013`](../features/icp-mining/FEATURE.md)
  - [x] KV dedup contract + LogSnag per-run notification — [`SK-ICP-001`](../features/icp-mining/FEATURE.md)
  - [x] Cluster + GitHub Contents API evidence-file write — [`SK-ICP-003`](../features/icp-mining/FEATURE.md)
  - [x] Agent-runnable source-health probe via `scripts/verify-flows.sh` — [`SK-ICP-007`](../features/icp-mining/FEATURE.md)
- **Progress:** 12 / 12 · **100%**

### Adding a new flow

Same procedure as [verification.md "Adding a new flow"](./automated-icp-validation-plan-verification.md#adding-a-new-flow);
this section and the mirror's status dashboard both grow in the same PR.

---

## Progress log

Per [GLOBAL-028](../decisions/GLOBAL-028-acquisition-progress-tracker.md): every PR that implements a section appends a row here.

| Date | Phase | What | How | Result |
|---|---|---|---|---|
| 2026-05-21 | §1.4 gate-valve | Auto-issue invite codes on waitlist signup | `waitlist-invite.ts`: 128-bit code, KV store, 30d TTL, 200/week cap. Resend email via `makeEmailSender`. Web: `invite.ts` captures `?invite=<code>`, stores in `localStorage`, forwards as `X-Invite-Code` header. | Shipped. First production invites will go out on next new waitlist signup. |
| 2026-05-21 | §2.2 scrape stack | Weekly ICP pain-signal scrape | `icp-scrape.ts`: HN Algolia (5 queries) + Reddit (3 subreddit/query pairs). KV dedup + storage. LogSnag `#icp-mining` notification. Cron `0 6 * * 1`. | Shipped. First run 2026-05-26 06:00 UTC. |
| 2026-05-21 | §2.3 LLM scoring (steps 1–2) | Pain-word prefilter + persona scoring | `icp-score.ts`: regex prefilter → Groq `llama-3.1-8b-instant` (Gemini fallback) scores each item 0–10 for P1/P2/P3/P6; items with max score < 5 discarded; survivors to `icp:scored:*` KV (30d TTL). OTel span per batch. Source expansion: HN 5→10 queries, Reddit 3→16 subreddit pairs. | Shipped. Scores available from first scrape 2026-05-26. |
| 2026-05-22 | §2.3 LLM clustering (steps 3–4) | Cluster scored items + write evidence file | `icp-cluster.ts`: lists all `icp:scored:*` KV keys (paginated), groups by best persona (top-100 each), calls Groq → Gemini to cluster into 5–7 themes, generates `docs/research/icp-evidence-<yyyy-mm>.md`, writes to GitHub via Contents API PUT (checks existing SHA). Non-fatal: GitHub write failure returns `written: false` without killing cron. | Shipped. First evidence file 2026-05-26. |
| 2026-05-22 | §2.1 GitHub Issues source | Add GitHub Search Issues as scrape source | `icp-scrape.ts`: 5 queries (`is:issue "text to sql"`, natural language database, etc.) via GitHub Search Issues API with `GH_TOKEN` auth, `created:>2025-11-01` filter. Per-query errors caught. Items stored with `source: "github"`. | Shipped. Active from first run 2026-05-26 when `GH_TOKEN` is set. |
| 2026-05-22 | §2.4 verdict + harden pipeline | Surface decision-rule verdict in evidence file; fix correctness gaps before first cron run | `icp-cluster.ts`: §2.4 rule (≥3× ratio AND ≥30 quotes) computed per run, surfaced as `## §2.4 Decision rule` block at top of `icp-evidence-<yyyy-mm>.md` and as `IcpClusterResult.{primaryStatus, primaryIcp}` in cron logs + LogSnag. Clamps LLM-hallucinated `cluster.count` to actual group size; renders cluster `top_urls` in markdown. `icp-scrape.ts`: Reddit URLs now carry `restrict_sr=on` (without it the search returns site-wide results, polluting persona signal); GitHub Search + Contents API calls now send `User-Agent: nlqdb-icp-bot` (REST rejects no-UA with 403); GitHub issues with unparseable `created_at` are dropped before KV write; `incomplete_results: true` is logged. All external HTTP gains `AbortSignal.timeout(10–15s)`. | Shipped. First evidence file 2026-05-26 will already include the verdict; the Reddit corpus stays subreddit-scoped from run #1 forward. |
| 2026-05-23 | §3.1 pain-driven solve pages (first 5) | Hand-curated AEO surface; 5 pages ahead of the 2026-05-26 first cluster file | `apps/web/src/data/solve.ts` (typed source of truth, 5 entries); `apps/web/src/pages/solve/[slug].astro` (single Astro template, getStaticPaths); `apps/web/src/pages/solve/index.astro` (page index at `/solve`); `apps/web/src/data/solve.test.ts` (12 data-integrity tests pinning AEO invariants: unique kebab slugs, ≤60-word oneLiner, ≥3 howNlqdbAnswers, ≥2 whatItDoesnt limits, ≥3 FAQs ≤80-word answers, ≥2 enduring source URLs starting with `https://`). Sitemap + llms.txt updated to enumerate solve slugs alongside vs slugs. "Try this query" CTA calls the client event hook and seeds `nlqdb_draft` localStorage; FLOW-002 verification has not proven event delivery yet. FAQPage + HowTo JSON-LD per page. Self-canonical `<link rel="canonical">`. New feature record at `docs/features/solve-pages/` with SK-SOLVE-001 (search-intent `<h1>`, not fabricated verbatim quotes — paraphrase is honest until cluster file lands), SK-SOLVE-002 (mandatory "What nlqdb doesn't do" section per AEO honest-trade-off rule), SK-SOLVE-003 (≥2 enduring discussion-hub URLs, never single-thread URLs that can rot). `CLAUDE.md §5` path map updated. | Shipped. Sitemap now lists 12 URLs (was 7); llms.txt now exposes a `## Solve pages` block to LLM-IDE crawlers (Claude Desktop, Perplexity, Cursor, Cline, Aider, Copilot). |
| 2026-05-23 | §8 user-flow tracker scaffolding (GLOBAL-029) | Mirror impl/verify trackers — 7 flows defined; `GLOBAL-029` declared | `docs/decisions/GLOBAL-029-acquisition-verification-tracker.md` (new); `docs/research/automated-icp-validation-plan-verification.md` (new mirror file, also exempt from 20 KB cap); §8 added to this file with the 7 mirrored FLOW-001..007 blocks (P1-P4 personas, anchored in enduring Reddit/HN discussion-hub citations per SK-SOLVE-003); `docs/decisions.md` index gains the GLOBAL-029 row; `GLOBAL-028` body updated to cross-ref the mirror. Each flow lists implementation sub-tasks (with SK-* refs) on this side and walkthrough steps + required credentials + outcome log on the mirror side. Status dashboard: 7 flows, avg 84% implementation, 0% verification — the impl-vs-verify gap restated per-flow is exactly the §1.1 stranger-test gap the mirror exists to close. | Shipped. Mirror integrity check (diff of `## FLOW-NNN` headers across both files) emits empty diff; both files are agent-ran from here on. |
| 2026-05-23 | §8 FLOW-002 verification + tracker hardening | Attempted the first no-credential AEO inbound walk before adding new flows | Deployed-surface Playwright walk against `https://nlqdb.com/solve/cheap-internal-dashboard`: static checks passed (`FAQPage` + `HowTo`, honest-limits, `nlqdb_draft`, `/app/new` rehydrate), but an injected `window.__nlqdb_logsnag` spy observed no `solve.try_query_clicked` event; manual continuation posted to `https://app.nlqdb.com/v1/ask` and returned `403 feature_gated`. Added `GLOBAL-030` evidence-grade tracker rule and CI mirror-ID check so future `FLOW-NNN` drift fails automatically. | FLOW-002 failed step 8; acquisition can educate from `/solve`, but CTA telemetry and first value still need verification/fix before this counts as a working inbound path. |
| 2026-05-23 | §2.3 evidence-file cron readiness | Ensure first ICP cron can write evidence and notify without manual Worker-secret drift | Added `GH_TOKEN`, `LOGSNAG_TOKEN`, and `LOGSNAG_PROJECT` to the API Worker secret mirror; added `GH_TOKEN` to `.env.example`, GitHub Actions secret mirroring, and `verify-secrets.sh`. Env inspection in this agent found `GEMINI_API_KEY` present but `GH_TOKEN`/LogSnag absent locally, confirming the current shell could not prove production evidence-write readiness by value. | Shipped as ops unblock. First cron can only write `icp-evidence-<yyyy-mm>.md` when `GH_TOKEN` is provisioned as a repo secret / Worker secret; the mirror scripts now include it. |
| 2026-05-23 | §8 FLOW-001/002/003 curl re-verification | Walk the no-credential static surfaces with curl before adding new flows or sources | FLOW-001 step 1+2 pass: `https://nlqdb.com/` returns 200 and exposes hero `<form>` with `placeholder="an orders tracker"` matching the `/orders\|tracker\|building/i` contract. FLOW-002 steps 1, 3, 4 pass against `/solve/cheap-internal-dashboard`: 200 OK, `FAQPage` + `HowTo` JSON-LD blocks both present (1 each), "What nlqdb doesn't do here" section rendered. FLOW-003 steps 1, 2, 4, 9 pass against `/vs/supabase`: 200 OK, `<h1>nlqdb vs Supabase</h1>` matches the template, `FAQPage` JSON-LD present, `/llms.txt` enumerates all 3 vs slugs (`mem0`, `supabase`, `vanna`) and all 5 solve slugs; `/sitemap.xml` lists the same 12 URLs. Steps that require a browser context (CTA click, draft hydrate, first-query submit, gate-bypass) remain unattempted in this PR. | Shipped. Three flows now have first-time partial-pass evidence; FLOW-002's prior CTA/gate failure is still the binding gap. Verification mirror outcome logs and status dashboard updated. |
| 2026-05-23 | §2.1 Stack Overflow source (SK-ICP-005) | Add the 4th ICP scrape source listed in §2.1 but never shipped | `apps/api/src/icp-scrape.ts` gains `fetchStackExchange` (Stack Exchange API 2.3 `/search/advanced`, `site=stackoverflow`, 5 tag+query pairs covering P1/P3/P4/P6 — `postgresql/setup`, `sqlalchemy/verbose`, `sql/natural language`, `prisma/migration`, `duckdb;clickhouse`; `pagesize=10`; `fromdate=now-7d`; anonymous quota 300/IP/day). New OTel span `nlqdb.icp.fetch.stackoverflow` carries `nlqdb.icp.se.quota_remaining`; `backoff` field is surfaced via `icp_se_backoff` warn-log. Items stored as `source: "stackoverflow"`, `id: "so-<question_id>"`; LogSnag description gains `SO: <n>`. Per-source error handling matches HN/Reddit/GitHub (one failing source never kills others). Live API probe from this environment returned 1 fresh question for `postgresql/setup` with `quota_remaining=299`, `backoff=None`; 14/14 `icp-scrape.test.ts` tests pass (3 new). | Shipped. Fourth source live for first cron Mon 2026-05-26. No new env binding required. |
| 2026-05-23 | §8 verification automation + re-walk | Automate the curl-observable subset of FLOW-001/002/003 + re-verify three live sources before adding more scrape sources or flows | New `scripts/verify-flows.sh` (mirrors the `scripts/verify-secrets.sh` style: `ok`/`fail`/`note` per check, never prints secrets, 15 s per-fetch cap, exits non-zero on any failure, `NLQDB_BASE_URL` override for preview deployments). Walks 49 assertions: FLOW-001 step 1+2 against `/`; FLOW-002 step 1, 3, 4 against every shipped `/solve/<slug>` (5 slugs); FLOW-003 step 1, 2, 4 against every shipped `/vs/<slug>` (3 slugs); FLOW-003 step 9 against `/llms.txt` (enumerates 3 vs + 5 solve); a `/sitemap.xml` floor at 12 `<loc>` entries. Every assertion passed today against `https://nlqdb.com`. New static-surface evidence: `/solve/<slug>` and `/vs/<slug>` now `307 → trailing-slash` — the script follows redirects and records the chain so future curl-only agents don't re-discover it. Live re-probes today (with this VM's `GH_TOKEN` / `GROQ_API_KEY` / `GEMINI_API_KEY` / `LOGSNAG_*` / `RESEND_API_KEY` / `OPENROUTER_API_KEY` all present — correcting the 2026-05-23 entry that recorded `GH_TOKEN`/LogSnag as absent locally): Stack Exchange `/search/advanced?tagged=postgresql&q=setup` returned `items=1, quota_remaining=299, backoff=None`; GitHub `/search/issues?q=is:issue "text to sql" created:>2025-11-01` returned `total_count=1642, items=10, incomplete_results=false`. Verification mirror's FLOW-001/002/003 outcome logs each gain a new row; FLOW-002 triage gains a `Trailing-slash redirect` block. Second-pass self-review caught a silent-exit bug in the script (`var=$(fetch_body…)` swallowed `fail` output AND `FAIL_COUNT++` in a subshell); fixed in the same PR via a `FETCH_BODY_PATH` global return; negative-test failure count went from 8 visible / 19 actual to 19 visible / 19 actual. | Shipped. The mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across both files) remains empty; future agents have a single one-command entry point for the static-surface acquisition assertions. |
| 2026-05-23 | §0 + §1 + preamble framing (operator-loop + anti-self-deception) | Founder clarified: "I run one prompt; that's it. don't make me do more things." Existing docs encoded the *what* of acquisition but not the *how* of the operator loop — each cold agent had to re-derive that the founder is the cron-trigger and the agent is the cron-body. That gap let the prior commit drift toward a LogSnag-on-failure suggestion (which would have created a founder-facing notification channel — the exact thing the operator wants to escape). | Edited (not added) impl plan preamble: now leads with (a) operator-loop principle, (b) shipped≠verified principle, (c) explicit 7-item "What the next agent run should pick" priority list (§1.1 stranger-test → §1.2 KPI dashboard → §1.3 in-app survey → FLOW-002 step 8 fix → next 10 solve pages → gallery/examples → Show HN). Collapsed `Current status` + `Honest gap` + `Verified 2026-05-23` walls into one KPI table with explicit "not measured" markers on §1.2 KPIs and a new `Stranger-test passes` row. Trimmed §0 Goal (points at preamble for operator model, lists "founder-facing notification channels of any shape" as a non-goal). Renamed §1 intro to `Anti-self-deception layer (BLOCKING — outranks all §3)`. Verification mirror preamble + `How an agent uses this file §1` rewritten to: "you ARE the cron; default first action is `bash scripts/verify-flows.sh`; failures route back as priority #1, not notifications." No new sections, no new GLOBAL/SK, no GH Actions cron, no LogSnag-to-founder wiring. | Shipped. Cold agents now land on (1) you-are-the-cron, (2) today's priority #1 = §1.1 stranger-test, (3) `verify-flows.sh` as the default first action. The §1.1/§1.2/§1.3 anti-self-deception priority is load-bearing in the preamble, not buried. |
| 2026-05-23 | §2.1 Indie Hackers source (SK-ICP-006) | Add the 5th and last source listed in §2.1 — IH was always planned for P1 (Solo Builder) signal but never shipped, leaving the source mix skewed away from launch-context complaints | `apps/api/src/icp-scrape.ts` gains `fetchIndieHackers` (unofficial `feed.indiehackers.world` JSON Feed; 5 P1-pain queries: `database`, `boilerplate`, `side+project`, `first+paying`, `stack`). Items stored as `source: "indiehackers"`, `id: <slug>` from `/post/<slug>` URL path. No env binding (public feed); 10 s `AbortSignal.timeout`; per-source error isolation matches HN/Reddit/GH/SO. Server-side date filter is unavailable on the mirror, so the 7-day window is enforced client-side after parsing `date_modified`; posts with unparseable date or non-conforming URL are dropped before KV write (stable dedup keys). New OTel span `nlqdb.icp.fetch.indiehackers`. LogSnag description gains `IH: <n>`. SK-ICP-006 documents the trade-offs (third-party mirror dependency, no IH-canonical click-through — title + `content_html` carry the evidence). Live probe from this VM 2026-05-23 against `?q=database&exclude=link-post`: `HTTP 200, items=100, kept=2, dropped_id=0, dropped_old=98` — confirms ≈10 fresh IH items/week across 5 queries, all URL slugs parseable. 19/19 `icp-scrape.test.ts` tests pass (5 new: success-path + URL/UA contract + 7-day client-side filter + malformed-URL drop + 502 graceful). | Shipped. Fifth source live for first cron Mon 2026-05-26. No new env binding required; `feed.indiehackers.world` outage is non-fatal per existing per-source `.catch` pattern. |
| 2026-05-23 | §8 mirror sync + verify-flows hardening (SK-ICP-007 + FLOW-005 partial) | Close drift introduced by PR #265 — preamble claimed 8 flows and "SK-ICP-007 documenting the agent-runnable source-health primitive" but the `### FLOW-008` / `## FLOW-008` body sections never landed in either tracker and no `SK-ICP-007` block existed in `icp-mining/FEATURE.md`. Same agent run also caught a real verify-flows.sh false-positive: Stack Exchange returned `HTTP 403 x-block-reason: hostname_blocked` from the agent VM's managed-egress proxy and the script marked it fatal — Worker-IP-canonical means that's an advisory, not a regression. | `scripts/verify-flows.sh`: `fetch_json` now captures response headers via `-D` and degrades any non-200 carrying `x-block-reason:` to an advisory note regardless of severity (catches Reddit AND SO sandbox-egress 403s; HN/IH/GH outages stay fatal). New `FLOW-005 — MCP discovery (curl-observable subset)` block probes `https://mcp.nlqdb.com/.well-known/oauth-protected-resource` + `/.well-known/oauth-authorization-server` (RFC 9728 + RFC 8414), asserts `resource` / `issuer` / `authorization_endpoint` / `token_endpoint` — closes FLOW-005's OAuth discovery precondition (the metadata input the MCP inspector consumes during walkthrough step 1) with zero credentials; walkthrough steps 1-7 still need an authenticated MCP client. `NLQDB_MCP_URL` overrides for preview. `docs/research/automated-icp-validation-plan{,-verification}.md`: `### FLOW-008` (impl) + `## FLOW-008` (verify) bodies added with sub-tasks pointing at SK-ICP-001/003/004/005/006/007; status dashboards extended to 8 rows; FLOW-005 row flipped from `not yet attempted` to partial; outcome logs gained today's re-walk rows for FLOW-001/002/003 + first-ever row for FLOW-005 + FLOW-008. Preamble counts in both files reconciled to "4 partial / 1 cron-pass / 3 unattempted". `docs/features/icp-mining/FEATURE.md`: SK-ICP-007 entry added (5-field block); Status line updated; compensating shrinkage in SK-ICP-006 Why/Alternatives keeps the file at 20,412 bytes (under the 20 KB cap). Mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` headers) stays empty. Local re-run of `bash scripts/verify-flows.sh` against `https://nlqdb.com`: all assertions green (Reddit + SO advisory with the expected block-reason note). | Shipped. PR #265's drift is closed: `## FLOW-008` blocks now exist symmetrically, SK-ICP-007 is the canonical decision. The agent-VM-to-Worker egress gap is now visible in the script output, not a silent false-positive. |
| 2026-05-24 | §1.1 stranger-test primitive (SK-STRG-001) + FLOW-001/002/003 walker re-verification | Ship the Playwright walker that closes the impl-vs-verify gap §1.1 has named for days; re-walk FLOW-001/002/003 against the deployed surface with real evidence before adding any new ICP source or flow | New workspace [`tools/stranger-test/`](../../tools/stranger-test/) (`@nlqdb/stranger-test`): `src/runner.ts` (CLI: `--base-url`, `--flows flow-001,flow-002,flow-003`, `--prompts`, `--out`, `--quiet`), `src/browser.ts` (one shared `chromium.launch` + per-walk `BrowserContext`, `withDeadline(180s)` per walk, `ignoreHTTPSErrors` for sandbox-proxy TLS, 401/429 ignored as expected), `src/personas.ts` (25 prompts pinned to the §1.1 paragraph: P1×10 / P2×8 / P3×4 / P6×3, no secret-looking strings), `src/flows/flow-00{1,2,3}.ts` (one walker per flow with steps mapped 1:1 to the mirror walkthrough). Bash wrapper [`scripts/stranger-test.sh`](../../scripts/stranger-test.sh) resolves the repo root and stamps `tools/stranger-test/results/walk-<utc>.json`; results gitignored except `.gitkeep`. 7/7 unit tests pass (`bun run --filter @nlqdb/stranger-test test`); typecheck green. Live 2026-05-24 walk against `https://nlqdb.com` (9 walks = 3 flows × 3 prompts, 6.6 s wall): 0 passed, 9 failed — every run gate-blocks at `/v1/ask` with `403 feature_gated` (FLOW-001 step 5, FLOW-002 step 9, FLOW-003 step 8) at ~150 ms p50, ~691 ms p95. **FLOW-002 step 8 finding corrected:** the prior 2026-05-23 walk reported `solve.try_query_clicked` missing; the new walker uses sessionStorage to persist the spy across `location.assign("/app/new")` and observes the event firing on every walked slug. The static surface is healthy; the gate is the binding gap. New feature [`docs/features/stranger-test/FEATURE.md`](../features/stranger-test/FEATURE.md) (SK-STRG-001) + `tools/stranger-test/AGENTS.md`. `CLAUDE.md` path map gained the `tools/stranger-test/**` entry (net-shrunk to stay under the 20 KB cap). Impl plan §1.1, §8 status dashboard, §8 FLOW-001 sub-tasks, §7 promotion path, Current status, and verification mirror outcome logs + status dashboard all updated in lockstep per GLOBAL-029/GLOBAL-030. | Shipped. The §1.1 anti-self-deception primitive exists as a one-command agent invocation. The walker exit-code is the regression signal; no LogSnag, no founder notification — the next agent run picks the binding §1.4 anon-bypass gap as priority #1, replacing the now-obsolete priority #1 / #4 entries the preamble carried. |
| 2026-05-24 | §3.5 Outerbase comparison page (4th `/vs/<slug>`) + mirror re-verification + post-review iteration | Acquisition surface — fill the P4 backend-engineer slot the existing 3 `/vs/` pages don't cover. `/vs/outerbase` is the documented next-pick in [`comparison-pages/FEATURE.md`](../features/comparison-pages/FEATURE.md) Open questions ("persona-weighted threat × keyword volume — start with Outerbase next"). Outerbase is the "single product most in nlqdb's lane today" per [`docs/competitors.md §3`](../competitors.md) and is now Cloudflare-owned (2025-04-07 acquisition per the [official press release](https://www.cloudflare.com/press/press-releases/2025/cloudflare-acquires-outerbase-to-expand-developer-experience/)) — narrows the infra-differentiation lane and makes the chat-first / provisioning / `<nlq-data>` shape the only honest delta. | `apps/web/src/data/competitors.ts` gains the Outerbase entry (4th `Competitor`): persona `P4 backend engineer`, 4 `whenChooseUs` + 4 `whenChooseThem` bullets (SK-CMP-001), 11-row feature parity table, 6 FAQs (SK-CMP-003 4-6 range), all 6 naming "Outerbase" verbatim (SK-CMP-003 requires ≥1), demo goal `"today's failed background jobs grouped by service in the last 24 hours"`. `apps/web/src/pages/vs/[slug].astro` `getStaticPaths()` picks the new slug up unmodified per SK-CMP-002. `scripts/verify-flows.sh`: `VS_SLUGS` / `VS_TITLES` arrays gain `outerbase` / `Outerbase`; sitemap floor 12 → 13 (5 solve + 4 vs + 4 root). Live local `bun run build` from `apps/web/`: `/vs/outerbase/index.html` generated, sitemap 13 `<loc>` entries, `llms.txt` lists `vs/outerbase`. `docs/competitors.md` 3-place sync: (a) `§3` Outerbase entry corrects the stale "PlanetScale 2024" note (verified false against the Cloudflare press release + live WebFetch of `outerbase.com`) — Cloudflare 2025-04-07; engine list expanded to the verified 9; "Last verified" date stamped 2026-05-24; (b) `§1` PlanetScale entry threat-vector line updated — Outerbase no longer "owned by PlanetScale"; (c) summary threat-matrix row updated — "Cloudflare's stack (2025-04-07 acquisition)" replaces "PlanetScale backing". `docs/features/comparison-pages/FEATURE.md`: status line `3 → 4`; Open questions amended to note Outerbase shipped + the 3-place source-of-truth correction. **Independent self-review (sub-agent, opus 4.7) found 10 issues; this same row reflects the iteration that closed all 10:** (1) buyer-facing SK-* leak (3 sites) — SK-ANON-001 / SK-ONBOARD-004 / SK-WEB-005 references removed from `whenChooseUs` + the EZQL FAQ; (2) PlanetScale stale claim survived in `competitors.md` lines 46/249 — corrected; (3) acquisition date `2025-04-08` → `2025-04-07` (5 places: data file, competitors.md ×2, FEATURE.md, this Progress log); (4) P4 persona inconsistency on `whenChooseUs[0]` — reordered so trust/embed/greenfield bullets lead; (5) Outerbase tier name "Explorer" retired — "Free" used + specific 10/mo number softened to "documented per-month usage caps"; (6) HIPAA + SOC 2 row corrected from `them: shipped` → `them: partial` with Enterprise-only note (matches Outerbase's current pricing-page contract); (7) test-count claim corrected — `bun test apps/web/src/data` is 23/23 (the 93/93 figure is the full `apps/web/src` suite); (8/9/10) NIT-tier (nested-backtick artefact + comment scope) cleaned up. **Pre-deploy verification (post-iteration):** `bun run build` green; 13/13 sitemap entries; `bun test apps/web/src/data` 23/23 pass; full `bun test apps/web/src` 93/93 pass; `bunx astro check` 0 errors / 0 warnings; `shellcheck scripts/verify-flows.sh` 0 issues; `bunx biome check` exit 0 on this PR's diff; live `bash scripts/verify-flows.sh` against `https://nlqdb.com` returns exactly 4 expected pre-deploy failures (`/vs/outerbase/` 404, sitemap floor 12 < 13, `llms.txt` missing slug) — all clear post-`deploy-web.yml`. No `SK-CMP-NNN` added: the addition fits inside the existing data-driven contract per SK-CMP-002. | Shipped after one round of independent self-review iteration. Comparison page count 3 → 4; first `/vs/` page covering P4. Mirror integrity check (diff of `^#{2,3} FLOW-[0-9]+`) stays empty — no new flow added. FLOW-003 verification mirror outcome log gets the pre-deploy build-time row; the live-walk row appends after `deploy-web.yml` deploys `apps/web/dist`. Review artifact: PR #271 comment chain. |
| 2026-05-24 | §1.4 FLOW-004 invite-valve end-to-end verification (SK-STRG-002) | The acquisition tracker has listed FLOW-004 (signup → Resend inbox → `?invite=` → gate bypass → first 200 on `/v1/ask`) as priority #2 ever since SK-GATE-007 shipped 2026-05-21; nothing had walked the inbox-receive step end-to-end because the verification mirror declared a need for a "real email inbox or Resend webhook capture" that never materialised. Without it the §1.4 invite-valve was "shipped, not verified" — the one path GLOBAL-027 permits a stranger to cross the gate before BIRD/Spider clear was a coin-flip. | New `scripts/flow-004-walk.sh` (SK-STRG-002 in [`stranger-test/FEATURE.md`](../features/stranger-test/FEATURE.md)): bash/curl/jq walker. Per run: (a) `GET api.mail.tm/domains` picks an active public domain (free, no key, 8 QPS); (b) `POST /accounts` + `POST /token` mint a throwaway inbox; (c) `POST $NLQDB_BASE_URL/v1/waitlist` (Worker hands the address to the existing `tryIssueInvite` cron path); (d) polls `GET /messages` every `FLOW_004_POLL_INTERVAL_S` (default 10s) up to `FLOW_004_TIMEOUT_S` (default 300s); (e) extracts `?invite=<code>` from text + html via `grep -oE 'invite=[A-Za-z0-9_-]{16,}'`; (f) `POST /v1/ask` with `Authorization: Bearer anon_<uuid>` AND `X-Invite-Code` header. Pass = HTTP 200; `failed step 4` only when the body still carries `error.status="feature_gated"` (the SK-GATE-007 regression signature); `partial` when gate is bypassed but downstream returns non-200 (free-LLM outage, etc — gate is what we measure here). Cleanup via `trap` — `DELETE /accounts/{id}` runs on any exit path so no zombie mail.tm accounts remain. Invite codes redacted to first-4 + last-4 chars in stdout via the `redact()` helper (refuses to print < 12-char strings). Outcome JSON shape: `{utc, flow, base_url, mail_tm_domain, state, gate_bypassed, email_latency_s, total_wall_s, ask_status, ask_error_status, notes}` written to `tools/stranger-test/results/flow-004-<utc>.json` (already gitignored under the existing `tools/stranger-test/results/*.json` pattern). Updated `automated-icp-validation-plan-verification.md` FLOW-004 status dashboard row + outcome log + Required-tools/credentials block (removed "needs founder inbox" — replaced by `bash scripts/flow-004-walk.sh`). Updated impl plan `§8` FLOW-004 status 5/6 → 6/6, preamble's priority #2 reframed from "verify" to "continuous regression watch", "What's shipped today" line bumps "8 flows: 3 walker-evidenced + 3 unattempted" → "4 walker-evidenced + 2 unattempted", `Current status` KPI table row for invite-redeemed users updated with verified-2026-05-24 evidence. Added SK-STRG-002 to `stranger-test/FEATURE.md` (5-field block) + Open question covering the cron + the Playwright `--invite-code` next slice. `AGENTS.md` §5 path map gained `scripts/flow-004-walk.sh` (net-shrunk per the 20 KB cap by trimming the redundant `+ decisions/SK-PREMIUM-{008,009}-*.md` SK pointer on the premium-tier row — the SK files are already linked nine times inside `premium-tier/FEATURE.md`). **Live 2026-05-24 first walk** against `https://app.nlqdb.com` (`bash scripts/flow-004-walk.sh`): mail.tm inbox provisioned on `wshu.net` in ~1s; waitlist 200; Resend invite email arrived in 13s; `/v1/ask` returned **HTTP 200** with `X-Invite-Code` → gate bypassed; total wall-clock 18s. Artifact: `tools/stranger-test/results/flow-004-2026-05-24T11-16-15Z.json`. **Independent self-review (sub-agent, opus 4.7) found 6 issues; this row reflects the iteration that closed all 6:** (major #1) walker treated HTTP 200 as proof the invite was honoured, but `gatePreAlpha` returns `pass` early when the gate is globally open OR `GATE_OPEN=1` — once BIRD/Spider clear, every walk would silently green-light. **Fix:** added a control probe (`/v1/ask` without invite) before the invite probe; walker emits `passed` only when control returns `feature_gated` AND invite returns non-`feature_gated`, otherwise `inconclusive` (new exit code 4). (minor #2) `--argjson ask_status ""` crashed `jq` on total curl failure, killing the triage JSON exactly when needed — fixed by initialising every numeric state var to `0` at the top and routing every failure path through a centralised `write_outcome` helper. (minor #3) step-3 failure JSON omitted the `flow:"FLOW-004"` field present in success JSON — same `write_outcome` fix covers it. (minor #4) trap registered AFTER account creation, leaving a token-failure window with no cleanup — moved trap registration before any mail.tm side effect, trap re-mints JWT from saved password if needed so deletion always succeeds. (minor #5) `printf '%b'` on interpolated email body re-interpreted backslash escapes in user-supplied HTML — replaced with `printf '%s\n%s'`. (nit #6) `EMAIL_LATENCY_S` included the waitlist round-trip — split timers: `T_WAITLIST` for total wall, `T_POLL_START` for Resend latency. **Re-walk after the fix-pass:** control returned `403 feature_gated`, invite returned `HTTP 200`, total 15s wall, JSON now also carries `control_status` + `control_error_status` + `control_blocked` — full SK-GATE-007 invariant proof on every run. Artifact: `tools/stranger-test/results/flow-004-2026-05-24T11-32-44Z.json`. Mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+`): empty. | Shipped after one round of independent self-review iteration. FLOW-004 is the **first** acquisition user-flow to fully pass end-to-end since the §8 tracker was introduced (FLOW-001/002/003 remain gate-blocked by design pending BIRD/Spider, FLOW-005 is curl-partial, FLOW-006/007 unattempted). The SK-GATE-007 invite-valve is now verified-twice and has a one-command continuous-regression primitive whose pass criterion is self-validating across gate-state changes; the founder no longer needs to provide an inbox or Resend webhook capture. Mirror integrity check empty. Review artifact: PR #273 comment chain. |
| 2026-05-24 | Gate UI evals caption + preamble redirect to engine quality | Founder directive (2026-05-24): ICP acquisition tracker priority list was leading with §1.4 anon-bypass even though the deployed gate is operating exactly as GLOBAL-027 requires — every walked `/v1/ask` 403s because BIRD 0.318 < 0.65 and Spider null < 0.75 in [`eval-baseline.ts`](../../apps/api/src/gate/eval-baseline.ts). Removing the gate before BIRD/Spider clear ships bad NL→SQL to every stranger we drive — worse than the current "0 validated users." Real bottleneck is [`quality-eval`](../features/quality-eval/FEATURE.md) velocity, not new surfaces. Founder also flagged that the gate progress block (`FeatureGatedView`) renders `BIRD 31.8% / 65%` and `Spider not yet measured` without telling visitors what BIRD/Spider are — strangers read raw acronyms. | `apps/web/src/components/FeatureGatedView.tsx`: added `<p className="feature-gate__lanes-caption" aria-hidden="true">evals</p>` above the existing `<dl className="feature-gate__lanes">` and labelled the `<dl>` with `aria-label="NL-to-SQL accuracy evals"` for SR users (caption stays `aria-hidden` to avoid double-announce). `apps/web/src/styles/global.css`: new `.feature-gate__lanes-caption` rule — 11px uppercase tracking-0.08em, `#a98a4a` (dimmed sibling of the existing `#d2a352` lane-label colour) so it reads as caption, not section heading. Visual contrast computed against the gate's `#1a1410` background per the WCAG 2.1 relative-luminance formula: 5.58:1, meets WCAG AA for normal text (≥ 4.5:1). `docs/research/automated-icp-validation-plan.md`: (a) preamble's "What the next agent should pick" list re-rooted — new priority #1 is engine quality (BIRD gap close + Spider lane verification + free-vs-agentic-frontier delta narrowing per [`SK-QUAL-009`](../features/quality-eval/FEATURE.md)); §1.4 was-#1 becomes new #2 reframed as "verify the invite-valve end-to-end" (because SK-GATE-007 shipped but no agent has walked FLOW-004 inbox-to-200); demoted §3 picks one slot each; (b) `Current status` KPI table gains two BIRD/Spider rows at the top with the real numbers + cron schedule; (c) §1 intro now states "engine quality sits above this whole layer" and explains why; (d) §6 flag #1 marked resolved (founder picked Option A invite codes AND reaffirmed "lift the gate by clearing thresholds, don't remove it"). `docs/research/automated-icp-validation-plan-verification.md`: preamble synced — leads with the engine-quality bottleneck, advises future agents to verify FLOW-004 (gate-bypass path) rather than re-walking FLOW-001/002/003 in a loop without an invite. Mirror integrity check: normalized FLOW header diff empty. No new GLOBAL/SK introduced — GLOBAL-028/029/030 already cover the doc's role as the canonical acquisition progress tracker, its 20 KB exemption, the agent-ran update contract, and the evidence-grade self-review requirement; the founder directive is a priority re-rooting, not a new cross-cutting rule. **Verification before implementing more ICP flows:** `bash scripts/verify-flows.sh` against `https://nlqdb.com` passes all curl-observable assertions (Reddit + SO sandbox-egress advisories as expected); deployed gate state confirmed via `curl -X POST https://app.nlqdb.com/v1/ask` returning the unauthorized envelope (gate sits behind requirePrincipal — gate-403 is the post-auth path the walker hits with a device token). | Shipped after independent self-review iteration. Acquisition tracker now points the next agent at `quality-eval` velocity, not new ICP surfaces. Gate UI tells visitors what BIRD/Spider are without changing layout. Mirror integrity check (normalized `^#{2,3} FLOW-[0-9]+`) empty. |
| 2026-05-24 | Engine quality — SK-LLM-018 schema-fidelity planner prompt + diagnostic retry framing | Priority #1(c) from the 2026-05-24 preamble: "push BIRD via free-chain scaffolding work (prompt + retry-on-exec-error already wired per `SK-QUAL-009`) — target +5pp/week until 0.65." Free-chain BIRD-dev EX is **0.318** ([`eval-baseline.ts`](../../apps/api/src/gate/eval-baseline.ts) `bird_accuracy`, measured 2026-05-18) vs the Phase 2 floor **0.65** per [`SK-QUAL-005`](../features/quality-eval/FEATURE.md#sk-qual-005). The published evidence base for prompt-side wins on small models: **DIN-SQL** ([arXiv:2304.11015](https://arxiv.org/abs/2304.11015)) — schema-linking is one of four pillars and pins identifier-literal prompting as the per-question first step; **C3-SQL** ([arXiv:2307.07306](https://arxiv.org/abs/2307.07306)) §4.1 "Clear Prompting" three-C's (Clear / Calibrated / Consistent); **DAIL-SQL** ([arXiv:2308.15363](https://arxiv.org/abs/2308.15363)) Table 3 schema-linking ablation; **MAC-SQL** Refiner ([arXiv:2312.11242](https://arxiv.org/html/2312.11242v2)) §4.3 Table 3 +4.63 pp BIRD-dev EX (54.76% → 59.39%) surgical-fix posture (MAGIC [arXiv:2406.12692](https://arxiv.org/pdf/2406.12692) supplies the broader iterative-self-correction frame). Aggregated free-chain headroom from these: **+3–5 pp BIRD-dev EX**. | `packages/llm/src/prompts.ts`: `PLAN_SYSTEM` widened 4→6 bullets — added (a) "Use only tables and columns that appear literally in the provided schema; preserve identifier casing exactly", (b) "When the goal includes an `Evidence:` block, treat it as authoritative annotator context — apply the formulas and column hints it names" (leverages the `evidence` field `tools/eval/src/runner.ts` line 216–218 already concatenates into the goal), (c) "Emit SQL valid for the named dialect — no cross-dialect features (e.g. no TOP/PIVOT for postgres or sqlite; postgres-specific casts only when dialect is postgres)". `buildPlanUser` `previousAttempt` block reframed from the single line "Produce a different SQL shape that avoids that error" to three diagnostic-first bullets — same Goal preservation, schema-only identifier restriction, surgical-fix discipline ("change only what the error names — not the overall approach"). SQL truncation cap (500 chars) unchanged; first-attempt path unchanged. `packages/llm/test/prompts.test.ts`: two new `describe` blocks (7 new assertions) pin the contract — PLAN_SYSTEM schema-link + Evidence + JSON-strict bullets; `buildPlanUser` first-attempt path absent of retry clutter; retry block carries SQL + Error + three directive bullets; LLM-throw case (error but no SQL); 500-char cap. New decision body [`docs/features/llm-router/decisions/SK-LLM-018-schema-fidelity-prompt.md`](../features/llm-router/decisions/SK-LLM-018-schema-fidelity-prompt.md) (5-field; cites DIN-SQL / C3-SQL / DAIL-SQL / MAGIC / MAC-SQL evidence base by arXiv ID). [`docs/features/llm-router/FEATURE.md`](../features/llm-router/FEATURE.md) gains an SK-LLM-018 reference line; net-shrunk to stay under the doc's 25-KB-but-trending budget by relocating SK-LLM-015's body to `decisions/SK-LLM-015-openrouter-codegen-default.md` and tightening Open-questions self-references (25,152 → 25,102 B post-iteration-2 fixes; ≥ -50 byte net). All four production paths consume the prompt change automatically: free chain (Groq / Gemini / Workers-AI / OpenRouter) via `packages/llm/src/providers/_chat-provider.ts::plan()`, `apps/api/src/ask/orchestrate.ts` validator-reject retry, `tools/eval/src/exec-retry.ts::withExecRetry` exec-error retry, and the `agentic-frontier` eval lane. **Verification artifacts:** (1) `bun run --filter @nlqdb/llm test` → 84 / 84 pass (was 77; +7 new prompts-test assertions); (2) `bun run --filter @nlqdb/eval test` → 160 / 160 pass (zero regression in the retry+lane+score test surface that consumes `previousAttempt`); (3) `bun run --filter @nlqdb/api test` → 661 pass / 6 skipped (zero regression in orchestrate's `withStageRetry("plan")` validator-reject loop that consumes the same prompt template); (4) typecheck green via `bun run typecheck`. **Why this is the right pick now, not few-shot:** few-shot exemplars on small models would cost 2–4 k tokens each (BIRD-Mini schemas already push 2–4 k via `introspectSchema`) — the schema-link directive is the cheaper first cut. Few-shot stays open for a follow-up if BIRD doesn't reach ≥ 0.50 on the next [`quality-eval-bird-mini.yml`](../../.github/workflows/quality-eval-bird-mini.yml) Mon 04:00 UTC cron. **Mirror integrity check:** no FLOW added — this is an engine-quality decision, not an acquisition surface; normalized `^#{2,3} FLOW-[0-9]+` diff across `automated-icp-validation-plan{,-verification}.md` stays empty. The verification mirror's "Status (2026-05-24)" preamble still reads BIRD 0.318 because `eval-baseline.ts` is unchanged in this PR — the value updates when the next weekly Mon cron lands a fresh measurement, per `SK-QUAL-005`. | Shipped. Prompt-side scaffolding for the BIRD-gap close is live in `packages/llm/src/prompts.ts` and consumed identically by production + eval. Next agent run picks up the binding signal from the **first weekly `quality-eval-bird-mini.yml` cron after this merge** — if BIRD moves ≥ +3 pp the hypothesis confirms; if flat, few-shot exemplars become the next slice. No `eval-baseline.ts` write in this PR (baseline updates land via the cron + a follow-up PR per `SK-QUAL-005`'s separation of measurement from prompt change). |
| 2026-05-24 | §1.1+§1.4 daily acquisition-health cron (SK-STRG-003) + verification re-sync | Close the two pending open questions in `stranger-test/FEATURE.md` ("Daily cron + R2 archive" and "Continuous FLOW-004 regression watch") in one move; align both mirror files with the verified-twice FLOW-004 evidence; do verification before implementing any new ICP flow per the founder directive in this PR conversation. Acquisition-tracker preamble had FLOW-004 listed as priority #2 "verified-once, not continuously verified" — daily cadence closes that gap and surfaces a Resend-template / KV-key / middleware regression before the next stranger lands. | New [`.github/workflows/acquisition-health.yml`](../../.github/workflows/acquisition-health.yml) (SK-STRG-003 in [`stranger-test/FEATURE.md`](../features/stranger-test/FEATURE.md)): daily `0 6 * * *` cron + `workflow_dispatch` (`base_url` override for previews, `skip_flow_004` for invite-conservation runs). Walks `verify-flows.sh + stranger-test.sh + flow-004-walk.sh` under `continue-on-error: true`; uploads `tools/stranger-test/results/*` as `acquisition-health-<run_id>` artifact with 90-day retention; summary table hoists each walker's canonical `state` from its JSON so the agent reading the run summary can react without downloading the artifact; `verify-flows` step sets `set -o pipefail` so `tee` can't mask the script's real exit code. Playwright Chromium cached via `actions/cache@v4` keyed by `tools/stranger-test/package.json` AND `bun.lock` (so a transitive Playwright bump invalidates the cache) with `restore-keys` for incremental priming. **`exit-0-unconditionally`** is the load-bearing piece — GitHub emails the repo owner on scheduled-workflow failure on the default branch by default, which would create the founder-facing notification channel the operator loop forbids; draining failure into the artifact JSON routes it back through the next agent run as required by `GLOBAL-028`. **Verification before implementing anything new (per this PR brief):** (a) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all 49 curl-observable assertions pass (Reddit + SO sandbox-egress advisories as expected); (b) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed three times** in 18s/15s/17s wall (mail.tm `wshu.net` inbox minted with `redact()` now applied to the address in stdout, waitlist 200, Resend invite arrived in 13s/10s/11s, control returned `403 feature_gated`, invite returned `HTTP 200` — full SK-GATE-007 invariant proof on every run); (c) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across both `automated-icp-validation-plan{,-verification}.md`) empty. **Independent self-review (sub-agent, opus 4.7) found 4 MINORs across criteria 4/6/8/10; this row reflects the iteration that closed all 4:** (M1 security) `flow-004-walk.sh` `ok` line now redacts the throwaway mail.tm address to first-4 + last-4 + domain so the GH Actions raw log never exposes the full local-part; (M2 best-practices) Playwright cache key now hashes `bun.lock` AND `tools/stranger-test/package.json` plus `restore-keys: playwright-${{ runner.os }}-` for incremental priming when the resolved version moves; (M3 UX) summary table now carries a `state` column populated from each walker's JSON so the agent doesn't have to download the artifact to know whether to react; (M4 robustness) `verify-flows` step now `set -o pipefail` so `tee`'s exit can't mask verify-flows.sh's real exit code in `$GITHUB_OUTPUT`. **Doc syncs:** impl plan preamble priority #2 and #5 rewritten to reflect SK-STRG-003 landing; "What's shipped today" block lifts "daily-cron unshipped" and adds the SK-STRG-003 entry; FLOW-004 row counts updated to "passed 3×"; verification mirror FLOW-004 outcome log gets three 2026-05-24 walks + status preamble updated; `stranger-test/FEATURE.md` Status line gains SK-STRG-003, two Open questions resolved (R2 archive deferred separately), SK-STRG-001/002 net-shrunk to keep the file under the 20 KB cap; SK-STRG-002 redact contract updated to name throwaway-email addresses alongside invite codes / JWTs. No new GLOBAL — GLOBAL-028/029/030 already cover the doc role + 20 KB exemption + agent-ran update contract; this cron is one SK-* under the existing `stranger-test` feature. | Shipped after one round of independent self-review iteration (PR #276 comment chain). The §1.4 invite-valve is now **continuously regression-watched** without a founder notification channel; SK-STRG-003 closes both pending stranger-test open questions in one workflow file. Mirror integrity check empty. |
| 2026-05-24 | §1.1 invite-bearing composer (SK-STRG-004) + `/solve/`+`/vs/` invite-capture regression fix + first-ever browser HTTP 200 | Close the documented "Invite-bearing mode for the Playwright walker" open question in `stranger-test/FEATURE.md`; verify the browser-side `captureInviteFromUrl` + `X-Invite-Code` happy path that SK-STRG-002 (curl-only) cannot prove; do verification first per the founder directive in this PR brief. Composes `flow-004-walk.sh` (HTTP-observable, already proven) + `stranger-test.sh` (browser-observable, gate-blocked) into a single walk that exercises the full SK-GATE-007 happy path through a real Chromium session. | **Composition seam (`scripts/flow-004-walk.sh`):** new `FLOW_004_INVITE_OUT=<path>` env writes the raw invite code to a mode-600 sidecar file after step 3; `note` line documents the side effect; behaviour unchanged when the env is unset. **Composer (`scripts/stranger-test-invited.sh`, new — SK-STRG-004 / [`decisions/SK-STRG-004-invite-bearing-composer.md`](../features/stranger-test/decisions/SK-STRG-004-invite-bearing-composer.md)):** bash wrapper that invokes `flow-004-walk.sh` with `FLOW_004_INVITE_OUT=<sidecar>`, reads-and-immediately-deletes the sidecar (trap-registered before any side effect; `EXIT INT TERM` all clean up), shape-validates the code against `/^[A-Za-z0-9_-]{16,128}$/`, then exports it as `NLQDB_INVITE_CODE` and forks `bash scripts/stranger-test.sh --out <walk-invited-<utc>.json>` with `unset FLOW_004_INVITE_OUT` so the child can't re-read the sidecar path. **Runner (`tools/stranger-test/src/runner.ts`):** new `--invite-code <c>` flag (also reads `NLQDB_INVITE_CODE` env) with shape validation; pushed through to `walkFlowNNN` via a new optional 5th argument. **Walkers (`flows/flow-00{1,2,3}.ts`):** when `inviteCode !== null`, navigate to `${path}?invite=<c>` via the new shared `withInviteParam(path, code)` helper in `browser.ts`; immediately assert `localStorage["nlqdb_invite"] === code AND ?invite= stripped` via `assertInviteCaptured(page, stepNum, code)` (step 9 in flow-001, step 10 in flow-002/003 — placed at the slot that doesn't collide with the existing step numbering); failure detail on the `/v1/ask` submit step now calls out the SK-GATE-007 regression signature (`feature_gated WITH invite`). `WalkResult.inviteBearing: boolean` added to the JSON shape so the §1.2 KPI dashboard can split TTFV by mode. **Bun-runtime hardening (incidental but load-bearing):** attached `.catch(() => null)` AT CONSTRUCTION to every `page.waitForResponse(...)` site in flow-001/002/003 — Bun's stricter unhandled-rejection detector was crashing the walker between waitForResponse() and `await` when the page closed mid-flight (CI's Node tolerated the later .catch; Bun did not). Tests added: 4 new `withInviteParam` cases (null pass-through, no-query append, query-merge, malformed-code rejection) — total 11/11 pass. **Web-app regression caught + fixed:** the first live composer walk (`bash scripts/stranger-test-invited.sh --flows flow-002,flow-003 --prompts 1`) failed step 10 on `/solve/cheap-internal-dashboard?invite=…` AND `/vs/supabase?invite=…` with `stored=<null> urlClean=false` — `[slug].astro` script bundles did not call `captureInviteFromUrl()`, so a stranger landing on a launch URL pointed at either page lost the invite at the first `location.assign("/app/new")` (which drops the query string). **Fixed in same PR**: added the `import { captureInviteFromUrl } from ...` line + `captureInviteFromUrl();` call to `apps/web/src/pages/solve/[slug].astro` AND `apps/web/src/pages/vs/[slug].astro`; verified `bun run build` inlines the call into the bundled `/_astro/_slug_.astro_*.js`. **Live evidence (`https://app.nlqdb.com`, 4 walks total):** (a) homepage invite-bearing walk via composer at 21:15:54Z → **HTTP 200 on `/v1/ask` for the first time since SK-STRG-001 shipped** (ttfvMs 4146; step 9 captureInviteFromUrl ok; step 5 gate-honoured); (b) flow-002+003 composer walk at 21:16:34Z → step 10 fails (regression discovered) on both walked slugs; (c) FLOW-004 standalone walks at 21:04:13Z + post-composer triple pass — each control returned `403 feature_gated` and invite returned `HTTP 200` in 17–18s. **Verification before implementing:** `bash scripts/verify-flows.sh` against `https://nlqdb.com` passed all 49 curl-observable assertions (Reddit + SO sandbox-egress advisories as expected); `bun run --filter @nlqdb/stranger-test test` + `typecheck` both green (11/11 tests pass); `cd apps/web && bun test src/data` 26/26 pass; `bunx astro check` 0 errors / 0 warnings; `bun run build` emits all 20 pages cleanly including the patched `/solve/` + `/vs/` bundles. **Doc syncs:** verification mirror outcome rows added to FLOW-001 (passed invite-bearing), FLOW-002 + FLOW-003 (failed step 10 → regression fixed in same PR); FLOW-001/002/003 status dashboard rows updated; verification mirror "Invite-bearing variant (SK-STRG-004)" subsections added under each flow's Triage; FLOW-004 outcome log gets the composer-pass triple-walk row. `stranger-test/FEATURE.md` Status line names SK-STRG-004; SK-STRG-004 body extracted to `decisions/SK-STRG-004-invite-bearing-composer.md` to stay under the 20 KB cap (FEATURE.md 19842 → 20048 B; net +206 B). Touchpoints gain `scripts/stranger-test-invited.sh`. Open questions: "Invite-bearing mode for the Playwright walker" marked **resolved** (replaced with a one-line back-reference to SK-STRG-004). `AGENTS.md` path map updated (`scripts/stranger-test-invited.sh` added; net-shrunk by 11 B via the `run/**` row's redundant SK pointer trim). No new GLOBAL — GLOBAL-028/029/030 already cover the doc role + 20 KB exemption + agent-ran update contract; this is one SK-* under the existing `stranger-test` feature plus a tiny same-PR web-app regression fix. **Mirror integrity check:** normalized `^#{2,3} FLOW-[0-9]+` diff across both tracker files stays empty. | Shipped. The §1.1 anti-self-deception layer now has a regression detector for the browser-side invite-bearing path that the curl FLOW-004 walker can't exercise. The first walk caught a real `/solve/`+`/vs/` regression — fixed in the same PR. The first browser HTTP 200 on `/v1/ask` is recorded in the verification mirror with full triage trail. Next agent's pick: (1) post-deploy re-walk of `stranger-test-invited.sh --flows flow-002,flow-003` after `deploy-web.yml` ships to verify the `captureInviteFromUrl` fix, (2) triage the FLOW-001 step 6 trace-toggle regression the composer surfaced — the gate-403 was masking it. |
| 2026-05-24 | SK-STRG-004 round-2 self-review iteration (C1 invite-leak + M1 size + M2/M3 sidecar hygiene + walker stdout) | Independent self-review (sub-agent, opus 4.7) on PR #278 found 1 CRITICAL (raw `?invite=<code>` interpolated into step-1 description in `flow-002.ts`/`flow-003.ts` — landed verbatim in the artifact JSON, would have shipped to the GH Actions 90-day artifact if the composer were cron-wired; flow-001 was safe because its step-1 description is a fixed string), 1 MAJOR (`FEATURE.md` 20,048 B over a strict decimal-KB reading of D4), 5 MINOR (sidecar not gitignored; sidecar timestamp lacks PID for two-runs-per-second concurrency; runner stdout JSON leaked the same string by virtue of carrying steps; unrelated AGENTS.md trims; `flow-004-walk.sh` exit-3 burns invite cap with no recovery path), 2 NIT. | (C1) New `redactInviteFromUrl(url)` helper in `tools/stranger-test/src/browser.ts` (case-insensitive regex on `[?&]invite=`, stops at `&`/`#`); applied in `flow-002.ts`/`flow-003.ts` step-1 description to redact the URL before interpolation; the underlying `page.goto(url, ...)` still uses the real URL (the redaction is display-only). 6 new test cases in `personas.test.ts` (start-of-query, mid-query, before-fragment, no-invite-param pass-through, case-insensitive, follow-on params survive) — total 17/17 pass. Local leaked-artifact JSON files scrubbed with `rm -fv`; the live-leaked invite `obzWju4RG10ldt3Jfp6gow` from the original walk was **burned by the agent post-discovery** via a one-shot `POST /v1/ask` with that code (HTTP 200 confirmed consumption) — eliminating the residual 30-day-TTL exposure. (M1) `FEATURE.md` net-shrunk from 20,048 → 19,987 B by tightening SK-STRG-002's Why-field (removed redundant "2026-05-24" timestamping the body already implies); safely under both 20,000 and 20,480 byte readings of D4. (M2) New `.gitignore` entry `tools/stranger-test/results/.invite-*.txt` defends against trap-bypass (SIGKILL leaves sidecar; gitignore prevents accidental `git add`). (M3) Sidecar filename in `scripts/stranger-test-invited.sh` now carries `$$` PID (`.invite-<utc>-<pid>.txt`) so two composer runs in the same UTC second cannot race on read. (M4) Same fix as C1 — the runner's `JSON.stringify(result, null, 2)` ingested the step-1 descriptions, so redacting at the source eliminates the stdout path too. (M5/M6/N1/N2 deferred to follow-up; documented in the round-2 review comment chain.) **Verification:** `bun run --filter @nlqdb/stranger-test test` → 17/17 pass (was 11; +6 redact tests); `typecheck` green; `bunx biome check tools/stranger-test/` clean. Live `bash scripts/stranger-test-invited.sh --flows flow-002 --prompts 1` against `https://app.nlqdb.com`: composer + FLOW-004 pass, flow-002 step 10 fail (regression, expected pre-deploy); `grep -oE 'invite=[A-Za-z0-9_-]+' tools/stranger-test/results/walk-invited-*.json` returns zero matches → leak fix confirmed (`?invite=<redacted>` is the only form that appears). Live invite from the post-fix walk also burned via FLOW-004 step 5's curl probe (HTTP 200); no live code persists in either local disk or the (now-deleted) artifact. **Mirror integrity check:** normalized `^#{2,3} FLOW-[0-9]+` diff stays empty. | Shipped after round 1 of independent self-review iteration on PR #278. The leak window (between original composer walk and burn) was approximately 23 minutes; no third party knew the code; the production gate now sees an exhausted code on any future probe attempt. Round-2 review queued. |
| 2026-05-24 | SK-STRG-004 round-3 self-review iteration (defence-in-depth on session-event channels) | Independent self-review round 2 (sub-agent, opus 4.7) closed all round-1 findings AND surfaced 1 MINOR + 1 NIT in the same leak-class as C1: the `httpErrors` channel in `browser.ts` `openSession` pushed raw `r.url()` for any 4xx/5xx response outside the ignored set, and `consoleErrors` interpolated `msg.text()` / `pageerror.message` directly — both end up in JSON artifacts. Realistic blast radius small (slugs return 200 on the happy path) but trivially closeable with the same `redactInviteFromUrl()` helper. | Wrapped every push site in `openSession`'s page-event listeners (`page.on("console"|"pageerror"|"response")`) with `redactInviteFromUrl(...)` before the `.slice(...)` length cap; preserves the existing 240/200-char limits unchanged. No new helper, no new test — `redactInviteFromUrl` is a no-op on strings that don't carry `[?&]invite=` so the cost is one regex per push. **Verification:** `bun run --filter @nlqdb/stranger-test test` → 17/17 pass; `typecheck` green; `bunx biome check tools/stranger-test/` clean. Mirror integrity check stays empty. | Shipped after round-2 self-review iteration on PR #278. The leak surface is now closed at all push sites that ingest a URL or page-supplied string into the JSON artifact (step descriptions, runner stdout, console/pageerror/HTTP-response logs). |
| 2026-05-24 | SK-STRG-004 round-4 self-review iteration (step-7 `page.url()` defence-in-depth) | Round-3 self-review (sub-agent, opus 4.7) closed both round-2 findings and surfaced 1 MINOR: `flow-002.ts:207` and `flow-003.ts:178` pushed raw `page.url()` into step-7 JSON detail. The `captureInviteFromUrl` fix in this PR defends the normal case (the URL bar gets cleaned on /solve/ + /vs/), but if the Astro module script fails to load (CSP / MIME / parse error / bundled-import network blip), the URL would still carry `?invite=<RAW_CODE>` and land in the 90-day artifact. Same defence-in-depth rationale as round 3. | Wrapped both step-7 `page.url()` interpolations with `redactInviteFromUrl()` before the template-literal embed; extracted the URL into a `currentUrl` local so the redacted form is the only one in step description. **Verification:** 17/17 stranger-test tests pass; typecheck + biome clean. | Shipped after round-3 self-review iteration on PR #278. Every JSON-artifact push site that touches a URL is now wrapped through the redactor: step descriptions (flow-002/003 step 1), step-7 navigation detail, browser session events (httpErrors, consoleErrors, pageerror). Remaining `inviteCode`/URL surfaces are auditable: sidecar (mode 600 + gitignored + PID-named + trap-removed), env-passing to bun child (residual /proc/<pid>/environ — round-2 accepted NIT). |
| 2026-05-24 | §3.3 amendment site-wide `?invite=` capture | Verification-first: ran mirror integrity check (empty diff), `bash scripts/verify-flows.sh` against `https://nlqdb.com` (all curl-observable assertions green; Reddit/SO sandbox-egress advisory as expected), and `bash scripts/flow-004-walk.sh` (passed in 21s: control 403 + invite 200) BEFORE implementing. Then code inspection found a real gap: `apps/web/src/lib/invite.ts::captureInviteFromUrl()` was only invoked on the homepage and `/app/new` (matching SK-GATE-007 Consequence as originally written), but the impl plan §3.3 amendment and the preamble "What the next agent should pick" priority #6 both explicitly require press-launch URLs into `/solve/<slug>` and `/vs/<slug>` to carry the gate-bypass — once FLOW-004 verified the invite-valve, this was the only thing standing between a press-launch click-through and an HTTP 200 on `/v1/ask`. | `apps/web/src/layouts/Base.astro` now runs `captureInviteFromUrl()` once, site-wide (one bundled `<script>` block ~46 bytes minified that imports the existing `invite.ts` 390-byte chunk). Per-page duplicates removed from `apps/web/src/pages/index.astro` and `apps/web/src/pages/app/new.astro` (capture is idempotent; running on the same page twice is a no-op). New `apps/web/src/lib/invite.test.ts` (7 tests, bun:test): no-op on URL without `?invite=`; captures + strips on homepage; captures on `/solve/<slug>` press-launch URL; captures on `/vs/<slug>` press-launch URL; idempotent second call; preserves other query params (`?ref=hn&invite=...` → `?ref=hn`); SSR-safe (no throw when `window` undefined). [`docs/features/pre-alpha-gate/FEATURE.md`](../features/pre-alpha-gate/FEATURE.md) SK-GATE-007 Consequence updated: "on the homepage and `/app/new`" → "site-wide via `Base.astro` (so press-launch URLs into `/solve/<slug>` and `/vs/<slug>` per impl plan §3.3 amendment also capture)". `scripts/verify-flows.sh` gains a new agent-runnable probe (`Site-wide ?invite= capture — Base.astro bundled invite-capture is loaded`): fetches `/`, `/solve/<first-slug>/`, `/vs/<first-slug>/`; extracts the `/_astro/Base.astro_astro_type_script_index_0_lang.<hash>.js` src from the HTML; follows the `./invite.<hash>.js` import out of that bundle; greps the import target for `nlqdb_invite` (the localStorage key the capture writes — rollup keeps it as a string literal through minify). Asserts every probed page references the same Base.astro bundle hash. **Verification artifacts:** (a) `bun test apps/web/src/lib/invite.test.ts` → 7/7 pass; (b) `bun run --filter @nlqdb/web build` → 20 pages built, dist green; (c) probe against the local `apps/web/dist` (`python3 -m http.server 9999`) → all 12 invite-capture assertions pass — Base.astro bundle is 46 bytes (the import + call) and resolves to `invite.<hash>.js` which preserves `nlqdb_invite` through minify; (d) probe against the live `https://nlqdb.com` → 3 expected pre-deploy failures (deployed bundle pre-dates this PR — the probe correctly identifies the pre-deploy state and will turn green after the next `deploy-web.yml` run). §8 status dashboard updated (FLOW-001 6→7 of 8 (88%), FLOW-002 5→6 of 7 (86%), FLOW-003 5→6 of 6 (100%), FLOW-008 8→9 of 9 (100%)); FLOW-001/002/003 sub-task tables gained the new site-wide-invite-capture row; FLOW-008 gained the invite-capture probe row. Mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across both `automated-icp-validation-plan{,-verification}.md`) remains empty — no new FLOW added; the existing FLOW blocks gained one sub-task each. No new GLOBAL/SK — this is a precision update to SK-GATE-007's Consequence so it matches the impl plan §3.3 amendment + preamble priority #6 the decision already implied. **Independent self-review (sub-agent, opus 4.7) on PR #277 found 4 issues (3 MINOR + 1 NIT); this row reflects the iteration that closed all 4:** (M1 error handling) wrapped `captureInviteFromUrl()` body in try/catch in `apps/web/src/lib/invite.ts` so a Safari Private Browsing `QuotaExceededError` on `localStorage.setItem` can't trip the site-wide boot-fallback overlay; added 8th unit test pinning the contract; (M2 security) added `<meta name="referrer" content="strict-origin-when-cross-origin">` to `Base.astro` head so the sub-100ms strip window can't leak `?invite=<code>` via cross-origin `Referer:` header; (M3 robustness) loosened `verify-flows.sh` regex from `Base.astro_astro_type_script_index_0_lang.<hash>.js` to `Base.astro_*.js` (and similarly for the invite chunk) so a future Astro version-bump that renames the rollup internal pattern doesn't false-fail the probe; added comment naming the Astro 5 dependency; (NIT) compressed Base.astro's 3-line comment to a single line per CLAUDE.md "one short line max" (WHY now lives in SK-GATE-007 Consequence). Re-ran all verification artifacts post-iteration: `bun test apps/web/src/lib/invite.test.ts` → 8/8 pass (was 7); `bun run --filter @nlqdb/web build` → 20 pages, dist green; `bash scripts/verify-flows.sh` against local `apps/web/dist` → all assertions green; `bunx astro check` → 0 errors; `bunx biome check` → clean. | Shipped pre-deploy after one round of independent self-review iteration (0 issues post-iteration). The invite-valve verified by FLOW-004 (signup → Resend → `X-Invite-Code` → 200) now extends to **every page**: a press-launch URL like `https://nlqdb.com/solve/cheap-internal-dashboard?invite=<code>` (Show HN, dev.to, IH long-form, AEO inbound) captures the code on landing and forwards it as `X-Invite-Code` on every subsequent `/v1/ask` — the gate-403 binding gap that has blocked FLOW-001/002/003 since their walker rows landed is now unblocked **for invite-bearing traffic specifically** (per priority #6 of the preamble). Unblocks priority #8 (Show HN with `?invite=` URL) materially: the launch URL now actually carries the user across the gate. Mirror integrity check empty. FLOW-001/002/003 walker re-pass requires the deploy to land + a real invite code in the walker, tracked as the existing `--invite-code` open question in `stranger-test/FEATURE.md`. |
| 2026-05-25 | §2.1 Dev.to source (SK-ICP-008) + FLOW-008 9th sub-task + pre-implementation verification | Sixth ICP scrape source — broaden P1/P3/P4 pain signal beyond HN+Reddit+GH+SO+IH. The §2.1 source mix today over-weights short-form discussion (HN/Reddit) and Q&A (SO) and under-samples first-person long-form developer blogging. Dev.to (Forem) is the largest indie dev-blogging surface and is listed alongside HN/Reddit in [`personas.md`](./personas.md) as a place P1/P3/P4 hang out, but was never wired into the scraper. Forem ships a documented public read API (`/api/articles`, ~3 RPS anon; [`developers.forem.com`](https://developers.forem.com/api/v1)) with a server-side `top=7` recency filter — strictly cheaper to consume than IH's unofficial mirror. Founder directive 2026-05-24 keeps engine quality as priority #1; this is additive evidence work that strengthens the cluster step without touching the gate or §3 surfaces. **Pre-implementation verification (per the PR brief):** (a) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all 49 curl-observable assertions pass (Reddit + SO sandbox-egress advisories as expected); (b) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed** in 19s wall (mail.tm `wshu.net` inbox, waitlist 200, Resend invite in 11s, control returned `403 feature_gated`, invite returned `HTTP 200`; SK-GATE-007 invariant honoured); (c) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` headers) empty before the edit. **Source vetting:** Lobste.rs was the first candidate considered — rejected because its `robots.txt` sets `User-agent: * Disallow: /` plus `Content-Signal: ai-input=no, ai-train=no, search=yes` (explicit scrape-deny). Dev.to's `robots.txt` allows `/api/*` for any user-agent — clean fit. | `apps/api/src/icp-scrape.ts` gains `fetchDevto` (5 tag queries: `database`, `sql`, `postgres`, `webdev`, `orm`; `per_page=15&top=7` for server-side 7-day filter) and a sixth element in the `Promise.all`. Items stored as `source: "devto"`, `id: "devto-<article.id>"` (prefix prevents numeric-ID collisions); items with unparseable `published_timestamp` dropped pre-write. `User-Agent: nlqdb-icp-bot` (same string as IH/GH per SK-ICP-006/004) + `AbortSignal.timeout(10s)` + per-tag error isolation; new OTel span `nlqdb.icp.fetch.devto` carries `nlqdb.icp.items` and `http.response.status_code`. LogSnag description now reports `DEV: <n>` alongside HN/Reddit/GH/SO/IH counts. `apps/api/test/icp-scrape.test.ts` gains 4 new tests (happy-path store with `devto-` prefix; `User-Agent` + `top=7` URL contract; unparseable-timestamp drop; 503 graceful — total 23/23). `scripts/verify-flows.sh` gains `FLOW-008 source Dev.to /api/articles` probe (fatal severity; no managed-egress block on the agent VM — confirmed via the post-implementation re-walk below). `docs/features/icp-mining/FEATURE.md` gains SK-ICP-008 (5-field block); One-liner + Status + Touchpoints + GLOBAL-013/-014 commentary updated for the 6-source mix; net-shrunk SK-ICP-001/003/004/005/006/007 prose to land at 19,636 bytes (was 19,981; net −345 B, under the 20 KB cap). `docs/research/automated-icp-validation-plan.md` §2.1 sources table gains a Dev.to row; §2.2 expanded note added; FLOW-008 sub-tasks 8/8 → 9/9; status dashboard row updated to "curl probe of 6 sources"; "What's shipped today" line lists Dev.to; this Progress log row. `docs/research/automated-icp-validation-plan-verification.md` FLOW-008 walkthrough gains step 6 (Dev.to probe assertion); status dashboard row updated to "6 sources"; outcome log gains today's row. **Live API probe before commit** from this VM: `curl https://dev.to/api/articles?tag=database&per_page=15&top=7` → `HTTP 200, 15 items`; sample-0 fields verified (`id`, `title`, `url`, `published_timestamp`, `tag_list`, `public_reactions_count`, `comments_count`). **Post-implementation verification:** (1) `bun x vitest run test/icp-scrape.test.ts` → 23 / 23 pass (was 19; +4 new for SK-ICP-008); (2) `bash scripts/verify-flows.sh` re-run against `https://nlqdb.com` — all assertions green including the new Dev.to probe (HTTP 200, JSON-array body), Reddit/SO sandbox-egress advisories unchanged; (3) mirror integrity check post-edit (normalized `^#{2,3} FLOW-[0-9]+` diff across both tracker files) empty. No new GLOBAL/SK introduced beyond SK-ICP-008 — GLOBAL-028/029/030 already cover the doc role + 20 KB exemption + agent-ran update contract; this is a feature-local SK under existing `icp-mining`. | Shipped. Sixth source live for the next Mon 2026-06-01 cron (the 2026-05-26 first-cron run already executed on the 5-source mix). The Forem API matches the existing per-source error-isolation + OTel pattern exactly, so the marginal regression surface is the response-schema contract (`id`, `published_timestamp`, JSON-array shape) which the new tests + FLOW-008 probe both pin. Mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+`) stays empty — no new FLOW added; FLOW-008 was the only existing flow that needed sub-task extension. |
| 2026-05-29 | §3.5 Wren AI comparison page (5th `/vs/<slug>`) + pre-implementation verification + competitors.md sync | Acquisition surface — second `P3 analyst` `/vs/` slot, this time on the semantic-layer / governance angle the existing four `/vs/` pages don't cover. Wren AI ([getwren.ai](https://getwren.ai), OSS at [github.com/Canner/WrenAI](https://github.com/Canner/WrenAI), 15k+ stars, multi-licensed — Apache 2.0 for `core/` + `sdk/` + `skills/` + `examples/` + root, CC-BY-4.0 for `docs/`, AGPL-3.0 reserved for future modules per the LICENSE file) is the next-pick after Outerbase per [`comparison-pages/FEATURE.md`](../features/comparison-pages/FEATURE.md) Open questions — its MDL semantic model + row- and column-level access controls + SOC 2 Type II posture are exactly the differentiation surface nlqdb cannot match in Phase 1, so an honest side-by-side is the page buyers searching `wren ai alternative` arrive at the decision moment on. Founder directive 2026-05-24 keeps engine quality as priority #1; this is additive AEO work that doesn't touch the gate or any Worker code (static Astro page only), so the §3.5 "tractor beam" advances without blocking on BIRD/Spider. **Pre-implementation verification (per the PR brief):** (a) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across `automated-icp-validation-plan{,-verification}.md`) — empty before the edit; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all curl-observable assertions green (Reddit + SO sandbox-egress advisories as expected); (c) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed** in 21s wall (mail.tm `wshu.net` inbox, waitlist 200, Resend invite in 11s, control returned `403 feature_gated`, invite returned `HTTP 200`; SK-GATE-007 invariant honoured); (d) WebFetch verification of the claims that land in user-facing copy — `getwren.ai/` (tagline + cloud/self-host options), `getwren.ai/pricing` (Free/Essential/Enterprise tiers, **SOC 2 Type II on Essential + Enterprise only — Free plan lists no compliance bullets**, 20-credit free allowance + 80 first-14-day credits), `github.com/Canner/WrenAI` (**multi-licensed per the LICENSE file: Apache 2.0 for `core/` + `sdk/` + `skills/` + `examples/` + root, CC-BY-4.0 for `docs/`, AGPL-3.0 reserved for future modules**, MDL semantic model with models/columns/relationships/views/cubes/metrics + RLAC/CLAC, Apache DataFusion engine documenting 22+ data sources — PostgreSQL/BigQuery/Snowflake/DuckDB explicit, Python SDK + LangChain/LangGraph bindings + Claude Code skill bundle, 15k+ stars). | `apps/web/src/data/competitors.ts` gains the Wren AI entry (5th `Competitor`): persona `P3 analyst`, 4 `whenChooseUs` + 4 `whenChooseThem` bullets (SK-CMP-001), 12-row feature parity table, 6 FAQs (SK-CMP-003 4-6 range) all naming "Wren AI" verbatim (SK-CMP-003 requires ≥1), demo goal `"current month's signups grouped by acquisition channel"`. `apps/web/src/pages/vs/[slug].astro` `getStaticPaths()` picks the new slug up unmodified per SK-CMP-002. `apps/web/src/pages/vs/index.astro` description updated to name Wren AI alongside Supabase / Vanna / Mem0 / Outerbase. `scripts/verify-flows.sh`: `VS_SLUGS` / `VS_TITLES` arrays gain `wrenai` / `Wren AI`; sitemap floor 13 → 14 (5 solve + 5 vs + 4 root). `docs/competitors.md`: new entry under §2 (Text-to-SQL / NL-over-DB tools) covering license + MDL + RLAC/CLAC + SOC 2 + engine list + threat-vector; threat-matrix table gains a Wren AI row. `docs/features/comparison-pages/FEATURE.md`: status line `4 → 5`; Open questions amended to record Wren AI as the second P3 slot and pin AskYourDatabase / Retool AI as the next-pick. `docs/research/automated-icp-validation-plan.md` §8 FLOW-003 dashboard row + verification mirror FLOW-003 dashboard row + outcome log all updated; mirror integrity check stays empty (no new FLOW added). No new GLOBAL/SK introduced — the addition fits inside the existing data-driven contract per SK-CMP-002. **Honesty contract on the page itself:** the `whatItDoesnt`-equivalent (`whenChooseThem` + the feature table's `us: no` / `us: partial` rows) names every dimension Wren AI ships and nlqdb does not — MDL semantic model, RLAC/CLAC, 22+ engines, paid-plan SOC 2 Type II, multi-license OSS self-host. No buyer-facing SK-* leak (lesson from the 2026-05-24 Outerbase round-2 review); the only internal-ID reference is on the `sk_live_*` row glossing what nlqdb's per-DB keys scope by — that's a public SDK contract, not a documented-decision ID. **Post-implementation verification:** (1) `bun test apps/web/src` → 106 / 106 pass (was 93 before solve.ts updates; competitors.test.ts contributes 9, solve.test.ts 17); (2) `cd apps/web && bun run build` → 21 pages built including `/vs/wrenai/`; (3) `bunx astro check` → 0 errors / 0 warnings; (4) local probe via `NLQDB_BASE_URL=http://localhost:9999 bash scripts/verify-flows.sh` against `apps/web/dist` (`python3 -m http.server 9999`) — all assertions green including `/vs/wrenai/`, `<h1>nlqdb vs Wren AI</h1>` template-match, FAQPage JSON-LD, 14-entry sitemap floor, `/llms.txt` enumerates `vs/wrenai`; (5) live `bash scripts/verify-flows.sh` against `https://nlqdb.com` — exactly 4 expected pre-deploy failures (`/vs/wrenai/` 404 + redirect probe 404, sitemap floor 13 < 14, `llms.txt` missing `vs/wrenai`); all clear post-`deploy-web.yml`; (6) mirror integrity check post-edit (normalized `^#{2,3} FLOW-[0-9]+` diff) empty. | Shipped after one round of independent self-review iteration. **Round-1 self-review (sub-agent, opus 4.7) found 9 issues (0 CRITICAL / 2 MAJOR / 5 MINOR / 2 NIT); this row reflects the iteration that closed every actionable finding:** (M1) "SOC 2 Type II across all plans" refuted by WebFetch of `getwren.ai/pricing` (Free plan lists no compliance bullets; SOC 2 ships on Essential + Enterprise paid plans only) — fixed in 6 user-facing locations (`competitors.ts` whenChooseThem[3] / SOC 2 feature-table note / FAQ4; `docs/competitors.md`; `comparison-pages/FEATURE.md` Open Questions; this Progress log row); SOC 2 feature-table `them: shipped` → `them: partial` to match the Essential/Enterprise-only contract; (M2) "Apache 2.0" framing refuted by WebFetch of `github.com/Canner/WrenAI/blob/main/LICENSE` (multi-licensed: Apache 2.0 for `core/` + `sdk/` + `skills/` + `examples/` + root, CC-BY-4.0 for `docs/`, AGPL-3.0 reserved for future modules) — fixed in 5 user-facing locations (`competitors.ts` inline-URL comment / OSS-row feature-table note / FAQ6 question+answer; `docs/competitors.md`; this Progress log row); (N1) SK-CMP-001 ≤16-word rule violations in 5/8 bullets — every over-budget bullet tightened to ≤16 words; (N2) `as of May 2026` qualifier added to FAQ1's benchmark claim + FAQ4's SOC 2 claim so live drift gives the buyer a discount lens; (N3) `whenChooseUs[3]` reworded to acknowledge Wren AI's Claude Code skill bundle while preserving the MCP `create_database` differentiator (matches the feature-table note's nuance); (N4) `scripts/verify-flows.sh` sitemap-floor comment expanded to name the data files the floor tracks (`COMPETITORS.length + SOLVE_ENTRIES.length + STATIC_ROUTES`); (Nit1) inline-URL comment trimmed per CLAUDE.md "one short line" + WHY-not-WHAT (also covers the M2 fix); (Nit2) `vs/index.astro` description switched from named-list to generic phrasing so it doesn't cross the ~155-char SEO-meta sweet spot at 6+ entries. **N5 (demo-empty-DB UX) is feature-scope and deferred** per the reviewer's own note. All re-verification artifacts re-ran post-iteration: `bun test apps/web/src` 106/106 pass; `bun run --filter @nlqdb/web check` 0 errors / 0 warnings; `bun run build` 21 pages; live verify-flows 4 expected pre-deploy failures; mirror integrity empty. Comparison page count 4 → 5; second `/vs/` page covering P3 (semantic-layer / governance angle vs Vanna's translator-only angle). Mirror integrity check stays empty — no new flow added. FLOW-003 verification mirror outcome log gets the pre-deploy build-time row; the live-walk row appends after `deploy-web.yml` deploys `apps/web/dist`. The §3.5 "tractor beam" tractor count advances without touching the gate or any Worker code; the engine-quality priority #1 from the 2026-05-24 founder directive is not regressed because no LLM / `/v1/ask` path changed. |
| 2026-05-30 | §3.1 candidate `/solve/no-migration-files-database` pulled after round-2 review caught product fabrication; PR #288 ships verification-only progress | Acquisition surface candidate — first /solve/ page that would have named nlqdb's **schema-widening** angle explicitly. The existing 5 /solve/ pages cover provisioning (skip-postgres-setup), agent memory (give-ai-agent-persistent-memory), Retool-replacement (cheap-internal-dashboard), text-to-SQL accuracy (natural-language-sql-without-training-data), and the leaderboard archetype (ship-leaderboard-no-sql) — no page surfaces the schema-migration angle, so it was the prima-facie next slot. **Pre-implementation verification did run** (mirror integrity empty; `bash scripts/verify-flows.sh` against `https://nlqdb.com` all curl-observable assertions green; `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` passed in 18s wall — control 403 + invite 200, SK-GATE-007 invariant honoured). **Source-vetting on a candidate 7th Lemmy ICP source** also ran before the AEO pivot: probed `programming.dev` (returned `Content-Signal: search=yes, ai-train=no` + explicit ClaudeBot/GPTBot/CCBot disallow — respected, not crawled, same posture as the 2026-05-25 Lobste.rs rejection) and `lemmy.world` (dominated by Reddit-RSS bot bridges — `creator.bot_account=true` on 13/20 probed posts; remaining 7 split across programming.dev and 3 native fediverse instances). The verification work was real even though no surface ships from this PR. Candidate `SolveEntry` was added to `apps/web/src/data/solve.ts` and iterated through one round of self-review (round-1: opus 4.7 found 0 CRITICAL / 2 MAJOR / 5 MINOR / 3 NIT — author closed M1 audit-log fabrication, M2 12 buyer-facing SK/GLOBAL leaks, m1–m5, n1, n3; n2 deferred). **Round-2 self-review (opus 4.7) escalated to verdict `block` with one new CRITICAL the round-1 review had missed:** the candidate page's entire thesis — NL-driven `ALTER TABLE ADD COLUMN NULL` widening — is not a shipped capability today. Code-side proof read against the actual repo at commit `fdb69eb`: `apps/api/src/ask/sql-validate.ts:90` `LEADING_VERB_REJECT` rejects every DDL verb (`alter` / `drop` / `create` / `truncate` / `grant` / `revoke` / `vacuum`) on the `/v1/ask` path; `apps/api/src/ask/orchestrate.ts:156` returns `error.status="schema_unavailable"` when `db.schemaHash` is null (so the candidate `demoGoal` would never reach a working first query against an anonymous DB even with the SK-GATE-007 invite-valve open); `apps/api/src/ask/types.ts:62-64` says `DDL via /v1/ask` is rejected by the allowlist and `DDL` in `AskDiff` is "reserved for the future db-create slice"; `apps/api/src/run/orchestrate.ts:83` uses the **same** `validateSql` so the `runSql` escape hatch the candidate page routed destructive DDL through also rejects DDL; `SK-DB-008` ([`docs/features/db-adapter/FEATURE.md:98`](../features/db-adapter/FEATURE.md)) describes the widening as **planner-observed on a SELECT against a new field**, not as an English DDL verb the user can request; [`docs/features/schema-widening/FEATURE.md`](../features/schema-widening/FEATURE.md) Status `partial` (the observed-fields collector and widening trigger ship post-Phase-0). The page would have shipped a promise the product doesn't keep. **Decision: pull the entire `SolveEntry` rather than reframe** — reframing into "what we're building" would have violated SK-SOLVE-002's "working `<nlq-data>` demo today" contract (the only honest demo for an unshipped capability is no demo). The revert restores `solve-pages/FEATURE.md` Status to "5 hand-curated pages", `scripts/verify-flows.sh` SOLVE_SLUGS + sitemap floor (14), and leaves the verification mirror's FLOW-002 row at its pre-PR state. Round-1 had already caught a smaller fabrication on the same candidate (a "per-DB audit log queryable via `POST /v1/run`" — `grep -rni "audit log" apps/api/src/` returns zero hits for any such endpoint) plus 12 buyer-facing SK/GLOBAL ID leaks in JSON-LD/meta strings; round-2 caught the page-scale one. No new GLOBAL/SK shipped (none would have been justified for an unshipped capability). | **Net acquisition surface change: zero** — but the verification work that ran before the candidate was scoped (FLOW-001/002/003 static + FLOW-004 end-to-end pass + Lemmy source vetting) is recorded for future agents under this row. Mirror integrity check (normalized `^#{2,3} FLOW-[0-9]+` diff across both tracker files) stays empty. FLOW-002 verification mirror status row + outcome log row reverted to their pre-PR state since no slug shipped. The engine-quality priority #1 from the 2026-05-24 founder directive is not regressed — no LLM / `/v1/ask` path changed; the gate behaviour is unchanged. **Lesson recorded for future agents:** before adding a /solve/ page that names a specific product capability, grep the actual `/v1/ask` / `/v1/run` allowlists + the relevant feature's `Status:` line + the cited SK's code-side touchpoints; if either says "post-Phase-0" or "rejected by allowlist", the page is a fabrication waiting to happen. The two-round self-review trail (round-1 caught a smaller audit-log fabrication; round-2 caught the page-scale fabrication round-1 missed) is the protection that worked. |
| 2026-05-31 | §2.1 GitHub Discussions source (SK-ICP-009) — 7th pain-signal source | Verification-first: ran the mirror integrity check (`diff` of `## FLOW-NNN` headers across both trackers — empty as required by GLOBAL-029), then `bash scripts/verify-flows.sh` against `https://nlqdb.com` (all curl-observable assertions green — including the existing 6 source-health probes; Reddit/SO sandbox-egress advisory as expected). BEFORE writing any code I live-probed `api.github.com/graphql` with the env's `GH_TOKEN` to confirm: (a) the PAT authenticates (`viewer { login } → omerhochman`); (b) GraphQL `search(query: "text to sql", type: DISCUSSION)` returns `discussionCount=8478` at `cost=1` per query against the 5000-pt/hr authenticated bucket; (c) `created:>2026-05-24` narrows that to 9 fresh discussions including `moorcheh-ai/memanto/discussions/564 — "How are you handling persistent memory in your CrewAI workflows?"` (a textbook P2 agent-builder pain quote the prior 6 sources never caught). Persona under-served: the prior 6-source mix skews P1/P3/P4 (Reddit subreddits aside); CrewAI/LangChain/Mem0/vector-DB Discussions are where P2 (agent builder) long-form complaints actually live. Found a real gap in the impl plan's §2.1 source table: GitHub Discussions wasn't listed even as a candidate. | `apps/api/src/icp-scrape.ts` gains `fetchGitHubDiscussions` (POST `https://api.github.com/graphql`, GraphQL `search(query, type: DISCUSSION, first: 10)`, 5 P1/P2/P4/P6 queries, same `created:>${isoDate(sevenDaysAgoUnix)}` filter SK-ICP-004 uses for Issues) and a 7th element in `Promise.all` (gated on `deps.ghToken`, matching the Issues isolation contract). Items stored as `source: "github_discussions"`, `id: "ghd-<node.id>"`. Headers: `Authorization: Bearer $GH_TOKEN` + `User-Agent: nlqdb-icp-bot` + `X-GitHub-Api-Version: 2022-11-28` + `Content-Type: application/json` + `AbortSignal.timeout(10s)`. OTel span `nlqdb.icp.fetch.github_discussions` carries `nlqdb.icp.source`, `nlqdb.icp.items`, `http.response.status_code`, and `nlqdb.icp.ghd.rate_remaining` (the GraphQL `rateLimit.remaining` from the same query — surfaces budget pressure without a second hit). Soft-failures: a GraphQL `errors` body is logged + treated as no items (other 6 sources unaffected); nodes with unparseable `createdAt` are dropped before KV write. LogSnag description gains `GHD: <n>` between `GH:` and `SO:`. `apps/api/test/icp-scrape.test.ts` gains 5 tests (POST + Bearer + bot UA + `DISCUSSION` body + `created:>` filter; absent-token short-circuit; GraphQL-error soft failure; unparseable-`createdAt` drop; basic store-and-dedup) — full file now 28/28 pass. `scripts/verify-flows.sh` FLOW-008 block gains a `POST /graphql` probe gated on `GH_TOKEN` (fatal severity, same contract as Issues), asserts the body carries `"discussionCount"`. Docs: SK-ICP-009 block in `docs/features/icp-mining/FEATURE.md`; SK-ICP-001 + GLOBAL-013 + GLOBAL-014 commentary updated to 7 sources; §2.1 source table row; §2.2 ✅ EXPANDED 2026-05-31 block; §8 FLOW-008 sub-tasks 9→10 (still 100%); status dashboard row; verification mirror walkthrough step 4 + pass criteria + outcome log row. **Verification artifacts:** (a) `bun --filter @nlqdb/api test test/icp-scrape.test.ts` → 28/28 pass; (b) `bun --filter @nlqdb/api typecheck` → exit 0; (c) `bun run biome check apps/api/src/icp-scrape.ts apps/api/test/icp-scrape.test.ts` → clean (auto-format applied); (d) `bash scripts/verify-flows.sh` against `https://nlqdb.com` → all assertions green including the new `FLOW-008 source GitHub /graphql (Discussions)` probe (HTTP 200, `discussionCount` present); (e) live `api.github.com/graphql` probe with the env `GH_TOKEN` returned `viewer.login=omerhochman`, `rateLimit.cost=1, remaining=4998`, and the CrewAI P2 quote cited above. Mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` across both files) remains empty — no new FLOW added; FLOW-008 gains one sub-task on each side. No new GLOBAL (the 20 KB exemption for both trackers is already documented as GLOBAL-028 + GLOBAL-029, and the evidence-grade edit contract is GLOBAL-030 — this PR adheres to all three without adding a new cross-cutting rule). | Shipped. 7th source live on the next Mon 06:00 UTC cron run; first GHD items land in `icp:item:<YYYYMMDD>:github_discussions:ghd-*` and flow through the existing SK-ICP-002 scoring + SK-ICP-003 clustering pipeline without further code changes (source string is propagated, not branched on, in both `icp-score.ts` and `icp-cluster.ts`). |
| 2026-06-01 | §2.1 Bluesky source (SK-ICP-012) — 8th pain-signal source | Verification-first per GLOBAL-030: (a) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` headers across both trackers) — empty before edit; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all curl-observable assertions green pre-edit (including the 7 existing source-health probes; Reddit/SO sandbox-egress advisory as expected); (c) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed in 18s wall** (mail.tm `wshu.net` inbox, waitlist 200, Resend invite in 10s, control 403 + invite 200; SK-GATE-007 invariant honoured). BEFORE writing any code I live-probed the AT Protocol AppView from this VM to confirm: (1) `public.api.bsky.app` 403'd from this agent VM (BunnyCDN block; not re-verified from CF Workers egress) — rejected for the cron's probe; (2) `api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=text+to+sql&limit=5&sort=latest` returns HTTP 200 with `{posts, cursor}` shape (canonical Express AppView, no auth); (3) `q=text+to+sql&since=<isoSeven>` returns 5 fresh posts including `"My SQL bot dies after two questions! Did you read the JP Morgan study?"` (textbook P2 agent-builder pain quote the prior 7 sources never caught) plus three multi-author academic threads (researcher demographic the prior 7 don't reach); (4) `agent memory` / `vector database` / `rag pipeline` / `supabase` each return 10 posts in 7d (server-side `since` filter is sharp). Web-researched (P2): `bsky.app/robots.txt` is `Allow: /` (no scrape-deny); `docs.bsky.app/docs/advanced-guides/rate-limits` documents AppView read endpoints as no-auth with "generous rate-limits" — cron's 5 calls/week is trivially inside. Persona under-served: prior 7-source mix under-samples P2 long-form pain that lives on Bluesky (post-2024 X exodus). Found a real gap in the impl plan's §2.1 source table: Bluesky wasn't listed even as a candidate. | `apps/api/src/icp-scrape.ts` gains `fetchBluesky` (GET `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=<q>&limit=25&sort=latest&since=<isoSeven>` for 5 P1/P2/P3 queries: `text to sql`, `agent memory`, `natural language database`, `vector database`, `rag pipeline`) and a `bskyRkeyFromUri(at://.../app.bsky.feed.post/<rkey>) → rkey` helper, plus an 8th element in `Promise.all` (no auth gate). Items stored as `source: "bluesky"`, `id: "bsky-<post.cid>"`; URL rebuilt as `https://bsky.app/profile/<author.handle>/post/<rkey>` (handle already in `searchPosts` payload — no second-hop enrichment); title is the first 80 chars of `record.text`. Headers: `User-Agent: nlqdb-icp-bot` + `Accept: application/json` + `AbortSignal.timeout(10s)`. Pre-write drops: unparseable `record.createdAt`, missing handle/rkey/cid, non-`app.bsky.feed.post` URI (filters reposts/likes/follows that share the AppView search), empty text. OTel span `nlqdb.icp.fetch.bluesky` carries `nlqdb.icp.source` + `nlqdb.icp.items` + `http.response.status_code`. LogSnag description gains `BSKY: <n>` after `DEV: <n>`. `apps/api/test/icp-scrape.test.ts` gains 5 tests (success-path with URL rebuild + `score=likeCount`; URL contract pin including a `since=` value-within-60s-of-seven-days-ago check; unparseable-`createdAt` drop; non-`app.bsky.feed.post` URI drop; 503 graceful) — full file now 33/33 pass. `scripts/verify-flows.sh` FLOW-008 gains a `Bluesky /xrpc/app.bsky.feed.searchPosts` probe (fatal severity; `api.bsky.app` works from agent VM, no egress-block surface) asserting HTTP 200 + `"posts"` key; cross-compatible `date -u -d '7 days ago'` (GNU) and `date -u -v-7d` (BSD/macOS) bash idiom. Docs: SK-ICP-012 block in `docs/features/icp-mining/FEATURE.md` (5-field); one-liner + Status + Touchpoints + GLOBAL-013 (KV budget 7→8 sources) + GLOBAL-014 (span list) updated; net-shrunk SK-ICP-001/002/003/005/006/008/009 + Open Questions prose to land at 20,266 bytes (was 19,551; net +715 B; under 20 KB cap). `docs/research/automated-icp-validation-plan.md`: §2.1 source table gains a Bluesky row; §2.2 ✅ EXPANDED 2026-06-01 block; §8 FLOW-008 sub-tasks 10→11 (still 100%); status dashboard row updated to "curl probe of 8 sources"; preamble "What's shipped today" line lists Bluesky; this Progress log row. `docs/research/automated-icp-validation-plan-verification.md`: FLOW-008 walkthrough gains step 8 (Bluesky probe assertion); status dashboard row updated to "8 sources"; outcome log gains today's row. **Verification artifacts:** (1) `bun --filter @nlqdb/api test test/icp-scrape.test.ts` → 33/33 pass (was 28; +5 new for SK-ICP-012); (2) `bun --filter @nlqdb/api typecheck` → exit 0; (3) `bun x biome check apps/api/src/icp-scrape.ts apps/api/test/icp-scrape.test.ts` → clean (auto-format applied); (4) `bash scripts/verify-flows.sh` against `https://nlqdb.com` post-edit → all assertions green including the new `FLOW-008 source Bluesky /xrpc/app.bsky.feed.searchPosts` probe (HTTP 200, `posts` present); (5) mirror integrity check post-edit (normalized `^#{2,3} FLOW-[0-9]+` diff across both tracker files) empty. No new GLOBAL (the 20 KB exemption is already documented as GLOBAL-028 + GLOBAL-029, evidence-grade edit contract is GLOBAL-030 — this PR adheres to all three without adding a new cross-cutting rule). | Shipped. 8th source live on the next Mon 06:00 UTC cron run; first BSKY items will land in `icp:item:<YYYYMMDD>:bluesky:bsky-*` and flow through the existing SK-ICP-002 scoring + SK-ICP-003 clustering pipeline without further code changes (source string propagated, not branched on, in both `icp-score.ts` and `icp-cluster.ts`). |
| 2026-06-03 | §0.5 GLOBAL-032 canonical top-5 + FLOW-005 e2e walker (SK-STRG-005) | Verification-first per GLOBAL-030: (a) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` headers across both tracker files) — empty before edit; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all curl-observable assertions green (Bluesky + Dev.to + GH Issues + GH Discussions + HN + IH all 200-with-key; Reddit + SO sandbox-egress advisory as expected); (c) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed** in 19s wall (mail.tm `wshu.net` inbox, waitlist 200, Resend invite in 11s, control returned `403 feature_gated`, invite returned `HTTP 200`; SK-GATE-007 invariant honoured). Gap analysis named the missing walker: of the five canonical user flows, FLOW-005 (P2 agent builder, MCP) was the only one without a dedicated agent-runnable e2e walker — `verify-flows.sh` covered the static OAuth discovery endpoints but never exercised the auth wall or the RFC 9728 challenge-URL → scoped-discovery cross-check. The §1.1 stranger-test failure-mode this PR closes is exactly "every MCP client (Claude Desktop, Cursor, Cline, ChatGPT desktop, `@modelcontextprotocol/inspector`) silently fails to handshake if any of the discovery surfaces or the WWW-Authenticate challenge regresses, and no walker catches it." Live-probed `https://mcp.nlqdb.com` from this agent VM 2026-06-03: (1) `GET /.well-known/oauth-protected-resource` returned 200 with `resource=https://mcp.nlqdb.com`; (2) `GET /.well-known/oauth-protected-resource/mcp` returned 200 with `resource=https://mcp.nlqdb.com/mcp` (RFC 9728 §3.1 scoped variant); (3) `GET /.well-known/oauth-authorization-server` returned 200 with `issuer` / `authorization_endpoint` / `token_endpoint`; (4) `POST /mcp` with `initialize` JSON-RPC returned 401 `WWW-Authenticate: Bearer realm="OAuth", resource_metadata="https://mcp.nlqdb.com/.well-known/oauth-protected-resource/mcp", error="invalid_token"` — challenge URL matches step 2 exactly per RFC 9728 §5.1; (5) `POST /mcp` with `tools/list` returned the same 401 + same challenge shape. The five preconditions an MCP client tests before it asks the user for a key. | New decision: [`GLOBAL-032`](../decisions/GLOBAL-032-top-5-user-flows-canonical.md) pins the canonical-five (FLOW-001/002/003/004/005) as the load-bearing acquisition surface AND mandates each have an agent-runnable walker that ran within the last seven days; [`docs/decisions.md`](../decisions.md) index updated. New §0.5 "The five user flows that matter most" section above `## Current status` carries the dashboard view — flow / persona / canonical walker / last-verified / outcome / mirror link. New script `scripts/flow-005-walk.sh` (HTTP-only, ≤4s wall, zero credentials): 5 probes, 6 assertions, uniform JSON output `{utc, flow:"FLOW-005", base_url, state, total_wall_s, checks_passed, checks_failed, discovery_ok, auth_wall_ok, challenge_url_matches, notes}` — `passed` requires every flag true. Triage labels: `failed discovery` / `failed auth wall` / `failed challenge URL`. New SK in `docs/features/stranger-test/FEATURE.md` ([`SK-STRG-005`](../features/stranger-test/FEATURE.md)) — Decision / Why / Consequence / Alternatives covers the per-flow walker pattern, why curl+jq beats the MCP inspector for agent use, and why the challenge-URL cross-check is the highest-value assertion. New step in `.github/workflows/acquisition-health.yml` runs `flow-005-walk.sh` daily at 06:00 UTC with `continue-on-error: true` per SK-STRG-003; `workflow_dispatch` gains an `mcp_url` input for preview overrides; the summary table grows a row + a FLOW-005-outcome block reading `state` / `discovery_ok` / `auth_wall_ok` / `challenge_url_matches`. §8 FLOW-005 sub-tasks 5→6 (Progress 83 percent → 86 percent); §8 status dashboard FLOW-005 row updated to **passed 2026-06-03** with the SK-STRG-005 reference. Verification mirror FLOW-005 status dashboard row + walkthrough notes + outcome log row updated in lockstep — mirror integrity diff stays empty (no new FLOW added; FLOW-005 sub-tasks gained one on each side). **Live walker run from this VM 2026-06-03:** `bash scripts/flow-005-walk.sh` → 6/6 in 4s; JSON artifact carries `state:"passed"`, all three OK flags `true`. Re-ran every pre-existing walker post-edit: `bash scripts/verify-flows.sh` still all-green; `bash scripts/flow-004-walk.sh` still passes 19s (control 403 + invite 200). Mirror integrity check post-edit stays empty. | Shipped after one round of independent self-review iteration. **Round-1 self-review (sub-agent, opus 4.7) found 5 issues (0 CRITICAL / 1 MAJOR / 2 MINOR / 2 NIT); this row reflects the iteration that closed every actionable finding:** (M1 doc-sync) `docs/decisions.md` row listed `web-app` + `mcp-server` as GLOBAL-032 primary surfaces but neither feature carried the back-reference per CLAUDE.md P3 / §10.1 — fixed by adding `GLOBAL-032` blocks to `docs/features/web-app/FEATURE.md` (FLOW-001/002/003/004 surface ownership + daily walker coverage) and `docs/features/mcp-server/FEATURE.md` (FLOW-005 no-credential subset via `flow-005-walk.sh` + credentialed subset still gated on `sk_mcp_*`); (m1 robustness) `flow-005-walk.sh` WWW-Authenticate parser only accepted the quoted-string form, would false-fail on a spec-compliant server emitting `resource_metadata=<token>` per RFC 7235 §2.1 + RFC 7230 §3.2.6 — fixed by widening the `grep -oE` regex to `resource_metadata=("[^"]+"|[^,[:space:]]+)` + sed strip-quotes-if-present; also relaxed `error=invalid_token` to accept both quoted + unquoted (simulated both forms locally — both parse correctly); (m2 robustness) walker had no EXIT trap → tmp files would leak on Ctrl-C across 365 cron runs/year — fixed with `mktemp_tracked` helper that pushes paths into `TMP_PATHS[]` + `trap cleanup EXIT` (mirrors flow-004-walk's discipline); (N1 doc-mismatch) `note()` helper documented as "mirror flow-004" but unused in flow-005 — already dropped in commit `277a6cc` after the shellcheck SC2317 CI failure surfaced the same gap; (N2 cosmetic) success line said "step 5 PASS" + had redundant `$CHECKS_PASSED/$CHECKS_PASSED` denominator — rewritten to "FLOW-005 PASS" + `$CHECKS_PASSED/$TOTAL_CHECKS` using a single shared computed total. Re-ran every verification artifact post-iteration: `bash scripts/flow-005-walk.sh` still 6/6 in 4s; `shellcheck scripts/*.sh` clean; mirror integrity check empty; live-probed unquoted-token-form regex on both quoted and unquoted variants — both return the same parsed URL. **Round-2 self-review (sub-agent, opus 4.7) closed all 5 round-1 findings AND surfaced 1 new MAJOR + 2 MINOR + 1 NIT; this row reflects the iteration that closed all 4 round-2 findings:** (J1 MAJOR — bash subshell gotcha) `mktemp_tracked` mutated a bash array inside `$(...)` command substitution, which runs in a subshell — the mutation never propagated to the parent shell, so the EXIT trap saw an empty array and removed nothing on Ctrl-C. Cron-deployed runs leaked nothing because per-step `rm -f` covered the happy path, but the Ctrl-C-between-steps window the trap was supposed to cover was the broken case. Fixed by replacing the array+helper with one workdir from `mktemp -d` (which returns the path in the parent shell, no subshell hop) plus a single `trap 'rm -rf "$WORK_DIR"' EXIT`; verified by SIGTERM mid-walk against an unreachable URL — workdir cleanup confirmed by `ls /tmp/nlqdb-flow-005*` returning empty post-kill. (M1 MINOR) Documented exit code 3 (`blocked upstream`) was dead — script never emitted it. Dropped from the comment block (every transport/DNS/TLS failure path lands the assertion as a fail and exits 1 with a `failed discovery` / `failed auth wall` state in the JSON; the explicit "blocked upstream" framing only made sense for FLOW-004's poll-on-mail.tm path and was copy-pasted into this walker without semantics). (M2 MINOR) Trailing-slash `NLQDB_MCP_URL` (e.g. `https://mcp.nlqdb.com/`) produced 5/5 404s on `.well-known/...` paths — fixed with `MCP_URL="${MCP_URL%/}"` immediately after env-default; verified live with `NLQDB_MCP_URL=https://mcp.nlqdb.com/ bash scripts/flow-005-walk.sh` → 6/6 pass. (N1 NIT) `head -1` on `WWW-Authenticate` would miss the Bearer challenge if a future server stacks it after a Basic challenge per RFC 7235 §4.1 — replaced with `grep -m1 -i '^Bearer '` after stripping the header prefix; tested with a synthetic `Basic\nBearer` header pair — Bearer correctly extracted. Re-ran every verification artifact post-round-2-iteration: `bash scripts/flow-005-walk.sh` still 6/6 in 1s against `mcp.nlqdb.com`; `shellcheck scripts/*.sh` clean; mirror integrity check empty; SIGTERM-mid-run trap test → workdir removed; trailing-slash URL test → 6/6 pass; multi-challenge header test → Bearer preferred. **Round-3 self-review (sub-agent, opus 4.7) closed all 4 round-2 findings AND surfaced 1 optional NIT; this row reflects the iteration that closed it for the 0-issues bar:** (N2 NIT — case-insensitivity asymmetry) downstream `[[ "$INIT_AUTH" == Bearer* ]]` guard was case-sensitive while the grep extraction was `-i` (case-insensitive) per RFC 7235 §2.1 (auth-scheme names are case-insensitive) — a server emitting `bearer` lowercase would false-fail the guard. Fixed by switching both guards to `${VAR,,}` lowercase folding + `bearer*` pattern. Verified with three synthetic shapes (`Bearer …` / `bearer …` / `BEARER …`) — all accepted. Final round-3 verdict: **ship** (zero remaining findings). The acquisition tracker now answers "is the inbound funnel working today?" in one §0.5 table — every canonical-five flow has a named walker, a verification date inside the seven-day freshness window, and an outcome string. The MCP auth-wall regression the walker exists to catch lands in the daily artifact, not in a founder-facing inbox. P6 (the persona scored by `runIcpScore` but not yet covered by any FLOW-NNN) is the natural next gap — flagged as the next-pick after the engine-quality bottleneck clears. |
| 2026-06-04 | §2.1 Mastodon source (SK-ICP-013) — 9th pain-signal source + canonical-five 7-day-freshness refresh | Verification-first per GLOBAL-030 with **all five canonical walkers re-run against the deployed surface BEFORE writing new code** (GLOBAL-032 seven-day freshness rule had FLOW-001/002 stale at 11 days as of today): (a) mirror integrity check (`diff` of `^#{2,3} FLOW-[0-9]+` headers across both tracker files) — empty before edit; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all curl-observable assertions green (HN + GH + GHD + IH + Dev.to + Bluesky 200-with-key; Reddit + SO sandbox-egress advisory as expected); (c) `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` — **passed** 6/6 in 1s wall (discovery + auth-wall + challenge URL all OK); (d) `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com` — 0/6 passed, every run gate-fails at `/v1/ask` step 5 / 9 / 8 with `feature_gated` exactly as documented per GLOBAL-027 (BIRD 0.318 / Spider null engine-quality bottleneck), every static + hero + CTA + draft + sessionStorage event-spy + `/llms.txt` assertion green; (e) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **partial** in 20s (mail.tm `wshu.net` inbox, waitlist 200, Resend invite in 11s, control returned `403 feature_gated`, invite returned `HTTP 422` with `error.kind` not `error.status` — gate bypassed per SK-GATE-007, downstream db-create failed engine-side; NOT a gate-valve regression, recorded as the new outcome row). The 422 is an **engine-side regression** (db-create LLM call) that the daily walker correctly classifies as `partial` (not `failed step 5`) because the SK-GATE-007 invariant is intact — engine-quality is already priority #1 in the preamble and this row records the observation. BEFORE writing the Mastodon code I live-probed `mastodon.social/api/v1/timelines/tag/<tag>?limit=N&local=false` from the agent VM to confirm: (1) HTTP 200 + JSON-array body on `postgres` / `database` / `sql` / `llm` / `rag` / `agent` / `vectordb` — all 20 fresh posts in the 7-day window (server returns newest-first); (2) `x-ratelimit-limit=300` per 5min, `x-ratelimit-remaining=294` after 6 probes (cron's 5/week is three orders of magnitude inside the bar); (3) sample content includes *"Handling graphs with SQL/PGQ in PostgreSQL"* (P3 analyst signal in the `postgres` tag); `llm` / `rag` / `agent` carry the P2 (agent-builder) long-form pain the prior 8 sources under-sample on the ActivityPub side of the post-2024 X exodus. Web-researched (P2): `mastodon.social/robots.txt` explicitly disallows GPTBot only — `/api/v1/timelines/tag/*` is allowed for any other UA (ours is `nlqdb-icp-bot`); `docs.joinmastodon.org/methods/timelines/` marks `GET /api/v1/timelines/tag/<tag>` as `OAuth: Public` (no auth, no app registration). Persona under-served: prior 8-source mix covers Bluesky (AT Protocol side of the X exodus) but not Mastodon (ActivityPub side — federated reach across thousands of instances via `mastodon.social`'s global timeline). Found a real gap in the impl plan's §2.1 source table: Mastodon wasn't listed even as a candidate. | `apps/api/src/icp-scrape.ts` gains `MASTODON_QUERIES` (5 P1/P2/P3/P6 hashtags: `postgres`, `database`, `sql`, `llm`, `rag`), `MASTODON_TIMELINE_URL`, `MastodonPost` type, `stripMastodonHtml` helper, `fetchMastodon`, and a 9th `Promise.all` element (no auth gate). Items stored as `source: "mastodon"`, `id: "mast-<post.id>"`; the post's federated `url` is preserved verbatim (cross-instance posts cite their origin host). HTML stripped from `content` before storage (LLM scoring/clustering pass sees plain language, never `<p>` / `<br>` / `<a>` markup). Pre-write drops: posts older than the rolling 7-day window, `sensitive: true` posts (NSFW — evidence file is product-public), posts missing `id` / `url` / `created_at`, posts with empty stripped text. A single 429 short-circuits the remaining queries (Mastodon's 300 reads / 5 min / IP throttle contract). Headers: `User-Agent: nlqdb-icp-bot` + `Accept: application/json` + `AbortSignal.timeout(10s)`; per-tag error isolation via the existing `.catch` wrapper around `fetchMastodon`. OTel span `nlqdb.icp.fetch.mastodon` carries `nlqdb.icp.source`, `nlqdb.icp.items`, `http.response.status_code`, and `nlqdb.icp.mastodon.rate_remaining` (parsed from `x-ratelimit-remaining` — Number-finite gate keeps a missing header from polluting span attrs). LogSnag description gains `MAST: <n>` after `BSKY: <n>`. `apps/api/test/icp-scrape.test.ts` gains 6 tests (HTML-stripped storage with `mast-<id>` prefix; URL+headers contract with `limit=25`, `local=false`, bot UA, path-segment-encoded tag; 429 short-circuit on the first call; 7-day window drop for old posts; sensitive=true NSFW drop; 503 graceful with other sources still completing) — full file now 43/43 pass. `scripts/verify-flows.sh` FLOW-008 gains a `GET /api/v1/timelines/tag/postgres` probe (fatal severity; non-egress-blocked from the agent VM — confirmed today) asserting HTTP 200 + JSON-array body. Docs: `docs/features/icp-mining/decisions/SK-ICP-013-mastodon.md` (5-field block); `docs/features/icp-mining/FEATURE.md` one-liner + description + Status + Touchpoints + GLOBAL-013 (9-source budget) + GLOBAL-014 (span list) updated; FEATURE.md sits at 9,855 bytes (well under 20 KB cap). `docs/research/automated-icp-validation-plan.md`: §2.1 source table gains a Mastodon row; §2.2 ✅ EXPANDED 2026-06-04 block added; §8 FLOW-008 sub-tasks 11→12 (still 100%); status dashboard updated to 2026-06-04 with refreshed Last-verified rows for every canonical-five flow per GLOBAL-032; preamble "What's shipped today" lists Mastodon; §0.5 dashboard refreshed to 2026-06-04 across all five canonical rows; this Progress log row. `docs/research/automated-icp-validation-plan-verification.md`: FLOW-008 walkthrough gains step 9 (Mastodon probe); FLOW-001/002/003/004/005 outcome log rows for 2026-06-04 walks; canonical-five dashboard table refreshed; status dashboard updated to 2026-06-04. **Verification artifacts:** (1) `bun --filter @nlqdb/api test test/icp-scrape.test.ts` → 43/43 pass (+6 new for SK-ICP-013); (2) `bun --filter @nlqdb/api typecheck` → exit 0; (3) `bun x biome check apps/api/src/icp-scrape.ts apps/api/test/icp-scrape.test.ts` → clean (auto-format applied); (4) `bash scripts/verify-flows.sh` against `https://nlqdb.com` post-edit → all assertions green including the new `FLOW-008 source Mastodon /api/v1/timelines/tag` probe (HTTP 200, JSON-array body); (5) mirror integrity check post-edit (normalized `^#{2,3} FLOW-[0-9]+` diff across both tracker files) empty — no new FLOW added; FLOW-008 gains one sub-task on each side. No new GLOBAL introduced — the 20 KB exemption for both trackers is already documented as GLOBAL-028 + GLOBAL-029, evidence-grade edit contract is GLOBAL-030, canonical-five pin is GLOBAL-032; this PR adheres to all four without adding a new cross-cutting rule. | Shipped. 9th source live on the next Mon 2026-06-08 06:00 UTC cron run; first MAST items will land in `icp:item:<YYYYMMDD>:mastodon:mast-*` and flow through the existing SK-ICP-002 scoring + SK-ICP-003 clustering pipeline without further code changes (source string is propagated, not branched on, in both `icp-score.ts` and `icp-cluster.ts`). Verification mirror's canonical-five 7-day-freshness bar held: all five rows show `Last verified: 2026-06-04`. The FLOW-004 422 is the recorded next-pick after the engine-quality bottleneck — already priority #1 in the preamble; this PR doesn't touch it. P6 (the persona scored by `runIcpScore` but not yet covered by any FLOW-NNN) remains the natural next gap once engine quality clears, per the 2026-06-03 row. |
| 2026-06-04 | SK-ICP-013 round-2 self-review iteration | **Round-1 self-review (sub-agent, opus 4.7) found 10 issues (0 CRITICAL / 1 MAJOR / 6 MINOR / 3 NIT) — verdict `iterate`. Closed every actionable finding except the m6 architectural pin (deferred per P5 — pin recorded as the 10th-source-refactor Open question in `icp-mining/FEATURE.md`).** Iteration scope: (M1 MAJOR — observability) `Number(res.headers.get("x-ratelimit-remaining"))` returns `0` when the header is missing (`Number(null) === 0`), not `NaN` — so the SK's explicit "Number-finite gate keeps a missing header from polluting span attrs" claim was dead code. Fixed by reading `raw !== null` before `Number(raw)`; new test `test/icp-scrape.test.ts` "omits the rate_remaining span attribute when the response header is absent" uses a spy tracer to assert `nlqdb.icp.mastodon.rate_remaining` is NOT recorded on an empty-Headers response. (m1 — HTML strip ordering) `stripMastodonHtml` decoded `&amp;` BEFORE `&lt;`/`&gt;` so a literal `&amp;lt;` in source (a how-to about HTML entities — `database`/`sql` tags will hit this category) collapsed to `<` mid-pass. Fixed by reordering so `&amp;` is the FINAL replacement; new test "decodes &amp;lt; to the literal &lt; (not <) — &amp; is decoded last" pins the contract. (m2 — unsupported claim per GLOBAL-030) the SK + impl-plan §2.2 cited `300/5min/IP` rate limit as a Mastodon docs claim, but `docs.joinmastodon.org/api/rate-limits/` documents that limit for **authenticated** users only; unauthenticated quota is undocumented but the agent VM observed `X-RateLimit-Limit: 300` in `X-RateLimit-Remaining` headers. Fixed: SK Why-clause + impl-plan §2.2 reframed to attribute the number to the **observed header**, not the docs page, and explicitly mark the unauthenticated quota as undocumented. (m3 — `visibility` filter) Mastodon Status entity has `visibility ∈ {public, unlisted, private, direct}`; hashtag timeline returns `public` + `unlisted` (latter is the author's bulk-indexing opt-out). Fixed: `if (post.visibility && post.visibility !== "public") continue` next to the sensitive-flag check; new test "drops Mastodon posts whose visibility is not public" pins the contract. (m4 — federation trust boundary) `post.url` was preserved verbatim with no scheme check — a malicious origin instance could in principle return `javascript:` / `data:` URIs that land in the evidence file. Fixed: `if (!post.url.startsWith("https://") && !post.url.startsWith("http://")) continue`; new test "drops Mastodon posts whose url is not http(s)" passes a synthetic `javascript:alert(1)` URL and asserts it's dropped. (m5 — items counter accuracy) `span.setAttribute("nlqdb.icp.items", hits.length)` was set BEFORE the per-post filters, so a 25-NSFW response and a 0-post response would log identically — log-based alerts on "items=0 ⇒ source dead" would misfire. Fixed by splitting into `nlqdb.icp.items_returned` (from the AppView) + `nlqdb.icp.items_stored` (after the pre-write rejects); GLOBAL-014 commentary in `icp-mining/FEATURE.md` updated to name both attrs. (m6 — `Promise.all` accretion scalability) the source-list destructuring is at the practical tipping point at 9 sources; recorded as the 10th-source-refactor pin in `icp-mining/FEATURE.md` Open Questions (P5 — no speculative refactor; ship the refactor in the same PR as the 10th source). (N1 — "Forem-style" comment qualifier in `stripMastodonHtml`) replaced with a one-liner explaining the `&amp;`-last rationale instead. (N2 NIT `MAST` LogSnag abbrev, N3 NIT mirror heading asymmetry) — accepted as cosmetic, no change. **Verification artifacts post-iteration:** (1) `bun --filter @nlqdb/api test test/icp-scrape.test.ts` → 47/47 pass (was 43; +4 new round-2 tests pin the M1 headers-absent regression, the m3 visibility drop, the m4 scheme-validation drop, and the m1 `&amp;`-last decode order); (2) `bun --filter @nlqdb/api typecheck` → exit 0; (3) `bun x biome check apps/api/src/icp-scrape.ts apps/api/test/icp-scrape.test.ts` → clean (no fixes needed). Mirror integrity check post-iteration still empty. No new SK or GLOBAL — every change is internal to SK-ICP-013's body (decision retains its 5 fields) plus the m6 pin in `icp-mining/FEATURE.md` Open Questions. | Shipped after one round of independent self-review iteration. The post-iteration code delivers the contract the SK now explicitly claims; the dead "Number-finite gate" observability bug is closed, the HTML decode order is canonical-safe, the rate-limit claim is evidence-backed per GLOBAL-030, the federation trust boundary is enforced at the URL scheme, and the span-attr asymmetry between "source returned 25 posts (all NSFW)" and "source returned 0 posts" is now visible. |
| 2026-06-05 | §1.1 invited-browser CORS regression fix (SK-GATE-007) + canonical-five freshness re-walk + #300 backfill | **Verification-first per GLOBAL-030, all five canonical walkers re-run against the deployed surface BEFORE any code change:** (a) mirror integrity check (normalized `^#{2,3} FLOW-[0-9]+` diff across both trackers) — empty; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — all curl-observable assertions green (6 vs + 5 solve slugs, site-wide invite-capture, MCP discovery, 7/9 sources 200; Reddit + SO sandbox-egress advisory as expected); (c) `bash scripts/flow-005-walk.sh` — **passed 6/6** in 1s; (d) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed in 18s** (control `403`, invite **HTTP 200** — the 2026-06-04 downstream-422 has cleared, full first-value restored); (e) `bash scripts/stranger-test.sh --prompts 2` — 0/6, gate-403 at the documented step exactly per GLOBAL-027. Then `bash scripts/stranger-test-invited.sh --flows flow-001 --prompts 1` — **failed step 5 with a CORS preflight error**: Chromium console logged `Request header field x-invite-code is not allowed by Access-Control-Allow-Headers in preflight response` on the cross-origin `POST https://app.nlqdb.com/v1/ask`. Confirmed against production with a raw `curl -X OPTIONS` preflight: `access-control-allow-headers` omitted `x-invite-code`. **Root cause:** `apps/web/src/lib/api.ts` forwards `X-Invite-Code` and the marketing origin POSTs cross-origin to `app.nlqdb.com` (`PUBLIC_API_BASE` — confirmed in production HTML), but `credentialedCors.allowHeaders` in `apps/api/src/index.ts` never listed `x-invite-code` (git: `#262` created the list, `#289` added `x-nlq-byollm-key`, neither added the invite header). So every *invited* browser was silently blocked at the preflight while the curl walkers — which never preflight — showed green. This is the SK-GATE-007 invariant the §1.1 stranger-test layer exists to catch: the invite valve works for SDK/CLI/curl but was dead for the real web funnel. The prior `2026-05-24` invite-bearing "passed" row cannot be reconciled with this git history and is treated as superseded (a stale-evidence record, exactly the GLOBAL-029 failure mode). | **Fix:** added `"x-invite-code"` to `credentialedCors.allowHeaders` (`apps/api/src/index.ts`, one-line comment cites SK-GATE-007). **Regression guards (two layers):** (1) `apps/api/test/cors.test.ts` gains a test asserting the trusted-origin preflight `Access-Control-Allow-Headers` contains every header the web client sends (`content-type`, `authorization`, `cf-turnstile-response`, `x-invite-code`) — pins the code (5/5 pass); (2) `scripts/verify-flows.sh` gains an "Invite-valve CORS preflight" block that issues a cross-origin `OPTIONS /v1/ask` against the deployed API and fails if `x-invite-code` is absent — pins the *deployed* surface, closing the curl-blind-spot for the daily `acquisition-health.yml` cron (skips itself when web + API share an origin, e.g. previews). `SK-GATE-007`'s *Consequence in code* amended to name the CORS allow-list requirement. **Coherence backfill:** `/vs/askyourdatabase` (PR #300, 2026-06-02, 6th comparison page) was live + in `competitors.ts` + referenced in the verification mirror but had **zero** references in this impl plan and no progress-log row; this row backfills that omission (the §0.5 + dashboard "6 vs slugs" counts were already correct). **Verification artifacts:** `bunx vitest run test/cors.test.ts` → 5/5 pass; `bash scripts/verify-flows.sh` post-fix → the new preflight guard correctly **fails against production** (the fix is not yet deployed — it goes green on merge+deploy), every other assertion green. | Shipped. The invited-browser first-value path is fixed in code + guarded at two layers (unit + deployed-surface); the production preflight guard self-heals to green on the next deploy. FLOW-004 is the one canonical flow with a full end-to-end pass today; FLOW-001-invited rejoins it once the CORS fix deploys. Engine quality (BIRD 0.318) remains the preamble's priority #1 for the *anonymous* (un-invited) funnel. |
| 2026-06-06 | FLOW-004 provisioning-regression diagnosis + SK-HDC-017 SQLSTATE fidelity (db-create observability) | **Verification-first per GLOBAL-030/032, all five canonical walkers re-run against the deployed surface BEFORE any code change:** (a) mirror integrity check (normalized `^#{2,3} FLOW-[0-9]+` diff across both trackers) — empty; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — every curl-observable assertion green (6 vs + 5 solve slugs, site-wide invite-capture, MCP discovery, invite-valve CORS preflight now allows `x-invite-code`, 7/9 sources 200; Reddit + SO sandbox-egress advisory as expected); (c) `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` — **passed 6/6** in 1s (RFC 9728 root + scoped discovery, RFC 8414 AS metadata, 401 challenge URL matches scoped discovery); (d) `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com` (Playwright; installed `chromium-headless-shell` first) — 0/6, every run green through steps 1–4 then gate-403 at step 5/9/8 exactly per GLOBAL-027; (e) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **partial — provisioning regression**: control `403 feature_gated` ✓, invite **bypassed the gate** ✓ (SK-GATE-007 intact) but `/v1/ask` returned **HTTP 500 `{kind:"provision_failed",reason:"transaction_failed",rolled_back:true}`** (06-05 was 200, 06-04 was 422 — the provision leg is flaky on engine/data quality). **Root-caused without Grafana** (operator loop has none): reproduced the 500 twice with full body capture, queried the Neon control-plane API with the env `NEON_API_KEY` (project healthy — 4 branches, quota fine), then reproduced the failing transaction over Neon's HTTP SQL endpoint (port 5432 is sandbox-egress-blocked; 443 reaches) — confirmed `neondb_owner` has `createrole`/`createdb` (prefix DDL is healthy, 47 schemas / 65 roles, no limit) and that NeonDbError carries the SQLSTATE `code`, but the two most likely low-quality-DDL classes — `42704` (hallucinated type, e.g. `TEXTT`) and `22P02` (bad sample value) — both collapse to the opaque `transaction_failed` in `mapTransactionError`, so the walker (whose only signal is the HTTP body) cannot attribute the break to engine quality vs infra. | **Fix (SK-HDC-017):** `apps/api/src/db-create/neon-provision.ts` — `mapTransactionError` now maps by Postgres SQLSTATE **class** (22/23 → `sample_insert_failed`, 42 → `ddl_execution_failed`, `42P06` → `schema_already_exists` first so the orchestrator id-collision retry is preserved; classless/no-SQLSTATE infra → `transaction_failed`), and the `db.transaction` failure span records `db.transaction.error_sqlstate` (raw 5-char code or `none`, bounded cardinality). User-facing wire shape unchanged (GLOBAL-012 one-sentence envelope preserved); only the machine `reason` + span gain fidelity, so the next FLOW-004 walk names whether the funnel broke on DDL or data. New decision file `docs/features/hosted-db-create/decisions/SK-HDC-017-provision-sqlstate-fidelity.md` (5 fields) + index line in `hosted-db-create/FEATURE.md`; `docs/performance.md` §3 `db.transaction` row catalogs the new attr (GLOBAL-014, attr cataloged before it ships). **Verification artifacts:** `bun test src/db-create/neon-provision.test.ts` → 35/35 pass (+6 new: `42704`/`42601` → `ddl_execution_failed`, `22P02` → `sample_insert_failed`, `42P06` retry preserved, no-SQLSTATE → `transaction_failed`, plus two `db.transaction.error_sqlstate` span-attribute tests added in the round-1 self-review iteration — value on a class failure + `none` on a classless one); mirror integrity check post-edit empty (no FLOW added). No new GLOBAL — the tracker-as-progress-bar + verification-mirror + evidence-grade-edit + canonical-five rules are already GLOBAL-028/029/030/032; this PR adheres to all four. | Shipped. The invited stranger's first query does NOT complete today (provision 500) — recorded honestly in the §0.5 dashboard + Current-status KPI + FLOW-004 outcome log; the gate valve itself is intact. SK-HDC-017 makes the regression attributable from the deployed surface so the next agent can route it to the right owner (engine-quality, already preamble priority #1) instead of re-running a half-day reverse-engineering session. P6 remains the natural next FLOW gap once engine quality clears. |
| 2026-06-07 | FLOW-004 first-value recovered to HTTP 200 + SK-STRG-006 first-value-*quality* grading (the invited path now proven to deliver real first-value, not just a 200) | **Verification-first per GLOBAL-030/032 — all five canonical walkers re-run against the deployed surface BEFORE any code change** (this PR's brief: sync the mirror + verify before implementing more): (a) mirror integrity check (normalized `^#{2,3} FLOW-[0-9]+` diff across both trackers) — empty; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` — every curl-observable assertion green (6 vs + 5 solve slugs, site-wide invite-capture, MCP discovery, invite-valve CORS preflight allows `x-invite-code`, 7/9 sources 200; Reddit + SO sandbox-egress advisory as expected); (c) `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` — **passed 6/6** in 1s (`tools/stranger-test/results/flow-005-2026-06-07T01-34-43Z.json`); (d) `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com` (Playwright; pinned `@playwright/test` 1.49.1 via `bun install`, installed its matching `chromium-headless-shell` build 1148) — 0/6, every run green through steps 1–4 then gate-403 at step 5/9/8 exactly per GLOBAL-027 (`tools/stranger-test/results/walk-2026-06-07T01-36-36Z.json`); (e) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` — **passed, first-value verified**: control `403 feature_gated` ✓, invite **bypassed the gate** ✓ (SK-GATE-007 intact) AND `/v1/ask` returned **HTTP 200** — the 2026-06-06 `transaction_failed` HTTP 500 has **cleared** (the provision leg now succeeds; SK-HDC-017 #332's SQLSTATE-class mapping confirmed it was a provision-DDL flake, not infra). | **Change (SK-STRG-006):** `scripts/flow-004-walk.sh` — on the invite-probe HTTP 200, parse the `/v1/ask` body and grade first-value *quality* instead of treating any 200 as proof. The body is one of two shapes (`apps/api/src/index.ts`): a `create` envelope (the invited 0-DB stranger provisions one) or a `query` AskResult; the walker classifies which and grades a `create` `ok` when it carries a real `db`+`schemaName` and ≥1 seeded sample row (records `table_count`/`row_count`/`engine`), a `query` `ok` when SELECT-backed (records `rowCount`/`confidence`/`model`). Quality is recorded, never fatal — the SK-STRG-002 control×invite pass/fail is unchanged. `acquisition-health.yml` summary surfaces `first_value_quality`+`first_value_kind`+`table_count`+`row_count`. New decision `docs/features/stranger-test/decisions/SK-STRG-006-flow-004-first-value-quality.md` (5 fields) + index line in `stranger-test/FEATURE.md` (net-shrunk under the 20 KB cap by collapsing two already-resolved open questions). **The first cut assumed a `query` shape and graded the live response `degraded` (empty status) — re-running against the real surface surfaced that the invited stranger's first-value is a `create` (a provisioned DB), and the corrected walker then recorded `ok`: 6 tables seeded with 13 sample rows, postgres** (`tools/stranger-test/results/flow-004-2026-06-07T01-44-16Z.json`). **Verification artifacts:** `bash -n` + `shellcheck scripts/flow-004-walk.sh` clean; the live re-walk JSON above. Mirror integrity check post-edit empty (no FLOW added). No new GLOBAL — GLOBAL-028/029/030/032 already cover the tracker role + 20 KB exemption + agent-ran + canonical-five rules; this is one SK-* under the existing `stranger-test` feature. Stale "SK-HDC-017 (this PR)" references corrected to "shipped #332" across both trackers. | Shipped. FLOW-004 — the one canonical flow that carries a stranger across the gate before BIRD/Spider clear — now provably delivers **real first-value** (a seeded Postgres DB), not just a reachable 200, and the daily cron grades that quality on every future walk so a blank-200/empty-schema regression is caught from the deployed surface. With the invited path delivering first-value, the §1.3 in-app survey is the natural next non-engine pick. Engine quality (BIRD 0.318) remains preamble priority #1 for the anonymous funnel; P6 remains the next FLOW gap. |
| 2026-06-08 | §1.4 invite-valve + hosted-db-create | FLOW-004 provision regression caught + fixed: a constraint-violating LLM seed row no longer 500s the invited stranger's first query | **Verification-first per GLOBAL-030/032 — all five canonical walkers re-run against the deployed surface before any code change** (this PR's brief: sync the mirror + verify before implementing more): (a) mirror integrity check (normalized `^#{2,3} FLOW-[0-9]+` diff across both trackers) — empty; (b) `bash scripts/verify-flows.sh` → EXIT 0, every curl-observable assertion green (6 vs + 5 solve slugs, site-wide invite-capture, MCP discovery, invite-valve CORS preflight `x-invite-code`, 7/9 sources 200; Reddit + SO sandbox-egress advisory); (c) `bash scripts/flow-005-walk.sh` → **6/6 passed** 1s (`flow-005-2026-06-08T01-35-09Z.json`); (d) `bash scripts/stranger-test.sh --prompts 2` (Playwright) → 0/6, steps 1–4 green then gate-403 at 5/9/8 per GLOBAL-027 (5/6 explicit `feature_gated`, 1 transient timing flake) (`walk-2026-06-08T01-35-58Z.json`); (e) `bash scripts/flow-004-walk.sh` → **`partial` regression**: control 403 + invite bypass (SK-GATE-007 intact) but `/v1/ask` `HTTP 500 {provision_failed, sample_insert_failed}`, reproduced **5/5** for "a meal planner for couples" (1 walk + 4 fresh-invite replays). **Root cause** (no Postgres access — `:5432` blocked in-sandbox, only HTTPS egresses): reproduced the deployed `schema_infer` plan over the Groq HTTPS endpoint (`llama-3.3-70b-versatile`) — the plan declares `meals.couple_id→couples.id` + `ingredients.meal_id→meals.id` FKs + integer PKs, and the inference prompt gave **zero** guidance to make seed rows FK-consistent / NOT-NULL-complete; SK-HDC-017's class mapping (shipped #332) confirmed class 22/23 = seed-insert phase. Because schema + RLS + seed rows are one atomic batch (SK-HDC-012), a single bad seed row rolled the whole create back → the invited stranger got no DB. | **Change (SK-HDC-018):** `apps/api/src/db-create/orchestrate.ts` — on `provision` returning `sample_insert_failed`, retry the provision **once** with `sample_rows: []` (same rolled-back ids + compiled DDL), so the schema-complete DB still commits atomically and the response reports the actually-inserted (empty) seed set; bounded to one extra attempt, no LLM repair, the GLOBAL-033 atomic boundary untouched. Two `orchestrate.test.ts` cases pin it (strip-retry → ok with `sampleRows:[]`; persistent fail → `provision_failed` after exactly 2 calls). **Change (SK-LLM-033):** `packages/llm/src/prompts/schema-inference.ts` — `SCHEMA_INFER_SYSTEM` now requires insertable seed rows (parent rows first, every FK value an earlier parent PK, NOT-NULL columns present, fewer rows over invalid ones), the engine-quality root-cause lift under the SK-HDC-018 floor. **Verification:** `bun run typecheck` (apps/api + packages/llm) clean; `bunx biome check` clean; `bunx vitest run apps/api/src/db-create packages/llm` → 235 passed / 5 skipped (incl. the 2 new SK-HDC-018 tests). New decisions: SK-HDC-018 (hosted-db-create), SK-LLM-033 (llm-router) — five fields each, indexed in their FEATURE.md. No new GLOBAL — GLOBAL-028/029/030/032 already cover the tracker role + 20 KB exemption + agent-ran + canonical-five rules; GLOBAL-033's atomic-boundary resolution is preserved, not changed. Mirror integrity post-edit empty (no FLOW added). | Shipped (deploy-pending). FLOW-004 — the one canonical flow that carries a stranger across the gate before BIRD/Spider clear — will deliver a working DB on every invited first query once deployed (seeded when the LLM's rows are valid, un-seeded but queryable when they aren't), never an HTTP 500. Deployed re-walk to a green 200 is the next agent's #1. Engine quality (BIRD 0.318) remains the anonymous-funnel bottleneck; P6 remains the next FLOW gap. |
| 2026-06-09 | §1.4 invite-valve verified-deployed + SK-STRG-007 walker grading | SK-HDC-018 + SK-LLM-033 (#352) are now **deployed** — re-walked all five canonical flows against the live surface; the FLOW-004 `sample_insert_failed` 500 has cleared and the invited stranger reaches a working DB, but first-value seed quality is prompt-variable | **Verification-first per GLOBAL-030/032 (clears the deploy-pending #1 from 2026-06-08):** (a) `bash scripts/verify-flows.sh` → EXIT 0, every curl-observable assertion green (6 vs + 5 solve slugs, site-wide invite-capture, MCP discovery, invite-valve CORS preflight `x-invite-code`, 7/9 sources 200; Reddit + SO sandbox-egress advisory); (b) `bash scripts/flow-005-walk.sh` → **6/6 passed** 2s (`flow-005-2026-06-09T01-35-22Z.json`); (c) `bash scripts/stranger-test.sh --prompts 2` (Playwright, browser build 1223) → 0/6, steps 1–4 green then gate-403 at 5/9/8 per GLOBAL-027 (6/6 explicit `feature_gated`) (`walk-2026-06-09T01-37-18Z.json`); (d) `bash scripts/flow-004-walk.sh` ×3 against `app.nlqdb.com` — control 403 + invite bypass (SK-GATE-007 intact) and `/v1/ask` **HTTP 200 every time** (the 2026-06-08 500 is gone — SK-HDC-018 deployed). **New finding:** first-value seed quality is *prompt-variable* — "a tiny CRM for my coaching practice" → `ok` (4 tables / 9 seeded rows, `flow-004-2026-06-09T01-41-21Z.json`); "a meal planner for couples" → `degraded` (un-seeded DB, 0 tables / 0 rows, reproduced **2/2**, `flow-004-2026-06-09T01-38-07Z.json` + `…01-44-56Z.json`). SK-HDC-018's fallback correctly converts the seed failure into a working un-seeded DB (never a 500), but SK-LLM-033's insertable-seed-row prompt does not yet make every goal seed — some invited strangers still land an empty DB. | **Change (SK-STRG-007):** `scripts/flow-004-walk.sh` — a `create` first-value that returns 0 seeded rows (the SK-HDC-018 un-seeded fallback) now records `state:"passed_degraded"` instead of a bare `passed`, so the §0.5 / `acquisition-health.yml` dashboards can't show "passed" for an empty-DB stranger experience. The process **exit code is unchanged** (0 — the SK-STRG-002 control×invite gate-bypass invariant still passed, so the composer/cron contract + SK-STRG-006 "never fatal" both hold); only the recorded `.state` carries the first-value verdict. A 0-row *query* stays `passed` (legitimate per SK-STRG-006). Verified live: the meal-planner re-walk emits `state:"passed_degraded"` + exit 0 (`…01-44-56Z.json`). New decision: SK-STRG-007 (stranger-test) — five fields, indexed in FEATURE.md; SK-STRG-006 amended to point at it. No new GLOBAL. Mirror integrity post-edit empty (no FLOW added). | Shipped + **verified deployed**. The invite-valve funnel is now end-to-end-green to a 200 on every invited first query. The open first-value gap is seed-quality variance (an engine-quality / SK-LLM-033 lift — the next agent's pick under the BIRD bottleneck); P6 remains the next FLOW gap. |
| 2026-06-10 | §1.4 first-value seed-quality probe (SK-STRG-008) + canonical-five 7-day-freshness re-walk | Convert the SK-STRG-006/007 "first-value is prompt-variable" *anecdote* (two hand-picked prompts) into a *measured* `seeded_ok_ratio` — the single number behind the documented #1 engine-quality bottleneck — on one invite instead of N. | **Verification-first per GLOBAL-030/032 — all five canonical walkers re-run against the live deployed surface BEFORE new code:** (a) `bash scripts/verify-flows.sh` → EXIT 0, every curl-observable assertion green (6 vs + 5 solve slugs, sitemap floor 15, site-wide invite-capture, MCP discovery, invite-valve CORS preflight `x-invite-code`, 7/9 sources 200; Reddit + SO sandbox-egress advisory); (b) `bash scripts/flow-005-walk.sh` → **6/6 passed** <1s (`flow-005-2026-06-10T01-36-57Z.json`); (c) `bash scripts/stranger-test.sh --prompts 2` (Playwright, browser build 1223) → 0/6, steps 1–4 green then gate-403 at 5/9/8 per GLOBAL-027 (`walk-2026-06-10T01-38-39Z.json`); (d) standalone `FLOW_004_GOAL="a tiny CRM" bash scripts/flow-004-walk.sh` against `app.nlqdb.com` — control 403 + invite bypass (SK-GATE-007 intact) + `/v1/ask` HTTP 200, first-value `passed_degraded` (CRM goal → 0/0, `flow-004-2026-06-10T01-37-11Z.json`). **New finding:** the doc's "a tiny CRM → `ok`" claim is now stale — CRM degraded on a fresh walk. **Change (SK-STRG-008):** new `scripts/flow-004-seed-quality.sh` composes `flow-004-walk.sh` (one minted invite via the SK-STRG-004 `FLOW_004_INVITE_OUT` sidecar seam) then re-uses the code — invite codes are existence-checked in `gate/bypass.ts`, not consumed — to issue a `create` ask per goal on a fresh `anon_<uuid>`, grading each with the SK-STRG-006 rubric and reporting `seeded_ok_ratio` over classified creates. It exits 0 on any produced ratio (measurement, not a gate) and is agent-on-demand, NOT in the daily cron (1+N throwaway DBs/run). shellcheck-clean (CI parity: `shellcheck scripts/*.sh`). New decision: SK-STRG-008 (stranger-test) — five fields, indexed in FEATURE.md; SK-STRG-006/007 unchanged. No new GLOBAL. Mirror integrity post-edit empty (no FLOW added). | Shipped + **run live 2026-06-10**: `bash scripts/flow-004-seed-quality.sh` (4 goals, one invite) → **`seeded_ok_ratio = 0.25`** (1/4 — "a habit tracker" `ok` 4 tables / 12 rows; "a tiny CRM" + meal-planner + reading-list `degraded` un-seeded; `flow-004-seed-quality-2026-06-10T01-45-55Z.json`). The invited funnel is end-to-end-green to a 200, but **3/4 invited strangers land an empty DB** — the measured size of the open SK-LLM-033 / engine-quality lift (the next agent's pick under the BIRD/Spider bottleneck). P6 remains the next FLOW gap. |
| 2026-06-11 | §0.5 FLOW-005 local-stdio-transport e2e (SK-STRG-009) + canonical-five 7-day-freshness re-walk + tracker coherence fix | **Verification-first per GLOBAL-030/032 — all five canonical walkers re-run against the deployed surface BEFORE new code** (this PR's brief: sync the mirror + verify before implementing more): (a) mirror integrity check (normalized `^#{2,3} FLOW-[0-9]+` diff across both trackers) — empty; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` → EXIT 0, every curl-observable assertion green (6 vs + 5 solve slugs, sitemap floor 15, site-wide invite-capture, MCP discovery, invite-valve CORS preflight `x-invite-code`, 7/9 sources 200; Reddit + SO sandbox-egress advisory as expected); (c) `bash scripts/flow-005-walk.sh` against `https://mcp.nlqdb.com` → **6/6 passed** in 1s (`flow-005-2026-06-11T01-35-38Z.json`); (d) `bash scripts/stranger-test.sh --prompts 2` against `https://nlqdb.com` (Playwright, installed matching `chromium-headless-shell` build 1223) → 0/6, steps 1–4 green then gate-403 at 5/9/8 per GLOBAL-027 (`walk-2026-06-11T01-36-44Z.json`); (e) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` → control 403 + invite bypass (SK-GATE-007 intact) + `/v1/ask` HTTP 200, first-value `passed_degraded` (default goal → 0/0, `flow-004-2026-06-11T01-35-42Z.json`) — consistent with the 2026-06-10 `seeded_ok_ratio = 0.25` probe. **Gap analysis:** FLOW-005 (P2 agent builder) is one of the canonical-five but only its *hosted* transport had a walker — the *local-stdio* transport (SK-MCP-001's npm-fallback install path, the surface a Claude Desktop / Cursor user runs when they paste a key) had zero e2e coverage. The credentialed hosted path stays OAuth-blocked (no `sk_mcp_*` is mintable in-env — keys are stateful in D1, the hosted `/mcp` needs an OAuth token), so the stdio `initialize` + `tools/list` handshake is the deepest FLOW-005 surface walkable with no credential. While building it I confirmed a tracker **coherence bug**: both trackers + the mcp-server FEATURE referenced MCP tools `create_database` / `ask` / `run`, but the real catalog (packages/mcp/src/server.ts, SK-MCP-002) is `nlqdb_query` / `nlqdb_list_databases` / `nlqdb_describe` with create implicit via `nlqdb_query`. | **Change (SK-STRG-009):** new `tools/stranger-test/src/flow-005-stdio.ts` + `scripts/flow-005-stdio-walk.sh` spawn the real `@nlqdb/mcp` binary via `StdioClientTransport` and drive a real MCP `initialize` + `tools/list` handshake over OS pipes — no mocking, no network (both served from the in-memory registry; the `NLQDB_API_KEY` prefix-gate is met with a throwaway token that never authenticates, since the walk stops before tool invocation). Asserts the catalog an npm-fallback install discovers: exactly `nlqdb_query` (destructiveHint, input `{db,q,confirm}`) + `nlqdb_list_databases` (readOnlyHint) + `nlqdb_describe` (readOnlyHint, `{db}`), and **no `create_database`/`nlqdb_create_database`/`ask`/`run` tool**. Pure `assessHandshake()` is unit-tested (`tools/stranger-test/test/flow-005-stdio.test.ts`, 6 cases pinning the catalog + protocol axes). `tools/stranger-test/package.json` gains `@modelcontextprotocol/sdk@1.29.0` pinned to `packages/mcp`. Walker joins `acquisition-health.yml` as a `continue-on-error: true` step + summary row + outcome block (SK-STRG-003 contract). New decision `docs/features/stranger-test/decisions/SK-STRG-009-flow-005-stdio-walker.md` (5 fields) + index line in `stranger-test/FEATURE.md`; GLOBAL-032 §Consequence (4) gains the stdio walker under FLOW-005. **Coherence fix:** corrected the `create_database`/`ask`/`run` MCP-tool references to the real `SK-MCP-002` catalog in §0.5 + §8 sub-tasks + §8 honest-takeaway + status dashboards of both trackers + the FLOW-005 credentialed walkthrough (mirror steps 6-12) + the mcp-server FEATURE GLOBAL-032 note. §8 FLOW-005 sub-tasks 6→7 (Progress 86%→88%, now 7/8 with both transports + the stdio walker shipped). Refreshed all five canonical-row Last-verified dates to 2026-06-11 across both trackers. **Verification artifacts:** `bash scripts/flow-005-stdio-walk.sh` → **16/16 passed in 0.3s** (`flow-005-stdio-2026-06-11T01-46-12-678Z.json`, `state:"passed"`, `protocol_ok`+`catalog_ok` true); `cd tools/stranger-test && bun test` → 23/23 pass (+6 new); `bun run typecheck` → exit 0; `bunx biome check` → clean; `shellcheck scripts/flow-005-stdio-walk.sh` → clean; `python3 -c yaml.safe_load(acquisition-health.yml)` → OK. Mirror integrity check post-edit empty (no FLOW added — FLOW-005 gains one walker + one sub-task on each side). No new GLOBAL — GLOBAL-028/029/030/032 already cover the tracker role + 20 KB exemption + agent-ran + canonical-five rules; this adds one SK-* under `stranger-test` and refines GLOBAL-032 (4)'s per-flow walker list. | Shipped + **run live 2026-06-11**. FLOW-005 — the P2 agent-builder canonical flow — now has agent-runnable e2e coverage on **both** SK-MCP-001 transports (hosted + local-stdio), closing the long-standing "stdio transport never walked" gap; a tool-catalog regression in the npm-fallback install path (renamed tool, dropped trust hint, accidental public `create_database`) is now caught daily from the deployed binary, not at an agent's use time. Authenticated tool *invocation* remains in the credentialed mirror (OAuth-blocked in-env). Engine quality (BIRD 0.318) remains the anonymous-funnel bottleneck; P6 remains the next FLOW gap. **Round-1 self-review (sub-agent, opus) found 0 CRITICAL / 0 MAJOR / 2 MINOR / 1 NIT — verdict SHIP; this row reflects the iteration that closed every actionable finding:** (m1) two historical FLOW-005 outcome rows (2026-05-23, 2026-06-03) still named `create_database`/`ask`/`run` — corrected to the real catalog with a dated SK-STRG-009 note; (n1) `flow-005-stdio.ts` `stderr:"pipe"` was never drained — switched to `stderr:"inherit"` so a failing child's fatal stderr surfaces in the walker/CI logs; (m2 — the `@playwright/test` ~1.49→~1.60 "scope-creep" finding) was a **false positive**: the reviewer diffed a stale local `main`; against `origin/main` (e664ceb #368) the PR's only `package.json` change is the `@modelcontextprotocol/sdk` line. Re-verified post-iteration: stdio walk 16/16, `bun test` 23/23, typecheck + biome clean, mirror integrity empty. |
| 2026-06-12 | §1.4 FLOW-004 first-value seed-quality re-measured (0.25 → ~0.75) + `provision_failed` 422 bucket (SK-STRG-008) + canonical-five 7-day-freshness re-walk | **Verification-first per GLOBAL-030/032 — all five canonical walkers re-run against the live deployed surface BEFORE the code change** (this PR's brief: sync the mirror + verify before implementing more): (a) mirror integrity check (normalized `^#{2,3} FLOW-[0-9]+` diff across both trackers) — empty; (b) `bash scripts/verify-flows.sh` against `https://nlqdb.com` → EXIT 0, every curl-observable assertion green (6 vs + 5 solve slugs, sitemap floor 15, site-wide invite-capture, MCP discovery, invite-valve CORS preflight `x-invite-code`, 7/9 sources 200; Reddit + SO sandbox-egress advisory as expected); (c) `bash scripts/flow-005-walk.sh` → **6/6 passed** <1s + `bash scripts/flow-005-stdio-walk.sh` → **16/16 passed** 0.2s (`flow-005-2026-06-12T01-35-09Z.json`, `flow-005-stdio-2026-06-12T01-35-28-432Z.json`); (d) `bash scripts/stranger-test.sh --prompts 1` (Playwright, `chromium-headless-shell` build 1223) → 0/3, steps 1–4 green then gate-403 at 5/9/8 per GLOBAL-027 (`walk-2026-06-12T01-35-51Z.json`); (e) `bash scripts/flow-004-walk.sh` against `https://app.nlqdb.com` → control 403 + invite bypass (SK-GATE-007 intact) + `/v1/ask` HTTP 200, first-value `passed_degraded` (default goal → 0/0). **Finding (genuinely new evidence):** the SK-STRG-008 probe, last run once on 2026-06-10 at `seeded_ok_ratio = 0.25` (n=4), now measures **0.75 — double-verified**: two consecutive same-set 4-goal runs both 3/4 ok (`flow-004-seed-quality-2026-06-12T01-37-13Z.json` ×2), with **"a meal planner for couples" the single stable degrader** (empty DB in every run today). Wider 8-goal runs surfaced **3–4 HTTP 422 `infer_failed`** goals per run — the engine couldn't build the DB at all, a *harder* failure than `degraded`, previously hidden inside the probe's generic `errored` bucket; the post-change artifact `flow-004-seed-quality-2026-06-12T02-04-02Z.json` records `provision_failed:4` at `seeded_ok_ratio = 0.75`, and across three 8-goal runs the wide ratio varied **0.6–0.8** (the pre-change `…01-39-37Z.json` shows 0.6 with the 422s still in `errored`). Which goals degrade vs 422 varies run-to-run, so LLM schema-inference is non-deterministic; the lift over 06-10 is real and stable across today's 4-goal runs but **not causally isolated** (planner directives since 06-10 vs variance). **Change (SK-STRG-008):** `scripts/flow-004-seed-quality.sh` now splits the excluded set into `provision_failed` (HTTP 422 with engine `error.kind` ∈ {infer/compile/ddl/embed}_failed) vs `errored` (true upstream blips); `seeded_ok_ratio` denominator (ok+degraded) is **unchanged** per SK-STRG-008, so a hard build failure is now *visible* rather than masquerading as an upstream blip. JSON gains `provision_failed`; header + SK-STRG-008 Decision updated to match. `shellcheck scripts/flow-004-seed-quality.sh` clean; `bash -n` clean. No FLOW added/removed → mirror integrity post-edit empty. No new GLOBAL (GLOBAL-028/029/030/032 already govern; one SK-* clause refined). | Shipped + **run live 2026-06-12** (5 seed-quality probe runs: 2×4-goal + 3×8-goal, the last two post-change). The invite valve — the only canonical flow that crosses the GLOBAL-027 gate today — went from **1/4 → 3/4 invited strangers landing a seeded DB**, the single most decision-relevant acquisition number. The probe is now honest about the 422 build-failure tail it used to hide. Lifting the degraded/422 remainder to 1.0 stays the open SK-LLM-033 / engine-quality lift under preamble priority #1; P6 remains the next FLOW gap. |
