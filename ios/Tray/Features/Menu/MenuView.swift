import SwiftUI

/// What's being served, and the fastest way to put it on the tray.
///
/// The person using this is standing in the serving line with a phone in one
/// hand. The masthead scrolls away; station headers pin, so the pan you're
/// looking at is always named. DESIGN.md has the full argument.
struct MenuView: View {
    @Environment(AppModel.self) private var app
    @State private var model = MenuModel()
    @State private var detail: Recipe?
    @State private var showFilters = false
    @State private var askSignIn = false

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12, pinnedViews: [.sectionHeaders]) {
                masthead
                searchRow
                if let error = model.error { ErrorBanner(text: error) }
                content
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .scrollDismissesKeyboard(.immediately)
        .background(Color.bg)
        .refreshable { await model.refresh() }
        .safeAreaInset(edge: .bottom) {
            if app.isSignedIn { TrayBar().padding(.horizontal, 16).padding(.bottom, 8) }
        }
        .task { await model.load(profile: app.profile) }
        .onChange(of: app.userId) { Task { await model.loadLogged() } }
        .onChange(of: app.profile) { Task { await model.load(profile: app.profile) } }
        // Something changed on the tray sheet — the counts on the rows follow.
        .onChange(of: app.tray.entries) { Task { await model.loadLogged() } }
        .sheet(item: $detail) { recipe in
            ItemSheet(recipe: recipe, model: model, onSignIn: { detail = nil; askSignIn = true })
        }
        .sheet(isPresented: $showFilters) { FilterSheet(active: $model.activeFilters) }
        .sheet(isPresented: $askSignIn) { LoginView() }
    }

    // MARK: Masthead

    private var masthead: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(model.hall?.shortName ?? "Tray")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(Color.text)
                Spacer()
                dateStepper
            }
            .padding(.top, 8)

            if model.halls.count > 1 {
                PillPicker(
                    options: model.halls.map { .init(value: $0.id, label: $0.shortName) },
                    selection: Binding(get: { model.hallId ?? -1 }, set: { model.hallId = $0 })
                )
            }

            if !model.periods.isEmpty {
                PillPicker(
                    options: model.periods.map {
                        .init(value: $0.id, label: sentenceCase($0.name), live: $0.id == model.servingNowPeriodId)
                    },
                    selection: Binding(get: { model.periodId ?? -1 }, set: { model.periodId = $0 })
                )
                if let status = statusLine { Text(status).font(.footnote).foregroundStyle(Color.textMuted) }
            }
        }
    }

    private var dateStepper: some View {
        HStack(spacing: 0) {
            Button { model.date = CampusDate.addDays(model.date, -1) } label: {
                Image(systemName: "chevron.left").frame(width: 44, height: 44)
            }
            .accessibilityLabel("Previous day")
            Button { model.date = model.today } label: {
                Text(model.date == model.today ? "Today" : CampusDate.format(model.date, .dateTime.weekday(.abbreviated).month(.abbreviated).day()))
                    .font(.subheadline.weight(.semibold))
                    .data()
            }
            .disabled(model.date == model.today)
            Button { model.date = CampusDate.addDays(model.date, 1) } label: {
                Image(systemName: "chevron.right").frame(width: 44, height: 44)
            }
            .accessibilityLabel("Next day")
        }
        .foregroundStyle(Color.text)
        .buttonStyle(.plain)
    }

    /// "Serving now until 5:00pm", or UNC's own label when times won't parse.
    private var statusLine: String? {
        guard let period = model.period else { return nil }
        if period.id == model.servingNowPeriodId, let end = CampusDate.formatClock(period.endTime) {
            return "Serving now until \(end)"
        }
        if let start = CampusDate.formatClock(period.startTime), let end = CampusDate.formatClock(period.endTime) {
            return "\(start) – \(end)"
        }
        return period.timeLabel
    }

    // MARK: Search, sort, filter

    private var searchRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Color.textMuted)
                    TextField("Search", text: $model.query)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityLabel("Search this menu")
                    if !model.query.isEmpty {
                        Button { model.query = "" } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(Color.textFaint)
                        }
                        .accessibilityLabel("Clear search")
                    }
                }
                .padding(.horizontal, 16)
                .frame(height: 48)
                .card(radius: 24)

                Button { model.sortMode = model.sortMode.next } label: {
                    Label(model.sortMode.label, systemImage: "arrow.up.arrow.down")
                        .labelStyle(.titleAndIcon)
                }
                .accessibilityLabel("Sort by calories. Currently \(model.sortMode.spoken).")
                .buttonStyle(ChipButtonStyle(active: model.sortMode != .station))

                Button { showFilters = true } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "slider.horizontal.3")
                        if !model.activeFilters.isEmpty { Text("\(model.activeFilters.count)").data() }
                    }
                }
                .accessibilityLabel(model.activeFilters.isEmpty ? "Filters" : "Filters. \(model.activeFilters.count) active.")
                .buttonStyle(ChipButtonStyle(active: !model.activeFilters.isEmpty))
            }

            if !model.activeFilters.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(model.activeFilters, id: \.self) { key in
                            Button { model.activeFilters.removeAll { $0 == key } } label: {
                                HStack(spacing: 4) { Text(Labels.property(key)); Image(systemName: "xmark") }
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Color.text)
                                    .padding(.horizontal, 12)
                                    .frame(height: 32)
                                    .card(radius: 16)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Remove \(Labels.property(key)) filter")
                        }
                        Button("Clear all") { model.activeFilters = [] }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.accentText)
                    }
                }
            }
        }
    }

    // MARK: The menu itself

    @ViewBuilder
    private var content: some View {
        if model.loading && model.stations.isEmpty {
            ProgressView().padding(.top, 60)
        } else if model.periods.isEmpty && !model.loading && model.error == nil {
            EmptyState(
                title: "No menu for this day",
                body: "UNC hasn't published one yet, or the hall is closed.",
                action: model.date == model.today ? nil : ("Back to today", { model.date = model.today })
            )
        } else if model.searching {
            let results = model.searchResults
            if results.isEmpty {
                EmptyState(title: "No matches", body: "Nothing on this menu matches “\(model.query.trimmingCharacters(in: .whitespaces))”.",
                           action: ("Clear search", { model.query = "" }))
            } else {
                StationCard(title: "Results", count: results.count, collapsed: false, onToggle: nil) {
                    ForEach(Array(results.enumerated()), id: \.offset) { _, result in
                        row(result.item, stationLabel: result.station)
                    }
                }
            }
        } else {
            let visible = model.visibleStations
            if visible.isEmpty && !model.stations.isEmpty {
                EmptyState(
                    title: "Nothing matches",
                    body: "No items are \(model.activeFilters.map(Labels.property).joined(separator: " and ")). Clearing the filters shows the whole menu.",
                    action: ("Clear filters", { model.activeFilters = [] })
                )
            }
            let grouped = model.sortMode == .station
            let closed = model.closedStations
            ForEach(visible) { station in
                let isClosed = grouped && closed.contains(station.name)
                StationCard(
                    title: station.name,
                    count: station.items.count,
                    collapsed: isClosed,
                    onToggle: grouped ? { withAnimation(.snappy) { model.toggleStation(station.name) } } : nil
                ) {
                    ForEach(Array(station.items.enumerated()), id: \.offset) { _, item in row(item) }
                }
            }
        }
    }

    private func row(_ item: Recipe, stationLabel: String? = nil) -> some View {
        MenuRow(
            item: item,
            servings: model.logged[item.id] ?? 0,
            allergensAvoid: app.profile?.allergensAvoid ?? [],
            isSignedIn: app.isSignedIn,
            stationLabel: stationLabel,
            onAdd: { Task { await model.quickAdd(item, tray: app.tray) } },
            onRemove: { Task { await model.quickRemove(item, tray: app.tray) } },
            onOpen: { detail = item },
            onSignIn: { askSignIn = true }
        )
    }

    /// "LATE LUNCH" → "Late lunch". Display only; the stored name is the key.
    private func sentenceCase(_ name: String) -> String {
        name.prefix(1).uppercased() + name.dropFirst().lowercased()
    }
}

