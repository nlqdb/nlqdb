# GLOBAL-027 — Pre-alpha access gate (SUPERSEDED 2026-07-01)

**Status: superseded — founder directive 2026-07-01. Do not reintroduce any access gate.**

- **Decision (historical):** Anonymous `/v1/ask` returned 403 until the engine cleared
  BIRD/Spider quality thresholds; a waitlist invite valve (`?invite=`) was the only
  bypass. Gate code, the waitlist, and `flow-004-walk.sh` are deleted from the tree.
- **Core value:** Honest latency (don't let strangers hit a bad engine) — historical.
- **Why superseded:** The gate blocked every acquisition flow while protecting ~0 real
  users. Founder 2026-07-01: the product is **open pre-beta**; no access gate may be
  reintroduced. References in append-only trackers/logs are historical.
- **Consequence:** No gate middleware, no waitlist, no invite valve anywhere. Quality
  risk is carried by trust UX (`GLOBAL-023`) + refuse-on-low-confidence, not by a door.
- **Alternatives rejected:** Keeping a softer gate (rate-limit-only valve) — any door
  contradicts the open-pre-beta directive and re-adds funnel friction for zero users.
