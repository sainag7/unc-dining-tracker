import SwiftUI

/// The pill above the tab bar: today's running total, and the way into the tray.
/// Port of src/components/tray-bar.tsx.
struct TrayBar: View {
    @Environment(AppModel.self) private var app
    @State private var open = false

    var body: some View {
        let tray = app.tray
        let goal = app.profile.map { Double($0.calorieGoal) }
        let over = goal.map { Double(tray.calories) > $0 } ?? false

        Group {
            if tray.loadFailed {
                HStack {
                    Text("Couldn't load your tray.").foregroundStyle(Color.textMuted)
                    Spacer()
                    Button("Retry") { Task { await tray.reload() } }
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.accentText)
                }
                .font(.subheadline)
                .padding(.horizontal, 20)
                .frame(height: 50)
                .background(Color.surface, in: Capsule())
            } else {
                Button { open = true } label: {
                    HStack(spacing: 10) {
                        // No goal, no ring: progress toward a number the user
                        // never set would be progress toward a guess.
                        if let goal {
                            ProgressRing(value: Double(tray.calories), goal: goal, color: .deepFg, lineWidth: 3.5) { EmptyView() }
                                .frame(width: 24, height: 24)
                        }
                        Text(tray.count == 0 ? "Tray is empty" : "\(tray.count) on your tray")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.deepFg.opacity(0.85))
                        Spacer()
                        Text(tray.calories.formatted())
                            .font(.title3.weight(.bold)).data()
                            .foregroundStyle(over ? Color.onDeepDanger : Color.deepFg)
                            .contentTransition(.numericText())
                            .animation(.snappy, value: tray.calories)
                        Text("cal").font(.caption2).foregroundStyle(Color.deepFg.opacity(0.7))
                        Image(systemName: "chevron.up").font(.caption.weight(.bold)).foregroundStyle(Color.deepFg.opacity(0.7))
                    }
                    .padding(.horizontal, 18)
                    .frame(height: 50)
                    .background(Color.deep, in: Capsule())
                    .shadow(color: .black.opacity(0.18), radius: 14, y: 6)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Your tray: \(tray.calories) calories, \(tray.count) items")
                .accessibilityHint("Opens the tray")
            }
        }
        .sheet(isPresented: $open) { TraySheet() }
    }
}

/// The tray itself — the only place you can change a line without leaving the
/// menu. Grouped and ordered exactly as the log does it.
struct TraySheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(RootTabs.self) private var tabs
    @State private var error: String?

    var body: some View {
        let tray = app.tray
        NavigationStack {
            List {
                if tray.entries.isEmpty {
                    Text("Nothing on the tray yet. Tap **+** on anything to start.")
                        .foregroundStyle(Color.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                        .listRowBackground(Color.clear)
                }
                if let error { ErrorBanner(text: error).listRowBackground(Color.clear) }
                ForEach(LogMath.groupByMealPeriod(tray.entries), id: \.period) { group in
                    let totals = LogMath.totals(group.entries)
                    Section {
                        ForEach(group.entries) { entry in
                            HStack {
                                Text(entry.recipeName).lineLimit(1)
                                Spacer()
                                QuantityStepper(
                                    servings: entry.servings,
                                    label: entry.recipeName,
                                    onAdd: { change(entry, to: entry.servings + 1) },
                                    onRemove: {
                                        if let next = LogMath.servingsAfterRemoval(entry.servings) {
                                            change(entry, to: next)
                                        } else {
                                            run { try await tray.remove(entry) }
                                        }
                                    }
                                )
                            }
                            .listRowBackground(Color.surface)
                        }
                    } header: {
                        HStack {
                            Text(group.period)
                            Spacer()
                            Text("\(totals.calories) cal · \(totals.protein)g protein").data()
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.bg)
            .navigationTitle("Your tray")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .safeAreaInset(edge: .bottom) {
                Button("Open the full log") {
                    dismiss()
                    tabs.selection = .log
                }
                .buttonStyle(SecondaryButtonStyle())
                .padding(16)
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func change(_ entry: LogEntry, to servings: Double) {
        run { try await app.tray.setServings(entry, to: servings) }
    }

    private func run(_ work: @escaping () async throws -> Void) {
        error = nil
        Task {
            do { try await work() } catch { self.error = error.localizedDescription }
        }
    }
}
