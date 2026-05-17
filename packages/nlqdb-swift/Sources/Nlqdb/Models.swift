// Wire models for the nlqdb /v1 API. Mirrors `packages/sdk/src/index.ts`;
// when the wire shape changes update both in the same PR (GLOBAL-002).

import Foundation

public struct AskRequest: Sendable, Codable {
    public var goal: String
    public var dbId: String?
    public var confirm: Bool?

    public init(goal: String, dbId: String? = nil, confirm: Bool? = nil) {
        self.goal = goal
        self.dbId = dbId
        self.confirm = confirm
    }

    enum CodingKeys: String, CodingKey {
        case goal
        case dbId
        case confirm
    }
}

public struct Trace: Sendable, Codable {
    public let sql: String
    public let planId: String
    public let confidence: Double
    public let model: String
    public let cacheHit: Bool

    enum CodingKeys: String, CodingKey {
        case sql
        case planId = "plan_id"
        case confidence
        case model
        case cacheHit = "cache_hit"
    }
}

public struct AskOk: Sendable, Codable {
    public let status: String
    public let rows: [[String: AnyCodable]]
    public let rowCount: Int
    public let trace: Trace
    public let answer: String?

    enum CodingKeys: String, CodingKey {
        case status
        case rows
        case rowCount
        case trace
        case answer
    }
}

public struct DatabaseSummary: Sendable, Codable, Identifiable {
    public let id: String
    public let slug: String
    public let engine: String
    public let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case slug
        case engine
        case createdAt = "created_at"
    }
}

public struct CreateDatabaseRequest: Sendable, Codable {
    public var slug: String
    public var engine: String?

    public init(slug: String, engine: String? = nil) {
        self.slug = slug
        self.engine = engine
    }
}

public struct CreateDatabaseResult: Sendable, Codable {
    public let id: String
    public let slug: String
    public let engine: String
}

/// Codable wrapper for arbitrary JSON cell values (TS `unknown`).
/// Consumers pattern-match the case to read a column.
public enum AnyCodable: Sendable, Codable, Equatable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case null
    indirect case array([AnyCodable])
    indirect case object([String: AnyCodable])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
            return
        }
        if let v = try? c.decode(Bool.self) {
            self = .bool(v)
            return
        }
        if let v = try? c.decode(Int.self) {
            self = .int(v)
            return
        }
        if let v = try? c.decode(Double.self) {
            self = .double(v)
            return
        }
        if let v = try? c.decode(String.self) {
            self = .string(v)
            return
        }
        if let v = try? c.decode([AnyCodable].self) {
            self = .array(v)
            return
        }
        if let v = try? c.decode([String: AnyCodable].self) {
            self = .object(v)
            return
        }
        throw DecodingError.dataCorruptedError(
            in: c,
            debugDescription: "AnyCodable: unsupported scalar type"
        )
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .int(let v): try c.encode(v)
        case .double(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .null: try c.encodeNil()
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }
}
