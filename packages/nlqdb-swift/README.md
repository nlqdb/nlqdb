# Nlqdb — Swift Package

Swift 6 client for the nlqdb `/v1` API. Mirrors `@nlqdb/sdk`'s wire contract, error shape and retry semantics (`GLOBAL-002`). Zero runtime dependencies.

- **Platforms.** iOS 17+, macOS 14+, tvOS 17+, watchOS 10+, visionOS 1+. Builds on Linux (server-side use) via Swift Package Manager — the SwiftUI surface compiles in only on Apple platforms.
- **Concurrency.** Swift 6 strict concurrency. Everything `Sendable`; the client is an `actor`.
- **Cancellation.** Inherits `Task.cancel()` end-to-end via `URLSession`'s cooperative cancellation.

## Install

`Package.swift`:

```swift
.package(url: "https://github.com/nlqdb/nlqdb-swift", from: "0.1.0"),
```

Then add `"Nlqdb"` as a dependency to your target.

## Usage

```swift
import Nlqdb

let client = NlqdbClient(NlqdbConfig(apiKey: "sk_live_…"))
let result = try await client.ask(AskRequest(goal: "today's revenue by drink"))
print(result.rows)
```

### SwiftUI

```swift
import SwiftUI
import Nlqdb

struct OrdersView: View {
    var body: some View {
        NlqDataView(
            goal: "today's revenue by drink",
            apiKey: "pk_live_…"
        ) { result in
            List(result.rows.indices, id: \.self) { i in
                Text("\(result.rows[i].description)")
            }
        }
    }
}
```

`NlqDataView` is a thin wrapper around `NlqDataModel` (an `@Observable` class). Drive `NlqDataModel` directly when you need full control over the UI.

## Auth

`pk_live_*` for browser-shipped keys (read-only, origin-pinned, rate-limited); `sk_live_*` for server-side or local CLI use. The shape is identical — pass either to `NlqdbConfig.apiKey`.

## Error handling

Every method throws `NlqdbError`. Switch on `error.code`:

```swift
do {
    _ = try await client.ask(.init(goal: "…"))
} catch let error as NlqdbError {
    switch error.code {
    case .rateLimited:    // back off
    case .dbNotFound:     // ask the user
    case .networkError:   // already retried internally — surface as offline
    default:              // GLOBAL-012 — one sentence + next action
        print(error.message)
    }
}
```

Recoverable failures (transport, transient 5xx) are retried up to 3 attempts internally (`GLOBAL-022`); `Idempotency-Key` is auto-minted on the first attempt and reused on retry so writes collapse to a single side-effect.

## Tests

```sh
swift test
```

Runs on Linux via the SPM Linux toolchain (no Apple platform required for the wire contract suite).
