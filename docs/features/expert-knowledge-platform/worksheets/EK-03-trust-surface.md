# EK-03 — Trust surface: landing, copy, ToS/DPA delta

**Status:** in-flight · **Repo:** nlqdb · **Risk:** low · **Runs:** 1–2 ·
**Prereqs:** none (fully constrained by `SK-EKP-001`) · **Boxes 1–2 + 4
shipped 2026-08-08**: the `/experts/` landing
(`apps/web/src/pages/experts.astro`) with the guard test
(`apps/web/src/pages/__tests__/experts-trust-claims.test.ts`). **Box 3
drafted 2026-08-07** → [`drafts/ek-03-tos-dpa-delta.md`](../drafts/ek-03-tos-dpa-delta.md)
(the "not allowed" contract text; awaiting founder sign-off before publish,
queued in [`blocked-by-human.md`](../../../blocked-by-human.md) as a plain legal
action — not a 🔒 decision-to-lock, since `SK-EKP-001` is already locked).
The slice closes when the founder signs off box 3 and a follow-up run
publishes it into `/terms` + `/privacy`.

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

- [x] Landing live with the positioning + honest mechanism explanation
      (2026-08-08, `/experts/` — the "not allowed" pillar stated with its
      sequencing: the contract publishes before the first listing opens).
- [x] Trust copy enumerates the floor; no "can't read" phrasing anywhere
      (planning schema-only · narration disclosed + JSON-only opt-out ·
      RLS isolation · delete · FSL self-host; sovereign hosting labeled
      roadmap/not-shipped).
- [~] ToS/DPA delta **drafted** (2026-08-07) →
      [`drafts/ek-03-tos-dpa-delta.md`](../drafts/ek-03-tos-dpa-delta.md);
      founder sign-off + publish into `/terms` + `/privacy` is a follow-up run
      (a plain legal action in `blocked-by-human.md`, not a 🔒 decision-to-lock
      — `GLOBAL-033`).
- [x] Honest-claims guard covers the new surface's claims (2026-08-08,
      `experts-trust-claims.test.ts` — bans inability claims, absolutes
      ahead of EK-09, pricing language, and fake doors; pins the floor
      enumeration and the honest carve).
