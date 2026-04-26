// Typed env for `apps/events-worker`. Mirrors apps/api/src/env.d.ts —
// Cloudflare's `Cloudflare.Env` interface is augmented globally so the
// `cloudflare:workers` `env` import autocompletes our specific bindings.

declare global {
  namespace Cloudflare {
    interface Env {
      NODE_ENV?: string;

      // LogSnag (DESIGN §15.6). Both must be set for the LogSnag sink
      // to publish; a missing token short-circuits to a logged-warning
      // (the consumer still acks so the message doesn't retry forever
      // on configuration drift).
      LOGSNAG_TOKEN?: string;
      LOGSNAG_PROJECT?: string;

      GRAFANA_OTLP_ENDPOINT?: string;
      GRAFANA_OTLP_AUTHORIZATION?: string;
    }
  }
}

export {};
