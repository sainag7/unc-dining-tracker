import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { createClient } from '@/lib/supabase/server';
import { getDayLog, totalsFor } from '@/lib/log';
import { campusToday } from '@/lib/dates';
import { ThemeProvider } from '@/components/theme-provider';
import { TabBar } from '@/components/tab-bar';
import { TrayBar } from '@/components/tray-bar';
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

  const entries = user ? await getDayLog(supabase, user.id, campusToday()) : null;

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
          {entries && <TrayBar entries={entries} calories={totalsFor(entries).calories} />}
          <TabBar />
        </ThemeProvider>
      </body>
    </html>
  );
}
