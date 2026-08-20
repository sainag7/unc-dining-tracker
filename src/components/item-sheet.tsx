'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { NutritionLabel } from './nutrition-label';
import { logFood } from '@/app/actions';
import { allergenLabel, propertyLabel, conflictingAllergens } from '@/lib/labels';
import type { RecipeRow } from '@/lib/supabase/database.types';

/** Portion steps people actually take at a dining hall, rather than a free-text box. */
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
  onClose,
  onLogged,
}: {
  recipe: RecipeRow;
  context: SheetContext;
  onClose: () => void;
  onLogged: (recipe: RecipeRow, servings: number) => void;
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
    // Stop the page behind the sheet from scrolling with it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const stepIndex = SERVING_STEPS.indexOf(servings);
  const step = (delta: number) => {
    const next = SERVING_STEPS[Math.max(0, Math.min(SERVING_STEPS.length - 1, stepIndex + delta))];
    if (next) setServings(next);
  };

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
        onLogged(recipe, servings);
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
        className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={recipe.name}
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper p-4 pb-8 shadow-[var(--shadow-sheet)] sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="signage text-2xl leading-tight">{recipe.name}</h2>
            {recipe.serving_size && (
              <p className="text-sm text-ink-soft">Serving: {recipe.serving_size}</p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-full border border-rule px-3 py-1 text-sm text-ink-soft hover:bg-paper-sunk"
          >
            Close
          </button>
        </div>

        {conflicts.length > 0 && (
          <p className="mb-3 rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm font-semibold text-danger">
            Contains {conflicts.map(allergenLabel).join(', ')} — you asked to avoid that.
          </p>
        )}

        {(recipe.properties.length > 0 || recipe.allergens.length > 0) && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {recipe.properties.map((p) => (
              <span
                key={p}
                className="rounded-full bg-carolina/15 px-2 py-0.5 text-xs font-medium text-navy"
              >
                {propertyLabel(p)}
              </span>
            ))}
            {recipe.allergens.map((a) => (
              <span
                key={a}
                className="rounded-full border border-rule px-2 py-0.5 text-xs text-ink-soft"
              >
                {allergenLabel(a)}
              </span>
            ))}
          </div>
        )}

        {/* The stepper sits directly above the label so the numbers visibly move. */}
        <div className="mb-3 rounded-xl border border-rule bg-paper-raised p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">How much did you have?</span>
            <span className="data text-sm">
              {servings}× {recipe.serving_size ?? 'serving'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={stepIndex <= 0}
              aria-label="Less"
              className="h-11 w-11 shrink-0 rounded-lg border border-rule text-xl disabled:opacity-40"
            >
              −
            </button>

            <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
              {SERVING_STEPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setServings(s)}
                  aria-pressed={s === servings}
                  className={`data h-11 shrink-0 rounded-lg px-3 text-sm ${
                    s === servings
                      ? 'bg-navy text-paper-raised'
                      : 'border border-rule text-ink-soft'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => step(1)}
              disabled={stepIndex >= SERVING_STEPS.length - 1}
              aria-label="More"
              className="h-11 w-11 shrink-0 rounded-lg border border-rule text-xl disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        <NutritionLabel recipe={recipe} servings={servings} />

        {recipe.ingredients && (
          <details className="mt-3 rounded-xl border border-rule bg-paper-raised p-3">
            <summary className="cursor-pointer text-sm font-semibold">Ingredients</summary>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">{recipe.ingredients}</p>
          </details>
        )}

        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}

        <div className="sticky bottom-0 mt-4 -mx-4 bg-paper px-4 pt-2">
          {context.isSignedIn ? (
            <button
              type="button"
              onClick={handleLog}
              disabled={pending}
              className="w-full rounded-xl bg-navy py-3.5 text-base font-semibold text-paper-raised disabled:opacity-60"
            >
              {pending ? 'Adding…' : `Add ${servings}× to today`}
            </button>
          ) : (
            <a
              href="/login"
              className="block w-full rounded-xl bg-navy py-3.5 text-center text-base font-semibold text-paper-raised"
            >
              Sign in to track this
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
