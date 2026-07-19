# Blocked by Human

The single file the founder reads. Per [`GLOBAL-033`](./decisions/GLOBAL-033-resolution-defaults.md),
agents resolve value-decidable questions themselves; this file is **only** for
what a human must do — operator actions an agent can't perform (set a prod
secret, click through a console, prune a DB) and genuine money / strategy /
legal bets — or a suggestion needing human approval before it can amend the
guidelines. Keep each a very short bullet. Delete a bullet once done.

## Human actions (clicks, secrets, legal)

- **Arm the 3rd independent free-LLM pool for the opencheck agent lane —
  set repo secret `FALLBACK2_LLM_API_KEY`** (SambaNova/Cerebras/Together
  free tier; lane wired in `_e2e-opencheck.yml`, degrades to "disabled"
  while unset). **Sole** fix for scorecard row #15 (E2E freshness ≈ 0.75):
  the 2 free lanes (NIM + OpenRouter `:free`) flap intrinsically, so a
  2-lane walk can't stay green (run 70). **Blocked ~6 days** (since ~07-13;
  history in `weekly-review.md`).

- **Apply pending D1 migrations (`0022` `gtm_snapshots`, `0023`
  `synthetic_traffic_flag`, `0024` `databases.source_json`, `0025`
  `pmf_survey`) to the prod control-plane D1 at the next deploy**
  (`wrangler d1 migrations apply`). Added by the GTM-metrics dashboard +
  first-touch attribution + in-product Sean-Ellis survey
  ([GLOBAL-038](./decisions/GLOBAL-038-gtm-pmf-instrumentation.md),
  `SK-GTM-005`/`SK-GTM-006`/`SK-GTM-007`); until applied,
  `GET /v1/admin/metrics` snapshot/trend reads, the Sean-Ellis survey
  routes, and create-path source writes error / fail (some logged,
  non-fatal) in prod (tables won't exist). Operator-only (prod
  credentials).

- **Fire the launch sequence** — the founder-only half of
  [`docs/research/launch-kit.md`](./research/launch-kit.md): pick the angle
  (§2; GLOBAL-036 says lead with analytical agent memory), write the Show
  HN post + first comment in your own voice from the §3.1 fact sheet
  (never agent copy — the r/SQL lesson), soft-launch lobste.rs/r/SideProject
  first, then Show HN Tue–Thu morning, Product Hunt ≥ 1 week later
  (account-walled). Attribution (#745) is merged, so every visit is
  attributable; apply the migrations bullet above first. nlqdb has never
  launched anywhere; this is the highest-yield untaken acquisition action.

## Suggestions needing approval (to amend the guidelines)

_None open._
