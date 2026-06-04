# Founder playbook

Work that doesn't ship as code but moves PMF. Lives next to the
engineering plan ([`phase-plan.md`](./phase-plan.md)) because the
two are co-dependent — the phase plan's monetization and scaling
triggers (`phase-plan.md §6`) depend on signals this playbook is
responsible for capturing.

**Cross-refs:** [`docs/research/personas.md`](./research/personas.md)
(P0–P5 personas, validation plan, willingness-to-pay numbers) ·
[`docs/research/email-and-marketing.md`](./research/email-and-marketing.md)
(channels, cadence, the "refuse" list) ·
[`docs/research/phase-1-exit-criteria.md`](./research/phase-1-exit-criteria.md)
(qualitative gates) · [`docs/decisions/GLOBAL-024-demand-signal-telemetry.md`](./decisions/GLOBAL-024-demand-signal-telemetry.md)
(the in-product half of the signal-capture story).

If a sentence here disagrees with a feature or with `phase-plan.md`,
**the feature / phase plan wins**. This doc owns the founder-time
process: recruitment, interviews, triage, conversion.

---

## 1. Design-partner recruitment

**Target.** 5–7 design partners across personas P1 (Solo Builder) and
P2 (Agent Builder), per [`personas.md §10.4`](./research/personas.md).
Optional 3rd from P3 (Analyst) for breadth; do not chase P4 (BYO PG)
before the [`phase-plan.md §6`](./phase-plan.md) trigger trips.

**Where to find them.**

| Persona | Where they hang out | Outreach shape |
|---|---|---|
| P1 Solo Builder | Indie Hackers, X build-in-public, `r/SaaS`, Hacker News Show-HN comment threads | DM after they ship something visible; offer free Hobby tier in exchange for a 30-min call. |
| P2 Agent Builder | MCP server registry contributors, `r/LocalLLaMA`, Cursor / Zed / Windsurf Discord, AI-agent Twitter (LangChain, LlamaIndex, AutoGen) | Comment on their public agent project with a working MCP install one-liner; ask if they'd like an early MCP key. |
| P3 Analyst | Data PM Twitter, Reforge / Lenny circles, `r/ProductManagement` "tools I use" threads | Inbound only — too noisy to cold. Tell P1 / P2 partners to refer their growth-PM friends. |

**Refuse:** cold email lists (per [`email-and-marketing.md §3`](./research/email-and-marketing.md)),
paid recruitment ("we'll pay $50 for a call"), unbounded "free Pro
forever" deals.

**Outreach template** (P1 example — adapt per persona):

> Subject: building <project>? — quick question
>
> Saw you shipped <project> last week — congrats. I'm building nlqdb
> (a Postgres you create + query in plain English; one HTML tag for
> the embed) and you're exactly the user I'm trying to learn from.
>
> Not selling anything. Asking if you'd be open to a 30-min call so
> I can show you what I have and you can tell me what's wrong with
> it. In exchange: free Hobby tier for a year, your feedback shapes
> the v1.
>
> If yes — pick a slot: <Calendly>. If no — totally fine, thanks
> for reading.

**Throughput note.** Real conversion rates emerge from doing the
work, not from doc-time estimates. Recruitment is the founder's
primary outbound activity in the Phase 1 weeks where it's running —
treat it as a full-time loop, not a side-task.

---

## 2. The Sean Ellis interview

The qualitative half of the `phase-plan.md §6` demand-signal trigger.
Run with every design partner after they've used the product for 2+
weeks; run again every quarter.

**Script (5 questions, ~20 minutes):**

1. **How would you feel if you could no longer use nlqdb?** (a) Very
   disappointed (b) Somewhat disappointed (c) Not disappointed (d) N/A.
   *Sean Ellis's canonical PMF question. 40%+ "very disappointed" =
   PMF signal. 5-7 partners = N=5-7; treat each individual answer as
   a data point, not a percentage.*
2. **What type of person do you think would most benefit from
   nlqdb?** *Tests whether your ICP language matches theirs. If they
   describe a different persona than the one you targeted, your
   targeting is wrong.*
3. **What is the main benefit you receive from nlqdb?** *Tests
   whether your positioning matches what they actually use it for. If
   the answer is "the chat" but you market "the embed element," your
   landing page is wrong.*
4. **What have you almost stopped using nlqdb for, and what did you
   replace it with?** *Tests the silent-quit failure mode. People
   don't churn loudly; they replace one workflow at a time.*
5. **How can we improve nlqdb for you?** *Capture verbatim. Tag the
   answer to one of the open `feature.requested.*` events from
   [`GLOBAL-024`](./decisions/GLOBAL-024-demand-signal-telemetry.md)
   or create a new one if the request doesn't fit any existing event.*

**Capture.** Verbatim quotes into a shared Notion doc (`Design Partners
→ Interviews → YYYY-MM-DD <partner>`). Do not paraphrase. Do not
extract themes during the call.

**Action.** After every 3 interviews, theme-extract together as a
team (founder + first eng). Tag each verbatim quote with a
`feature.requested.*` event ID. If a theme appears in 2+ verbatim
quotes, surface it in the next phase-plan review.

