import Foundation
import Supabase

/// Reads the menu. Port of the queries in src/lib/menu.ts.
///
/// A hall's menu for a date only changes at the nightly scrape, so results are
/// kept in memory for the life of the process — never on disk. A cached menu
/// that silently goes stale offline is worse than one that admits it can't load
/// (see the README's note on offline support).
actor MenuService {
    static let shared = MenuService()

    private var halls: [DiningHall]?
    private var periods: [String: [MealPeriod]] = [:]
    private var stations: [Int: [Station]] = [:]

    func halls() async throws -> [DiningHall] {
        if let halls { return halls }
        let rows: [DiningHall] = try await client()
            .from("dining_halls")
            .select("id, slug, name")
            .eq("active", value: true)
            .order("sort_order")
            .execute().value
        halls = rows
        return rows
    }

    /// The meal periods a hall serves on a date — names and times only.
    func mealPeriods(hallId: Int, date: String) async throws -> [MealPeriod] {
        let key = "\(hallId)|\(date)"
        if let cached = periods[key] { return cached }

        struct DayRow: Decodable { let id: Int }
        struct PeriodRow: Decodable {
            let id: Int
            let name: String
            let time_label: String?
            let start_time: String?
            let end_time: String?
        }

        let db = try client()
        let days: [DayRow] = try await db.from("menu_days")
            .select("id")
            .eq("hall_id", value: hallId)
            .eq("service_date", value: date)
            .limit(1)
            .execute().value

        guard let day = days.first else {
            periods[key] = []
            return []
        }

        let rows: [PeriodRow] = try await db.from("meal_periods")
            .select("id, name, time_label, start_time, end_time")
            .eq("menu_day_id", value: day.id)
            .order("sort_order")
            .execute().value

        let result = rows.map {
            MealPeriod(
                id: $0.id, name: $0.name, timeLabel: $0.time_label,
                startTime: CampusDate.toHHMM($0.start_time),
                endTime: CampusDate.toHHMM($0.end_time)
            )
        }
        periods[key] = result
        return result
    }

    /// Everything served in one meal period, grouped by station in menu order.
    func stations(periodId: Int) async throws -> [Station] {
        if let cached = stations[periodId] { return cached }

        struct ItemRow: Decodable {
            let recipe_id: Int
            let station: String
        }

        let db = try client()
        let items: [ItemRow] = try await db.from("menu_items")
            .select("recipe_id, station")
            .eq("meal_period_id", value: periodId)
            .order("station_order")
            .order("sort_order")
            .execute().value

        var recipesById: [Int: Recipe] = [:]
        let ids = Array(Set(items.map(\.recipe_id)))
        // Chunked to stay clear of URL length limits on the `in` filter.
        for start in stride(from: 0, to: ids.count, by: 400) {
            let chunk = Array(ids[start..<min(start + 400, ids.count)])
            let recipes: [Recipe] = try await db.from("recipes")
                .select()
                .in("id", values: chunk)
                .execute().value
            for recipe in recipes { recipesById[recipe.id] = recipe }
        }

        var order: [String] = []
        var grouped: [String: [Recipe]] = [:]
        for item in items {
            guard let recipe = recipesById[item.recipe_id] else { continue }
            if grouped[item.station] == nil { order.append(item.station) }
            grouped[item.station, default: []].append(recipe)
        }

        let result = order.map { Station(name: $0, items: grouped[$0]!) }
        stations[periodId] = result
        return result
    }

    /// Pull-to-refresh: forget everything and read it fresh.
    func invalidate() {
        halls = nil
        periods = [:]
        stations = [:]
    }
}
