// Typed shape for the bindings + secrets `apps/api` expects at runtime.
//
// `@cloudflare/workers-types` types `cloudflare:workers`'s top-level `env`
// import as the global `Cloudflare.Env` interface; we augment that
// interface here so `import { env } from "cloudflare:workers"` autocompletes
// our specific bindings and secrets.
//
// Cloudflare's "no I/O outside request context" rule still applies — we may
// reference bindings (e.g. `env.DB`) at module load, but methods that hit
// the network (`env.DB.prepare(...)`) must wait for a request.

declare global {
  namespace Cloudflare {
    interface Env {
      NODE_ENV?: string;

      DB: D1Database;
      KV: KVNamespace;

      // Product-event queue (drained by apps/events-worker). Optional
      // at type level so unit tests / `wrangler dev` without --remote
      // can run without the binding; the orchestrator falls back to
      // `makeNoopEmitter()` when undefined.
      EVENTS_QUEUE?: Queue;

      BETTER_AUTH_SECRET: string;

      // Dedicated HMAC secret for API-key hashing (SK-APIKEYS-014).
      // Optional: `apiKeyHmacSecret()` falls back to BETTER_AUTH_SECRET
      // when unset, so dev / test / un-migrated deploys keep working
      // unchanged. Set it (to the current BETTER_AUTH_SECRET value, for a
      // zero-rehash migration) to decouple key-hash HMAC from
      // session-signing HMAC — then either secret rotates independently.
      API_KEY_SECRET?: string;

      OAUTH_GITHUB_CLIENT_ID: string;
      OAUTH_GITHUB_CLIENT_SECRET: string;
      OAUTH_GITHUB_CLIENT_ID_DEV: string;
      OAUTH_GITHUB_CLIENT_SECRET_DEV: string;

      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;

      // LLM router (docs/architecture.md §7.1). Optional at type level — providers
      // whose key is missing at boot still construct, then fail their
      // first call with `not_configured` so the router can skip them.
      GROQ_API_KEY?: string;
      GEMINI_API_KEY?: string;
      CF_AI_TOKEN?: string;
      CLOUDFLARE_ACCOUNT_ID?: string;
      OPENROUTER_API_KEY?: string;
      // Cerebras — leads the planner-tier free chain (SK-LLM-023).
      CEREBRAS_API_KEY?: string;
      // Mistral — planner-tier capacity backstop at the chain tail (SK-LLM-028).
      MISTRAL_API_KEY?: string;
      // Cloudflare AI Gateway. When both are set every provider call
      // is proxied through the gateway for caching, retries, fallback,
      // and unified observability. Keys remain ours; gateway just proxies.
      AI_GATEWAY_ACCOUNT_ID?: string;
      AI_GATEWAY_ID?: string;

      // Default Neon database URL — used when a `databases` row's
      // `connection_secret_ref` resolves to the shared free-tier DB.
      DATABASE_URL?: string;

      GRAFANA_OTLP_ENDPOINT?: string;
      GRAFANA_OTLP_AUTHORIZATION?: string;

      // Stripe webhook signature verification (Slice 7). Required for
      // POST /v1/stripe/webhook — when absent, the route returns 503.
      STRIPE_WEBHOOK_SECRET?: string;
      // Stripe secret key for outbound API calls (Checkout Session creation).
      // When absent, POST /v1/billing/checkout returns 503.
      STRIPE_SECRET_KEY?: string;
      // Stripe price IDs for the subscription plans. Set via `wrangler secret put`.
      // Absent → POST /v1/billing/checkout returns 503 plan_not_configured.
      STRIPE_PRICE_HOBBY?: string;
      STRIPE_PRICE_PRO?: string;

      // KEK for the bring-your-own secret-at-rest envelope (`GLOBAL-031`,
      // `src/secret-envelope.ts`) — the single Workers-held key that seals
      // BYOLLM account keys and BYO Postgres/ClickHouse connection URLs.
      // High-entropy string (e.g. `openssl rand -base64 32`). Optional at
      // type level: when absent, BYO-secret storage routes return 503
      // (`kekFromEnv` → operator-config gap), so `wrangler dev` and tests
      // that don't touch BYO storage still run.
      BYO_SECRET_KEK?: string;

      // Cloudflare Turnstile secret for the anonymous-create burst
      // gate (SK-ANON-007). Optional at type level: when absent the
      // burst gate skips Turnstile verification (fail-open) so
      // `wrangler dev` without secrets configured still serves anon
      // creates. The per-IP create cap (5/hour) still applies.
      TURNSTILE_SECRET?: string;

      // R2 bucket for Stripe-event payload archives (and future blob
      // surfaces). Optional at type level so unit tests / wrangler dev
      // without --remote can run; the webhook handler skips archive
      // writes when undefined.
      ASSETS?: R2Bucket;

      // Workers Static Assets binding — the platform serves matching
      // files from `[assets] directory` before the fetch handler runs.
      // Declared here for completeness; user code rarely accesses it
      // directly (the platform handles asset serving implicitly).
      STATIC_ASSETS?: Fetcher;

      // Resend API key for transactional email (Slice 10 — magic-link
      // sign-in). Optional at type level: when unset, `makeEmailSender`
      // returns a console-logging stub so `wrangler dev` and tests
      // exercise the magic-link flow without a Resend account.
      RESEND_API_KEY?: string;
      // From-address override. Defaults to `nlqdb <hello@nlqdb.com>` in
      // src/auth.ts; override in .dev.vars when sending from Resend's
      // sandbox (`onboarding@resend.dev`) before the production
      // sender domain is verified.
      RESEND_FROM?: string;
      // Post-verify landing page for magic-link clicks. Defaults to
      // `https://app.nlqdb.com/app` in prod / `http://localhost:4321/app`
      // in dev. Override per environment if the chat surface moves.
      MAGIC_LINK_REDIRECT_URL?: string;
      // Web origin hosting `/auth/continue`, the prefetch-protected
      // intermediate page. Defaults to app.nlqdb.com in prod /
      // localhost:4321 in dev.
      MAGIC_LINK_WEB_ORIGIN?: string;

      // Better Auth `baseURL` override for non-prod hostnames
      // (`SK-AUTH-017`). Canary sets this to the canary worker's
      // `*.workers.dev` URL; prod leaves it unset and falls back to
      // `https://app.nlqdb.com`.
      BETTER_AUTH_URL?: string;
      // Extra entry for Better Auth `trustedOrigins`. Canary sets
      // this to its own origin so auth flows initiated from a future
      // separate canary surface (if any) clear the gate. Optional
      // because the single-origin canary worker is already covered by
      // `baseURL` auto-trust.
      CANARY_ORIGIN?: string;

      // Preview-only escape hatches (SK-AUTH-018). Both MUST remain
      // unset in production wrangler.toml — they bypass the external
      // OAuth / Resend / Stripe round-trips that prod relies on.
      //
      // MOCK_IDP=1: replaces the OAuth + Resend leg of sign-in with a
      // one-click form (`GET /auth/sign-in`) that mints a real Better
      // Auth session via the magic-link plugin. Implies email sinking
      // — the magic-link `sendMagicLink` callback writes to KV instead
      // of calling Resend; `GET /api/dev/inbox` reads them back.
      //
      // MOCK_STRIPE=1: bypasses Stripe webhook signature verification
      // so synthetic events can be POSTed against /v1/stripe/webhook
      // without configuring STRIPE_WEBHOOK_SECRET. The dispatcher,
      // idempotency insert, and downstream emit all run real.
      //
      // GATE_OPEN=1: bypasses the GLOBAL-027 pre-alpha gate entirely
      // so the E2E staging environment can exercise the full create→
      // write→delete flow without waiting for eval thresholds to clear.
      // MUST remain unset in production — injected via `--var` in the
      // E2E staging workflow only.
      MOCK_IDP?: string;
      MOCK_STRIPE?: string;
      GATE_OPEN?: string;

      // Tinybird credentials for the W5 workload analyser (`SK-MIGRATE-001`).
      // The cron reads `query_log` via the Tinybird adapter and
      // creates Pipes via the management API. When unset, the
      // `scheduled()` handler ack-and-skips per `SK-EVENTS-005`'s
      // unconfigured-sink posture. Mirrors the binding in
      // `apps/events-worker/src/env.d.ts` so a workspace's read +
      // write paths share credentials.
      TINYBIRD_TOKEN?: string;
      TINYBIRD_API_BASE?: string;

      // Shared secret for the quality-eval run's POST /v1/events/eval
      // (SK-QUAL-002). Set via `wrangler secret put EVAL_INGEST_TOKEN`
      // and stored as a GitHub Actions secret of the same name. When
      // unset the route returns 503 — matches the unconfigured-sink
      // posture used by Tinybird / Stripe webhooks.
      EVAL_INGEST_TOKEN?: string;

      // LogSnag credentials for product-event notifications. Used by
      // the ICP pain-signal scraper (`0 6 * * 1` cron) and may be
      // shared with apps/events-worker for other channels. When unset,
      // the scraper skips the LogSnag notification (non-fatal).
      LOGSNAG_TOKEN?: string;
      LOGSNAG_PROJECT?: string;

      // GitHub Personal Access Token. Used by SK-ICP-004 (scrape GitHub Issues) and SK-ICP-003 (write evidence file). When unset, both are skipped.
      GH_TOKEN?: string;

      // Reddit app-only OAuth (SK-ICP-011). Confidential-client credentials for
      // the `client_credentials` grant. When either is unset the ICP scraper
      // skips Reddit entirely (the anonymous endpoint is blocked for bots).
      REDDIT_CLIENT_ID?: string;
      REDDIT_CLIENT_SECRET?: string;
    }
  }
}

export {};
