# SK-CLI-018 — `nlq remember` is the CLI's third data verb, mirroring the already-justified `/v1/memory/remember` endpoint

Parent feature: [`cli/FEATURE.md`](../FEATURE.md). Wire/SDK/server
counterpart: [`SK-PIVOT-008`](../../agent-memory-pivot/FEATURE.md) (the
`/v1/memory/remember` endpoint + the SDK `client.remember()` + the MCP
`nlqdb_remember` tool, all shipped in E-02). Parent GLOBALs:
[`GLOBAL-017`](../../../decisions/GLOBAL-017-one-way-to-do-things.md)
(the third-verb justification this decision discharges),
`GLOBAL-002`/`GLOBAL-003` (surface parity),
[`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md)
(honest next-action errors).

- **Decision:** The CLI gains a third data verb, `nlq remember`, wrapping
  `POST /v1/memory/remember`. It writes one typed memory row into an
  `agent_memory_v1` preset DB; the server composes the deterministic
  parameterised INSERT (the caller never writes SQL). The verb's shape is:
  the **positional `<text>` is always the row's primary content** (a
  fact's `content`, an episode's `content`, or an entity's
  `canonical_name`); `--kind fact|episode|entity` (default `fact`)
  selects the table; per-kind required flags fill the rest (`--role` for
  episodes, `--type` for entities — `--type` doubles as a fact's
  category). Fact-only extras: `--tag` (repeatable), `--ttl` (a Go
  duration plus the `Nd` day shorthand, e.g. `7d`). Scope flags
  `--end-user` / `--thread` apply to all kinds. `--db` resolution mirrors
  `nlq ask` / `nlq run` (explicit flag, else the active DB). A
  `wrong_preset` (409) on a non-memory DB renders a one-sentence
  next-action (`GLOBAL-012`).
- **Core value:** Goal-first, Simple, Bullet-proof
- **Why:** `GLOBAL-017` caps the CLI at two data verbs and requires
  *explicit justification* for a third. The justification is already
  banked at the endpoint layer: `SK-PIVOT-008` established
  `/v1/memory/remember` as a **distinct** write surface precisely because
  routing structured memory writes through `/v1/run`'s raw-SQL hatch would
  re-open string-built SQL over agent-supplied content and break the
  typed-plan trust boundary. Given that third endpoint exists and is
  reached by the SDK and MCP, `GLOBAL-003` (parity) obliges the CLI to
  carry it too — a CLI that can't write memory is a parity hole, not a
  smaller surface. `nlq remember` is therefore not a *new* conceptual
  operation; it is the CLI face of an already-justified one. The
  positional-is-content shape keeps the common call (`nlq remember "user
  prefers dark mode"`) as short as `nlq run`'s, while `--kind` keeps a
  single verb instead of three (`nlq remember-fact` / `-episode` /
  `-entity`), which would multiply surface against `GLOBAL-017`.
- **Consequence in code:** `cli/internal/cmd/remember.go` (the verb +
  pure `buildRememberRequest` + `parseTTL` + `renderRememberError`);
  `cli/internal/api` adds `RememberRequest` / `RememberResult` (mirroring
  the SDK wire shape — scope fields top-level camelCase, per-kind shape
  nested under `payload`) and `Client.Remember`;
  `cli/internal/output` adds `WriteRemember`; the verb joins the
  bare-form `known` map (`cmd/nlq/main.go`) so `TestRegisteredVerbs`
  stays in lockstep. Unit tests cover the builder, TTL parsing, and the
  wire body + `wrong_preset` mapping.
- **Alternatives rejected:**
  - **No CLI verb — leave `remember` to SDK/MCP only** — a standing
    `GLOBAL-003` parity hole; an agent operator scripting memory from a
    shell would have to drop to `curl`, defeating the CLI's reason to
    exist.
  - **Route memory writes through `nlq run`** — re-opens raw SQL over
    agent content and moves SQL authorship to the caller; the exact trust
    boundary `SK-PIVOT-008` exists to keep. (Also: `/v1/run` rejects DDL
    and isn't the memory endpoint.)
  - **Three verbs (`remember-fact` / `-episode` / `-entity`)** — triples
    the surface for one conceptual operation against `GLOBAL-017`; `--kind`
    is the single-verb form.
  - **A required `--content` flag instead of positional** — noisier for
    the dominant fact write; positional content matches `nlq run`'s
    ergonomics.
- **Source:** canonical here · wire/SDK/server/MCP counterpart
  `SK-PIVOT-008` · discharges `GLOBAL-017`'s third-verb justification ·
  governed by `GLOBAL-002` / `GLOBAL-003` / `GLOBAL-012`.
