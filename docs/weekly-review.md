# Weekly review — 2026-08-08

Current-state audit of the `/daily` loop (≤ 4 KB, overwritten weekly, no
changelog). Worst finding first. Window 2026-08-01→08-08: `/daily` runs
165–173, `/reach` R-10 (#908/#914/#922/#929), and the new `/ek` track
(#917–#940, ~11 PRs).

## Worst finding — the weekly focus sat dark on a stale citation; a live test pins the real blocker (check 4)

The founder-set weekly focus, the
[`SK-PIVOT-016`](features/agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md)
dogfood gate (**0/5**), was carried "dark, not pullable" citing the
`NLQDB_API_KEY` secret — which the founder set **2026-08-04**
(`history/founder-actions-log.md` line 108), with D-02b sync 🟢. A **live
prod test (2026-08-09)** then pinned what actually remains: the repo-secret
key authenticates (`GET /v1/databases` → 200) but
`POST /v1/databases { preset: "agent_memory_v1" }` returns **401** — the
create verb was cookie-session-only (SK-PIVOT-010) while `remember`/`query`
already accept user-scoped keys. So the gate is **one 1-run API change from
pullable**: extend preset create to user-scoped principals
(founder-directed 2026-08-09 — provisioning is product-automated, many DBs /
many clients, never a human queue item; SK-PIVOT-010 amended accordingly,
`anon`/`pk_live` still rejected). This review erred twice before landing
here: #954 queued the provision on the founder (rule-4/GLOBAL-033 violation,
founder-flagged), and the same-day correction over-claimed "pullable now" —
refuted by the live 401. **Direction: next `/daily` ships the create change,
then D-04** (criteria 1/2/3; D-06 → criterion 5 follows). Criterion 4 stays
a separate engine problem (E-09, GLOBAL-037).

## Monoculture — distribution content, no conversion yield (check 2)

5 of 9 `/daily` runs shipped distribution content pages (168–172: three
`/solve`, two `/blog`); run 173 was the sanctioned anti-rut yield
measurement. Its own evidence is the verdict: breadth lifted *leading*
indicators (GSC impressions 587→640, real-browser floor 52→63) but moved
**zero** *converting* indicators — 0 clicks on the top-impression page
(`/solve/running-total…`, 135 impr stuck at page-4 pos 35.4), referral yield
flat at 13 pl, real strangers still **0** (row #2). Volume without yield ⇒
next week's content sub-lever is *strengthening the one highest-impression
page to climb off page 4*, not a 6th new page. Context: the org's other big
allocation, the new `/ek` marketplace track (~11 PRs), is pre-launch build on
an unvalidated wedge — sanctioned parallel (SK-EKP-005) but also yield-less
until it ships.

## Trend — flat, no fresh regression (check 1)

No `GLOBAL-025` alert threshold tripped this week. Engine below floor and
**stale**: BIRD 0.5382 (13 d), Spider 0.2222 (20 d) — both past the >7 d
staleness alert, resume dark (async multi-window, `main` moved, SHA-keyed
cache would miss). Funnel up modestly (visits 52→63, GSC impr +53). UX/perf
green (row #21 0 failed, row #18 0 dead, p95 1.48 s < 1.5 s floor).
Onboarding flat at floor (strangers 0, first-10 N=0).

## Inert output — none in `/daily`; this loop lapsed (check 3)

`/daily` output is consumed: the blog draft queue drained (run 171, 0
unpublished) and the dev.to drip went live (run 173). The genuine lapse is
**this** loop — `weekly-review.md` was last rewritten 2026-07-18 (3 weeks;
the 07-28 focus was founder-set, not `/weekly`-set). Corrected here; watch
that `/weekly` fires weekly.

## Delta integrity — sampled 5, all verify (check 5)

Re-checked registry entries for runs 168/169/170/171/172 — every claimed
`/solve` or `/blog` page is present in `apps/web/src/data/{solve,blog}.ts`.
Scorecard counts (40/39/31) match the registries (raw `slug:` greps over-count
by 2 on nested cross-links). No claimed-but-unverified delta.

## Prompt drift — none (check 6)

Every path and GLOBAL ID cited in `daily.md`/`weekly.md` resolves — including
`GLOBAL-027` (this prompt's named archetype), which now has its canonical
file. No `daily.md` edit needed.
