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
  list. **Primary lane since 2026-07-11: NVIDIA NIM `openai/gpt-oss-120b`**
  ($0 dev-program tier, ~40 RPM key-level, independent of every other pool
  here); the previous 5-candidate OpenRouter `:free` walk is the fallback
  lane — its five models share ONE free pool that saturates as a unit *and
  flaps past the probe gate* (13 consecutive failed runs 07-02 → 07-10,
  then 216s agent starvation on a probe-healthy pick, run
  [29144964531](https://github.com/nlqdb/nlqdb/actions/runs/29144964531),
  while the NIM lane ran the same tests in 7.7–25s). The pre-flight gives
  each candidate **3 consecutive tool-call probes ~2s apart** (saturated
  pools *flap* — one lucky 200 is not health) and substitutes the winner
  into the suite YAML (`model: "__MODEL__"`). The probe checks the
  **body**, not just the status code: OpenRouter 429s arrive as an error
  envelope, sometimes under HTTP 200 (the `SK-LLM-042` gateway trap). The
  agent loop is the dominant consumer (~94K tokens/run); both lanes are $0
  and entirely separate from the app's providers.
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
| `openai/gpt-oss-120b` | NVIDIA NIM | ~40 (key-level) | $0 dev-program tier | **PRIMARY agent lane** (promoted from fallback 2026-07-11) — same weights as the only model with a full green run, on an independent pool. Agent per-test time 7.7–25.1s on both live firings ([29134673858](https://github.com/nlqdb/nlqdb/actions/runs/29134673858), [29144964531](https://github.com/nlqdb/nlqdb/actions/runs/29144964531) — 25s on the same test that starved 216s on OpenRouter). |
| `openai/gpt-oss-120b:free` | OpenRouter `:free` | 20 | 1000 req/day ($0 tokens) | **Fallback candidate #1** (primary until 2026-07-11) — drove the 06-12 full green run, but its upstream pool saturates for hours AND **flaps past the 3-probe gate** (429'd 10 tests mid-run [28759073164](https://github.com/nlqdb/nlqdb/actions/runs/28759073164); 216s starvation on a probe-healthy pick [29144964531](https://github.com/nlqdb/nlqdb/actions/runs/29144964531)). `maxRetries: 6` absorbs brief blips only. |
| `qwen/qwen3-coder:free`, `qwen/qwen3-next-80b-a3b-instruct:free`, `meta-llama/llama-3.3-70b-instruct:free` | OpenRouter `:free` | 20 | shared OpenRouter free req budget | Fallback candidates #2–4; `tools` support re-verified live against OpenRouter `/models` `supported_parameters` 2026-07-06, but unproven as agents here. Mid-run blips are additionally absorbed by the client-level `maxRetries: 6` backoff patch (`_e2e-opencheck.yml`). |
| `openai/gpt-oss-20b:free` | OpenRouter `:free` | 20 | shared OpenRouter free req budget | Fallback candidate #5 (last resort). Tool-call verified, and it carried Suite A 4/5 (run [28757212934](https://github.com/nlqdb/nlqdb/actions/runs/28757212934)) — but on the heavier Suite B it times out (3 × 300s) and derails mid-reasoning, so it ranks below every 80B+ candidate. |
| ~~`nvidia/nemotron-3-super-120b-a12b:free`~~ | OpenRouter `:free` | — | — | **Not usable as agent** — aces 1-shot tool-call probes but collapses to text-format tool calls (`<function=…></tool_call>` as plain text) mid-loop and spams forbidden `browser_evaluate`; failed 2/5 Suite-A tests in two consecutive runs ([28760320317](https://github.com/nlqdb/nlqdb/actions/runs/28760320317), [28767705937](https://github.com/nlqdb/nlqdb/actions/runs/28767705937), traces + raw `</tool_call>` in the FAIL output). |
| `gpt-oss-120b` | Cerebras | 5 | 1M tokens/day | **Engine chain HEAD** (`SK-LLM-023`). 8/8 self-consistent on the Suite-A round-trip (probe, 2026-06-12). 5 RPM too slow for the *agent* loop but fine for the app's few engine calls — though it rate-limits under burst, forcing fallback. |
| `gemini-2.5-flash` | Gemini | ~15 | tight free quota | Engine chain #2 + hedge partner. Free quota exhausts early in the UTC day → 429 forces fallback. |
| `openai/gpt-oss-120b` | Groq | 1000 | ~100K tokens/day (account-wide) | Engine chain #3 (replaced `llama-3.3-70b-versatile`, decommissioned 2026-08-16). Daily TPD shared across all Groq models; frequently spent at run time. |
| ~~`qwen/qwen3-32b`~~ | Groq | — | — | **Not usable** — tool-call fails entirely on Groq (2026-06-04). |
| ~~`llama-4-scout-17b-16e`~~ | Groq | — | — | **Not usable** — returns number params as strings; Groq rejects (2026-06-04). |

**Switching / reordering agent models:** edit the `candidate_models`
default in `_e2e-opencheck.yml` — one place; the suite YAMLs carry
`model: "__MODEL__"` and receive the pre-flight's pick at render time.
A second provider is built in: when every primary candidate fails, the
pre-flight walks `fallback_candidate_models` on
`fallback_provider_base_url` with `FALLBACK_LLM_API_KEY` (primary =
NVIDIA NIM `gpt-oss-120b`, fallback = the ordered OpenRouter `:free`
walk; lanes swapped 2026-07-11 — a lane, not a model, is the failure
domain). New candidates must be free (GLOBAL-013; on OpenRouter that
means the `:free` suffix) and tool-call capable — the pre-flight rejects
a model that can't emit `tool_calls`, but verify once by hand
(`curl … /chat/completions` with a `tools` array) before trusting it in
the order.

**Cheap iteration:** the `depth` dispatch input (`a` | `ab` | `abc`) runs
only as far down the state-dependent A→B→C chain as asked. Use `depth=a`
for a ~15-min Suite-A-only signal instead of gambling a full ~60-min run.

## Opencheck progress tracker (append-only)

| Date | Change | Outcome |
|---|---|---|
| 2026-05-20 → 06-04 | **Pre-provider-split era (condensed; full detail in git).** Persistent-mode cascades burned the 60-min ceiling repeatedly; **05-21 policy violation** (paid Mistral via OpenRouter, ~$14 — origin of the FREE-MODELS-ONLY guard). 06-04: split into suites A/B/C + 30s per-call LLM timeout; pinned the root — **Groq's ~100K-tokens/DAY cap is account-level**, so per-suite Groq models never gave independent budgets. Superseded by the provider split. | all failed / cancelled at ceiling |
| 2026-06-05 → 06-07 | **Provider split + first greens + A→B handoff hardening (condensed; full detail in git).** Agent moved to its own $0 lane (OpenRouter `:free`), Groq reserved for the app's `/v1/ask`; `depth` (a\|ab\|abc) input added. First Suite A **5/5** (run [26989785238](https://github.com/nlqdb/nlqdb/actions/runs/26989785238)); B 3/8→5/8. **`#authed-state-preserved` hardened to prove a *queryable* table** (asks "how many users are there?", fails on a table-missing reply) — a recurring failure here is an honest `GLOBAL-027` bootstrap signal, not a test bug. **Direction (user): favor the real flow — harden Suite A, NOT API-seed.** |

| 2026-06-08 → 06-11 | **Pin-fix + signal-decoupling era (condensed; full detail in git).** Suite-B tests pin the "users" DB by name (kills the auto-pin wrong-DB class); trace upload fixed (`include-hidden-files: true`); Suite C online 8/9; B/C run-and-report even when A fails (`needs:` ordering-only, PR #367); B/C per-test cap 300s. **Net state:** B+C reliably green when reached; sole blocker = Suite A `#authed-state-preserved` — re-diagnosed 06-12 below. |

| 2026-06-12 | **Re-diagnosed the Suite-A blocker — NOT lead-model NL→SQL quality (PR #377; condensed, full detail in git).** The fast engine probe (`apps/api/scripts/global027-engine-probe.ts`) showed the cerebras chain head **8/8 self-consistent**; the ~50% flake was provider fallback under budget exhaustion + hedge amplification. Runbook corrected (app engine = cerebras-led chain; budget pre-checks read **daily** TPD/RPD). Live confirmation Suite A **5/5** ✅ (run [27388402879](https://github.com/nlqdb/nlqdb/actions/runs/27388402879)) with Groq + Gemini quota both spent. |

| 2026-07-05 → 07-06 | **Ordered `candidate_models` pre-flight + trace-triage era (condensed; full detail in git).** Killed the single-model SPOF: `_e2e-opencheck.yml` walks 5 OpenRouter `:free` candidates, **3 consecutive tool-call probes** each + body inspection (429 can arrive under HTTP 200, the `SK-LLM-042` trap); first healthy model is substituted; none healthy ⇒ loud abort. Also: `#hero-or-cmdg`/`#add-row-redirects-to-auth` repointed at the two-door homepage → `/app/new/` (SK-WEB-003); **BANNED nemotron-3-super** (probe-healthy, collapses to text-format tool calls mid-loop); gpt-oss-20b confirmed too weak for Suite B; client `maxRetries: 6`; `#authed-state-preserved` retries once on the Neon scale-to-zero transient. Best: Suite A **4/5** (run [28768099957](https://github.com/nlqdb/nlqdb/actions/runs/28768099957)) with four pools simultaneously 429. | infra SPOF dead; capacity remains |
| 2026-07-11 | **Four classes root-caused + closed in one day (daily runs; condensed, full detail in git).** (1) **Second-provider fallback lane** — the 13 consecutive failures 07-02→07-10 were all five agent candidates on OpenRouter's one shared free pool (saturates as a unit; 240s Suite-A starvation while the app answered `/v1/ask` in ~4s). Fix: pre-flight walks a `fallback_provider_base_url`/`fallback_candidate_models` lane (default NVIDIA NIM `gpt-oss-120b`, independent $0 pool). (2) **NIM promoted to primary** (run 50) — failure domain is the pool not the model; NIM ran agent tests in 7.7–25s vs 72–240s starved; `#add-row-redirects-to-auth` 216s FAIL → 14.9s PASS; first full `abc` on NIM ([29154050866](https://github.com/nlqdb/nlqdb/actions/runs/29154050866)) A 4/5 · B 3/8 · C 8/9. **Driver-starvation class closed.** (3) **Adopted-DB ACL gap** — `#authed-state-preserved`'s `db_unreachable` was the least-privilege `SET LOCAL ROLE tenant_<hash(adopter)>` (landed #614 07-05) failing because adoption flipped only D1 `tenant_id`; grants, `WITH SET`, and the baked RLS literal still named the anon creator. Fix: `retargetAdoptedDbAcl` (SK-ANON-003 amendment) + `recordExecUnreachable`. Also a prod onboarding bug. (4) **Fixture-registry purge** (run 52, `SK-E2E-007`) — previews share prod D1 while Neon `e2e` is destroyed each run, so fixture rows outlived their schemas; `_e2e-staging.yml` purges fixture `databases`+`chat_message` after branch recreation. Purged dispatch [29165068648](https://github.com/nlqdb/nlqdb/actions/runs/29165068648): A 4/5 · B 4/8 · **C 9/9** (first fully-green C). | Residual after all four: intermittent exec `db_unreachable` on the FRESH adopted `users` DB (passes interleaved) — the app-side class the 07-12 row root-causes to the isolate-dependent import crash |

| 2026-07-12 | **The adopted-DB brick root-caused to an isolate-dependent import crash + fixed at the root and made self-healing (daily run 57, `SK-ASK-024`).** Morning `depth=a` on main: Suite A **5/5 in 95 s** ([29194166944](https://github.com/nlqdb/nlqdb/actions/runs/29194166944)) — first green workflow on main since the suite split. The post-heal `ab` branch dispatch then FAILED `#authed-state-preserved` again (fresh 22023 diag rows, zero heal/regrant rows) — the heal alone didn't save it, forcing the real root cause: **`makeAclRetarget`'s `await import("./db-create/build-deps.ts")` rejects at module scope** (libpg-query's Emscripten loader takes `ENVIRONMENT_IS_WORKER` → `self.location.href`, undefined in workerd) **in any isolate where the create path's `ensureLibpgWasmGlobals()` shim hasn't run first** — and the rejection lands BEFORE the instrumented try, so no diag row ever exists. One silent skip is permanent (one-shot retarget; replay never re-runs it). "Dispatch-intermittent" was isolate routing all along: 13:19's sign-in landed on a create-warmed isolate (pass), 13:42's on a fresh one (fail). Proven by a controlled `heal-probe` preview A/B (own Neon branch + alias, flow driven over HTTP, cleaned up after): old code → D1 flipped, role missing, silent; fix → **role created + RLS literal retargeted**. Fix: `db-create/pg-client.ts` (WASM-free client module) imported statically; client construction moved inside the diag-instrumented try; `execWithTenantAclHeal` kept as the standing backstop for any future ACL drift. | **Verdict: app-side class closed.** Primary evidence = the probe A/B (role + RLS retarget confirmed from a fresh-isolate sign-in). Post-fix `ab` dispatches ([29197064567](https://github.com/nlqdb/nlqdb/actions/runs/29197064567), [29198672149](https://github.com/nlqdb/nlqdb/actions/runs/29198672149)) hit the lane-capacity class both times (NIM flapping + OpenRouter saturated 13:45→16:26 UTC; A aborted / ran starved on the weak lane, B 0/8 all 300s agent timeouts) — yet **zero `diag:` rows across both**, with create + adopt passing even on the starved lane, vs 4–18 deterministic `22023` rows per dispatch on pre-fix code whenever the adopted DB was queried. Remaining red = agent-lane capacity, the standing FEATURE.md OQ |

| 2026-07-13 | **Persisted the `schema_mismatch` SQLSTATE to KV (daily run 63, `SK-ASK-023` extension; condensed, full detail in git).** A main dispatch failed `#authed-state-preserved` with a *new* `schema_mismatch` symptom (not the `22023` ACL class closed 07-12) whose disambiguating SQLSTATE was dropped on preview URLs. `SchemaMismatchError` now carries `{pgCode,pgMessage}`; the orchestrator persists it via `deps.diag` (observability-only). The next dispatch's KV row named it `42P01` → the run-65 root cause below. | Measurement fix; row #15 stayed 0.75. Fed run-65's fix |

| 2026-07-13 | **`#authed-state-preserved` schema_mismatch root-caused to a cross-DB plan-cache collision + fixed (daily run 65, `SK-ASK-025`).** The run-63 durable KV diag row (dispatch [29277591306](https://github.com/nlqdb/nlqdb/actions/runs/29277591306), main) named it deterministically: `pgCode 42P01`, `pgMessage relation "users_d31c65.users" does not exist`, `dbId db_users_11d170`, **`cacheHit true`** — the plan named a schema (`users_d31c65`) that is NOT this DB's (`users_11d170`). The plan cache keys on the LOGICAL `schema_hash` (SK-PLAN-002/GLOBAL-006), but the LLM baked the per-DB PHYSICAL schema (minted from the dbId) into the SQL, so every DB from one fixture/preset collides on the key while the cached plan names a foreign schema — 42P01 under the least-privilege role that fails cross-schema reads closed (`build-deps.ts`). Confirmed systemic: the shared KV held foreign-qualified plans across `users` (baked by `users_d31c65` AND `users_c4b102`), `european_city_demographics`, `sickline`, `nums`. Fix (ask-pipeline only): `plan-normalize.ts` strips the DB's own schema qualifier before validate/exec/cache (search_path resolves the bare name); a hit still naming a schema is re-planned to self-heal, overwriting it schema-relative — restores SK-PLAN-002's portability with no key bump/flush (SK-PLAN-003 stands). | **Verdict: fixed + proven green.** Branch dispatch [29279457606](https://github.com/nlqdb/nlqdb/actions/runs/29279457606) (`depth=a`, fix commit) → Suite A **5/5, `✓ #authed-state-preserved`, exit 0**; no new `diag:schema_mismatch` row. Pre-fix same test red (main 19:12 + 06:20). Deterministic unit coverage: `plan-normalize.test.ts` (9) + 2 orchestrate integration tests. Row #15 → 1.0 lands on merge + a `main` re-dispatch |

| 2026-07-14 | **Re-dispatched opencheck on `main` after the SK-ASK-025 plan-cache fix merged (#684) — the fix holds; row #15's residual is now agent-lane capacity, not the product (daily run 67).** Run [29298056709](https://github.com/nlqdb/nlqdb/actions/runs/29298056709) (`depth=abc`, main `a5e72e6`): deploy ✅; **Suite C ✅** (sign-in → pin "users" by name → delete-row → 2nd-DB create/delete → keys → sign-out all green — direct proof the adopted-DB query path works post-fix); **Suite A ❌** — `#mock-sign-in`, `#add-row-redirects-to-auth`, `#authed-state-preserved` ALL `TEST_FAILED: exceeded timeout of 240000ms` (NOT schema_mismatch — the agent flapped mid-run; `#hero-or-cmdg` + `#create-table-anon` passed early in the same walk); **Suite B ❌ at pre-flight** — no healthy agent model on NIM primary NOR OpenRouter fallback (both free pools saturated at 01:34Z; C's pre-flight recovered ~1 min later). Zero `diag:schema_mismatch` rows — the timed-out tests never reached the query. | **Verdict: SK-ASK-025 confirmed holding on live main; row #15 stays 0.75.** The schema_mismatch class did NOT recur and Suite C exercised the adopted-DB read/delete path clean. Sole residual = the standing agent-lane-capacity flake (mid-run NIM flap + momentary dual-pool saturation), whose durable fix — an independent 3rd free-LLM pool — is a new repo secret (founder-only, now a top `blocked-by-human.md` bullet). Next: re-dispatch in a fresh free-pool window to catch a clean A+B+C, or wire the 3rd lane once provisioned |

**Cascade root-cause (2026-06-03):** `sessionMode: persistent` + one timed-out test starved downstream tests of expected DB state — burned the full 60-min ceiling (169 nav-timeout markers). **Remediation (a) SHIPPED 2026-06-04:** three suites (A/B/C), each a fresh session with an explicit sign-in setup step; `#submit-prefilled-row` fails fast on missing table. **Remediation (b) SHIPPED 2026-06-07:** the Alice fixture is seeded (with verify+retry) once in Suite B's `#b-setup`, so the read tests (`#read-shows-informative-data`, `#count-summarizes`) no longer cascade off the flaky single `/v1/ask` in `#submit-prefilled-row` — done via the chat (no infra/API-seed), so `#submit-prefilled-row` stays an independent write-path check. **Remediation (c) SHIPPED 2026-06-08:** every DB-needing Suite-B test now selects the "users" DB from the sidebar by name rather than trusting the bare-`/app` newest-DB auto-pin, so a stray/newer DB can no longer win the pin and trigger "references a table this database doesn't have".
