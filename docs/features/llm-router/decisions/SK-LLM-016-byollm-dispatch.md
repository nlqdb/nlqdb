# SK-LLM-016 — BYOLLM dispatch lane: per-request override → account-stored → hosted-premium → free

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).
BYOLLM key-handling + tier policy lives in
[`premium-tier/decisions/SK-PREMIUM-008-byollm.md`](../../premium-tier/decisions/SK-PREMIUM-008-byollm.md).
The `model` preset extends this precedence (`fast` pins free ahead of all;
keyless `best` is terminal, never free) — canonical in
[`SK-PREMIUM-014`](../../premium-tier/decisions/SK-PREMIUM-014-model-preset-wire.md).

- **Decision:** The router gains a four-step dispatch precedence per
  [`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md):
  (1) per-request `x-nlq-byollm-key` header (signed-in only),
  (2) account-stored BYOLLM key (`api_keys.scope = "byollm"`),
  (3) hosted-premium router (paid + §6 flag — see `SK-LLM-017`),
  (4) free chain (`SK-LLM-003`).
  BYOLLM dispatch routes through Cloudflare AI Gateway with namespace
  `BYOLLM_<user_id>` so per-customer caches don't collide. Failures
  fail loud per
  [`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md)
  — never silently fall through.
- **Core value:** Free, Bullet-proof, Effortless UX
- **Why:** Free-tier users currently have no escape from the
  strict-$0 chain even when they have provider credits sitting idle.
  BYOLLM keeps heavy-eval-signal users inside the product and removes
  the "cap-cliff" UX problem on the free tier. Through-Gateway
  dispatch keeps `quality-eval`'s instrumentation (`SK-QUAL-004`)
  unified across all three lanes.
- **Consequence in code:** New `packages/llm/src/byollm-dispatch.ts`
  resolves the per-request key from headers + DB; reads encryption
  envelope from the `api-keys` mint path.
  Existing `chain.ts` covers step 4 unchanged. `LLMRouterOptions.dispatchLane`
  carries `"byollm" | "premium" | "free"` (selected by middleware
  before `router.invoke()`). OTel: `llm.dispatch_lane`,
  `llm.billed_to = "byollm"`, `llm.byollm_provider`; key value
  redacted.
- **Alternatives rejected:**
  - Paid-tier-only BYOLLM —
    [`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
    alternatives field.
  - Around-Gateway dispatch — loses unified telemetry.
  - Silent fallback on key failure —
    [`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md)
    dark pattern.
  - Per-DB instead of per-user keys — overgeneralizes; the user-bills-provider
    relationship is per-user.
