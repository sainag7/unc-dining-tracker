import type { Db } from './menu';
import type { FoodLogRow, ProfileRow } from './supabase/database.types';

export interface LogEntry extends FoodLogRow {
  recipeName: string;
  servingSize: string | null;
  hallName: string | null;
}

export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Sums a day's entries, scaling each snapshot by the servings logged. */
export function totalsFor(entries: Pick<
  FoodLogRow,
  'servings' | 'calories_snapshot' | 'protein_snapshot' | 'carbs_snapshot' | 'fat_snapshot'
>[]): DayTotals {
  const totals: DayTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  for (const e of entries) {
    totals.calories += (e.calories_snapshot ?? 0) * e.servings;
    totals.protein += (e.protein_snapshot ?? 0) * e.servings;
    totals.carbs += (e.carbs_snapshot ?? 0) * e.servings;
    totals.fat += (e.fat_snapshot ?? 0) * e.servings;
  }

  // Fractional servings produce long decimals; round once, at the end.
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
  };
}

export async function getDayLog(
  db: Db,
  userId: string,
  serviceDate: string,
): Promise<LogEntry[]> {
  const { data: rows, error } = await db
    .from('food_log')
    .select('*')
    .eq('user_id', userId)
    .eq('service_date', serviceDate)
    .order('logged_at');

  if (error) throw new Error(`Failed to load food log: ${error.message}`);
  if (!rows?.length) return [];

  const recipeIds = [...new Set(rows.map((r) => r.recipe_id))];
  const { data: recipes } = await db
    .from('recipes')
    .select('id, name, serving_size')
    .in('id', recipeIds);

  const { data: halls } = await db.from('dining_halls').select('id, name');

  const recipeById = new Map((recipes ?? []).map((r) => [r.id, r]));
  const hallById = new Map((halls ?? []).map((h) => [h.id, h.name]));

  return rows.map((row) => ({
    ...row,
    recipeName: recipeById.get(row.recipe_id)?.name ?? 'Unknown item',
    servingSize: recipeById.get(row.recipe_id)?.serving_size ?? null,
    hallName: row.hall_id ? (hallById.get(row.hall_id) ?? null) : null,
  }));
}

/**
 * Total servings logged per recipe for one hall and meal period, so menu rows
 * can show what's already been added without a round trip per row.
 *
 * Scoped to the hall and period on screen, not just the date. Filtering by date
 * alone made a dinner menu badge an item with the servings eaten at breakfast,
 * and put a count on the button that no control on that screen could take off.
 * The scope here is the same slot key `logFood` collapses on.
 */
export async function getLoggedServingsByRecipe(
  db: Db,
  userId: string,
  serviceDate: string,
  mealPeriodName: string | null,
  hallId: number | null,
): Promise<Map<number, number>> {
  let query = db
    .from('food_log')
    .select('recipe_id, servings')
    .eq('user_id', userId)
    .eq('service_date', serviceDate);

  // Postgres `= null` never matches; the nullable halves of the key need `is`.
  query = mealPeriodName === null
    ? query.is('meal_period_name', null)
    : query.eq('meal_period_name', mealPeriodName);
  query = hallId === null ? query.is('hall_id', null) : query.eq('hall_id', hallId);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to load today's log: ${error.message}`);

  const byRecipe = new Map<number, number>();
  for (const row of data ?? []) {
    byRecipe.set(row.recipe_id, (byRecipe.get(row.recipe_id) ?? 0) + row.servings);
  }
  return byRecipe;
}

/**
 * The order meals happen in, which is not the order they get logged in.
 *
 * Grouping used to key a `Map` in insertion order, so a breakfast item added
 * after dinner sorted last and the day read out of sequence.
 */
const MEAL_PERIOD_ORDER = [
  'Breakfast',
  // Weekends only, 9-11am, ahead of Brunch. It was missing here until live
  // weekend data turned it up, which put a Saturday morning after Late Night.
  'Continental',
  'Brunch',
  'Lunch',
  'Late Lunch',
  'Dinner',
  'Late Dinner',
  'Late Night',
];

