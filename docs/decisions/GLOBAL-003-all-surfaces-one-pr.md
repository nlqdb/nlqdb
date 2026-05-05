# GLOBAL-003 — New capabilities ship to all surfaces in one PR

- **Decision:** A capability isn't "done" until SDK + CLI + MCP + elements
  all expose it. The PR that adds the capability adds it to every surface,
  or annotates the affected skills with a tracked gap under *Open
  questions*.
- **Core value:** Simple ("one way to do each thing")
- **Why:** If a feature ships only on web, web becomes the "real" product
  and the others become legacy. nlqdb is one product surfaced four ways;
  the surfaces must move together.
- **Consequence in code:** PR template includes a capability-parity
  checklist. Reviews block on missing-surface boxes unless the
  corresponding skill is updated with a tracked gap.
- **Alternatives rejected:**
  - "Surfaces catch up later" — never happens.
  - "Web-first, others on demand" — creates a hierarchy of surfaces,
    contradicts `GLOBAL-002`.
