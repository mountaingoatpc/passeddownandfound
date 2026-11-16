import Foundation

struct User: Codable, Equatable, Identifiable, Sendable {
    var id: String { uuid }
    let uuid: String
    let email: String
}

struct AuthResponse: Codable, Sendable {
    let token: String
    let refreshToken: String?
    let user: User

    enum CodingKeys: String, CodingKey {
        case token, user
        case refreshToken = "refresh_token"
    }
}

struct RefreshRequest: Encodable, Sendable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

enum AnalysisStatus: String, Codable, Sendable {
    case none
    case queued
    case running
    case complete
    case failed

    var isInProgress: Bool {
        self == .queued || self == .running
    }

    var label: String {
        switch self {
        case .none: "Not analyzed"
        case .queued: "Queued"
        case .running: "Analyzing…"
        case .complete: "Analyzed"
        case .failed: "Analysis failed"
        }
    }
}

struct ComparableListing: Codable, Equatable, Identifiable, Sendable {
    var id: String { "\(platform)-\(title)-\(url ?? "")" }
    let platform: String
    let title: String
    let price: Double?
    let url: String?
    let notes: String
}

struct ItemAiEvidence: Codable, Equatable, Sendable {
    var comparableListings: [ComparableListing]
    var platformEstimates: [String: Double]
    var confidence: Double?
    var reasoning: String

    enum CodingKeys: String, CodingKey {
        case comparableListings = "comparable_listings"
        case platformEstimates = "platform_estimates"
        case confidence
        case reasoning
    }

    init(
        comparableListings: [ComparableListing] = [],
        platformEstimates: [String: Double] = [:],
        confidence: Double? = nil,
        reasoning: String = ""
    ) {
        self.comparableListings = comparableListings
        self.platformEstimates = platformEstimates
        self.confidence = confidence
        self.reasoning = reasoning
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        comparableListings = try container.decodeIfPresent([ComparableListing].self, forKey: .comparableListings) ?? []
        platformEstimates = try container.decodeIfPresent([String: Double].self, forKey: .platformEstimates) ?? [:]
        confidence = try container.decodeIfPresent(Double.self, forKey: .confidence)
        reasoning = try container.decodeIfPresent(String.self, forKey: .reasoning) ?? ""
    }
}

struct InventoryItemSummary: Codable, Identifiable, Equatable, Sendable {
    var id: String { uuid }
    let uuid: String
    let name: String
    let description: String
    let cost: Double
    let projectedSalePrice: Double
    let actualSalePrice: Double?
    let imageUrls: [String]
    let analysisStatus: AnalysisStatus
    let analysisError: String?

    enum CodingKeys: String, CodingKey {
        case uuid, name, description, cost
        case projectedSalePrice = "projected_sale_price"
        case actualSalePrice = "actual_sale_price"
        case imageUrls = "image_urls"
        case analysisStatus = "analysis_status"
        case analysisError = "analysis_error"
    }
}

struct InventoryListResponse: Codable, Sendable {
    let items: [InventoryItemSummary]
    let total: Int
    let page: Int
    let limit: Int
    let totalPages: Int

    enum CodingKeys: String, CodingKey {
        case items, total, page, limit
        case totalPages = "total_pages"
    }
}

enum PaymentMethod: String, Codable, CaseIterable, Identifiable, Sendable {
    case cash
    case venmo
    case paypal
    case facebookPay = "facebook_pay"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .cash: return "Cash"
        case .venmo: return "Venmo"
        case .paypal: return "PayPal"
        case .facebookPay: return "Facebook Pay"
        }
    }
}

