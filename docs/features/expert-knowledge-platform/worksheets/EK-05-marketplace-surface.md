# EK-05 — Marketplace surface v0 (`experts` repo)

**Status:** **parked** — until agent sessions can reach the private
`experts` repo (created by the founder 2026-08-05; workspace access is a
founder/admin action) · **Repo:** `experts` (private, all-rights-reserved) ·
**Risk:** high · **Runs:** multi · **Prereqs:** EK-01, EK-02, EK-04 + repo
access

## Goal

The private product surface (`SK-EKP-003`): everything a seller and a buyer
touch that isn't a public rail.

1. **Interview product** — the question-engine driving EK-04's rails:
   EK-01's design (question generation, follow-ups, read-back verification,
   session structure) as the expert-facing authoring UX.
2. **Listings — one catalog, two types (`SK-EKP-006`)** — (a) free
   first-party **packs** (the locked pack-candidates order; install = the
   runner journey on the buyer's own tenant, no grant, no fee) and (b)
   paid **knowledge DBs** — an expert publishes title, profession, what's
   queryable (golden-query samples as the honest demo), price model per
   EK-02's metering design. The catalog never launches empty: the pack
   order is its initial supply.
3. **Buy flow** — a buyer (human on behalf of their agents) purchases
   query access → EK-06 grant minted; revocation surfaced to both sides.
4. **Fee wiring** — Stripe Connect-style split per `SK-EKP-002`: fee
   plainly disclosed to the seller **before listing**, percentage read from
   config — **symbolic until the founder sets it; no number in code or
   copy**. Payouts boring and real (the research's Poe lesson, never the
   GPT-Store lesson).

Consumes nlqdb exclusively through the public SDK/API (`SK-EKP-003`);
anything it's missing becomes a public-rail gap tracked in the FEATURE.md,
never a private fork of a rail.

## Done when (v0)

- [ ] An expert completes interview → listing with the fee disclosed
      pre-commit.
- [ ] A buyer purchases → grant works → revocation stops queries.
- [ ] Fee split executes end-to-end in Stripe test mode with a symbolic %.
- [ ] Zero nlqdb-private imports; SDK/API only.
