# SK-LLM-015 — OpenRouter code-gen ops default to `qwen/qwen3-coder:free`

- **Decision:** OpenRouter pins `plan` and `schema_infer` to
  `qwen/qwen3-coder:free` (480B MoE, 1M context); `route` /
  `summarize` / `engine_classify` stay on Llama `:free`.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** Qwen-Coder lineage hits ~96% on text-to-SQL vs ~88% for
  Llama 3.3 70B, and 1M context fits goal+schema without truncation —
  strictly better on the two code-gen ops where OpenRouter actually
  fires.
- **Consequence in code:**
  `packages/llm/src/providers/openrouter.ts` `DEFAULT_MODELS` change
  only; chain order in `apps/api/src/llm-router.ts` unchanged
  (OpenRouter stays universal fallback per SK-LLM-003).
- **Alternatives rejected:** Promote OpenRouter to chain head
  (unmeasured latency through provider routing — defer to
  `quality-eval`); Qwen3-Coder for all five ops (overkill latency on
  cheap-tier ops); stay on Llama 3.3 70B (leaves ~8 accuracy points
  on the table on the operation we cache hardest).
