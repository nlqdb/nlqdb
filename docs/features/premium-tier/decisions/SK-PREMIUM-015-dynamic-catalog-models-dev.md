# SK-PREMIUM-015 — The frontier picker is sourced live from models.dev, grouped one row per provider

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Extends
[`SK-PREMIUM-013`](./SK-PREMIUM-013-model-catalog-and-picker.md) (the catalog
endpoint + picker) and its parent
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** The named frontier picker is no longer a hand-maintained list.
  `apps/api` builds the `GET /v1/models` catalog **live from
  [models.dev](https://models.dev)** (`api.json`, MIT-licensed, no API key) and
  serves it grouped **one row per provider** — Claude, GPT, Gemini, Grok,
  OpenRouter. Each row carries that provider's current models (newest first,
  searchable) and its flagship default; the mapping (`@nlqdb/llm`
  `buildCatalogFromModelsDev`) is pure and filters to tool-capable,
  text-output, non-open-weights models (OpenRouter keeps open-weights — its
  whole point — but drops `:`-variant ids the header format can't round-trip).
  The wire shape is `{ presets, free, providers[] }` (was `{ presets, models[] }`).
  The fetch carries its own OTel span (GLOBAL-014) and is edge-cached ~1 day;
  any failure (timeout, non-200, bad JSON) degrades to a **bundled snapshot**
  (`@nlqdb/llm` `MODEL_CATALOG`) so the picker is never empty and we keep no
  runtime hard-dependency on a third party ([`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md)).
- **Core value:** Effortless UX, Bullet-proof, Honest latency
- **Why:** The hand-maintained catalog silently went stale — it recommended
  Gemini 2.5 Pro when Gemini was on 3.x, and lacked Sonnet 5 / GPT-5.6 — so the
  picker was steering users to older-than-frontier models exactly when a user
  reaching for the picker wants the current best. A trusted community registry
  keyed by provider, refreshed continuously, makes "keep a few frontier models
  up to date" a zero-edit property of the system instead of a chore nobody
  remembers. Grouping by provider (with an in-row search) is what lets us list
  every current model per lab and OpenRouter's hundreds without overwhelming —
  the row is collapsed to its flagship until opened.
- **Leverage:** invest.
  - **N+1:** a new *model* within a provider costs **0** (models.dev pulls it);
    a new *compat provider row* costs **3 config lines** (`PROVIDER_META` +
    `PROVIDER_SOURCES` in `@nlqdb/llm` + `SUPPORTED_BYOLLM_PROVIDERS` in
    `apps/api`); a new *non-compat provider* generalises the one
    `isOpenRouter` branch in `createByollmProvider` into an endpoint-mode field.
  - **Category:** "BYOLLM frontier provider in the model picker" — 3 instances
    at discovery (openai / anthropic / google-ai-studio); this adds #4 grok and
    #5 openrouter. The OpenRouter dedicated-path branch is the one
    spend-with-seams (extraction trigger: 2nd non-compat provider).
- **Consequence in code:**
  - `packages/llm/src/catalog.ts` — new grouped types (`CatalogProvider`,
    `CatalogModelOption`), shared `PROVIDER_META`, and `MODEL_CATALOG` as the
    bundled snapshot fallback.
  - `packages/llm/src/models-dev.ts` — pure `buildCatalogFromModelsDev` +
    `PROVIDER_SOURCES` (slug↔models.dev-id map, `xai→grok`, `google→google-ai-studio`).
  - `apps/api/src/models-catalog.ts` — `loadModelCatalog` (fetch + span + edge
    cache + snapshot fallback); `GET /v1/models` is now async.
  - `@nlqdb/sdk` — mirrored `ModelCatalog`/`CatalogProvider`/`CatalogModelOption`.
  - `apps/web` — `ModelPicker` renders one searchable row per provider from the
    wire catalog (no model string in the file, SK-PREMIUM-003).
- **Alternatives rejected:**
  - **Keep hand-maintaining `catalog.ts`** — the staleness this fixes; a new
    model is a chore that silently doesn't happen.
  - **OpenRouter `/api/v1/models` as the source** — OpenRouter-centric and
    needs a key for inference; models.dev is provider-agnostic and keyless.
  - **Fetch models.dev with no snapshot** — a third-party outage would empty
    the picker; the bundled snapshot keeps it working offline (GLOBAL-013).
  - **Flat model list, group in the client** — pushes the provider taxonomy
    into every surface; grouping on the wire keeps surfaces dumb renderers.
- **Source:** [`SK-PREMIUM-013`](./SK-PREMIUM-013-model-catalog-and-picker.md) ·
  [`SK-PREMIUM-008`](./SK-PREMIUM-008-byollm.md) ·
  [`GLOBAL-013`](../../../decisions/GLOBAL-013-free-tier-bundle-budget.md) ·
  [`GLOBAL-014`](../../../decisions/GLOBAL-014-otel-on-external-calls.md) ·
  [`SK-LLM-019`](../../llm-router/decisions/SK-LLM-019-byollm-provider-factory.md) ·
  models.dev (MIT)
