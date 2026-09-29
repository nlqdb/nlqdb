# Future direction — Data is the moat

> **Status:** founder direction, **not yet a decision**. Recorded 2026-09-29.
> Promote into a `GLOBAL-NNN` once the open questions below are answered
> (`CLAUDE.md` P4 / D1). Until then it changes no code and no lever order.

## Founder's words (verbatim, 2026-09-29)

> you know what i think the future moat is data. so if we perfect nlqdb engine around different data collecting engines and data models - thats a good direction to take.

## How it sits next to today's stance

The current moat is the DBA that optimizes for real, with observability
([`GLOBAL-041`](../decisions/GLOBAL-041-autonomous-dba.md)), and Phase A
(infer on write) stays the current slice. This direction is where that engine
goes next: it gets perfected across many kinds of data and data models, not
only the rateme12 shape
([`GLOBAL-042`](../decisions/GLOBAL-042-dogfood-iteration-loop.md)).

## Open questions (answer before promoting)

1. **"Data collecting engines"** means which of these: the ways data comes
   in (app writes through the SDK, forms, webhooks, event streams, file
   imports), the storage engines underneath (Postgres, ClickHouse), or both?
2. **"Data models"** means which of these: product shapes (relational,
   nested documents, time series, graphs/trees), or specific real products
   used as dogfood iterations after rateme12?
3. **Moat wording:** does "data" replace GLOBAL-041's "the DBA that
   optimizes" as the moat, or sit on top of it as its long-run payoff?
4. **First step:** which one iteration, after rateme12, tests this first?
