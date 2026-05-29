# SK-LLM-007 — Tier-aware chain selector: `priority` + user plan picks `free` vs `paid` chain

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Sharded out
unchanged to keep that doc under the 20 KB cap per `CLAUDE.md` §2 D4 —
this body is verbatim, only the location moved.

- **Decision:** Once paid keys land, the router gains a chain selector with `chains: {free: ProviderName[]; paid: ProviderName[]}`. Per request, the router picks `paid` when (`request.priority === 'high'`) or (user's plan = paid); otherwise `free`. Paid users default to `high`; `/v1/health` and similar low-stakes paths default to `low`.
- **Core value:** Free, Honest latency, Goal-first
- **Why:** Paid users buy quality — they should never silently route through a free 70%-accurate model on plan generation. Free users get the strict-$0 chain, which their plan caches absorb most of the latency cost of. The `priority` hint lets the surfaces signal intent (chat = high; CI probe = low) so a noisy CI doesn't burn paid credits.
- **Consequence in code:** `LLMRouterOptions.chains` is a `{free, paid}` object. `chooseChain(request)` is a pure function tested in isolation. `LLM_CHAIN_PLAN_FREE` and `LLM_CHAIN_PLAN_PAID` env vars override the defaults. The CLI's `nlq ask` carries the priority hint via the request body (`nlq run` skips the router entirely — it's the raw-SQL escape hatch).
- **Alternatives rejected:** One chain everyone shares — paid users subsidise free users with their dollars buying free-model accuracy. Per-user explicit chain config — operator footgun; users don't know what to pick.
