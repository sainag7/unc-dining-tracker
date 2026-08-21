import type { Metadata, Viewport } from 'next';
import { Archivo_Narrow, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import { createClient } from '@/lib/supabase/server';
import { getDayLog, totalsFor } from '@/lib/log';
import { campusToday } from '@/lib/dates';
import { TabBar } from '@/components/tab-bar';
import './globals.css';

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

// Condensed and uppercase, the way station signs are actually set.
const archivoNarrow = Archivo_Narrow({
  variable: '--font-archivo-narrow',
  subsets: ['latin'],
  weight: ['600', '700'],
});

// Carries every number the reader compares: calories, macros, nutrition panels.
const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Tray — UNC dining, tracked',
  description:
    "See what Chase and Lenoir are serving right now, and keep a running count of what you've eaten.",
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Tray' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f0ea' },
    { media: '(prefers-color-scheme: dark)', color: '#0e141a' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // The tab bar shows today's running total, so it's resolved once here rather
  // than by every page that mounts it.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const todayCalories = user
    ? totalsFor(await getDayLog(supabase, user.id, campusToday())).calories
    : null;

  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${archivoNarrow.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <TabBar todayCalories={todayCalories} />
      </body>
    </html>
  );
}
