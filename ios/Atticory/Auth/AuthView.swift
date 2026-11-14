import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var mode: Mode = .login
    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false
    @State private var errorMessage: String?

    enum Mode {
        case login
        case register

        var title: String {
            switch self {
            case .login: "Sign in"
            case .register: "Create account"
            }
        }

        var submitLabel: String {
            switch self {
            case .login: "Sign in"
            case .register: "Register"
            }
        }

        var togglePrompt: String {
            switch self {
            case .login: "Need an account? Register"
            case .register: "Already have an account? Sign in"
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Atticory")
                        .font(AppTheme.titleFont)
                        .foregroundStyle(AppTheme.foreground)
                    Text("Inventory from the attic and beyond.")
                        .font(.body)
                        .foregroundStyle(AppTheme.mutedForeground)
                }
                .padding(.top, 48)

                VStack(alignment: .leading, spacing: 16) {
                    Text(mode.title)
                        .font(AppTheme.headlineFont)
                        .foregroundStyle(AppTheme.foreground)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Email")
                            .font(.subheadline.weight(.medium))
                        TextField("you@example.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(14)
                            .background(AppTheme.card)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(AppTheme.border, lineWidth: 1)
                            )
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Password")
                            .font(.subheadline.weight(.medium))
                        SecureField("At least 6 characters", text: $password)
                            .textContentType(mode == .register ? .newPassword : .password)
                            .padding(14)
                            .background(AppTheme.card)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(AppTheme.border, lineWidth: 1)
                            )
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(AppTheme.destructive)
                    }

                    Button {
                        Task { await submit() }
                    } label: {
                        HStack {
                            if isWorking {
                                ProgressView()
                                    .tint(AppTheme.primaryForeground)
                            }
                            Text(mode.submitLabel)
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(AppTheme.primary)
                        .foregroundStyle(AppTheme.primaryForeground)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .disabled(isWorking || email.isEmpty || password.count < 6)

                    Button(mode.togglePrompt) {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            mode = mode == .login ? .register : .login
                            errorMessage = nil
                        }
                    }
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.primary)
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
        .appScreenBackground()
    }

    private func submit() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            switch mode {
            case .login:
                try await session.login(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            case .register:
                try await session.register(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            }
        } catch let error as APIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