/** Entries with no meal period recorded. Always sorts last. */
export const OTHER_MEAL = 'Other';

export interface MealGroup<T> {
  period: string;
  entries: T[];
}

/**
 * Splits a day into meal periods, in the order the meals happen.
 *
 * Periods UNC names something we don't know about keep their position relative
 * to each other and sit after the known ones, so a renamed service degrades to
 * "somewhere sensible" rather than disappearing.
 *
 * Pure so the ordering can be tested without a database.
 */
export function groupByMealPeriod<T extends { meal_period_name: string | null }>(
  entries: T[],
): MealGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = entry.meal_period_name ?? OTHER_MEAL;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  const rank = (period: string) => {
    if (period === OTHER_MEAL) return Number.MAX_SAFE_INTEGER;
    const known = MEAL_PERIOD_ORDER.indexOf(period);
    return known === -1 ? MEAL_PERIOD_ORDER.length : known;
  };

  return [...groups]
    .map(([period, items]) => ({ period, entries: items }))
    .sort((a, b) => rank(a.period) - rank(b.period));
}

export interface GoalProgress {
  /** 0-100, clamped. The overshoot lives in `over`, not here. */
  pct: number;
  over: boolean;
}

/**
 * How far through a goal a number is.
 *
 * Two visualisations depend on this now — the macro hairlines on the log screen
 * and the plate ring on the tray bar — so the rule lives in one place rather
 * than being written twice and drifting.
 *
 * The clamp is what stops the ring winding past a full turn; `over` carries the
 * overshoot instead. The `goal > 0` guard is what stops a zero or unset goal
 * producing Infinity.
 *
 * Pure so both callers can be tested without a database or a render.
 */
export function goalProgress(value: number, goal: number): GoalProgress {
  return {
    pct: goal > 0 ? Math.min(100, (value / goal) * 100) : 0,
    over: goal > 0 && value > goal,
  };
}

/**
 * What one entry becomes when a serving is taken off it, or null when the row
 * should be deleted outright.
 *
 * A 1× row can't be decremented to zero: both `updateServings` and the
 * `servings > 0` check constraint reject it. So taking one away from anything at
 * or below a single serving means removing the entry, not shrinking it.
 *
 * Pure so the rule can be tested without a database.
 */
export function servingsAfterRemoval(servings: number): number | null {
  return servings > 1 ? servings - 1 : null;
}

export async function getProfile(db: Db, userId: string): Promise<ProfileRow | null> {
  const { data } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data ?? null;
}

/**
 * Per-day totals over a date range, for the history view.
 * Days with no entries are omitted — the caller fills gaps, since it knows
 * which dates it asked about.
 */
export async function getTotalsByDate(
  db: Db,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<Map<string, DayTotals>> {
  const { data, error } = await db
    .from('food_log')
    .select('service_date, servings, calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot')
    .eq('user_id', userId)
    .gte('service_date', fromDate)
    .lte('service_date', toDate);

  if (error) throw new Error(`Failed to load history: ${error.message}`);

  const byDate = new Map<string, typeof data>();
  for (const row of data ?? []) {
    if (!byDate.has(row.service_date)) byDate.set(row.service_date, []);
    byDate.get(row.service_date)!.push(row);
  }

  return new Map([...byDate].map(([date, rows]) => [date, totalsFor(rows!)]));
}

/**
 * Longest run of consecutive logged days ending today (or yesterday — a streak
 * shouldn't be considered broken until the day it's missed is over).
 */
export function currentStreak(loggedDates: Set<string>, today: string): number {
  const dayBefore = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  };

  let cursor = loggedDates.has(today) ? today : dayBefore(today);
  let streak = 0;

  while (loggedDates.has(cursor)) {
    streak++;
    cursor = dayBefore(cursor);
  }

  return streak;
}
