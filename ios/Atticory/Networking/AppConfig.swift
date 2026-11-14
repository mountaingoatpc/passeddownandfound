import Foundation

enum AppConfig {
    static var apiBaseURL: URL {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           let url = URL(string: raw),
           !raw.isEmpty,
           !raw.contains("$(")
        {
            return url
        }
        #if DEBUG
        return URL(string: "http://localhost:8091")!
        #else
        return URL(string: "http://localhost:8091")!
        #endif
    }

    static func resolveImageURL(_ path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        if path.hasPrefix("http://") || path.hasPrefix("https://") {
            return URL(string: path)
        }
        let base = apiBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let relative = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: base + relative)
    }
}
