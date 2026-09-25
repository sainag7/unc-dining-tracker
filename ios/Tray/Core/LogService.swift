import Foundation
import Supabase

/// The signed-in user's side of the database: their log, their profile, and
/// the writes. Port of src/lib/log.ts and src/app/actions.ts.
///
/// The write rules — snapshot macros at log time, one line per slot, a 1× line
/// is deleted rather than decremented to zero — live in Postgres (migration
/// 0003), so the web app and this one can't drift apart on them.
enum LogService {
    private static func userId() async throws -> UUID {
        guard let user = try client().auth.currentUser else { throw TrayError.notSignedIn }
        return user.id
    }

    // MARK: Reads

    static func profile() async throws -> Profile? {
        let id = try await userId()
        let rows: [Profile] = try await client().from("profiles")
            .select("id, calorie_goal, protein_goal_g, carb_goal_g, fat_goal_g, dietary_prefs, allergens_avoid")
            .eq("id", value: id)
            .limit(1)
            .execute().value
        return rows.first
    }

    static func dayLog(_ date: String) async throws -> [LogEntry] {
        let id = try await userId()
        let db = try client()
        let rows: [FoodLogRow] = try await db.from("food_log")
            .select("id, recipe_id, service_date, meal_period_name, hall_id, servings, calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot")
            .eq("user_id", value: id)
            .eq("service_date", value: date)
            .order("logged_at")
            .execute().value
        guard !rows.isEmpty else { return [] }

        struct RecipeName: Decodable { let id: Int; let name: String; let serving_size: String? }
        struct HallName: Decodable { let id: Int; let name: String }

        async let recipes: [RecipeName] = db.from("recipes")
            .select("id, name, serving_size")
            .in("id", values: Array(Set(rows.map(\.recipeId))))
            .execute().value
        async let halls: [HallName] = db.from("dining_halls").select("id, name").execute().value

        let recipeById = Dictionary(uniqueKeysWithValues: try await recipes.map { ($0.id, $0) })
        let hallById = Dictionary(uniqueKeysWithValues: try await halls.map { ($0.id, $0.name) })

        return rows.map { row in
            LogEntry(
                id: row.id, recipeId: row.recipeId, serviceDate: row.serviceDate,
                mealPeriodName: row.mealPeriodName, hallId: row.hallId, servings: row.servings,
                caloriesSnapshot: row.caloriesSnapshot, proteinSnapshot: row.proteinSnapshot,
                carbsSnapshot: row.carbsSnapshot, fatSnapshot: row.fatSnapshot,
                recipeName: recipeById[row.recipeId]?.name ?? "Unknown item",
                servingSize: recipeById[row.recipeId]?.serving_size,
                hallName: row.hallId.flatMap { hallById[$0] }
            )
        }
    }

    /// Servings logged per recipe for exactly one slot — the same scope
    /// `remove_serving` acts on, so the count on a button is always one that
    /// button can take off.
    static func loggedServings(_ slot: Slot) async throws -> [Int: Double] {
        let id = try await userId()
        struct Row: Decodable { let recipe_id: Int; let servings: Double }

        var query = try client().from("food_log")
            .select("recipe_id, servings")
            .eq("user_id", value: id)
            .eq("service_date", value: slot.serviceDate)
        // Postgres `= null` never matches; the nullable halves need `is`.
        query = if let name = slot.mealPeriodName {
            query.eq("meal_period_name", value: name)
        } else {
            query.is("meal_period_name", value: nil)
        }
        query = if let hall = slot.hallId {
            query.eq("hall_id", value: hall)
        } else {
            query.is("hall_id", value: nil)
        }

        let rows: [Row] = try await query.execute().value
        return rows.reduce(into: [:]) { $0[$1.recipe_id, default: 0] += $1.servings }
    }

    /// Per-day totals over a date range. Days with nothing logged are absent.
    static func totalsByDate(from: String, to: String) async throws -> [String: DayTotals] {
        let id = try await userId()
        let rows: [FoodLogRow] = try await client().from("food_log")
            .select("id, recipe_id, service_date, meal_period_name, hall_id, servings, calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot")
            .eq("user_id", value: id)
            .gte("service_date", value: from)
            .lte("service_date", value: to)
            .execute().value

        let byDate = Dictionary(grouping: rows, by: \.serviceDate)
        return byDate.mapValues { rows in
            LogMath.totals(rows.map {
                LogEntry(
                    id: $0.id, recipeId: $0.recipeId, serviceDate: $0.serviceDate,
                    mealPeriodName: $0.mealPeriodName, hallId: $0.hallId, servings: $0.servings,
                    caloriesSnapshot: $0.caloriesSnapshot, proteinSnapshot: $0.proteinSnapshot,
                    carbsSnapshot: $0.carbsSnapshot, fatSnapshot: $0.fatSnapshot, recipeName: ""
                )
            })
        }
    }

