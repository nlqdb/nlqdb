# SK-MCP-007 — Streamable-HTTP (hosted) and stdio (local) — same `/v1/ask` orchestration

- **Decision:** The hosted transport speaks Streamable-HTTP (per the MCP spec); the local transport speaks stdio to the host process. Both terminate at the same `/v1/ask` orchestration in the API. Neither transport holds DB credentials; neither bypasses the validator.
- **Core value:** Bullet-proof, Simple
- **Why:** Two transports with two orchestration paths would drift — bug fixes on one wouldn't cover the other, and the validator (the security boundary) would have two surfaces to harden. One orchestration with two transport adapters keeps the security review small and the behaviour parity (`GLOBAL-002`) honest.
- **Consequence in code:** `packages/mcp/` factors out a transport-agnostic `handleTool(name, args, ctx)` core; transport adapters (`streamable-http.ts`, `stdio.ts`) are thin shims over it. The API request shape is identical regardless of transport.
- **Alternatives rejected:**
  - Hosted-only orchestration with local going through a different shim — two attack surfaces, two parsers.
  - Direct DB access from the local transport — explicitly rejected by `SK-MCP-005`.
