# Opencheck operations — model selection + progress tracker

Operational shard of [`e2e-coverage/FEATURE.md`](FEATURE.md), split out per
P4/D4 (FEATURE.md was at the 20 KB cap and the append-only tracker keeps
growing). Decisions stay in FEATURE.md; this file holds only the operator
reference + the run log.

## Free LLM model selection (opencheck)

**Policy: FREE MODELS ONLY** (GLOBAL-013). Every LLM key in the e2e
workflows MUST source from a free provider — never a paid slug. On
OpenRouter the `:free` suffix is required; the bare slug is **paid** tier
(2026-05-21: a paid Mistral slug burned ~$14). The OpenRouter key in CI is a
*paid* key with credits (`is_free_tier:false`), so a non-`:free` slug bills
real money — the `:free` suffix is the only guard.

**Two independent LLM budgets per run** (the fix for the 2026-05→06
exhaustion loop):

- **opencheck agent** (`LLM_API_KEY`, the Playwright-MCP driver) → the first
  **healthy** model from `_e2e-opencheck.yml`'s ordered `candidate_models`
  list (all OpenRouter `:free`; head `openai/gpt-oss-120b:free`). The
  pre-flight gives each candidate **3 consecutive tool-call probes ~2s
  apart** (saturated pools *flap* — one lucky 200 is not health) and
  substitutes the winner into the suite YAML (`model: "__MODEL__"`) — a
  single saturated free pool no longer zeroes the run (it cost 4 consecutive
  failed runs 2026-06-12 → 07-05). The probe checks the **body**, not just
  the status code: OpenRouter 429s arrive as an error envelope, sometimes
  under HTTP 200 (the `SK-LLM-042` gateway trap). The agent loop is the
  dominant consumer (~94K tokens/run); on OpenRouter `:free` those tokens
  are $0 and the budget is the OpenRouter account's free-model request cap
  (1000 req/day at ≥$10 balance, 20 RPM) — entirely separate from Groq.
