import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var showLogoutConfirm = false

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Atticory")
                        .font(AppTheme.headlineFont)
                    Text(session.user?.email ?? "Signed in")
                        .foregroundStyle(AppTheme.mutedForeground)
                }
                .padding(.vertical, 8)
                .listRowBackground(AppTheme.card)
            }

            Section("API") {
                LabeledContent("Base URL", value: AppConfig.apiBaseURL.absoluteString)
                    .font(.footnote)
                    .listRowBackground(AppTheme.card)
            }

            Section {
                Button("Sign out", role: .destructive) {
                    showLogoutConfirm = true
                }
                .listRowBackground(AppTheme.card)
            }
        }
        .scrollContentBackground(.hidden)
        .appScreenBackground()
        .navigationTitle("Profile")
        .confirmationDialog("Sign out?", isPresented: $showLogoutConfirm, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) {
                Task { await session.logout() }
            }
        }
    }
}
