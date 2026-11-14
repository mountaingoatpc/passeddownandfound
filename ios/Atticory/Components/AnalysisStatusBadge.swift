import SwiftUI

struct AnalysisStatusBadge: View {
    let status: AnalysisStatus

    var body: some View {
        Text(status.label)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(background)
            .foregroundStyle(foreground)
            .clipShape(Capsule())
    }

    private var background: Color {
        switch status {
        case .none: AppTheme.muted
        case .queued, .running: AppTheme.primary.opacity(0.15)
        case .complete: AppTheme.success.opacity(0.15)
        case .failed: AppTheme.destructive.opacity(0.12)
        }
    }

    private var foreground: Color {
        switch status {
        case .none: AppTheme.mutedForeground
        case .queued, .running: AppTheme.primary
        case .complete: AppTheme.success
        case .failed: AppTheme.destructive
        }
    }
}
