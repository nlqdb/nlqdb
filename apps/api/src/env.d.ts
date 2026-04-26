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

      OAUTH_GITHUB_CLIENT_ID: string;
      OAUTH_GITHUB_CLIENT_SECRET: string;
      OAUTH_GITHUB_CLIENT_ID_DEV: string;
      OAUTH_GITHUB_CLIENT_SECRET_DEV: string;

      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;

      // LLM router (DESIGN §8.1). Optional at type level — providers
      // whose key is missing at boot still construct, then fail their
      // first call with `not_configured` so the router can skip them.
      GROQ_API_KEY?: string;
      GEMINI_API_KEY?: string;
      CF_AI_TOKEN?: string;
      CLOUDFLARE_ACCOUNT_ID?: string;
      OPENROUTER_API_KEY?: string;

      // Default Neon database URL — used when a `databases` row's
      // `connection_secret_ref` resolves to the shared free-tier DB.
      DATABASE_URL?: string;

      GRAFANA_OTLP_ENDPOINT?: string;
      GRAFANA_OTLP_AUTHORIZATION?: string;

      // Stripe webhook signature verification (Slice 7). Required for
      // POST /v1/stripe/webhook — when absent, the route returns 503.
      STRIPE_WEBHOOK_SECRET?: string;

      // R2 bucket for Stripe-event payload archives (and future blob
      // surfaces). Optional at type level so unit tests / wrangler dev
      // without --remote can run; the webhook handler skips archive
      // writes when undefined.
      ASSETS?: R2Bucket;
    }
  }
}

export {};
