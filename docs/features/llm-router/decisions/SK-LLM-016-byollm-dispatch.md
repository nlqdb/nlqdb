# SK-LLM-016 — BYOLLM dispatch lane: per-request override → account-stored → hosted-premium → free

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).
BYOLLM key-handling + tier policy lives in
[`premium-tier/decisions/SK-PREMIUM-008-byollm.md`](../../premium-tier/decisions/SK-PREMIUM-008-byollm.md).

- **Decision:** The router gains a four-step dispatch precedence per
  [`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md):
  (1) per-request `x-nlq-byollm-key` header (signed-in only),
  (2) account-stored BYOLLM key (`byollm_keys` table),
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
- **Consequence in code:** `apps/api/src/byollm-keys.ts` handles
  encryption/decryption; dispatch wired inline in `/v1/ask` and
  `/v1/chat/messages` in `apps/api/src/index.ts`.
  `createByollmRouter(provider)` in `packages/llm/src/router.ts` wraps
  a single provider fail-loud (no fallback chain).
  OTel on the ask/chat span: `nlqdb.ask.byollm_provider`,
  `nlqdb.ask.byollm_source` (`"header"` | `"stored"` | `"fallthrough_d1_error"`);
  key value is never an attribute.
  Open: per-user AI Gateway namespace (`BYOLLM_<user_id>`) not yet wired —
  all BYOLLM calls share the default gateway namespace.
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
