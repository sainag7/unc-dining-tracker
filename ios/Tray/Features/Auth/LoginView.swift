import AuthenticationServices
import CryptoKit
import Supabase
import SwiftUI

/// Sign in with Apple, Google, or email and password. Port of
/// src/components/login-form.tsx.
///
/// Apple comes first: App Review requires Sign in with Apple wherever another
/// third-party sign-in is offered (guideline 4.8), and it's the one-tap option
/// on an iPhone anyway.
struct LoginView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    private enum Mode { case signIn, signUp, sent }

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var notice: String?
    @State private var busy = false
    /// The raw nonce for the Apple request in flight. Apple gets its hash;
    /// Supabase gets this, and checks one against the other.
    @State private var nonce = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    Text("Sign in to keep a running count of what you eat. Menus work without an account.")
                        .font(.subheadline)
                        .foregroundStyle(Color.textMuted)
                        .multilineTextAlignment(.center)
                        .padding(.bottom, 8)

                    if mode == .sent {
                        sentState
                    } else {
                        SignInWithAppleButton(mode == .signUp ? .signUp : .signIn) { request in
                            nonce = Self.randomNonce()
                            request.requestedScopes = [.fullName, .email]
                            request.nonce = Self.sha256(nonce)
                        } onCompletion: { result in
                            Task { await finishApple(result) }
                        }
                        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                        .frame(height: 50)
                        .clipShape(Capsule())

                        Button { Task { await signInWithGoogle() } } label: {
                            Label("Continue with Google", systemImage: "globe")
                        }
                        .buttonStyle(SecondaryButtonStyle())

                        divider
                        emailForm
                    }

                    if let error { ErrorBanner(text: error) }
                    if let notice {
                        Text(notice).font(.subheadline).foregroundStyle(Color.textMuted).multilineTextAlignment(.center)
                    }
                }
                .padding(20)
                .disabled(busy)
            }
            .background(Color.bg)
            .navigationTitle(mode == .signUp ? "Create an account" : "Sign in")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
            .onChange(of: app.isSignedIn) { if app.isSignedIn { dismiss() } }
        }
    }

    private var divider: some View {
        HStack {
            Rectangle().fill(Color.border).frame(height: 1)
            Text("or").font(.caption).foregroundStyle(Color.textMuted)
            Rectangle().fill(Color.border).frame(height: 1)
        }
        .padding(.vertical, 6)
    }

    private var emailForm: some View {
        VStack(spacing: 10) {
            TextField("Email", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, 16)
                .frame(height: 50)
                .card(radius: 25)
            SecureField("Password", text: $password)
                .textContentType(mode == .signUp ? .newPassword : .password)
                .padding(.horizontal, 16)
                .frame(height: 50)
                .card(radius: 25)
                .onSubmit { Task { await submitEmail() } }

            Button(busy ? "Working…" : (mode == .signUp ? "Create account" : "Sign in")) {
                Task { await submitEmail() }
            }
            .buttonStyle(DeepButtonStyle())
            .disabled(email.isEmpty || password.isEmpty)

            Button(mode == .signUp ? "Have an account? Sign in" : "New here? Create an account") {
                mode = mode == .signUp ? .signIn : .signUp
                error = nil
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.accentText)
            .padding(.top, 4)
        }
    }

    private var sentState: some View {
        VStack(spacing: 12) {
            Image(systemName: "envelope.badge").font(.largeTitle).foregroundStyle(Color.carolina)
            Text("Check \(email) for a confirmation link. Open it on this iPhone and you'll land back here signed in.")
                .multilineTextAlignment(.center)
            Button("Send it again") { Task { await resend() } }.buttonStyle(SecondaryButtonStyle())
            Button("Back to sign in") { mode = .signIn; notice = nil }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.accentText)
        }
    }

    // MARK: Flows

    private func run(_ work: () async throws -> Void) async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await work()
        } catch let authError as ASAuthorizationError where authError.code == .canceled {
            // Backing out of the sheet isn't an error worth showing.
        } catch let webError as ASWebAuthenticationSessionError where webError.code == .canceledLogin {
            // Same for the Google sheet.
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func finishApple(_ result: Result<ASAuthorization, any Error>) async {
        await run {
            let authorization = try result.get()
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8)
            else { throw TrayError.message("Apple didn't return a sign-in token. Try again.") }

            try await client().auth.signInWithIdToken(
                credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
            )

            // Apple only sends the name on the very first authorization, and
            // never in the token — so it has to be saved now or not at all.
            if let name = credential.fullName,
               let formatted = Optional(PersonNameComponentsFormatter().string(from: name)),
               !formatted.isEmpty {
                _ = try? await client().auth.update(user: UserAttributes(data: ["full_name": .string(formatted)]))
            }
        }
    }

    private func signInWithGoogle() async {
        await run {
            try await client().auth.signInWithOAuth(provider: .google, redirectTo: AppConfig.authRedirect) { session in
                // Share cookies with Safari so someone already signed in to
                // Google there doesn't have to type their password again.
                session.prefersEphemeralWebBrowserSession = false
            }
        }
    }

    private func submitEmail() async {
        guard !email.isEmpty, !password.isEmpty else { return }
        await run {
            let auth = try client().auth
            if mode == .signUp {
                let response = try await auth.signUp(email: email, password: password, redirectTo: AppConfig.authRedirect)
                // With confirmation on, there's a user but no session yet.
                if response.session == nil {
                    mode = .sent
                    notice = nil
                }
            } else {
                do {
                    try await auth.signIn(email: email, password: password)
                } catch let authError as AuthError where authError.message.localizedCaseInsensitiveContains("not confirmed") {
                    mode = .sent
                    notice = "Confirm your email first — check \(email) for the link."
                }
            }
        }
    }

    private func resend() async {
        await run {
            try await client().auth.resend(email: email, type: .signup, emailRedirectTo: AppConfig.authRedirect)
            notice = "Sent another link to \(email)."
        }
    }

    // MARK: Nonce

    private static func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var generator = SystemRandomNumberGenerator()
        return String((0..<length).map { _ in charset.randomElement(using: &generator)! })
    }

    private static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
