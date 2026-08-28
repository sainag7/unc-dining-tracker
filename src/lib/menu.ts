import type { SupabaseClient } from '@supabase/supabase-js';
import { toHHMM } from './dates';
import type { Database, DiningHallRow, RecipeRow } from './supabase/database.types';

export type Db = SupabaseClient<Database>;

export interface MealPeriodSummary {
  id: number;
  name: string;
  timeLabel: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface StationWithItems {
  name: string;
  items: RecipeRow[];
}

export async function getHalls(db: Db): Promise<DiningHallRow[]> {
  const { data, error } = await db
    .from('dining_halls')
    .select('*')
    .eq('active', true)
    .order('sort_order');

  if (error) throw new Error(`Failed to load dining halls: ${error.message}`);
  return data ?? [];
}

export async function getHall(db: Db, slug: string): Promise<DiningHallRow | null> {
  const { data } = await db.from('dining_halls').select('*').eq('slug', slug).maybeSingle();
  return data ?? null;
}

/**
 * The meal periods a hall serves on a date — names and times only.
 *
 * Kept separate from the items so the tab strip can render from a small query
 * and each page load only pays for the one period being viewed. A full day is
 * ~1,300 item rows across six periods; shipping all of that to a phone on
 * dining-hall wifi would be wasteful.
 */
export async function getMealPeriods(
  db: Db,
  hallSlug: string,
  serviceDate: string,
): Promise<MealPeriodSummary[]> {
  const hall = await getHall(db, hallSlug);
  if (!hall) return [];

  const { data: menuDay } = await db
    .from('menu_days')
    .select('id')
    .eq('hall_id', hall.id)
    .eq('service_date', serviceDate)
    .maybeSingle();

  if (!menuDay) return [];

  const { data, error } = await db
    .from('meal_periods')
    .select('id, name, time_label, start_time, end_time')
    .eq('menu_day_id', menuDay.id)
    .order('sort_order');

  if (error) throw new Error(`Failed to load meal periods: ${error.message}`);

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    timeLabel: p.time_label,
    // Postgres hands back "15:00:00"; everything downstream compares
    // against campusTimeOfDay(), which is "15:00". See toHHMM.
    startTime: toHHMM(p.start_time),
    endTime: toHHMM(p.end_time),
  }));
}

/** Everything served during one meal period, grouped by station in menu order. */
export async function getStations(db: Db, mealPeriodId: number): Promise<StationWithItems[]> {
  const { data: items, error } = await db
    .from('menu_items')
    .select('recipe_id, station, station_order, sort_order')
    .eq('meal_period_id', mealPeriodId)
    .order('station_order')
    .order('sort_order');

  if (error) throw new Error(`Failed to load menu items: ${error.message}`);
  if (!items?.length) return [];

  const recipeIds = [...new Set(items.map((i) => i.recipe_id))];
  const recipesById = new Map<number, RecipeRow>();

  // Chunked to stay clear of URL length limits on the `in` filter.
  const CHUNK = 400;
  for (let i = 0; i < recipeIds.length; i += CHUNK) {
    const { data, error: recipeErr } = await db
      .from('recipes')
      .select('*')
      .in('id', recipeIds.slice(i, i + CHUNK));
    if (recipeErr) throw new Error(`Failed to load recipes: ${recipeErr.message}`);
    for (const r of data ?? []) recipesById.set(r.id, r);
  }

  const stations = new Map<string, RecipeRow[]>();
  for (const item of items) {
    const recipe = recipesById.get(item.recipe_id);
    if (!recipe) continue;
    if (!stations.has(item.station)) stations.set(item.station, []);
    stations.get(item.station)!.push(recipe);
  }

  return [...stations].map(([name, items]) => ({ name, items }));
}

/** Dates that have a scraped menu, for the date picker's bounds. */
export async function getAvailableDates(db: Db, hallSlug: string): Promise<string[]> {
  const hall = await getHall(db, hallSlug);
  if (!hall) return [];

  const { data } = await db
    .from('menu_days')
    .select('service_date')
    .eq('hall_id', hall.id)
    .order('service_date');

  return (data ?? []).map((d) => d.service_date);
}
