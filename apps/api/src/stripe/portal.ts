// Stripe Billing Portal session creation. Pure function — all deps passed in.
// Route handler at `POST /v1/billing/portal` in index.ts (SK-STRIPE-008).
//
// The portal is Stripe-hosted: cancel, update card, switch plan, download
// invoices. We never build those surfaces ourselves. On success returns
// { url } for a client-side redirect to the short-lived portal session.
//
// The route is responsible for looking up the caller's `stripe_customer_id`
// from the `customers` D1 table and passing it in; a caller with no Stripe
// customer (never checked out) is rejected at the route with 404 before we
// reach Stripe. Failure semantics here: Stripe API error → 500 internal
// (logged, span records exception).

import { SpanStatusCode, trace } from "@opentelemetry/api";
import type Stripe from "stripe";
import { newStripeClient } from "./client.ts";

export type PortalDeps = {
  stripeSecretKey: string;
  stripeCustomerId: string;
  userId: string;
  idempotencyKey?: string | null;
};

export type PortalResult =
  | { status: 200; body: { url: string } }
  | { status: 500; body: { error: "internal" } };

export async function createPortalSession(
  deps: PortalDeps,
  returnUrl: string,
): Promise<PortalResult> {
  const tracer = trace.getTracer("@nlqdb/api");

  return tracer.startActiveSpan("nlqdb.billing.portal.create", async (span) => {
    span.setAttribute("nlqdb.user.id", deps.userId);
    try {
      const stripeClient = newStripeClient(deps.stripeSecretKey);

      const params: Stripe.BillingPortal.SessionCreateParams = {
        customer: deps.stripeCustomerId,
        return_url: returnUrl,
      };

      const requestOptions: Stripe.RequestOptions = {};
      if (deps.idempotencyKey) {
        requestOptions.idempotencyKey = deps.idempotencyKey;
      }

      const session = await stripeClient.billingPortal.sessions.create(params, requestOptions);

      span.setAttribute("nlqdb.billing.portal_session_id", session.id);
      return { status: 200 as const, body: { url: session.url } };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      console.error(
        JSON.stringify({
          level: "error",
          msg: "portal_create_failed",
          user_id: deps.userId,
          error: error.message,
        }),
      );
      return { status: 500 as const, body: { error: "internal" as const } };
    } finally {
      span.end();
    }
  });
}
