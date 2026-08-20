import type { DayTotals } from '@/lib/log';

function MacroBar({
  label,
  value,
  goal,
  unit = 'g',
}: {
  label: string;
  value: number;
  goal: number;
  unit?: string;
}) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const over = value > goal;

  return (
    <div className="border-t border-rule py-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="data">
          {value}
          {unit}
          <span className="text-ink-faint">
            {' '}
            / {goal}
            {unit}
          </span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper-sunk">
        <div
          className={`h-full rounded-full ${over ? 'bg-serving' : 'bg-carolina'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The day's tally, set as an oversized nutrition-label header.
 *
 * Reusing the label's typographic structure here means the whole app speaks one
 * visual language: the panel on a single item and the panel on a whole day are
 * recognisably the same object.
 */
export function DaySummary({
  totals,
  calorieGoal,
  proteinGoal,
  carbGoal,
  fatGoal,
  itemCount,
}: {
  totals: DayTotals;
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
  itemCount: number;
}) {
  const remaining = calorieGoal - totals.calories;

  return (
    <section className="border-2 border-rule-strong bg-paper-raised px-4 py-3">
      <div className="flex items-baseline justify-between">
        <h2 className="signage text-2xl leading-none">Today&rsquo;s total</h2>
        <span className="data text-xs text-ink-soft">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="mt-1 flex items-end justify-between border-b-8 border-rule-strong pb-1">
        <span className="signage text-2xl">Calories</span>
        <span className="data text-5xl font-semibold leading-none">{totals.calories}</span>
      </div>

      <p className="py-1.5 text-sm text-ink-soft">
        {remaining >= 0 ? (
          <>
            <span className="data font-semibold text-ink">{remaining}</span> left of your{' '}
            <span className="data">{calorieGoal}</span> goal
          </>
        ) : (
          <>
            <span className="data font-semibold text-serving">{Math.abs(remaining)}</span> over
            your <span className="data">{calorieGoal}</span> goal
          </>
        )}
      </p>

      <MacroBar label="Protein" value={totals.protein} goal={proteinGoal} />
      <MacroBar label="Carbs" value={totals.carbs} goal={carbGoal} />
      <MacroBar label="Fat" value={totals.fat} goal={fatGoal} />
    </section>
  );
}
