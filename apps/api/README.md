# apps/api — Cloudflare Workers API plane

Phase 0 §3. Houses `POST /v1/ask` (DESIGN §4.1), auth endpoints
(`/v1/auth/{device, device/token, refresh, logout}`, DESIGN §4.3), and
key-management endpoints (DESIGN §4.5).

## Slice 1 (current)

`GET /v1/health` returning `{status, version, timestamp}`. No
external bindings yet (KV / D1 / R2 / Neon arrive in later slices).
Tests run under `@cloudflare/vitest-pool-workers` — uses Miniflare,
no live CF account needed for CI.

## Local dev

```bash
bun --cwd apps/api run dev        # wrangler dev — http://localhost:8787
bun --cwd apps/api run test       # vitest (Miniflare under the hood)
bun --cwd apps/api run typecheck
bun --cwd apps/api run build      # wrangler deploy --dry-run
```

## Deploy

```bash
bun --cwd apps/api run deploy     # uses CLOUDFLARE_API_TOKEN + _ACCOUNT_ID
```

## Coming up

- Slice 2: KV + D1 + R2 bindings + provisioning script.
- Slice 3: Neon adapter (`packages/db`).
- Slice 4: LLM router (`packages/llm`).
- Slice 5: Better Auth scaffold + `/auth/callback/github` route.
- Slice 6: `/v1/ask` end-to-end.
- Slice 7: Workers-secret mirror + Stripe webhook.
