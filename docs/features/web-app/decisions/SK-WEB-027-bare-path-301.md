# SK-WEB-027 — Bare page paths 301 to their trailing-slash canonical (generated `_redirects`)

- **Decision:** `astro build` emits `dist/_redirects` with one **`301`** rule per
  built page, mapping the bare path to the trailing-slash URL that serves the
  200 (`/agents` → `/agents/`). The rule set is derived from the built tree at
  `astro:build:done` (`apps/web/astro.config.mjs` + the pure
  `src/lib/canonical-redirects.ts`), never hand-maintained, so a new page ships
  its own redirect. Two exclusions: the `/app`, `/auth` and `/oauth` prefixes,
  and any bare path that is itself a real asset — `_redirects` wins over asset
  matching, so a rule at `/install` would shadow the
  `curl nlqdb.com/install | sh` script.

- **Core value:** Free, Bullet-proof, Simple

- **Why:** With `trailingSlash: "always"` every page is `<route>/index.html`, and
  Cloudflare's asset router answers the bare path with a **307**. Google's
  indexing pipeline uses only permanent codes (301/308) as a canonicalisation
  signal — for temporary codes it keeps the *source* URL canonical
  ([Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects)).
  So each bare path sat in the index as its own entry competing with the slashed
  twin instead of feeding it: the 2026-07-25 GSC pull had bare `/agents` at
  4 impr / pos 6.8 (the agent-memory landing page) and bare
  `/blog/llm-concatenates-columns-text-to-sql` at 2 impr / pos 15.5. Same class
  of defect as `SK-WEB-026` — Google indexing a non-canonical variant despite a
  correct `rel=canonical` — and the same remedy: make the redirect permanent.
  Impression breadth on the canonical host is the acquisition bottleneck
  (scorecard row #7), and this consolidates it for every page at once rather
  than per URL as each shows up in GSC. `SK-WEB-022` is the complement, not a
  substitute: it keeps *our own* links slashed, while these are URLs Google
  discovered elsewhere.

- **Consequence in code:** `EXCLUDED_PREFIXES = ["/app", "/auth", "/oauth"]` is
  the load-bearing detail: this `dist/` is *also* the merged app host's asset
  directory (`apps/api/wrangler.toml` `[assets] directory = "../web/dist"`,
  `SK-AUTH-016`), so every rule ships there too — and on that host `/app|/auth|
  /oauth` are the app's own routes that `SK-WEB-026` bars from the map and
  `SK-AUTH-016` reserves from server-side redirects. All three are `noindex`, so
  the exclusion costs no indexable yield: **115** rules for 126 built pages.
  `canonicalRedirectRules()` is pure and unit-tested
  (`canonical-redirects.test.ts`: permanent code, root skipped, no rule under an
  excluded prefix, no file shadowed, ceiling enforced). Those cases only bind
  because `ci.yml`'s `build-web` job now runs `apps/web`'s `bun run test` — it
  ran `astro check` + `astro build` only, so no `apps/web` test (including
  `SK-WEB-022`'s guard, which scorecard row #18 called "in CI") ever ran on a PR.
  Cloudflare's ceiling is **2,000** static rules and 1,000 characters per line
  ([limits](https://developers.cloudflare.com/workers/static-assets/redirects/));
  wrangler's `MAX_STATIC_REDIRECT_RULES = 2e3` skips *every* line past it behind
  a single "Skipping remaining … lines" warning, so the generator **throws**
  rather than ship a truncated file — ample headroom today (longest line 128 ch),
  and the build fails loudly if the surface outgrows it.
  `_redirects` is evaluated ahead of the asset router
  and is never itself served (verified against `wrangler dev`: bare paths 301
  **with the query string carried over**, slashed paths and `/install`,
  `/robots.txt`, `/llms.txt` still 200, `/_redirects` 404) and the `_headers`
  HSTS rule still stamps the 301, so `GLOBAL-039` coverage is unchanged.

- **Alternatives rejected:**
  - **`html_handling` mode change** (`force-trailing-slash`) — still redirects
    with a 307; the status code is not configurable, which is the whole defect.
  - **`run_worker_first = ["/*"]`** to redirect in the worker — already rejected
    by `GLOBAL-039` for charging a worker invocation on every marketing request.
  - **A dynamic splat rule** (`/:path` → `/:path/`) — one line instead of 120,
    but it also matches asset paths and the slashed forms, risking a redirect
    loop on the whole surface to save a generated file.
  - **Leaving it to `rel=canonical`** — already present on every page and
    already known to be only a hint: `SK-WEB-026` exists because Google indexed
    a non-canonical URL that carried a correct one.
