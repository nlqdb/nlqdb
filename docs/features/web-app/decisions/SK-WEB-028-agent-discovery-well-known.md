# SK-WEB-028 — Machine-discovery surfaces: `.well-known` catalogs, `/auth.md`, Content-Signal, homepage Link header

- **Decision:** The marketing host publishes one unit of static
  machine-discovery surfaces for agents that land on `nlqdb.com`:
  `/.well-known/api-catalog` (RFC 9727 linkset, advertised from `/` by a
  `Link: rel="api-catalog"` + `rel="service-doc"` header in
  `public/_headers`), `/.well-known/ai-catalog.json` carrying the MCP
  Server Card **inline** (SEP-2127 draft), `/.well-known/agent-skills/index.json`
  (Cloudflare Agent Skills Discovery RFC v0.2.0) indexing the two served
  skills with sha256 digests true for the served bytes, `/auth.md`
  (workos/auth.md convention), and a
  `Content-Signal: search=yes, ai-input=yes, ai-train=yes` line in **every**
  robots.txt group on both public hosts (signals attach per group, like the
  repeated Disallows). Three constraints ARE the decision:
  1. **No hand-typed values.** Every endpoint, name, version and digest
     derives from its source of truth — `lib/mcp-install.ts`,
     `packages/mcp/package.json` `mcpName`, `apps/mcp`'s runtime
     `SERVICE_VERSION` (what a connected client observes in `serverInfo`,
     not the npm version), the SKILL.md bytes — pinned by
     `src/lib/agent-discovery.test.ts`.
  2. **Pre-standard formats are date-pinned.** The Server Card and
     agent-skills schemas are drafts, pinned as verified 2026-08-04;
     re-verify the spec before reshaping. SEP-2127's current draft rejects
     the earlier `/.well-known/mcp/server-card.json` placement and omits
     tool enumeration — the card lists **no tools**; runtime `tools/list`
     is canonical.
  3. **Only live capability is promised.** No `service-desc` while no
     OpenAPI document is served (docs-site slice d is Parked); no WorkOS
     `agent_auth` block while no agent self-registration endpoint exists;
     `/auth.md` names `sk_mcp_`, never `sk_live_` (SK-APIKEYS-015).
- **Core value:** Goal-first, Bullet-proof (only-promise-what-is-live), Free
- **Why:** The reach thesis (`SK-PIVOT-015`) is a coding agent finding nlqdb
  and connecting in one command; these files are the programmatic front door
  for an agent that lands on the domain instead of the HTML (Cloudflare's
  Agent Readiness checker scored nlqdb.com 21/100 without them). The
  Content-Signal line exists because Cloudflare's *managed* robots.txt was
  force-declaring `ai-train=no` above our AI-permissive file until the
  founder disabled it at the zone (2026-08-04) — the preference must be ours,
  in git.
- **Consequence in code:**
  `apps/web/public/{.well-known/**,auth.md,_headers,robots.txt}` +
  `apps/docs/public/robots.txt` (mirror per `SK-DOCS-005`). Editing a
  SKILL.md requires re-hashing the index entry; bumping `apps/mcp`'s
  `SERVICE_VERSION` requires updating the card — the drift test fails the
  build otherwise, never a reader.
- **Alternatives rejected:**
  - **`/.well-known/mcp/server-card.json` with a tools list** — the
    superseded SEP-1649 shape; the current draft explicitly rejects both the
    placement and the enumeration.
  - **Build-time generation (Astro endpoint / integration)** — more moving
    parts for documents that change rarely; static files + drift pins give
    the same no-drift guarantee with zero build machinery.
  - **DNS-AID, WebMCP, OIDC issuer metadata** — founder-gated DNS console
    action with near-zero resolver adoption; browser-preview API with no
    agent traffic; and nlqdb.com is not an OIDC issuer — publishing issuer
    metadata would violate constraint 3.
