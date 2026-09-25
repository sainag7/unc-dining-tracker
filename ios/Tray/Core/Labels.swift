import Foundation

/// Display names for the tag keys the scraper pulls off the menu page. Port of
/// src/lib/labels.ts.
enum Labels {
    static let allergens: KeyValuePairs<String, String> = [
        "egg": "Egg", "soy": "Soy", "wheat": "Wheat", "milk": "Milk", "fish": "Fish",
        "shellfish": "Shellfish", "sesame": "Sesame", "gluten": "Gluten",
        "peanut": "Peanut", "treenut": "Tree nut",
    ]

    static let properties: [String: String] = [
        "vegan": "Vegan", "vegetarian": "Vegetarian", "halal": "Halal",
        "smart_choice": "Smart Choice", "local": "Local", "organic": "Organic",
        "sustainable_seafood": "Sustainable seafood",
        "made_without_gluten": "Made without gluten", "cool_foods": "Coolfood",
    ]

    /// The dietary filters people actually eat by.
    static let filterable = ["vegan", "vegetarian", "halal", "made_without_gluten"]

    static func allergen(_ key: String) -> String {
        allergens.first { $0.key == key }?.value ?? key
    }

    static func property(_ key: String) -> String { properties[key] ?? key }

    /// Allergens on this item that the user has said to avoid. Flagged, never
    /// hidden: silently removing items looks identical to having no data.
    static func conflicts(_ itemAllergens: [String], avoid: [String]) -> [String] {
        guard !avoid.isEmpty else { return [] }
        let avoidSet = Set(avoid)
        return itemAllergens.filter { avoidSet.contains($0) }
    }
}

/// Portions people actually take — multipliers of the recipe's own serving.
enum Servings {
    static let steps: [Double] = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4]

    /// 1.5 → "1.5×", 2 → "2×".
    static func format(_ servings: Double) -> String {
        let rounded = (servings * 100).rounded() / 100
        return rounded == rounded.rounded()
            ? "\(Int(rounded))×"
            : "\(rounded.formatted(.number.precision(.fractionLength(0...2))))×"
    }
}
