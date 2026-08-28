import type { DayTotals } from '@/lib/log';

function Macro({ label, value, goal }: { label: string; value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const over = value > goal;

  return (
    <div className="flex-1">
      <div className="placard text-text-muted">{label}</div>
      <div className="data mt-0.5 text-body">
        {value}
        <span className="text-text-muted">/{goal}g</span>
      </div>
      {/* A hairline under the figure, not a chunky track — the number leads.
          Past the goal it goes neutral rather than picking up a second
          accent; the word "over" above carries the meaning. */}
      <div className="mt-1 h-px w-full bg-border">
        <div
          className={`h-px ${over ? 'bg-danger' : 'bg-text'}`}
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
    <section className="border-t border-text pt-2">
      <div className="flex items-end justify-between gap-3">
        <span className="placard text-text-muted">Calories</span>
        <span className="data text-data-xl font-semibold">
          {totals.calories.toLocaleString()}
        </span>
      </div>

      <p className="mt-1 border-b border-border pb-2 text-right text-meta text-text-muted">
        {remaining >= 0 ? (
          <>
            <span className="data text-text">{remaining.toLocaleString()}</span> left of{' '}
            <span className="data">{calorieGoal.toLocaleString()}</span>
          </>
        ) : (
          <>
            <span className="data font-semibold text-text">
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
