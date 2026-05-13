# SK-AUTH-010 — Anonymous-mode adoption is a single-row update — no conditional code paths

- **Decision:** Anonymous DBs are tied to an opaque `localStorage` token. On first sign-in, adoption is a single `UPDATE databases SET user_id = ? WHERE anon_token = ?` — there is no separate "anonymous flow" branch in any handler. Anonymous DBs live for 72 h tied to the token; if not adopted, they're swept (per `docs/runbook.md §9`).
- **Core value:** Simple, Bullet-proof, Free
- **Why:** Conditional code paths for "is the caller anonymous" multiply across every handler, and every multiplication is a chance for a path to diverge. One row write at sign-in keeps the data model uniform; the only difference between anonymous and authed is which `user_id` value the row has.
- **Consequence in code:** No `if (anonymous)` branches in `/v1/ask`, `/v1/run`, or any handler. The anonymous-token check is a thin pre-handler that looks up `anon_token → row` and otherwise treats the row exactly like an authed DB. The 72 h sweep (per `docs/runbook.md §9`) is the only anonymous-specific code.
- **Alternatives rejected:** Two parallel handler trees (anonymous vs. authed) — every handler doubles. Migrate-on-sign-in (copy rows to a "real" DB) — wastes work, breaks the 72 h continuity guarantee.
- **Source:** docs/architecture.md §4.1 · docs/runbook.md §9
