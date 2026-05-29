# SK-LLM-008 — Pro customers route only through paid / retention-off providers (data-privacy promise)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Sharded out
unchanged to keep that doc under the 20 KB cap per `CLAUDE.md` §2 D4 —
this body is verbatim, only the location moved.

- **Decision:** Free-tier providers may train on inputs (per their terms); we disclose this in our privacy policy. **Pro customers** route exclusively through paid providers configured for retention-off (Anthropic / OpenAI on their retention-off plans, Bedrock with default retention-off). This is the one meaningful free→paid capability upgrade.
- **Core value:** Bullet-proof, Free, Open source
- **Why:** "Your data trains models" is fine for the demo path (and disclosed honestly), but a non-starter for any business asking us to query real data. Hard-routing Pro through retention-off providers turns the privacy story from a footnote into a contract. It's also the cleanest justification for the upsell — you're paying for the data-privacy boundary, not just for higher accuracy.
- **Consequence in code:** `chooseChain(req)` for `plan === 'pro'` filters out any provider whose `retainsInputs === true`. Provider config carries the boolean explicitly; PRs that flip it without changing the privacy policy fail review. Tests assert no Pro request reaches a free-tier provider.
- **Alternatives rejected:** Same chain for everyone with a privacy-policy disclaimer — the policy is true for the free tier; it's not the product story we want to sell. Per-user opt-out — adds a privacy lever the user has to operate; we'd rather just hold the line.