**Failure response.** If <2 out of 5 design partners answer "very
disappointed" to Q1 after two quarters, the product is not at PMF
and the next phase doesn't ship until we move that number. Per the
[`personas.md §10.4`](./research/personas.md) validation plan.

---

## 3. Inbound triage SLA

The fast loop for surfaces other than design-partner calls. Channels
and response targets:

| Channel | Initial response | Resolution |
|---|---|---|
| `security@nlqdb.com` (per [`SECURITY.md`](../SECURITY.md)) | 24 hours, 7 days/week | Per the 90-day fix target. |
| `support@nlqdb.com` / `hello@nlqdb.com` | 24 hours business days | Best effort; pre-revenue. |
| GitHub issues | 48 hours, label + first comment | Triage to milestone or close-with-rationale. |
| Discord `#help` | 24 hours business days | Best effort; community-led after first answer. |
| HackerNews threads on `nlqdb.com` posts | Same day | Engage on every top-level comment; never argue, always thank. |
| X / LinkedIn mentions and replies | 24 hours | Like + reply on every relevant mention. |
| Inbound "how do I pay you" | **1 hour**, founder-led call within 24 hours | This is a `phase-plan.md §6` demand signal — treat as high priority. Log into the demand-signal sink. |

**Owner.** Founder, until first hire. The cost of slow triage is
silent churn — pre-PMF, every inbound is a 1-in-1000 signal.

**Refuse:** auto-replies that lie ("we'll get back to you within 1
business day" when nobody is staffing the inbox); chatbots; cold
"how can we help?" follow-ups that don't actually answer the
question.

---

## 4. Show-HN sequencing

The Hacker News Show-HN is the single highest-leverage launch
moment in Phase 1. Get it right.

**Pre-flight checklist:**

- [ ] Phase 1 on-ramp works for a stranger end-to-end (Hosted db.create
  + Chat + Sign-in UI + `<nlq-data>` embed) — no surface broken on
  Show-HN day.
- [ ] [`GLOBAL-023`](./decisions/GLOBAL-023-trust-ux-baseline.md) trust UX
  in place — Show-HN crowd is brutal on AI-trust failure modes.
- [ ] [`GLOBAL-024`](./decisions/GLOBAL-024-demand-signal-telemetry.md)
  demand-signal events firing — Show-HN traffic is the most valuable
  intent signal we'll ever get for free; lose nothing.
- [ ] Capacity check (`docs/architecture.md §7.1`): can the strict-$0
  inference path absorb a Show-HN spike? Run the numbers from
  [`phase-1-exit-criteria.md item 4`](./research/phase-1-exit-criteria.md).
- [ ] Pause all paid work for 48 hours after submission — founder is
  on inbound triage.

**Timing.** Tuesday 06:00 PT (peaks US/EU overlap). Avoid Mondays
(noisy) and Fridays (low engagement on weekend follow-up).

**Title shape.** *"Show HN: nlqdb — a Postgres you create and query
in plain English (free, OSS)"*. Avoid superlatives ("revolutionary",
"replaces"); state what it is.

**First-hour playbook.** Reply to every top-level comment within 60
minutes. Never argue. Always thank. If a comment is wrong, restate
what the product *does* without correcting the commenter. Pin a
comment with the one-liner install + a screenshot.

**Refuse:** astroturfing (asking friends to upvote — HN bans this
hard), buying placements, pre-coordinating sympathetic threads.

---

## 5. Conversion: design partner → paying customer

**The path:** anonymous-mode → signed-in → first-real-project → paid Hobby.

**Founder ask, when:** after the design partner has used the product
for ≥4 weeks AND has shipped something real with it AND has answered
"very disappointed" or "somewhat disappointed" to the Sean Ellis Q1.

**Founder ask, how:**

> Quick check-in: you've been using nlqdb for <project> for a few
> weeks now. Three things —
>
> 1. What's the *one* thing I should fix this month for you?
> 2. Anyone in your network who's about to start a project I should
>    talk to?
> 3. We'll be opening the paid tier in the next <N> weeks. The
>    plan: $10/mo Hobby, same product, no usage caps yet. Would you
>    sign up on day one?
>
> (Question 3 is the signal. "Yes" → one Stripe-test-mode test
> charge as proof. "No" → ask why, capture verbatim.)

**Refuse:** discounts to design partners ("you get 50% off
forever"); lifetime deals; founder-tier "free forever" carrots
that train the cohort to never pay.

---

## 6. Pairing with in-product telemetry

The founder activities above only become signal when paired with the
in-product events from [`GLOBAL-024`](./decisions/GLOBAL-024-demand-signal-telemetry.md):
verbatim interview quotes get tagged to `feature.requested.*` events,
"how do I pay you" inbound gets logged under `billing.inbound_intent`,
Show-HN traffic shows up in Cloudflare Web Analytics
([`GLOBAL-034`](./decisions/GLOBAL-034-analytics-stack.md)) alongside
`feature.requested.*` spikes. Treat the two halves as one signal-capture system. The
exhaustive "refuse" list (cold outbound, paid ads, AppSumo lifetime
deals, discounts to design partners, etc.) lives in
[`email-and-marketing.md §3`](./research/email-and-marketing.md) — not
duplicated here.
