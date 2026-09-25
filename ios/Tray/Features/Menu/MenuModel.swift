import Foundation
import Observation

/// State behind the menu screen: which hall, date and meal; what's being served;
/// what's already on the tray for that slot; and search, filters and sort.
///
/// The iOS side of src/app/page.tsx plus src/components/menu-browser.tsx.
@Observable @MainActor
final class MenuModel {
    var halls: [DiningHall] = []
    var hallId: Int? { didSet { if hallId != oldValue { Task { await loadPeriods() } } } }
    var date: String = CampusDate.today() { didSet { if date != oldValue { Task { await loadPeriods() } } } }
    private(set) var periods: [MealPeriod] = []
    var periodId: Int? { didSet { if periodId != oldValue { Task { await loadStations() } } } }

    private(set) var stations: [Station] = []
    private(set) var logged: [Int: Double] = [:]
    private(set) var loading = false
    var error: String?

    var query = ""
    var activeFilters: [String] = []
    var sortMode: SortMode = .station
    private(set) var overrides = StationOverrides.load()

    private var filtersSeeded = false

    var hall: DiningHall? { halls.first { $0.id == hallId } }
    var period: MealPeriod? { periods.first { $0.id == periodId } }
    var today: String { CampusDate.today() }

    /// Strict: blank between services, and only ever today.
    var servingNowPeriodId: Int? {
        guard date == today, let i = CampusDate.servingPeriodIndex(periods) else { return nil }
        return periods[i].id
    }

    var slot: Slot { Slot(serviceDate: date, mealPeriodName: period?.name, hallId: hallId) }

    // MARK: Loading

    func load(profile: Profile?) async {
        if !filtersSeeded, let profile {
            // Dietary preferences from Settings turn on as filters, once.
            activeFilters = profile.dietaryPrefs.filter(Labels.filterable.contains)
            filtersSeeded = true
        }
        guard halls.isEmpty else { return }
        do {
            loading = true
            halls = try await MenuService.shared.halls()
            // Chase first — it's the default on the web too.
            hallId = halls.first { $0.slug == "chase" }?.id ?? halls.first?.id
        } catch {
            self.error = "Couldn't load the dining halls. \(error.localizedDescription)"
            loading = false
        }
    }

    /// Pull-to-refresh. Reloading the stations reloads the counts too.
    func refresh() async {
        await MenuService.shared.invalidate()
        error = nil
        // A first load that failed never picked a hall; start over from there.
        guard hallId != nil else {
            halls = []
            await load(profile: nil)
            return
        }
        if let fresh = try? await MenuService.shared.halls() { halls = fresh }
        await loadPeriods()
    }

    private func loadPeriods() async {
        guard let hallId else { return }
        let requestedDate = date
        do {
            loading = true
            let result = try await MenuService.shared.mealPeriods(hallId: hallId, date: requestedDate)
            guard requestedDate == date, hallId == self.hallId else { return }
            // Keep the meal you were looking at when you change hall or day —
            // stepping from Tuesday to Wednesday on dinner stays on dinner.
            let previous = period?.name
            periods = result
            let next = result.first { $0.name == previous }
                ?? (result.isEmpty ? nil : result[CampusDate.currentPeriodIndex(result)])
            if next?.id == periodId {
                await loadStations()
            } else {
                periodId = next?.id
                if next == nil {
                    stations = []
                    loading = false
                }
            }
        } catch {
            self.error = "Couldn't load this menu. \(error.localizedDescription)"
            loading = false
        }
    }

    private func loadStations() async {
        guard let periodId else { return }
        do {
            loading = true
            let result = try await MenuService.shared.stations(periodId: periodId)
            guard periodId == self.periodId else { return }
            stations = Stations.ordered(result)
            error = nil
        } catch {
            self.error = "Couldn't load this menu. \(error.localizedDescription)"
        }
        loading = false
        await loadLogged()
    }

    /// What's already on the tray for the slot on screen. Failing this only
    /// costs the counts on the buttons, so it degrades quietly.
    func loadLogged() async {
        let slot = slot
        guard supabase?.auth.currentUser != nil else {
            logged = [:]
            return
        }
        if let result = try? await LogService.loggedServings(slot), slot == self.slot {
            logged = result
        }
    }

    // MARK: Derived lists

    private func matches(_ item: Recipe) -> Bool {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        if !q.isEmpty && !item.name.lowercased().contains(q) { return false }
        return activeFilters.allSatisfy(item.properties.contains)
    }

    var searching: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty }

    /// Flat matches across every station, including closed ones.
    var searchResults: [(item: Recipe, station: String)] {
        stations.flatMap { station in station.items.filter(matches).map { ($0, station.name) } }
    }

    var visibleStations: [Station] {
        let filtered = stations
            .map { Station(name: $0.name, items: $0.items.filter(matches)) }
            .filter { !$0.items.isEmpty }
        return sortMode.apply(filtered)
    }

    var closedStations: Set<String> {
        overrides.closedSet(defaults: Stations.toCollapse(stations))
    }

    func toggleStation(_ name: String) {
        overrides.toggle(name, currentlyClosed: closedStations.contains(name))
        overrides.save()
    }

    // MARK: Tray writes

    /// Adds one serving. The count and the tray move first; the write follows,
    /// and a failure puts both back.
    func quickAdd(_ item: Recipe, tray: TrayStore) async {
        await add(item, servings: 1, tray: tray)
    }

    func add(_ item: Recipe, servings: Double, tray: TrayStore) async {
        error = nil
        let slot = slot
        let firstHelping = (logged[item.id] ?? 0) == 0
        logged[item.id, default: 0] += servings

        let write = { try await LogService.logFood(recipeId: item.id, servings: servings, slot: slot) }
        do {
            if slot.serviceDate == tray.date {
                try await tray.apply(.init(
                    calories: (item.calories ?? 0) * servings,
                    protein: (item.proteinG ?? 0) * servings,
                    lines: firstHelping ? 1 : 0
                )) { _ = try await write() }
            } else {
                _ = try await write()
            }
        } catch {
            logged[item.id] = max(0, (logged[item.id] ?? servings) - servings)
            self.error = error.localizedDescription
        }
    }

    func quickRemove(_ item: Recipe, tray: TrayStore) async {
        error = nil
        let slot = slot
        let before = logged[item.id] ?? 0
        logged[item.id] = max(0, before - 1)

        do {
            var removed: Double?
            let write = { removed = try await LogService.removeServing(recipeId: item.id, slot: slot) }
            if slot.serviceDate == tray.date {
                try await tray.apply(.init(
                    calories: -(item.calories ?? 0),
                    protein: -(item.proteinG ?? 0),
                    lines: before <= 1 ? -1 : 0
                )) { try await write() }
            } else {
                try await write()
            }
            // A part serving comes off by less than the 1 assumed above.
            if let removed, removed != 1 {
                logged[item.id] = max(0, (logged[item.id] ?? 0) + 1 - removed)
            }
        } catch {
            logged[item.id] = before
            self.error = error.localizedDescription
        }
    }
}
