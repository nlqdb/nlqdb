// Bug B — the subscribe door must branch on the caller's OWN plan, not just the
// deployment-level `premium.live` flag, so a paying customer is never upsold a
// plan they already bought. `SubscribeBlock` is the pure/presentational slice of
// `ModelPicker`; rendering it statically exercises the 4-way branch without a DOM
// or the on-open billing fetch (which the parent owns).

import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { BillingStatus } from "../../lib/billing";
import { SubscribeBlock } from "./ModelPicker";

const noop = () => {};
const allowance = { hobby: 200, pro: 600 };

function billing(over: Partial<BillingStatus>): BillingStatus {
  return {
    plan: "free",
    status: "none",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    manageable: false,
    ...over,
  };
}

describe("SubscribeBlock — no upsell for a paying customer (Bug B)", () => {
  it("active Hobby plan: shows allowance + Manage billing, no upsell CTA", () => {
    const html = renderToStaticMarkup(
      <SubscribeBlock
        billing={billing({ plan: "hobby", status: "active", manageable: true })}
        premiumLive
        allowance={allowance}
        interest="idle"
        onCountMeIn={noop}
        onManageBilling={noop}
      />,
    );
    expect(html).toContain("Your Hobby plan includes 200 frontier requests/mo");
    expect(html).toContain("Manage billing");
    expect(html).not.toContain("See paid plans");
    expect(html).not.toContain("Count me in");
  });

  it("active Pro plan: shows the Pro allowance", () => {
    const html = renderToStaticMarkup(
      <SubscribeBlock
        billing={billing({ plan: "pro", status: "active" })}
        premiumLive
        allowance={allowance}
        interest="idle"
        onCountMeIn={noop}
        onManageBilling={noop}
      />,
    );
    expect(html).toContain("Your Pro plan includes 600 frontier requests/mo");
    expect(html).not.toContain("See paid plans");
  });

  it("paid but incomplete (webhook race): activating copy, no CTA", () => {
    const html = renderToStaticMarkup(
      <SubscribeBlock
        billing={billing({ plan: "pro", status: "incomplete" })}
        premiumLive
        allowance={allowance}
        interest="idle"
        onCountMeIn={noop}
        onManageBilling={noop}
      />,
    );
    expect(html).toContain("Payment received — your plan is activating.");
    expect(html).not.toContain("See paid plans");
    expect(html).not.toContain("Manage billing");
    expect(html).not.toContain("Count me in");
  });

  it("paid but past_due: payment-fix prompt, never the free upsell (Bug B)", () => {
    const html = renderToStaticMarkup(
      <SubscribeBlock
        billing={billing({ plan: "hobby", status: "past_due", manageable: true })}
        premiumLive
        allowance={allowance}
        interest="idle"
        onCountMeIn={noop}
        onManageBilling={noop}
      />,
    );
    expect(html).toContain("Update payment method");
    expect(html).not.toContain("See paid plans");
  });

  it("free user + meter live: real subscribe CTA to /pricing", () => {
    const html = renderToStaticMarkup(
      <SubscribeBlock
        billing={billing({ plan: "free" })}
        premiumLive
        allowance={allowance}
        interest="idle"
        onCountMeIn={noop}
        onManageBilling={noop}
      />,
    );
    expect(html).toContain("See paid plans");
    expect(html).toContain('href="/pricing/"');
    expect(html).not.toContain("Manage billing");
  });

  it("free user + meter dark: interest capture (Count me in)", () => {
    const html = renderToStaticMarkup(
      <SubscribeBlock
        billing={null}
        premiumLive={false}
        allowance={allowance}
        interest="idle"
        onCountMeIn={noop}
        onManageBilling={noop}
      />,
    );
    expect(html).toContain("Count me in");
    expect(html).not.toContain("See paid plans");
    expect(html).not.toContain("Manage billing");
  });
});
