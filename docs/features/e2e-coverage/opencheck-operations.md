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

| 2026-06-12 | **Re-diagnosed the Suite-A blocker — NOT lead-model NL→SQL quality (PR #377; condensed, full detail in git).** Built the fast engine probe (`apps/api/scripts/global027-engine-probe.ts`, reproduces the `#authed-state-preserved` round-trip without the Playwright agent): cerebras gpt-oss-120b (chain head) is **8/8 self-consistent**; the ~50% flake is provider fallback under budget exhaustion + hedge amplification (SK-LLM-014 2×-burns the 5-RPM head). Corrected stale runbook: app engine = the cerebras-led chain, and budget pre-checks read **daily** TPD/RPD, not per-minute headers. Live confirmation Suite A **5/5** ✅ (run [27388402879](https://github.com/nlqdb/nlqdb/actions/runs/27388402879)) with Groq TPD + Gemini quota both spent — the healthy head carried the round-trip. Hedge-drop recommendation tracked under Open questions. |

| 2026-07-05 → 07-06 | **Ordered `candidate_models` pre-flight + trace-triage era (condensed; full detail in git).** Killed the single-model SPOF: `_e2e-opencheck.yml` walks 5 OpenRouter `:free` candidates, **3 consecutive tool-call probes** each (saturated pools flap — one lucky 200 ≠ health) + body inspection (429 can arrive under HTTP 200, the `SK-LLM-042` trap); first healthy model is substituted into the suite YAML; none healthy ⇒ loud abort with honest summary/exit. Verification runs also: repointed `#hero-or-cmdg`/`#add-row-redirects-to-auth` at the two-door homepage → `/app/new/` (SK-WEB-003); **BANNED nemotron-3-super** (probe-healthy, collapses to text-format tool calls mid-loop — runs [28760320317](https://github.com/nlqdb/nlqdb/actions/runs/28760320317)/[28767705937](https://github.com/nlqdb/nlqdb/actions/runs/28767705937)); confirmed gpt-oss-20b too weak for Suite B; added client `maxRetries: 6` for mid-run blips; `#authed-state-preserved` retries once on the Neon scale-to-zero "Couldn't reach the database" transient. Best: Suite A **4/5** (run [28768099957](https://github.com/nlqdb/nlqdb/actions/runs/28768099957)) with four pools simultaneously 429. Named blockers: app-side cold-start retry; OpenRouter free-pool capacity for the heavier B/C load. | infra SPOF dead; capacity remains |
| 2026-07-11 | **Second-provider fallback lane (daily run).** Root of the 13 consecutive failures 07-02 → 07-10: all five agent candidates sat on OpenRouter's shared free pool, which saturates as a unit at any hour — Suite A lost tests to 240s agent starvation **while the app answered the same tests' `/v1/ask` in ~4s** (traces). Fix: pre-flight walks a **fallback provider lane** (`fallback_provider_base_url` / `fallback_candidate_models` + `FALLBACK_LLM_API_KEY`; default NVIDIA NIM `gpt-oss-120b` — same weights, independent $0 pool, outside the app's engine chain so the two-budget split holds). | **Verdict (run [29134673858](https://github.com/nlqdb/nlqdb/actions/runs/29134673858), depth=a): lane fired live** — 4 OpenRouter candidates instant-429, NVIDIA picked 3/3; Suite A 4/5 with agent per-test 7.7–25.1s (vs 72–240s starved). Sole fail = the app-side class root-caused 07-11/07-12 below. Capacity class closed |
| 2026-07-11 | **Adopted-DB ACL gap root-caused + fixed (daily run).** The "cold-start `db_unreachable`" on `#authed-state-preserved` was never cold start: run-29134673858 traces show all 5 `/v1/ask` calls planning the correct SQL (confidence 1, `SELECT COUNT(*) FROM "users_21c31b"."users"`) and exec failing deterministically over 2.5 min while `#create-table-anon` had succeeded 60 s earlier; reproduced by hand 6 h later against the same staging row (`lastQueriedAt: null` on every fixture-user DB). Root: the test flow is create-anon → mock-sign-in (adopt) → query, and adoption only flipped `databases.tenant_id` in D1 — the schema's Postgres grants, the `WITH SET` role membership, and the baked `tenant_isolation` RLS literal all still named the anon creator, so exec's least-privilege `SET LOCAL ROLE tenant_<hash(adopter)>` (landed #614, 2026-07-05 — exactly when this class appeared) failed every query and fell into the log-less `db_unreachable` catch-all. Fix: adoption now runs a constant-size ACL retarget per migrated hosted DB (`retargetAdoptedDbAcl` — role-if-missing, grants, `WITH SET`, `ALTER POLICY` to the new tenant literal; SK-ANON-003 amendment) + the catch-all logs SQLSTATE structurally (`recordExecUnreachable`). Also a **prod** onboarding-funnel bug (anon create → sign-in → query dead-ends), not just e2e. | **Verdict (run [29144964531](https://github.com/nlqdb/nlqdb/actions/runs/29144964531), depth=a, fix deployed from branch): `#authed-state-preserved` PASS in 38.4s** — "querying ‘how many users are there?’ returns a valid count… the users table is present and queryable"; first pass on this test since #614 landed 07-05. Suite A 4/5; sole fail = `#add-row-redirects-to-auth` at 216s with agent restarts (the run-46 starvation/flap class on the OpenRouter primary lane — same test passed in 25s on 29134673858's NVIDIA lane), not app-side. The adopted-DB app class is **closed** |

| 2026-07-11 | **Lane swap: NIM promoted to primary agent lane (daily run 50).** The failure domain is the provider pool, not the model: OpenRouter's shared free pool failed 13 consecutive dispatches 07-02→07-10 and flapped past the 3-probe gate (216s starvation on a probe-healthy pick, run 29144964531), while NIM — same gpt-oss-120b weights, independent $0 pool — ran agent tests in 7.7–25s on both live firings. `_e2e-opencheck.yml` defaults + caller secrets swapped; probe logic and the two-budget split untouched. First full-depth (`abc`) dispatch on the NIM lane: run [29154050866](https://github.com/nlqdb/nlqdb/actions/runs/29154050866) — NIM picked 3/3 in all three suites, zero fallback walks, zero driver-starvation losses; `#add-row-redirects-to-auth` 216s starved FAIL → **14.9s PASS**. Suites: A 4/5 · B 3/8 · C **8/9** (first C signal since 06-09). | **Verdict: the driver-starvation class is closed; the surviving red is app/env-side.** Every Suite-B fail reads "Couldn't reach the database" on the fixture account's `users` DB (A's `#authed-state-preserved` burned its 240s the same way), and C's sole fail is `#delete-remaining-db` timing out over ~27 accumulated fixture DBs — stale D1 registry rows whose backing Neon `e2e` branch is recreated out from under them every run, so same-name sidebar pins can land on a schema that no longer exists. That stale-fixture class is the next lever candidate |

| 2026-07-11 | **Fixture-registry purge at spin-up (daily run 52, `SK-E2E-007`).** Root of run-50's surviving red: previews share prod's D1 control plane while the Neon `e2e` data plane is destroyed at both ends of every run, so fixture-account registry rows outlive their schemas — same-name sidebar pins can land on dead schemas and `#delete-remaining-db`'s one-modal-at-a-time walk grows unboundedly (name-scoped, it also never removes non-`users*` leftovers: a `db_products_tracker_*` row survived multiple runs). Fix: `_e2e-staging.yml` purges the fixture account's `databases`+`chat_message` rows right after branch recreation (both callers; a crashed run can't leak). | **Verdict (purged `abc` dispatch [29165068648](https://github.com/nlqdb/nlqdb/actions/runs/29165068648)): stale-fixture class closed — A 4/5 · B 4/8 · C 9/9 ✅** (first fully-green C; fixture rows 0 post-run vs the ~27-row timeout; C wall 11m11s → 6m06s; zero ghost DBs). Re-attribution: B's 4 fails + A's `#authed-state-preserved` are intermittent exec `db_unreachable` on the FRESH adopted `users` DB with passes interleaved (`#b-setup` 113 s ✅, `#read-shows-informative-data` 45 s ✅ between 129–286 s failures) — not ghost pins (none existed), not the deterministic run-48 ACL gap. Next lever: pull `recordExecUnreachable`'s SQLSTATE from staging logs during a `depth=a` run |

| 2026-07-12 | **The adopted-DB brick root-caused to an isolate-dependent import crash + fixed at the root and made self-healing (daily run 57, `SK-ASK-024`).** Morning `depth=a` on main: Suite A **5/5 in 95 s** ([29194166944](https://github.com/nlqdb/nlqdb/actions/runs/29194166944)) — first green workflow on main since the suite split. The post-heal `ab` branch dispatch then FAILED `#authed-state-preserved` again (fresh 22023 diag rows, zero heal/regrant rows) — the heal alone didn't save it, forcing the real root cause: **`makeAclRetarget`'s `await import("./db-create/build-deps.ts")` rejects at module scope** (libpg-query's Emscripten loader takes `ENVIRONMENT_IS_WORKER` → `self.location.href`, undefined in workerd) **in any isolate where the create path's `ensureLibpgWasmGlobals()` shim hasn't run first** — and the rejection lands BEFORE the instrumented try, so no diag row ever exists. One silent skip is permanent (one-shot retarget; replay never re-runs it). "Dispatch-intermittent" was isolate routing all along: 13:19's sign-in landed on a create-warmed isolate (pass), 13:42's on a fresh one (fail). Proven by a controlled `heal-probe` preview A/B (own Neon branch + alias, flow driven over HTTP, cleaned up after): old code → D1 flipped, role missing, silent; fix → **role created + RLS literal retargeted**. Fix: `db-create/pg-client.ts` (WASM-free client module) imported statically; client construction moved inside the diag-instrumented try; `execWithTenantAclHeal` kept as the standing backstop for any future ACL drift. | **Verdict: root cause closed with measured A/B on the same preview infra; re-verification `ab` dispatch from the PR branch on the fixed SHA — see the PR.** The failed 13:40 `ab` also aborted Suite B at pre-flight (NIM probe timeout + OpenRouter pool-wide 429 — the known lane-capacity class, loud abort by design) — unrelated to the app-side fix |

**Cascade root-cause (2026-06-03):** `sessionMode: persistent` + one timed-out test starved downstream tests of expected DB state — burned the full 60-min ceiling (169 nav-timeout markers). **Remediation (a) SHIPPED 2026-06-04:** three suites (A/B/C), each a fresh session with an explicit sign-in setup step; `#submit-prefilled-row` fails fast on missing table. **Remediation (b) SHIPPED 2026-06-07:** the Alice fixture is seeded (with verify+retry) once in Suite B's `#b-setup`, so the read tests (`#read-shows-informative-data`, `#count-summarizes`) no longer cascade off the flaky single `/v1/ask` in `#submit-prefilled-row` — done via the chat (no infra/API-seed), so `#submit-prefilled-row` stays an independent write-path check. **Remediation (c) SHIPPED 2026-06-08:** every DB-needing Suite-B test now selects the "users" DB from the sidebar by name rather than trusting the bare-`/app` newest-DB auto-pin, so a stray/newer DB can no longer win the pin and trigger "references a table this database doesn't have".
