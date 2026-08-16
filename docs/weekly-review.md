# Weekly review — 2026-08-15

Current-state audit of the `/daily` loop (≤ 4 KB, overwritten weekly, no
changelog). Worst finding first. Window 2026-08-08→08-15: `/daily` runs
174–177, `/reach` cycles (#958/#968/#977/#980), the premium go-live burst
(#985–#992), and the ongoing `/ek` track (~11 PRs).

## Worst — a 1.5 h prod `/v1/ask` outage that the scorecard never recorded (checks 1 + 5)

Premium went **live 2026-08-14** (founder-driven, Era 11) and the AI-Gateway
"Authenticated Gateway" toggle 401'd every gateway-routed lane: `routeAsk` runs
on **every** authed `/v1/ask`, its chain was gateway-only, so signed-in traffic
returned `llm_failed` **deterministically for ~1.5 h** (anon/`pk_live` survived
— only the `plan` chain has a direct leg). Resolved: #992 (`SK-LLM-046`,
`AI_GATEWAY_TOKEN`) merged, main green on `289db5a`; **#993 open** hardens the
SPOF (direct fallback on route/summarize/engine_classify). The honesty gap:
the scorecard still reads **"0 errors" (row #12, 07-27)** and **premium
"flag-dark" (row #20)**, because
`/daily` hasn't regenerated it since run 177 (08-12). Corrective — the next
`/daily`'s first act: record the incident on row #12 and premium-live on row #20.

## Trend — monetization pillar opened; engine still stale, no fresh standing regression (check 1)

Premium hosted-lane live 08-14 is the first monetization path ever open (§6
unsolicited-inbound signal declared tripped 5→1 by the founder) — a real gain.
Engine below floor and stale: BIRD 0.5382 (20 d), Spider 0.2222 (27 d), resume
deferred (async multi-window; `main` churn misses the SHA-keyed checkpoint).
Funnel flat, real strangers still **0**. The outage aside (now resolved), no
`GLOBAL-025` alert threshold stands tripped: main + deploys green, p95 within
floor.

## Monoculture — `/daily` on-focus; org effort concentrated on pre-revenue build (check 2)

`/daily` itself stayed correctly on the founder focus (dogfood: runs 175/176/177).
The org's PR volume, though, was dominated by the parallel `/ek` marketplace
track (~11 PRs, unvalidated wedge, `SK-EKP-005`-sanctioned) plus the premium
burst (~6) — all pre-launch, **zero attributable yield** (row #2 strangers 0;
row #22 `source_json` non-null 0). Continues last week's flag; EK is
founder-sanctioned parallel, so this is a watch, not a redirect.

## Roadmap truth — one stale marker, fixed here (check 7)

README § Roadmap: the `/agents` memory dashboard still read "~ … ships on
deploy" though it is live (prod-verified: `nlqdb.com/agents` serves the
`ag-dog` block, as-of 08-11) — flipped to ✓ in this PR. Premium-live was
already synced (#990); "Now"/"Next" still name the gate + the EK track.

## Dark metrics — all root-blocked with named cause (check 4)

Engine rows dark ≥ weeks (resume-deferred, cause named). Real strangers /
first-10 stranger-gated → `blocked-by-human.md` #1 (Show HN, idle **63 d**,
condition-gated on the gate). No agent-fixable dark row is being silently
skipped.

## Inert output — none in `/daily` (check 3)

`/daily` output is consumed: distribution queue at 1 unpublished draft (< 3),
dev.to drip active (run 177). The Show HN kit (63 d) is gate-blocked, not
inert-by-loop.

## Delta integrity — sampled 4, all verify (check 5)

Runs 175/176/177 + the 174 null: run 175's auth-boundary seam tests present;
run 176's prod dogfood workload + the ask-#8 silent-wrong-answer finding
concrete; run 177's `/agents` block + `agentMemory.{ts,data.json,test.ts}` +
`apps/web/scripts/gen-agent-memory.mjs` all present. No fabricated delta.

## Prompt drift — one, in this prompt itself; fixed (check 6)

`weekly.md`'s audit header said "six checks" while listing seven — the drift
that let this review's first draft skip check 7; header now says seven. All
paths + `GLOBAL`/`SK` IDs cited in `daily.md`/`reach.md`/`ek.md`/`weekly.md`
resolve. `daily.md` rule 5's meter-freeze is a conditional whose antecedent
(§6) has now tripped — correct as written (founder-resolved, not edited, P1).
No `daily.md`/`reach.md` edit needed.
