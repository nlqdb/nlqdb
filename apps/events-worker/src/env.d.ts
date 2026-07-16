// Typed env for `apps/events-worker`. Mirrors apps/api/src/env.d.ts —
// Cloudflare's `Cloudflare.Env` interface is augmented globally so the
// `cloudflare:workers` `env` import autocompletes our specific bindings.

declare global {
  namespace Cloudflare {
    interface Env {
      NODE_ENV?: string;

      // LogSnag (docs/architecture.md §15.6). Both must be set for the LogSnag sink
      // to publish; a missing token short-circuits to a logged-warning
      // (the consumer still acks so the message doesn't retry forever
      // on configuration drift).
      LOGSNAG_TOKEN?: string;
      LOGSNAG_PROJECT?: string;

      // Tinybird (W4 query_log sink). Token must be set for `ask.completed`
      // events to land in the Data Source; missing config ack-and-drops
      // per `SK-EVENTS-005`. Token scope: DATASOURCE:APPEND on `query_log`.
      // Tinybird auths by token alone — the workspace is implicit in the
      // token's scope and never appears in the URL or headers.
      TINYBIRD_TOKEN?: string;
      // Optional override for the Tinybird API base. Defaults to
      // `https://api.tinybird.co` (EU gateway); US workspaces set
      // `https://api.us-east.tinybird.co`.
      TINYBIRD_API_BASE?: string;

      // PostHog Cloud (SK-EVENTS-013). Both must be set for the PostHog
      // sink to fan out `EventEnvelope`s; a missing key or host short-
      // circuits to a silent return per `SK-EVENTS-005` (dev / pre-mirror
      // ack-and-drop). `POSTHOG_API_KEY` is the publishable `phc_` project
      // key; `POSTHOG_HOST` is the ingestion origin (`https://eu.i.posthog.com`
      // for the EU region). Server-side fan-out only — no SDK in the bundle.
      POSTHOG_API_KEY?: string;
      POSTHOG_HOST?: string;

      GRAFANA_OTLP_ENDPOINT?: string;
      GRAFANA_OTLP_AUTHORIZATION?: string;

      // Resend (SK-STRIPE-013 customer dunning email). When unset the
      // dunning-email sink no-ops — same dev/unconfigured posture as the
      // LogSnag + Tinybird sinks above. `RESEND_FROM` is optional and
      // falls back to the shared verified sender (`DEFAULT_FROM` from
      // `@nlqdb/email`).
      RESEND_API_KEY?: string;
      RESEND_FROM?: string;
    }
  }
}

export {};
