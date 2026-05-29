# SK-LLM-011 — Self-host the cheap-tier router once we hit ~50 k queries/day

- **Decision:** When traffic crosses ~50 k queries/day, we self-host the cheap-tier `route` (and `engine_classify`) calls on a single A10G on Modal (quantized 8B Llama). Cost: ~$200/mo flat. Plan and hard tiers stay on hosted providers indefinitely.
- **Core value:** Free, Bullet-proof, Open source
- **Why:** At ~50 k queries/day, cheap-tier hosted cost crosses the flat-Modal threshold. Self-hosting turns a per-call cost into a fixed cost and removes an external dependency from the hottest path. Plan-tier compute is too uneven to self-host economically — we stay on hosted providers there.
- **Consequence in code:** Provider implementation `modal_llama8b` already lands behind a feature flag; flipping the flag rolls `route` traffic over. Failover chain stays Groq → Modal → Workers-AI so a Modal outage doesn't degrade routing accuracy. The 50k/day threshold is dashboard-monitored.
- **Alternatives rejected:** Self-host plan tier — bursty plan workloads cost more on flat A10G than on per-call paid. Stay on hosted forever — once we hit 200k/day cheap-tier cost crosses $1k/mo.
