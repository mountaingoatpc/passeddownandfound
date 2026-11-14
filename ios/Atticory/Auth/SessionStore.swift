import Foundation
import SwiftUI

@MainActor
final class SessionStore: ObservableObject {
    enum State: Equatable {
        case loading
        case signedOut
        case signedIn
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var user: User?
    @Published var lastError: String?

    private let client = APIClient.shared

    func bootstrap() async {
        guard let token = KeychainStore.readToken() else {
            state = .signedOut
            return
        }

        await client.setToken(token)
        do {
            user = try await client.me()
            state = .signedIn
        } catch let error as APIError where error == .unauthorized {
            if await refreshSession() {
                state = .signedIn
            } else {
                await clearSession()
                state = .signedOut
            }
        } catch {
            await clearSession()
            state = .signedOut
        }
    }

    func login(email: String, password: String) async throws {
        lastError = nil
        let response = try await client.login(email: email, password: password)
        try await persist(response)
        state = .signedIn
    }

    func register(email: String, password: String) async throws {
        lastError = nil
        let response = try await client.register(email: email, password: password)
        try await persist(response)
        state = .signedIn
    }

    func logout() async {
        await clearSession()
        state = .signedOut
    }

    func handleUnauthorized() async {
        if await refreshSession() {
            return
        }
        await logout()
    }

    @discardableResult
    func refreshSession() async -> Bool {
        guard let refreshToken = KeychainStore.readRefreshToken() else {
            return false
        }
        do {
            let response = try await client.refresh(refreshToken: refreshToken)
            try await persist(response)
            return true
        } catch {
            return false
        }
    }

    private func persist(_ response: AuthResponse) async throws {
        try KeychainStore.saveToken(response.token)
        if let refresh = response.refreshToken {
            try KeychainStore.saveRefreshToken(refresh)
        }
        await client.setToken(response.token)
        user = response.user
    }

    private func clearSession() async {
        KeychainStore.deleteTokens()
        await client.setToken(nil)
        user = nil
    }
}
