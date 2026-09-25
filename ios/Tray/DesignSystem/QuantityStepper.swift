import SwiftUI

/// − count + for one line on the tray. Collapses to a lone + at zero.
///
/// The same control on the menu row, the tray sheet and the log, so changing an
/// amount is the same gesture wherever you do it. Each button claims a 44pt hit
/// area around a smaller visual. Port of src/components/ui/quantity-stepper.tsx.
struct QuantityStepper: View {
    let servings: Double
    let label: String
    let onAdd: () -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            if servings > 0 {
                circleButton("minus", filled: false, action: onRemove)
                    .accessibilityLabel("Remove one \(label)")
                Text(Servings.format(servings).dropLast())
                    .font(.subheadline.weight(.bold))
                    .data()
                    .foregroundStyle(Color.text)
                    .frame(minWidth: 22)
                    .contentTransition(.numericText())
            }
            circleButton("plus", filled: servings > 0, action: onAdd)
                .accessibilityLabel("Add one \(label)")
        }
        .sensoryFeedback(.impact(weight: .light), trigger: servings)
    }

    private func circleButton(_ symbol: String, filled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .bold))
                .frame(width: 28, height: 28)
                .foregroundStyle(filled ? Color.accentFg : Color.text)
                .background(filled ? Color.carolina : Color.clear, in: Circle())
                .overlay(Circle().strokeBorder(filled ? Color.clear : Color.borderStrong, lineWidth: 1))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
