import Foundation
import UIKit

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private var token: String?

    private init(session: URLSession = .shared) {
        self.session = session
        decoder = JSONDecoder()
        encoder = JSONEncoder()
    }

    func setToken(_ token: String?) {
        self.token = token
    }

    func getToken() -> String? {
        token
    }

    // MARK: - Auth

    func register(email: String, password: String) async throws -> AuthResponse {
        try await request(
            path: "/auth/register",
            method: "POST",
            body: ["email": email, "password": password],
            authorized: false
        )
    }

    func login(email: String, password: String) async throws -> AuthResponse {
        try await request(
            path: "/auth/login",
            method: "POST",
            body: ["email": email, "password": password],
            authorized: false
        )
    }

    func refresh(refreshToken: String) async throws -> AuthResponse {
        try await request(
            path: "/auth/refresh",
            method: "POST",
            encodable: RefreshRequest(refreshToken: refreshToken),
            authorized: false
        )
    }

    func me() async throws -> User {
        try await request(path: "/auth/me", method: "GET")
    }

    // MARK: - Inventory

    func listInventory(search: String? = nil, page: Int = 1, limit: Int = 20) async throws -> InventoryListResponse {
        var query: [URLQueryItem] = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        if let search, !search.isEmpty {
            query.append(URLQueryItem(name: "search", value: search))
        }
        return try await request(path: "/inventory", method: "GET", query: query)
    }

    func inventoryMetrics() async throws -> InventoryMetricsResponse {
        try await request(path: "/inventory/metrics", method: "GET")
    }

    func getInventoryItem(uuid: String) async throws -> InventoryItem {
        try await request(path: "/inventory/\(uuid)", method: "GET")
    }

    func createInventoryItem(_ body: CreateInventoryItemRequest) async throws -> InventoryItem {
        try await request(path: "/inventory", method: "POST", encodable: body)
    }

    func updateInventoryItem(uuid: String, _ body: UpdateInventoryItemRequest) async throws -> InventoryItem {
        try await request(path: "/inventory/\(uuid)", method: "PUT", encodable: body)
    }

    func deleteInventoryItem(uuid: String) async throws {
        let _: EmptyResponse = try await request(path: "/inventory/\(uuid)", method: "DELETE")
    }

    func queueAnalysis(uuid: String, context: String?) async throws -> InventoryItem {
        try await request(
            path: "/inventory/\(uuid)/analyze",
            method: "POST",
            encodable: QueueAnalysisRequest(analysisContext: context)
        )
    }

    func analyzeImage(imageData: Data, filename: String, context: String?) async throws -> ItemAnalysisResponse {
        var fields: [String: String] = [:]
        if let context, !context.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            fields["additional_context"] = context.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return try await upload(
            path: "/inventory/analyze",
            fileField: "file",
            filename: filename,
            mimeType: mimeType(for: filename),
            fileData: imageData,
            fields: fields
        )
    }

    // MARK: - Uploads

    func uploadImage(imageData: Data, filename: String) async throws -> UploadResponse {
        try await upload(
            path: "/uploads",
            fileField: "file",
            filename: filename,
            mimeType: mimeType(for: filename),
            fileData: imageData,
            fields: [:]
        )
    }

    // MARK: - Categories

    func listCategories() async throws -> [Category] {
        try await request(path: "/categories", method: "GET")
    }

    func createCategory(_ body: CreateCategoryRequest) async throws -> Category {
        try await request(path: "/categories", method: "POST", encodable: body)
    }

    func updateCategory(uuid: String, _ body: UpdateCategoryRequest) async throws -> Category {
        try await request(path: "/categories/\(uuid)", method: "PUT", encodable: body)
    }

    func deleteCategory(uuid: String) async throws {
        let _: EmptyResponse = try await request(path: "/categories/\(uuid)", method: "DELETE")
    }

    // MARK: - Core

    private struct EmptyResponse: Decodable {}

    private func request<T: Decodable>(
        path: String,
        method: String,
        query: [URLQueryItem] = [],
        body: [String: String]? = nil,
        encodable: (any Encodable)? = nil,
        authorized: Bool = true
    ) async throws -> T {
        let url = try buildURL(path: path, query: query)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if authorized {
            guard let token else { throw APIError.unauthorized }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        } else if let encodable {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(AnyEncodable(encodable))
        }

        return try await perform(request)
    }

    private func buildURL(path: String, query: [URLQueryItem] = []) throws -> URL {
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let base = AppConfig.apiBaseURL.appending(path: trimmed)
        guard !query.isEmpty else { return base }
        guard var components = URLComponents(url: base, resolvingAgainstBaseURL: false) else {
            throw APIError.network
        }
        components.queryItems = query
        guard let url = components.url else { throw APIError.network }
        return url
    }

    private func upload<T: Decodable>(
        path: String,
        fileField: String,
        filename: String,
        mimeType: String,
        fileData: Data,
        fields: [String: String]
    ) async throws -> T {
        guard let token else { throw APIError.unauthorized }

        let boundary = "Boundary-\(UUID().uuidString)"
        let url = try buildURL(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = multipartBody(
            boundary: boundary,
            fields: fields,
            fileField: fileField,
            filename: filename,
            mimeType: mimeType,
            fileData: fileData
        )

        return try await perform(request)
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.network
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.network
        }

        if http.statusCode == 401 {
            throw APIError.unauthorized
        }

        if !(200 ..< 300).contains(http.statusCode) {
            let message = parseErrorMessage(from: data) ?? "API Error: \(http.statusCode)"
            throw APIError(status: http.statusCode, message: message)
        }

        if data.isEmpty, T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError(status: http.statusCode, message: "Invalid response from API")
        }
    }

    private func parseErrorMessage(from data: Data) -> String? {
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }

        if let detail = json["detail"] as? String {
            return detail
        }
        if let error = json["error"] as? String {
            return error
        }
        if let detail = json["detail"] as? [[String: Any]] {
            return detail.compactMap { $0["msg"] as? String }.joined(separator: ", ")
        }
        return nil
    }

    private func multipartBody(
        boundary: String,
        fields: [String: String],
        fileField: String,
        filename: String,
        mimeType: String,
        fileData: Data
    ) -> Data {
        var body = Data()
        let lineBreak = "\r\n"

        for (key, value) in fields {
            body.append("--\(boundary)\(lineBreak)")
            body.append("Content-Disposition: form-data; name=\"\(key)\"\(lineBreak)\(lineBreak)")
            body.append("\(value)\(lineBreak)")
        }

        body.append("--\(boundary)\(lineBreak)")
        body.append("Content-Disposition: form-data; name=\"\(fileField)\"; filename=\"\(filename)\"\(lineBreak)")
        body.append("Content-Type: \(mimeType)\(lineBreak)\(lineBreak)")
        body.append(fileData)
        body.append(lineBreak)
        body.append("--\(boundary)--\(lineBreak)")
        return body
    }

    private func mimeType(for filename: String) -> String {
        let ext = (filename as NSString).pathExtension.lowercased()
        switch ext {
        case "jpg", "jpeg": return "image/jpeg"
        case "png": return "image/png"
        case "webp": return "image/webp"
        case "gif": return "image/gif"
        case "heic": return "image/heic"
        case "heif": return "image/heif"
        default: return "application/octet-stream"
        }
    }
}

private struct AnyEncodable: Encodable {
    private let encodeFunc: (Encoder) throws -> Void

    init(_ wrapped: any Encodable) {
        encodeFunc = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeFunc(encoder)
    }
}

private extension Data {
    mutating func append(_ string: String) {
        if let data = string.data(using: .utf8) {
            append(data)
        }
    }
}

enum ImageUploadHelper {
    static func jpegData(from image: UIImage, maxBytes: Int = 9_500_000) -> Data? {
        var quality: CGFloat = 0.9
        var data = image.jpegData(compressionQuality: quality)
        while let current = data, current.count > maxBytes, quality > 0.3 {
            quality -= 0.1
            data = image.jpegData(compressionQuality: quality)
        }
        return data
    }

    static func filename(for index: Int = 0) -> String {
        "photo-\(Int(Date().timeIntervalSince1970))-\(index).jpg"
    }
}
