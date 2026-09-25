import Foundation

/// Station ordering and default collapse. Port of src/lib/stations.ts — read
/// that file for the measurements behind these lists.
enum Stations {
    /// Stations that serve an actual plate of food, in the order they lead.
    /// Matched by substring.
    static let mainCourse = [
        "simply prepared", "made-to-order", "the grill", "the griddle",
        "the kitchen table", "build your own", "burritos", "international flavors",
        "pizza", "pasta", "sushi", "plant forward",
    ]

    /// Self-serve component bars. They belong at the bottom, closed.
    static let component = [
        "salad bar", "deli", "beverage", "condiment", "cereal",
        "bagels", "breads", "stress less", "hummus bar",
    ]

    /// No station of actual dishes runs this long.
    static let largeStation = 20

    static func mainCourseRank(_ name: String) -> Int? {
        let lower = name.lowercased()
        return mainCourse.firstIndex { lower.contains($0) }
    }

    /// 0 = main course, 1 = sides and sweets, 2 = component bar.
    static func tier(_ station: Station) -> Int {
        if mainCourseRank(station.name) != nil { return 0 }
        let lower = station.name.lowercased()
        let isComponent = component.contains { lower.contains($0) } || station.items.count > largeStation
        return isComponent ? 2 : 1
    }

    /// Main courses lead, component bars sink; menu order is kept within a tier.
    static func ordered(_ stations: [Station]) -> [Station] {
        stations.enumerated().sorted { a, b in
            let ta = tier(a.element), tb = tier(b.element)
            if ta != tb { return ta < tb }
            if ta == 0 {
                let ra = mainCourseRank(a.element.name)!, rb = mainCourseRank(b.element.name)!
                if ra != rb { return ra < rb }
            }
            return a.offset < b.offset
        }.map(\.element)
    }

    /// Stations that open collapsed. If the rule would close everything it has
    /// misfired for this menu, so the three smallest stay open.
    static func toCollapse(_ stations: [Station]) -> Set<String> {
        var collapse = Set(stations.filter { tier($0) == 2 }.map(\.name))
        if !stations.isEmpty && collapse.count == stations.count {
            for station in stations.sorted(by: { $0.items.count < $1.items.count }).prefix(3) {
                collapse.remove(station.name)
            }
        }
        return collapse
    }
}

/// Which stations the user has explicitly opened or closed. Only the overrides
/// are stored, so `Stations.toCollapse` keeps deciding for everything else.
/// The iOS side of src/lib/station-prefs.ts.
struct StationOverrides: Codable, Equatable {
    var opened: [String] = []
    var closed: [String] = []

    private static let key = "tray.stations.v1"

    static func load() -> StationOverrides {
        guard let data = UserDefaults.standard.data(forKey: key),
              let value = try? JSONDecoder().decode(StationOverrides.self, from: data)
        else { return StationOverrides() }
        return value
    }

    func save() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }

    func closedSet(defaults: Set<String>) -> Set<String> {
        defaults.union(closed).subtracting(opened)
    }

    mutating func toggle(_ name: String, currentlyClosed: Bool) {
        opened.removeAll { $0 == name }
        closed.removeAll { $0 == name }
        if currentlyClosed { opened.append(name) } else { closed.append(name) }
    }
}
