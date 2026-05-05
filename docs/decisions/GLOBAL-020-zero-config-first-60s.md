# GLOBAL-020 — No "pick a region", no config files in the first 60s

- **Decision:** First-time use — `npx nlq ask`, opening the web app,
  installing the MCP — completes without any config file, region
  picker, project ID, or environment variable. The path to first
  value is conversational and zero-config.
- **Core value:** Effortless UX, Free, Goal-first
- **Why:** Every required input before first value drops the funnel.
  Users who pick a region are already deciding to commit; we want
  them to decide *after* they've seen value, not before. Defaults
  are good, asked-for defaults are bad.
- **Consequence in code:** CLI's first invocation works against a
  default anonymous device on a default region. Web app boots
  against a demo dataset. MCP install does host detection
  (`packages/mcp/install.ts`) — no JSON the user has to write. Any
  PR that adds a required input to first-touch is rejected.
- **Alternatives rejected:**
  - "Sensible-default config file generated on first run" — still a
    file, still confusing, drifts from the docs.
  - Region picker on signup — half our funnel can't answer it.
