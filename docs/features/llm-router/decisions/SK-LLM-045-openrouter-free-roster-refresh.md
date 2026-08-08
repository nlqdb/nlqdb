# SK-LLM-045 — OpenRouter free-model roster refresh: Nemotron 3 Ultra + Gemma 4 26B replace the dead Qwen3 Coder / Llama `:free` ids

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Supersedes
[`SK-LLM-015`](./SK-LLM-015-openrouter-codegen-default.md) — same two-slot
shape (code-gen tier + cheap tier), new model ids because the old ones no
longer exist on OpenRouter's free catalog.

- **Decision:** `packages/llm/src/providers/openrouter.ts` `DEFAULT_MODELS`
  changes to `nvidia/nemotron-3-ultra-550b-a55b:free` for `plan` /
  `schema_infer` / `summarize`, and `google/gemma-4-26b-a4b-it:free` for
  `route` / `engine_classify`. Chain order in `apps/api/src/llm-router.ts`
  is unchanged (OpenRouter stays universal fallback per `SK-LLM-003`).
- **Core value:** Free, Bullet-proof
- **Why:** Live-verified against `GET /v1/models` and a real
  `POST /chat/completions` call (2026-08-08): `qwen/qwen3-coder:free`,
  `meta-llama/llama-3.1-8b-instruct:free`, and
  `meta-llama/llama-3.3-70b-instruct:free` (the SK-LLM-015 / SK-LLM-003
  ids) have all been converted to paid-only on OpenRouter — every request
  the free chain currently sends to OpenRouter 404s. This is a silent
  production regression, not a hypothetical: OpenRouter is the chain's
  last-resort tail on every operation (`route`, `plan`, `summarize`,
  `schema_infer`, `engine_classify` — see `apps/api/src/llm-router.ts`),
  so the one provider meant to catch every other free-tier outage was
  itself permanently down.
  Replacements were chosen from OpenRouter's current (2026-08-08) `:free`
  roster and verified live, not by name recognition:
  - `nvidia/nemotron-3-ultra-550b-a55b:free` — 71.9% SWE-bench Verified
    (vs. Qwen3 Coder's ~96% *text-to-SQL*, a different benchmark; no
    directly comparable SQL number is published for Nemotron 3 Ultra, but
    it is the strongest reasoning model on OpenRouter's current free
    roster), 1M context, and — despite being a 550B-param MoE (55B
    active) — the fastest and cleanest of the reasoning-tier candidates
    tested live: ~2.3–2.9 s per call with a `content` field containing
    only the answer (no chain-of-thought leaking into `content`; the
    model's own `reasoning` field carries that separately, which
    `openai-compatible.ts` already ignores). `nvidia/nemotron-3-super-120b-a12b:free`,
    `cohere/north-mini-code:free`, and `openai/gpt-oss-20b:free` were also
    live-tested: all three returned correct output but took 11–22 s per
    call against the same prompt — too slow for the `plan` (5000 ms) /
    `schema_infer` (8000 ms) router budgets to reach reliably.
  - `google/gemma-4-26b-a4b-it:free` — replaces Llama 3.x `:free` for the
    cheap tier. 262144 context, clean JSON-only `content` (no reasoning
    field to strip), and consistently ~1–3.3 s per call across repeated
    live calls — well inside the `route` (1500 ms) / `engine_classify`
    (1500 ms) budgets most of the time, and OpenRouter is the last entry
    in both chains anyway (`["groq", "gemini", "workers-ai",
    "openrouter"]`), so it only fires after three faster providers have
    already failed.
- **Consequence in code:** `packages/llm/src/providers/openrouter.ts`
  `DEFAULT_MODELS` change only — same shape as SK-LLM-015, no `Provider`
  interface or chain-order change. `packages/llm/test/providers/openrouter.test.ts`
  `model()` assertions updated to match.
- **Alternatives rejected:**
  - **`nvidia/nemotron-3-super-120b-a12b:free` for the code-gen tier** —
    scores well on SWE-bench (60.5) and is the next-strongest option, but
    took ~22 s per call live, more than 4× the `plan` timeout; parked as a
    candidate if Nemotron 3 Ultra's shared pool saturates.
  - **`cohere/north-mini-code:free`** — a genuine coding-specialist model
    (67.6% SWE-bench Verified) and the most literally on-brand pick for a
    code-gen op, but ~11.5 s per live call, same timeout problem as
    Nemotron 3 Super.
  - **Re-adding a Cohere / NVIDIA NIM *direct* API key** — both were
    already rejected in `SK-LLM-023` / `SK-LLM-028` for the same
    `GLOBAL-013` reason (finite trial credit pools, not a renewable
    quota). Routing through OpenRouter's own free quota instead of a
    direct key sidesteps that: the model runs against OpenRouter's
    renewable per-day allowance, not NVIDIA's or Cohere's finite one.
  - **Leaving the dead ids in place and letting the chain fail through to
    the (also-tail) Mistral entry on `plan`/`schema_infer`** — `route`,
    `summarize`, and `engine_classify` have no such backstop, so those
    three ops would simply error out once every provider ahead of
    OpenRouter in the chain is unavailable.
- **Not in scope:** `.github/workflows/_e2e-opencheck.yml` and
  `docs/features/e2e-coverage/opencheck-operations.md` reference several
  of the same now-dead OpenRouter ids, but that is a separate,
  independently-curated agentic-tool-calling e2e harness (`e2e-coverage`
  feature) with its own live-tested candidate list (as of 2026-08-08 it
  had already dropped `openai/gpt-oss-20b:free` and flagged
  `nvidia/nemotron-3-super-120b-a12b:free` as unusable for *tool-calling*
  loops specifically) — left untouched here.