/// One station: a pinned header and its rows, on one card.
struct StationCard<Rows: View>: View {
    let title: String
    let count: Int
    let collapsed: Bool
    let onToggle: (() -> Void)?
    @ViewBuilder var rows: () -> Rows

    var body: some View {
        Section {
            if !collapsed {
                VStack(spacing: 0) { rows() }
                    .background(Color.surface)
                    .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: Radius.xl, bottomTrailingRadius: Radius.xl, style: .continuous))
                    .shadow(color: Color.text.opacity(0.05), radius: 8, y: 3)
                    .padding(.top, -12)
            }
        } header: {
            header
        }
    }

    private var header: some View {
        let shape = UnevenRoundedRectangle(
            topLeadingRadius: Radius.xl,
            bottomLeadingRadius: collapsed ? Radius.xl : 0,
            bottomTrailingRadius: collapsed ? Radius.xl : 0,
            topTrailingRadius: Radius.xl,
            style: .continuous
        )
        let content = HStack {
            Text(title)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Color.text)
                .lineLimit(1)
            Spacer()
            Text("\(count)").font(.caption).data().foregroundStyle(Color.textMid)
            if onToggle != nil {
                Image(systemName: "chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.textMid)
                    .rotationEffect(.degrees(collapsed ? 0 : 180))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .background(Color.surface, in: shape)
        .overlay(alignment: .bottom) {
            if !collapsed { Rectangle().fill(Color.border).frame(height: 0.5) }
        }
        .contentShape(shape)

        return Group {
            if let onToggle {
                Button(action: onToggle) { content }
                    .buttonStyle(.plain)
                    .accessibilityValue(collapsed ? "Collapsed" : "Expanded")
                    .accessibilityHint(collapsed ? "Shows \(count) items" : "Hides this station")
            } else {
                content
            }
        }
    }
}

struct ChipButtonStyle: ButtonStyle {
    let active: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(active ? Color.accentText : Color.textMid)
            .padding(.horizontal, 14)
            .frame(height: 48)
            .card(radius: 24)
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

struct ErrorBanner: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.danger)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.dangerBg, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .accessibilityAddTraits(.isStaticText)
    }
}

