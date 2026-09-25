import Testing
@testable import Tray

// Ports of src/lib/log.test.ts, plus the label and serving helpers.

private func entry(_ id: Int, period: String?, servings: Double = 1, calories: Double? = 100, protein: Double? = 10) -> LogEntry {
    LogEntry(id: id, recipeId: id, serviceDate: "2026-08-20", mealPeriodName: period, hallId: 1,
             servings: servings, caloriesSnapshot: calories, proteinSnapshot: protein,
             carbsSnapshot: nil, fatSnapshot: nil, recipeName: "Item \(id)")
}

@Suite struct LogMathTests {
    @Test func totalsScaleByServingsAndRoundOnce() {
        let totals = LogMath.totals([
            entry(1, period: "Lunch", servings: 1.5, calories: 101, protein: 3.3),
            entry(2, period: "Lunch", servings: 0.5, calories: 101, protein: 3.3),
        ])
        #expect(totals.calories == 202)
        #expect(totals.protein == 7)
    }

    @Test func missingSnapshotsCountAsZero() {
        #expect(LogMath.totals([entry(1, period: nil, calories: nil, protein: nil)]) == DayTotals())
    }

    @Test func groupsInTheOrderMealsHappen() {
        let groups = LogMath.groupByMealPeriod([
            entry(1, period: "Dinner"), entry(2, period: nil), entry(3, period: "Breakfast"),
            entry(4, period: "Mystery Meal"), entry(5, period: "Continental"), entry(6, period: "Dinner"),
        ])
        #expect(groups.map(\.period) == ["Breakfast", "Continental", "Dinner", "Mystery Meal", "Other"])
        #expect(groups[2].entries.map(\.id) == [1, 6])
    }

    @Test func goalProgressClampsAndFlagsOvershoot() {
        #expect(LogMath.goalProgress(500, goal: 2000) == GoalProgress(pct: 25, over: false))
        #expect(LogMath.goalProgress(2500, goal: 2000) == GoalProgress(pct: 100, over: true))
        #expect(LogMath.goalProgress(100, goal: 0) == GoalProgress(pct: 0, over: false))
    }

    @Test func removingAServing() {
        #expect(LogMath.servingsAfterRemoval(3) == 2)
        #expect(LogMath.servingsAfterRemoval(1.5) == 0.5)
        #expect(LogMath.servingsAfterRemoval(1) == nil)
        #expect(LogMath.servingsAfterRemoval(0.5) == nil)
    }

    @Test func streakSurvivesUntilTheMissedDayIsOver() {
        #expect(LogMath.currentStreak(["2026-08-18", "2026-08-19", "2026-08-20"], today: "2026-08-20") == 3)
        #expect(LogMath.currentStreak(["2026-08-18", "2026-08-19"], today: "2026-08-20") == 2)
        #expect(LogMath.currentStreak(["2026-08-17"], today: "2026-08-20") == 0)
        #expect(LogMath.currentStreak(["2026-08-31", "2026-09-01"], today: "2026-09-01") == 2)
    }

    @Test func roundsLikeJavaScript() {
        #expect(LogMath.jsRound(2.5) == 3)
        #expect(LogMath.jsRound(-2.5) == -2)
        #expect(LogMath.jsRound(2.4) == 2)
    }

    @Test func allergenConflictsAreFlagged() {
        #expect(Labels.conflicts(["milk", "egg", "soy"], avoid: ["egg", "peanut"]) == ["egg"])
        #expect(Labels.conflicts(["milk"], avoid: []).isEmpty)
        #expect(Labels.allergen("treenut") == "Tree nut")
        #expect(Labels.allergen("unknown") == "unknown")
    }

    @Test func dietTagsDropVegetarianWhenVegan() {
        #expect(DietTags.line(["vegetarian", "vegan", "halal"]) == "Vegan · Halal")
        #expect(DietTags.line(["local"]) == nil)
    }

    @Test func servingsFormat() {
        #expect(Servings.format(2) == "2×")
        #expect(Servings.format(1.5) == "1.5×")
        #expect(Servings.format(0.25) == "0.25×")
    }
}
