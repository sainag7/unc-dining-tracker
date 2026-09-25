import SwiftUI

/// A day's full accounting: totals against goals, and every line by meal.
/// Port of src/app/log/page.tsx and the components it renders.
struct LogView: View {
    @Environment(AppModel.self) private var app
    @Environment(RootTabs.self) private var tabs
    @State private var date = CampusDate.today()
    @State private var entries: [LogEntry] = []
    @State private var history: [String: DayTotals] = [:]
    @State private var loaded = false
    @State private var error: String?
    @State private var removed: LogEntry?
    @State private var showSettings = false

    private static let historyDays = 30
    private var today: String { CampusDate.today() }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    WeekStrip(selected: $date, today: today, logged: Set(history.keys))
                        .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
                        .listRowBackground(Color.clear)

                    DaySummary(totals: LogMath.totals(entries), profile: app.profile)
                        .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 0, trailing: 16))
                        .listRowBackground(Color.clear)

                    if let line = streakLine {
                        Text(line)
                            .font(.footnote)
                            .foregroundStyle(Color.textMuted)
                            .listRowBackground(Color.clear)
                    }

                    if let error { ErrorBanner(text: error).listRowBackground(Color.clear) }
                }
                .listRowSeparator(.hidden)

                if loaded && entries.isEmpty {
                    EmptyState(
                        title: "Nothing logged yet",
                        body: "Tap the add button next to anything on a menu and it lands here.",
                        action: ("Go to menus", { tabs.selection = .menu })
                    )
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }

                ForEach(LogMath.groupByMealPeriod(entries), id: \.period) { group in
                    Section {
                        ForEach(group.entries) { entry in
                            EntryRow(entry: entry) { servings in
                                await update(entry, to: servings)
                            }
                            .swipeActions {
                                Button(role: .destructive) { Task { await remove(entry) } } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .listRowBackground(Color.surface)
                        }
                    } header: {
                        HStack {
                            Text(group.period)
                            Spacer()
                            Text("\(LogMath.totals(group.entries).calories) cal").data()
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.bg)
            .navigationTitle(date == today ? "Today" : CampusDate.format(date, .dateTime.weekday(.wide)))
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Settings") { showSettings = true }
                }
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text(date == today ? "Today" : CampusDate.format(date, .dateTime.weekday(.wide))).font(.headline)
                        Text(CampusDate.format(date, .dateTime.weekday(.wide).month(.wide).day()))
                            .font(.caption).foregroundStyle(Color.textMuted).data()
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await load() }
            .task(id: date) { await load() }
            // The tray sheet or the menu changed today's log.
            .onChange(of: app.tray.entries) { if date == today { Task { await load() } } }
            .overlay(alignment: .bottom) {
                if let removed {
                    UndoToast(message: "Removed \(removed.recipeName)", onUndo: { Task { await undo() } }) {
                        self.removed = nil
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.snappy, value: removed?.id)
            .sheet(isPresented: $showSettings) { SettingsView() }
        }
    }

    private var streakLine: String? {
        guard !history.isEmpty else { return nil }
        let streak = LogMath.currentStreak(Set(history.keys), today: today)
        let average = Int(LogMath.jsRound(Double(history.values.map(\.calories).reduce(0, +)) / Double(history.count)))
        let days = history.count == 1 ? "day" : "days"
        return "\(streak) day streak · \(average.formatted()) cal average over \(history.count) \(days)"
    }

    private func load() async {
        do {
            async let day = LogService.dayLog(date)
            async let totals = LogService.totalsByDate(from: CampusDate.addDays(today, -(Self.historyDays - 1)), to: today)
            entries = try await day
            history = try await totals
            error = nil
        } catch {
            self.error = "Couldn't load your log. \(error.localizedDescription)"
        }
        loaded = true
    }

    private func update(_ entry: LogEntry, to servings: Double) async {
        do {
            if date == today {
                try await app.tray.setServings(entry, to: servings)
            } else {
                try await LogService.updateServings(logId: entry.id, servings: servings)
                await load()
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func remove(_ entry: LogEntry) async {
        entries.removeAll { $0.id == entry.id }
        do {
            if date == today {
                try await app.tray.remove(entry)
            } else {
                try await LogService.removeLog(entry.id)
                await load()
            }
            removed = entry
        } catch {
            self.error = error.localizedDescription
            await load()
        }
    }

    /// Puts back exactly what was deleted, snapshots and all — never a fresh
    /// log_food, which would re-read a recipe UNC may have revised since.
    private func undo() async {
        guard let entry = removed else { return }
        removed = nil
        do {
            try await LogService.restore(entry)
            if entry.serviceDate == app.tray.date { await app.tray.reload() }
            await load()
        } catch {
            self.error = "Couldn't put that back. \(error.localizedDescription)"
        }
    }
}

private struct EntryRow: View {
    let entry: LogEntry
    let onChange: (Double) async -> Void

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.recipeName).font(.subheadline.weight(.semibold)).lineLimit(1)
                Text(detail).font(.caption).foregroundStyle(Color.textMuted).lineLimit(1).data()
            }
            Spacer()
            QuantityStepper(
                servings: entry.servings,
                label: entry.recipeName,
                onAdd: { Task { await onChange(entry.servings + 1) } },
                onRemove: {
                    // A 1× line comes off with a swipe instead; the stepper
                    // stops at the smallest portion rather than deleting.
                    guard let next = LogMath.servingsAfterRemoval(entry.servings) else { return }
                    Task { await onChange(next) }
                }
            )
        }
    }

    private var detail: String {
        let cal = Int(LogMath.jsRound((entry.caloriesSnapshot ?? 0) * entry.servings))
        return [ "\(cal) cal", entry.hallName ].compactMap { $0 }.joined(separator: " · ")
    }
}