/// An empty screen carries the button that resolves it.
struct EmptyState: View {
    let title: String
    let body_: String
    let action: (label: String, run: () -> Void)?

    init(title: String, body: String, action: (String, () -> Void)? = nil) {
        self.title = title
        self.body_ = body
        self.action = action.map { (label: $0.0, run: $0.1) }
    }

    var body: some View {
        VStack(spacing: 6) {
            Text(title).font(.headline).foregroundStyle(Color.text)
            Text(body_).font(.subheadline).foregroundStyle(Color.textMuted).multilineTextAlignment(.center)
            if let action {
                Button(action.label, action: action.run)
                    .buttonStyle(SecondaryButtonStyle())
                    .frame(maxWidth: 220)
                    .padding(.top, 10)
            }
        }
        .frame(maxWidth: 320)
        .padding(.vertical, 56)
    }
}

struct FilterSheet: View {
    @Binding var active: [String]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(Labels.filterable, id: \.self) { key in
                let on = active.contains(key)
                Button {
                    if on { active.removeAll { $0 == key } } else { active.append(key) }
                } label: {
                    HStack {
                        Text(Labels.property(key)).foregroundStyle(Color.text)
                        Spacer()
                        Image(systemName: on ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(on ? Color.carolina : Color.borderStrong)
                            .font(.title3)
                    }
                }
                .accessibilityAddTraits(on ? .isSelected : [])
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Clear all") { active = [] }.disabled(active.isEmpty)
                }
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.medium])
    }
}
