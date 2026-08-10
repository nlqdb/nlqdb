# EK-05 — Marketplace surface v0 (`experts` repo)

**Status:** **in-flight** — direct agent push to the private `experts` repo
is **confirmed working 2026-08-10** (this run pushed `claude/dazzling-clarke-fa6zmh`;
PR #1 already merged there earlier), so the parked-on-access condition is
lifted. Box 4's SK-EKP-003 boundary guard is the first slice pushed via direct
access (opened as experts#2, not yet merged). Boxes 1–3 (interview → listing, buy → grant, fee split) remain gated on
their own prereqs: box 1 on EK-04's public write-path, boxes 2–3 on EK-06's
live grant execution. · **Repo:** `experts` (private, all-rights-reserved) ·
**Risk:** high · **Runs:** multi · **Prereqs:** EK-01, EK-02, EK-04 + repo
access

## Goal

The private product surface (`SK-EKP-003`): everything a seller and a buyer
touch that isn't a public rail.

1. **Interview product** — the question-engine driving EK-04's rails:
   EK-01's design (question generation, follow-ups, card-edit/forced-choice
   verification — never yes/no read-back, per SK-EKP-007 stake 3,
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
- [~] Zero nlqdb-private imports; SDK/API only. *(Boundary guard authored
      2026-08-10 — `test/repo-boundary.test.ts` in `experts` (experts#2, open):
      a static-source check that flags any private nlqdb import (`@nlqdb/db`,
      `@nlqdb/llm`, a non-SDK scoped package, or a relative reach into
      `nlqdb/apps/**`). Allowlist is `@nlqdb/sdk` only; MCP is a wire surface,
      deny-by-default. It is a CI merge-gate only once the guard and the repo's
      workflow (experts#3, open) land together on `experts` main — until then
      enforcement is review-only. The invariant holds for all current experts
      product code (interview + CLI); the box closes fully once boxes 1–3 land
      under it.)*
