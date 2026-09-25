import Foundation
import Supabase

/// The one Supabase client, or nil when the build has no Secrets.xcconfig.
///
/// Uses the anon key, exactly like the web app's browser client. Menus are
/// public-read under RLS; `profiles` and `food_log` are scoped to their owner,
/// so a signed-in user can reach their own rows and nothing else.
let supabase: SupabaseClient? = {
    guard let url = AppConfig.supabaseURL, let key = AppConfig.supabaseAnonKey else { return nil }
    return SupabaseClient(
        supabaseURL: url,
        supabaseKey: key,
        options: .init(
            auth: .init(
                redirectToURL: AppConfig.authRedirect,
                // Start from the keychain session straight away rather than
                // waiting on a refresh, so a relaunch doesn't flash signed out.
                emitLocalSessionAsInitialSession: true
            )
        )
    )
}()

enum TrayError: LocalizedError {
    case notConfigured
    case notSignedIn
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured: "This build has no Supabase project configured."
        case .notSignedIn: "Sign in to keep track of what you eat."
        case .message(let text): text
        }
    }
}

func client() throws -> SupabaseClient {
    guard let supabase else { throw TrayError.notConfigured }
    return supabase
}
