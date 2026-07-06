# SK-PREMIUM-014 — The `model` preset rides `/v1/ask` on every surface; `fast` pins free, `best` fails loud without a frontier lane

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Ships the
preset half of the [`SK-PREMIUM-013`](./SK-PREMIUM-013-model-catalog-and-picker.md)
surface-parity gap list.

- **Decision:** `/v1/ask` accepts an optional `model: "auto" | "fast" | "best"`
  (validated at parse time against `MODEL_PRESETS`; unknown values 400
  `invalid_model` with the allowed list). Routing lives in
  `selectDispatchLane` — the one testable precedence for every surface:
  `fast` pins the strict-$0 chain even when a BYOLLM credential (header or
  account) or the founder-funded frontier upgrade would otherwise apply;
  `best` requires a frontier lane — a BYOLLM key today, hosted premium once
  §6 lights — and with none available returns **409 `model_unavailable`**
  with a resolve-it `link`, never a silent downgrade to the free chain;
  `auto`/absent keeps the default precedence. Surfaces are pure
  passthroughs of the same enum (GLOBAL-002): SDK `AskRequest.model`, CLI
  `nlq ask --model`, MCP `nlqdb_query.model`, `<nlq-data model>`. Named
  frontier models stay off the per-request wire — they route via the
  stored BYOLLM key (SK-PREMIUM-012/013).
- **Core value:** Goal-first, Honest latency, Bullet-proof
- **Why:** SK-PREMIUM-003 pinned the enum; this pins the failure
  semantics, where both easy paths are dishonest: `best` quietly served by
  the free chain makes the knob a placebo, and `fast` that still rides a
  stored BYOLLM key spends the user's own money against an explicit "stay
  cheap" instruction (the CI-key case SK-PREMIUM-003 names). Fail-loud
  `best` also gives the §6 demand signal an honest denominator — the
  bounded `llm.model_preset` attribute plus the `model_unavailable`
  outcome count who asks for frontier and gets turned away.
- **Consequence in code:** `packages/llm/src/byollm-dispatch.ts`
  (`DispatchInputs.preset`, terminal `unavailable` selection),
  `apps/api/src/http.ts` (`invalid_model`), `apps/api/src/ask/byollm.ts`
  (`frontier_unavailable` → the handler's 409), `apps/api/src/index.ts`
  (`fast` also skips the SK-FRONTIER-001 upgrade), plus the four surface
  passthroughs. `model` never enters the plan-cache key (GLOBAL-006 /
  SK-PREMIUM-007) — a cache hit answers every preset for free.
- **Alternatives rejected:**
  - **Silent `best` → free fallback with a trace note** — trace notes go
    unread on programmatic surfaces; a paid-intent knob that no-ops is the
    placebo UX this feature refuses (`GLOBAL-023` spirit).
  - **Accept named catalog ids per-request** — reopens the
    model-strings-in-customer-code hazard SK-PREMIUM-003 exists to
    prevent; the named door stays key-scoped.
  - **400 on `fast` + attached BYOLLM credential as a contradiction** —
    the account-stored key is ambient, not per-request intent; `fast` is
    the explicit instruction, so pinning free is obedience, not conflict.
- **Source:** SK-PREMIUM-003 · SK-PREMIUM-013 · SK-LLM-016/017 ·
  GLOBAL-002 · GLOBAL-003 · GLOBAL-012
