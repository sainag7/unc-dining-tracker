import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { createClient } from '@/lib/supabase/server';
import { getDayLog, getProfile, totalsFor } from '@/lib/log';
import { tolerate } from '@/lib/tolerate';
import { campusToday } from '@/lib/dates';
import { ThemeProvider } from '@/components/theme-provider';
import { TabBar } from '@/components/tab-bar';
import { TrayBar, TrayNotice } from '@/components/tray-bar';
import './globals.css';

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
});

// Carries every number the reader compares: calories, macros, the tray total.
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Tray — UNC dining, tracked',
  description:
    "See what Chase and Lenoir are serving right now, and keep a running count of what you've eaten.",
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Tray' },
};

export const viewport: Viewport = {
  // No themeColor here on purpose. It would follow the OS rather than the
  // theme class, and Next re-renders it on every navigation, which overwrote
  // every attempt to correct it from the client. ThemeColorMeta in
  // theme-provider.tsx renders the tag instead, so it tracks the toggle.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // The tray bar shows what's on the tray right now, so the day's log is
  // resolved once here rather than by every page that mounts it.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Tolerated rather than awaited outright: this is the root layout, so a throw
  // here escapes error.tsx and 500s every route in the app — including the menu,
  // which doesn't need a session at all.
  //
  // The profile rides along for one field: the calorie goal, which the tray
  // bar's ring needs. It is deliberately NOT tolerated — getProfile uses
  // maybeSingle() and swallows its own error, so it cannot throw, and routing
  // it through tolerate would let a missing profile flip the bar into
  // "Couldn't load your tray" when the tray loaded perfectly well.
  const [tray, profile] = user
    ? await Promise.all([
        tolerate(() => getDayLog(supabase, user.id, campusToday()), [], 'day log'),
        getProfile(supabase, user.id),
      ])
    : [null, null];

  return (
    // suppressHydrationWarning: next-themes writes the class on <html> before
    // React hydrates, so the server and client markup differ by design.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          {children}
          {/* Signed out there is no tray, so the bar would be an empty
              promise — the row's + becomes a sign-in link instead. */}
          {/* Signed out there is no tray. Signed in but unreadable is a third
              state, and it has to look different from an empty tray — that
              would quietly claim you hadn't eaten anything today. */}
          {tray && !tray.failed && (
            <TrayBar
              entries={tray.data}
              calories={totalsFor(tray.data).calories}
              // Optional, not defaulted to 2000. The literal is already
              // duplicated between the schema and log/page.tsx, and a ring
              // drawn against a number the user never set would be showing
              // progress toward a guess. No goal, no ring.
              calorieGoal={profile?.calorie_goal}
            />
          )}
          {tray?.failed && <TrayNotice />}
          <TabBar />
        </ThemeProvider>
      </body>
    </html>
  );
}
