import type { DayTotals } from '@/lib/log';

function Macro({ label, value, goal }: { label: string; value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const over = value > goal;

  return (
    <div className="flex-1">
      <div className="label">{label}</div>
      <div className="data mt-0.5 text-sm">
        {value}
        <span className="text-ink-faint">/{goal}g</span>
      </div>
      {/* A hairline under the figure, not a chunky track — the number leads. */}
      <div className="mt-1 h-px w-full bg-rule">
        <div
          className={`h-px ${over ? 'bg-serving' : 'bg-carolina'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The day's totals, set like the head of a nutrition label.
 *
 * Deliberately the same typographic structure as the panel on a single item,
 * so one item and one day read as the same kind of object.
 */
export function DaySummary({
  totals,
  calorieGoal,
  proteinGoal,
  carbGoal,
  fatGoal,
}: {
  totals: DayTotals;
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
}) {
  const remaining = calorieGoal - totals.calories;

  return (
    <section className="rule-top pt-2">
      <div className="flex items-end justify-between gap-3">
        <span className="signage text-xl">Calories</span>
        <span className="data text-[2.75rem] font-semibold leading-none">
          {totals.calories.toLocaleString()}
        </span>
      </div>

      <p className="mt-1 border-b border-rule pb-2 text-right text-xs text-ink-soft">
        {remaining >= 0 ? (
          <>
            <span className="data text-ink">{remaining.toLocaleString()}</span> left of{' '}
            <span className="data">{calorieGoal.toLocaleString()}</span>
          </>
        ) : (
          <>
            <span className="data font-semibold text-serving">
              {Math.abs(remaining).toLocaleString()}
            </span>{' '}
            over <span className="data">{calorieGoal.toLocaleString()}</span>
          </>
        )}
      </p>

      <div className="mt-2 flex gap-5">
        <Macro label="Protein" value={totals.protein} goal={proteinGoal} />
        <Macro label="Carbs" value={totals.carbs} goal={carbGoal} />
        <Macro label="Fat" value={totals.fat} goal={fatGoal} />
      </div>
    </section>
  );
}
