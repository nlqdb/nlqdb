# Opencheck operations — model selection + progress tracker

Operational shard of [`e2e-coverage/FEATURE.md`](FEATURE.md), split out per
P4/D4 (FEATURE.md was at the 20 KB cap and the append-only tracker keeps
growing). Decisions stay in FEATURE.md; this file holds only the operator
reference + the run log.

## Free LLM model selection (opencheck)

**Policy: FREE MODELS ONLY** (GLOBAL-013). `LLM_API_KEY` in
`e2e-opencheck.yml` MUST source from a free provider (Groq, Cerebras,
OpenRouter `:free` only) — never a paid slug. On OpenRouter the `:free`
suffix is required; the bare slug is paid tier (2026-05-21: paid Mistral
burned ~$14). Each Groq model has its own TPM pool, so the three suites draw
from separate pools. **Account-level daily cap: ~100K tokens/day** (confirmed
from 429 error 2026-06-04: "Limit 100000, Used 97672" — shared across all
models; Suite A alone can exhaust it if agent loops are inefficient).

| Model | Provider | TPM | RPM | Daily | Ctx | Notes |
|---|---|---|---|---|---|---|
| `llama-3.3-70b-versatile` | Groq | 12 K | 1000 | ~100 K | 131 K | **Suite A.** Tool-call verified 2026-06-03. Account cap 100K (observed 2026-06-04). |
| `openai/gpt-oss-120b` | Groq | 8 K | 1000 | ~100 K | 131 K | **Suite B.** Reasoning-tuned; separate TPM pool; tool-call verified 2026-06-04. |
| `openai/gpt-oss-20b` | Groq | 8 K | 1000 | ~100 K | 131 K | **Suite C.** Lighter/faster; separate TPM pool; tool-call verified 2026-06-04. |
| `gpt-oss-120b` | Cerebras | 30 K | 5 | 1 M | 131 K | Tool-call verified 2026-06-04; 5 RPM too slow for agent loops (~32 calls/min needed). |
| `openai/gpt-oss-120b:free` | OpenRouter `:free` | shared | shared | shared | 131 K | $0; fallback when Groq TPD exhausted; `:free` suffix required. |
| ~~`qwen/qwen3-32b`~~ | Groq | — | — | — | — | **Not usable** — tool-call fails entirely on Groq (verified 2026-06-04). |
| ~~`llama-4-scout-17b-16e`~~ | Groq | — | — | — | — | **Not usable** — returns number params as strings; Groq schema validation rejects (verified 2026-06-04). |

**Switching:** edit `model:` in the target suite YAML
(`tests/opencheck/tests-{a,b,c}-*.yaml`),
`OPENAI_BASE_URL` (`_e2e-opencheck.yml`), and the `LLM_API_KEY` source
(`e2e-opencheck.yml`); re-verify the provider's tool-call shape with a
one-shot `curl … /chat/completions` first.

## Opencheck progress tracker (append-only)

| Date | Change | Outcome |
|---|---|---|
| 2026-05-20 → 05-31 | reruns / paid-Mistral swap / main rerun | all failed — cascade from `#submit-prefilled-row` 240 s timeout; **05-21 policy violation** (paid Mistral via OpenRouter, ~$14 burned); 05-31 also hallucinated `/app/databases` → 404 |
| 2026-06-03 | first free-only run (Groq `llama-3.3-70b-versatile`, run [26890333007](https://github.com/nlqdb/nlqdb/actions/runs/26890333007)) | **cancelled at 60-min ceiling** — key worked; `/app/databases` hallucination did NOT recur; but `#submit-prefilled-row` + 169 nav-timeout markers → persistent-mode cascade **persists**. Triggers remediation (a)+(b). |
| 2026-06-04 | 3-suite split (A: bootstrap 5 / B: read-write 8 / C: cleanup 9); separate Groq model per suite (independent TPM pools); `#submit-prefilled-row` simplified to fail-fast (no table-creation recovery); `_e2e-opencheck.yml` gains a `config_file` input | run [26924055024](https://github.com/nlqdb/nlqdb/actions/runs/26924055024): cascade isolated to Suite A — `#hero-or-cmdg` ✅, `#create-table-anon` 240 s timeout. Root-caused: it polled for an `/app` redirect that never happens (`CreateForm.tsx` shows "Provisioned with…" in place; SK-ANON-012). Rewrote to poll for "Provisioned with" then navigate to `/auth/sign-in`. Runs [26924879778](https://github.com/nlqdb/nlqdb/actions/runs/26924879778) / [26925791614](https://github.com/nlqdb/nlqdb/actions/runs/26925791614): all 5 still 240 s timeout, no recordings. Enabled `LANGCHAIN_VERBOSE=true` to diagnose. |
| 2026-06-04 | `LANGCHAIN_VERBOSE=true` diagnostic run | run [26926706549](https://github.com/nlqdb/nlqdb/actions/runs/26926706549): all 5 tests 240 s timeout; no recordings. Root cause confirmed: **Groq account-level TPD exhausted** — 429 at 02:46:43 UTC: "Limit 100000, Used 97672, Requested 3502". Tests 1-2 burned ~94K tokens in agent loops before 429; tests 3-5 timed out on 429 retry waits. `LANGCHAIN_VERBOSE` reverted to `false`. Added: 30s per-call LLM HTTP timeout (patch to `model-factory.ts`) + pre-flight curl check before opencheck. |

**Cascade root-cause (2026-06-03):** `sessionMode: persistent` + one timed-out test starved downstream tests of expected DB state — burned the full 60-min ceiling (169 nav-timeout markers). **Remediation (a) SHIPPED 2026-06-04:** three suites (A/B/C), each a fresh session with an explicit sign-in setup step; `#submit-prefilled-row` fails fast on missing table. **Remediation (b) parked:** API-seeded fixtures, until the split proves insufficient.
