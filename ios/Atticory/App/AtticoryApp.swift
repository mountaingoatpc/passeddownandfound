import SwiftUI

@main
struct AtticoryApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .tint(AppTheme.primary)
        }
    }
}
