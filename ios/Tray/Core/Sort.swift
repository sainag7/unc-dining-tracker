import Foundation

/// How the menu is ordered. Port of src/lib/sort.ts.
enum SortMode: String, CaseIterable, Sendable {
    case station
    case calAsc = "cal-asc"
    case calDesc = "cal-desc"

    /// Cycles station → ascending → descending → station.
    var next: SortMode {
        let all = Self.allCases
        return all[(all.firstIndex(of: self)! + 1) % all.count]
    }

    var label: String {
        switch self {
        case .station: "Cal"
        case .calAsc: "Cal ↑"
        case .calDesc: "Cal ↓"
        }
    }

    var spoken: String {
        switch self {
        case .station: "grouped by station"
        case .calAsc: "sorted by calories, lowest first"
        case .calDesc: "sorted by calories, highest first"
        }
    }

    /// Calorie modes flatten everything into one ranking. Items with no calorie
    /// data sort last either way — an unknown is not a low number.
    func apply(_ stations: [Station], flatLabel: String = "By calories") -> [Station] {
        guard self != .station else { return stations }
        let ascending = self == .calAsc
        let sorted = stations.flatMap(\.items).enumerated().sorted { a, b in
            switch (a.element.calories, b.element.calories) {
            case (nil, nil): return a.offset < b.offset
            case (nil, _): return false
            case (_, nil): return true
            case let (l?, r?):
                if l == r { return a.offset < b.offset }
                return ascending ? l < r : l > r
            }
        }.map(\.element)
        return sorted.isEmpty ? [] : [Station(name: flatLabel, items: sorted)]
    }
}
