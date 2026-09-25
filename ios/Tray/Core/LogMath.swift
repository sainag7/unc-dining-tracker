import Foundation

/// Pure log arithmetic. Port of the pure half of src/lib/log.ts.
struct DayTotals: Equatable, Sendable {
    var calories = 0
    var protein = 0
    var carbs = 0
    var fat = 0
}

struct GoalProgress: Equatable {
    /// 0-100, clamped. The overshoot lives in `over`.
    let pct: Double
    let over: Bool
}

struct MealGroup<T> {
    let period: String
    let entries: [T]
}

enum LogMath {
    /// Entries with no meal period recorded. Always sorts last.
    static let otherMeal = "Other"

    /// The order meals happen in, which is not the order they get logged in.
    static let mealPeriodOrder = [
        "Breakfast", "Continental", "Brunch", "Lunch",
        "Late Lunch", "Dinner", "Late Dinner", "Late Night",
    ]

    /// Sums entries, scaling each snapshot by its servings; rounds once at the end.
    static func totals(_ entries: [LogEntry]) -> DayTotals {
        var cal = 0.0, pro = 0.0, carb = 0.0, fat = 0.0
        for e in entries {
            cal += (e.caloriesSnapshot ?? 0) * e.servings
            pro += (e.proteinSnapshot ?? 0) * e.servings
            carb += (e.carbsSnapshot ?? 0) * e.servings
            fat += (e.fatSnapshot ?? 0) * e.servings
        }
        return DayTotals(
            calories: Int(jsRound(cal)), protein: Int(jsRound(pro)),
            carbs: Int(jsRound(carb)), fat: Int(jsRound(fat))
        )
    }

    /// Splits a day into meal periods, in the order the meals happen. Unknown
    /// period names keep their relative order after the known ones.
    static func groupByMealPeriod(_ entries: [LogEntry]) -> [MealGroup<LogEntry>] {
        var order: [String] = []
        var groups: [String: [LogEntry]] = [:]
        for entry in entries {
            let key = entry.mealPeriodName ?? otherMeal
            if groups[key] == nil { order.append(key) }
            groups[key, default: []].append(entry)
        }
        func rank(_ period: String) -> Int {
            if period == otherMeal { return .max }
            return mealPeriodOrder.firstIndex(of: period) ?? mealPeriodOrder.count
        }
        return order.enumerated()
            .sorted { rank($0.element) != rank($1.element) ? rank($0.element) < rank($1.element) : $0.offset < $1.offset }
            .map { MealGroup(period: $0.element, entries: groups[$0.element]!) }
    }

    static func goalProgress(_ value: Double, goal: Double) -> GoalProgress {
        GoalProgress(
            pct: goal > 0 ? min(100, value / goal * 100) : 0,
            over: goal > 0 && value > goal
        )
    }

    /// What an entry becomes when one serving comes off, or nil when the row
    /// should be deleted. Mirrors `remove_serving` in migration 0003.
    static func servingsAfterRemoval(_ servings: Double) -> Double? {
        servings > 1 ? servings - 1 : nil
    }

    /// Consecutive logged days ending today — or yesterday, since a streak isn't
    /// broken until the missed day is over.
    static func currentStreak(_ logged: Set<String>, today: String) -> Int {
        var cursor = logged.contains(today) ? today : CampusDate.addDays(today, -1)
        var streak = 0
        while logged.contains(cursor) {
            streak += 1
            cursor = CampusDate.addDays(cursor, -1)
        }
        return streak
    }

    /// JavaScript's Math.round (half rounds toward +∞), so totals match the web
    /// app to the calorie. Swift's default rounds half away from zero.
    static func jsRound(_ x: Double) -> Double { (x + 0.5).rounded(.down) }
}
