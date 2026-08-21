'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { NutritionLabel } from './nutrition-label';
import { logFood } from '@/app/actions';
import { allergenLabel, propertyLabel, conflictingAllergens } from '@/lib/labels';
import type { RecipeRow } from '@/lib/supabase/database.types';

/** Portions people actually take at a dining hall, rather than a free-text box. */
const SERVING_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4];

export interface SheetContext {
  serviceDate: string;
  mealPeriodName: string | null;
  hallId: number | null;
  isSignedIn: boolean;
  allergensAvoid: string[];
}

export function ItemSheet({
  recipe,
  context,
  servingsToday = 0,
  onClose,
  onLogged,
}: {
  recipe: RecipeRow;
  context: SheetContext;
  /** Already logged today — shown so the sheet doesn't contradict the menu row. */
  servingsToday?: number;
  onClose: () => void;
  onLogged: (recipe: RecipeRow, servings: number, logId?: number) => void;
}) {
  const [servings, setServings] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);

  const conflicts = conflictingAllergens(recipe.allergens, context.allergensAvoid);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  function handleLog() {
    setError(null);
    startTransition(async () => {
      const result = await logFood({
        recipeId: recipe.id,
        servings,
        serviceDate: context.serviceDate,
        mealPeriodName: context.mealPeriodName,
        hallId: context.hallId,
      });

      if (result.ok) {
        onLogged(recipe, servings, result.logId);
        onClose();
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={recipe.name}
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto bg-paper shadow-[var(--shadow-sheet)]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-paper px-4 pt-3 pb-2">
          <div className="min-w-0">
            <h2 className="signage text-xl leading-tight">{recipe.name}</h2>
            {recipe.serving_size && (
              <p className="data text-xs text-ink-soft">One serving: {recipe.serving_size}</p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 text-sm text-carolina"
          >
            Close
          </button>
        </div>

        <div className="px-4 pb-8">
          {conflicts.length > 0 && (
            <p className="mb-3 bg-danger-bg px-3 py-2 text-sm font-semibold text-danger">
              Contains {conflicts.map(allergenLabel).join(', ')} — you asked to avoid that.
            </p>
          )}

          {servingsToday > 0 && (
            <p className="mb-3 text-xs text-ink-soft">
              Already logged today:{' '}
              <span className="data font-semibold text-ink">{servingsToday}×</span>
            </p>
          )}

          {recipe.properties.length > 0 && (
            <p className="mb-3 text-xs text-ink-soft">
              {recipe.properties.map(propertyLabel).join(' · ')}
            </p>
          )}

          {/* The stepper sits directly above the label so the figures visibly move. */}
          <div className="rule-top pt-2">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="label">How much did you have</span>
              <span className="data text-sm font-semibold">{servings}×</span>
            </div>

            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
              {SERVING_STEPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setServings(s)}
                  aria-pressed={s === servings}
                  className={`data h-11 w-14 shrink-0 border text-sm ${
                    s === servings
                      ? 'border-carolina bg-carolina text-paper-raised'
                      : 'border-rule text-ink-soft'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <NutritionLabel recipe={recipe} servings={servings} />
          </div>

          {recipe.ingredients && (
            <details className="mt-4 rule-top pt-2">
              <summary className="label cursor-pointer">Ingredients</summary>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">{recipe.ingredients}</p>
            </details>
          )}

          {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-paper px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {context.isSignedIn ? (
            <button
              type="button"
              onClick={handleLog}
              disabled={pending}
              className="signage w-full bg-navy py-3.5 text-base text-paper-raised disabled:opacity-60"
            >
              {pending ? 'Adding…' : `Add ${servings}× to ${context.mealPeriodName ?? 'today'}`}
            </button>
          ) : (
            <a
              href="/login"
              className="signage block w-full bg-navy py-3.5 text-center text-base text-paper-raised"
            >
              Sign in to track this
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
