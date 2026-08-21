'use client';

import Link from 'next/link';
import { allergenLabel, propertyLabel, conflictingAllergens } from '@/lib/labels';
import type { RecipeRow } from '@/lib/supabase/database.types';

/** Properties worth showing on a dense row; the rest live in the item sheet. */
const ROW_PROPERTIES = new Set(['vegan', 'vegetarian', 'halal', 'made_without_gluten']);

/**
 * One item on the menu.
 *
 * The row itself opens the nutrition sheet; the button on the right logs a
 * serving outright. Splitting them is what turns a five-item meal from fifteen
 * taps into five, without losing the ability to set an exact portion.
 */
export function MenuRow({
  item,
  servings,
  allergensAvoid,
  isSignedIn,
  stationLabel,
  onQuickAdd,
  onOpenDetail,
}: {
  item: RecipeRow;
  /** Servings already logged today, 0 if none. */
  servings: number;
  allergensAvoid: string[];
  isSignedIn: boolean;
  /** Shown in search results, where rows are flat and the station is context. */
  stationLabel?: string;
  onQuickAdd: () => void;
  onOpenDetail: () => void;
}) {
  const conflicts = conflictingAllergens(item.allergens, allergensAvoid);
  const tags = item.properties.filter((p) => ROW_PROPERTIES.has(p));
  const logged = servings > 0;

  const meta = [
    stationLabel,
    tags.length > 0 ? tags.map(propertyLabel).join(' · ') : null,
  ].filter(Boolean) as string[];

  return (
    <li className="flex items-stretch gap-2 border-b border-rule">
      <button
        type="button"
        onClick={onOpenDetail}
        className="min-w-0 flex-1 py-2.5 text-left"
      >
        <span className={`block text-[0.9375rem] leading-snug ${logged ? 'text-ink-soft' : ''}`}>
          {item.name}
        </span>

        {(conflicts.length > 0 || meta.length > 0) && (
          <span className="mt-0.5 block truncate text-xs">
            {conflicts.length > 0 && (
              <span className="font-semibold text-danger">
                Contains {conflicts.map(allergenLabel).join(', ')}
              </span>
            )}
            {conflicts.length > 0 && meta.length > 0 && (
              <span className="text-ink-faint"> · </span>
            )}
            {meta.length > 0 && <span className="text-ink-faint">{meta.join(' · ')}</span>}
          </span>
        )}
      </button>

      <span className="flex shrink-0 items-center gap-2 py-2.5">
        <span className="data w-10 text-right text-sm tabular-nums">
          {item.calories === null ? '—' : Math.round(item.calories)}
        </span>

        {isSignedIn ? (
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label={
              logged ? `Add another ${item.name} (${servings} logged)` : `Add ${item.name}`
            }
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-base ${
              logged
                ? 'border-carolina bg-carolina text-paper-raised'
                : 'border-rule-strong text-ink'
            }`}
          >
            {logged ? (
              <span className="data text-xs font-semibold">{formatServings(servings)}</span>
            ) : (
              <span aria-hidden className="text-xl leading-none">
                +
              </span>
            )}
          </button>
        ) : (
          <Link
            href="/login"
            aria-label={`Sign in to log ${item.name}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-rule text-xl leading-none text-ink-faint"
          >
            <span aria-hidden>+</span>
          </Link>
        )}
      </span>
    </li>
  );
}

/** 1 → "1×", 1.5 → "1.5×" — trailing zeros just add noise in an 11px circle. */
function formatServings(servings: number): string {
  const rounded = Math.round(servings * 100) / 100;
  return `${rounded}×`;
}
