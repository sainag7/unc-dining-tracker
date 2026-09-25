import Foundation

// Mirrors of the tables in supabase/migrations/0001_initial_schema.sql, and of
// the TypeScript types in src/lib/supabase/database.types.ts. Dates stay as the
// "YYYY-MM-DD" strings Postgres sends: they are campus dates, not instants, and
// turning them into `Date` would invite a time zone to shift them.

struct DiningHall: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let slug: String
    let name: String

    /// "Chase Dining Hall" → "Chase". The switcher has no room for words that
    /// say nothing.
    var shortName: String {
        name.replacingOccurrences(of: "dining hall", with: "", options: .caseInsensitive)
            .trimmingCharacters(in: .whitespaces)
    }
}

struct MealPeriod: Identifiable, Hashable, Sendable {
    let id: Int
    let name: String
    let timeLabel: String?
    /// "HH:MM", already normalised by `CampusDate.toHHMM`.
    let startTime: String?
    let endTime: String?
}

struct Recipe: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let name: String
    let servingSize: String?
    let ingredients: String?
    let allergens: [String]
    let properties: [String]
    let calories: Double?
    let proteinG: Double?
    let carbsG: Double?
    let fatG: Double?
    let satFatG: Double?
    let transFatG: Double?
    let cholesterolMg: Double?
    let sodiumMg: Double?
    let fiberG: Double?
    let sugarsG: Double?
    let addedSugarG: Double?
    let calciumMg: Double?
    let ironMg: Double?
    let potassiumMg: Double?
    let vitaminDMcg: Double?

    enum CodingKeys: String, CodingKey {
        case id, name, ingredients, allergens, properties, calories
        case servingSize = "serving_size"
        case proteinG = "protein_g"
        case carbsG = "carbs_g"
        case fatG = "fat_g"
        case satFatG = "sat_fat_g"
        case transFatG = "trans_fat_g"
        case cholesterolMg = "cholesterol_mg"
        case sodiumMg = "sodium_mg"
        case fiberG = "fiber_g"
        case sugarsG = "sugars_g"
        case addedSugarG = "added_sugar_g"
        case calciumMg = "calcium_mg"
        case ironMg = "iron_mg"
        case potassiumMg = "potassium_mg"
        case vitaminDMcg = "vitamin_d_mcg"
    }
}

struct Station: Identifiable, Hashable, Sendable {
    var id: String { name }
    let name: String
    var items: [Recipe]
}

struct Profile: Codable, Hashable, Sendable {
    let id: UUID
    var calorieGoal: Int
    var proteinGoalG: Int
    var carbGoalG: Int
    var fatGoalG: Int
    var dietaryPrefs: [String]
    var allergensAvoid: [String]

    enum CodingKeys: String, CodingKey {
        case id
        case calorieGoal = "calorie_goal"
        case proteinGoalG = "protein_goal_g"
        case carbGoalG = "carb_goal_g"
        case fatGoalG = "fat_goal_g"
        case dietaryPrefs = "dietary_prefs"
        case allergensAvoid = "allergens_avoid"
    }
}

/// One line on the tray, joined with the names the log screen shows.
struct LogEntry: Identifiable, Hashable, Sendable {
    let id: Int
    let recipeId: Int
    let serviceDate: String
    let mealPeriodName: String?
    let hallId: Int?
    var servings: Double
    let caloriesSnapshot: Double?
    let proteinSnapshot: Double?
    let carbsSnapshot: Double?
    let fatSnapshot: Double?

    var recipeName: String
    var servingSize: String?
    var hallName: String?
}

/// The raw `food_log` row.
struct FoodLogRow: Codable, Sendable {
    let id: Int
    let recipeId: Int
    let serviceDate: String
    let mealPeriodName: String?
    let hallId: Int?
    let servings: Double
    let caloriesSnapshot: Double?
    let proteinSnapshot: Double?
    let carbsSnapshot: Double?
    let fatSnapshot: Double?

    enum CodingKeys: String, CodingKey {
        case id, servings
        case recipeId = "recipe_id"
        case serviceDate = "service_date"
        case mealPeriodName = "meal_period_name"
        case hallId = "hall_id"
        case caloriesSnapshot = "calories_snapshot"
        case proteinSnapshot = "protein_snapshot"
        case carbsSnapshot = "carbs_snapshot"
        case fatSnapshot = "fat_snapshot"
    }
}

/// The key `food_log` is unique on (migration 0002): a recipe eaten at a
/// particular hall, meal and date. Both halves after the date are nullable.
struct Slot: Hashable, Sendable {
    let serviceDate: String
    let mealPeriodName: String?
    let hallId: Int?
}
