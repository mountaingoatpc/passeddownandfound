import Foundation

struct APIError: Error, LocalizedError, Equatable {
    let status: Int
    let message: String

    var errorDescription: String? { message }

    static let unauthorized = APIError(status: 401, message: "Unauthorized")
    static let network = APIError(status: 0, message: "Could not reach the API. Check that the backend is running.")
}
