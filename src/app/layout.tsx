import type { Metadata, Viewport } from 'next';
import { Archivo_Narrow, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
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

// Carries every number the user compares: calories, macros, nutrition panels.
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
    { media: '(prefers-color-scheme: light)', color: '#f1f0eb' },
    { media: '(prefers-color-scheme: dark)', color: '#0f151b' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${archivoNarrow.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
