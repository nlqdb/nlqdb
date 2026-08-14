// Idempotent Stripe bootstrap for the hosted-premium meter (SK-PREMIUM-002 /
// #8). Creates the Products/Prices and the Billing Meter the lane needs, in
// **test mode only** — checked in so the objects are reproducible instead of
// hand-clicked in the Dashboard. Re-running is safe: everything is found-or-
// created by a stable `lookup_key` (prices) or `event_name` (meter).
//
// Run:  STRIPE_SECRET_KEY=sk_test_... bun run apps/api/scripts/stripe-premium-bootstrap.ts
//
// It refuses a live key on purpose — going live (live products/prices, the
// meter, flipping PREMIUM_METER_LIVE) is the operator step in blocked-by-human.
// After a run, set the printed ids as Worker secrets:
//   STRIPE_PRICE_HOBBY, STRIPE_PRICE_PRO,
//   STRIPE_PRICE_OVERAGE_ANTHROPIC, STRIPE_PREMIUM_METER_ID.

import Stripe from "stripe";

const OVERAGE_EVENT_NAME = "nlqdb.premium_llm.overage.anthropic.claude-sonnet-4-6";
const HOBBY_LOOKUP = "nlqdb_hobby_monthly";
const PRO_LOOKUP = "nlqdb_pro_monthly";
const OVERAGE_LOOKUP = "nlqdb_premium_overage_anthropic_sonnet_4_6";

// Tier prices: $10 / $25 per month (confirmed — no premium surcharge; the
// included allowance rides the base plan). Overage bills at 1 unit = $0.01 so
// a meter value in USD cents invoices at exact provider list, +0% markup.
const HOBBY_CENTS = 1000;
const PRO_CENTS = 2500;

async function findPriceByLookup(stripe: Stripe, lookupKey: string): Promise<Stripe.Price | null> {
  const res = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return res.data[0] ?? null;
}

async function ensureFlatPrice(
  stripe: Stripe,
  args: { lookupKey: string; productName: string; unitAmount: number },
): Promise<Stripe.Price> {
  const existing = await findPriceByLookup(stripe, args.lookupKey);
  if (existing) {
    console.info(`✓ price ${args.lookupKey} already exists: ${existing.id}`);
    return existing;
  }
  const price = await stripe.prices.create({
    lookup_key: args.lookupKey,
    currency: "usd",
    unit_amount: args.unitAmount,
    recurring: { interval: "month" },
    product_data: { name: args.productName },
  });
  console.info(`+ created price ${args.lookupKey}: ${price.id}`);
  return price;
}

async function ensureMeter(stripe: Stripe): Promise<Stripe.Billing.Meter> {
  const meters = await stripe.billing.meters.list({ status: "active", limit: 100 });
  const found = meters.data.find((m) => m.event_name === OVERAGE_EVENT_NAME);
  if (found) {
    console.info(`✓ meter ${OVERAGE_EVENT_NAME} already exists: ${found.id}`);
    return found;
  }
  const meter = await stripe.billing.meters.create({
    display_name: "Premium LLM overage (Anthropic Sonnet 4.6)",
    event_name: OVERAGE_EVENT_NAME,
    default_aggregation: { formula: "sum" },
    customer_mapping: { type: "by_id", event_payload_key: "stripe_customer_id" },
    value_settings: { event_payload_key: "value" },
  });
  console.info(`+ created meter ${OVERAGE_EVENT_NAME}: ${meter.id}`);
  return meter;
}

async function ensureOveragePrice(stripe: Stripe, meterId: string): Promise<Stripe.Price> {
  const existing = await findPriceByLookup(stripe, OVERAGE_LOOKUP);
  if (existing) {
    console.info(`✓ price ${OVERAGE_LOOKUP} already exists: ${existing.id}`);
    return existing;
  }
  const price = await stripe.prices.create({
    lookup_key: OVERAGE_LOOKUP,
    currency: "usd",
    unit_amount: 1, // $0.01 per unit; meter value is USD cents ⇒ exact pass-through.
    recurring: { interval: "month", usage_type: "metered", meter: meterId },
    product_data: { name: "Premium LLM overage — Anthropic Sonnet 4.6" },
  });
  console.info(`+ created overage price ${OVERAGE_LOOKUP}: ${price.id}`);
  return price;
}

async function main(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required");
  if (!key.startsWith("sk_test_")) {
    throw new Error("Refusing to run against a non-test key — this bootstrap is test-mode only.");
  }
  const stripe = new Stripe(key);

  const hobby = await ensureFlatPrice(stripe, {
    lookupKey: HOBBY_LOOKUP,
    productName: "nlqdb Hobby",
    unitAmount: HOBBY_CENTS,
  });
  const pro = await ensureFlatPrice(stripe, {
    lookupKey: PRO_LOOKUP,
    productName: "nlqdb Pro",
    unitAmount: PRO_CENTS,
  });
  const meter = await ensureMeter(stripe);
  const overage = await ensureOveragePrice(stripe, meter.id);

  console.info("\nSet these Worker secrets:");
  console.info(`  STRIPE_PRICE_HOBBY=${hobby.id}`);
  console.info(`  STRIPE_PRICE_PRO=${pro.id}`);
  console.info(`  STRIPE_PRICE_OVERAGE_ANTHROPIC=${overage.id}`);
  console.info(`  STRIPE_PREMIUM_METER_ID=${meter.id}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
