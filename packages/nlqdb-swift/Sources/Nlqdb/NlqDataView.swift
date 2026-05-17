// `canImport(SwiftUI)` keeps the package Linux-buildable for server / CLI consumers.

#if canImport(SwiftUI)
import Foundation
import SwiftUI

/// Drive directly when you need full control over the rendering; `NlqDataView` is the convenience.
@MainActor
@Observable
public final class NlqDataModel {
    public enum Phase: Sendable {
        case idle
        case loading
        case ready(AskOk)
        case failed(NlqdbError)
    }

    public private(set) var phase: Phase = .idle

    private let client: NlqdbClient
    private let request: AskRequest

    public init(client: NlqdbClient, request: AskRequest) {
        self.client = client
        self.request = request
    }

    public func load() async {
        phase = .loading
        do {
            let result = try await client.ask(request)
            phase = .ready(result)
        } catch let error as NlqdbError {
            phase = .failed(error)
        } catch is CancellationError {
            phase = .idle
        } catch {
            phase = .failed(NlqdbError(
                code: .unknownError,
                httpStatus: 0,
                message: error.localizedDescription
            ))
        }
    }
}

public struct NlqDataView<Loading: View, Failure: View, Content: View>: View {
    private let goal: String
    private let dbId: String?
    private let client: NlqdbClient
    private let loading: () -> Loading
    private let failure: (NlqdbError) -> Failure
    private let content: (AskOk) -> Content

    @State private var model: NlqDataModel?

    public init(
        goal: String,
        dbId: String? = nil,
        apiKey: String,
        baseURL: URL = URL(string: "https://app.nlqdb.com")!,
        @ViewBuilder loading: @escaping () -> Loading = { ProgressView() },
        @ViewBuilder failure: @escaping (NlqdbError) -> Failure = { Text($0.message).foregroundStyle(.red) },
        @ViewBuilder content: @escaping (AskOk) -> Content
    ) {
        self.goal = goal
        self.dbId = dbId
        self.client = NlqdbClient(NlqdbConfig(apiKey: apiKey, baseURL: baseURL))
        self.loading = loading
        self.failure = failure
        self.content = content
    }

    public var body: some View {
        Group {
            switch model?.phase {
            case .ready(let ok)?:
                content(ok)
            case .failed(let err)?:
                failure(err)
            case .loading?:
                loading()
            case .idle?, .none:
                Color.clear
            }
        }
        .task {
            let m = NlqDataModel(
                client: client,
                request: AskRequest(goal: goal, dbId: dbId)
            )
            model = m
            await m.load()
        }
    }
}
#endif
