// Stripe SDK singleton for the Workers runtime.
//
// Slice 7 only consumes Stripe webhooks (no outbound API calls), so
// the API key is a placeholder. When the Phase 1 Checkout slice lands,
// swap to `env.STRIPE_SECRET_KEY` from `cloudflare:workers`.
//
// `createFetchHttpClient` + `createSubtleCryptoProvider` route the SDK
// through Web Crypto + native fetch, which is what Workers can run
// (the default Node http module isn't available even with
// `nodejs_compat`). The crypto provider is passed per-call to
// `constructEventAsync`; the http client is set on the constructor.

import Stripe from "stripe";

export const stripe = new Stripe("sk_placeholder_webhook_only", {
  httpClient: Stripe.createFetchHttpClient(),
});

export const cryptoProvider = Stripe.createSubtleCryptoProvider();
