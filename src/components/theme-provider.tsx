'use client';

import { ThemeProvider as NextThemes, useTheme } from 'next-themes';

/* Kept in step with --bg in globals.css. */
const BAR_COLOR = { light: '#f5f7f8', dark: '#0d1117' } as const;

/**
 * Keeps the mobile browser chrome in step with the theme.
 *
 * A media-query `themeColor` in layout.tsx can't do this on its own: it
 * follows the OS and ignores the class next-themes writes, so a manual
 * toggle leaves the chrome on the wrong colour.
 *
 * Two earlier attempts at patching those tags from an effect both failed, and
 * the reasons are worth keeping. Removing them threw "Cannot read properties
 * of null (reading 'removeChild')" on the next navigation, because Next
 * rendered them and React still had them in its tree. Overwriting their
 * content instead survived, but Next re-renders metadata on every navigation
 * and restored the OS-based values, so the toggle silently stopped working
 * as soon as you changed meal period.
 *
 * So we don't patch Next's tag — we own it. React 19 hoists this into <head>,
 * it re-renders with the theme like any other component, and no code here
 * touches the DOM directly.
 */
function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return null;

  return <meta name="theme-color" content={BAR_COLOR[resolvedTheme]} />;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeColorMeta />
      {children}
    </NextThemes>
  );
}
