import SwiftUI

/// An item's nutrition, and adding a specific portion of it. Port of
/// src/components/item-sheet.tsx.
struct ItemSheet: View {
    let recipe: Recipe
    let model: MenuModel
    let onSignIn: () -> Void

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var servings: Double = 1
    @State private var pending = false
    @State private var showIngredients = false

    var body: some View {
        let conflicts = Labels.conflicts(recipe.allergens, avoid: app.profile?.allergensAvoid ?? [])
        let already = model.logged[recipe.id] ?? 0

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let size = recipe.servingSize {
                        Text("One serving: \(size)").font(.footnote).foregroundStyle(Color.textMuted).data()
                    }

                    if !conflicts.isEmpty {
                        ErrorBanner(text: "Contains \(conflicts.map(Labels.allergen).joined(separator: ", ")) — you asked to avoid that.")
                    }

                    if already > 0 {
                        Text("Already logged for this meal: **\(Servings.format(already))**")
                            .font(.footnote).foregroundStyle(Color.textMuted)
                    }

                    if !recipe.properties.isEmpty {
                        Text(recipe.properties.map(Labels.property).joined(separator: " · "))
                            .font(.footnote).foregroundStyle(Color.textMuted)
                    }

                    if !recipe.allergens.isEmpty {
                        Text("Allergens: \(recipe.allergens.map(Labels.allergen).joined(separator: ", "))")
                            .font(.footnote).foregroundStyle(Color.textMuted)
                    }

                    if app.isSignedIn {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("How much did you have").placard()
                                Spacer()
                                Text(Servings.format(servings)).font(.subheadline.weight(.semibold)).data()
                            }
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(Servings.steps, id: \.self) { step in
                                        let on = step == servings
                                        Button { servings = step } label: {
                                            Text(Servings.format(step))
                                                .font(.subheadline.weight(on ? .bold : .regular)).data()
                                                .frame(width: 56, height: 44)
                                                .foregroundStyle(on ? Color.accentFg : Color.textMuted)
                                                .background(on ? Color.carolina : Color.clear, in: Capsule())
                                                .overlay(Capsule().strokeBorder(on ? Color.clear : Color.border, lineWidth: 1))
                                        }
                                        .buttonStyle(.plain)
                                        .accessibilityAddTraits(on ? .isSelected : [])
                                    }
                                }
                            }
                        }
                        .padding(.top, 4)
                    }

                    NutritionLabel(recipe: recipe, servings: servings)
                        .animation(.snappy, value: servings)

                    if let ingredients = recipe.ingredients, !ingredients.isEmpty {
                        DisclosureGroup("Ingredients", isExpanded: $showIngredients) {
                            Text(ingredients).font(.footnote).foregroundStyle(Color.textMuted).padding(.top, 6)
                        }
                        .font(.subheadline.weight(.semibold))
                        .tint(Color.text)
                    }

                    if let error = model.error, pending == false, !error.isEmpty {
                        ErrorBanner(text: error)
                    }
                }
                .padding(16)
            }
            .background(Color.bg)
            .navigationTitle(recipe.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
            .safeAreaInset(edge: .bottom) {
                Group {
                    if app.isSignedIn {
                        Button {
                            pending = true
                            Task {
                                await model.add(recipe, servings: servings, tray: app.tray)
                                pending = false
                                if model.error == nil { dismiss() }
                            }
                        } label: {
                            Text(pending ? "Adding…" : "Add \(Servings.format(servings)) to \(model.period?.name ?? "today")")
                        }
                        .buttonStyle(DeepButtonStyle())
                        .disabled(pending)
                    } else {
                        Button("Sign in to track this", action: onSignIn).buttonStyle(DeepButtonStyle())
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.bar)
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