struct InventoryItem: Codable, Identifiable, Equatable, Sendable {
    var id: String { uuid }
    let uuid: String
    var name: String
    var category: String
    var description: String
    var condition: String
    var quantity: Int
    var weightPounds: Int
    var weightOunces: Double
    var startingBid: Double
    var cost: Double
    var projectedSalePrice: Double
    var actualSalePrice: Double?
    var partialSale: Bool
    var unitsSold: Int?
    var paymentMethod: PaymentMethod?
    var imageUrls: [String]
    var aiEvidence: ItemAiEvidence?
    var analysisStatus: AnalysisStatus
    var analysisError: String?
    let ownerUuid: String
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case uuid, name, category, description, condition, quantity, cost
        case weightPounds = "weight_pounds"
        case weightOunces = "weight_ounces"
        case startingBid = "starting_bid"
        case projectedSalePrice = "projected_sale_price"
        case actualSalePrice = "actual_sale_price"
        case partialSale = "partial_sale"
        case unitsSold = "units_sold"
        case paymentMethod = "payment_method"
        case imageUrls = "image_urls"
        case aiEvidence = "ai_evidence"
        case analysisStatus = "analysis_status"
        case analysisError = "analysis_error"
        case ownerUuid = "owner_uuid"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        uuid = try container.decode(String.self, forKey: .uuid)
        name = try container.decode(String.self, forKey: .name)
        category = try container.decodeIfPresent(String.self, forKey: .category) ?? ""
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        condition = try container.decodeIfPresent(String.self, forKey: .condition) ?? ""
        quantity = try container.decodeIfPresent(Int.self, forKey: .quantity) ?? 1
        weightPounds = try container.decodeIfPresent(Int.self, forKey: .weightPounds) ?? 0
        weightOunces = try container.decodeIfPresent(Double.self, forKey: .weightOunces) ?? 0
        startingBid = try container.decodeIfPresent(Double.self, forKey: .startingBid) ?? 0
        cost = try container.decode(Double.self, forKey: .cost)
        projectedSalePrice = try container.decode(Double.self, forKey: .projectedSalePrice)
        actualSalePrice = try container.decodeIfPresent(Double.self, forKey: .actualSalePrice)
        partialSale = try container.decodeIfPresent(Bool.self, forKey: .partialSale) ?? false
        unitsSold = try container.decodeIfPresent(Int.self, forKey: .unitsSold)
        paymentMethod = try container.decodeIfPresent(PaymentMethod.self, forKey: .paymentMethod)
        imageUrls = try container.decodeIfPresent([String].self, forKey: .imageUrls) ?? []
        aiEvidence = try container.decodeIfPresent(ItemAiEvidence.self, forKey: .aiEvidence)
        analysisStatus = try container.decodeIfPresent(AnalysisStatus.self, forKey: .analysisStatus) ?? .none
        analysisError = try container.decodeIfPresent(String.self, forKey: .analysisError)
        ownerUuid = try container.decode(String.self, forKey: .ownerUuid)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        updatedAt = try container.decode(String.self, forKey: .updatedAt)
    }
}

struct CreateInventoryItemRequest: Encodable, Sendable {
    var name: String
    var category: String = ""
    var description: String = ""
    var condition: String = ""
    var quantity: Int = 1
    var weightPounds: Int = 0
    var weightOunces: Double = 0
    var startingBid: Double = 0
    var cost: Double
    var projectedSalePrice: Double
    var actualSalePrice: Double?
    var partialSale: Bool = false
    var unitsSold: Int?
    var paymentMethod: PaymentMethod?
    var imageUrls: [String] = []
    var aiEvidence: ItemAiEvidence?
    var runAnalysis: Bool = false
    var analysisContext: String?

    enum CodingKeys: String, CodingKey {
        case name, category, description, condition, quantity, cost
        case weightPounds = "weight_pounds"
        case weightOunces = "weight_ounces"
        case startingBid = "starting_bid"
        case projectedSalePrice = "projected_sale_price"
        case actualSalePrice = "actual_sale_price"
        case partialSale = "partial_sale"
        case unitsSold = "units_sold"
        case paymentMethod = "payment_method"
        case imageUrls = "image_urls"
        case aiEvidence = "ai_evidence"
        case runAnalysis = "run_analysis"
        case analysisContext = "analysis_context"
    }
}

struct UpdateInventoryItemRequest: Encodable, Sendable {
    var name: String?
    var category: String?
    var description: String?
    var condition: String?
    var quantity: Int?
    var weightPounds: Int?
    var weightOunces: Double?
    var startingBid: Double?
    var cost: Double?
    var projectedSalePrice: Double?
    var actualSalePrice: Double?
    var partialSale: Bool?
    var unitsSold: Int?
    var paymentMethod: PaymentMethod?
    var imageUrls: [String]?
    var aiEvidence: ItemAiEvidence?
    var runAnalysis: Bool?
    var analysisContext: String?

