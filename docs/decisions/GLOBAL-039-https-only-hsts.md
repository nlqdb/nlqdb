# GLOBAL-039 — Production hosts are https-only: worker-level http→301 + HSTS everywhere

- **Decision:** Every production `nlqdb.com` host serves https only. Each
  worker that fronts a dynamic host (`apps/api`, `apps/mcp`) 301s
  `http://` to `https://` itself and stamps
  `Strict-Transport-Security: max-age=31536000; includeSubDomains` on every
  response (`https-enforce.ts`, duplicated per worker — two pure functions
  don't justify a package). Static-asset surfaces (`apps/web`, `apps/docs`,
  `apps/coming-soon`) ship the same HSTS header via a `_headers` file, since
  the asset path never invokes a worker (by design — zero worker cost) and
  Workers `_redirects` cannot express scheme redirects. **No `preload`
  directive** — the preload list is effectively irreversible and gated on a
  zone-level http→301 we can't yet set. Dev hosts (localhost,
  `*.workers.dev` previews) are never redirected.

- **Core value:** Bullet-proof, Simple, Free

- **Why:** The 2026-07-22 GSC pull found Google indexing an `http://` solve
  URL — prod answered plaintext `http://` with a 200 and no HSTS anywhere,
  leaving every surface open to SSL-strip. The zone-level "Always Use
  HTTPS" toggle needs a dashboard click (the CI token is
  Workers/DNS/D1-scoped), so the enforcement the workers *can* do lands in
  code where it deploys with every surface; the residual zone toggle is
  queued in `docs/blocked-by-human.md`. One year + `includeSubDomains` is
  the standard hardening posture; it is expensive to reverse (browsers pin
  it), which is exactly why it is recorded here — a future plaintext-only
  subdomain would be broken for up to a year in returning browsers.

- **Consequence in code:** `apps/api/src/https-enforce.ts` +
  `apps/mcp/src/https-enforce.ts` (same 15 lines, tested per worker) run
  first in each worker's `fetch`; `_headers` at `apps/web/public/`,
  `apps/docs/public/`, `apps/coming-soon/`. Any new public host MUST wire
  one of the two mechanisms in the PR that creates it. WebSocket-upgrade
  responses pass through unwrapped (a 101 can't be re-constructed).

- **Alternatives rejected:**
  - **Zone-level "Always Use HTTPS" + HSTS settings only** — blocked on a
    console click today; also leaves enforcement outside the repo where a
    zone migration silently drops it. The toggle is still worth flipping
    (covers static-asset `http://` 200s) — it's the residual founder action.
  - **`run_worker_first = ["/*"]` on the static sites to 301 in code** —
    charges a worker invocation for every marketing/docs request, undoing
    the documented zero-cost asset path (`apps/web/wrangler.toml`).
  - **`preload`** — needs the zone-wide http→301 first and is a one-way
    door; revisit only after the zone toggle is live.
