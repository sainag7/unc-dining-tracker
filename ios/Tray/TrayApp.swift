import SwiftUI

@main
struct TrayApp: App {
    @State private var app = AppModel()
    @State private var tabs = RootTabs()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .environment(tabs)
                .tint(Color.carolina)
                .task { app.start() }
                // OAuth and email-confirmation links come back as tray://…
                .onOpenURL { url in
                    Task { try? await app.handle(url: url) }
                }
        }
    }
}

@Observable @MainActor
final class RootTabs {
    enum Tab: Hashable { case menu, log }
    var selection: Tab = .menu
}

struct RootView: View {
    @Environment(AppModel.self) private var app
    @Environment(RootTabs.self) private var tabs

    var body: some View {
        @Bindable var tabs = tabs
        if !app.isConfigured {
            NotConfiguredView()
        } else {
            TabView(selection: $tabs.selection) {
                Tab("Menus", systemImage: "fork.knife", value: RootTabs.Tab.menu) {
                    MenuView()
                }
                Tab("Log", systemImage: "list.bullet", value: RootTabs.Tab.log) {
                    LogTab()
                }
            }
        }
    }
}

/// The log is personal, so signed out it's an invitation rather than a screen.
private struct LogTab: View {
    @Environment(AppModel.self) private var app
    @State private var showLogin = false

    var body: some View {
        if app.isSignedIn {
            LogView()
        } else if !app.authResolved {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity).background(Color.bg)
        } else {
            VStack(spacing: 14) {
                Image(systemName: "tray.full").font(.system(size: 44)).foregroundStyle(Color.carolina)
                Text("Your log lives here").font(.title3.weight(.bold)).foregroundStyle(Color.text)
                Text("Sign in and every item you add from a menu lands here, with totals against your goals.")
                    .font(.subheadline)
                    .foregroundStyle(Color.textMuted)
                    .multilineTextAlignment(.center)
                Button("Sign in") { showLogin = true }
                    .buttonStyle(DeepButtonStyle())
                    .padding(.top, 6)
            }
            .padding(32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.bg)
            .sheet(isPresented: $showLogin) { LoginView() }
        }
    }
}

private struct NotConfiguredView: View {
    var body: some View {
        VStack(spacing: 10) {
            Text("Not configured").font(.title3.weight(.bold))
            Text("Copy ios/Tray/Config/Secrets.example.xcconfig to Secrets.xcconfig, fill in your Supabase project, and rebuild.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.textMuted)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.bg)
    }
}
