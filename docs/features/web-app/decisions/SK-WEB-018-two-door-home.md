# SK-WEB-018 — Two-door home: agent-memory door + question-your-ClickHouse door, responsive chooser

Supersedes the three-beat-on-`/` IA of
[`SK-WEB-015`](./SK-WEB-015-three-beat-quiet-brutalism.md) (its token system
is **retained**) and the connect-first hero of
[`SK-WEB-017`](./SK-WEB-017-connect-first-hero.md) (its `<McpInstall>`-primacy
is **absorbed into Door A**).

- **Decision:** The home (`nlqdb.com/`) becomes a single **two-door chooser**,
  not a vertical hero→demo→replaces narrative. Two equal-weight doors render
  side-by-side on wide viewports and stack on narrow ones (CSS grid,
  `grid-template-columns` collapsing to one column under the `--col` breakpoint;
  no JS):
  - **Door A — "Use as agent memory."** A row of MCP host buttons (Cursor ·
    VS Code · Claude Code · Codex · Claude Desktop · Windsurf · Zed) rendered by
    the [`SK-WEB-016`](./SK-WEB-016-mcp-install-affordance.md) `<McpInstall>`
    component. Clicking a host **reveals that host's fallback install
    instructions in place** *and* opens/installs in the host where a deep-link
    or command exists (the SK-WEB-016 click→reveal behaviour). A quiet
    *"or just describe your data →"* link under the row routes to `/app/new`
    (the generalist describe→table→embed seam — preserves
    [`GLOBAL-007`](../../../decisions/GLOBAL-007-no-login-wall.md) no-login-wall
    first value).
  - **Door B — "Question your ClickHouse."** A single promoted CTA that routes
    to sign-in and, on success, post-login-redirects to `/app/connect`
    ([`SK-WEB-019`](./SK-WEB-019-connect-page.md)) to connect and query the
    user's own ClickHouse.
  This replaces the SK-WEB-015 / SK-WEB-017 `Hero → Demo.astro → Replaces.astro`
  three-beat on `/`. The quiet-brutalism **token system is unchanged** (six
  neutrals, one accent, three faces, five steps — `SK-WEB-015`); only the home
  IA changes. The accent budget still holds: **one promoted lime CTA per door**
  (Door A's promoted host button per `SK-WEB-016`; Door B's "Question your
  ClickHouse" CTA), everything else `.cta--ghost`.

- **Core value:** Goal-first, Effortless UX, Creative

- **Why:** SK-WEB-017 left the home as a single vertical story that led with
  agent-memory and demoted the generalist flow to one `.alsoworks` line. But
  the product now has **two genuinely first-class entry actions** — connect your
  agent (Door A, the [`GLOBAL-036`](../../../decisions/GLOBAL-036-lead-positioning-analytical-agent-memory.md)
  wedge) and connect your own analytics DB (Door B, the BYO-ClickHouse path
  shipped end-to-end in [`SK-DBCONN-001`](../../byo-connect/FEATURE.md)). A
  vertical hero forces a single primary action and buries the second; a
  side-by-side chooser presents both honestly and lets the visitor self-select
  in one glance. This is the literal expression of GLOBAL-036's *dual front
  door* — Door A is the agent-memory wedge, Door B is the generalist/analytics
  door — rather than a wedge-led hero with a demoted generalist seam. The
  describe→table→embed flow is still one click away (the *"or just describe your
  data →"* link under Door A) so GLOBAL-007's no-wall first value survives. The
  three-beat narrative (`Demo.astro`, `Replaces.astro`) does not vanish — its
  proof relocates to `/agents`, the deep single-story door GLOBAL-036 already
  defines; the home's job is now to *route*, not to *pitch*.

- **Consequence in code:** `apps/web/src/pages/index.astro` renders a single
  `.doors` grid (responsive: side-by-side ≥ `--bleed`, stacked below) with two
  children — Door A (`<McpInstall>` host row + the *"or just describe your data
  →"* link to `/app/new`) and Door B (the *"Question your ClickHouse"* CTA →
  `/auth/sign-in?return_to=/app/connect`). `Demo.astro` / `Replaces.astro` are
  no longer mounted on `/` (they move to `/agents`); the SK-WEB-017 hero
  composition (`Hero.astro` connect-row-primary + `<CreateForm>` secondary) is
  removed from `/`. No new tokens; the SK-WEB-015 accent budget is enforced
  per-door (one promoted lime CTA each). The home JSON-LD
  ([`SK-WEB-014`](./SK-WEB-014-site-entity-json-ld.md)) `description` keeps the
  wedge-led string. PRs that reintroduce the three-beat vertical IA on `/`, add
  a third door, or put lime on more than one CTA per door are rejected.

- **Alternatives rejected:**
  - **Keep SK-WEB-017's vertical wedge hero, add Door B below it.** Buries the
    analytics door below the fold; a visitor whose intent is "question my
    ClickHouse" must scroll past an agent-memory pitch to find their action.
    The two-door chooser presents both at parity, which is what the dual front
    door (GLOBAL-036) actually commits to.
  - **One door only, infer intent from a single CTA.** There is no honest single
    CTA that serves both an agent builder (wants MCP install) and an analyst
    (wants to paste a ClickHouse URL); a blended action serves neither.
  - **A modal/quiz that asks "agent or analytics?" first.** Adds an interstitial
    before any value, contradicting the goal-first inversion and GLOBAL-020
    (no config in the first 60 s). The two doors *are* the chooser — no extra
    step.
  - **Delete the `/app/new` generalist seam entirely.** Removes the no-login-wall
    first-value affordance GLOBAL-007 requires; the quiet link under Door A keeps
    it one click away without competing with the two primary doors.