- **staging app** (the preview's `/v1/ask` + NL db-create) → the **free
  planner chain** `cerebras → gemini → groq → workers-ai → openrouter → mistral`
  (`SK-LLM-023`/`SK-LLM-028`, `apps/api/src/llm-router.ts`), **hedged** on the
  head (`SK-LLM-014`). The agent is off this chain, so its draw is the app's
  own — small per run (~20-40K tokens). The chain head is **Cerebras
  gpt-oss-120b**, not Groq (the runbook said "app = Groq" until 2026-06-12;
  Groq is now only #3).

**Budget pre-check — check the DAILY limit, not the per-minute headers.** Each
provider's per-*minute* TPM/RPM resets in seconds and reads healthy even when
the per-*day* TPD/RPD that actually bites is exhausted (2026-06-12: Groq
`x-ratelimit-remaining-tokens` showed 11,963 TPM while TPD was 99,677/100,000 —
spent). Before triggering, verify the **daily** budget of the chain head and
its hedge partner: Cerebras `x-ratelimit-remaining-tokens-day` and a Gemini
`generateContent` 200 (its free quota is tight and exhausts early in the UTC
day). Groq's ~100K-tokens/day cap is account-level (shared across all Groq
models); per-model pools are TPM only — so splitting suites across Groq models
never bought independent budget.

| Model | Provider | RPM | Daily budget | Role |
|---|---|---|---|---|
| `openai/gpt-oss-120b:free` | OpenRouter `:free` | 20 | 1000 req/day ($0 tokens) | **Agent candidate #1** — the only model that has driven a full green run (06-12). Its upstream pool saturates for hours AND **flaps** (passed a 3× probe then 429'd 10 tests mid-run, [28759073164](https://github.com/nlqdb/nlqdb/actions/runs/28759073164)) — both covered now: the 3-probe gate skips it when saturated, `maxRetries: 6` absorbs mid-run blips. |
| `qwen/qwen3-coder:free`, `qwen/qwen3-next-80b-a3b-instruct:free`, `meta-llama/llama-3.3-70b-instruct:free` | OpenRouter `:free` | 20 | shared OpenRouter free req budget | Agent candidates #2–4; `tools` support re-verified live against OpenRouter `/models` `supported_parameters` 2026-07-06, but unproven as agents here. Mid-run blips are additionally absorbed by the client-level `maxRetries: 6` backoff patch (`_e2e-opencheck.yml`). |
| `openai/gpt-oss-20b:free` | OpenRouter `:free` | 20 | shared OpenRouter free req budget | Agent candidate #5 (last resort). Tool-call verified, and it carried Suite A 4/5 (run [28757212934](https://github.com/nlqdb/nlqdb/actions/runs/28757212934)) — but on the heavier Suite B it times out (3 × 300s) and derails mid-reasoning, so it ranks below every 80B+ candidate. |
| `openai/gpt-oss-120b` | NVIDIA NIM | ~40 (key-level) | $0 dev-program tier | **Fallback lane** (2026-07-11) — same weights as candidate #1 on an independent pool; walked only when every OpenRouter candidate fails the pre-flight (`fallback_*` inputs, `NVIDIA_API_KEY`). 3/3 CI-shape tool-call probes while OpenRouter 429'd. |
| ~~`nvidia/nemotron-3-super-120b-a12b:free`~~ | OpenRouter `:free` | — | — | **Not usable as agent** — aces 1-shot tool-call probes but collapses to text-format tool calls (`<function=…></tool_call>` as plain text) mid-loop and spams forbidden `browser_evaluate`; failed 2/5 Suite-A tests in two consecutive runs ([28760320317](https://github.com/nlqdb/nlqdb/actions/runs/28760320317), [28767705937](https://github.com/nlqdb/nlqdb/actions/runs/28767705937), traces + raw `</tool_call>` in the FAIL output). |
| `gpt-oss-120b` | Cerebras | 5 | 1M tokens/day | **Engine chain HEAD** (`SK-LLM-023`). 8/8 self-consistent on the Suite-A round-trip (probe, 2026-06-12). 5 RPM too slow for the *agent* loop but fine for the app's few engine calls — though it rate-limits under burst, forcing fallback. |
| `gemini-2.5-flash` | Gemini | ~15 | tight free quota | Engine chain #2 + hedge partner. Free quota exhausts early in the UTC day → 429 forces fallback. |
| `openai/gpt-oss-120b` | Groq | 1000 | ~100K tokens/day (account-wide) | Engine chain #3 (replaced `llama-3.3-70b-versatile`, decommissioned 2026-08-16). Daily TPD shared across all Groq models; frequently spent at run time. |
| ~~`qwen/qwen3-32b`~~ | Groq | — | — | **Not usable** — tool-call fails entirely on Groq (2026-06-04). |
| ~~`llama-4-scout-17b-16e`~~ | Groq | — | — | **Not usable** — returns number params as strings; Groq rejects (2026-06-04). |

**Switching / reordering agent models:** edit the `candidate_models`
default in `_e2e-opencheck.yml` — one place; the suite YAMLs carry
`model: "__MODEL__"` and receive the pre-flight's pick at render time.
A second provider is built in: when every primary candidate fails, the pre-flight walks `fallback_candidate_models` on `fallback_provider_base_url` with `FALLBACK_LLM_API_KEY` (default NVIDIA NIM `gpt-oss-120b`). New candidates must be
`:free` (GLOBAL-013) and tool-call capable — the pre-flight rejects a
model that can't emit `tool_calls`, but verify once by hand
(`curl … /chat/completions` with a `tools` array) before trusting it in
the order.

**Cheap iteration:** the `depth` dispatch input (`a` | `ab` | `abc`) runs
only as far down the state-dependent A→B→C chain as asked. Use `depth=a`
for a ~15-min Suite-A-only signal instead of gambling a full ~60-min run.

## Opencheck progress tracker (append-only)

| Date | Change | Outcome |
|---|---|---|
| 2026-05-20 → 06-04 | **Pre-provider-split era (condensed).** Reruns + a 240s `#submit-prefilled-row` persistent-mode cascade burned the 60-min ceiling repeatedly; **05-21 policy violation** (paid Mistral via OpenRouter, ~$14 — origin of the FREE-MODELS-ONLY guard). 06-04 split into 3 suites (A bootstrap / B read-write / C cleanup) with `#submit-prefilled-row` fail-fast + `config_file` input, and added a 30s per-call LLM timeout + pre-flight curl. `LANGCHAIN_VERBOSE` then pinned the real root: **Groq's ~100K-tokens/DAY cap is account-level (shared across all models)** (429 "Limit 100000, Used 97672"), so per-suite Groq models could never give independent budgets — superseded next day by the provider split. | all failed / cancelled at ceiling |
| 2026-06-05 → 06-07 | **Provider split + first greens + A→B handoff hardening (condensed).** *Provider split* (structural fix for the account-level Groq cap; see "Two independent LLM budgets" §): agent (~94K tok/run) → **OpenRouter `openai/gpt-oss-120b:free`** ($0, own 1000-req/day budget), Groq reserved for the app's `/v1/ask`; parameterised `provider_base_url`/`preflight_model` + added the `depth` (a\|ab\|abc) input. *First greens:* Suite A **5/5** (run [26989785238](https://github.com/nlqdb/nlqdb/actions/runs/26989785238)) after splitting `#create-table-anon` into create-only + `#mock-sign-in` + `#authed-state-preserved`; Suite B 3/8→**5/8** via carrying the `?db=` pin across navigations + a Cmd+K load-wait. *Test-logic fixes:* MCP snapshot truncation → **head + 2K tail** (composer renders last in `ChatPanel.tsx`); `#cmdk` is a toggle → send `ControlOrMeta+k` once, re-snapshot (never re-press). *Handoff:* moved the Alice fixture into `#b-setup` as a verify+retry seed (no API-seed) so reads don't cascade off the flaky insert; **hardened `#authed-state-preserved` to prove a *queryable* table** (asks "how many users are there?", fails on a table-missing reply; count 0 valid) — so a recurring failure here is an honest **`GLOBAL-027` bootstrap signal, not a test bug**. **Direction (user): favor the real flow — harden Suite A, NOT API-seed.** |

| 2026-06-08 → 06-11 | **Pin-fix + signal-decoupling era (condensed).** *06-08:* rewrote the 7 DB-needing Suite-B tests to select the "users" DB from the sidebar by name (kills the auto-pin "references a table this database doesn't have" class); fixed the trace-upload gap (`include-hidden-files: true`, [upload-artifact #602](https://github.com/actions/upload-artifact/issues/602)) → Suite B first 0-fail (run 27110608488). *06-09:* brought Suite C online — first signal **8/9** (run 27177363909); fixed `#delete-row` nav-churn + raised B/C per-test cap to 300s; named the `abc` flake taxonomy = 3 independent sources (A engine, B timing, C nav-churn). *06-10:* **decoupled the suite signals** (B/C run-and-report even when A fails; `needs:` ordering-only) — PR #367; added B-read fail-fast. *06-11:* hardened the last B composer-ref tests; corrected a stale budget figure. **Net state:** B+C reliably green when reached; the sole remaining blocker was Suite A's `#authed-state-preserved` ("references a table this database doesn't have"), logged as a GLOBAL-027 *engine* flake (~50-75% green) — **re-diagnosed 06-12 below.** |

| 2026-06-12 | **Re-diagnosed the Suite-A blocker — it is NOT lead-model NL→SQL quality (PR #377).** Live budget re-verify (FREE-MODELS-ONLY): OpenRouter `gpt-oss-120b:free` `usage.cost:0` ⇒ 1000 req/day; Cerebras 921K tokens/day free; **but Groq TPD already spent and Gemini free quota exhausted** at run time. **Built a fast engine probe** (`apps/api/scripts/global027-engine-probe.ts`): reproduces the exact `#authed-state-preserved` round-trip (NL-create "users" → NL-query "how many users are there?") + the SK-ASK-016 pre-flight check by calling one chain provider directly — seconds/iter, no Playwright agent (the FAST half of the signal the daily loop never had). **Finding:** cerebras gpt-oss-120b (chain head, SK-LLM-023) is **8/8 self-consistent** (always creates `users`, always plans `SELECT COUNT(*) FROM "app"."users"`, temp 0). So the ~50% flake is **provider fallback under budget exhaustion + hedge amplification**, NOT "the engine can't do it": planner ops are hedged (cerebras raced with gemini every call, SK-LLM-014), cerebras is 5 RPM, and on rate-limit the chain falls to an exhausted gemini/groq → 429 or a weaker model that mis-references the table. **Corrected stale runbook:** app engine = the cerebras-led chain (not "Groq"); budget pre-check reads **daily** TPD/RPD, not per-minute headers. **Recommendation (P1, needs user — touches SK-LLM-014 hedge / SK-LLM-023 chain):** drop the hedge on `schema_infer`/`plan` (it 2×-burns the scarce 5-RPM head and routes wins to an exhausted Gemini) and/or widen the head budget; tracked under Open questions. **Live confirmation — Suite A 5/5 ✅** (run [27388402879](https://github.com/nlqdb/nlqdb/actions/runs/27388402879), `depth=a`): green end-to-end **even though Groq TPD + Gemini quota were both spent at run time**, exactly as predicted — the healthy Cerebras head carried the NL-create→query round-trip and `#authed-state-preserved` returned a valid count (no "references a table this database doesn't have"). This validates the reframe end-to-end: when the chain head has budget, the engine round-trip is reliable; the intermittent flake is fallback/budget, not lead-model quality. **Next:** the user picks (a) or (b) above; option (a) (drop the hedge on `schema_infer`/`plan`) would make the head carry every run, not just the budget-lucky ones. |

| 2026-07-05 → 07-06 | **Ordered `candidate_models` pre-flight + trace-triage era (condensed; full detail in git).** Killed the single-model SPOF: `_e2e-opencheck.yml` walks 5 OpenRouter `:free` candidates, **3 consecutive tool-call probes** each (saturated pools flap — one lucky 200 ≠ health) + body inspection (429 can arrive under HTTP 200, the `SK-LLM-042` trap); first healthy model is substituted into the suite YAML; none healthy ⇒ loud abort with honest summary/exit. Verification runs also: repointed `#hero-or-cmdg`/`#add-row-redirects-to-auth` at the two-door homepage → `/app/new/` (SK-WEB-003); **BANNED nemotron-3-super** (probe-healthy, collapses to text-format tool calls mid-loop — runs [28760320317](https://github.com/nlqdb/nlqdb/actions/runs/28760320317)/[28767705937](https://github.com/nlqdb/nlqdb/actions/runs/28767705937)); confirmed gpt-oss-20b too weak for Suite B; added client `maxRetries: 6` for mid-run blips; `#authed-state-preserved` retries once on the Neon scale-to-zero "Couldn't reach the database" transient. Best: Suite A **4/5** (run [28768099957](https://github.com/nlqdb/nlqdb/actions/runs/28768099957)) with four pools simultaneously 429. Named blockers: app-side cold-start retry; OpenRouter free-pool capacity for the heavier B/C load. | infra SPOF dead; capacity remains |
| 2026-07-11 | **Second-provider fallback lane (daily run).** Trace triage of run [29127134203](https://github.com/nlqdb/nlqdb/actions/runs/29127134203) (07-10 22:14 UTC): Suite B pre-flight abort — zero healthy candidates; Suite A ran on the weakest survivor and lost 3/5 tests to 240s agent-starvation timeouts **while the app answered both failed tests' `/v1/ask` in ~4s with 200** (Playwright network traces) — so the 13 consecutive failures 07-02 → 07-10 all share one root: all five candidates sit on OpenRouter's free pool, which saturates as a unit at any hour (failures at 04:37, 07:25, 21:01, 22:14 UTC). Fix: when the whole primary lane is unhealthy the pre-flight now walks a **fallback provider lane** (`fallback_provider_base_url` / `fallback_candidate_models` inputs + `FALLBACK_LLM_API_KEY` secret; the run step re-points `OPENAI_BASE_URL`+key at the picked lane). Default: **NVIDIA NIM `openai/gpt-oss-120b`** — same weights as the only fully-green agent model on an independent $0 dev-program pool (~40 RPM, key-level), NOT in the app's engine chain, so the two-budget split invariant holds. Hand-verified 3/3 CI-shape tool-call probes at 01:20 UTC while OpenRouter's pool was 429 (llama-3.3-70b on NVIDIA rejected — exceeds the 15s probe). | verification dispatch = the measured verdict |

**Cascade root-cause (2026-06-03):** `sessionMode: persistent` + one timed-out test starved downstream tests of expected DB state — burned the full 60-min ceiling (169 nav-timeout markers). **Remediation (a) SHIPPED 2026-06-04:** three suites (A/B/C), each a fresh session with an explicit sign-in setup step; `#submit-prefilled-row` fails fast on missing table. **Remediation (b) SHIPPED 2026-06-07:** the Alice fixture is seeded (with verify+retry) once in Suite B's `#b-setup`, so the read tests (`#read-shows-informative-data`, `#count-summarizes`) no longer cascade off the flaky single `/v1/ask` in `#submit-prefilled-row` — done via the chat (no infra/API-seed), so `#submit-prefilled-row` stays an independent write-path check. **Remediation (c) SHIPPED 2026-06-08:** every DB-needing Suite-B test now selects the "users" DB from the sidebar by name rather than trusting the bare-`/app` newest-DB auto-pin, so a stray/newer DB can no longer win the pin and trigger "references a table this database doesn't have".
