// Single source of truth for the `/agent-memory-benchmarks` landscape page —
// a citable, honestly-annotated catalog of the agent-memory benchmarks the
// FIELD publishes. It promotes the survey blog post
// `agent-memory-benchmarks-measure-recall-not-analysis` into a standalone
// linkable asset (reach R-10 b): benchmarks earn links, product pages don't.
//
// What this is NOT: nlqdb's own cross-strategy results. That harness
// (SK-PIVOT-019 / dogfood D-07) is still blocked on the SK-PIVOT-017 corpus,
// so NO nlqdb score appears here — publishing one would break the reach hard
// rule "only promise what is live in prod." Every headline number below is a
// vendor/author self-report from a public paper, attributed to its source and
// flagged, exactly as the blog post frames them.

// Last re-verified against the cited primary sources. The page prints this so
// a reader (or crawler) can see how fresh the survey is.
export const LANDSCAPE_VERIFIED_ON = "2026-08-06";

export interface Source {
  label: string;
  url: string;
}

export interface Benchmark {
  id: string;
  name: string;
  publisher: string;
  year: string;
  venue: string;
  /** What the benchmark actually scores. */
  measures: string;
  /** Size / shape of the suite. */
  scale: string;
  /** How answers are graded. */
  grading: string;
  // Does the benchmark isolate ANALYTICAL queries — aggregation, GROUP BY,
  // ordering, joins — over the stored memory, or only end-to-end fact recall?
  // This column is the whole reason the page exists: every published
  // benchmark is `false`. If one ever ships that answers `true`, this data is
  // wrong and the test that pins "the gap is real" should fail loudly.
  isolatesAnalysis: boolean;
  source: Source;
}

// The benchmarks the field cites, oldest first.
export const BENCHMARKS: readonly Benchmark[] = [
  {
    id: "dmr",
    name: "Deep Memory Retrieval (DMR)",
    publisher: "MemGPT / Letta",
    year: "2023",
    venue: "MemGPT paper",
    measures:
      "Whether a memory system can retrieve one specific fact planted earlier in a long conversation — single-fact recall, end to end.",
    scale: "500 conversations, one target fact each.",
    grading: "Answer-correctness against the planted fact (LLM-judge).",
    isolatesAnalysis: false,
    source: { label: "arXiv:2310.08560", url: "https://arxiv.org/abs/2310.08560" },
  },
  {
    id: "locomo",
    name: "LoCoMo",
    publisher: "Snap Research",
    year: "2024",
    venue: "ACL 2024",
    measures:
      "End-to-end QA over very long multi-session dialogue: single-hop, multi-hop, temporal, and open-domain questions.",
    scale: "50 dialogues, ~300 turns over up to 35 sessions; 1,540 QA samples.",
    grading: "String-match F1 and LLM-as-judge on the final answer.",
    isolatesAnalysis: false,
    source: { label: "arXiv:2402.17753", url: "https://arxiv.org/abs/2402.17753" },
  },
  {
    id: "longmemeval",
    name: "LongMemEval",
    publisher: "Di Wu et al.",
    year: "2025",
    venue: "ICLR 2025",
    measures:
      "Five separately-scored abilities: information extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention.",
    scale: "500 curated questions embedded in scalable chat histories.",
    grading: "Per-ability answer accuracy (LLM-judge).",
    isolatesAnalysis: false,
    source: { label: "arXiv:2410.10813", url: "https://arxiv.org/abs/2410.10813" },
  },
];

export type ClaimStatus = "self-reported" | "disputed";

// The headline numbers systems advertise. `status` is load-bearing: almost
// every one is the vendor's own paper, and the two leaders dispute each
// other's methodology — so no row may claim to be independently settled.
export interface ReportedResult {
  system: string;
  benchmark: string;
  claim: string;
  reporter: string;
  status: ClaimStatus;
  source: Source;
}

