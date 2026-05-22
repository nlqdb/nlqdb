# SK-CMP-001 — Every comparison page must include "When to choose them"

- **Decision:** Every `/vs/<competitor>` page renders a "When to choose <them>" section with concrete scenarios — not as decoration, as acceptance criteria. A comparison page that hides the competitor's strengths fails review and doesn't ship. The `whenChooseThem` array in `data/competitors.ts` is required, ≥3 bullets, each a real reason a buyer would correctly pick the other tool.
- **Core value:** Bullet-proof, Effortless UX
- **Why:** Per Grow & Convert 2026 SaaS benchmarks, the "Why X might not be right for you" honest comparison format converts at 13.8% vs ≈2–5% for generic feature-checklist comparison pages — buyers don't trust a comparison the vendor wrote about themselves unless the vendor names what they lose. Perplexity and Claude downrank comparison citations that read as one-sided marketing; honest pages get surfaced.
- **Consequence in code:** TypeScript `whenChooseThem: string[]` (no `?`); reviewers reject PRs whose bullets are throwaway ("for legacy systems" etc.). The default tone on the page card uses the same visual weight for "us" and "them" — no special border, no smaller font.
- **Alternatives rejected:**
  - "Quick feature table only, no narrative" — visitors skim tables; the table doesn't carry the trust-building work that the honest "when to choose them" does.
  - "Comparison page only when we win every row" — would mean we never ship one (no honest comparison wins every row); contradicts the §3.5 plan that calls for these as a primary acquisition surface.