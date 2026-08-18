// Stripe Billing Portal *plan-switch* deep link (SK-STRIPE-015). Pure Stripe
// orchestration — the route owns the D1 lookups and passes ids in.
//
// The bug this fixes: a subscriber clicking "Upgrade to Pro" / "Switch plan"
// was sent to a plain portal session, which — because Stripe's default portal
// configuration has plan switching OFF — lands on the account overview showing
// only the current plan, with no way to change it. Tier changes must go through
// the portal (SK-STRIPE-010, so Stripe prorates), so the portal has to actually
// offer the switch.
//
// Two moves:
//   1. Self-heal the configuration. We ensure a portal configuration with
//      `subscription_update` enabled and BOTH plan prices listed as products,
//      so switching works without a manual Stripe Dashboard toggle. Reused
//      across requests (idempotent list-or-create, tagged by metadata + cached
//      per isolate) so it's created at most once.
//   2. Deep-link to the update flow via `flow_data.type = "subscription_update"`,
//      which drops the customer straight on the plan-selection page (Hobby/Pro
//      with prices + proration) and hides the rest of the portal chrome.
//
// We use the interactive `subscription_update` flow, not
// `subscription_update_confirm` (which needs a hard-coded target price and
// rejects multi-item subscriptions). NOTE Stripe's portal can only *update* a
// single-product, non-usage-based subscription: once a Pro subscriber hits
// overage, `ensureOverageItem` (SK-PREMIUM-002) attaches a metered item and the
// portal will then only *cancel* that subscription. So this deep link serves
// the common single-item switch; the overage-Pro downgrade needs a server-side
// subscriptions.update (API, not portal) — a known gap tracked in the
// stripe-billing feature (SK-STRIPE-015).

import { SpanStatusCode, trace } from "@opentelemetry/api";
import type Stripe from "stripe";
import { newStripeClient } from "./client.ts";

export type PlanSwitchDeps = {
  stripeSecretKey: string;
  stripeCustomerId: string;
  subscriptionId: string;
  // Both plan prices — the ensured configuration lists both products as valid
  // update targets (Stripe validates the target price is configured).
  priceIdHobby: string;
  priceIdPro: string;
  userId: string;
  idempotencyKey?: string | null;
};

export type PlanSwitchResult =
  | { status: 200; body: { url: string } }
  | { status: 500; body: { error: "internal" } };

// Marks the portal configuration we manage, so the idempotent list-or-create
// finds it again instead of minting a new one on every deploy.
const MANAGED_TAG = "plan-switch";

// Per-isolate cache of the ensured configuration id. Workers reuse an isolate
// across requests, so the list/create round-trip runs at most once per isolate.
// Cleared on any Stripe error below so a deleted config self-heals next call.
let cachedConfigId: string | null = null;

// Idempotent "make sure a plan-switch-capable portal configuration exists".
// Returns its id. Lists our tagged configs first (survives isolate recycling
// and redeploys); creates one only when none is found.
async function ensurePlanSwitchConfig(
  stripe: Stripe,
  priceIdHobby: string,
  priceIdPro: string,
): Promise<string> {
  if (cachedConfigId) return cachedConfigId;

  const existing = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const found = existing.data.find((c) => c.metadata?.["nlqdb_managed"] === MANAGED_TAG);
  if (found) {
    cachedConfigId = found.id;
    return found.id;
  }

  // The configuration's `products` needs product ids; prices carry them.
  const [hobbyPrice, proPrice] = await Promise.all([
    stripe.prices.retrieve(priceIdHobby),
    stripe.prices.retrieve(priceIdPro),
  ]);
  const productId = (price: Stripe.Price): string =>
    typeof price.product === "string" ? price.product : price.product.id;

  const created = await stripe.billingPortal.configurations.create({
    metadata: { nlqdb_managed: MANAGED_TAG },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      // Address is needed so the update flow can settle automatic tax on the
      // proration (checkout enables automatic_tax — SK-STRIPE-014).
      customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
      subscription_cancel: { enabled: true, mode: "at_period_end", proration_behavior: "none" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: [
          { product: productId(hobbyPrice), prices: [priceIdHobby] },
          { product: productId(proPrice), prices: [priceIdPro] },
        ],
      },
    },
  });
  cachedConfigId = created.id;
  return created.id;
}

// Create a portal session deep-linked to the plan-switch flow. `returnUrl` is
// both the "back to site" link and the post-completion redirect target.
export async function createPlanSwitchSession(
  deps: PlanSwitchDeps,
  returnUrl: string,
): Promise<PlanSwitchResult> {
  const tracer = trace.getTracer("@nlqdb/api");

  return tracer.startActiveSpan("nlqdb.billing.plan_switch.create", async (span) => {
    span.setAttribute("nlqdb.user.id", deps.userId);
    try {
      const stripeClient = newStripeClient(deps.stripeSecretKey);
      const configuration = await ensurePlanSwitchConfig(
        stripeClient,
        deps.priceIdHobby,
        deps.priceIdPro,
      );

      const params: Stripe.BillingPortal.SessionCreateParams = {
        customer: deps.stripeCustomerId,
        configuration,
        return_url: returnUrl,
        flow_data: {
          type: "subscription_update",
          subscription_update: { subscription: deps.subscriptionId },
          after_completion: { type: "redirect", redirect: { return_url: returnUrl } },
        },
      };

      const requestOptions: Stripe.RequestOptions = {};
      if (deps.idempotencyKey) {
        requestOptions.idempotencyKey = deps.idempotencyKey;
      }

      const session = await stripeClient.billingPortal.sessions.create(params, requestOptions);

      span.setAttribute("nlqdb.billing.portal_session_id", session.id);
      span.setAttribute("nlqdb.billing.portal_configuration_id", configuration);
      return { status: 200 as const, body: { url: session.url } };
    } catch (err) {
      // Drop the cached config id: a deleted/invalid configuration is the one
      // failure this recovers from — the next call re-ensures.
      cachedConfigId = null;
      const error = err instanceof Error ? err : new Error(String(err));
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      console.error(
        JSON.stringify({
          level: "error",
          msg: "plan_switch_create_failed",
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