export const REPORTED_RESULTS: readonly ReportedResult[] = [
  {
    system: "Mem0",
    benchmark: "LoCoMo",
    claim: "26% relative improvement in LLM-as-judge accuracy over OpenAI's memory.",
    reporter: "Mem0 (own paper, ECAI 2025)",
    status: "self-reported",
    source: { label: "arXiv:2504.19413", url: "https://arxiv.org/abs/2504.19413" },
  },
  {
    system: "Zep",
    benchmark: "Deep Memory Retrieval (DMR)",
    claim: "94.8% accuracy, above MemGPT's 93.4%.",
    reporter: "Zep (own paper)",
    status: "self-reported",
    source: { label: "arXiv:2501.13956", url: "https://arxiv.org/abs/2501.13956" },
  },
  {
    system: "Zep",
    benchmark: "LongMemEval",
    claim: "63.8%, versus 49.0% attributed to Mem0 — a comparison Mem0 disputes.",
    reporter: "Zep (own paper)",
    status: "disputed",
    source: { label: "arXiv:2501.13956", url: "https://arxiv.org/abs/2501.13956" },
  },
];

// The reproducibility reality — an independent audit of the most-cited suite.
// This is what turns "94.8%" from a settled fact into a directional one.
export interface AuditFinding {
  text: string;
}

export const LOCOMO_AUDIT: {
  intro: string;
  findings: readonly AuditFinding[];
  source: Source;
} = {
  intro:
    "The most-cited suite, LoCoMo, was independently audited in 2025 — the first neutral third-party check of any of these numbers. It does not hold up as a settled scoreboard:",
  findings: [
    {
      text: "≈6.4% of the answer key is simply wrong — 99 score-corrupting errors across 1,540 questions.",
    },
    {
      text: "The LLM judge accepts up to 63% of intentionally-wrong answers, so a high score can mean the grader is lenient, not the system accurate.",
    },
    {
      text: "The honest ceiling on the suite as published is roughly 93–94%, not 100% — reported near-perfect scores are inside the noise of a flawed key.",
    },
  ],
  source: {
    label: "Penfield Labs — “We audited LoCoMo”",
    url: "https://penfieldlabs.substack.com/p/we-audited-locomo-64-of-the-answer",
  },
};

// The gap the whole page is about. Every benchmark above grades RECALL of
// facts; none isolates ANALYSIS across them.
export const ANALYSIS_GAP = {
  heading: "The thing none of them measure: analysis over memory",
  body: [
    'Every system in the field stores facts and retrieves them. A vector store can recall "Alice has a $50k deal." What none of these benchmarks isolate — and most fuzzy fact stores structurally cannot run — is analysis over that memory: "the top 5 deals by value, grouped by stage, for enterprise accounts only." That is a GROUP BY with a HAVING and a JOIN, and a similarity index has no query planner for it.',
    "We could not find a single published benchmark that isolates analytical queries over episodic memory against vector or graph memory on identical data. The field measures recall of facts, not reasoning across them — which is why every row in the analysis column above is a ✗.",
    "There is even evidence for the gap inside LoCoMo's own results: restructuring raw dialogue into a database of assertions lifted temporal-question F1 from 21.3 to 41.9. Structure helps most exactly where LLMs are weakest.",
  ],
};

// The honest concession — required so the analytical column stays credible
// (SK-PIVOT-019 / SK-PIVOT-022: publish where a database loses).
export const DB_DOES_NOT_WIN = {
  heading: "Where a database does not win",
  body: 'A real database is not a free win everywhere. For fuzzy semantic recall over unstructured text — "find the thing I said that\'s kind of like this" — embedding similarity still beats exact SQL, and every serious system relies on it. The honest wedge is analytical memory, not memory without embeddings.',
};

// nlqdb's own eval status. NO score — the cross-strategy harness is still
// blocked on the corpus (D-07). This states the honest promise the blog makes
// and points forward, so the page never reads as an nlqdb self-report.
export const NLQDB_EVAL_STATUS = {
  heading: "What nlqdb is adding — and what we will not claim yet",
  body: [
    "We are adding an agent-memory-quality eval to the same harness we already run for text-to-SQL accuracy: four axes (retrieval precision/recall against relevance labels we define, temporal reasoning, forgetting and contradiction resolution, consolidation) plus the analytical task nobody else runs — aggregation and ordering over episodic memory, head-to-head against a vector-recall baseline on identical data.",
    "We have not published our own numbers, so none appear on this page. When they land they will be reproducible and reported honestly, including the questions where a pure-SQL store loses. Until then, treat every leaderboard number in this space — ours included — as directional.",
  ],
  blogSlug: "agent-memory-benchmarks-measure-recall-not-analysis",
};
