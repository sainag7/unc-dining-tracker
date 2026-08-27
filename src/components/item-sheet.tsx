'use client';

import { useState, useTransition } from 'react';
import { NutritionLabel } from './nutrition-label';
import { Sheet } from './ui/sheet';
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

  const conflicts = conflictingAllergens(recipe.allergens, context.allergensAvoid);

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
    <Sheet
      label={recipe.name}
      onClose={onClose}
      footer={
        context.isSignedIn ? (
          <button
            type="button"
            onClick={handleLog}
            disabled={pending}
            className="on-accent h-12 w-full rounded-md bg-accent text-input font-semibold text-accent-fg disabled:opacity-50"
          >
            {pending ? 'Adding…' : `Add ${servings}× to ${context.mealPeriodName ?? 'today'}`}
          </button>
        ) : (
          <a
            href="/login"
            className="on-accent flex h-12 w-full items-center justify-center rounded-md bg-accent text-input font-semibold text-accent-fg"
          >
            Sign in to track this
          </a>
        )
      }
    >
      {recipe.serving_size && (
        <p className="data -mt-1 text-meta text-text-muted">
          One serving: {recipe.serving_size}
        </p>
      )}

      {conflicts.length > 0 && (
        <p className="mt-3 rounded-md bg-danger-bg px-3 py-2 text-body font-semibold text-danger">
          Contains {conflicts.map(allergenLabel).join(', ')} — you asked to avoid that.
        </p>
      )}

      {servingsToday > 0 && (
        <p className="mt-3 text-meta text-text-muted">
          Already logged today:{' '}
          <span className="data font-semibold text-text">{servingsToday}×</span>
        </p>
      )}

      {recipe.properties.length > 0 && (
        <p className="mt-3 text-meta text-text-muted">
          {recipe.properties.map(propertyLabel).join(' · ')}
        </p>
      )}

      {/* The stepper sits directly above the label so the figures visibly move. */}
      <div className="mt-4 border-t border-text pt-2">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="placard text-text-muted">How much did you have</span>
          <span className="data text-body font-semibold">{servings}×</span>
        </div>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {SERVING_STEPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setServings(s)}
              aria-pressed={s === servings}
              className={`data on-accent h-11 w-14 shrink-0 rounded-sm border text-body transition-colors duration-150 ease-out ${
                s === servings
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-border text-text-muted'
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
        <details className="mt-4 border-t border-text pt-2">
          <summary className="placard cursor-pointer text-text-muted">Ingredients</summary>
          <p className="mt-2 text-meta leading-relaxed text-text-muted">{recipe.ingredients}</p>
        </details>
      )}

      {error && (
        <p role="alert" className="mt-3 text-body font-medium text-danger">
          {error}
        </p>
      )}
    </Sheet>
  );
}
