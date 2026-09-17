# SK-WEB-031 — One-input home with a fixed section rhythm; content pages are secondary nav

Replaces the two-door chooser home (former `SK-WEB-018`, deleted) and
re-trues `SK-WEB-002`: the goal input is the home's one primary action
again, as [`END_GOAL.md`](../../../END_GOAL.md) row 9 states.

- **Decision:** `nlqdb.com/` has **one primary action** — the anonymous
  goal input with starter goals (`<CreateForm>`, `SK-ONBOARD-008`) in the
  hero, whose submit is the hero's only promoted CTA — followed by a fixed
  **section rhythm** that tells the DBA loop in order: *how it works*
  (infer → evolve → optimize, three steps) → *diff-then-confirm* (the
  `requires_confirm` trust moment, `SK-TRUST-001`/`-002`) → *surfaces*
  (SDK · element · MCP · CLI, status per `progress.md §0`) → *ways in*
  (agent memory via `<McpInstall>`, `SK-WEB-016`; BYO warehouse via
  `/app/connect`, `SK-WEB-019`) → *what is next* (the non-gating Become AI
  interest list permitted by `GLOBAL-007`) → *under the hood*
  (`SK-WEB-021`) → one closing CTA with measured facts. Bands alternate
  under one token system (`SK-WEB-020`); one promoted CTA per band.
- **Core value:** Goal-first, Effortless UX, Honest latency
- **Why:** The two-door chooser asked a stranger to self-classify before
  any value, and the goal input — the thing `END_GOAL` row 9 and
  `GLOBAL-025`'s TTFV KPI are measured on — was a link one click away
  instead of the page. Dev-tool landing research (Evil Martians' 100-site
  study; Linear/Neon/Supabase navs) converges on one hero action, a
  "how it works" beat for products with a non-obvious mechanism, proof
  next, and a single final CTA — and on grouping editorial pages behind one
  Resources-style menu so the top row routes to the product. Solve / vs /
  blog are search-intent on-ramps (their own FEATURE.md GLOBAL-025 notes:
  "the on-ramp the homepage can't be"); a stranger who is already on the
  homepage does not need them in the top row, and acquisition is paused.
- **Consequence in code:** `apps/web/src/pages/index.astro` mounts
  `<CreateForm client:load headingLevel="h2">` in the hero (its own title
  visually hidden — the `<h1>` is the promise) and the eight sections above
  in that order; layout in `styles/home2.css` (`.home2`), no new tokens.
  The Become AI band appears only after the working engine is explained,
  links to `/experts/` for the full honest preview, and adapts its shared
  form to account email for signed-in visitors.
  `Topnav.astro` renders the Content disclosure from one `CONTENT` array and
  shares its disclosure script with the avatar menu. The FLOW-001 walker
  types into the home hero directly (door to `/app/new/` kept as fallback).
  Reviewers reject: a second promoted CTA in the hero, an interest form
  that gates the usable product, a section that reorders the loop (optimize
  before infer), an unshipped surface without its phase badge (`SK-WEB-003`),
  solve/vs/blog returning to the top row.
- **Source:** canonical here · END_GOAL row 9 · replaces `SK-WEB-018`
  (git history keeps its body).
