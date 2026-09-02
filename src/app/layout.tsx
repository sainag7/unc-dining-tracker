import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { createClient, getUser } from '@/lib/supabase/server';
import { getDayLog, getProfile, totalsFor } from '@/lib/log';
import { tolerate } from '@/lib/tolerate';
import { campusToday } from '@/lib/dates';
import { ThemeProvider } from '@/components/theme-provider';
import { TabBar } from '@/components/tab-bar';
import { TrayBar, TrayNotice } from '@/components/tray-bar';
import { TrayProvider } from '@/components/tray-provider';
import './globals.css';

/*
  One face for everything, numbers included.

  Jakarta is a geometric sans with near-circular bowls and a tall x-height,
  which is what makes it sit right next to the rounded surfaces this design is
  built from. The weights listed are the ones actually used — 500 for body,
  600/700 for emphasis, 800 for the wordmark — rather than the full 200..800
  range, which would ship weights nothing references.

  There is deliberately no second face for figures. The .data class in
  globals.css handles alignment with tabular-nums; see the note there.
*/
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
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
  const user = await getUser();

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
      className={`${jakarta.variable} h-full antialiased`}
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
            /*
              The totals go through a client provider rather than straight to
              the bar, so a tap can move them without waiting for a server
              round trip. The values here are still the truth — the provider
              layers an optimistic delta on top and drops it the moment these
              update. See tray-provider.tsx.
            */
            <TrayProvider {...totalsFor(tray.data)} count={tray.data.length}>
              <TrayBar
                entries={tray.data}
                // Optional, not defaulted to 2000. The literal is already
                // duplicated between the schema and log/page.tsx, and a ring
                // drawn against a number the user never set would be showing
                // progress toward a guess. No goal, no ring.
                calorieGoal={profile?.calorie_goal}
              />
            </TrayProvider>
          )}
          {tray?.failed && <TrayNotice />}
          <TabBar />
        </ThemeProvider>
      </body>
    </html>
  );
}
