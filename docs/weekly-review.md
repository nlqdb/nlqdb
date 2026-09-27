# Weekly review — 2026-09-27

Current-state audit of `/daily` (≤ 4 KB, overwritten weekly). Window
09-20→09-27: runs 216–224 (#1137–#1148), all `GLOBAL-041` Phase A KPI 1.

## Worst: the direct LLM tail was dead, found only by probing (check 8)

`SK-LLM-047` needs a non-gateway leg in every chain (the 08-14 outage).
Live probes on 09-27 with the shared keys: **Cerebras returns 402
`payment_required`** for `gpt-oss-120b` and `qwen-3.8-27b` (its free tier
became a card-gated trial). **`mistral-large-latest` returns 403
`tier_not_allowed`** and is gone from `/v1/models`. Both direct legs were
down, so one AI-Gateway fault could take out every op. Fixed here:
`SK-LLM-028` now uses `codestral-latest`, which answered a JOIN+HAVING prompt
correctly in 1.2 s. Mistral medium/small returned 429 on every probe.
Cerebras stays dead: re-enabling it costs money, which `cost-ladder.md`
forbids. Pruning it from the chains (`SK-LLM-023/047/054`) is an
agent-fixable daily lever.

## Monoculture + inert output: 9/9 runs on one proxy (checks 2 + 3)

Every run pulled KPI-1 routing. The proxy did move, and genuinely: the live
walk went 0/5 → 10/10. But it is now saturated, and it is preview-only. The
formal sample is still **0/200**, because no run commits a dogfood write:
`daily.md` step 1 required one every run, and every run since 211 skipped
it (the prod key crosses only CI). §6.1 **R2/R3 stay red** and got no
runs. The real run-log workload may yield fewer than 200 unseen-field inserts
in 14 days; padding it with a generated stream is the synthetic workload
`GLOBAL-041` rejects, so the window reads whatever n the real writes give
(parked until the window opens, `GLOBAL-033`). **Focus → CI job committing
each run's own outputs, runs landed/day.**

## Trend: engine up, no alarm (check 1)

No `GLOBAL-025` alert delta tripped. Engine: live routing 0 → 100 %.
Onboarding and UX are flat (strangers N=0, launch-gated). BIRD 0.5382 and
Spider 0.2222 are dark, not red. E2E freshness (#15) is 0.00; its last
success was 09-08.

## Dark metrics (check 4)

#8/#9 (61/68 d) and #2/#4/#5 (launch-gated) name their blockers. #15 can be
re-dispatched at $0 and is deferred correctly behind KPI 1. Queue depth is
5; the head is Show HN (106 d), then the email-router deploy (9 d).

## Delta integrity: 3 sampled, all genuine (check 5)

Run 224's 10/10 was re-confirmed by a third CI walk that nobody cited,
[36230755170](https://github.com/nlqdb/nlqdb/actions/runs/36230755170), at
5/5 on `de56f37`. The run-219 and run-223 matrices were re-run:
`route-ask` + `orchestrate` tests, 72/72 pass. Nit: the walk labels its
preview counts `asks_extend_ok`, the same name as the formal counter.

## Prompt drift: one dead rule fixed (check 6)

All IDs and paths in `daily.md`/`weekly.md` resolve. Dead rule: "until the
extend path exists every write is a miss". Replaced it with the CI-boundary
reality and the lever.

## Public roadmap: one stale marker fixed (check 7)

`kind=extend` said "awaiting a prod deploy, live rate 0 %". It now reads
"live, preview walk 10/10, formal sample not open" and stays ~.

## Free-model roster (check 8)

Plan chain, best first: groq-qwen `qwen3.8-27b` → gemini `2.5-flash` →
~~cerebras~~ (402) → groq `gpt-oss-120b` → workers-ai `llama-3.3-70b` →
openrouter `nemotron-3-ultra:free` (still $0) → mistral `codestral`. I
checked `gemini-3.8-flash` (free, stable) live: same SQL, but 3.4–7.2 s
against 2.0–2.6 s, which is over the 2 s hedge head-start. Not swapped.
Sources: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing),
[free-tier 2026](https://ianlpaterson.com/blog/free-llm-api-2026/),
[OpenRouter free list](https://openrouter.ai/blog/tutorials/free-llm-apis-compared/),
plus live `/v1/models` on every key.
