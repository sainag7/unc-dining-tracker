'use client';

import Link from 'next/link';
import { DietTags } from './ui/badge';
import { Plus } from './ui/icons';
import { QuantityStepper } from './ui/quantity-stepper';
import { allergenLabel, conflictingAllergens } from '@/lib/labels';
import type { RecipeRow } from '@/lib/supabase/database.types';

/**
 * One item on the menu.
 *
 * The row itself opens the nutrition sheet; the stepper on the right changes
 * what's on the tray. Splitting them is what turns a five-item meal from
 * fifteen taps into five, without losing the ability to set an exact portion.
 *
 * Three fixed zones, left to right: name with its tags, then calories in a
 * column narrow enough that 15 and 480 line up, then the stepper. The number
 * sits next to the control it belongs to rather than a screen away from it.
 *
 * A row with something on it tints edge to edge. That's the whole point of the
 * state: you can see what's already on your tray while still browsing, without
 * reading a single number.
 */
export function MenuRow({
  item,
  servings,
  allergensAvoid,
  isSignedIn,
  stationLabel,
  onQuickAdd,
  onQuickRemove,
  onOpenDetail,
}: {
  item: RecipeRow;
  /** Servings already logged for this meal, 0 if none. */
  servings: number;
  allergensAvoid: string[];
  isSignedIn: boolean;
  /** Shown in search results, where rows are flat and the station is context. */
  stationLabel?: string;
  onQuickAdd: () => void;
  onQuickRemove: () => void;
  onOpenDetail: () => void;
}) {
  const conflicts = conflictingAllergens(item.allergens, allergensAvoid);
  const logged = servings > 0;

  return (
    // -mx-4 px-4 bleeds the active tint past the list's own padding, so a
    // logged row reads as a band across the screen rather than an inset chip.
    <li
      className={`hairline-row -mx-4 flex items-center gap-[10px] px-4 py-[13px] last:border-0 ${
        logged ? 'bg-row-active' : ''
      }`}
    >
      <button type="button" onClick={onOpenDetail} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-row font-semibold text-text">{item.name}</span>

        {/* The conflict warning is not a tag — it goes above them, in danger. */}
        {conflicts.length > 0 && (
          <span className="mt-0.5 block truncate text-micro font-semibold text-danger">
            Contains {conflicts.map(allergenLabel).join(', ')}
          </span>
        )}

        <DietTags properties={item.properties} />

        {stationLabel && (
          <span className="mt-0.5 block truncate text-micro text-text-faint">{stationLabel}</span>
        )}
      </button>

      {/*
        Fixed 34px so a column of calories lines up on the decimal point that
        tabular figures give it, whatever the magnitude.

        Logged: Carolina in dark, navy in light. Not --accent-text, which is a
        readable blue in both — on a light ground Carolina as text is 3.0:1, so
        light mode says "logged" with the row tint instead of a colour it can't
        legibly use. Weight is not part of that signal: it used to be, in light
        mode only, which made the same state look different in the two themes.
      */}
      <span
        className={`data w-[34px] shrink-0 text-right text-row font-semibold ${
          logged ? 'text-text dark:text-accent' : 'text-text'
        }`}
      >
        {item.calories === null ? '—' : Math.round(item.calories)}
      </span>

      {isSignedIn ? (
        <QuantityStepper
          servings={servings}
          label={item.name}
          onAdd={onQuickAdd}
          onRemove={onQuickRemove}
        />
      ) : (
        <Link
          href="/login"
          aria-label={`Sign in to log ${item.name}`}
          className="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border-[0.5px] border-border-strong text-text-faint"
        >
          <Plus size={15} />
        </Link>
      )}
    </li>
  );
}
