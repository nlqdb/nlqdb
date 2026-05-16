# SK-CLI-001 — Single static Go binary; 3-char name `nlq`; no PATH collision

- **Decision:** The CLI is a single static Go binary named `nlq`. The npm scope `@nlqdb/*` is owned and the binary name `nlq` and npm name `nlqdb` are both reserved so we can ship under either without forcing a fork.
- **Core value:** Effortless UX, Fast, Goal-first
- **Why:** A 3-char name is what gets typed twenty times a day. Static Go means zero runtime deps — copy the binary, run it. The performance budget is `binary < 8 MB, starts in < 30 ms, first byte < 200 ms on cache hit` (DESIGN §0 "Fast"); achieving that in Node or Python introduces enough start-up latency to break the cache-hit promise. PATH-collision-free is the boring win — every user already has `nlq` available without aliasing.
- **Consequence in code:** The binary entrypoint lives in `cli/cmd/nlq/main.go` (path TBC at slice start). Bundle size is checked in CI; binaries beyond 8 MB fail the build. No system-wide config that requires sudo to install. `go.mod` lives at the `cli/` root.
- **Alternatives rejected:**
  - Node CLI — start-up cost (~150 ms even for "Hello world") blows the cold first-byte budget.
  - Rust CLI — comparable performance to Go but slower compile-edit cycle and steeper hire bar at our team size.
  - Python — `pip install` is heavier than `curl | sh`; cross-platform packaging is harder.
