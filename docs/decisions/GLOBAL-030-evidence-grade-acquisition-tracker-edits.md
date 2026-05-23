# GLOBAL-030 — Evidence-grade acquisition tracker edits

- **Decision:** Any change to `docs/research/automated-icp-validation-plan.md` or its verification mirror that adds or changes acquisition evidence, KPI status, flow status, or progress claims must be backed by an agent-run verification artifact, keep both trackers synced when a `FLOW-NNN` is involved, and include a self-review before merge.

- **Core value:** Bullet-proof, Honest latency, Goal-first

- **Why:** The acquisition tracker is the product's progress bar for finding users, not a generic planning note. If it records an unverified claim as fact, future agents will optimize against bad evidence and repeat work that already failed. Evidence needs to say what was attempted, how it was attempted, what surface was exercised, what failed or passed, and which claims remain unverified. The verification mirror exists because implementation status and user-visible proof are different axes; this decision makes that distinction mandatory whenever the tracker changes.

- **Consequence in code:** PRs that touch either acquisition tracker must run the mirror integrity check, update the implementation tracker and verification mirror together for `FLOW-NNN` changes, append the relevant progress or outcome row, and self-review the change for scalability, performance, reusability, user experience, developer experience, error handling, non-spammy observability, security, robustness, web-researched best practices, minimal comments, and doc sync. Evidence rows must identify whether the result came from deployed-surface verification, local tests, environment inspection, or documentation/code inspection; unsupported claims stay explicitly marked as unverified.

- **Alternatives rejected:** Treat tracker edits like ordinary docs (too easy to turn evidence into optimistic prose); put review rules only in PR templates (not canonical and easy to skip); require a typed schema before any tracker edit (over-engineered while the tracker is still under 15 flows and mostly human-readable markdown).
