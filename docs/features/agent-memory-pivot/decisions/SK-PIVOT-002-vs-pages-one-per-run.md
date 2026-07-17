# SK-PIVOT-002 — Memory-competitor pages reuse the existing comparison machinery, one per run

- **Decision:** Zep, Letta, and LangMem each get a `/vs` page by adding one
  `Competitor` entry to `competitors.ts` (persona `P2 agent builder`),
  **one competitor per daily run**, each anchored in `docs/competitors.md`
  first.
- **Core value:** Simple, Goal-first
- **Why:** The machinery is already static + one-file-per-competitor
  (`SK-CMP-002`); one competitor per run keeps each diff reviewable and each a
  distribution artifact.
- **Consequence in code:** Per entry: real MCP tool names only,
  `whenChooseThem`/`whenChooseUs` ≤ 16 words, `feature` rows verifiable today,
  FAQ names the competitor. Update slug lists in `scripts/verify-flows.sh` +
  `tools/stranger-test/`.
- **Alternatives rejected:** One mega-PR for all three — unreviewable, wastes
  three runs' artifacts. · Skip the `competitors.md` anchor — ships an
  un-vetted claim.
