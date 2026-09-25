import Foundation
import Observation
import Supabase

/// Who is signed in, and their profile. Everything user-specific hangs off this.
@Observable @MainActor
final class AppModel {
    private(set) var userId: UUID?
    private(set) var email: String?
    private(set) var profile: Profile?
    /// False until the stored session has been read, so launch doesn't flash
    /// the signed-out state at someone who is signed in.
    private(set) var authResolved = false

    let tray = TrayStore()

    var isSignedIn: Bool { userId != nil }
    var isConfigured: Bool { supabase != nil }

    private var listener: Task<Void, Never>?

    func start() {
        guard listener == nil else { return }
        guard let supabase else {
            authResolved = true
            return
        }
        listener = Task { [weak self] in
            for await (_, session) in supabase.auth.authStateChanges {
                // An expired stored session is still emitted first; treat it as
                // signed out rather than firing requests that will all 401.
                let user = (session?.isExpired == false) ? session?.user : nil
                await self?.apply(user: user)
            }
        }
    }

    private func apply(user: User?) async {
        let changed = user?.id != userId
        userId = user?.id
        email = user?.email
        authResolved = true
        guard changed else { return }

        if user == nil {
            profile = nil
            tray.clear()
        } else {
            await reloadProfile()
            await tray.reload()
        }
    }

    func reloadProfile() async {
        profile = try? await LogService.profile()
    }

    func saveProfile(_ next: Profile) async throws {
        try await LogService.updateProfile(next)
        profile = next
    }

    /// Finishes an OAuth or email-confirmation link that came back as tray://.
    func handle(url: URL) async throws {
        try await client().auth.session(from: url)
    }

    func signOut() async {
        try? await supabase?.auth.signOut()
    }

    func deleteAccount() async throws {
        try await LogService.deleteAccount()
        // The session's tokens are dead now; this only clears the keychain.
        try? await supabase?.auth.signOut(scope: .local)
    }
}
