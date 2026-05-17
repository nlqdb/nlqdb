// Discriminate on `code`; matches TS SDK's `NlqdbApiError` (GLOBAL-002).

import Foundation

public struct NlqdbError: Error, Sendable, Equatable {
    public enum Code: String, Sendable, Codable {
        case unauthorized
        case rateLimited = "rate_limited"
        case forbidden
        case dbNotFound = "db_not_found"
        case dbRequired = "db_required"
        case sqlRequired = "sql_required"
        case sqlTooLong = "sql_too_long"
        case sqlRejected = "sql_rejected"
        case invalidEngine = "invalid_engine"
        case lowConfidence = "low_confidence"
        case invalidJson = "invalid_json"
        case nonJsonResponse = "non_json_response"
        case networkError = "network_error"
        case aborted
        case unknownError = "unknown_error"
        case configInvalid = "config_invalid"
        case other
    }

    public let code: Code
    public let httpStatus: Int
    public let message: String
    public let path: String?
    public let requestId: String?

    public init(
        code: Code,
        httpStatus: Int,
        message: String,
        path: String? = nil,
        requestId: String? = nil
    ) {
        self.code = code
        self.httpStatus = httpStatus
        self.message = message
        self.path = path
        self.requestId = requestId
    }
}

extension NlqdbError: LocalizedError {
    public var errorDescription: String? {
        return message
    }
}

struct ApiErrorEnvelope: Decodable {
    struct Body: Decodable {
        let status: String?
        let message: String?
    }
    let error: Body?
}
