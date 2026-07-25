# SK-WEB-027 — Bare page paths 301 to their trailing-slash canonical (generated `_redirects`)

- **Decision:** `astro build` emits `dist/_redirects` with one **`301`** rule per
  built page, mapping the bare path to the trailing-slash URL that serves the
  200 (`/agents` → `/agents/`). The rule set is derived from the built tree at
  `astro:build:done` (`apps/web/astro.config.mjs` + the pure
  `src/lib/canonical-redirects.ts`), never hand-maintained, so a new page ships
  its own redirect. Two exclusions: `/app*` (owned by `worker.ts`, which 301s it
  to the merged app host per `SK-AUTH-016`) and any bare path that is itself a
  real asset — `_redirects` wins over asset matching, so a rule at `/install`
  would shadow the `curl nlqdb.com/install | sh` script.

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

- **Consequence in code:** `canonicalRedirectRules()` is pure and unit-tested
  (`canonical-redirects.test.ts`: permanent code, root skipped, `/app*` left
  alone, no file shadowed, ceiling enforced). Cloudflare drops static rules past
  **2,000** silently, so the generator **throws** rather than ship a truncated
  file — at 120 rules for 126 pages there is ample headroom, and the build fails
  loudly if the surface ever outgrows it. `_redirects` is evaluated ahead of the
  asset router (verified against `wrangler dev`: bare paths 301, slashed paths
  and `/install`, `/robots.txt`, `/llms.txt` still 200) and the `_headers` HSTS
  rule still stamps the 301, so `GLOBAL-039` coverage is unchanged.

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
