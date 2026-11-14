import SwiftUI

enum AppTheme {
    // Matches web globals.css HSL tokens.
    static let background = Color(hue: 38 / 360, saturation: 0.33, brightness: 0.96)
    static let foreground = Color(hue: 24 / 360, saturation: 0.20, brightness: 0.18)
    static let primary = Color(hue: 175 / 360, saturation: 0.38, brightness: 0.46)
    static let primaryForeground = Color.white
    static let muted = Color(hue: 38 / 360, saturation: 0.20, brightness: 0.94)
    static let mutedForeground = Color(hue: 24 / 360, saturation: 0.10, brightness: 0.45)
    static let border = Color(hue: 38 / 360, saturation: 0.18, brightness: 0.88)
    static let destructive = Color(hue: 0, saturation: 0.72, brightness: 0.51)
    static let success = Color(hue: 142 / 360, saturation: 0.45, brightness: 0.38)
    static let card = Color.white

    static let titleFont = Font.system(.largeTitle, design: .serif).weight(.semibold)
    static let headlineFont = Font.system(.title2, design: .serif).weight(.semibold)
}

extension View {
    func appScreenBackground() -> some View {
        background(AppTheme.background.ignoresSafeArea())
    }
}
