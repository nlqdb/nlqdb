# SK-OBS-011 — Exceptions → Sentry; traces + metrics → Grafana; spans still `recordException`

- **Decision:** Error/exception triage lives in **Sentry** (5k errors/mo free); traces and metrics go to **Grafana Cloud** via OTel. The two are not redundant: spans still call `span.recordException` so the Grafana side sees the error in the trace timeline, but Sentry is the canonical exception-grouping / alerting UI.
- **Core value:** Honest latency, Simple
- **Why:** The boundary was ambiguous (DESIGN §5.4 lists both). Pinning it: Sentry is purpose-built for exception grouping, release-tracking, and noise suppression — re-deriving that in Grafana is wasted effort; OTel traces/metrics are purpose-built for latency/rates — Sentry can't show a span tree. `recordException` on spans keeps the trace self-describing without making Grafana the alerting surface. Resolved per `GLOBAL-033` (build-vs-adopt → use each tool for its job).
- **Consequence in code:** Uncaught + explicitly-captured exceptions report to Sentry; `setupTelemetry` exports spans/metrics to Grafana; the span-level `recordException` (already wired) stays. No exception-grouping logic is built on the Grafana side.
- **Alternatives rejected:**
  - **OTel-only (drop Sentry)** — Grafana error-tracking is less mature for grouping/alerting; we'd rebuild Sentry badly.
  - **Sentry-only** — loses the span tree and metric histograms OTel gives for free.
