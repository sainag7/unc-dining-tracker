'use client';

import { ButtonLink } from './ui/button';
import { useCallback, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateServings, removeLog, restoreLog } from '@/app/actions';
import { UndoToast } from './ui/undo-toast';
import { QuantityStepper } from './ui/quantity-stepper';
import { SERVING_STEPS } from '@/lib/servings';
import { groupByMealPeriod, servingsAfterRemoval, totalsFor, type LogEntry } from '@/lib/log';

/** How far left the row has to travel before releasing deletes it. */
const SWIPE_THRESHOLD = 96;

function EntryRow({ entry, onRemoved }: { entry: LogEntry; onRemoved: (e: LogEntry) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const swipe = useRef<{ startX: number; startY: number } | null>(null);

  const calories = Math.round((entry.calories_snapshot ?? 0) * entry.servings);
  const protein = Math.round((entry.protein_snapshot ?? 0) * entry.servings);

  const change = (servings: number) =>
    startTransition(async () => {
      const result = await updateServings(entry.id, servings);
      if (!result.ok) setError(result.error ?? 'Could not update that.');
      else setEditing(false);
    });

  const remove = useCallback(
    () =>
      startTransition(async () => {
        const result = await removeLog(entry.id);
        if (!result.ok) {
          setError(result.error ?? 'Could not remove that.');
          setOffset(0);
        } else {
          onRemoved(entry);
        }
      }),
    [entry, onRemoved],
  );

  /*
    Swipe left to delete. The gesture only commits once the finger has moved
    further horizontally than vertically — otherwise every attempt to scroll
    the log would start dragging a row sideways.
  */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    swipe.current = { startX: e.clientX, startY: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = swipe.current;
    if (!start) return;

    const dx = e.clientX - start.startX;
    const dy = e.clientY - start.startY;
    if (!swiping && Math.abs(dx) < Math.abs(dy)) {
      swipe.current = null;
      return;
    }
    if (!swiping && Math.abs(dx) > 8) setSwiping(true);
    setOffset(Math.min(0, dx));
  };

  const onPointerUp = () => {
    if (!swipe.current) return;
    swipe.current = null;
    setSwiping(false);

    if (offset < -SWIPE_THRESHOLD) remove();
    else setOffset(0);
  };

  return (
    <li className="relative overflow-hidden border-b border-border">
      {/* Revealed by the swipe rather than always drawn, so a resting row is
          still just type on a background. */}
      <span
        aria-hidden
        className="absolute inset-y-0 right-0 flex items-center pr-4 text-body font-semibold text-danger"
      >
        Remove
      </span>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${offset}px)` }}
        className={`relative bg-bg py-2 pr-[84px] transition-opacity duration-150 ease-out ${
          pending ? 'opacity-50' : ''
        } ${swiping ? '' : 'transition-transform duration-200 ease-out motion-reduce:transition-none'}`}
      >
      <button
        type="button"
        onClick={() => setEditing(!editing)}
        aria-expanded={editing}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-body">{entry.recipeName}</span>
          <span className="mt-0.5 block truncate text-meta text-text-muted">
            <span className="data">{entry.servings}×</span>
            {entry.servingSize ? ` ${entry.servingSize}` : ' serving'}
            {entry.hallName ? ` · ${entry.hallName.replace(/\s*dining hall\s*/i, '')}` : ''}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="data block text-body font-semibold">{calories}</span>
          <span className="data mt-0.5 block text-meta text-text-muted">{protein}g P</span>
        </span>
      </button>

      {/*
        The same stepper the menu row uses. Changing a quantity is the same
        gesture in both places, so it should not be two different controls —
        and the row previously offered no way to adjust without first opening
        an editor.
      */}
      <span className="absolute right-4 bottom-2">
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
      </span>

      {editing && (
        <div className="mt-2">
          {/* The exact portions, behind the row. The stepper covers whole
              servings; this is where half a bagel lives. */}
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            {SERVING_STEPS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => change(s)}
                disabled={pending}
                aria-pressed={s === entry.servings}
                className={`data on-accent h-11 w-14 shrink-0 rounded-full border text-body transition-colors duration-150 ease-out ${
                  s === entry.servings
                    ? 'bg-accent text-accent-fg'
                    : 'border-border text-text-muted'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="mt-1.5 flex h-11 items-center rounded-full bg-danger-bg px-4 text-body font-semibold text-danger disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1 text-meta font-medium text-danger">
          {error}
        </p>
      )}
      </div>
    </li>
  );
}

export function LogList({ entries }: { entries: LogEntry[] }) {
  const router = useRouter();
  const [removed, setRemoved] = useState<LogEntry | null>(null);

  /*
    Puts back exactly what was deleted, snapshots and all. restoreLog rather
    than logFood: re-logging would take a fresh reading off the recipe, so an
    undo could quietly change the day's totals if UNC had revised it since.
  */
  const undo = () => {
    const entry = removed;
    if (!entry) return;
    setRemoved(null);
    void restoreLog({
      recipeId: entry.recipe_id,
      serviceDate: entry.service_date,
      mealPeriodName: entry.meal_period_name,
      hallId: entry.hall_id,
      servings: entry.servings,
      caloriesSnapshot: entry.calories_snapshot,
      proteinSnapshot: entry.protein_snapshot,
      carbsSnapshot: entry.carbs_snapshot,
      fatSnapshot: entry.fat_snapshot,
    }).then(() => router.refresh());
  };

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-input font-semibold">Nothing logged yet</p>
        <p className="mx-auto mt-1 max-w-xs text-body text-text-muted">
          Tap the add button next to anything on a menu and it lands here.
        </p>
        <ButtonLink href="/" className="mt-5">
          Go to menus
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      {groupByMealPeriod(entries).map(({ period, entries: items }) => (
        <section key={period} className="mt-4">
          <div className="flex items-center justify-between gap-3 border-b border-border py-2">
            <h2 className="placard">{period}</h2>
            {/* totalsFor, not a local reduce: it rounds once at the end, so a
                meal of part servings can't lose a calorie per row. */}
            <span className="data shrink-0 text-meta text-text-muted">
              {totalsFor(items).calories} cal
            </span>
          </div>
          <ul>
            {items.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onRemoved={setRemoved} />
            ))}
          </ul>
        </section>
      ))}

      {removed && (
        <UndoToast
          message={`Removed ${removed.recipeName}`}
          onUndo={undo}
          onDismiss={() => setRemoved(null)}
        />
      )}
    </div>
  );
}
