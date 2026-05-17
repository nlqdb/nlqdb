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
    // Zero runtime deps per GLOBAL-013 / GLOBAL-016 — Foundation covers HTTP + JSON.
    dependencies: [],
    targets: [
        .target(
            name: "Nlqdb",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "NlqdbTests",
            dependencies: ["Nlqdb"]
        ),
    ]
)
