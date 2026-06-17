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
// BIRD unchanged (not re-run; Gemini wasn't its bottleneck — `no_sql` was 3).
// Both lanes remain below target ⇒ gate stays closed.

export type EvalBaseline = {
  bird_accuracy: number | null;
  spider_accuracy: number | null;
  bird_target: number;
  spider_target: number;
  measured_at: string;
};

export const EVAL_BASELINE = {
  bird_accuracy: 0.522,
  spider_accuracy: 0.1852,
  bird_target: 0.65,
  spider_target: 0.75,
  measured_at: "2026-06-17T10:48:41.851Z",
} as const satisfies EvalBaseline;
