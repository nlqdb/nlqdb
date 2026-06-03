// Stripe Checkout Session creation. Pure function — all deps passed in.
// Route handler at `POST /v1/billing/checkout` in index.ts.
//
// On success returns { url } for client-side redirect to Stripe-hosted
// checkout. The webhook at POST /v1/stripe/webhook closes the loop:
// checkout.session.completed → customers row, subscription.created →
// billing.subscription_created event (SK-STRIPE-004/005).
//
// Failure semantics:
//   - plan price ID missing from env → 503 plan_not_configured
//   - Stripe API error → 500 internal (logged, span records exception)

import { SpanStatusCode, trace } from "@opentelemetry/api";
import type Stripe from "stripe";
import { newStripeClient } from "./client.ts";

export type CheckoutPlan = "hobby" | "pro";

export type CheckoutDeps = {
  stripeSecretKey: string;
  priceIdHobby: string;
  priceIdPro: string;
  userId: string;
  userEmail?: string | null;
  idempotencyKey?: string | null;
};

export type CheckoutResult =
  | { status: 200; body: { url: string } }
  | { status: 503; body: { error: "plan_not_configured" } }
  | { status: 500; body: { error: "internal" } };

export async function createCheckoutSession(
  deps: CheckoutDeps,
  plan: CheckoutPlan,
  successUrl: string,
  cancelUrl: string,
): Promise<CheckoutResult> {
  const tracer = trace.getTracer("@nlqdb/api");

  return tracer.startActiveSpan("nlqdb.billing.checkout.create", async (span) => {
    span.setAttribute("nlqdb.billing.plan", plan);
    span.setAttribute("nlqdb.user.id", deps.userId);
    try {
      const priceId = plan === "hobby" ? deps.priceIdHobby : deps.priceIdPro;
      if (!priceId) {
        span.setAttribute("nlqdb.billing.plan_not_configured", true);
        return { status: 503 as const, body: { error: "plan_not_configured" as const } };
      }

      const stripeClient = newStripeClient(deps.stripeSecretKey);

      const params: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        client_reference_id: deps.userId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        automatic_tax: { enabled: true },
        ...(deps.userEmail ? { customer_email: deps.userEmail } : {}),
      };

      const requestOptions: Stripe.RequestOptions = {};
      if (deps.idempotencyKey) {
        requestOptions.idempotencyKey = deps.idempotencyKey;
      }

      const session = await stripeClient.checkout.sessions.create(params, requestOptions);

      if (!session.url) {
        // mode=subscription always returns a URL; guard defensively.
        throw new Error("checkout session missing URL");
      }

      span.setAttribute("nlqdb.billing.checkout_session_id", session.id);
      return { status: 200 as const, body: { url: session.url } };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      console.error(
        JSON.stringify({
          level: "error",
          msg: "checkout_create_failed",
          user_id: deps.userId,
          plan,
          error: error.message,
        }),
      );
      return { status: 500 as const, body: { error: "internal" as const } };
    } finally {
      span.end();
    }
  });
}
