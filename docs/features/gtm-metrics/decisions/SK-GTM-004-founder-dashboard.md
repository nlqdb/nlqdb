# SK-GTM-004 — Founder dashboard at `/app/admin/`; deliberately not in SDK/CLI/MCP/elements

- **Decision:** `/app/admin/` is an Astro page following the `keys.astro`
  pattern (client session guard + hidden shell) mounting the
  `AdminDashboard.tsx` island (ErrorBoundary-wrapped per `SK-WEB-001`,
  calm tokens per `SK-WEB-020`, no chart library — inline SVG
  sparklines/bars only). It fetches `GET /v1/admin/metrics` with
  `credentials: "include"` via a small `lib` helper (`lib/billing.ts`
  precedent). Per
  [`GLOBAL-003`](../../decisions/GLOBAL-003-all-surfaces-one-pr.md) this
  is **deliberately web-only**: internal founder tooling, not a user
  capability — the SDK/CLI/MCP/elements gap is a decision, not an
  omission.
- **Core value:** Simple, Free, Goal-first
- **Why:** The founder's question is "show me progress", answered fastest
  by one always-current page; shipping admin verbs into four public
  surfaces advertises an endpoint 99.9% of callers can only 403 on. No
  chart dependency keeps the island small and the build clean.
- **Consequence in code:** No admin methods in `packages/sdk`, `cli`,
  `packages/mcp`, or `packages/elements`; reviewers reject adding them
  without superseding this. No nav link from shared chrome (`Topnav` is
  static/public); reached by URL — a session-gated link may later land
  inside `/app` chrome only.
- **Alternatives rejected:**
  - SDK method + CLI verb (`nlq admin metrics`) — public API surface for
    a two-person audience; GLOBAL-003 exists for user capabilities.
  - A chart library (recharts/d3) — bundle + design drift for four
    sparklines; calm tokens cover it.
