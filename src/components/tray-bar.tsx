'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronUp } from './ui/icons';
import { Sheet } from './ui/sheet';
import { groupByMealPeriod, totalsFor, type LogEntry } from '@/lib/log';

/**
 * The strip above the tab bar, and the rule for when there shouldn't be one.
 *
 * The log screen is already a full accounting of the tray; repeating it in a
 * bar on top of itself would be absurd. Sign-in and settings aren't the tray's
 * business either. Both the bar and the failure notice go through here so that
 * rule can't drift apart between them — a "couldn't load your tray" banner on
 * the login screen would be worse than the failure it reports.
 *
 * Returns null on those routes, so callers render it unconditionally.
 */
function TrayShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/settings' || pathname.startsWith('/log')) return null;

  return (
    <div
      // --surface-alt, not --surface: in dark mode --surface equals --bg, so a
      // plain surface here would leave the bar floating with nothing but a
      // hairline to separate it from the list.
      className="hairline-t fixed inset-x-0 z-40 bg-surface-alt"
      style={{ bottom: 'calc(var(--tab-bar-h) + env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  );
}

/**
 * Shown in the tray's place when the day's log couldn't be read.
 *
 * The distinction this preserves is "we don't know" versus "nothing there" — an
 * empty tray bar would quietly claim you hadn't eaten anything today. Retry is
 * a refresh rather than a reload because the usual cause is a token the server
 * rejected by a second, and the next request carries a fresh one.
 */
export function TrayNotice() {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  return (
    <TrayShell>
      <div
        role="status"
        className="mx-auto flex w-full max-w-[640px] items-center gap-2 px-4"
        style={{ height: 'var(--tray-bar-h)' }}
      >
        <span className="min-w-0 flex-1 truncate text-body text-text-muted">
          Couldn&rsquo;t load your tray.
        </span>
        <button
          type="button"
          onClick={() => {
            setRetrying(true);
            router.refresh();
          }}
          className="-mr-2 flex h-11 shrink-0 items-center rounded-md px-2 text-body font-medium text-accent-text"
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    </TrayShell>
  );
}

/**
 * The tray.
 *
 * This is the one element that makes the app a tracker rather than a menu
 * page, and it's the one place the design is allowed to be loud — everything
 * around it is hairlines and a single accent.
 *
 * It sits above the tab bar and carries what's on the tray right now. Tapping
 * it opens the day's items, so checking what you've already taken never costs
 * a navigation away from the menu you're standing in front of.
 *
 * The tab bar used to carry this number as a subtitle on the Log tab. It
 * doesn't any more — two running totals on one screen is one too many, and
 * the subtitle was 10px in the faintest grey in the palette.
 */
export function TrayBar({ entries, calories }: { entries: LogEntry[]; calories: number }) {
  const [open, setOpen] = useState(false);

  const count = entries.length;

  // The meal the tray most recently gained something in. Derived from the
  // entries already in hand rather than a second query — groupByMealPeriod
  // orders chronologically, so the last group is the current meal.
  const groups = groupByMealPeriod(entries);
  const period = groups.length > 0 ? groups[groups.length - 1].period : null;

  return (
    <>
      <TrayShell>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label={`Show what is on your tray. ${count} ${count === 1 ? 'item' : 'items'}, ${calories} calories.`}
          className="mx-auto flex w-full max-w-[640px] items-center gap-3 px-4"
          style={{ height: 'var(--tray-bar-h)' }}
        >
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm text-text">
              {count === 0 ? 'Tray empty' : `${count} ${count === 1 ? 'item' : 'items'} on tray`}
            </span>
            {/*
              Which meal the tray belongs to. Adds go to the period you are
              browsing, so without this the number is ambiguous the moment you
              step to another tab — you cannot tell whether 840 is lunch or the
              whole day.
            */}
            {period && (
              <span className="data block truncate text-micro text-text-muted">{period}</span>
            )}
          </span>

          {/*
            The number the whole app exists to show. aria-live so a quick-add
            announces the new total without moving focus.
          */}
          <span aria-live="polite" className="data shrink-0 text-total font-semibold text-accent-text">
            {calories.toLocaleString()}
          </span>
          <span className="shrink-0 text-micro text-text-muted">cal</span>

          <ChevronUp size={16} className="shrink-0 text-text-muted" />
        </button>
      </TrayShell>

      {/*
        A real Sheet, not a bare div.

        This used to be an inline panel with no scrim, no rounded top, no
        handle and no title, clipped at max-h-[45vh] — so whatever row landed
        on the boundary was sliced in half and the whole thing read as a
        rendering bug rather than a panel. It opens at peek, showing the day's
        total, and drags up to the list.
      */}
      {open && (
        <Sheet
          label="Your tray"
          onClose={() => setOpen(false)}
          snapping
          initialSnap="peek"
          footer={
            <Link
              href="/log"
              className="flex h-11 items-center justify-center rounded-md border border-border-strong text-body font-medium"
            >
              Open the full log
            </Link>
          }
        >
          {count === 0 ? (
            <p className="py-6 text-center text-body text-text-muted">
              Nothing on the tray yet. Tap <span className="font-semibold">+</span> on anything to
              start.
            </p>
          ) : (
            // Grouped and ordered exactly as /log does it — the tray is the
            // same day, read at a glance instead of in full.
            groupByMealPeriod(entries).map(({ period, entries: items }) => (
              <section key={period} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between gap-3 border-b border-border py-1.5">
                  <h3 className="placard text-text-muted">{period}</h3>
                  <span className="data shrink-0 text-meta text-text-muted">
                    {totalsFor(items).calories} cal
                  </span>
                </div>
                <ul>
                  {items.map((entry) => (
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
              </section>
            ))
          )}
        </Sheet>
      )}
    </>
  );
}
