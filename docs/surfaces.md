# nlqdb — surfaces

Every way to talk to nlqdb. Each surface is a thin wrapper over the
same `<nlq-data>` element + `/v1/ask` contract — no surface re-
implements query logic.

The status column is the source of truth; the badge row in
`apps/web/src/components/CodePanel.astro` mirrors it. When a surface
flips status, edit this file first, badges second.

## Conventions

- **Shipped** — usable on `main`. CI builds it, runtime owns it.
- **Phase 1** — committed for the on-ramp slice. Shipped before the public alpha.
- **Phase 2** — committed for the developer-surfaces slice. Shipped before GA.
- **Wishlist** — not committed. We surface them on the homepage so
  user clicks become signal for what to prioritize next.

## Matrix

| Surface              | Status   | Implemented as                                                                 |
| :------------------- | :------- | :----------------------------------------------------------------------------- |
| `nlq` CLI            | Shipped  | npm `@nlqdb/cli` (planned), Homebrew `nlqdb/tap` (planned). Source: `apps/cli` |
| `<nlq-data>` HTML    | Shipped  | `packages/elements`, CDN bundle at `nlqdb-elements.pages.dev/v1.js`            |
| TypeScript SDK       | Shipped  | `@nlqdb/sdk` (planned). Source: `packages/sdk`                                 |
| Public demo endpoint | Shipped  | `POST /v1/demo/ask`. No auth, CORS-permissive, canned fixtures. Backs the marketing-site live demo. See `apps/api/src/demo.ts`. |
| React component      | Phase 1  | `<NlqData>` wraps `<nlq-data>`. ~50 LOC.                                       |
| Vue / Nuxt component | Phase 1  | Same shape as React; Nuxt module variant.                                      |
| MCP server           | Phase 1  | Hosted at `mcp.nlqdb.com` (default). Local-stdio fallback as `@nlqdb/mcp`.     |
| curl recipes         | Phase 1  | Markdown-only — `/docs/curl/`. No code surface.                                |
| Python SDK           | Phase 2  | `pip install nlqdb`. Wraps `/v1/ask` with retries + typed responses.           |
| Go SDK               | Phase 2  | `github.com/nlqdb/nlqdb-go`. Same shape as Python.                             |
| Rust SDK             | Phase 2  | `crates.io/nlqdb`.                                                             |
| CLI auth helpers     | Phase 2  | `nlq login` opens browser → magic-link → token in `~/.nlqdb/credentials`.      |
| VSCode extension     | Wishlist | Sidebar panel + inline `<nlq-data>` preview in HTML files.                     |
| JetBrains plugin     | Wishlist | Same shape as VSCode for IntelliJ / WebStorm.                                  |
| Slack bot            | Wishlist | `/nlq <goal>` in any channel. Per-workspace API key.                           |
| Discord bot          | Wishlist | Same shape as Slack.                                                           |

## Adding a surface

When adding a row, set the same status in the homepage badge row
(`apps/web/src/components/CodePanel.astro`). Status change here
without the badge change is a regression — the homepage advertises
the truth.

For wishlist surfaces, use `<a class="badge badge--wishlist"
data-wishlist="<id>" href="mailto:hello@nlqdb.com?subject=...">`
so clicks fire `home.surface_wishlist` for analytics.
