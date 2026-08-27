'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DietBadges } from './ui/badge';
import { Check, Plus } from './ui/icons';
import { allergenLabel, conflictingAllergens } from '@/lib/labels';
import type { RecipeRow } from '@/lib/supabase/database.types';

/**
 * One item on the menu.
 *
 * The row itself opens the nutrition sheet; the button on the right logs a
 * serving outright. Splitting them is what turns a five-item meal from fifteen
 * taps into five, without losing the ability to set an exact portion.
 *
 * Three fixed zones, left to right: name, then dietary glyphs, then calories
 * and the button in a column that never moves. The number sits next to the
 * button it belongs to rather than a screen away from it.
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
  const logged = servings > 0;

  // Fires the pop only on a fresh add, not on the initial render of a row
  // that was already logged earlier in the day.
  const [justAdded, setJustAdded] = useState(false);
  const previous = useRef(servings);
  useEffect(() => {
    if (servings > previous.current) {
      setJustAdded(true);
      const timer = setTimeout(() => setJustAdded(false), 250);
      return () => clearTimeout(timer);
    }
    previous.current = servings;
  }, [servings]);

  return (
    <li className="flex items-center gap-2 border-b border-border">
      <button type="button" onClick={onOpenDetail} className="min-w-0 flex-1 py-1.5 text-left">
        <span className={`block truncate text-body ${logged ? 'text-text-muted' : ''}`}>
          {item.name}
        </span>

        {(conflicts.length > 0 || stationLabel) && (
          <span className="mt-0.5 block truncate text-meta">
            {conflicts.length > 0 && (
              <span className="font-semibold text-danger">
                Contains {conflicts.map(allergenLabel).join(', ')}
              </span>
            )}
            {conflicts.length > 0 && stationLabel && <span className="text-text-muted"> · </span>}
            {stationLabel && <span className="text-text-muted">{stationLabel}</span>}
          </span>
        )}
      </button>

      <DietBadges properties={item.properties} />

      <span className="flex shrink-0 items-center gap-2 py-1.5">
        <span className="data w-9 text-right text-body">
          {item.calories === null ? '—' : Math.round(item.calories)}
        </span>

        {isSignedIn ? (
          <button
            type="button"
            onClick={onQuickAdd}
            aria-pressed={logged}
            aria-label={
              logged ? `Add another ${item.name}. ${servings} logged.` : `Add ${item.name}`
            }
            className={`on-accent flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-150 ease-out ${
              logged ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong text-text'
            } ${justAdded ? 'motion-safe:animate-pop' : ''}`}
          >
            {logged ? (
              servings === 1 ? (
                <Check size={18} />
              ) : (
                <span className="data text-meta font-semibold">{formatServings(servings)}</span>
              )
            ) : (
              <Plus />
            )}
          </button>
        ) : (
          <Link
            href="/login"
            aria-label={`Sign in to log ${item.name}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-muted"
          >
            <Plus />
          </Link>
        )}
      </span>
    </li>
  );
}

/** 1.5 → "1.5×" — trailing zeros just add noise in a 44px circle. */
function formatServings(servings: number): string {
  const rounded = Math.round(servings * 100) / 100;
  return `${rounded}×`;
}