/// The last seven days ending today, as a pill picker with a dot on days that
/// have something logged.
private struct WeekStrip: View {
    @Binding var selected: String
    let today: String
    let logged: Set<String>

    var body: some View {
        HStack(spacing: 4) {
            ForEach(CampusDate.range(from: CampusDate.addDays(today, -6), count: 7), id: \.self) { date in
                let isSelected = date == selected
                Button { selected = date } label: {
                    VStack(spacing: 2) {
                        Text(CampusDate.format(date, .dateTime.weekday(.narrow)))
                            .font(.caption2.weight(.semibold))
                        Text(CampusDate.format(date, .dateTime.day()))
                            .font(.subheadline.weight(isSelected ? .bold : .regular)).data()
                        Circle()
                            .fill(logged.contains(date) ? (isSelected ? Color.accentFg : Color.text) : .clear)
                            .frame(width: 4, height: 4)
                    }
                    .foregroundStyle(isSelected ? Color.accentFg : Color.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(isSelected ? Color.carolina : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(date == today ? "Today" : CampusDate.format(date, .dateTime.weekday(.wide).month().day()))
                .accessibilityValue(logged.contains(date) ? "Has entries" : "Nothing logged")
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
    }
}

/// Calories against the goal, then the three macros. Port of
/// src/components/day-summary.tsx.
private struct DaySummary: View {
    let totals: DayTotals
    let profile: Profile?

    var body: some View {
        let goal = profile?.calorieGoal ?? 2000
        let remaining = goal - totals.calories
        let over = remaining < 0

        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Calories").font(.headline)
                // There is no exercise anywhere in this app, so the equation is
                // the two terms that exist.
                Text("Remaining = Goal − Food").font(.caption2).foregroundStyle(Color.textMuted)
                HStack(spacing: 20) {
                    ProgressRing(value: Double(totals.calories), goal: Double(goal)) {
                        VStack(spacing: 0) {
                            Text(abs(remaining).formatted())
                                .font(.title.weight(.semibold)).data()
                                .foregroundStyle(over ? Color.danger : Color.text)
                            Text(over ? "Over" : "Remaining").font(.caption2).foregroundStyle(Color.textMuted)
                        }
                    }
                    .frame(width: 132, height: 132)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Calories: \(totals.calories) of \(goal)")

                    VStack(alignment: .leading, spacing: 10) {
                        tally("Base Goal", goal)
                        tally("Food", totals.calories)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .card()

            VStack(alignment: .leading, spacing: 12) {
                Text("Macros").font(.headline)
                HStack(alignment: .top, spacing: 8) {
                    macro("Carbs", totals.carbs, profile?.carbGoalG ?? 250, .macroCarb)
                    macro("Fat", totals.fat, profile?.fatGoalG ?? 65, .macroFat)
                    macro("Protein", totals.protein, profile?.proteinGoalG ?? 150, .macroProtein)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .card()
        }
        .foregroundStyle(Color.text)
    }

    private func tally(_ label: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label).font(.caption).foregroundStyle(Color.textMuted)
            Text(value.formatted()).font(.headline).data()
        }
    }

    private func macro(_ label: String, _ value: Int, _ goal: Int, _ color: Color) -> some View {
        VStack(spacing: 6) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(color)
            ProgressRing(value: Double(value), goal: Double(goal), color: color, lineWidth: 6) {
                Text("\(value)").font(.headline).data()
            }
            .frame(width: 72, height: 72)
            Text("/\(goal)g").font(.caption2).foregroundStyle(Color.textMuted).data()
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value) of \(goal) grams")
    }
}

/// "Removed X · Undo", for a few seconds.
struct UndoToast: View {
    let message: String
    let onUndo: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        HStack {
            Text(message).lineLimit(1).foregroundStyle(Color.deepFg)
            Spacer()
            Button("Undo", action: onUndo).fontWeight(.bold).foregroundStyle(Color.deepFg)
        }
        .font(.subheadline)
        .padding(.horizontal, 20)
        .frame(height: 50)
        .background(Color.deep, in: Capsule())
        .shadow(color: .black.opacity(0.18), radius: 14, y: 6)
        .task {
            try? await Task.sleep(for: .seconds(5))
            onDismiss()
        }
    }
}
