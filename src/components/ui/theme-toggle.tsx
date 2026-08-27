'use client';

import { useTheme } from 'next-themes';
import { useHydrated } from '@/lib/use-hydrated';
import { Sun, Moon, Monitor } from './icons';

const ORDER = ['light', 'dark', 'system'] as const;
const NEXT = { light: 'dark', dark: 'system', system: 'light' } as const;
const ICON = { light: Sun, dark: Moon, system: Monitor };
const NAME = { light: 'Light', dark: 'Dark', system: 'System' };

type Mode = (typeof ORDER)[number];

/** Cycles light → dark → system, showing whichever is current. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // Before hydration the resolved theme is unknowable, and rendering a guess
  // means rendering the wrong icon for a frame.
  const mounted = useHydrated();

  const mode: Mode = mounted && ORDER.includes(theme as Mode) ? (theme as Mode) : 'system';
  const Icon = ICON[mode];

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[mode])}
      aria-label={`Theme: ${NAME[mode]}. Switch to ${NAME[NEXT[mode]]}.`}
      className="flex h-11 w-11 items-center justify-center rounded-md text-text-muted"
    >
      {mounted ? <Icon /> : <span className="h-5 w-5" />}
    </button>
  );
}
