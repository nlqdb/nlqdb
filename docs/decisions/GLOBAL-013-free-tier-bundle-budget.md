# GLOBAL-013 — $0/month for the free tier; Workers free-tier bundle ≤ 3 MiB compressed

- **Decision:** The free tier runs on Cloudflare Workers free plan,
  Neon free plan, and other zero-cost services. The deployed Worker
  bundle stays under 3 MiB compressed (Cloudflare's hard limit on the
  free plan is 3 MiB, paid is 10 MiB).
- **Core value:** Free, Bullet-proof
- **Why:** "Free forever" is the activation hook. If our infra cost
  per free user is non-zero, the runway turns into a wall. The 3 MiB
  ceiling is a real constraint that shapes dependency choices.
- **Consequence in code:** Every dependency is checked against bundle
  budget before adoption (`bun run build && wrangler deploy --dry-run`).
  Heavy deps (parsers, big crypto libs, full AI SDKs) are forbidden
  on the Workers path; equivalent functionality goes through HTTP
  to a cheaper backend or via tree-shakable submodules.
- **Alternatives rejected:**
  - "Free trial" with a card — kills activation.
  - Bigger bundle with paid plan default — locks us out of the
    Workers free plan, which is the actual product story.