    enum CodingKeys: String, CodingKey {
        case name, category, description, condition, quantity, cost
        case weightPounds = "weight_pounds"
        case weightOunces = "weight_ounces"
        case startingBid = "starting_bid"
        case projectedSalePrice = "projected_sale_price"
        case actualSalePrice = "actual_sale_price"
        case partialSale = "partial_sale"
        case unitsSold = "units_sold"
        case paymentMethod = "payment_method"
        case imageUrls = "image_urls"
        case aiEvidence = "ai_evidence"
        case runAnalysis = "run_analysis"
        case analysisContext = "analysis_context"
    }
}

struct CategoryMetricRow: Codable, Identifiable, Sendable {
    var id: String { category }
    let category: String
    let cost: Double
    let projectedSale: Double
    let projectedProfit: Double
    let profit: Double

    enum CodingKeys: String, CodingKey {
        case category, cost, profit
        case projectedSale = "projected_sale"
        case projectedProfit = "projected_profit"
    }
}

struct InventoryMetricsResponse: Codable, Sendable {
    let totalItems: Int
    let totalCost: Double
    let totalProjectedSale: Double
    let projectedProfit: Double
    let profit: Double
    let itemsSold: Int
    let byCategory: [CategoryMetricRow]

    enum CodingKeys: String, CodingKey {
        case profit
        case totalItems = "total_items"
        case totalCost = "total_cost"
        case totalProjectedSale = "total_projected_sale"
        case projectedProfit = "projected_profit"
        case itemsSold = "items_sold"
        case byCategory = "by_category"
    }
}

struct UploadResponse: Codable, Sendable {
    let imageUrl: String

    enum CodingKeys: String, CodingKey {
        case imageUrl = "image_url"
    }
}

struct ItemAnalysisResponse: Codable, Sendable {
    let name: String
    let category: String
    let description: String
    let conditionSuggestion: String
    let projectedSalePrice: Double
    let startingBidSuggestion: Double
    let platformEstimates: [String: Double]
    let comparableListings: [ComparableListing]
    let confidence: Double
    let reasoning: String

    enum CodingKeys: String, CodingKey {
        case name, category, description, confidence, reasoning
        case conditionSuggestion = "condition_suggestion"
        case projectedSalePrice = "projected_sale_price"
        case startingBidSuggestion = "starting_bid_suggestion"
        case platformEstimates = "platform_estimates"
        case comparableListings = "comparable_listings"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        category = try container.decode(String.self, forKey: .category)
        description = try container.decode(String.self, forKey: .description)
        conditionSuggestion = try container.decode(String.self, forKey: .conditionSuggestion)
        projectedSalePrice = try container.decode(Double.self, forKey: .projectedSalePrice)
        startingBidSuggestion = try container.decode(Double.self, forKey: .startingBidSuggestion)
        platformEstimates = try container.decodeIfPresent([String: Double].self, forKey: .platformEstimates) ?? [:]
        comparableListings = try container.decodeIfPresent([ComparableListing].self, forKey: .comparableListings) ?? []
        confidence = try container.decode(Double.self, forKey: .confidence)
        reasoning = try container.decodeIfPresent(String.self, forKey: .reasoning) ?? ""
    }
}

struct Category: Codable, Identifiable, Equatable, Sendable {
    var id: String { uuid }
    let uuid: String
    var name: String
    var description: String
    let ownerUuid: String
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case uuid, name, description
        case ownerUuid = "owner_uuid"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct CreateCategoryRequest: Encodable, Sendable {
    let name: String
    let description: String
}

struct UpdateCategoryRequest: Encodable, Sendable {
    var name: String?
    var description: String?
}

struct QueueAnalysisRequest: Encodable, Sendable {
    var analysisContext: String?

    enum CodingKeys: String, CodingKey {
        case analysisContext = "analysis_context"
    }
}
