import Foundation
import Observation

/// Today's tray: the server's log for today plus any changes still in flight.
///
/// Same idea as src/components/tray-provider.tsx. A tap moves the numbers
/// immediately using figures the row already has, the write follows, and the
/// server's answer replaces the guess once it lands. A failed write takes its
/// guess back out.
@Observable @MainActor
final class TrayStore {
    struct Delta: Sendable {
        var calories: Double
        var protein: Double
        /// A first helping adds a line; a second only adds calories. +1, 0, -1.
        var lines: Int
    }

    private(set) var entries: [LogEntry] = []
    private(set) var loadFailed = false
    private var pending: [UUID: Delta] = [:]
    /// Deltas whose write has succeeded, waiting for a reload to absorb them.
    private var settled: Set<UUID> = []

    var date: String { CampusDate.today() }

    private var base: DayTotals { LogMath.totals(entries) }
    private var delta: Delta {
        pending.values.reduce(Delta(calories: 0, protein: 0, lines: 0)) {
            Delta(calories: $0.calories + $1.calories, protein: $0.protein + $1.protein, lines: $0.lines + $1.lines)
        }
    }

    // Clamped at zero: two fast decrements can both read the same base, and a
    // tray reading "-90 cal" is worse than one that briefly reads 0.
    var calories: Int { max(0, base.calories + Int(LogMath.jsRound(delta.calories))) }
    var protein: Int { max(0, base.protein + Int(LogMath.jsRound(delta.protein))) }
    var count: Int { max(0, entries.count + delta.lines) }

    func clear() {
        entries = []
        pending = [:]
        settled = []
        loadFailed = false
    }

    func reload() async {
        let absorbed = settled
        do {
            entries = try await LogService.dayLog(date)
            loadFailed = false
            for id in absorbed { pending[id] = nil }
            settled.subtract(absorbed)
        } catch {
            loadFailed = entries.isEmpty
        }
    }

    /// Moves the totals now, runs `write`, then settles up either way.
    func apply(_ change: Delta, write: @escaping () async throws -> Void) async throws {
        let id = UUID()
        pending[id] = change
        do {
            try await write()
            settled.insert(id)
            await reload()
        } catch {
            pending[id] = nil
            throw error
        }
    }

    // MARK: Lines on the tray itself

    func setServings(_ entry: LogEntry, to servings: Double) async throws {
        let step = servings - entry.servings
        try await apply(Delta(
            calories: (entry.caloriesSnapshot ?? 0) * step,
            protein: (entry.proteinSnapshot ?? 0) * step,
            lines: 0
        )) {
            try await LogService.updateServings(logId: entry.id, servings: servings)
        }
    }

    func remove(_ entry: LogEntry) async throws {
        try await apply(Delta(
            calories: -(entry.caloriesSnapshot ?? 0) * entry.servings,
            protein: -(entry.proteinSnapshot ?? 0) * entry.servings,
            lines: -1
        )) {
            try await LogService.removeLog(entry.id)
        }
    }
}
