// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Nlqdb",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
        .tvOS(.v17),
        .watchOS(.v10),
        .visionOS(.v1),
    ],
    products: [
        .library(name: "Nlqdb", targets: ["Nlqdb"])
    ],
    // GLOBAL-013, GLOBAL-016 — zero runtime dependencies. URLSession +
    // JSONEncoder/Decoder + Foundation cover the full surface; pulling
    // swift-log costs ~100–300 KB binary per consumer and we'd never
    // exercise the slot.
    dependencies: [],
    targets: [
        .target(
            name: "Nlqdb",
            // Swift 6 language mode → strict concurrency on by default.
            swiftSettings: [
                .swiftLanguageMode(.v6),
            ]
        ),
        .testTarget(
            name: "NlqdbTests",
            dependencies: ["Nlqdb"]
        ),
    ]
)
