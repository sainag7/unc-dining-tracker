import SwiftUI

/// Goals, dietary preferences, allergens, and the account. Port of
/// src/app/settings/page.tsx and src/components/settings-form.tsx.
struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var draft: Profile?
    @State private var saving = false
    @State private var status: String?
    @State private var error: String?
    @State private var confirmDelete = false
    @State private var deleting = false

    var body: some View {
        NavigationStack {
            Form {
                if let draft = Binding($draft) {
                    Section("Daily goals") {
                        goalField("Calories", value: draft.calorieGoal, unit: "cal")
                        goalField("Protein", value: draft.proteinGoalG, unit: "g")
                        goalField("Carbs", value: draft.carbGoalG, unit: "g")
                        goalField("Fat", value: draft.fatGoalG, unit: "g")
                    }

                    Section {
                        ForEach(Labels.filterable, id: \.self) { key in
                            Toggle(Labels.property(key), isOn: membership(key, in: draft.dietaryPrefs))
                        }
                    } header: {
                        Text("Dietary preferences")
                    } footer: {
                        Text("These turn on as filters when you open a menu.")
                    }

                    Section {
                        ForEach(Labels.allergens, id: \.key) { pair in
                            Toggle(pair.value, isOn: membership(pair.key, in: draft.allergensAvoid))
                        }
                    } header: {
                        Text("Allergens")
                    } footer: {
                        Text("Items containing these get a warning on the menu. They stay visible — UNC cooks in a shared kitchen, so always check with staff if it matters.")
                    }

                    Section {
                        Button(saving ? "Saving…" : "Save settings") { Task { await save() } }
                            .disabled(saving || draft.wrappedValue == app.profile)
                        if let status { Text(status).foregroundStyle(Color.textMuted) }
                        if let error { Text(error).foregroundStyle(Color.danger) }
                    }
                } else if app.isSignedIn {
                    Section { ProgressView() }
                }

                Section("Account") {
                    if let email = app.email { LabeledContent("Signed in as", value: email) }
                    Button("Sign out") {
                        Task {
                            await app.signOut()
                            dismiss()
                        }
                    }
                    Button(deleting ? "Deleting…" : "Delete account", role: .destructive) { confirmDelete = true }
                        .disabled(deleting)
                }

                Section {
                    if let url = AppConfig.privacyPolicyURL { Link("Privacy policy", destination: url) }
                    LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—")
                } footer: {
                    Text("Tray isn't affiliated with UNC Dining. Menus and nutrition come from dining.unc.edu.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.bg)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .task {
                await app.reloadProfile()
                draft = app.profile
            }
            .confirmationDialog("Delete your account?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete everything", role: .destructive) { Task { await deleteAccount() } }
            } message: {
                Text("This deletes your account, your goals and every meal you've logged. It can't be undone.")
            }
        }
    }

    private func goalField(_ label: String, value: Binding<Int>, unit: String) -> some View {
        LabeledContent(label) {
            HStack(spacing: 6) {
                TextField(label, value: value, format: .number)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .data()
                Text(unit).foregroundStyle(Color.textMuted).frame(width: 28, alignment: .leading)
            }
        }
    }

    private func membership(_ key: String, in list: Binding<[String]>) -> Binding<Bool> {
        Binding(
            get: { list.wrappedValue.contains(key) },
            set: { on in
                if on { list.wrappedValue.append(key) } else { list.wrappedValue.removeAll { $0 == key } }
            }
        )
    }

    private func save() async {
        guard let draft else { return }
        saving = true
        status = nil
        error = nil
        do {
            try await app.saveProfile(draft)
            status = "Settings saved."
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }

    private func deleteAccount() async {
        deleting = true
        do {
            try await app.deleteAccount()
            dismiss()
        } catch {
            self.error = "Could not delete your account: \(error.localizedDescription)"
        }
        deleting = false
    }
}
