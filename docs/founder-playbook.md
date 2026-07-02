# Founder playbook

Work that doesn't ship as code but moves PMF. Lives next to the
engineering plan ([`phase-plan.md`](./phase-plan.md)) because the
phase plan's monetization and scaling triggers (`phase-plan.md §6`)
depend on signals captured here and by the autonomous motion.

**As of 2026-07-01 (founder directive #5), design-partner
recruitment, interviews, and the conversion ask run with zero founder
involvement.** The operating path is
[`docs/research/design-partners-autonomous.md`](./research/design-partners-autonomous.md).
This doc keeps only what is genuinely founder-only. Section numbers
§1/§2/§5 are retained as superseded stubs because other docs cite
them. If a sentence here disagrees with a feature or with
`phase-plan.md`, **the feature / phase plan wins**.

**Cross-refs:** [`docs/research/personas.md`](./research/personas.md)
(P0–P5 personas, targets, willingness-to-pay) ·
[`docs/research/email-and-marketing.md`](./research/email-and-marketing.md)
(channels, the "refuse" list: cold outbound, paid ads, lifetime deals,
design-partner discounts — not duplicated here) ·
[`docs/research/phase-1-exit-criteria.md`](./research/phase-1-exit-criteria.md).

---

## 1. Design-partner recruitment — superseded

Founder-led outreach (DMs, Calendly calls) is no longer the operating
path — it violated the zero-founder directive and cold-DM outreach is
off-limits under the autonomous plan's constraints. Recruitment is
now **inbound-only** via `/blog`, `/vs`, `/solve`, docs, `llms.txt`,
and MCP distribution; a design partner is defined behaviourally
(≥ 10 successful queries across ≥ 2 distinct weeks). See
[`design-partners-autonomous.md §1`](./research/design-partners-autonomous.md).
Targets unchanged: 5–7 partners across P1/P2
([`personas.md §10.4`](./research/personas.md)).

## 2. The Sean Ellis interview — superseded

The 1:1 interview is replaced by the in-product Sean Ellis survey
(Q1 verbatim + free-text) and the agent-triaged check-in email —
[`design-partners-autonomous.md §2`](./research/design-partners-autonomous.md)
M1/M2. The PMF gate is unchanged: ≥ 40% "very disappointed" among
design-partner respondents, min N = 5, computed by `/weekly`; below
2-of-5 after two quarters, the next phase doesn't ship. Verbatims are
still tagged to `feature.requested.*` events
([`GLOBAL-024`](./decisions/GLOBAL-024-demand-signal-telemetry.md)).

## 3. Inbound triage — agent first-pass, founder for two classes

The agent (`/daily`) takes the first pass on all inbound; verbatims
are tagged to `feature.requested.*` events per the autonomous plan.
Only two classes reach the founder, per
[`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md)'s single
escalation class (money / legal):

| Channel | First pass | Founder-only when |
|---|---|---|
| `security@nlqdb.com` (per [`SECURITY.md`](../SECURITY.md)) | Founder, 24h, 7 days/week | Always — legal/disclosure surface. |
| Inbound "how do I pay you" | Agent logs `billing.inbound_intent` | **1 hour**; founder-led call within 24h — a `phase-plan.md §6` demand signal. |
| `support@` / `hello@` / `partners@` replies | Agent, 24h business days | Never (escalate only the two classes above). |
| GitHub issues / Discord `#help` | Agent, 24–48h, label + first answer | Never. |
| HN / X / LinkedIn mentions | Founder (human identity — accounts are personal) | Same day on HN launch threads; 24h otherwise. Never argue, always thank. |

**Refuse:** auto-replies that lie; chatbots; "how can we help?"
follow-ups that don't answer the question.

---

## 4. Show-HN sequencing (founder-only)

The Show-HN is the single highest-leverage launch moment in Phase 1,
and it must be a human: HN norms and constraint 1 of the autonomous
plan (no impersonation) rule out an agent posting or replying there.

**Pre-flight checklist:**

- [ ] The stranger on-ramp works end-to-end (Hosted db.create + Chat +
  Sign-in + `<nlq-data>` embed) — no surface broken on Show-HN day.
- [ ] [`GLOBAL-023`](./decisions/GLOBAL-023-trust-ux-baseline.md) trust
  UX in place — the HN crowd is brutal on AI-trust failure modes.
- [ ] [`GLOBAL-024`](./decisions/GLOBAL-024-demand-signal-telemetry.md)
  demand-signal events firing — lose none of the free intent signal.
- [ ] Capacity check (`docs/architecture.md §7.1`): the strict-$0
  inference path can absorb the spike
  ([`phase-1-exit-criteria.md` item 4](./research/phase-1-exit-criteria.md)).
- [ ] Founder clears 48 hours post-submission for inbound.

**Timing.** Tuesday 06:00 PT. Avoid Mondays (noisy) and Fridays.

**Title shape.** *"Show HN: nlqdb — a Postgres you create and query
in plain English (free, OSS)"*. No superlatives; state what it is.

**First hour.** Reply to every top-level comment within 60 minutes.
Never argue; always thank. Pin a comment with the one-liner install +
a screenshot.

**Refuse:** astroturfing, buying placements, pre-coordinated threads.

---

## 5. Conversion: design partner → paying customer — superseded

The founder ask is automated: the paid-tier intent question and the
"one thing to fix" ask run via the survey + check-in email
([`design-partners-autonomous.md §2`](./research/design-partners-autonomous.md)).
The founder enters only on a logged `billing.inbound_intent` (§3) or
to override direction in `/weekly`. Refuse list for deals (discounts,
lifetime, free-forever) is in
[`email-and-marketing.md §3`](./research/email-and-marketing.md).
