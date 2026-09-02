'use client';

import { useTheme } from 'next-themes';
import { useHydrated } from '@/lib/use-hydrated';
import { Sun, Moon } from './icons';

/** Switches between light and dark, showing the mode the tap will move to. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // Before hydration the resolved theme is unknowable, and rendering a guess
  // means rendering the wrong icon for a frame.
  const mounted = useHydrated();

  // resolvedTheme, not theme: until the first tap the stored value is still
  // "system", which this button has no way to render.
  const dark = resolvedTheme === 'dark';
  const Icon = dark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={mounted ? `Switch to ${dark ? 'light' : 'dark'} theme` : 'Switch theme'}
      className="card flex h-11 w-11 items-center justify-center rounded-full text-text-mid"
    >
      {mounted ? <Icon /> : <span className="h-5 w-5" />}
    </button>
  );
}
