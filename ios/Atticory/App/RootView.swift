import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            switch session.state {
            case .loading:
                ZStack {
                    AppTheme.background.ignoresSafeArea()
                    ProgressView()
                        .tint(AppTheme.primary)
                }
            case .signedOut:
                AuthView()
            case .signedIn:
                MainTabView()
            }
        }
        .task {
            await session.bootstrap()
        }
        .animation(.easeInOut(duration: 0.2), value: session.state)
    }
}
