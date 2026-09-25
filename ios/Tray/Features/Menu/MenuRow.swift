import SwiftUI

/// One item on the menu. Port of src/components/menu-row.tsx.
///
/// The row opens the nutrition sheet; the stepper changes what's on the tray.
/// Splitting them turns a five-item meal from fifteen taps into five. A row
/// with something on it tints edge to edge, so you can see what's on your tray
/// while still browsing, without reading a number.
struct MenuRow: View {
    let item: Recipe
    let servings: Double
    let allergensAvoid: [String]
    let isSignedIn: Bool
    var stationLabel: String?
    let onAdd: () -> Void
    let onRemove: () -> Void
    let onOpen: () -> Void
    let onSignIn: () -> Void

    var body: some View {
        let conflicts = Labels.conflicts(item.allergens, avoid: allergensAvoid)
        let logged = servings > 0

        HStack(spacing: 10) {
            Button(action: onOpen) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.text)
                        .lineLimit(1)
                    // The conflict warning isn't a tag — it goes above them, in danger.
                    if !conflicts.isEmpty {
                        Text("Contains \(conflicts.map(Labels.allergen).joined(separator: ", "))")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Color.danger)
                            .lineLimit(1)
                    }
                    if let tags = DietTags.line(item.properties) {
                        Text(tags).font(.caption2).foregroundStyle(Color.textFaint).lineLimit(1)
                    }
                    if let stationLabel {
                        Text(stationLabel).font(.caption2).foregroundStyle(Color.textFaint).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Shows nutrition")

            Text(item.calories.map { "\(Int(LogMath.jsRound($0)))" } ?? "—")
                .font(.subheadline.weight(.semibold))
                .data()
                .foregroundStyle(Color.text)
                .frame(width: 38, alignment: .trailing)
                .accessibilityLabel(item.calories.map { "\(Int(LogMath.jsRound($0))) calories" } ?? "Calories unknown")

            if isSignedIn {
                QuantityStepper(servings: servings, label: item.name, onAdd: onAdd, onRemove: onRemove)
            } else {
                Button(action: onSignIn) {
                    Image(systemName: "plus")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.textFaint)
                        .frame(width: 28, height: 28)
                        .overlay(Circle().strokeBorder(Color.borderStrong, lineWidth: 0.5))
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Sign in to log \(item.name)")
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, 6)
        .padding(.vertical, 4)
        .frame(minHeight: 56)
        .background(logged ? Color.rowActive : Color.clear)
        .overlay(alignment: .bottom) { Rectangle().fill(Color.border).frame(height: 0.5).padding(.leading, 16) }
    }
}

/// Dietary properties spelled out on a quiet second line. Port of
/// src/components/ui/badge.tsx — vegan implies vegetarian, so not both.
enum DietTags {
    private static let order = ["vegan", "vegetarian", "halal", "made_without_gluten"]
    private static let label = ["vegan": "Vegan", "vegetarian": "Vegetarian", "halal": "Halal", "made_without_gluten": "No gluten"]

    static func line(_ properties: [String]) -> String? {
        var has = Set(properties)
        if has.contains("vegan") { has.remove("vegetarian") }
        let shown = order.filter(has.contains)
        return shown.isEmpty ? nil : shown.compactMap { label[$0] }.joined(separator: " · ")
    }
}
