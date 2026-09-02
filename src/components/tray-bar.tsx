'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ChevronUp } from './ui/icons';
import { Sheet } from './ui/sheet';
import { ButtonLink } from './ui/button';
import { PlateRing } from './ui/plate-ring';
import { useTray } from './tray-provider';
import { QuantityStepper } from './ui/quantity-stepper';
import { updateServings, removeLog } from '@/app/actions';
import {
  goalProgress,
  groupByMealPeriod,
  servingsAfterRemoval,
  totalsFor,
  type LogEntry,
} from '@/lib/log';

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
    // No ground and no rule of its own any more — the pill inside is the
    // whole object, and it floats over the list rather than capping it. The
    // pb-2 is the gap between this pill and the nav pill below it, and it is
    // counted in --tray-bar-h.
    <div
      className="fixed inset-x-0 z-40 px-4 pb-2"
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
        className="mx-auto flex h-[50px] w-full max-w-[608px] items-center gap-2 rounded-full bg-surface px-5 shadow-[var(--shadow-float)]"
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
          className="-mr-2 flex h-11 shrink-0 items-center rounded-full px-3 text-body font-semibold text-accent-text"
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    </TrayShell>
  );
}

/**
 * One line on the tray, and the only place you can change it without leaving
 * the menu.
 *
 * Its own component rather than JSX in the map because each row carries its own
 * pending state — editing one line shouldn't grey out the rest of the tray.
 *
 * The same QuantityStepper the menu row and the log row use. Changing an amount
 * is the same gesture wherever you do it, and taking one off a 1× line deletes
 * it here exactly as it does on the menu.
 *
 * py-2.5, not py-2: the stepper draws 27px but claims a 44px hit area around
 * each button, so a tighter row would let one line's targets reach into its
 * neighbour's and a tap near the boundary would move the wrong count.
 */
