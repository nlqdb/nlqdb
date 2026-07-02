# Design partners without a founder — the autonomous motion

**Status:** decided 2026-07-01 (founder directive #5). Supersedes
[`founder-playbook.md`](../founder-playbook.md) §1 (recruitment),
§2 (Sean Ellis interviews) and §5 (conversion ask) as the operating
path. Every mechanic below is **decided** per
[`GLOBAL-033`](../decisions/GLOBAL-033-resolution-defaults.md) — no
open questions are parked here. The `SK-*` blocks for each slice land
in the owning feature's FEATURE.md in the same PR as the code, per
`CLAUDE.md` §10.1; this doc is the plan of record until then.

## 0. Hard constraints

1. **No impersonation.** Every agent-authored message (email footer,
   survey card, blog post byline) states it was written by nlqdb's
   operating agent and that an agent reads the replies.
2. **No unsolicited outreach.** Contact only people who touched the
   product (registered, or explicitly opted in). Cold DMs / cold email
   stay on the refuse list ([`email-and-marketing.md §3`](./email-and-marketing.md)).
3. **$0.** Everything below fits Resend 3k/mo, Cloudflare Email
   Routing (free), the existing events queue, D1, and LogSnag.

## 1. The motion in one paragraph

Recruitment is **inbound-only**: `/blog`, `/vs`, `/solve`, the docs
site, `llms.txt`, and MCP-registry distribution bring users; nobody
DMs strangers. A **design partner is defined behaviourally**, not by a
call: a registered user with ≥ 10 successful `/v1/ask` queries across
≥ 2 distinct weeks. The "interview" is an in-product Sean Ellis survey
plus one automated check-in email whose replies an agent triages. All
of it lands in one D1 `feedback` table + the existing
[`GLOBAL-024`](../decisions/GLOBAL-024-demand-signal-telemetry.md)
`feature.requested.*` stream, which `/daily` and `/weekly` already
read. Target and PMF gate are unchanged from the playbook: 5–7
partners across P1/P2 ([`personas.md §10.4`](./personas.md)); ≥ 40%
"very disappointed" (min N = 5) is the `phase-plan.md §6` qualitative
signal.

Note on `GLOBAL-024`'s "post-hoc surveys rejected": that rejection is
for **demand-signal telemetry** (what to build next), where negative-
path events win. The Sean Ellis question measures **PMF**, which no
event can capture — the survey complements, not contradicts, it.

## 2. Mechanics — decided

### M1. In-product Sean Ellis survey — ADOPT

Replaces founder-led interviews (playbook §2).

- **Trigger:** first successful `/v1/ask` on the chat surface once the
  user has ≥ 10 lifetime successful queries AND ≥ 14 days since
  signup. Both numbers env-tunable (`GLOBAL-033` pin-a-number). The
  10-query bar matches the first-10-queries KPI (directive #2); 14
  days preserves the old "2+ weeks of use" precondition.
- **Form:** inline dismissible card in the chat surface — **not a
  modal** (`GLOBAL-033` UX row). Q1 verbatim ("How would you feel if
  you could no longer use nlqdb?" — very / somewhat / not
  disappointed) + one optional free-text ("How can we improve nlqdb
  for you?", ≤ 500 chars). Card copy identifies the reader as an
  agent.
- **Re-ask:** every 90 days (the old quarterly cadence), deduped by
  event id `feedback.pmf_survey.<userId>.<quarter>` (`SK-EVENTS-004`
  pattern). Dismissal counts as answered for the quarter.
- **Plumbing:** authed `POST /v1/events/feedback` (typed body, shared
  with M4) → D1 `feedback` row inserted by `apps/api` + one
  `feedback.pmf_survey` `ProductEvent` → LogSnag `demand-signal`
  channel, `notify: true` (rare + precious).
- **Dropped, not parked:** interview Q2–Q4 (ICP language / main
  benefit / silent-quit). They needed conversational probing a form
  can't do; the free-text field and M2 reply threads surface the same
  themes. If a theme goes dark, `/weekly` re-raises it from the data.

### M2. Automated post-signup check-in email — ADOPT

- **Send:** exactly one email, 7 days after signup, to every
  registered user with a verified email (they touched the product —
  consent basis; constraint 2 holds). No drip sequence.
- **Content:** one question — "What's the one thing nlqdb should fix
  or build for you this month?" — plus the agent-authorship footer
  (constraint 1). React Email template via the existing Resend
  wiring; volume is far inside 3k/mo.
- **Replies:** `Reply-To: partners@nlqdb.com` → Cloudflare Email
  Routing → an Email Worker that emits a `feedback.email_reply` event
  (body truncated to 2 000 chars, no attachments) → events-worker
  sink writes the D1 `feedback` row + LogSnag `notify: true` ping.
  This unparks the events-pipeline "inbound-email sink" question with
  a named consumer.
- **Triage:** a `/daily` step reads unprocessed `feedback` rows, tags
  each verbatim to a `feature.requested.*` event (or proposes a new
  variant), replies **only if the user asked a question** — as the
  agent, never as a person — and marks the row processed. "How do I
  pay you" replies escalate to the founder (`GLOBAL-033` true-founder-
  bet class: money) and log `billing.inbound_intent`.
- **Referral ask stays solicited:** the email's postscript may ask
  "anyone else building something like this?" — solicited via an
  existing user, so constraint 2 holds.

### M3. Public build-log page — ADOPT as a `/blog` category, REJECT a standalone page

The `/blog` surface (worksheet W6, parallel task) is the home.
Build-log posts are ordinary blog posts tagged `build-log`, published
autonomously by `/daily` step 3 (directive #4). Per `GLOBAL-033`
wire-format row — reuse what's built, one way to publish — a separate
page/surface would be a second publishing path with no added reach.
Weekly build-in-public digest = one `build-log` post/week with real
metrics from the scorecard; posts carry the agent byline.

### M4. Feedback widget → demand-signal events — ADOPT

- A small "feedback" affordance on the chat/app surface (footer link
  opening the same inline-card component as M1, free-text only).
- Posts to the same authed `POST /v1/events/feedback` endpoint as M1
  with variant `feedback.submitted` (`surface`, text ≤ 500 chars) —
  one endpoint, one D1 table, one triage queue. LogSnag
  `demand-signal` channel, `notify: false` (aggregate signal, per the
  `SK-EVENTS-011` precedent). Anonymous marketing-page feedback stays
  on the existing wishlist path; this widget is for signed-in users.

### What is NOT in the autonomous motion (stays founder-only)

- **Show-HN** (playbook §4): HN requires a human account and human
  engagement; an agent posting there breaches constraint 1.
- **security@** and **payment-intent calls**: legal/money —
  `GLOBAL-033`'s one escalation class.

## 3. Data model — one triage surface

All four mechanics write one D1 table `feedback`
(`id, principal_id, kind ∈ {pmf_survey, email_reply, widget}, surface,
answer, text, created_at, processed_at, tagged_event`). HTTP surfaces
insert via `apps/api`; the email path inserts via an events-worker
sink. `/daily` triages unprocessed rows; `/weekly` computes the PMF
number (share of "very disappointed" among design-partner respondents,
min N = 5) and the theme counts next to the `feature.requested.*`
aggregates. No Notion, no spreadsheet.

## 4. Implementation slices

**Slice 1 (FIRST — daily-run-sized, for `/daily` to pick up): the
in-product PMF survey (M1).** One PR: `feedback.pmf_survey`
`ProductEvent` variant + quarterly `defaultId`; D1 migration for the
`feedback` table; authed `POST /v1/events/feedback`; the inline survey
card in the chat surface (shown per the M1 trigger); LogSnag sink
case. SK blocks land in `events-pipeline` + `web-app` FEATURE.md in
the same PR.

Then, in order — each its own daily-sized PR:

- **Slice 2:** M4 widget (reuses Slice 1's endpoint/table; new variant
  + the footer affordance).
- **Slice 3:** M2 send path (React Email template, day-7 cron trigger,
  dedupe id `feedback.checkin_sent.<userId>`).
- **Slice 4:** M2 reply path (Email Routing + Email Worker →
  `feedback.email_reply` → D1 sink) + the `/daily` triage step.
- **M3** ships inside W6 (`/blog`) as the tagging convention + the
  first weekly digest post; no slice here.
