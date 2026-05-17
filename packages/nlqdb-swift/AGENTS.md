# Packages · nlqdb-swift — Agents Guide

Swift 6 client for the nlqdb `/v1` API. Mirrors `@nlqdb/sdk`'s wire contract (`GLOBAL-002`).

> Read root [`AGENTS.md`](../../AGENTS.md), then [`docs/features/sdk-swift/FEATURE.md`](../../docs/features/sdk-swift/FEATURE.md).

## Features relevant to this area

- [`sdk-swift`](../../docs/features/sdk-swift/FEATURE.md) — mandatory pre-read for any wire-shape change.
- [`sdk`](../../docs/features/sdk/FEATURE.md) — canonical TS SDK; every wire-shape change must update both ports in the same PR (`GLOBAL-003`).

## Commands

```bash
swift build --package-path packages/nlqdb-swift
swift test --package-path packages/nlqdb-swift
```

## Local rules

- Zero runtime dependencies (`GLOBAL-013`, `GLOBAL-016`). `Package.swift` review rejects new `.dependencies` entries.
- Swift 6 strict concurrency stays on — every public type is `Sendable`.
- `NlqDataView` lives behind `#if canImport(SwiftUI)` so the package stays Linux-buildable for server use.
- Tests use a `URLProtocol` stub — no real network calls in CI.
