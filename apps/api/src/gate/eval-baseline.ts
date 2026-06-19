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
// 2026-06-19 — first canonical BIRD re-run since the directive/pruner levers
// T20–T22 merged (join-bridge recall SK-LLM-037 rev, HAVING directive
// SK-LLM-040): raw EX 0.522 → 0.520 (260/500), `no_sql` 3 → 1. The diff vs the
// 2026-06-12 baseline is statistically flat — McNemar b=38 / c=37, p=0.50, no
// regression triggered — so the prompt-directive levers have saturated on BIRD;
// the path to the gate floor is the §4 retrieval levers (value-retrieval first).
// Resumed across 3 quota windows per SK-QUAL-013. Spider unchanged (not re-run).
// Both lanes remain below target ⇒ gate stays closed.

export type EvalBaseline = {
  bird_accuracy: number | null;
  spider_accuracy: number | null;
  bird_target: number;
  spider_target: number;
  measured_at: string;
};

export const EVAL_BASELINE = {
  bird_accuracy: 0.52,
  spider_accuracy: 0.1852,
  bird_target: 0.65,
  spider_target: 0.75,
  measured_at: "2026-06-19T03:08:58.665Z",
} as const satisfies EvalBaseline;
