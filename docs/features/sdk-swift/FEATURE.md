---
name: sdk-swift
description: Swift 6 Package — native iOS / macOS / Linux client for `/v1/ask` and friends; mirrors `@nlqdb/sdk`.
when-to-load:
  globs:
    - packages/nlqdb-swift/**
  topics: [swift, ios, macos, sdk, swiftui, sendable, urlsession]
---

# Feature: Swift SDK (`Nlqdb`)

**One-liner:** Swift 6 Package — native iOS / macOS / Linux client for the nlqdb `/v1` API.
**Status:** partial (Phase 2 — wire contract + retry envelope + SwiftUI view shipped; Apple-platform Xcode CI gated to release workflow)
**Owners (code):** `packages/nlqdb-swift/**`
**Cross-refs:** [`sdk/FEATURE.md`](../sdk/FEATURE.md) (canonical TS SDK — wire shape mirrored here) · [`docs/decisions/GLOBAL-001-sdk-only-http-client.md`](../../decisions/GLOBAL-001-sdk-only-http-client.md) · `docs/progress.md §0` (surface status matrix).

## Touchpoints — read this feature before editing

- `packages/nlqdb-swift/Sources/Nlqdb/**`
- `packages/nlqdb-swift/Tests/NlqdbTests/**`
- `packages/nlqdb-swift/Package.swift`

## Decisions

### SK-SWIFT-001 — Mirror the TS SDK's wire contract exactly; one feature doc, one PR per change

- **Decision:** `packages/nlqdb-swift` is the Swift port of `packages/sdk` — same auth modes, same error class (`NlqdbError`) with a string-discriminant `code` enum that mirrors `ApiErrorCode`, same idempotency-key semantics, same retry budget. Any wire-shape change in the TS SDK lands in the Swift port in the same PR (`GLOBAL-003`).
- **Core value:** Bullet-proof, Simple
- **Why:** `GLOBAL-001` says "the SDK is the only HTTP client per language" and `GLOBAL-002` says "behavior parity across surfaces". A native Swift app whose error codes don't match `@nlqdb/sdk`'s mid-flight failure modes is a parity break — embedders end up writing differently-shaped error handlers per platform. Mirroring the TS contract is the only path that scales.
- **Consequence in code:** `NlqdbError.Code` enumerates the same set of `status` values that the API returns; new server-side error codes update both the TS and Swift error enums in one PR. The retry-budget constant matches `SDK_MAX_ATTEMPTS = 3`. `Idempotency-Key` is auto-minted on the first attempt and reused across retries, same shape as `SK-SDK-006` / `SK-SDK-008`.
- **Alternatives rejected:**
  - Auto-generate from OpenAPI — the TS SDK is hand-rolled because the LLM-router classifies the request shape; codegen would re-derive shapes that already exist. Defer until a `nlqdb-go` slice motivates the full pipeline.
  - Use a different error model per platform (`enum Error` with associated values instead of a struct + code) — the discriminated string is the cross-platform contract, and Swift's switch-on-`code` works fine.

### SK-SWIFT-002 — Actor-isolated client, Swift 6 strict concurrency, zero runtime dependencies

- **Decision:** `NlqdbClient` is an `actor`; all public types are `Sendable`; the package is `swift-tools-version: 6.0` with `.swiftLanguageMode(.v6)` (strict concurrency on). The package has no runtime dependencies — `Foundation` (`URLSession`, `Codable`) covers HTTP + JSON; on Linux we conditionally import `FoundationNetworking`.
- **Core value:** Bullet-proof, Free, Simple
- **Why:** Swift 6 strict concurrency makes data races compile errors rather than runtime crashes. An `actor`-isolated client lets us hold per-call retry state without locks. Zero runtime deps keeps the binary impact predictable for embedders shipping in the App Store (Emerge Tools' data shows each Swift Package dep costs ~100–300 KB binary; we ship a single dynamic product). The `URLSession` + `Codable` stack is the platform default — pulling `swift-log` would buy us a logging slot we'd never exercise and one more thing for App Store reviewers to question.
- **Consequence in code:** `Package.swift` has empty `dependencies: []`. `Sources/Nlqdb/NlqdbClient.swift` declares `public actor NlqdbClient`. All models are `Sendable`. `URLSession` calls go through `try await config.session.data(for: req)` so cancellation propagates from a parent `Task.cancel()`.
- **Alternatives rejected:**
  - `class NlqdbClient` + an internal lock — Swift 6's `actor` is the canonical primitive; rolling our own concurrency primitive is exactly what `actor` exists to avoid.
  - Adopt `swift-log` / `swift-collections` / `Alamofire` — RC churn on `swift-log`'s API surface is real, binary cost is real, ergonomic gain is small.

### SK-SWIFT-003 — SwiftUI surface is `#if canImport(SwiftUI)` so the package stays Linux-buildable

- **Decision:** `Sources/Nlqdb/NlqDataView.swift` (the `NlqDataModel` `@Observable` class + `NlqDataView` SwiftUI view) is wrapped in `#if canImport(SwiftUI)`. The rest of the package (`NlqdbClient`, `NlqdbError`, the model types) builds and tests on Linux.
- **Core value:** Free, Simple
- **Why:** Server-side Swift (Vapor apps, command-line tools, future `nlqdb-swift`-on-Lambda) is a real consumer — they want the HTTP client without UIKit / AppKit. Keeping the SwiftUI portion behind `canImport` means Linux CI (`swift test` on `ubuntu-24.04`) exercises the wire-contract suite on every PR without an Apple-platform runner.
- **Consequence in code:** CI runs `swift build` and `swift test` on `ubuntu-24.04` against the wire-contract test suite. The Apple-platform build (Xcode, iOS simulator, watchOS, visionOS) runs on the release workflow only — outside the PR critical path, so Mac runner cost is bounded.
- **Alternatives rejected:**
  - Ship two packages (`Nlqdb` + `NlqdbUI`) — doubles the maintenance surface for an SPM consumer; the `canImport` guard is the canonical Swift idiom.
  - Skip the SwiftUI view entirely — the iOS-only `<NlqData />` analogue is the highest-ROI Swift demo per the persona research; punting it would erode the "drop-in" pitch on Apple platforms.

### SK-SWIFT-004 — Swift Testing framework on Swift 6, not XCTest

- **Decision:** Tests use the Swift Testing framework (`import Testing`, `@Test`, `@Suite`). The framework is part of the Swift 6 toolchain — no separate dependency.
- **Core value:** Simple, Bullet-proof
- **Why:** Swift Testing is the official replacement for XCTest going forward (WWDC 2024 announcement, GA in Swift 6.0). New code uses it; XCTest is the legacy surface. `@Test` is parameter-aware (better failure messages than `XCTAssertEqual`) and runs in parallel by default.
- **Consequence in code:** `Tests/NlqdbTests/NlqdbTests.swift` uses `@Test` and `#expect`. CI installs Swift 6.0.3 via a direct toolchain download from `swift.org` — `swift-actions/setup-swift@v2` silently falls back to Swift 5 (see [swift-actions#683](https://github.com/swift-actions/setup-swift/issues/683)); `v3` is still beta and `GLOBAL-016` forbids RC on the critical path. The suite is `@Suite(.serialized)` because the URLProtocol stub shares static state across tests.
- **Alternatives rejected:**
  - XCTest — works, but new code on the latest toolchain has no reason to choose the legacy API.
  - `swift-testing` as a `.package` dependency — unnecessary; it ships in-toolchain on Swift 6.0+.

### SK-SWIFT-005 — `runSql()` mirrors the TS SDK's `runSql` for parity (GLOBAL-002, GLOBAL-003)

- **Decision:** The Swift client exposes `runSql(_ req: RunSqlRequest, idempotencyKey: String? = nil) async throws -> RunSqlResult` that POSTs to `/v1/run` (the raw-SQL escape-hatch endpoint per `GLOBAL-015`, see [`SK-SDK-009`](../sdk/FEATURE.md)). Wire shape, allow-list, error codes, retry budget and idempotency-key semantics are identical to the TS SDK.
- **Core value:** Bullet-proof, Goal-first, Creative
- **Why:** The raw-SQL escape hatch must exist on every 1st-party surface or `GLOBAL-002` parity fractures — a Swift consumer can't drop down to the CLI when they need raw SQL. The Swift port lands `runSql()` in the same PR as the TS SDK's `runSql` (`GLOBAL-003`).
- **Consequence in code:** `NlqdbClient.runSql(_:idempotencyKey:)` delegates to `callDecoding` so the retry envelope and idempotency-key auto-mint reuse the same paths as `ask`. New error codes (`sql_required`, `sql_too_long`, `db_required`, `forbidden`) live in `NlqdbError.Code` and decode via the shared envelope mapper. The `RunSqlRequest` / `RunSqlResult` Codable types live in `Models.swift` next to `AskRequest` / `AskOk`.
- **Alternatives rejected:**
  - Skip `runSql()` in Swift and tell users to use the CLI — kills the parity story for native iOS / macOS apps; `GLOBAL-001` says the SDK is the only HTTP client per language.
  - Build a separate raw-SQL-only client — doubles the surface for no semantic gain; the existing actor + retry envelope handles it.

## GLOBALs governing this feature

Canonical text in [`docs/decisions/`](../../decisions/). The list below names the rules that constrain this feature; any feature-local commentary is nested under the rule.

- **GLOBAL-001** — SDK is the only HTTP client.
  - *In this feature:* `Sources/Nlqdb/NlqdbClient.swift` is the Swift counterpart of `packages/sdk/src/index.ts`. No other file in the package opens HTTP connections.
- **GLOBAL-002** — Behavior parity across surfaces.
  - *In this feature:* `NlqdbError.Code` mirrors `ApiErrorCode`; the retry budget mirrors `SDK_MAX_ATTEMPTS = 3`; idempotency-key auto-mint matches the TS shape.
- **GLOBAL-003** — New capabilities ship to all surfaces in one PR.
  - *In this feature:* a new endpoint in `packages/sdk` lands in `packages/nlqdb-swift` (and the CLI port at `cli/internal/api/`) in the same PR.
- **GLOBAL-005** — Every mutation accepts `Idempotency-Key`.
- **GLOBAL-009** — Tokens refresh silently — never surface a 401.
  - *In this feature:* the silent-refresh path doesn't exist yet — Swift consumers use long-lived `sk_live_*` / `pk_live_*` keys. Cookie-based session-refresh would arrive with a `WKWebView`-style consumer; tracked as Open question.
- **GLOBAL-012** — Errors are one sentence with the next action.
- **GLOBAL-013** — $0/month free tier.
- **GLOBAL-014** — OTel span on every external call.
  - *In this feature:* not yet wired — Swift `os.signpost` / `swift-distributed-tracing` integration is an Open question.
- **GLOBAL-016** — Reach for small mature packages; hard-pass on RC.
- **GLOBAL-019** — Free + Open Source core (FSL-1.1-ALv2 → Apache-2.0).
- **GLOBAL-022** — Recoverable failures retry to success.
  - *In this feature:* the retry envelope in `NlqdbClient.callDecoding` and `callVoid` matches the TS SDK's `call<T>` shape — 3 attempts on transport failures + transient 5xx, idempotency-key reused.

## Open questions / known unknowns

- **Apple-platform CI — Parked until a shipping Apple-platform consumer exists** (resolved per `GLOBAL-033`, cost → mirror the incumbent, fail-safe). PR CI runs `swift build` + `swift test` on Linux; the Apple matrix (iOS/macOS/watchOS/visionOS) stays release-gated because macOS runners are 10× the cost. A PR-time smoke build lands only when a real consumer makes the macOS spend worth it — not on spec.
- **Silent-refresh / OAuth + streaming `ask` (SSE) — Parked until a Swift consumer asks** (`GLOBAL-033`, speculative-scope). Bearer auth (`sk_live_*` / `pk_live_*`) only today; the `withCredentials`/OAuth bridge (`apps/mcp`) and the `URLSession.bytes` SSE mapping land with the first Swift consumer that needs them, not on spec.
- **OTel — Parked until a Swift consumer asks for tracing** (`GLOBAL-033`, genuinely-deferred). No SDK has client tracing today (`GLOBAL-014`); the `swift-distributed-tracing`-vs-`os.signpost` pick (both pull a runtime dep) is made with that consumer, not on spec.
- **Distribution — Resolved** (`GLOBAL-033`, Simple → one way; §8 not-building): **no mirror repo.** Publish to Swift Package Index from the monorepo tag (`nlqdb-swift-v0.1.0`) — SwiftPM resolves a package at a subpath of a tagged repo, so a separate `nlqdb/nlqdb-swift` is a second repo to keep in sync for zero user benefit.
- **Kotlin / Flutter SDKs.** Phase 2 per [`progress.md`](../../progress.md). Designs sketched in the research notes; not yet promoted to features.
