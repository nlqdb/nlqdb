# SK-PREMIUM-013 — Model catalog endpoint + the two-door frontier picker

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Resolves the
"Both" branch of [`SK-PREMIUM-003`](./SK-PREMIUM-003-model-knob.md) and gives
the [`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
lanes a user-facing home.

- **Decision:** A single `GET /v1/models` serves the canonical catalog
  (`@nlqdb/llm` `MODEL_CATALOG`): the `auto|fast|best` presets plus the named
  picker — `free` (built-in chain) and a curated set of frontier BYOLLM
  entries carrying the `provider`/`model` the account-store / `x-nlq-byollm-key`
  lanes need. Every surface renders the picker from this wire catalog, never
  a hardcoded model string (SK-PREMIUM-003). Selecting a frontier model
  routes **two doors**:
  1. **Bring your own key (BYOLLM)** — live for every tier per
     [`SK-PREMIUM-008`](./SK-PREMIUM-008-byollm.md); 0% markup. Selecting a
     frontier model with no stored key opens a **gentle inline key form**
     (never a wall), which `setByollm`s the key and routes later asks through
     it.
  2. **Subscribe** — hosted-premium included credits
     ([`SK-PREMIUM-009`](./SK-PREMIUM-009-hosted-premium-meter.md)); §6-gated,
     so the picker surfaces it as **"coming soon"** and never fakes it.
  "Which model am I on?" is answered by `trace.model` (`SK-TRUST-002`) on
  every surface — MCP now includes it (previously stripped at that boundary);
  the web reflects the active selection in a header **model pill**.
- **Core value:** Effortless UX, Goal-first, Honest latency
- **Why:** The onboarding intent (per the founder) is that a user can *see*
  which model answers and change it *where they work*, and that a frontier
  model is one gentle click + a key away — not a docs safari. Serving the
  catalog over the wire keeps model strings out of surface bundles
  (SK-PREMIUM-003), so keeping "a few frontier models up to date" is a
  one-line `catalog.ts` edit. The two doors map exactly onto GLOBAL-026's
  lanes — BYOLLM (0% markup, every tier) and hosted premium (paid) — so the
  free tier never sees "premium for free" ([`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md)
  intact); the subscribe door stays dark until the §6 trigger.
- **Consequence in code:**
  - `packages/llm/src/catalog.ts` — `MODEL_CATALOG`, the sole home for the
    picker's model strings (+ a unit test pinning the id/provider shape).
  - `apps/api` `GET /v1/models` — public, static, unauthenticated (the picker
    renders before sign-in, GLOBAL-007). A test asserts every catalog BYOLLM
    provider ∈ `SUPPORTED_BYOLLM_PROVIDERS` so the two never drift.
  - `@nlqdb/sdk` — `getModels()` + `ModelCatalog`/`CatalogModel` types; a
    `link?` field on `ApiErrorBody` so a BYOLLM error can carry a
    resolve-it-here URL (GLOBAL-012).
  - `packages/mcp` — `queryOutputShape.trace.model` + `traceOf` now surface
    the model (un-stripped) so an MCP host can answer "which model?".
  - `apps/web` — `components/chat/ModelPicker.tsx`: the header pill (active
    model) + popover (Free + named frontier) + inline masked-key form via
    `setByollm`, wired into `ChatPanel`. No model string in the file — all
    from the wire catalog.
- **Surface-parity gaps (GLOBAL-003 — tracked, land with the hosted-premium lane):**
  - The `model` preset param on `/v1/ask` + its free/premium routing — premium
    is §6-dark, so the web slice ships the **functional named picker** only;
    interactive `auto|fast|best` buttons wait for the lane they'd route to
    (shipping a dead knob would be dishonest UX).
  - SDK `model` option, CLI `--model` / `nlq model set`, `<nlq-data model>`,
    MCP `model` param — the preset-knob parity.
  - Per-provider key storage + keyless model-switch within a provider
    (SK-PREMIUM-012 is one row/account today, so switching models re-enters
    the key).
  - The `SK-PREMIUM-004` hard-plan in-context CTA (inline in the parent
    feature) and the subscribe door's hosted-premium backend (SK-PREMIUM-009).
- **Alternatives rejected:**
  - **Hardcode the catalog in each surface** — leaks model strings into
    customer code (SK-PREMIUM-003); a new model becomes N surface edits.
  - **A per-reply model dropdown** — rejected by SK-PREMIUM-004; the picker is
    one header control, not a widget next to every answer.
  - **Account-wide premium toggle from the header** — SK-PREMIUM-001 keeps
    hosted-premium per-(DB, key); the header pill drives BYOLLM (account-level,
    already allowed) and the subscribe door links to DB settings.
  - **Ship interactive `auto/fast/best` now** — they route to a §6-dark lane,
    so they'd be a no-op knob; defer until the routing is real.
- **Source:** [`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md) ·
  [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md) ·
  [`GLOBAL-007`](../../../decisions/GLOBAL-007-no-login-wall.md) ·
  `SK-PREMIUM-003` · `SK-PREMIUM-001` · `SK-PREMIUM-008` · `SK-PREMIUM-009` ·
  `SK-PREMIUM-012` · `SK-TRUST-002`
