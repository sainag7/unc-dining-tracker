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
 * Total servings logged per recipe on a date, so menu rows can show what's
 * already been added today without a second round trip per row.
 */
export async function getLoggedServingsByRecipe(
  db: Db,
  userId: string,
  serviceDate: string,
): Promise<Map<number, number>> {
  const { data, error } = await db
    .from('food_log')
    .select('recipe_id, servings')
    .eq('user_id', userId)
    .eq('service_date', serviceDate);

  if (error) throw new Error(`Failed to load today's log: ${error.message}`);

  const byRecipe = new Map<number, number>();
  for (const row of data ?? []) {
    byRecipe.set(row.recipe_id, (byRecipe.get(row.recipe_id) ?? 0) + row.servings);
  }
  return byRecipe;
}

/**
 * Orders past picks by how often they were logged, keeping only what's on the
 * menu right now. Ties break toward the more recent pick, so a habit that's
 * been dropped drifts down the list.
 *
 * Pure so the ranking can be tested without a database.
 */
export function rankUsuals(
  rows: Array<{ recipe_id: number; logged_at: string }>,
  onMenu: Set<number>,
  limit = 8,
): number[] {
  const stats = new Map<number, { count: number; last: string }>();

  for (const row of rows) {
    if (!onMenu.has(row.recipe_id)) continue;
    const current = stats.get(row.recipe_id);
    if (current) {
      current.count++;
      if (row.logged_at > current.last) current.last = row.logged_at;
    } else {
      stats.set(row.recipe_id, { count: 1, last: row.logged_at });
    }
  }

  return [...stats.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].last.localeCompare(a[1].last))
    .slice(0, limit)
    .map(([recipeId]) => recipeId);
}

/**
 * What this user usually eats at this hall and meal period.
 *
 * Scoped to the last 90 days so a habit from last semester doesn't outrank
 * this month's, and intersected with the current menu so nothing unservable
 * is suggested.
 */
export async function getUsualRecipeIds(
  db: Db,
  userId: string,
  hallId: number,
  mealPeriodName: string,
  onMenu: Set<number>,
  limit = 8,
): Promise<number[]> {
  if (onMenu.size === 0) return [];

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await db
    .from('food_log')
    .select('recipe_id, logged_at')
    .eq('user_id', userId)
    .eq('hall_id', hallId)
    .eq('meal_period_name', mealPeriodName)
    .gte('service_date', since);

  if (error) throw new Error(`Failed to load usuals: ${error.message}`);

  return rankUsuals(data ?? [], onMenu, limit);
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
