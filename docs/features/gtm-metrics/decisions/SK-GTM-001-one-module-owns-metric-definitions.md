# SK-GTM-001 — One module owns the metric definitions, including the internal-email split

- **Decision:** Every GTM/PMF metric is defined once, in
  `apps/api/src/admin/gtm-metrics.ts` (`computeGtmMetrics`), reading only
  the control-plane D1. The **population split is part of the metric**:
  every headline number reports real strangers separately from
  founder/test accounts, via the `INTERNAL_EMAIL` patterns
  (`omer@salfati.group`, `omer.hochman@*`, `*@nlqdb.com`, `*@example.com`,
  `*@preview.dev`). Metric set v1 (full shape = the `GtmMetrics` type):
  signups, anon funnel, activation (`SK-ONBOARD-006`'s first-10 counters),
  retention (7d/30d + retained ≥ 7 days after signup), PMF proxies
  (`premium_interest`, paying `customers`, Sean-Ellis gate runnable once ≥
  10 activated real strangers).
- **Core value:** Simple, Bullet-proof
- **Why:** The scorecard's "most active user is your test suite" lesson:
  a metric that doesn't name its population measures your robots. The
  exclusion list lived in prose (scorecard row #2), re-typed per pull; one
  canonical home stops the dashboard, loops, and scorecard drifting apart.
- **Consequence in code:** New metrics land as additive fields in
  `computeGtmMetrics` (never repurpose a field), with the
  stranger/internal split wherever a `user.email` join exists. Reviewers
  reject GTM SQL re-derived elsewhere (loops/scorecard read the
  endpoint). Timestamp units are normalized here — `user.createdAt` TEXT
  ISO-8601, `databases.*` unixepoch seconds, `chat_message.created_at` ms
  — callers never see the mismatch.
- **Alternatives rejected:**
  - Per-surface SQL — guaranteed definition drift; the hand-pull status
    quo.
  - Excluding internal accounts at write time — destroys the ops/debug
    value of raw rows; read-time filtering is reversible.
