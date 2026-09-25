# Tray for iOS

The native SwiftUI app. It reads and writes the **same Supabase project** as the web app,
using the anon key and Row Level Security just like the browser does. The web app, the
scraper and the Vercel cron don't change.

Requires Xcode 26 or later. The app targets iOS 18.

## Getting started

```bash
brew install xcodegen                                   # once
cp Tray/Config/Secrets.example.xcconfig Tray/Config/Secrets.xcconfig
# fill in SUPABASE_HOST and SUPABASE_ANON_KEY — the same project as ../.env.local
open Tray.xcodeproj
```

Pick an iPhone simulator and run. No Apple Developer account is needed for the Simulator.

`Tray.xcodeproj` is generated from `project.yml` by XcodeGen, and both are committed so
a fresh clone opens directly. **Edit `project.yml`, not the project**, then run
`xcodegen` from this folder. Hand edits to the `.xcodeproj` are lost on the next
regenerate.

From the command line:

```bash
xcodebuild -project Tray.xcodeproj -scheme Tray \
  -destination 'platform=iOS Simulator,name=iPhone 17' test
```

## How it fits together

| Web | iOS |
| --- | --- |
| `src/lib/dates.ts` | `Tray/Core/CampusDate.swift` |
| `src/lib/stations.ts`, `station-prefs.ts` | `Tray/Core/Stations.swift` (UserDefaults instead of localStorage) |
| `src/lib/sort.ts`, `labels.ts`, `servings.ts` | `Tray/Core/Sort.swift`, `Labels.swift` |
| `src/lib/log.ts` (pure half) | `Tray/Core/LogMath.swift` |
| `src/lib/menu.ts`, `log.ts` (queries) | `Tray/Core/MenuService.swift`, `LogService.swift` |
| `src/app/actions.ts` | Postgres functions in `supabase/migrations/0003_log_rpcs.sql`, which both apps call |
| `tray-provider.tsx` | `Tray/Features/Tray/TrayStore.swift` |
| `globals.css` tokens | colour sets in `Assets.xcassets`, named in `DesignSystem/Theme.swift` |

The write rules live in the database so the two apps can't drift apart on them:

- Macros are snapshotted at log time.
- There's one line per slot.
- A 1× line is deleted rather than decremented to zero.

The tests in `TrayTests/` port the web app's own test cases, so both apps agree on
which campus day and meal "now" is.

## Supabase setup the app needs

In the Supabase dashboard, on the same project the web app uses:

1. **Apply migration 0003**. For example, `npx supabase db push` from the repo root. The
   app's logging and the in-app account deletion call these functions.
2. **Authentication → URL Configuration → Redirect URLs**: add `tray://auth-callback`.
   Google sign-in and email-confirmation links come back to the app through it. If it's
   missing, Supabase silently falls back to the Site URL and the link opens the website
   instead.
3. **Authentication → Providers → Apple**: enable it, and add `edu.unc.tray` (the bundle
   ID) to **Client IDs**. Native Sign in with Apple only needs the bundle ID there. The
   Services ID, key and secret are only for Apple sign-in on the web.

## Before submitting to the App Store

These need a paid Apple Developer Program membership ($99/yr).

- [ ] Enroll, then set `DEVELOPMENT_TEAM` in `project.yml` and run `xcodegen`.
- [ ] If `edu.unc.tray` isn't available to you, change the bundle ID in `project.yml` and
      in Supabase's Apple provider **Client IDs**.
- [ ] Under Certificates, Identifiers & Profiles → Identifiers, enable **Sign in with
      Apple** on the app ID. The entitlement is already in `Tray/Resources/Tray.entitlements`.
- [ ] Test Sign in with Apple on a real device or a signed Simulator build. It can't be
      tested without a team.
- [ ] In App Store Connect, create the app record:
  - [ ] Category: Health & Fitness (already set in Info.plist as `LSApplicationCategoryType`).
  - [ ] Privacy policy URL: `https://<web host>/privacy`. Also set `TRAY_WEB_HOST` in
        `Secrets.xcconfig` so Settings links to it.
  - [ ] **App Privacy**: Email Address, Name, User ID and Fitness, all *linked to the
        user*, *not used for tracking*, for *App Functionality*. This matches
        `PrivacyInfo.xcprivacy` and `src/app/privacy/page.tsx`. If any one of the three
        changes, change the others.
  - [ ] Screenshots at 6.9" (and 6.5" if prompted).
- [ ] Give App Review a demo account (email and password) with a few days of logs, and
      say in the review notes that menus are browsable without signing in.
- [ ] Bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in `project.yml`, then run
      Product → Archive → Distribute App → App Store Connect. Then TestFlight, then
      submit.

The App Store guidelines this build already covers:

- **4.2 minimum functionality:** a native app, not a web wrapper.
- **4.8 login services:** Sign in with Apple is offered alongside Google.
- **5.1.1(v) account deletion:** Settings → Delete account.
- **Privacy manifest:** `PrivacyInfo.xcprivacy`.
- **Export compliance:** `ITSAppUsesNonExemptEncryption = NO`, since the app only uses HTTPS.

## Not built yet

- Apple Health write-back, and a home-screen widget for today's total. Both are natural
  next steps now that the app is native.
- Push notifications (for example, "Dinner starts in 30 minutes at Chase").
