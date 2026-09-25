import Testing
@testable import Tray

// Ports of src/lib/sort.test.ts and src/lib/stations.test.ts.

private func recipe(_ id: Int, _ name: String, calories: Double?) -> Recipe {
    Recipe(id: id, name: name, servingSize: nil, ingredients: nil, allergens: [], properties: [],
           calories: calories, proteinG: nil, carbsG: nil, fatG: nil, satFatG: nil, transFatG: nil,
           cholesterolMg: nil, sodiumMg: nil, fiberG: nil, sugarsG: nil, addedSugarG: nil,
           calciumMg: nil, ironMg: nil, potassiumMg: nil, vitaminDMcg: nil)
}

private func station(_ name: String, items: Int) -> Station {
    Station(name: name, items: (0..<items).map { recipe($0, "\(name) \($0)", calories: 100) })
}

@Suite struct SortTests {
    let stations = [
        Station(name: "Grill", items: [recipe(1, "Chicken", calories: 400), recipe(2, "Unknown", calories: nil)]),
        Station(name: "Bakery", items: [recipe(3, "Waffle", calories: 250), recipe(4, "Zucchini", calories: 40)]),
    ]

    @Test func cycles() {
        #expect(SortMode.station.next == .calAsc)
        #expect(SortMode.calAsc.next == .calDesc)
        #expect(SortMode.calDesc.next == .station)
    }

    @Test func leavesStationOrderAlone() {
        #expect(SortMode.station.apply(stations) == stations)
    }

    @Test func flattensAndSorts() {
        let asc = SortMode.calAsc.apply(stations)
        #expect(asc.count == 1)
        #expect(asc[0].items.map(\.name) == ["Zucchini", "Waffle", "Chicken", "Unknown"])
        let desc = SortMode.calDesc.apply(stations)
        #expect(desc[0].items.map(\.name) == ["Chicken", "Waffle", "Zucchini", "Unknown"])
    }

    @Test func emptyStaysEmpty() {
        #expect(SortMode.calAsc.apply([]).isEmpty)
    }

    @Test func labels() {
        #expect(SortMode.station.label == "Cal")
        #expect(SortMode.calAsc.label == "Cal ↑")
        #expect(SortMode.calDesc.label == "Cal ↓")
    }
}

@Suite struct StationTests {
    @Test func collapsesComponentBarsAndKeepsDishesOpen() {
        let menu = [station("Simply Prepared", items: 6), station("Salad Bar", items: 41),
                    station("Deli", items: 35), station("Desserts", items: 5), station("BEVERAGES", items: 3)]
        let collapsed = Stations.toCollapse(menu)
        #expect(collapsed.contains("Salad Bar"))
        #expect(collapsed.contains("Deli"))
        #expect(collapsed.contains("BEVERAGES"))
        #expect(!collapsed.contains("Simply Prepared"))
        #expect(!collapsed.contains("Desserts"))
    }

    @Test func catchesAnUnfamiliarStationBySize() {
        let result = Stations.toCollapse([station("Yogurt Parfait Station", items: 25), station("Pizza", items: 30)])
        #expect(result.contains("Yogurt Parfait Station"))
        // Main course wins over size.
        #expect(!result.contains("Pizza"))
    }

    @Test func neverCollapsesEverything() {
        let bars = [station("Salad Bar", items: 40), station("Deli", items: 30),
                    station("Condiments", items: 2), station("Cereal", items: 4), station("Beverages", items: 8)]
        let result = Stations.toCollapse(bars)
        #expect(result.count < bars.count)
        #expect(!result.contains("Condiments"))
        #expect(!result.contains("Cereal"))
        #expect(result.contains("Salad Bar"))
        #expect(Stations.toCollapse([]).isEmpty)
    }

    @Test func leadsWithMainsInRankThenMenuOrder() {
        let menu = [station("Waffle Bar", items: 3), station("Salad Bar", items: 40),
                    station("Pizza", items: 4), station("Simply Prepared", items: 5),
                    station("Simply Prepared Griddle", items: 4), station("Desserts", items: 6)]
        let names = Stations.ordered(menu).map(\.name)
        #expect(names == ["Simply Prepared", "Simply Prepared Griddle", "Pizza", "Waffle Bar", "Desserts", "Salad Bar"])
    }

    @Test func overridesBeatDefaults() {
        var overrides = StationOverrides()
        overrides.toggle("Salad Bar", currentlyClosed: true)
        overrides.toggle("Pizza", currentlyClosed: false)
        let closed = overrides.closedSet(defaults: ["Salad Bar", "Deli"])
        #expect(closed == ["Deli", "Pizza"])
    }
}
