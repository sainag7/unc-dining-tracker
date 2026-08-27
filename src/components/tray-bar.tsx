'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronUp } from './ui/icons';
import type { LogEntry } from '@/lib/log';

/**
 * The tray.
 *
 * This is the one element that makes the app a tracker rather than a menu
 * page, and it's the one place the design is allowed to be loud — everything
 * around it is hairlines and a single accent.
 *
 * It sits above the tab bar and carries what's on the tray right now. Tapping
 * it expands the day's items in place, so checking what you've already taken
 * never costs a navigation away from the menu you're standing in front of.
 *
 * The tab bar used to carry this number as a subtitle on the Log tab. It
 * doesn't any more — two running totals on one screen is one too many, and
 * the subtitle was 10px in the faintest grey in the palette.
 */
export function TrayBar({ entries, calories }: { entries: LogEntry[]; calories: number }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  // The log screen is already a full accounting of the tray; repeating it in
  // a bar on top of itself would be absurd.
  if (pathname === '/login' || pathname === '/settings' || pathname.startsWith('/log')) return null;

  const count = entries.length;

  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-border bg-surface"
      style={{ bottom: 'calc(var(--tab-bar-h) + env(safe-area-inset-bottom))' }}
    >
      {expanded && (
        <div className="mx-auto max-h-[45vh] w-full max-w-[640px] overflow-y-auto px-4 motion-safe:animate-[sheet-in_200ms_var(--ease)]">
          {count === 0 ? (
            <p className="py-6 text-center text-body text-text-muted">
              Nothing on the tray yet. Tap <span className="font-semibold">+</span> on anything to
              start.
            </p>
          ) : (
            <ul className="py-1">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 border-b border-border py-2 last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate text-body">{entry.recipeName}</span>
                  {entry.servings !== 1 && (
                    <span className="data shrink-0 text-meta text-text-muted">
                      {entry.servings}×
                    </span>
                  )}
                  <span className="data shrink-0 text-body">
                    {Math.round((entry.calories_snapshot ?? 0) * entry.servings)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/log"
            className="my-2 flex h-11 items-center justify-center rounded-md border border-border-strong text-body font-medium"
          >
            Open the full log
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? 'Hide what is on your tray'
            : `Show what is on your tray. ${count} ${count === 1 ? 'item' : 'items'}, ${calories} calories.`
        }
        className="mx-auto flex w-full max-w-[640px] items-center gap-3 px-4"
        style={{ height: 'var(--tray-bar-h)' }}
      >
        <span className="text-body font-medium">
          {count === 0 ? 'Tray empty' : `${count} ${count === 1 ? 'item' : 'items'}`}
        </span>

        <span className="flex-1" />

        {/*
          The number the whole app exists to show. aria-live so a quick-add
          announces the new total without moving focus.
        */}
        <span aria-live="polite" className="data text-data-lg font-semibold">
          {calories.toLocaleString()}
          <span className="ml-1 text-meta font-medium text-text-muted">cal</span>
        </span>

        <ChevronUp
          className={`shrink-0 text-text-muted transition-transform duration-200 ease-out ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>
    </div>
  );
}
