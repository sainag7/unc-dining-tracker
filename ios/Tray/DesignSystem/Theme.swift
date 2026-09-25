import SwiftUI

/// The web app's tokens (src/app/globals.css), as asset-catalog colours with
/// light and dark variants. Components use these names — no raw hex in views.
///
/// Carolina blue is the one accent: selected pills, the stepper, the
/// serving-now dot, the calorie ring. `deep` is the second fill and only for
/// the big CTAs and the tray bar. The macro colours are confined to the macro
/// rings on the log screen. DESIGN.md has the reasoning.
extension Color {
    static let bg = Color("Bg")
    static let surface = Color("Surface")
    static let surfaceAlt = Color("SurfaceAlt")
    static let sectionBg = Color("SectionBg")
    static let border = Color("Border")
    static let borderStrong = Color("BorderStrong")
    static let text = Color("Text")
    static let textMid = Color("TextMid")
    static let textMuted = Color("TextMuted")
    static let textFaint = Color("TextFaint")
    static let carolina = Color("AccentColor")
    static let accentFg = Color("AccentFg")
    static let accentText = Color("AccentText")
    static let deep = Color("Deep")
    static let deepFg = Color("DeepFg")
    static let onDeepDanger = Color("OnDeepDanger")
    static let rowActive = Color("RowActive")
    static let danger = Color("Danger")
    static let dangerBg = Color("DangerBg")
    static let macroCarb = Color("MacroCarb")
    static let macroFat = Color("MacroFat")
    static let macroProtein = Color("MacroProtein")
}

enum Radius {
    static let md: CGFloat = 12
    static let xl: CGFloat = 20
}

extension View {
    /// A rounded surface resting on the tinted ground.
    func card(radius: CGFloat = Radius.xl) -> some View {
        self
            .background(Color.surface, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .shadow(color: Color.text.opacity(0.06), radius: 8, y: 2)
    }

    /// Tabular figures, so columns of numbers line up.
    func data() -> some View { monospacedDigit() }

    /// The small caps-ish label over a section.
    func placard() -> some View {
        font(.caption.weight(.semibold))
            .textCase(.uppercase)
            .tracking(0.6)
            .foregroundStyle(Color.textMuted)
    }
}

/// Filled pill, deep ground — the large call to action.
struct DeepButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .frame(maxWidth: .infinity, minHeight: 50)
            .foregroundStyle(Color.deepFg)
            .background(Color.deep, in: Capsule())
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

/// Outlined pill on a card — the secondary action.
struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .frame(maxWidth: .infinity, minHeight: 50)
            .foregroundStyle(Color.text)
            .background(Color.surface, in: Capsule())
            .overlay(Capsule().strokeBorder(Color.borderStrong, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}
