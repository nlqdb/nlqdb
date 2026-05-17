import Foundation
import Testing

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

@testable import Nlqdb

// `.serialized` — `StubProtocol`'s static queue is shared across tests.
@Suite("NlqdbClient — wire contract", .serialized)
struct NlqdbClientTests {

    final class StubProtocol: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var queue: [(Int, Data, String)] = []
        nonisolated(unsafe) static var lastIdempotencyKey: String?
        nonisolated(unsafe) static var seenIdempotencyKeys: [String] = []

        override class func canInit(with _: URLRequest) -> Bool { true }
        override class func canonicalRequest(for r: URLRequest) -> URLRequest { r }
        override func startLoading() {
            let key = request.value(forHTTPHeaderField: "Idempotency-Key")
            StubProtocol.lastIdempotencyKey = key
            if let key { StubProtocol.seenIdempotencyKeys.append(key) }
            guard !StubProtocol.queue.isEmpty else {
                client?.urlProtocolDidFinishLoading(self)
                return
            }
            let (status, body, contentType) = StubProtocol.queue.removeFirst()
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: status,
                httpVersion: "HTTP/1.1",
                headerFields: ["content-type": contentType, "x-request-id": "req_test"]
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body)
            client?.urlProtocolDidFinishLoading(self)
        }
        override func stopLoading() {}
    }

    func makeClient(maxAttempts: Int = 3) -> NlqdbClient {
        StubProtocol.queue = []
        StubProtocol.seenIdempotencyKeys = []
        StubProtocol.lastIdempotencyKey = nil
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        let session = URLSession(configuration: config)
        return NlqdbClient(NlqdbConfig(
            apiKey: "sk_test_x",
            baseURL: URL(string: "https://app.example.com")!,
            session: session,
            maxAttempts: maxAttempts
        ))
    }

    @Test("ask: posts JSON to /v1/ask with bearer + returns decoded body")
    func askHappyPath() async throws {
        let client = makeClient()
        let body = """
        {"status":"ok","rows":[],"rowCount":0,"trace":{"sql":"select 1","plan_id":"h:q","confidence":1,"model":"stub","cache_hit":false}}
        """.data(using: .utf8)!
        StubProtocol.queue.append((200, body, "application/json"))

        let out = try await client.ask(AskRequest(goal: "users"))
        #expect(out.status == "ok")
        #expect(out.trace.sql == "select 1")
        #expect(StubProtocol.lastIdempotencyKey?.count == 32)
    }

    @Test("retries on transient 5xx and reuses Idempotency-Key across attempts")
    func retryOn5xx() async throws {
        let client = makeClient()
        let errBody = #"{"error":{"status":"unknown_error","message":"boom"}}"#.data(using: .utf8)!
        StubProtocol.queue.append((503, errBody, "application/json"))
        StubProtocol.queue.append((503, errBody, "application/json"))
        let okBody = """
        {"status":"ok","rows":[],"rowCount":0,"trace":{"sql":"select 1","plan_id":"h:q","confidence":1,"model":"stub","cache_hit":false}}
        """.data(using: .utf8)!
        StubProtocol.queue.append((200, okBody, "application/json"))

        _ = try await client.ask(AskRequest(goal: "users"))
        let keys = Set(StubProtocol.seenIdempotencyKeys)
        #expect(keys.count == 1, "Idempotency-Key must be reused across retries")
    }

    @Test("4xx surfaces a typed NlqdbError without retry")
    func noRetryOn4xx() async throws {
        let client = makeClient()
        let body = #"{"error":{"status":"rate_limited","message":"slow down"}}"#.data(using: .utf8)!
        // Empty queue after the first response asserts no retry — a retry would fall off the end.
        StubProtocol.queue.append((429, body, "application/json"))

        do {
            _ = try await client.ask(AskRequest(goal: "users"))
            Issue.record("expected NlqdbError to be thrown")
        } catch let error as NlqdbError {
            #expect(error.code == .rateLimited)
            #expect(error.httpStatus == 429)
        }
    }

    @Test("DELETE returns Void on 204 with no body")
    func deleteVoid() async throws {
        let client = makeClient()
        StubProtocol.queue.append((204, Data(), "application/json"))
        try await client.deleteDatabase(id: "db_42")
    }
}
