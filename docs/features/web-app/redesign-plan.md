# Web redesign plan — fresher, calmer, story-first

**Status:** proposal — pending direction lock by user, then SK-WEB-015 promotion.
**Scope:** `nlqdb.com/`, `/pricing`, `/manifesto`, `/agents`, `/vs/*`, `/solve/*`, `/privacy`, `/terms`.
**Constraint:** the brand identity (acid lime + mono headlines + neo-brutalist materials) is not under review. **Execution is.** The goal is to fix rhythm, hierarchy, and story arc — not to repaint the house.

## 1. What's broken today

Audit of the live homepage (`apps/web/src/pages/index.astro`):

- **The hero stacks four text layers** before the input appears: wordmark → lede ("Analytical memory for AI agents") → sub (the explainer paragraph) → credo (the "also a natural-language database" line). The reader has to traverse all four to find out what to do. The form — the only interactive moment — is the fifth thing they see.
- **Ten sections** below the fold (Hero, AgentMemoryBand, Carousel, Waitlist, AlsoWorksFor, CodePanel, Replaces, ResearchReceipts, ManifestoExcerpt). Each one is *fine* in isolation; together they read as a list of marketing requests rather than a story.
- **Recent headline pivot landed on the old layout.** The 2026-06-24 reposition to "Analytical memory for AI agents" (WS-13 / SK-PIVOT-013) changed the *thesis* but didn't redo the *page around the thesis*. The credo line ("Also a natural-language database for any app…") is the seam — it's apologising for the headline.
- **No unified type rhythm.** Type scale ladders are all `clamp()`-fluid and each section picks its own steps. Three competing scales: hero (48–120 / 18–24), section titles (26–40), body (15–18). No common rhythm; the page reads as a stack of independent designs.
- **Lime accent has no rest state.** Used on the wordmark, CTAs, links, dividers, and decorative shapes. Loud accents only land when surrounded by quiet — currently every fold competes for the same eye.
- **One button primitive missing.** `.amb__cta`, `.pricing__cta--primary`, `.btn`, the form's submit — four different visual treatments for the same affordance.

The fix is not more design. It is **less page, with the design that's already there used with restraint**.

## 2. The thesis (one breath)

Every visitor must leave the homepage able to say this sentence:

> **nlqdb is durable memory your agents query in English.**

Three beats deliver that sentence — and nothing else belongs on `/`:

1. **WHAT** — the headline and the one input. *"Analytical memory for AI agents."* Type a goal. Nothing else above the fold.
2. **HOW** — one live demo + one snippet, side by side. Same answer, two surfaces (chat and `<nlq-data>`). This is `SK-WEB-003`'s "code is the proof" promise, made literal.
3. **WHY** — what it replaces. The strikethrough list (Database, Schema, ORM, …) is already the strongest single visual on the site. Make it the third and final beat, restyled in editorial type, then one CTA.

Everything else — waitlist, research receipts, carousel, manifesto excerpt, "also works for" — is moved off `/` to where it belongs (footer link, `/manifesto`, `/agents`, `/examples`). The homepage stops trying to do every job.

## 3. Direction — "Quiet brutalism" (recommended)

Same materials, calmer arrangement. The identity stays. The execution changes.

What it keeps:

- **Acid lime** (`#c6f432`) — *but* reserved for one moment per fold: the hero CTA, then the `<nlq-data>` tag highlight in the demo, then the final CTA. Three appearances total on `/`. No lime on dividers, headlines, or decorative shapes.
- **JetBrains Mono** — kept, but **demoted to code, data, and identifiers only**. Today mono is doing double duty as the narrative voice and the code voice; nothing reads as "code" because everything looks like code. Restricting mono to where it earns its keep is the single biggest readability gain available.
- **Hard shadow, zero radius, near-black ground** — kept. These are the brand's fingerprint.

What it adds:

