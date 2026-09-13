# Weekly review — 2026-09-13

Current-state audit of the `/daily` loop (≤ 4 KB, overwritten weekly, no
changelog). Worst finding first. Window 2026-09-06→09-13: `/daily` runs
198–209 (all `GLOBAL-041` Phase A widen-on-write, bar run 200's UX-flow re-walk).

## Worst — a full week of engine code, zero movement on the number it serves (checks 2 + 4 + 1)

**8 of 9 non-null runs (199–207, 209 — all but run 200 = ~89 %)** pulled one
lever: Phase A widen-on-write. All but run 209 merged to `main`. Yet the live KPI 1
it exists to move is **0 %** — root cause (run 208, verified this audit against
the Actions API): **production `apps/api` is frozen at run 198**. Deploy API's
last success is run_number 618 (2026-09-07); every run since (619+, run 199 on)
is `action_required` and never executed. So a week of engine work is **inert
until a founder deploy approval** — `blocked-by-human` #1, now **5 days** old.
Per the check-2 rule, volume-without-a-moved-number means next week is *not*
more widen code but **instrumenting the number** — hence the re-pointed focus:
an agent-side KPI-1 rate on the run-206 extend-walk harness, movable at $0
while the deploy waits (run 209, in review, closes the last gap: unseen column).

## Trend — code up sharply, deployed prod flat; no regression alarm (check 1)

No `GLOBAL-025` alert delta tripped. Engine *code* advanced hard (Phase A
steps 1–7, 9 built + executor-walked, run 206 3/3; run 209 in review adds the
unseen-column path) but the *deployed* engine is 8 runs stale, so the honest
engine trend is "code up, prod flat." BIRD 0.5382 (47 d) / Spider 0.2222
(54 d) stale but **dark, not regressed** — no alarm. Onboarding/UX/perf flat:
strangers 0 (launch-gated, row #2), FLOW-005 6/6 carried.

## Delta integrity — 5 sampled, all genuine (check 5)

Verified the load-bearing run-208 deploy-freeze claim directly (Actions API:
618 last success, 619+ all `action_required` since 09-08 — exact). Spot-checked
run 207 (`trace.widen` in SDK + `ask/types.ts`), run 206 (`widen-walk.integration.test.ts`
present), run 205 (`extendWrite`/`extendNeeded` in `orchestrate.ts`), run 196
(`asks_extend_ok/failed` counters). No fabricated delta.

## Inert output + dark metrics — the loop self-corrected (checks 3 + 4)

The 8 merged widen runs are the inert output (nothing consumes them while prod
is frozen), but run 208 correctly stopped adding volume, measured the yield
(live 0 %), and escalated the deploy to `blocked-by-human` #1 with a
days-blocked count — the loop self-correcting, not a new inert report. Other
dark rows (BIRD/Spider stale; strangers launch-gated; opencheck money-gated,
rule 4) each carry a named root blocker.

## Prompt drift — `daily.md` clean, no fix (check 6)

All decision IDs (GLOBAL-025/026/033/038/041/042, SK-*) resolve to canonical
files and all cited paths exist. No dangling refs, dead rules, or
contradictions — no `daily.md` edit this week.

## Public roadmap — two markers understated reality, fixed (check 7)

`README.md § Roadmap` "Now — Phase A" marked `kind=extend` and Extend-diff/trace
as ◯ **planned**, but both are merged-but-undeployed / partially shipped
(`trace.widen` live on SDK/MCP/elements). Fixed ◯ → ~ this PR, noting the
undeployed live-0 % state — honest, not a phantom ✓ (the ✓ KPI-counters line is
genuinely shipped, deployed run 196 pre-freeze).

## Free-model roster — complete + current, one bump to verify (check 8)

Planner chain, best-first: **groq-qwen** (`qwen/qwen3.8-27b`) → **gemini**
(`gemini-2.5-flash`) → **cerebras** (`gpt-oss-120b`) → **groq**
(`gpt-oss-120b`/`20b`) → **workers-ai** (`llama-3.3-70b`) → **openrouter**
(`:free`) → **mistral-large**. All keys present. Web-research (P2) confirms the
picks — Groq free = gpt-oss + Qwen3.8; Kimi/DeepSeek correctly *not* depended on
(both left Groq's free list). One candidate bump: sources cite a newer free
Gemini flash than our 2.5-flash — the daily loop (SK-LLM) should verify it
against live `/v1/models` and apply; key exists, so no human bullet.
