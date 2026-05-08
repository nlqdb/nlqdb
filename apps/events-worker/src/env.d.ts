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

      // Tinybird (W4 query_log sink). Both must be set for `ask.completed`
      // events to land in the Data Source; missing config ack-and-drops
      // per `SK-EVENTS-005`. Token scope: DATASOURCE:APPEND on `query_log`.
      TINYBIRD_TOKEN?: string;
      TINYBIRD_WORKSPACE?: string;
      // Optional override for the Tinybird API base. Defaults to
      // `https://api.tinybird.co` (EU gateway); US workspaces set
      // `https://api.us-east.tinybird.co`.
      TINYBIRD_API_BASE?: string;

      GRAFANA_OTLP_ENDPOINT?: string;
      GRAFANA_OTLP_AUTHORIZATION?: string;
    }
  }
}

export {};
