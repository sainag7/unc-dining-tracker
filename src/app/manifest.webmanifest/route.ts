import { NextResponse } from 'next/server';

/**
 * Served as a route rather than a static file so the icons can stay inline SVG
 * data URIs — no binary assets to keep in sync with the palette.
 */
export function GET() {
  return NextResponse.json({
    name: 'Tray — UNC dining, tracked',
    short_name: 'Tray',
    description:
      "See what Chase and Lenoir are serving right now, and keep a running count of what you've eaten.",
    start_url: '/',
    display: 'standalone',
    background_color: '#f1f0eb',
    theme_color: '#13294b',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  });
}
