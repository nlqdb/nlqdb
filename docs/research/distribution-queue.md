# Distribution queue

One publishable artifact drafted per day by the daily agent
([`/daily`](../../.claude/commands/daily.md) step 3); the founder reviews and
publishes at the weekly session. Newest first. Delete an entry once published
(the live URL goes into `docs/scorecard.md`).

## 2026-06-13 — Show HN draft

**Title:** Show HN: nlqdb – HTML components that query a database in plain English

**Body:**

> I'm building nlqdb: you write HTML, each component asks for what it wants in
> plain English, and nlqdb answers — there's no backend to write. A
> `<nlq-data>` element (or the React/Vue/Svelte/etc. wrapper) carries a prompt
> like "the five most recent orders with customer names"; the service plans
> the SQL against your schema, validates it against a read-allowlist, runs it,
> and streams the rows back.
>
> The part I think is technically interesting: it runs on a chain of *free*
> LLMs (Cerebras, Gemini, Groq, Workers AI…), and the bet is that scaffolding
> — schema pruning, plan caching, structured-output fallbacks — compounds with
> the model, so being great on free models makes it invincible on frontier
> ones. Current honest numbers on that bet: BIRD execution accuracy 52.2%,
> Spider 17% (the Spider gap is mostly oversized-DDL handling, being worked).
> You can also bring your own LLM key (any tier, 0% markup) — it rides
> Cloudflare AI Gateway with the key sealed in an AES-256-GCM envelope.
>
> It's pre-alpha behind an invite gate, but the waitlist auto-invites
> instantly (weekly-capped to protect the free-LLM quota), so you can try it
> in under a minute: https://nlqdb.com
>
> Stack: Cloudflare Workers + D1/KV, Neon Postgres, OpenTelemetry throughout.
> BYO Postgres/ClickHouse is landing (the SSRF egress-guard work for that was
> a rabbit hole of IPv4-mapped IPv6 and decimal-encoded IPs). Happy to answer
> anything about the NL→SQL pipeline or the free-LLM routing.

*Reviewer notes: numbers sourced from `apps/api/src/gate/eval-baseline.ts`
(2026-06-12 canonical run). Verify the auto-invite valve is healthy
(scorecard #4) before posting. Best posted weekday morning US-East.*
