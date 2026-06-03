# SK-LLM-022 — Hard-plan confidence threshold = 0.75 (env-tunable)

- **Decision:** A plan is classified `hard` (the `SK-LLM-001` "hard" tier)
  when the planner's `confidence` is **below 0.75**. The threshold is a
  single env var (`HARD_PLAN_CONFIDENCE_THRESHOLD`, default `0.75`) so it
  can be tuned / A/B-tested without a deploy.
- **Core value:** Honest latency, Free
- **Why:** `SK-LLM-001` named the `hard` tier but pinned no number, and
  the premium-upsell CTA (`SK-PREMIUM-004`) fires on `hard_plan`, so the
  threshold directly drives upsell frequency — it can't stay implicit.
  0.75 leans aggressive (more plans flagged `hard` → more CTAs and more
  hosted-premium routing) on the bet that surfacing the option early,
  while keeping the free chain fully functional, converts better than a
  conservative bar; making it env-tunable means the real rate is a dial,
  not a redeploy. Resolved per `GLOBAL-033` (pin-a-number → env-tunable,
  start from the strawman the team can move).
- **Consequence in code:** The classifier reads the threshold from env
  (default `0.75`); `confidence < threshold ⇒ hard_plan = true`. The flag
  rides the route decision into both the `SK-PREMIUM-004` CTA and any
  hosted-premium routing. The number is reported alongside the
  `nlqdb.plan.confidence` metric so the chosen bar and the observed
  distribution sit side by side.
- **Alternatives rejected:**
  - **0.85 / 0.90** — fewer plans flagged `hard`; conservative upsell. Can
    be set via the env var if 0.75 proves too noisy.
  - **Hard-coded constant** — forces a redeploy to retune the upsell rate;
    the CTA frequency is exactly the kind of knob you want to A/B.
