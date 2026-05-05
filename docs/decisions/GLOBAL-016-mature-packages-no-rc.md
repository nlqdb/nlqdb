# GLOBAL-016 — Reach for small mature packages before DIY; hard-pass on RC on the critical path

- **Decision:** Before writing a primitive (auth, idempotency store,
  retry logic, queue, OTel exporter), check for a small, mature,
  actively-maintained package. If one exists, adopt it. Reject any
  RC / alpha / pre-1.0 dependency on a critical path unless the
  alternative is writing it ourselves.
- **Core value:** Bullet-proof, Simple, Free
- **Why:** Small, focused libraries that have been maintained for
  years are usually more reliable than the version of the same thing
  we'd write next quarter. RCs on the critical path become tech debt
  the moment the upstream stalls — and they always stall.
- **Consequence in code:** Dependency reviews check (a) maintenance
  cadence (releases in the last 6 months), (b) ecosystem (downloads,
  issues), (c) bundle weight (`GLOBAL-013`), (d) license. Reviews
  reject pre-1.0 deps unless explicitly justified in the PR.
- **Alternatives rejected:**
  - "Write it ourselves, it'll be better" — measurably untrue across
    auth, retry, ORM, queue.
  - "Adopt the newest thing" — RC churn poisons the critical path.
