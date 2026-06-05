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

- **opencheck agent** (`LLM_API_KEY`, the Playwright-MCP driver) →
  **OpenRouter `openai/gpt-oss-120b:free`**. The agent loop is the dominant
  consumer (~94K tokens/run); on OpenRouter `:free` those tokens are $0 and
  the budget is the OpenRouter account's free-model request cap (1000
  req/day at ≥$10 balance, 20 RPM) — entirely separate from Groq.
- **staging app** (`GROQ_API_KEY`, the preview's `/v1/ask` + NL db-create) →
  **Groq**. With the agent off Groq, the ~100K-tokens/day Groq account cap is
  reserved for the app's much smaller per-run draw (~20-40K).

**Why this was the root cause:** Groq's free daily cap (~100K tokens) is
**account-level, shared across every Groq model** — the per-model pools are
per-*minute* (TPM) only. Running the agent *and* the app on Groq meant the
agent's ~94K + the app's draw 429'd the shared daily budget before tests
finished (429 on 2026-06-04: "Limit 100000, Used 97672"). Splitting the
three suites across separate Groq *models* never helped, because they all
drew from the one daily account cap.

| Model | Provider | RPM | Daily budget | Role |
|---|---|---|---|---|
| `openai/gpt-oss-120b:free` | OpenRouter `:free` | 20 | 1000 req/day ($0 tokens) | **Agent — all suites.** Tool-call verified 2026-06-05. |
| `openai/gpt-oss-20b:free` | OpenRouter `:free` | 20 | shared OpenRouter free req budget | Lighter agent alt; tool-call verified 2026-06-05. |
| `llama-3.3-70b-versatile` | Groq | 1000 | ~100K tokens/day (account-wide) | **App-side** `/v1/ask`. Daily cap shared across all Groq models. |
| `gpt-oss-120b` | Cerebras | 5 | 1M tokens/day | Tool-call verified 2026-06-05; 5 RPM too slow for agent loops (~32 calls/min needed). |
| ~~`qwen/qwen3-32b`~~ | Groq | — | — | **Not usable** — tool-call fails entirely on Groq (2026-06-04). |
| ~~`llama-4-scout-17b-16e`~~ | Groq | — | — | **Not usable** — returns number params as strings; Groq rejects (2026-06-04). |

**Switching the agent provider:** edit `model:` in the target suite YAML
(`tests/opencheck/tests-{a,b,c}-*.yaml`), the `provider_base_url` +
`preflight_model` inputs the caller passes (`e2e-opencheck.yml`), and the
`LLM_API_KEY` source (`e2e-opencheck.yml`); re-verify the provider's
tool-call shape with a one-shot `curl … /chat/completions` first.

**Cheap iteration:** the `depth` dispatch input (`a` | `ab` | `abc`) runs
only as far down the state-dependent A→B→C chain as asked. Use `depth=a`
for a ~15-min Suite-A-only signal instead of gambling a full ~60-min run.

## Opencheck progress tracker (append-only)

| Date | Change | Outcome |
|---|---|---|
| 2026-05-20 → 05-31 | reruns / paid-Mistral swap / main rerun | all failed — cascade from `#submit-prefilled-row` 240 s timeout; **05-21 policy violation** (paid Mistral via OpenRouter, ~$14 burned); 05-31 also hallucinated `/app/databases` → 404 |
| 2026-06-03 | first free-only run (Groq `llama-3.3-70b-versatile`, run [26890333007](https://github.com/nlqdb/nlqdb/actions/runs/26890333007)) | **cancelled at 60-min ceiling** — key worked; `/app/databases` hallucination did NOT recur; but `#submit-prefilled-row` + 169 nav-timeout markers → persistent-mode cascade **persists**. Triggers remediation (a)+(b). |
| 2026-06-04 | 3-suite split (A: bootstrap 5 / B: read-write 8 / C: cleanup 9); separate Groq model per suite (independent TPM pools); `#submit-prefilled-row` simplified to fail-fast (no table-creation recovery); `_e2e-opencheck.yml` gains a `config_file` input | run [26924055024](https://github.com/nlqdb/nlqdb/actions/runs/26924055024): cascade isolated to Suite A — `#hero-or-cmdg` ✅, `#create-table-anon` 240 s timeout. Root-caused: it polled for an `/app` redirect that never happens (`CreateForm.tsx` shows "Provisioned with…" in place; SK-ANON-012). Rewrote to poll for "Provisioned with" then navigate to `/auth/sign-in`. Runs [26924879778](https://github.com/nlqdb/nlqdb/actions/runs/26924879778) / [26925791614](https://github.com/nlqdb/nlqdb/actions/runs/26925791614): all 5 still 240 s timeout, no recordings. Enabled `LANGCHAIN_VERBOSE=true` to diagnose. |
| 2026-06-04 | `LANGCHAIN_VERBOSE=true` diagnostic run | run [26926706549](https://github.com/nlqdb/nlqdb/actions/runs/26926706549): all 5 tests 240 s timeout; no recordings. Root cause confirmed: **Groq account-level TPD exhausted** — 429 at 02:46:43 UTC: "Limit 100000, Used 97672, Requested 3502". Tests 1-2 burned ~94K tokens in agent loops before 429; tests 3-5 timed out on 429 retry waits. `LANGCHAIN_VERBOSE` reverted to `false`. Added: 30s per-call LLM HTTP timeout (patch to `model-factory.ts`) + pre-flight curl check before opencheck. |
| 2026-06-05 | **Provider split — agent off Groq.** Diagnosed the 2026-06-04 exhaustion as structural: the Groq ~100K/day cap is **account-level (shared across all Groq models)**, so the 3-model suite split could never give independent budgets while the agent *and* the app both ran on Groq. Moved the opencheck agent (the ~94K-token consumer) to **OpenRouter `openai/gpt-oss-120b:free`** ($0 tokens, own 1000-req/day budget); Groq's daily cap is now reserved for the staging app's `/v1/ask` only. Also: parameterised `provider_base_url`/`preflight_model` in `_e2e-opencheck.yml` (preflight curl was hardcoded to a Groq model → would 404 on any other provider); added a `depth` (a\|ab\|abc) dispatch input for a fast Suite-A-only signal. Pre-flight rate-limit + tool-call re-verified live for OpenRouter `:free` + Cerebras + Groq before triggering. |
| 2026-06-05 | **First real signal — Suite A 4/5.** Run [26989456115](https://github.com/nlqdb/nlqdb/actions/runs/26989456115) (`depth=a`): pre-flight ✅, opencheck ran to completion (no 429 — the provider split worked). **Passed 4/5**: `#hero-or-cmdg`, `#create-table-anon`, `#mock-sign-in`, `#authed-state-preserved` ✅; failed `#add-row-redirects-to-auth` (navigated to `/app`, not `/auth/sign-in`). Root cause: **test-ordering bug, not an app bug.** `#create-table-anon` did the *whole* create→sign-in→adopt→sign-out flow, so by the auth-wall test the session was authed/post-adoption and the anon wall can't fire. The app is correct per SK-ANON-012 (per-device create cap: counter has a 90-day TTL, keyed on the anon token; `recordAnonAdoption` writes to D1 not KV, so adoption never clears it). **Fix:** made `#create-table-anon` create-only (stay anonymous); `#add-row-redirects-to-auth` now runs as the natural 2nd anonymous call → device cap → `/auth/sign-in`; sign-in + adoption verification move to `#mock-sign-in` + `#authed-state-preserved`. Same case names (persona refs intact), Suite B's adopted-DB end state preserved. Re-triggering `depth=a` to validate. |

**Cascade root-cause (2026-06-03):** `sessionMode: persistent` + one timed-out test starved downstream tests of expected DB state — burned the full 60-min ceiling (169 nav-timeout markers). **Remediation (a) SHIPPED 2026-06-04:** three suites (A/B/C), each a fresh session with an explicit sign-in setup step; `#submit-prefilled-row` fails fast on missing table. **Remediation (b) parked:** API-seeded fixtures, until the split proves insufficient.
