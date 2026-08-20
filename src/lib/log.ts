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
