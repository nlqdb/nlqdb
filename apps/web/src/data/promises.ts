// Curated trust-beats for the homepage's "Promises" component. Each
// promise is a label + one-sentence "what it means" + pointer to the
// canonical decision ID. Bodies live in `docs/decisions.md` (GLOBAL-NNN)
// and `.claude/skills/<feature>/SKILL.md` (SK-*-NNN); this file
// duplicates none of them — labels and one-liners only, per P3
// (single-source-of-truth) in CLAUDE.md §2.

export type Promise = {
  // Short trust beat, ~3-7 words. Front-loaded with the noun.
  label: string;
  // One sentence. What the promise means in concrete terms — never
  // marketing fluff. Specific behaviour, not vibes.
  what: string;
  // Canonical decision ID. The ID is the link target; body text
  // lives at the canonical home, never here.
  source: string;
};

export const PROMISES: Promise[] = [
  {
    label: "No card for the free tier — ever.",
    what: "Not for verification, not for spam protection. Hitting a limit rate-limits with a clear message; we never silently upgrade you.",
    source: "GLOBAL-013",
  },
  {
    label: "First value before login.",
    what: "Anonymous mode is the default first-touch. The DB lives 72 h unauthenticated; sign in any time to keep it.",
    source: "GLOBAL-007",
  },
  {
    label: "Schemas only widen.",
    what: "Once a column exists in the schema fingerprint, it stays. No destructive migrations behind your back.",
    source: "GLOBAL-004",
  },
  {
    label: "Every write is idempotent.",
    what: "Pass `Idempotency-Key` on any mutation; retries return the original response byte-for-byte. Network failures don't double-charge or double-emit.",
    source: "GLOBAL-005",
  },
  {
    label: "Honest latency.",
    what: "When a request is in flight, you see the real steps (cache lookup, plan, allowlist, exec, summarize) with real timings. No spinner that hides progress.",
    source: "GLOBAL-011",
  },
  {
    label: "Errors in one sentence — with the next action.",
    what: "Every error is one readable line plus what to do. No stack traces, no `something went wrong`, no multi-paragraph debug dumps in the UI.",
    source: "GLOBAL-012",
  },
  {
    label: "Power users have an escape hatch.",
    what: "Outgrowing the conversational interface never hits a wall. `/v1/run` runs raw SQL; the LLM-generated plan is editable; the connection string is yours when you need it.",
    source: "GLOBAL-015",
  },
  {
    label: "Cancel and export in one click.",
    what: "No call, no chat, no exit survey. Cancellation is one click; export is always free; data is never held hostage.",
    source: "stripe-billing — billing constraints",
  },
];
