# Build vs Buy — alternative technologies (evaluated, not just listed)

Sharded from [`docs/architecture.md`](./architecture.md) §11 to keep the
architecture doc under the 20 KB cap from
[`CLAUDE.md` §2 D4](../CLAUDE.md). Content unchanged — only the
location moved.

We lean toward tools with real APIs, generous free tiers, and no mandatory UI step. UI-first vendors are disqualified — we cannot automate them.

## Data engines

| Candidate | Verdict | Notes |
|---|---|---|
| **Postgres (Neon)** | ✅ primary | Branching, serverless, generous free tier, HTTP API. |
| **Postgres (Supabase)** | ⚠️ backup | Great DX but opinionated (auth, storage bundled). |
| **Postgres (RDS/Aurora)** | ❌ Phase 2+ at scale | Slow to provision, expensive idle. |
| **Postgres (self-hosted on Fly)** | ✅ considered | Full control, API-provisionable. Heavier operationally. |
| **SQLite (Turso / libSQL)** | ✅ edge + small DBs | Replicated, HTTP API, very cheap. |
| **ClickHouse (Tinybird)** | ✅ second engine | Free 10 GB / 1 k reads/day; Pipes = daily-reshape. |
| **Redis (Upstash)** | ✅ deferred | HTTP; counters/leaderboards. |
| **pgvector** | ✅ default vector | Stays in PG. |
| **TimescaleDB** | ✅ time-series default | PG extension — no new engine. |
| **MongoDB Atlas** | ⚠️ | Good API, tiny free tier. Prefer JSONB on PG unless must. |
| **FaunaDB** | ❌ | Vendor lock + pricing opacity. |
| **PlanetScale** | ❌ post-Vitess changes | Re-evaluate later. |

## Hosting / compute

| Candidate | Verdict | Notes |
|---|---|---|
| **Cloudflare Workers + R2 + D1** | ✅ edge + cheap egress | R2 zero egress is huge for us. |
| **Fly.io Machines** | ✅ primary long-running compute | API-first, per-second billing. |
| **Vercel** | ✅ frontend only | Not for stateful workloads. |
| **AWS** | ❌ Phase 1 | Too heavy, too slow to iterate. Revisit Phase 3 for enterprise. |
| **Modal** | ✅ LLM workers | Great Python API, scales to zero. |

## Auth

| Candidate | Verdict |
|---|---|
| **Better Auth** (TS, OSS, MIT) | ✅ chosen — see `auth/FEATURE.md` |
| **Clerk** | ❌ per-MAU pricing cliff, user-shape lock-in |
| **WorkOS AuthKit** | ⚠️ keep for enterprise SSO later |
| **Supabase Auth** | ❌ pulls in whole Supabase |

## Payments

| Candidate | Verdict |
|---|---|
| **Stripe** | ✅ default |
| **Lago** (self-hosted) | ✅ usage metering layer in front of Stripe |
| **Paddle** | ⚠️ MoR model nice for int'l; more restrictive |

## LLM providers

| Candidate | Verdict |
|---|---|
| **Anthropic (Claude)** | ✅ primary — reasoning + tool-use quality |
| **OpenAI** | ✅ fallback + cheap-small-model tier |
| **Groq / Fireworks / Together** | ✅ cheap classifier models (latency wins) |
| **Local (Llama via vLLM)** | ✅ schema-embedding + hot-path classifier once traffic justifies |
