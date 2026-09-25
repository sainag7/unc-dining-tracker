import SwiftUI

/// The item detail, set as a real nutrition label, scaling live with the
/// portion. Port of src/components/nutrition-label.tsx — like that component,
/// it opts out of the type scale on purpose so it reads as the panel people
/// already know how to scan.
struct NutritionLabel: View {
    let recipe: Recipe
    var servings: Double = 1

    /// FDA Daily Values on a 2,000 calorie reference.
    private enum DV {
        static let fat = 78.0, satFat = 20.0, cholesterol = 300.0, sodium = 2300.0
        static let carbs = 275.0, fiber = 28.0, addedSugar = 50.0
        static let calcium = 1300.0, iron = 18.0, potassium = 4700.0, vitaminD = 20.0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Nutrition Facts").font(.system(size: 30, weight: .heavy)).tracking(-0.5)

            HStack(alignment: .firstTextBaseline) {
                Text("Serving size")
                Spacer()
                Text(recipe.servingSize ?? "1 serving").fontWeight(.semibold).data()
            }
            .font(.system(size: 13))
            .padding(.bottom, 4)
            thick(8)

            if servings != 1 {
                HStack {
                    Text("Showing")
                    Spacer()
                    Text("\(Servings.format(servings).dropLast()) servings").fontWeight(.semibold).data()
                }
                .font(.system(size: 12))
                .padding(.vertical, 4)
            }

            Text("Amount per serving").font(.system(size: 11, weight: .semibold)).padding(.top, 4)
            HStack(alignment: .lastTextBaseline) {
                Text("Calories").font(.system(size: 24, weight: .heavy))
                Spacer()
                Text(recipe.calories.map { "\(Int(LogMath.jsRound($0 * servings)))" } ?? "—")
                    .font(.system(size: 36, weight: .semibold)).data()
                    .contentTransition(.numericText())
            }
            .padding(.bottom, 2)
            thick(4)

            HStack { Spacer(); Text("% Daily Value*").font(.system(size: 11, weight: .semibold)) }
                .padding(.vertical, 3)

            row("Total Fat", recipe.fatG, "g", DV.fat, bold: true)
            row("Saturated Fat", recipe.satFatG, "g", DV.satFat, indent: 1)
            row("Trans Fat", recipe.transFatG, "g", nil, indent: 1)
            row("Cholesterol", recipe.cholesterolMg, "mg", DV.cholesterol, bold: true)
            row("Sodium", recipe.sodiumMg, "mg", DV.sodium, bold: true)
            row("Total Carbohydrate", recipe.carbsG, "g", DV.carbs, bold: true)
            row("Dietary Fiber", recipe.fiberG, "g", DV.fiber, indent: 1)
            row("Total Sugars", recipe.sugarsG, "g", nil, indent: 1)
            row("Includes Added Sugars", recipe.addedSugarG, "g", DV.addedSugar, indent: 2)
            row("Protein", recipe.proteinG, "g", nil, bold: true)
            thick(8).padding(.top, 2)
            row("Vitamin D", recipe.vitaminDMcg, "mcg", DV.vitaminD)
            row("Calcium", recipe.calciumMg, "mg", DV.calcium)
            row("Iron", recipe.ironMg, "mg", DV.iron)
            row("Potassium", recipe.potassiumMg, "mg", DV.potassium)
            thick(4).padding(.top, 2)

            Text("* Percent Daily Values are based on a 2,000 calorie diet. UNC prepares food in a commercial kitchen, so ingredients and preparation can vary from what's listed.")
                .font(.system(size: 10))
                .foregroundStyle(Color.textMuted)
                .padding(.top, 6)
        }
        .foregroundStyle(Color.text)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.surface)
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color.text, lineWidth: 2))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func thick(_ height: CGFloat) -> some View {
        Rectangle().fill(Color.text).frame(height: height)
    }

    private func row(_ label: String, _ value: Double?, _ unit: String, _ dv: Double?, indent: Int = 0, bold: Bool = false) -> some View {
        VStack(spacing: 0) {
            Rectangle().fill(Color.border).frame(height: 1)
            HStack(alignment: .firstTextBaseline) {
                Text(label).fontWeight(bold ? .bold : .regular)
                    + Text(" ") + Text(amount(value, unit)).monospacedDigit()
                Spacer()
                if let dv, let value {
                    Text("\(Int(LogMath.jsRound(value * servings / dv * 100)))%").fontWeight(.semibold).monospacedDigit()
                }
            }
            .font(.system(size: 13))
            .padding(.leading, CGFloat(indent) * 14)
            .padding(.vertical, 4)
        }
        .accessibilityElement(children: .combine)
    }

    /// Small amounts keep a decimal; larger ones read better whole.
    private func amount(_ value: Double?, _ unit: String) -> String {
        guard let value else { return "—" }
        let scaled = value * servings
        let rounded = scaled < 10 ? LogMath.jsRound(scaled * 10) / 10 : LogMath.jsRound(scaled)
        let text = rounded == rounded.rounded() ? "\(Int(rounded))" : "\(rounded)"
        return text + unit
    }
}
