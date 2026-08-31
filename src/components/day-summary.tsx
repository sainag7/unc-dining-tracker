import { goalProgress, type DayTotals } from '@/lib/log';
import { ProgressRing } from './ui/progress-ring';

/**
 * The day's totals, as two cards: calories, then macros.
 *
 * These are cards, which the rest of the app deliberately avoids — the house
 * style is rules and space. The exception is argued in DESIGN.md: a dashboard
 * is the one screen where the numbers are the content rather than a label on
 * something else, and a ring needs a ground to sit on.
 */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    // Fill and edge together. Neither is enough alone here: in light the white
    // fill is only 1.07:1 from the page, and in dark --surface *equals* --bg,
    // so a filled card would be invisible. --surface-alt lifts it there, and
    // the border-strong hairline (1.45 light, 1.46 dark) is what actually
    // draws the boundary in both.
    <section className="rounded-lg border border-border-strong bg-surface p-4 dark:bg-surface-alt">
      <h2 className="text-input font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** One figure in the calories card's right-hand column. */
function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="data text-row font-semibold">{value.toLocaleString()}</span>
    </div>
  );
}

function Macro({
  label,
  value,
  goal,
  colorClass,
}: {
  label: string;
  value: number;
  goal: number;
  colorClass: string;
}) {
  const { over } = goalProgress(value, goal);
  const left = goal - value;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <span className={`truncate text-micro font-semibold ${colorClass}`}>{label}</span>

      <ProgressRing
        value={value}
        goal={goal}
        size={84}
        stroke={9}
        arcClassName={colorClass}
        label={`${label}: ${value} of ${goal} grams`}
      >
        <span className="data text-row font-semibold text-text">{value}</span>
        <span className="data text-micro text-text-muted">/{goal}g</span>
      </ProgressRing>

      {/* Past the goal this says how far over rather than a negative "left",
          which reads as a bug the first time you see it. */}
      <span className="text-micro text-text-muted">
        {over ? `${Math.abs(left)}g over` : `${left}g left`}
      </span>
    </div>
  );
}

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
  const { over } = goalProgress(totals.calories, calorieGoal);

  return (
    <div className="flex flex-col gap-3">
      <Card title="Calories">
        {/*
          The reference reads "Remaining = Goal - Food + Exercise". There is no
          exercise anywhere in this app — no table, no column, no way to enter
          one — so the equation is the two terms that exist. A permanent zero
          Exercise row would advertise a feature that isn't there.
        */}
        <p className="mt-0.5 text-micro text-text-muted">Remaining = Goal &minus; Food</p>

        <div className="mt-3 flex items-center gap-5">
          <ProgressRing
            value={totals.calories}
            goal={calorieGoal}
            size={132}
            stroke={8}
            arcClassName={over ? 'text-danger' : 'text-accent'}
            label={`Calories: ${totals.calories} of ${calorieGoal}`}
          >
            <span
              className={`data text-data-xl font-semibold ${over ? 'text-danger' : 'text-text'}`}
            >
              {Math.abs(remaining).toLocaleString()}
            </span>
            <span className="text-micro text-text-muted">{over ? 'Over' : 'Remaining'}</span>
          </ProgressRing>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Tally label="Base Goal" value={calorieGoal} />
            <Tally label="Food" value={totals.calories} />
          </div>
        </div>
      </Card>

      <Card title="Macros">
        {/* Carbs, fat, protein — the reference's order, which is also the order
            they appear on a nutrition label. */}
        <div className="mt-3 flex items-start gap-2">
          <Macro
            label="Carbs"
            value={totals.carbs}
            goal={carbGoal}
            colorClass="text-macro-carb"
          />
          <Macro label="Fat" value={totals.fat} goal={fatGoal} colorClass="text-macro-fat" />
          <Macro
            label="Protein"
            value={totals.protein}
            goal={proteinGoal}
            colorClass="text-macro-protein"
          />
        </div>
      </Card>
    </div>
  );
}
