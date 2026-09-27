# Handoff — homepage hero → create path (work of 2026-09-14, re-verified 2026-09-27)

Re-checked against `origin/main` `e0f168f` (2026-09-27) + read-only prod queries; line numbers are current main.

## Context

Founder typed a goal in the new one-input hero (`SK-WEB-031`) → anon
`POST /v1/ask` 428'd (Turnstile) → prompt stashed, bounced to sign-in →
`/app?replay=1` → chat replay hit the create path on the free chain → 422 →
"Something went wrong — try again." Two fix agents were killed before any edit; this is the restart point.

## What landed

| PR | What | Status |
|---|---|---|
| [#1125](https://github.com/nlqdb/nlqdb/pull/1125) | One-input hero + Content ▾ nav (`SK-WEB-031`) | merged 2026-09-14 20:55Z |
| [#1126](https://github.com/nlqdb/nlqdb/pull/1126) | Preview deploys pass `--var "TURNSTILE_SECRET:"` so previews fail open (`SK-ANON-009`); sitekey-bake variant rejected | merged 2026-09-15 02:52Z |
| [#1127](https://github.com/nlqdb/nlqdb/pull/1127) | `DbCreateError → @nlqdb/errors` registry (`SK-ERR-001`); nudge allowlist gains `compile_failed` + `infer_failed/plan_invalid` (`SK-PREMIUM-004`) | merged 2026-09-15 02:53Z |

Only open PR on 2026-09-27: #1151 (KPI-1 daily, unrelated).

## What changed on main since (only what touches these paths)

- `packages/llm/src/providers/_chat-provider.ts` + `types.ts:164-177` (#1124): optional `validate` predicate on `extendSchema` makes a schema-invalid plan a `parse` `ProviderError`, so the router falls through to the next free provider. **`schemaInfer` (the create path) does not use it** — `_chat-provider.ts:113-132`. This is the seam for work item B1.
- `packages/llm/src/providers/mistral.ts`, `prompts.ts` (#1150 weekly: revive the Mistral direct tail).
- `apps/api/src/db-create/extend-schema.ts:38-49` (#1124) and `wire-error.ts` (#1127, new).
- #1129: libpg-query WASM globals — write/DDL asks stopped 500ing.
- Untouched since 09-14: `apps/web/src/lib/turnstile.ts`, `CreateForm.tsx`, `apps/api/src/{turnstile,anon-create-gate}.ts`, `apps/api/src/db-create/{build-deps,infer-schema,orchestrate,neon-provision}.ts`, `packages/llm/src/fallback-router.ts`, premium-tier FEATURE.md §"Create/DDL router scope".

## Verified findings (2026-09-14 → 2026-09-27)

1. **Hero 428 → null token → silent bounce to sign-in — CHANGED (not reproduced; code unchanged).** `solveChallenge()` (`apps/web/src/lib/turnstile.ts:81-134`) already awaits the widget `callback` with a 10 s timeout and wires `error-callback`/`timeout-callback` — but both discard the Turnstile error code (`:119-120`), so the 1–2 s null seen on 09-14 was an `error-callback` (or `render()` throw) whose cause was never captured. `CreateForm.tsx:139-144` retries once with the token and `:166-177` still redirects **every** surviving 428 to sign-in, including a signed-in visitor, because `postAskCreate` is `credentials:"omit"` (`apps/web/src/lib/api.ts:104-114`, `SK-ANON-001`). Prod evidence now: **0 × 428 on `/v1/ask` in the last 14 days** (2026-09-13→27) across ~150 anon creates by the real-Chromium stranger-test walker, and one **non-synthetic anon hero create succeeded on prod 2026-09-16 20:39Z** (`databases.source_surface='hero'`). Widget `nlqdb-anon`: `invisible`, domains `app.nlqdb.com` + `nlqdb.com`, unchanged since 2026-07-16. Human sample ≈ 1 browser hit, so the 09-14 failure is neither confirmed nor ruled out — treat as intermittent/client-specific until A1 reproduces it.
2. **Anon hero create dead ≥ 9 days pre-merge — CHANGED.** Prod 7-day `/v1/ask` (2026-09-20→27): 200 × 114, 204 × 21, 401 × 14, 422 × 17, 409 × 6, 503 × 2, 502 × 1, 400 × 1, 404 × 2, **428 × 0**. Non-walker (`Mozilla/*`) hits: 1 × 200, 2 × 404. Non-synthetic `databases` rows since 09-05: 09-15 (user, chat), 09-16 (anon, **hero**), 09-24 (user, chat). The path works at least sometimes; the 09-14 "dead" reading came from a window with no successful human create.
3. **Paid lane falls back at the classifier; create runs on free chain and 422s — STILL TRUE (structure), root cause not investigated.** `withFallbackRouter(buildPremiumRouter(...))` + `premium_dispatch_fallback` warn: `apps/api/src/index.ts:1195-1226`; authed `kind=create` + no pin → `runCreatePath()` `:1461`, zero-DB fallback `:1474`. `plan_invalid` = `SchemaPlanSchema.safeParse` fails at `apps/api/src/db-create/infer-schema.ts:147-156`; still **no repair round and no provider fallthrough** on the create path. `byollm:network` = `ProviderError` reason on a fetch **rejection** (`packages/llm/src/providers/openai-compatible.ts:139`; timeouts classify `timeout` at `:138`). `transaction_failed` is the infra catch-all at `apps/api/src/db-create/neon-provision.ts:396-403` (`rolled_back: true` via `orchestrate.ts:317`). Prod 7-day: 17 × 422 on `/v1/ask`, all from the walker UA — consistent with `infer_failed` still firing on ordinary goals (bodies not logged, see 7).
4. **Legacy `{error:{kind,reason}}` envelope → `unknown_error` → generic copy; nudge never fires — FIXED by #1127.** `formatCreateJsonResponse` now returns `errorResponse(c, createWireError(result.error))` (`apps/api/src/index.ts:943-946`, `apps/api/src/db-create/wire-error.ts`); `apps/web/src/components/chat/error-message.ts:24-36` passes the registry sentence + action through; `apps/web/src/lib/api.ts:172` maps `infer_failed` → `goal_unclear` on the hero. Nudge gate `apps/web/src/components/chat/free-model-nudge-gate.ts:31-36,64`: `compile_failed` and `infer_failed`+`reason:plan_invalid` fire; `ambiguous_goal` deliberately excluded.
5. **Create path never uses the paid lane — STILL TRUE, by decision.** `apps/api/src/db-create/build-deps.ts:80` `llm: getLLMRouter()`; `wire-error.ts:3-5` hard-codes `lane: "free"` on it; canonical text is `docs/features/premium-tier/FEATURE.md:203` ("Create/DDL router scope — Resolved (GLOBAL-033)"). The 09-14 replay (`a customer CRM`, paid Sonnet plan) therefore ran inference on the free chain even had the premium lane been healthy.
6. **`GET app.nlqdb.com/auth/sign-in/null` 404s — NOT LOCATED (unverified).** No `href`/`src`/`new URL()` in `sign-in.astro`, `post-signin.astro`, `lib/handoff.ts` or `Topnav.astro` yields a `null` segment; `buildSignInUrl` (`apps/api/src/index.ts:4620-4640`) is referer-guarded. Low priority; pull the request's referer + UA from Workers Logs first.
7. **Observability blind spots — STILL TRUE.** Preview versions: Workers Logs returned 0 events on 09-14 (not re-tested). Grafana/OTel span access: not re-tested. The 422 body is still not logged (`errorResponse` emits no structured line with `code`/`reason`); the walker's 17 × 422 could not be attributed without it.

## Work queue

**A — Turnstile / hero honesty (`apps/web`; GLOBAL-025 onboarding + UX; §6.1 row: none — the hero is END_GOAL happy-path row 9, not a rateme12 gate). Branch `claude/gracious-hawking-grmnnw-turnstile`.**
- A1. Reproduce with real Chromium (`/opt/pw-browsers/chromium`, no `playwright install`) against `https://nlqdb.com` hero; capture the `error-callback` code. Also try Firefox/Windows + privacy extensions (the only human hit in the window). Accept: the code, or "not reproducible in N runs", in the PR body.
- A2. `turnstile.ts:119-120`: keep the error code (span/`console.warn` `{msg:"turnstile_client_error", code}`) and add `expired-callback`. No fail-open, no config change.
- A3. `CreateForm.tsx:166-177`: on a 428 that survives the retry, a signed-in visitor (cookie session present — `lib/session.ts`) retries **with credentials** instead of bouncing to sign-in; a signed-out visitor sees an honest inline error ("couldn't verify your browser — sign in to continue" + the sign-in link) rather than a silent redirect (P6). Accept: `bun test apps/web` covers both branches; FLOW-001 walker (`tools/stranger-test/src/flows/flow-001.ts`, `scripts/stranger-test.sh`) still `ok`.

**B — Create engine (`apps/api`, `packages/llm`; GLOBAL-025 engine quality + UX; §6.1 row R2 "headless hosted-DB create from a goal" is the nearest owner — name it and say "adjacent"). Branch `claude/gracious-hawking-grmnnw-create-lane`.**
- B1. Reuse #1124's seam: pass `validate: (p) => SchemaPlanSchema.safeParse(p).success` from `infer-schema.ts:127` into `schemaInfer` and honour it in `_chat-provider.ts:113-132` exactly as `extendSchema` does, so a `plan_invalid` head plan falls through to the next free provider before 422ing. Then ONE repair round that feeds the Zod issue paths (not the client) back to the model. Accept: 10-goal regression set (todo, CRM, habit tracker, invoices, blog, inventory, bookings, recipes, expense tracker, job board) ≥ 9/10 `200` on the free chain in a preview walk; p95 create latency stays inside `SK-HDC-010`'s 30 s DDL statement timeout (no separate create-latency SLO exists — record one in `hosted-db-create/FEATURE.md` if B1 needs it, D1).
- B2. Root-cause `byollm:network` on the hosted-premium Sonnet lane: `index.ts:1218-1223` already logs `err.message` — read it on prod, then diff AI Gateway URL / `AI_GATEWAY_TOKEN` / fetch opts against the working BYOLLM lane (`packages/llm/src/byollm-dispatch.ts:107-120`). Accept: a paid prod ask shows no fallback, or a named cause + fix.
- B3. `provision_failed/transaction_failed (rolled_back)` at 14.6 s on preview: Neon cold start (`SK-HDC-014` keep-warm) vs the `SK-HDC-012` transaction; put SQLSTATE/`e.message` on the span (`neon-provision.ts:220-230`). Accept: cause named; retry-once only for a cold start.
- B4. Only after the decision below: create runs on the principal's paid lane when present, metered like premium asks (`index.ts:1185-1226` pattern), `wire-error.ts` lane becomes dynamic, `SK-PREMIUM-004` nudge then honest for premium users.

## Decisions to make (founder)

1. **Reverse the create-lane scope?** `docs/features/premium-tier/FEATURE.md:203` resolves under `GLOBAL-033` that the `model` preset is query-path only. Reversal argument: a paying user's first create is the highest-stakes LLM call in the product and today it silently runs on the free chain (finding 5) with no repair (finding 3). Cost argument for keeping it: one-shot, and B1 may lift the free chain enough. If reversed: rewrite that bullet (canonical home) + note in `GLOBAL-033`'s index row if its ladder changes; B4 follows.
2. **Nudge allowlist** — decided in #1127 (`plan_invalid` + `compile_failed` in, `ambiguous_goal` out). Only revisit if decision 1 flips.

## Founder actions

- None required for A2/A3/B1–B3. If A1 shows a hostname/mode error: widget `nlqdb-anon` currently allows `app.nlqdb.com`, `nlqdb.com` only (subdomains inherit); any change is a Cloudflare dashboard action, recorded in `docs/history/founder-actions-log.md`.
- B2 may need `AI_GATEWAY_*` / `PREMIUM_ANTHROPIC_API_KEY` verification on prod (`wrangler secret list`).
- Grafana instance access for the OTel spans (finding 7).

## Blind spots

- Preview versions: 0 Workers Logs events on 09-14; use `wrangler tail --version-id` before trusting a preview walk.
- 422 bodies are not logged on prod; add one structured line at `errorResponse` with `code` + `params.reason` (no goal text — GLOBAL-012) so finding 3's prod rate becomes measurable.
- Human traffic ≈ 0 (1 browser `/v1/ask` hit in 7 days); prod numbers are walker-dominated. Always filter D1 on `synthetic=0`.

## How to verify on prod (read-only, `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`)

- **428 → 200 ratio:** `POST /accounts/{id}/workers/observability/telemetry/query`, dataset `cloudflare-workers`, filters `$workers.scriptName=nlqdb-api`, `$workers.event.path=/v1/ask`, `$metadata.type=cf-worker-event`; groupBy `$workers.event.response.status` (+ `…request.headers.user-agent` to split walker vs human). Target: 428 stays 0 **and** human 200s > 0.
- **New hero DB:** D1 `98767eb0-…` (`apps/api/wrangler.toml:62-66`), `SELECT datetime(max(created_at),'unixepoch') FROM databases WHERE synthetic=0 AND source_surface='hero'` — baseline 2026-09-16 20:39Z.
- **End to end:** `scripts/stranger-test.sh` FLOW-001 against `https://nlqdb.com` (real Chromium; scores a bare 428 as `blocked`).
