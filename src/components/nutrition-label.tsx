import type { RecipeRow } from '@/lib/supabase/database.types';

/**
 * FDA Daily Values (2,000 cal reference), used to derive the %DV column.
 * UNC shows these on its own site; we recompute rather than scrape them so the
 * figures stay correct when a portion is scaled.
 */
const DAILY_VALUES = {
  fat_g: 78,
  sat_fat_g: 20,
  cholesterol_mg: 300,
  sodium_mg: 2300,
  carbs_g: 275,
  fiber_g: 28,
  added_sugar_g: 50,
  calcium_mg: 1300,
  iron_mg: 18,
  potassium_mg: 4700,
  vitamin_d_mcg: 20,
} as const;

/** Small amounts keep a decimal; anything larger reads better as a whole number. */
function amount(value: number | null, servings: number, unit: string): string {
  if (value === null) return '—';
  const scaled = value * servings;
  const rounded = scaled < 10 ? Math.round(scaled * 10) / 10 : Math.round(scaled);
  return `${rounded}${unit}`;
}

function percent(value: number | null, servings: number, dv: number): string {
  if (value === null) return '';
  return `${Math.round(((value * servings) / dv) * 100)}%`;
}

function Row({
  label,
  value,
  dv,
  indent = 0,
  bold = false,
}: {
  label: string;
  value: string;
  dv?: string;
  indent?: 0 | 1 | 2;
  bold?: boolean;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 border-t border-rule py-1 text-[13px]"
      style={{ paddingLeft: `${indent * 0.9}rem` }}
    >
      <span className={bold ? 'font-semibold' : ''}>
        {bold ? <strong>{label}</strong> : label} <span className="data">{value}</span>
      </span>
      {dv ? <span className="data font-semibold tabular-nums">{dv}</span> : null}
    </div>
  );
}

/**
 * The app's signature element: the item detail is a real nutrition label.
 *
 * Every figure scales live with the serving stepper, so "I had two" is a
 * direct, legible change rather than arithmetic the user has to trust.
 */
export function NutritionLabel({
  recipe,
  servings = 1,
}: {
  recipe: RecipeRow;
  servings?: number;
}) {
  const calories = recipe.calories === null ? '—' : Math.round(recipe.calories * servings);

  return (
    <div className="border-2 border-ink bg-paper-raised px-3 py-2 text-ink">
      <h3 className="signage text-3xl leading-none">Nutrition Facts</h3>

      <div className="mt-1 flex items-baseline justify-between border-b-8 border-ink pb-1 text-[13px]">
        <span>Serving size</span>
        <span className="data font-semibold">{recipe.serving_size ?? '1 serving'}</span>
      </div>

      {servings !== 1 && (
        <div className="flex items-baseline justify-between bg-serving-bg px-2 py-1 text-[12px] text-serving">
          <span>Showing</span>
          <span className="data font-semibold">{servings} servings</span>
        </div>
      )}

      <div className="pt-1 text-[11px] font-semibold">Amount per serving</div>

      <div className="flex items-end justify-between border-b-4 border-ink pb-1">
        <span className="signage text-2xl">Calories</span>
        <span className="data text-4xl font-semibold leading-none">{calories}</span>
      </div>

      <div className="flex justify-end border-t border-rule py-1 text-[11px] font-semibold">
        % Daily Value*
      </div>

      <Row
        label="Total Fat"
        value={amount(recipe.fat_g, servings, 'g')}
        dv={percent(recipe.fat_g, servings, DAILY_VALUES.fat_g)}
        bold
      />
      <Row
        label="Saturated Fat"
        value={amount(recipe.sat_fat_g, servings, 'g')}
        dv={percent(recipe.sat_fat_g, servings, DAILY_VALUES.sat_fat_g)}
        indent={1}
      />
      <Row label="Trans Fat" value={amount(recipe.trans_fat_g, servings, 'g')} indent={1} />
      <Row
        label="Cholesterol"
        value={amount(recipe.cholesterol_mg, servings, 'mg')}
        dv={percent(recipe.cholesterol_mg, servings, DAILY_VALUES.cholesterol_mg)}
        bold
      />
      <Row
        label="Sodium"
        value={amount(recipe.sodium_mg, servings, 'mg')}
        dv={percent(recipe.sodium_mg, servings, DAILY_VALUES.sodium_mg)}
        bold
      />
      <Row
        label="Total Carbohydrate"
        value={amount(recipe.carbs_g, servings, 'g')}
        dv={percent(recipe.carbs_g, servings, DAILY_VALUES.carbs_g)}
        bold
      />
      <Row
        label="Dietary Fiber"
        value={amount(recipe.fiber_g, servings, 'g')}
        dv={percent(recipe.fiber_g, servings, DAILY_VALUES.fiber_g)}
        indent={1}
      />
      <Row label="Total Sugars" value={amount(recipe.sugars_g, servings, 'g')} indent={1} />
      <Row
        label="Includes Added Sugars"
        value={amount(recipe.added_sugar_g, servings, 'g')}
        dv={percent(recipe.added_sugar_g, servings, DAILY_VALUES.added_sugar_g)}
        indent={2}
      />
      <Row label="Protein" value={amount(recipe.protein_g, servings, 'g')} bold />

      <div className="mt-1 border-t-8 border-ink" />

      <Row
        label="Vitamin D"
        value={amount(recipe.vitamin_d_mcg, servings, 'mcg')}
        dv={percent(recipe.vitamin_d_mcg, servings, DAILY_VALUES.vitamin_d_mcg)}
      />
      <Row
        label="Calcium"
        value={amount(recipe.calcium_mg, servings, 'mg')}
        dv={percent(recipe.calcium_mg, servings, DAILY_VALUES.calcium_mg)}
      />
      <Row
        label="Iron"
        value={amount(recipe.iron_mg, servings, 'mg')}
        dv={percent(recipe.iron_mg, servings, DAILY_VALUES.iron_mg)}
      />
      <Row
        label="Potassium"
        value={amount(recipe.potassium_mg, servings, 'mg')}
        dv={percent(recipe.potassium_mg, servings, DAILY_VALUES.potassium_mg)}
      />

      <p className="mt-2 border-t-4 border-ink pt-2 text-[10px] leading-snug text-ink-soft">
        * Percent Daily Values are based on a 2,000 calorie diet. UNC prepares food in a
        commercial kitchen, so ingredients and preparation can vary from what&rsquo;s listed.
      </p>
    </div>
  );
}