function TrayEntryRow({ entry }: { entry: LogEntry }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const tray = useTray();

  // Per serving, from the snapshot taken when it was logged — not from the
  // recipe, which UNC may have revised since.
  const perServing = {
    calories: entry.calories_snapshot ?? 0,
    protein: entry.protein_snapshot ?? 0,
  };

  const change = (servings: number) =>
    startTransition(async () => {
      const step = servings - entry.servings;
      tray?.adjust({
        calories: perServing.calories * step,
        protein: perServing.protein * step,
        lines: 0,
      });

      const result = await updateServings(entry.id, servings);
      if (!result.ok) setError(result.error ?? 'Could not update that.');
      // These actions revalidate /log, not the route this sheet is on, so the
      // refresh is what brings the layout's tray totals back in step.
      else router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      tray?.adjust({
        calories: -perServing.calories * entry.servings,
        protein: -perServing.protein * entry.servings,
        lines: -1,
      });

      const result = await removeLog(entry.id);
      if (!result.ok) setError(result.error ?? 'Could not remove that.');
      else router.refresh();
    });

  return (
    <li
      className={`flex items-center gap-3 border-b border-border py-2.5 transition-opacity duration-150 ease-out last:border-0 ${
        pending ? 'opacity-50' : ''
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body">{entry.recipeName}</span>
        {error && (
          <span role="alert" className="mt-0.5 block text-meta font-medium text-danger">
            {error}
          </span>
        )}
      </span>

      <QuantityStepper
        servings={entry.servings}
        label={entry.recipeName}
        disabled={pending}
        onAdd={() => change(entry.servings + 1)}
        onRemove={() => {
          const next = servingsAfterRemoval(entry.servings);
          if (next === null) remove();
          else change(next);
        }}
      />

      {/* Moves as you tap — the feedback that makes editing here worth doing. */}
      <span className="data w-10 shrink-0 text-right text-body">
        {Math.round((entry.calories_snapshot ?? 0) * entry.servings)}
      </span>
    </li>
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
export function TrayBar({
  entries,
  calorieGoal,
}: {
  entries: LogEntry[];
  /** Absent when the user has no profile row yet — the ring is hidden then. */
  calorieGoal?: number;
}) {
  const [open, setOpen] = useState(false);

  /*
    Totals come from the provider, not from `entries`, so a tap moves them in
    the same frame instead of waiting on a server render. `entries` still
    supplies the sheet's list, which only matters once the sheet is open — by
    which time the refresh has long landed.
  */
  const tray = useTray();
  const calories = tray?.calories ?? 0;
  const count = tray?.count ?? entries.length;

  // The meal the tray most recently gained something in. Derived from the
  // entries already in hand rather than a second query — groupByMealPeriod
  // orders chronologically, so the last group is the current meal.
  const groups = groupByMealPeriod(entries);
  const period = groups.length > 0 ? groups[groups.length - 1].period : null;

  // The ring and the number are the same fact, so they change together. A red
  // ring beside a blue figure reads as two unrelated signals.
  const over = calorieGoal !== undefined && goalProgress(calories, calorieGoal).over;

  return (
    <>
      <TrayShell>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label={
            `Show what is on your tray. ${count} ${count === 1 ? 'item' : 'items'}, ` +
            (calorieGoal ? `${calories} of ${calorieGoal} calories.` : `${calories} calories.`)
          }
          // The deep fill, and the only place in the app that uses it at this
          // size. This is the object the whole app exists around, so it is the
          // one thing on screen that is allowed to be a solid block of colour.
          // 608px, not 640: it matches the content column's inner width, so
          // the pill lines up with the cards above it rather than with the
          // window.
          className="on-deep mx-auto flex h-[50px] w-full max-w-[608px] items-center gap-3 rounded-full bg-deep px-5 text-deep-fg shadow-[var(--shadow-float)]"
        >
          {/*
            The plate leads the row. aria-hidden, and the goal is spoken through
            the button's own label instead — a role="progressbar" nested inside
            a button corrupts the button's accessible name.
          */}
          {calorieGoal !== undefined && <PlateRing calories={calories} goal={calorieGoal} />}

          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-semibold">
              {count === 0 ? 'Tray empty' : `${count} ${count === 1 ? 'item' : 'items'} on tray`}
            </span>
            {/*
              Which meal the tray belongs to. Adds go to the period you are
              browsing, so without this the number is ambiguous the moment you
              step to another tab — you cannot tell whether 840 is lunch or the
              whole day.
            */}
            {period && (
              <span className="data block truncate text-micro text-deep-fg/70">{period}</span>
            )}
          </span>

          {/*
            The number the whole app exists to show. aria-live so a quick-add
            announces the new total without moving focus.
          */}
          <span
            aria-live="polite"
            className={`data shrink-0 text-total font-bold ${
              over ? 'text-on-deep-danger' : 'text-deep-fg'
            }`}
          >
            {calories.toLocaleString()}
          </span>
          <span className="shrink-0 text-micro text-deep-fg/70">cal</span>

          <ChevronUp size={16} className="shrink-0 text-deep-fg/70" />
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
            <ButtonLink href="/log" variant="secondary" className="w-full">
              Open the full log
            </ButtonLink>
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
            groupByMealPeriod(entries).map(({ period, entries: items }) => {
              // One call, both figures. totalsFor already computes protein on
              // every one of these and it was being thrown away — and it rounds
              // once at the end, which is what keeps a meal of part servings
              // from losing a gram per row.
              const totals = totalsFor(items);

              return (
                <section key={period} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between gap-3 border-b border-border py-1.5">
                    <h3 className="placard min-w-0 truncate text-text-muted">{period}</h3>
                    <span className="data shrink-0 text-meta text-text-muted">
                      {totals.calories} cal · {totals.protein}g protein
                    </span>
                  </div>
                  <ul>
                    {items.map((entry) => (
                      <TrayEntryRow key={entry.id} entry={entry} />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </Sheet>
      )}
    </>
  );
}
