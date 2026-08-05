# EK-03 — Trust surface: landing, copy, ToS/DPA delta

**Status:** planned · **Repo:** nlqdb · **Risk:** low · **Runs:** 1–2 ·
**Prereqs:** none (fully constrained by `SK-EKP-001`)

## Goal

Ship the platform's public trust surface: a landing section/page for the
"Become AI" positioning and the contractual substance behind the claim.

1. **Landing** — the positioning message ("AI can't replace you if you
   become AI") with the trust pillar loud and the mechanism honest: your
   expertise becomes structured rows only your agents can query. Entry
   point routes to the pilot journey (EK-04/05) once it exists; before
   that, a waitlist-free "see how it works" walk of the language-tutor
   demo is acceptable — no dead CTA, no fake door.
2. **Copy** — the `SK-EKP-001` posture verbatim in substance: *not
   allowed* (ToS/DPA prohibition) stacked on the named technical floor
   (schema-only LLM egress, RLS isolation, delete, FSL self-host);
   sovereign hosting stated as roadmap, never as a current claim.
3. **ToS/DPA delta** — the actual contractual text that makes "not
   allowed" true: nlqdb may not read, use, train on, or resell expert
   knowledge content; drafted by an agent, **reviewed and approved by the
   founder before publish** (legal text is a founder sign-off, not an
   agent merge).

## Hard edges

- The honest-claims guard tests (P6 culture) apply: every capability
  sentence on the surface must be true at merge time.
- The fee appears nowhere on this surface (`SK-EKP-002`: trust-loud,
  fee-quiet); seller-facing fee disclosure lives in the selling flow
  (EK-05), not the trust pitch.
- Marketing pages are nlqdb web surfaces (public repo) — this slice has no
  `experts` half.

## Done when

- [ ] Landing live with the positioning + honest mechanism explanation.
- [ ] Trust copy enumerates the floor; no "can't read" phrasing anywhere.
- [ ] ToS/DPA delta drafted and founder-approved before publish.
- [ ] Honest-claims guard covers the new surface's claims.
