import Foundation

/// Values that come from the build, via Config/Secrets.xcconfig → Info.plist.
enum AppConfig {
    /// Where every OAuth and email-confirmation link comes back to. Has to be in
    /// the Supabase project's Redirect URLs allow list — see ios/README.md.
    static let authRedirect = URL(string: "tray://auth-callback")!

    static var supabaseURL: URL? {
        guard let host = string("SupabaseHost") else { return nil }
        return URL(string: "https://\(host)")
    }

    static var supabaseAnonKey: String? { string("SupabaseAnonKey") }

    /// The web app's /privacy page, or nil when no web host is configured.
    static var privacyPolicyURL: URL? {
        guard let host = string("TrayWebHost") else { return nil }
        return URL(string: "https://\(host)/privacy")
    }

    /// An unset build setting arrives as "" or as the literal "$(NAME)"
    /// depending on how the plist was processed; both mean "not configured".
    private static func string(_ key: String) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty || trimmed.hasPrefix("$(") { return nil }
        return trimmed
    }
}
