# SK-CLI-003 — Subcommand-first verbs (`nlq <noun> <verb>`); two canonical operations on data

- **Decision:** Verb shape follows `gh` / `fly` / `wrangler`: subcommand-first, `nlq <noun> <verb>` for power-user ops. The two canonical *data* operations are `nlq ask` (NL query) and `nlq run` (raw query). All other verbs (`new`, `chat`, `db create|list`, `query`, `login`, `logout`, `whoami`, `keys list|rotate|revoke`, `mcp install`, `connection`, `use`, `export`) are helpers — they don't introduce additional ways to do `ask` or `run`.
- **Core value:** Simple, Effortless UX
- **Why:** `GLOBAL-017` is the load-bearing rule here: two endpoints, two CLI verbs, one chat box, one way to do each thing. `nlq new` and bare `nlq "..."` are conveniences over the same ask path; they don't fork the pipeline. Subcommand-first matches the developer audience's mental model from `gh` and `wrangler`, so muscle memory transfers.
- **Consequence in code:** A new conceptual operation gets explicitly justified in PR review against `GLOBAL-017`. Reviewers reject aliases like `nlq query == nlq ask`. Helpers (`keys`, `login`) are scaffolding; the data path is `ask` + `run`. Bare `nlq "<goal>"` is sugar for `nlq ask "<goal>"` (resolution semantics in [`SK-CLI-012`](SK-CLI-012-bare-form-active-db.md)); `nlq new "<goal>"` is sugar for "create-or-resolve a DB from goal, then `ask`".
- **Alternatives rejected:**
  - REST-style verb explosion (`nlq queries new`, `nlq runs list`) — adds surface, harms learnability, contradicts `GLOBAL-017`.
  - Single bare-form invocation only (`nlq "..."`) — power-user paths need named verbs for scriptability and discoverability via `--help`.
