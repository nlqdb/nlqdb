// Stripe SDK helpers for the Workers runtime.
//
// `createFetchHttpClient` + `createSubtleCryptoProvider` route the SDK
// through Web Crypto + native fetch (Node http isn't available on Workers
// even with nodejs_compat). The crypto provider is passed per-call to
// `constructEventAsync`; the http client is set on the constructor.
//
// The API version is the SDK's compiled-in default — never hard-coded
// here; bumping the SDK is the supported way to advance (SK-STRIPE-007).
//
// `newStripeClient(secretKey)` creates a fresh instance per request for
// outbound API calls (Checkout creation, etc.). Webhook verification uses
// the `webhooks` property from any instance — only the signature, not the
// key, matters there, so the key value is irrelevant for that path.

import Stripe from "stripe";

export function newStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// Singleton used by the webhook route solely for `stripe.webhooks.constructEventAsync`.
// The key is irrelevant for signature verification, which depends only on
// STRIPE_WEBHOOK_SECRET passed per-request.
export const stripe = newStripeClient("sk_placeholder_webhook_only");

export const cryptoProvider = Stripe.createSubtleCryptoProvider();
