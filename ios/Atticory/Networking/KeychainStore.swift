import Foundation
import Security

/// Persists auth tokens. Prefers Keychain; falls back to UserDefaults when
/// Keychain is unavailable (common for ad-hoc / unsigned Simulator builds).
enum KeychainStore {
    private static let service = "com.atticory.app"
    private static let tokenAccount = "auth_token"
    private static let refreshAccount = "refresh_token"
    private static let defaults = UserDefaults.standard

    static func saveToken(_ token: String) throws {
        try save(account: tokenAccount, value: token)
    }

    static func readToken() -> String? {
        read(account: tokenAccount)
    }

    static func saveRefreshToken(_ token: String) throws {
        try save(account: refreshAccount, value: token)
    }

    static func readRefreshToken() -> String? {
        read(account: refreshAccount)
    }

    static func deleteTokens() {
        delete(account: tokenAccount)
        delete(account: refreshAccount)
    }

    /// Legacy alias.
    static func deleteToken() {
        deleteTokens()
    }

    private static func defaultsKey(for account: String) -> String {
        "atticory.keychain.\(account)"
    }

    private static func save(account: String, value: String) throws {
        if saveToKeychain(account: account, value: value) {
            defaults.removeObject(forKey: defaultsKey(for: account))
            return
        }
        // Simulator / ad-hoc builds often can't write Keychain; keep the session usable.
        defaults.set(value, forKey: defaultsKey(for: account))
    }

    private static func read(account: String) -> String? {
        if let value = readFromKeychain(account: account) {
            return value
        }
        return defaults.string(forKey: defaultsKey(for: account))
    }

    private static func delete(account: String) {
        deleteFromKeychain(account: account)
        defaults.removeObject(forKey: defaultsKey(for: account))
    }

    @discardableResult
    private static func saveToKeychain(account: String, value: String) -> Bool {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)

        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(attributes as CFDictionary, nil)
        return status == errSecSuccess
    }

    private static func readFromKeychain(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8)
        else {
            return nil
        }
        return value
    }

    private static func deleteFromKeychain(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
