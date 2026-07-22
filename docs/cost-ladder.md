# Cost ladder — pay only when someone pays you

Operational cost-control policy. Canonical home for the
"**$0/month while there are no paying customers**" rule, the operational
companion to [`GLOBAL-013`](./decisions/GLOBAL-013-free-tier-bundle-budget.md)
(free-tier bundle budget) and the [`phase-plan.md §6`](./phase-plan.md)
monetization trigger. Unit-economics detail lives in
[`architecture.md §8`](./architecture.md).

> Kept out of the public `README.md` on purpose — this is internal ops
> guidance, not the project's front door. Docs that need the rule link
> here.

## The rule

**$0/month while there are no paying customers.** Then add only what is
strictly forced by traffic or contractual need. Every line below is gated
on a real signal — **don't upgrade pre-emptively.**

**No measurement-infra exception** (founder-resolved 2026-07-22): a small
paid budget (~$30–50/mo for a stable third eval lane + a frontier API key,
to un-dark scorecard rows #11/#15) was advisor-proposed and rejected the
same day. Dark metrics wait for a $0 path or for revenue — don't re-raise
paid options as fixes.

## Today: $0/month

*(+ ~$85/yr unavoidable for the two domain renewals)*

- Cloudflare Free plan — both zones
- Workers / KV / D1 / R2 / Queues / Workers AI — free tier limits
- Neon — 0.5 GB free, scale-to-zero
- Upstash Redis — free tier
- LLM inference — Gemini + Groq + OpenRouter + Workers AI free tiers; Ollama for dev
- Sentry / Grafana Cloud / Resend / LogSnag — free tiers
- GitHub — free org

## Triggered by the first paying client (transaction-fee only, no monthly)

- Stripe live mode — only the per-transaction fee on real revenue
- Stripe Tax — 0.5% per live transaction

## Triggered by specific events (only when the event actually happens)

| Trigger | Upgrade | Monthly cost |
|---|---|---|
| Sustained L7 attack the free WAF can't classify | Cloudflare Pro | $25 |
| Neon DB exceeds 0.5 GB or needs no-pause | Neon Launch | $19 |
| > 3k emails/mo (≈ 100 signups/day) | Resend Pro | $20 |
| > 5k errors/mo | Sentry Team | $26 |
| > 2.5k product events/mo | LogSnag paid | $10 |
| > 100k Worker requests/day | Workers Paid | $5 |
| LLM bills exceed startup credits | Anthropic / OpenAI direct | variable |
| Usage metering needed (Phase 2 paid users) | Lago + Listmonk on 1 Fly Machine | ~$5 |

The point: every line above is gated on a real signal.
[`architecture.md §8`](./architecture.md) has the full unit-economics model.
