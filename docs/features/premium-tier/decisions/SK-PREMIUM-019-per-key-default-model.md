# SK-PREMIUM-019 — Per-API-key `default_model`; precedence: request > per-key default > server default

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Builds on the
[`SK-PREMIUM-003`](./SK-PREMIUM-003-model-knob.md) preset enum and the
[`SK-PREMIUM-014`](./SK-PREMIUM-014-model-preset-wire.md) `/v1/ask` `model` wire,
and is the per-key granularity `SK-PREMIUM-001` names.

- **Decision:** An API key may carry a nullable `default_model` — a `/v1/ask`
  `model` preset (`"fast" | "best"`; `"auto"` is never stored, it is the same as
  no default and normalises to NULL). The effective preset for a request is
  resolved by a single ladder:
  **request `model` > per-key `default_model` > server default** (hosted-premium
  if eligible per `SK-PREMIUM-018`, else the free chain). NULL = no per-key
  default. This is a per-key knob only — there is **no** account-wide default
  model (`SK-PREMIUM-001`: the pricing-control unit is the key, never the
  account); web / session traffic keeps its interactive `ModelPicker`.
- **Core value:** Effortless UX, Goal-first, Bullet-proof
- **Why:** A headless caller (a CI `sk_live_` key, an MCP host's `sk_mcp_` key)
  can't open a picker mid-run, and threading `model` through every call site is
  friction. A stored per-key default lets an operator pin one credential to
  `best` (the analytics job that wants frontier accuracy) and another to `fast`
  (the low-stakes scrape) without touching call sites — the same "one CI key,
  one intent" separation `SK-PREMIUM-001` protects, expressed as a default
  instead of a cap. Keeping the request `model` on top preserves the explicit
  per-call override; keeping it a preset (not a raw model id) upholds
  `SK-PREMIUM-014`'s rule that named model strings never enter the per-request
  wire — so `default_model`'s domain is exactly the preset domain, not the model
  catalog.
- **Consequence in code:** `api_keys.default_model` (migration
  `0032_api_key_default_model.sql`; distinct from the `0016` `model` column,
  which is the BYOLLM upstream model id). `apps/api/src/api-keys.ts` gains the
  pure `resolveEffectiveModelPreset(requestModel, keyDefaultModel)` (the one
  testable precedence), `getKeyDefaultModel` (read on the `/v1/ask` no-`model`
  path only — one indexed id lookup), `setKeyDefaultModel` (tenant-scoped,
  restricted to `sk_live` / `sk_mcp` rows), and a `defaultModel` field on
  `KeyRecord`. `/v1/ask` applies it once — when the request omitted `model` and
  the principal is `sk_live` / `sk_mcp`, it loads the key default and assigns
  `parsed.body.model`, so every downstream preset check inherits it. The write
  surface is `POST /v1/keys/:id/default-model` (session-only, same threat model
  as `POST`/`DELETE /v1/keys`; a distinct sub-path so the `/v1/keys/*` CORS
  allow-list — GET/POST/DELETE, no PATCH — covers it), idempotent by
  construction (re-applying the same value re-writes the same row), and accepts
  `Idempotency-Key` per `GLOBAL-005`.
  `default_model` never enters the plan-cache key (`GLOBAL-006` / `SK-PREMIUM-007`).
  The dashboard (`/app/keys`) renders an Auto / Fast / Best `<select>` per active
  `sk_*` key. **GLOBAL-003 gap (tracked):** the SDK / CLI / MCP set-default
  surfaces are not built this slice — the web talks to `PATCH /v1/keys/:id`
  directly; `nlq keys default-model` + `client.setKeyDefaultModel()` are parked.
- **Alternatives rejected:**
  - **Account-wide default model** — a single switch re-routes every key,
    exactly the failure `SK-PREMIUM-001` rejects (one experimental default turns
    a CI key into a paid call). Per-key is the unit.
  - **Store a named model id as the default** — reopens the
    model-strings-in-config hazard `SK-PREMIUM-003` / `SK-PREMIUM-014` close; the
    named door stays BYOLLM-key-scoped, so the default domain is the preset enum.
  - **Apply the default before the request `model` check** — inverts the ladder
    and makes the explicit per-call preset a no-op; the request always wins.
- **Source:** SK-PREMIUM-001 · SK-PREMIUM-003 · SK-PREMIUM-014 · SK-PREMIUM-018 ·
  GLOBAL-003 · GLOBAL-005 · GLOBAL-006
