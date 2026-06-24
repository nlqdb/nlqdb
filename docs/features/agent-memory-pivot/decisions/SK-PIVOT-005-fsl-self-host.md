# SK-PIVOT-005 — The self-host / anti-VC angle is messaged under FSL-1.1 honestly, and the container is pulled forward to make it true

- **Decision:** The open/free wedge is stated truthfully under **FSL-1.1**
  ("source-available, self-hostable for non-competing use, bring your own LLM
  key at 0% markup, no per-call fees, no pricing page") — **not** as
  "Apache-2.0, `docker compose up`" which is false today. The self-host
  container (`ghcr.io/nlqdb/api`) is pulled forward from Phase 3 so the
  self-host claim is shippable before `/agents` leads with it.
- **Core value:** Free, Open source, Honest latency
- **Why:** The "Free" moat is real leverage with the self-hosted-agent crowd,
  but the literal "Apache-2.0 + `docker compose up`" pitch over-claims: the
  license is FSL-1.1 and no image has shipped. Leading on an unshipped claim
  burns trust.
- **Consequence in code & docs:** `GLOBAL-019` + `architecture.md §0` wording
  corrected to "FSL-1.1-ALv2 → Apache-2.0" (a factual sync). `/agents`,
  `README`, and the manifesto state the self-host angle in FSL-accurate terms
  (WS-10). Pulling the container forward (WS-11) is multi-run, founder/infra-gated.
- **Alternatives rejected:** Relicense to Apache-2.0 now — reverses a
  deliberate FSL choice (a money/legal bet the founder declined). · Claim
  self-host before the image ships — over-claim.
