---
"@nlqdb/mcp": patch
---

Rewrite the README that npmjs.com renders as the package page. `0.1.0` shipped
the internal contributor notes: it told readers `nlqdb_list_databases` and
`nlqdb_describe` don't work yet (slice 1 has shipped), listed four of the five
tools, and gave an install snippet without `-y` — so `npx` prompts and a
headless host hangs. Replaced with the real headless setup, the full tool
table, and a `?utm_source=npm` product link. First publish through the
Trusted Publisher configured on 2026-07-26.
