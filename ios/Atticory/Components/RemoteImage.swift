import SwiftUI

struct RemoteImage: View {
    let path: String?
    var contentMode: ContentMode = .fill

    var body: some View {
        Group {
            if let url = AppConfig.resolveImageURL(path) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ZStack {
                            AppTheme.muted
                            ProgressView()
                        }
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: contentMode)
                    case .failure:
                        placeholder
                    @unknown default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
    }

    private var placeholder: some View {
        ZStack {
            AppTheme.muted
            Image(systemName: "photo")
                .foregroundStyle(AppTheme.mutedForeground)
        }
    }
}
