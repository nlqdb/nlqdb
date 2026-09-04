# Launch kit — firing the drafted-but-never-fired channel

> **Status:** ready to fire, founder-gated. Written 2026-07-19 (founder
> directive: acquisition focus, "go for an obvious direction we didn't pick
> yet"). nlqdb has **never launched anywhere**: a Show HN draft has sat in
> `distribution-queue-archive.md` (archived)
> (2026-06-13) for five weeks;
> the 2026-06 advisor recommendation (archived) called for
> launch posts on 2026-06-12. Meanwhile 105 passive surfaces yield ~1
> GSC click/28d and stranger signups = 0 (scorecard rows #2/#7). Launches are
> the one channel that produces first users in days, not quarters — and the
> instruments to measure them now exist (`/app/admin` GLOBAL-038 dashboard,
> Sean-Ellis Q1 survey `SK-GTM-006`, first-touch attribution PR #745).

Per the reach-track hard rules and the
[r/SQL lesson](../history/reddit-ai-voice-rejection.md): **everything below is
a fact sheet, not final copy.** HN / Reddit / lobste.rs posts are written by
the founder in their own voice; agents deliver facts, numbers, links and
structure only. Sources for venue norms (P2, checked 2026-07-19):
[Show HN guidelines](https://news.ycombinator.com/showhn.html) ·
[HN launch guide for dev tools](https://www.markepear.dev/blog/dev-tool-hacker-news-launch) ·
[Product Hunt launch guide](https://www.producthunt.com/launch) ·
[PH dev-tool guide 2026](https://hackmamba.io/developer-marketing/how-to-launch-on-product-hunt/).

## 1. Readiness audit (agent-verified, in-repo receipts)

| Check | State | Receipt |
|---|---|---|
| Canonical flows walk green against prod | ✅ 9/9 + FLOW-005 both transports | scorecard row #21, run-62 dispatch |
| Advertised-capability integrity | ✅ 0 phantom claims, CI-swept (web+docs) | scorecard row #19 |
| Anon first answer, no gate | ✅ 428 wall removed run 56; TTFV 2.5–14 s on walks | rows #4/#21 |
| GTM measurement | ✅ `/app/admin` live (#742); daily `gtm_snapshots` | GLOBAL-038 |
| PMF measurement | ✅ Sean-Ellis Q1 in-product (`SK-GTM-006`, this PR) | `pmf_survey` D1 |
| Per-channel attribution | ⏳ PR #745 (first-touch UTM/referrer) — **merge before firing** | #745 |
| Prod migrations | ✅ 0022–0025 applied to prod D1 (verified live 2026-07-22; `gtm_snapshots` accruing) | prod D1 `d1_migrations` |

**Capacity — the two launch-day physics facts:**

1. **Anon global cap (SK-ANON-010):** 100 anon asks/hour, 1,000/day,
   cumulative across ALL anon traffic. A front-page hour (~300–1,500
   visitors) trips the 100/hr window early; overflow visitors get the
   `auth_required` sign-in redirect with their prompt stashed
   (SK-ANON-011) — a signup wall, not an error. **Founder knob:** accept
   that (overflow converts to signups or bounces) or temporarily raise
   `HOUR_LIMIT`/`DAY_LIMIT` in `apps/api/src/anon-global-cap.ts` for the
   launch window. Raising it multiplies free-LLM burn — see next.
2. **Free-LLM ceilings
   (phase-1-exit-criteria §4 (archived)):** ~500
   plan-generations/day (Gemini RPD) + ~14.4k classifications (Groq) ≈
   2–4k queries/day after plan-cache. 200 launch-day signups fit; a
   viral spike degrades to fallback lanes. Watch `/v1/ask` error rate on
   launch day (admin dash + CF analytics); the failure mode is slow/refused
   answers, not downtime.

**Known first-impression risk (state it, don't hide it):** the free chain is
the default first answer and BIRD sits at 0.542 (row #8). The honest angle
below turns this into content — the public progress bar / build-in-public
framing — instead of a surprise in the comments.

## 2. Angles (candidate hooks — founder picks; all verified true)

Lead positioning is **nlqdb — your autonomous DBA** (`GLOBAL-041`);
an angle that leads elsewhere needs a deliberate exception, not drift.
**That exception exists (founder, 2026-08-08):** the Show HN may **lead
with the C story** — the agent-operated, $0-stack company — carrying angle
A as the product payload inside it (*"we run our company on free tiers with
Claude agents; nlqdb is what it built"*). Rationale: the founder's genuine
excitement lives in C, and an unexcited author can't write the post or
defend the thread (the r/SQL lesson generalizes: authentic voice is the
channel). The product positioning itself is unchanged — surfaces keep the
autonomous-DBA story; this is one post's framing.

- **A. Your autonomous DBA** (the product lead): build a real app with no
  data modeling — the first insert creates the schema, the DBA evolves and
  optimizes it, every change previewed with 1-click undo; plain English is
  the interface. Honesty gates: FSL-1.1, never "Apache-2.0 today"
  (GLOBAL-019); demoable only once Phase A is live (KPI 1 measured).
- **B. The interface angle — a backend that doesn't exist** — HTML
  components asking for data in plain English; anon first answer in <60 s,
  no signup.
- **C. "Built and run ~almost entirely by Claude-code agents, on a $0
  stack"** — the company-process story (daily/weekly/reach/ek loops,
  scorecard, stranger-test walkers, decision records, free-tier
  infrastructure per GLOBAL-013). Genuinely unusual; HN-native; the
  riskiest comment thread — and, per the 2026-08-08 founder exception
  above, **the chosen lead**, with A as the payload. Feeds the
  free-stack-kit direction (`docs/future/free-stack-kit.md` (archived)):
  launch-day traction on this story is the kit's demand evidence.

## 3. Venue fact sheets (founder writes final copy)

### 3.1 Show HN (the main event)

- **Norms** ([guidelines](https://news.ycombinator.com/showhn.html)): must be
  something people can try; no sign-up wall between the reader and the demo
  (we're fine: anon first answer); submission URL **clean, no UTM** — HN
  strips/punishes tracking params; attribution comes from the
  `news.ycombinator.com` referrer host captured by #745. Post a first
  comment with backstory + what's different + technical detail; factual
  tone, zero marketing language; reply to everything for 24 h.
- **Title shape** (≤ 80 chars, "Show HN: " prefix, no superlatives). Raw
  material: the 2026-06-13 archived draft title; angle-A variant naming
  the autonomous DBA + Postgres + plain English.
- **First-comment fact sheet:** why built (every developer still models,
  migrates, indexes and watches the database by hand — `GLOBAL-041`); what's
  different (schema inferred from inserts and reads, evolved and optimized by
  the DBA, every change previewed and undoable; the LLM emits a typed plan,
  never SQL); numbers we publish (BIRD 0.542 free-chain, target
  0.65 — the public progress bar; persona-bench 0.96); stack ($0 Cloudflare
  Workers + Neon); license FSL-1.1; the one command
  (`claude mcp add --transport http nlqdb https://mcp.nlqdb.com/mcp`).
- **Timing:** weekday morning US (Tue–Thu); founder available 6–8 h.
- **Launch-day watch:** CF analytics live; `/app/admin` signups-by-day;
  anon-cap trips (KV `anon:global:hr:*`); `/v1/ask` error rate.

### 3.2 lobste.rs + r/SideProject + r/Database (soft launch, days before)

Small venues first to shake out surprises while stakes are low. lobste.rs
is invite-only (founder account status = open question) and tag-strict
(`databases`, `ai`); Reddit per the AI-voice lesson — founder's voice,
subreddit self-promo rules re-checked at post time. Same fact sheet as 3.1.

### 3.3 Product Hunt (separate news cycle, ≥ 1 week after Show HN)

- **Norms** ([PH guide](https://www.producthunt.com/launch),
  [dev-tool 2026 guide](https://hackmamba.io/developer-marketing/how-to-launch-on-product-hunt/)):
  Tue–Thu launch; listing scannable in 5 s; respond to every comment for
  24 h; gallery (3–5 images / 1 demo GIF — the `og/agents.png` +
  `vs-*.png` cards from run 42 are raw material). Listing-form content
  (tagline ≤ 60 chars, description, first comment) may be agent-drafted —
  it's a product form, not a community post — founder reviews before submit.
- **UTM:** PH allows tracked links — `?utm_source=producthunt` on the
  website URL (keys per the #745 channel ledger).
- **Account-walled** → payload parked in `blocked-by-human.md`.

## 4. Sequence + measurement contract

1. ✅ Done — #745 (attribution) merged; prod migrations 0022–0025 applied (verified 2026-07-22).
2. Soft venues (3.2) — expect tens of visits; verify attribution rows land
   on `/app/admin`.
3. Show HN (3.1). Success bar, honest: front page = hundreds–thousands of
   visits and the first double-digit stranger-signup day (rows #1/#2 move
   for the first time); no front page = a dated data point + free user
   interviews in the comments (advisor recommendation, archived) — re-fire with a
   different angle ≥ 1 month later.
4. Product Hunt (3.3) ≥ 1 week later.
5. **T+2–7 days:** Sean-Ellis Q1 responses start arriving (survey fires on
   the 2nd+ return visit ≥ 24 h later — exactly the launch cohort);
   `veryDisappointedShare` on `/app/admin` is the PMF read (40% bar,
   meaningful past 10 activated strangers).

Every fire appends a row to the
[acquisition tracker progress log](./automated-icp-validation-plan.md)
(GLOBAL-028): date, venue, visits, anon creates, signups, activated — read
from `/app/admin`, never estimated.

## 5. What this doc is not

Not final copy (hard rule); not a paid-ads/cold-email plan (tracker §0
non-goals stand); not a commitment to a date — firing is the founder's
call. The agent-side work (readiness, instruments, fact sheets, parked
payloads) is done; the remaining cost is founder-minutes.
