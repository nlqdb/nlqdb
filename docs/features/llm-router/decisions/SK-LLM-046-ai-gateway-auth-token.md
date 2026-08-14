# SK-LLM-046 — AI Gateway auth token (`cf-aig-authorization`) on every gateway-routed lane

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Operationalises the
gateway transport of [`SK-LLM-004`](./SK-LLM-004-ai-gateway-paid.md) (free +
paid) and [`SK-LLM-019`](./SK-LLM-019-byollm-provider-factory.md) (BYOLLM /
premium) for the case where the Cloudflare AI Gateway has **Authenticated
Gateway** turned on.

- **Decision:** Every gateway-routed provider — the free chain
  (`groq`/`gemini`/`workers-ai`/`openrouter` in `apps/api/src/llm-router.ts`),
  the BYOLLM lane, and the hosted-premium lane — sends
  `cf-aig-authorization: Bearer <AI_GATEWAY_TOKEN>` when the Worker secret
  `AI_GATEWAY_TOKEN` is set. When it is unset the header is omitted (direct
  routing, or an unauthenticated gateway) and behaviour is byte-for-byte
  unchanged. The token rides *alongside* the upstream provider auth
  (`authorization` / `x-goog-api-key`), never replacing it — the header helper
  `gatewayAuthHeader()` (`packages/llm/src/providers/_shared.ts`) is the single
  place the header is built.
- **Core value:** Bullet-proof, Free
- **Why:** When "Authenticated Gateway" is enabled, Cloudflare rejects any
  gateway request lacking `cf-aig-authorization` with `AiGatewayError 2009
  Unauthorized`. The free `route` chain and the single-provider premium lane
  have **no direct-provider backstop**, so an un-authenticated gateway 401s the
  whole chain and surfaces as `llm_failed` (502) on *every* `/v1/ask` —
  a full production outage from a dashboard toggle, with no deploy. Enabling
  the gateway's auth is the right posture (it stops a leaked account/gateway id
  from letting a third party burn our provider keys, and protects the premium
  Anthropic key), so the fix is to give the Worker a token to send, not to
  leave the gateway open.
- **Consequence in code:** provider factories accept an optional
  `gatewayToken`; `_shared.ts#gatewayAuthHeader` returns `{}` or the one
  header; `llm-router.ts` threads `env.AI_GATEWAY_TOKEN` into the four
  gateway providers; `index.ts` passes it to `buildPremiumRouter`; the ask
  handler passes it through `resolveAskRouter`'s `gateway.token` into
  `buildByollmRouter`. Mirrored by both secret scripts
  (`scripts/mirror-secrets-{workers,gha}.sh`) and documented in the runbook
  secret table.
- **Alternatives rejected:** Leave the gateway unauthenticated — re-opens the
  abuse vector the toggle exists to close, and leaves the premium key reachable
  by anyone who learns the gateway id. Direct-route the free chain to dodge the
  gateway — throws away the SK-LLM-004 caching / quota / observability the
  gateway provides. Make the token mandatory — breaks local / preview / eval
  environments that use an unauthenticated (or absent) gateway; the header is
  correctly conditional on the secret being present.
