# SK-PREMIUM-003 — The user-facing knob is goal-first presets, plus an advanced catalog-served named picker

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md).

- **Decision:** The primary knob every surface exposes is
  `model: "auto" | "fast" | "best"` (and an Enterprise-only `"custom"`),
  **not** raw model strings in customer code. `auto` (default) lets the
  classifier route — a frontier model only when the request crosses the
  hard-plan confidence threshold; `fast` pins the strict-$0 chain even if
  premium is enabled; `best` pins the frontier chain (with a per-call cost
  confirmation chip on chat, none on programmatic surfaces); `custom` is
  reserved for Enterprise contracts.
  - **Amended by [`SK-PREMIUM-013`](./SK-PREMIUM-013-model-catalog-and-picker.md)
    ("Both"):** surfaces MAY *also* offer an **advanced named picker**
    (e.g. "Claude Opus 4.8", "Gemini 2.5 Pro") for power users who want a
    specific frontier model — in practice via BYOLLM. The rule that survives
    is *no model string in a surface file*: the named catalog is served from
    `@nlqdb/llm` over the wire (`GET /v1/models`, SK-PREMIUM-013), so a
    surface still renders labels it received, never a literal it hardcoded.
    Presets and the named picker coexist; presets stay the goal-first default.
- **Core value:** Goal-first, Simple, Effortless UX
- **Why:** Users don't wake up wanting "Sonnet 4.6" — they want "answer this
  hard question right" or "stay cheap", so presets are the default. But the
  reason to forbid raw model names was that they *leak a moving decision into
  customer code* — a model catalog that changes every quarter becomes a 4xx
  when a stale id ships. The wire-served catalog removes exactly that hazard:
  a named picker is safe **because** the strings live server-side and reach
  the surface as data, so a new frontier model is a one-line `catalog.ts`
  edit, not a customer-code change. That reconciliation is what makes "Both"
  possible without reopening the original risk.
- **Consequence in code:** SDK/CLI/MCP/`<nlq-data>`/HTTP accept the preset
  enum (`model: "auto"|"fast"|"best"`; the param + its free/premium routing
  land with the hosted-premium lane — tracked gap in the parent feature).
  The named picker + its catalog land per SK-PREMIUM-013. Provider+model
  strings live only in `packages/llm/src/chains/{free,paid}.ts` **and**
  `packages/llm/src/catalog.ts`; no other package imports them. Tests assert
  that no `apps/web/**`, `cli/**`, `packages/sdk/**`, or `packages/mcp/**`
  file references a model string — the catalog reaches them over the wire.
- **Alternatives rejected:**
  - **Expose raw model names in customer code** — still rejected; every new
    frontier model would be a customer-side change. The amendment permits
    named models *only* via the wire catalog, never hardcoded in a surface.
  - **Single boolean (`premium: true`)** — loses the `fast` use case (a
    premium-enabled DB still wants the strict-$0 chain on a CI run).
  - **Per-call temperature / max-tokens knobs** — leaks LLM-API shape into
    our surface; revisit only if Pro customers ask.
- **Source:** docs/architecture.md §0 (Goal-first) · §8 (model catalog) ·
  GLOBAL-002 (parity) · GLOBAL-017 (one way to do each thing) ·
  [`SK-PREMIUM-013`](./SK-PREMIUM-013-model-catalog-and-picker.md) (the "Both" amendment)