    // MARK: Writes

    private static func nullable<T>(_ value: T?, _ wrap: (T) -> AnyJSON) -> AnyJSON {
        value.map(wrap) ?? .null
    }

    private static func slotParams(_ slot: Slot) -> [String: AnyJSON] {
        [
            "p_service_date": .string(slot.serviceDate),
            "p_meal_period_name": nullable(slot.mealPeriodName, AnyJSON.string),
            "p_hall_id": nullable(slot.hallId, AnyJSON.integer),
        ]
    }

    @discardableResult
    static func logFood(recipeId: Int, servings: Double, slot: Slot) async throws -> Int {
        guard servings > 0, servings <= 50 else { throw TrayError.message("Servings must be between 0 and 50.") }
        var params = slotParams(slot)
        params["p_recipe_id"] = .integer(recipeId)
        params["p_servings"] = .double(servings)
        return try await client().rpc("log_food", params: params).execute().value
    }

    /// How much came off: 1, or the whole line when it was a part serving.
    /// Nil when there was nothing in the slot.
    static func removeServing(recipeId: Int, slot: Slot) async throws -> Double? {
        var params = slotParams(slot)
        params["p_recipe_id"] = .integer(recipeId)
        return try await client().rpc("remove_serving", params: params).execute().value
    }

    /// Puts a deleted line back exactly as it was, snapshot and all.
    static func restore(_ entry: LogEntry) async throws {
        var params = slotParams(Slot(serviceDate: entry.serviceDate, mealPeriodName: entry.mealPeriodName, hallId: entry.hallId))
        params["p_recipe_id"] = .integer(entry.recipeId)
        params["p_servings"] = .double(entry.servings)
        params["p_calories_snapshot"] = nullable(entry.caloriesSnapshot, AnyJSON.double)
        params["p_protein_snapshot"] = nullable(entry.proteinSnapshot, AnyJSON.double)
        params["p_carbs_snapshot"] = nullable(entry.carbsSnapshot, AnyJSON.double)
        params["p_fat_snapshot"] = nullable(entry.fatSnapshot, AnyJSON.double)
        try await client().rpc("restore_log", params: params).execute()
    }

    static func updateServings(logId: Int, servings: Double) async throws {
        guard servings > 0, servings <= 50 else { throw TrayError.message("Servings must be between 0 and 50.") }
        let id = try await userId()
        // The user_id filter is belt-and-braces; RLS already scopes this.
        try await client().from("food_log")
            .update(["servings": servings])
            .eq("id", value: logId)
            .eq("user_id", value: id)
            .execute()
    }

    static func removeLog(_ logId: Int) async throws {
        let id = try await userId()
        try await client().from("food_log")
            .delete()
            .eq("id", value: logId)
            .eq("user_id", value: id)
            .execute()
    }

    static func updateProfile(_ profile: Profile) async throws {
        let valid = [profile.calorieGoal, profile.proteinGoalG, profile.carbGoalG, profile.fatGoalG]
            .allSatisfy { $0 > 0 && $0 < 100_000 }
        guard valid else { throw TrayError.message("Goals need to be positive numbers.") }

        let id = try await userId()
        let update: [String: AnyJSON] = [
            "calorie_goal": .integer(profile.calorieGoal),
            "protein_goal_g": .integer(profile.proteinGoalG),
            "carb_goal_g": .integer(profile.carbGoalG),
            "fat_goal_g": .integer(profile.fatGoalG),
            "dietary_prefs": .array(profile.dietaryPrefs.map(AnyJSON.string)),
            "allergens_avoid": .array(profile.allergensAvoid.map(AnyJSON.string)),
            "updated_at": .string(Date.now.ISO8601Format()),
        ]
        try await client().from("profiles").update(update).eq("id", value: id).execute()
    }

    /// Deletes the account and everything hanging off it (migration 0003).
    static func deleteAccount() async throws {
        try await client().rpc("delete_my_account").execute()
    }
}
