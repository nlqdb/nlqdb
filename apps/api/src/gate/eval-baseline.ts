// Canonical eval-baseline source. The `quality-eval` run PRs
// updates to this file when a fresh BIRD/Spider run lands; there is no
// runtime KV/D1 read for these values (`SK-GATE-001`).
//
// 2026-06-12 — first complete 6-provider canonical runs (BIRD 500-q +
// Spider 135-q GHA dispatches, sequential, resumed across quota windows
// per `SK-QUAL-013`): BIRD raw EX 0.522 (261/500, chain-exhaustion
// `no_sql` 3 vs the 2026-05-18 baseline's 51), Spider raw EX 0.1704
// (23/135; its remaining `no_sql` 36 are `gemini:http_4xx` +
// `mistral:network` errors — not rate-limit walls and not a size problem
// (every SQLite-subset schema ≤ ~1,880 tok, offline-measured 2026-06-13;
// the "oversized-DDL" read was wrong) — see `quality-score-source-of-truth.md` §2).
//
// 2026-06-17 — Spider re-run after the shared `GEMINI_API_KEY` free-tier key
// was restored (SK-LLM-039): raw EX 0.1704 → 0.1852 (25/135), `no_sql` 36 → 9.
// The residual 9 are capacity-only (`circuit_open` across providers +
// `mistral:network` + `workers-ai:parse`); `gemini:http_4xx` / `auth_denied`
// are gone — Gemini now answers, failing only on the shared rate-limit walls.
//
// 2026-06-18 — BIRD re-run on the T21 SHA (join-bridge recall, SK-LLM-037 rev),
// the first canonical BIRD eval since 2026-06-12 — validates T21 + the
// accumulated levers (SK-LLM-038/039, SK-ASK-022) against real EX: raw EX
// 0.522 → 0.526 (263/500), `no_sql` 3 → 0 (full chain capacity — Gemini heal),
// mismatch 236 unchanged, exec_error 1. In-report McNemar b=26/c=28, p=1 — the
// +0.004 is within run noise, but the run is regression-free (`regressions: []`)
// ⇒ the levers held and capacity is healthy. mismatch is flat ⇒ the bottleneck
// is squarely SQL reasoning, not availability (quality-score-source-of-truth §2).
// Both lanes remain below target ⇒ gate stays closed.

export type EvalBaseline = {
  bird_accuracy: number | null;
  spider_accuracy: number | null;
  bird_target: number;
  spider_target: number;
  measured_at: string;
};

export const EVAL_BASELINE = {
  bird_accuracy: 0.526,
  spider_accuracy: 0.1852,
  bird_target: 0.65,
  spider_target: 0.75,
  measured_at: "2026-06-18T03:17:34.707Z",
} as const satisfies EvalBaseline;
