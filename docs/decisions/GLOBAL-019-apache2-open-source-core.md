# GLOBAL-019 — Free + Open Source core (FSL-1.1-ALv2 → Apache-2.0); Cloud is convenience, not a moat

- **Decision:** The core engine, CLI, MCP, SDKs, elements, and
  reference implementations are licensed **FSL-1.1-ALv2** —
  source-available for any non-competing use, auto-converting to
  Apache-2.0 two years after each release (the Sentry/Convex pattern).
  The hosted Cloud offering exists for convenience (zero-config,
  managed) — it is not a moat. Anyone can self-host for non-competing use.
- **Core value:** Free, Open source
- **Why:** "Open core" with a closed Cloud-only feature set destroys
  trust and limits the contributor base. The OSS-first stance is the
  reason the developer audience picks us; if Cloud were the moat we'd
  be a different product. Cloud earns its keep by being effortless,
  not by being the only option.
- **Consequence in code:** No Cloud-only features in the critical
  path. Every API the Cloud uses is documented and reachable from a
  self-host. License headers stay FSL-1.1-ALv2. PRs that introduce
  hard Cloud-only paths require explicit re-architecture to keep the
  self-host viable.
- **Alternatives rejected:**
  - Open-core with proprietary advanced features — fragments the
    audience and shrinks the contributor pool.
  - AGPL — incompatible with the embedded-SDK story.
