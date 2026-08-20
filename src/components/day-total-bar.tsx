import Link from 'next/link';
import type { DayTotals } from '@/lib/log';

/**
 * Persistent running tab, pinned to the bottom where a thumb reaches.
 *
 * Signed out it's an invitation rather than a wall — the menu itself stays
 * fully usable without an account.
 */
export function DayTotalBar({
  totals,
  calorieGoal,
  proteinGoal,
  isSignedIn,
}: {
  totals: DayTotals;
  calorieGoal: number;
  proteinGoal: number;
  isSignedIn: boolean;
}) {
  if (!isSignedIn) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper-raised px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Link
          href="/login"
          className="block w-full rounded-xl bg-navy py-3 text-center text-sm font-semibold text-paper-raised"
        >
          Sign in to start tracking
        </Link>
      </div>
    );
  }

  const pct = calorieGoal > 0 ? Math.min(100, (totals.calories / calorieGoal) * 100) : 0;
  const over = totals.calories > calorieGoal;

  return (
    <Link
      href="/dashboard"
      className="fixed inset-x-0 bottom-0 z-30 block border-t border-rule bg-paper-raised px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-ink-soft">Today</span>
        <span className="data text-xs text-ink-soft">
          {totals.protein}g / {proteinGoal}g protein
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="data text-2xl font-semibold leading-tight">
          {totals.calories}
          <span className="ml-1 text-sm font-normal text-ink-soft">
            / {calorieGoal} cal
          </span>
        </span>
        <span className="text-xs text-ink-soft">View day →</span>
      </div>

      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper-sunk"
        role="progressbar"
        aria-valuenow={totals.calories}
        aria-valuemin={0}
        aria-valuemax={calorieGoal}
        aria-label="Calories today"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            over ? 'bg-serving' : 'bg-carolina'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}