- **An editorial display face** for narrative headlines (everything that isn't a code identifier). The hero lede, section eyebrows, the "replaces" list, the manifesto excerpt — these get a serif with character. Recommended: **Source Serif 4** (free, OFL, broad weight range, ships under 40 KB subset) paired with the existing mono. Alternative if budget permits: **GT Sectra** or **Tiempos Headline** (licensed).
- **A quiet sans for body** — the current Inter fallback is fine. Set it explicitly at 16/24 with a 65ch measure. This is the third voice; it's the one that should disappear.
- **One unified neutral ladder** — warm-greens biased off the ground, not pure neutral. `#0b0f0a` ground → `#161b14` elevated → `#2a2f26` rule → `#8b8b85` muted → `#c8c8c0` body → `#f4f4f0` ink. Six steps. No others.

What it removes:

- **The credo line** in the hero. The wordmark + lede + form is the whole hero. The "also a natural-language database for any app" idea moves into the demo's snippet annotation, where it's shown not told.
- **Lime on the wordmark.** The wordmark goes ink-on-ground; lime is saved for the CTA below it. (Read this on the live site: the wordmark currently steals the lime moment from the form.)
- **Per-section borders and hard-shadow boxes** that fence sections off from each other. The page becomes one long column; whitespace separates beats. Hard shadow stays — on the CTA only.

Alternatives considered (rejected unless user disagrees):

- **B. Sharpen brutalism** — keep mono as the narrative voice; just fix the rhythm. Rejected because the diagnosis "everything looks like code" can't be fixed without a non-mono companion face.
- **C. Light reset** — invert to a near-white ground. Rejected because a near-black ground is the brand's most recognisable property in screenshot/share contexts and there's no audience complaint about the ground.

## 4. Tokens (proposed)

```css
:root {
  /* Ground & ink (warm-green-biased neutrals, 6 steps) */
  --ground:     #0b0f0a;   /* page background */
  --raised:     #161b14;   /* elevated surfaces, code panel */
  --rule:       #2a2f26;   /* hairline dividers */
  --muted:      #8b8b85;   /* secondary text */
  --body:       #c8c8c0;   /* default body */
  --ink:        #f4f4f0;   /* headlines, primary text */

  /* Accent — one moment per fold */
  --accent:     #c6f432;
  --accent-ink: #0b0f0a;   /* text on accent surfaces */

  /* Faces */
  --display:    "Source Serif 4", "Iowan Old Style", Georgia, serif;
  --mono:       "JetBrains Mono", ui-monospace, monospace;
  --sans:       "Inter", system-ui, sans-serif;

  /* Type scale — 5 steps, no clamp soup */
  --t-display:  clamp(44px, 7vw, 88px);   /* hero lede */
  --t-section:  clamp(28px, 4vw, 44px);   /* section heads */
  --t-large:    20px;                      /* lead body, callouts */
  --t-body:     16px;                      /* body, measure 65ch */
  --t-small:    13px;                      /* labels, meta */

  /* Rhythm */
  --col:        720px;                     /* narrative measure */
  --bleed:      1120px;                    /* demo + code panel */
  --gap-beat:   clamp(80px, 14vw, 160px);  /* between top-level beats */
  --gap-block:  32px;                      /* within a beat */
}
```

The point isn't the exact hexes — the point is **six neutrals, three faces, five type steps, two widths, two gaps**. Today the page has many more of each, and that's the source of the "different font sizes and indented" complaint.

## 5. Page-by-page IA

### `/` — Homepage

Three beats, in this order:

1. **Hero.** Headline (display serif) + lede (body sans, one sentence) + the input. Nothing else above the fold. Wordmark moves to the nav. (`SK-WEB-002` honored — one input, no signup wall.)
2. **The demo.** A live chat reply on the left, the `<nlq-data>` snippet that produces it on the right (or stacked on mobile). The lime moment is the `<nlq-data>` tag highlight. (`SK-WEB-003` honored — runnable code above the fold; `SK-WEB-008` honored — real `/v1/ask`.) The current `Carousel` collapses into the *examples strip* under the demo (small, monospaced, click to load into the chat).
3. **The replacement.** Strikethrough list, restyled in display serif, lime on the final `<nlq-data>` line. One CTA below. End of page.

Cuts from `/`: `AgentMemoryBand`, `Waitlist`, `AlsoWorksFor`, `ResearchReceipts`, `ManifestoExcerpt`. Their fates:

- `AgentMemoryBand` → folded into the demo's contextual copy + `/agents` is the destination link.
- `Waitlist` → footer-only inline (the product is open per `d63fb01`; the waitlist is legacy).
- `AlsoWorksFor` → moves to `/integrations` or a footer strip; not a top-of-funnel concern.
- `ResearchReceipts` → moves to `/manifesto` where research belongs, or `/trust`.
- `ManifestoExcerpt` → the manifesto link in the footer is enough; an excerpt that doesn't fit the page rhythm is worse than no excerpt.

### `/agents`

The agent-memory-specific mirror of the homepage, with the same three-beat rhythm:

1. **Hero** — *"Memory your agents can `GROUP BY`."* + one input pre-loaded with an agent-memory goal.
2. **Demo** — `nlqdb_remember` / `nlqdb_recall` MCP tool calls, with the resulting query.
3. **The replacement** — what this replaces for agent builders (vector store top-k, per-agent SQLite, embedding cache). Same strikethrough treatment.

### `/manifesto`

The long-form moment. Editorial typography earns its rent here.

- Single column, 720px measure, display serif at body weight for the running text.
- Drop cap on the opening paragraph. Smallcaps for cited entities (`<abbr>` styling).
- Pull-quotes set at `--t-section`, lime hairline rule above/below.
- No hard-shadow boxes. The page is the rhythm.

### `/pricing`

- One button primitive applied to every tier CTA (the lime CTA from the hero).
- Three tiers, same card metric — no "popular" badge unless it's literally measured. Tier headers in display serif, prices in mono (numbers are data; mono earns its keep here).
- The dunning + cancellation banners (`SK-WEB-011`, `SK-WEB-012`, `SK-WEB-013`) get the new token system applied — same red-tinted danger surface, same neutral structure as everything else.

### `/vs/*` and `/solve/*`

Template pass — same direction, applied to the comparison/solve page chassis:

- Each page collapses to: **what we replace** (one line) → **the same goal, two ways** (their snippet beside ours) → **what's different** (a tight 4-row table, not a 20-row grid). Comparison tables become the hero of the page, not buried below feature copy.
- Headers/eyebrows in display serif; both code snippets in mono with a single lime tag-highlight in ours.

### `/privacy`, `/terms`

Boring is the goal. Display serif headers, body sans at 16/24, one column, 720px. No decoration. These pages currently have no obvious problems — they get only the token sweep, no IA work.

## 6. Implementation sequence

Each step is one commit and one PR. The order is chosen so the homepage looks better at every step, even before the full plan lands.

1. **Tokens + face load.** Add the proposed CSS variables and load Source Serif 4 (subset to Latin, weights 400/600, swap to local). Replace existing custom-property values in `global.css`. **Visible change: rhythm calmer everywhere; type ladder visible on the manifesto.**
2. **Hero refactor.** Drop the credo line. Move wordmark to nav. Headline goes display serif, lede goes body sans. Form gets the unified CTA primitive. **Visible change: hero stops looking like a wall of text.**
3. **Demo block.** New `Demo.astro` component: live chat reply + `<nlq-data>` snippet, side by side. Lime moment lives here. Replaces the section currently between the hero and the carousel. **Visible change: the page's thesis is now provable in one screen.**
4. **Replacement block restyle.** `Replaces.astro` gets the editorial-serif treatment, becomes the third and final homepage beat with one CTA below it. **Visible change: the page has a clear end.**
5. **Delete + relocate.** Remove `AgentMemoryBand`, `Waitlist`, `AlsoWorksFor`, `ResearchReceipts`, `ManifestoExcerpt` from `/`. Move `AlsoWorksFor` to `/integrations` (new shell) or footer. Move `ResearchReceipts` to `/manifesto`. **Visible change: homepage has three beats, top to bottom.**
6. **`/pricing` token sweep + button primitive.**
7. **`/manifesto` editorial treatment.**
8. **`/agents` three-beat refactor** (mirrors `/`).
9. **`/vs/*` and `/solve/*` template pass.**
10. **Final accessibility + reduced-motion audit** — every animation gated on `prefers-reduced-motion: no-preference`; focus-visible states checked end-to-end.

A motion budget worth naming up front: **two moments on `/`**. One is the existing hero-to-chat morph (`SK-WEB-002`, View Transitions); the other is a slow type-on of one identifier in the demo block. Nothing else animates. Scroll-driven `Replaces` strikethrough stays but becomes the *only* scroll moment.

## 7. Constraints — what we must keep (`P1`)

Honored by this plan:

- `SK-WEB-002` — one input, morph-to-chat, no signup wall. Hero still ships this.
- `SK-WEB-003` — runnable code above the fold. The demo block makes this more literal, not less.
- `SK-WEB-008` — demo === real `/v1/ask`. The plan removes none of the API plumbing; only the visual shell changes.
- `SK-WEB-010` — marketing-page Copy-snippet shows the embed shape. Lives in the demo block under the snippet.
- `SK-WEB-014` — Organization + WebSite JSON-LD. Unchanged.
- `GLOBAL-007` — no login wall before first value. Unchanged.
- `GLOBAL-011` — honest latency; live trace. The chat in the demo block still streams.
- `GLOBAL-012` — errors are one sentence with the next action. CTA copy audit included in step 2.
- `GLOBAL-020` — no region picker / config in the first 60s. Unchanged.
- `GLOBAL-023` — trust UX baseline. The diff-preview / trace surfaces aren't touched.
- `GLOBAL-025` — north star. UX pillar advanced; engine quality / onboarding / perf not degraded (smaller page = perf gain).

`SK-WEB-011`, `SK-WEB-012`, `SK-WEB-013` (in-app banners) are restyled to the token system but their behaviour is unchanged.

## 8. Open questions for the user (please decide before step 1)

1. **Direction lock.** Quiet brutalism (recommended), Sharpen brutalism, or Light reset?
2. **Display face.** Source Serif 4 (free, OFL, ships subset under 40 KB) or a licensed face (GT Sectra, Tiempos Headline)? The plan assumes Source Serif 4 unless told otherwise.
3. **Cut depth.** Confirm the homepage cuts: AgentMemoryBand, Waitlist, AlsoWorksFor, ResearchReceipts, ManifestoExcerpt all off `/`. Any of these you want kept?
4. **`/integrations` page.** The `AlsoWorksFor` content needs a home if it leaves `/`. Build a new `/integrations` page or fold into footer-only?
5. **Promote to `SK-WEB-015`?** Once direction is locked, this proposal collapses into a single `SK-WEB-015 — Three-beat homepage; quiet brutalism token system` entry in `FEATURE.md` and this file is deleted.

## 9. Out of scope

- The product (`/app`, the chat surface) — that's its own redesign and lives behind a separate sweep. This plan touches only the marketing surface.
- The chat-panel `<Answer>/<Data>/<Trace>` rendering (`SK-WEB-005`). Token system will apply visually but the structural decision is settled.
- Logo/wordmark redraw. The wordmark "nlqdb" lower-case mono is the brand mark; not under review.
