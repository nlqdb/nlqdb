// Wire contract mirrors `packages/sdk/src/index.ts`: bearer auth,
// auto-mint Idempotency-Key on mutations reused across retries
// (GLOBAL-005, SK-SDK-008), 3-attempt retry on transport / transient
// 5xx (GLOBAL-022), one error class with discriminant `code`
// (GLOBAL-002).

import Foundation
import os.log

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

// Console.app-visible signal for retries, auth failures and decode
// errors. OTel-via-`swift-distributed-tracing` is tracked in
// docs/features/sdk-swift/FEATURE.md as an Open question.
let nlqdbLogger = Logger(subsystem: "com.nlqdb.sdk", category: "client")

public struct NlqdbConfig: Sendable {
    public var apiKey: String
    public var baseURL: URL
    public var session: URLSession
    public var maxAttempts: Int

    public init(
        apiKey: String,
        baseURL: URL = URL(string: "https://app.nlqdb.com")!,
        session: URLSession = .shared,
        maxAttempts: Int = 3
    ) {
        self.apiKey = apiKey
        self.baseURL = baseURL
        self.session = session
        self.maxAttempts = maxAttempts
    }
}

public actor NlqdbClient {
    private let config: NlqdbConfig
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init(_ config: NlqdbConfig) {
        self.config = config
        let enc = JSONEncoder()
        enc.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = enc
        // Models declare explicit `CodingKeys` — global snake/camel
        // strategy would clash with mixed-shape endpoints.
        self.decoder = JSONDecoder()
    }

    // MARK: — Public surface

    public func ask(_ req: AskRequest) async throws -> AskOk {
        try await callDecoding(path: "/v1/ask", method: "POST", body: req)
    }

    public func listDatabases() async throws -> [DatabaseSummary] {
        struct Response: Decodable {
            let databases: [DatabaseSummary]
        }
        let response: Response = try await callDecoding(
            path: "/v1/databases",
            method: "GET",
            body: Optional<Empty>.none
        )
        return response.databases
    }

    public func createDatabase(
        _ req: CreateDatabaseRequest,
        idempotencyKey: String? = nil
    ) async throws -> CreateDatabaseResult {
        try await callDecoding(
            path: "/v1/databases",
            method: "POST",
            body: req,
            idempotencyKey: idempotencyKey
        )
    }

    public func deleteDatabase(
        id: String,
        idempotencyKey: String? = nil
    ) async throws {
        try await callVoid(
            path: "/v1/databases/\(id)",
            method: "DELETE",
            idempotencyKey: idempotencyKey
        )
    }

    // MARK: — Internals

    /// Single-attempt request — caller decides whether to decode.
    private func sendOnce(
        path: String,
        method: String,
        bodyData: Data?,
        idempotencyKey: String?
    ) async throws -> (Data, HTTPURLResponse) {
        var url = config.baseURL
        url.append(path: path)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(config.apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let idempotencyKey {
            req.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        }
        req.httpBody = bodyData

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await config.session.data(for: req)
        } catch is CancellationError {
            throw NlqdbError(code: .aborted, httpStatus: 0, message: "request aborted", path: path)
        } catch let error as URLError where error.code == .cancelled {
            throw NlqdbError(code: .aborted, httpStatus: 0, message: "request aborted", path: path)
        } catch {
            throw NlqdbError(
                code: .networkError,
                httpStatus: 0,
                message: "transport failure: \(error.localizedDescription)",
                path: path
            )
        }

        guard let http = response as? HTTPURLResponse else {
            throw NlqdbError(
                code: .unknownError,
                httpStatus: 0,
                message: "non-HTTP response",
                path: path
            )
        }
        return (data, http)
    }

    private func decodeOrThrow<Out: Decodable>(
        _ data: Data,
        http: HTTPURLResponse,
        path: String
    ) throws -> Out {
        let requestId = http.value(forHTTPHeaderField: "x-request-id")
        if (200..<300).contains(http.statusCode) {
            do {
                return try decoder.decode(Out.self, from: data)
            } catch {
                throw NlqdbError(
                    code: .invalidJson,
                    httpStatus: http.statusCode,
                    message: "response body could not be decoded: \(error)",
                    path: path,
                    requestId: requestId
                )
            }
        }
        throw try mapError(data: data, http: http, path: path, requestId: requestId)
    }

    private func mapError(
        data: Data,
        http: HTTPURLResponse,
        path: String,
        requestId: String?
    ) throws -> NlqdbError {
        let contentType = http.value(forHTTPHeaderField: "content-type") ?? ""
        if !contentType.contains("application/json") {
            return NlqdbError(
                code: .nonJsonResponse,
                httpStatus: http.statusCode,
                message: "non-JSON error response",
                path: path,
                requestId: requestId
            )
        }
        let envelope = try? decoder.decode(ApiErrorEnvelope.self, from: data)
        let code = NlqdbError.Code(rawValue: envelope?.error?.status ?? "") ?? .unknownError
        let message = envelope?.error?.message ?? "request failed with status \(http.statusCode)"
        return NlqdbError(
            code: code,
            httpStatus: http.statusCode,
            message: message,
            path: path,
            requestId: requestId
        )
    }

    /// Retry envelope returning a decoded body.
    private func callDecoding<Body: Encodable, Out: Decodable>(
        path: String,
        method: String,
        body: Body?,
        idempotencyKey: String? = nil
    ) async throws -> Out {
        let bodyData: Data? = try body.map { try encoder.encode($0) }
        let isMutation = method != "GET" && method != "HEAD"
        let key: String? = isMutation ? (idempotencyKey ?? Self.randomId()) : nil

        var lastError: NlqdbError?
        let attempts = max(1, config.maxAttempts)
        for attempt in 1...attempts {
            do {
                try Task.checkCancellation()
            } catch {
                throw NlqdbError(code: .aborted, httpStatus: 0, message: "request aborted", path: path)
            }
            do {
                let (data, http) = try await sendOnce(
                    path: path,
                    method: method,
                    bodyData: bodyData,
                    idempotencyKey: key
                )
                return try decodeOrThrow(data, http: http, path: path)
            } catch let error as NlqdbError {
                if !isRecoverable(error) || attempt == attempts {
                    throw error
                }
                lastError = error
                nlqdbLogger.warning(
                    "retry \(attempt, privacy: .public)/\(attempts, privacy: .public) on \(path, privacy: .public): \(error.code.rawValue, privacy: .public) http=\(error.httpStatus, privacy: .public)"
                )
                try await sleepForBackoff(attempt: attempt)
            }
        }
        throw lastError ?? NlqdbError(
            code: .unknownError,
            httpStatus: 0,
            message: "retry budget exhausted",
            path: path
        )
    }

    /// Retry envelope for endpoints that return no body.
    private func callVoid(
        path: String,
        method: String,
        idempotencyKey: String? = nil
    ) async throws {
        let isMutation = method != "GET" && method != "HEAD"
        let key: String? = isMutation ? (idempotencyKey ?? Self.randomId()) : nil

        var lastError: NlqdbError?
        let attempts = max(1, config.maxAttempts)
        for attempt in 1...attempts {
            do {
                try Task.checkCancellation()
            } catch {
                throw NlqdbError(code: .aborted, httpStatus: 0, message: "request aborted", path: path)
            }
            do {
                let (data, http) = try await sendOnce(
                    path: path,
                    method: method,
                    bodyData: nil,
                    idempotencyKey: key
                )
                if (200..<300).contains(http.statusCode) {
                    return
                }
                let requestId = http.value(forHTTPHeaderField: "x-request-id")
                throw try mapError(data: data, http: http, path: path, requestId: requestId)
            } catch let error as NlqdbError {
                if !isRecoverable(error) || attempt == attempts {
                    throw error
                }
                lastError = error
                nlqdbLogger.warning(
                    "retry \(attempt, privacy: .public)/\(attempts, privacy: .public) on \(path, privacy: .public): \(error.code.rawValue, privacy: .public) http=\(error.httpStatus, privacy: .public)"
                )
                try await sleepForBackoff(attempt: attempt)
            }
        }
        if let lastError {
            throw lastError
        }
    }

    private func sleepForBackoff(attempt: Int) async throws {
        // Linear; no jitter so tests stay deterministic. Cancellation
        // during the sleep maps to the same `.aborted` shape callers
        // see from `sendOnce` so they never branch on the error type.
        let nanoseconds = UInt64(50 * attempt) * 1_000_000
        do {
            try await Task.sleep(nanoseconds: nanoseconds)
        } catch is CancellationError {
            throw NlqdbError(code: .aborted, httpStatus: 0, message: "request aborted")
        }
    }

    static func randomId() -> String {
        var bytes = [UInt8](repeating: 0, count: 16)
        for i in 0..<16 {
            bytes[i] = UInt8.random(in: 0...255)
        }
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    private func isRecoverable(_ error: NlqdbError) -> Bool {
        switch error.code {
        case .networkError:
            return true
        default:
            return error.httpStatus >= 500 && error.httpStatus < 600
        }
    }
}

/// Empty body / empty response stand-in.
public struct Empty: Sendable, Codable {
    public init() {}
}
