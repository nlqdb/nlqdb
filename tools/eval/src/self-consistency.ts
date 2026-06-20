// SK-QUAL-017 — self-consistency majority vote (the §4 #3 reasoning lever).
//
// Wang et al. 2022 ("Self-Consistency Improves Chain-of-Thought Reasoning",
// arXiv:2203.11171): sample N reasoning paths, then marginalise by majority
// vote over the *answer*, not the path. For text-to-SQL the "answer" is the
// executed result set, not the SQL string — many syntactically distinct
// queries return the same correct rows, so voting on the rows captures
// agreement that string-voting would miss. The prompt-directive levers
// (T13–T22) have saturated on BIRD and the SK-QUAL-014 literal/date axes
// falsified value-retrieval standalone, so the residual loss is
// structural-reasoning mass — exactly what consensus sampling attacks
// (`docs/progress/quality-score-source-of-truth.md` §4 #3).
//
// This module is the deterministic *core* of the lever — pure, no LLM, no I/O
// — proven correct in isolation before the dispatch-bearing wiring, the same
// stage-the-primitive pattern as SK-QUAL-014 (classifier) and SK-QUAL-015
// (coverage harness). The sampling half (N plans at temperature > 0 on a
// separate code path, leaving the SK-LLM-024 greedy baseline untouched) and
// the runner integration land in the follow-on; the EX delta is measured by
// the next canonical dispatch (SK-QUAL-002).

import { fingerprintRows } from "./score.ts";

export type VoteCandidate = {
  sql: string;
  // The executed result set as positional tuples (the `.values()` shape the
  // scorer already produces). `null` when this candidate's SQL failed to
  // execute or the planner returned none — it carries no vote.
  rows: unknown[][] | null;
};

export type VoteResult = {
  // Winning candidate's SQL — the one the runner scores. Empty string when no
  // candidate executed (the runner records the underlying failure instead).
  sql: string;
  // Index of the winning candidate (the earliest member of the modal
  // cluster). -1 when nothing executed.
  index: number;
  // Votes for the winning result set.
  clusterSize: number;
  // How many candidates executed (cast a vote).
  executable: number;
  // clusterSize / executable — the share of executed samples that agreed on
  // the winning answer. A calibration signal for the SK-LLM-022 confidence
  // threshold (future); 0 when nothing executed.
  agreement: number;
};

type Cluster = { firstIndex: number; count: number };

// Majority-vote N executed candidates by the result set they produced.
// Deterministic: clusters by `fingerprintRows`, the largest cluster wins,
// ties break to the cluster containing the earliest candidate, and the
// winning SQL is that earliest candidate's — so the outcome is stable
// run-to-run regardless of the order N samples happen to come back in.
export function majorityVote(
  candidates: readonly VoteCandidate[],
  opts: { ordered?: boolean } = {},
): VoteResult {
  const ordered = opts.ordered ?? false;
  const clusters = new Map<string, Cluster>();
  let executable = 0;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c || c.rows === null) continue;
    executable++;
    const fp = fingerprintRows(c.rows, ordered);
    const existing = clusters.get(fp);
    if (existing) existing.count++;
    else clusters.set(fp, { firstIndex: i, count: 1 });
  }
  if (executable === 0) {
    return { sql: "", index: -1, clusterSize: 0, executable: 0, agreement: 0 };
  }
  let best: Cluster | undefined;
  for (const cl of clusters.values()) {
    if (
      !best ||
      cl.count > best.count ||
      (cl.count === best.count && cl.firstIndex < best.firstIndex)
    ) {
      best = cl;
    }
  }
  // biome-ignore lint/style/noNonNullAssertion: executable > 0 ⇒ ≥ 1 cluster ⇒ best is set
  const winner = best!;
  const winningCandidate = candidates[winner.firstIndex] as VoteCandidate;
  return {
    sql: winningCandidate.sql,
    index: winner.firstIndex,
    clusterSize: winner.count,
    executable,
    agreement: Math.round((winner.count / executable) * 10_000) / 10_000,
  };
}

// Offline CLI — vote over a hand-supplied set of executed candidates so an
// operator can sanity-check the consensus mechanism (and, once the sampling
// half ships, replay a dumped N-sample run) without a dispatch. Mirrors the
// `analyze-mismatches` / `column-coverage` harness CLIs.
if (import.meta.main) {
  const path = process.argv[2];
  const ordered = process.argv.includes("--ordered");
  if (!path) {
    console.error("usage: bun src/self-consistency.ts <candidates.json> [--ordered]");
    console.error('  candidates.json: [{ "sql": "...", "rows": [[...]] | null }, ...]');
    process.exit(2);
  }
  const candidates = JSON.parse(await Bun.file(path).text()) as VoteCandidate[];
  console.info(JSON.stringify(majorityVote(candidates, { ordered }), null, 2));
}
