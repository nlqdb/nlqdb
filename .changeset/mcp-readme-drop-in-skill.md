---
"@nlqdb/mcp": patch
---

Add the drop-in skill install path to the README npmjs.com renders. The
package page told a reader how to connect the server but not how to make
their agent *use* it — the one command that installs the `nlqdb-memory`
skill (`npx skills add …`, run live 2026-07-27) was published on three
nlqdb-hosted surfaces and none of the ones npm serves. Its docs link is
now `?utm_source=npm`-tagged too, so a click-through from the package page
stops converting as `direct`.
