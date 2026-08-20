import type { AdminClient } from '../supabase/admin';
import { campusToday, dateRange } from '../dates';
import { fetchMenuDay, fetchRecipe, collectRecipeIds } from './fetch';
import type { ScrapedMenuDay, ScrapedRecipe } from './types';

/** How many days ahead to pull. UNC publishes menus weeks in advance. */
export const LOOKAHEAD_DAYS = 7;

export interface SyncResult {
  daysScraped: number;
  recipesAdded: number;
  errors: string[];
}

/** Allergen/dietary tags as they appear on the menu page, keyed by recipe id. */
type MenuTags = Map<number, { allergens: string[]; properties: string[] }>;

/**
 * Dietary properties (vegan, halal, ...) only exist on the menu page's class
 * list — the recipe endpoint doesn't return them — so they're threaded through
 * from the menu scrape. Menu-page allergen keys are already normalized
 * ("wheat"), so they win over the recipe page's display text ("Wheat").
 */
function recipeToRow(r: ScrapedRecipe, tags?: { allergens: string[]; properties: string[] }) {
  return {
    id: r.recipeId,
    name: r.name,
    serving_size: r.servingSize,
    ingredients: r.ingredients,
    allergens: tags?.allergens.length ? tags.allergens : r.allergens,
    properties: tags?.properties ?? [],
    calories: r.calories,
    protein_g: r.proteinG,
    carbs_g: r.carbsG,
    fat_g: r.fatG,
    sat_fat_g: r.satFatG,
    trans_fat_g: r.transFatG,
    cholesterol_mg: r.cholesterolMg,
    sodium_mg: r.sodiumMg,
    fiber_g: r.fiberG,
    sugars_g: r.sugarsG,
    added_sugar_g: r.addedSugarG,
    calcium_mg: r.calciumMg,
    iron_mg: r.ironMg,
    potassium_mg: r.potassiumMg,
    vitamin_d_mcg: r.vitaminDMcg,
    scraped_at: new Date().toISOString(),
  };
}

/**
 * Writes one day's menu for one hall.
 *
 * Meal periods and items are replaced wholesale rather than diffed: stations get
 * renamed and items get reordered day to day, and a menu day is small enough
 * that a clean rewrite is simpler and less error-prone than reconciling.
 */
async function writeMenuDay(db: AdminClient, hallId: number, day: ScrapedMenuDay) {
  const { data: menuDay, error: dayErr } = await db
    .from('menu_days')
    .upsert(
      { hall_id: hallId, service_date: day.serviceDate, scraped_at: new Date().toISOString() },
      { onConflict: 'hall_id,service_date' },
    )
    .select('id')
    .single();

  if (dayErr || !menuDay) throw new Error(`menu_days upsert failed: ${dayErr?.message}`);

  // Cascades to menu_items.
  const { error: delErr } = await db
    .from('meal_periods')
    .delete()
    .eq('menu_day_id', menuDay.id);
  if (delErr) throw new Error(`meal_periods delete failed: ${delErr.message}`);

  for (const period of day.mealPeriods) {
    const { data: mp, error: mpErr } = await db
      .from('meal_periods')
      .insert({
        menu_day_id: menuDay.id,
        name: period.name,
        time_label: period.timeLabel,
        start_time: period.startTime,
        end_time: period.endTime,
        sort_order: period.sortOrder,
      })
      .select('id')
      .single();

    if (mpErr || !mp) throw new Error(`meal_periods insert failed: ${mpErr?.message}`);

    const rows = period.stations.flatMap((station, stationOrder) =>
      station.items.map((item, sortOrder) => ({
        meal_period_id: mp.id,
        recipe_id: item.recipeId,
        station: station.name,
        station_order: stationOrder,
        sort_order: sortOrder,
        searchable: item.searchable || null,
      })),
    );

    if (rows.length > 0) {
      const { error: itemErr } = await db.from('menu_items').insert(rows);
      if (itemErr) throw new Error(`menu_items insert failed: ${itemErr.message}`);
    }
  }
}

/**
 * Full sync: menus for every active hall across the lookahead window, then
 * nutrition for any recipe we haven't already cached.
 *
 * A failure on one hall/date is recorded and skipped rather than aborting the
 * run — a broken Tuesday shouldn't cost us Wednesday's menu.
 */
export async function syncAll(
  db: AdminClient,
  opts: { startDate?: string; days?: number } = {},
): Promise<SyncResult> {
  const startDate = opts.startDate ?? campusToday();
  const dates = dateRange(startDate, opts.days ?? LOOKAHEAD_DAYS);
  const errors: string[] = [];

  const { data: halls, error: hallErr } = await db
    .from('dining_halls')
    .select('id, slug')
    .eq('active', true)
    .order('sort_order');

  if (hallErr || !halls?.length) {
    throw new Error(`Could not load dining halls: ${hallErr?.message ?? 'none active'}`);
  }

  // Pass 1 — menus. Collect every recipe id and its tags along the way.
  const seenRecipeIds = new Set<number>();
  const menuTags: MenuTags = new Map();
  const scrapedDays: ScrapedMenuDay[] = [];

  for (const hall of halls) {
    for (const date of dates) {
      try {
        const day = await fetchMenuDay(hall.slug, date);
        for (const id of collectRecipeIds(day)) seenRecipeIds.add(id);
        for (const period of day.mealPeriods) {
          for (const station of period.stations) {
            for (const item of station.items) {
              if (!menuTags.has(item.recipeId)) {
                menuTags.set(item.recipeId, {
                  allergens: item.allergens,
                  properties: item.properties,
                });
              }
            }
          }
        }
        scrapedDays.push(day);

        // Recipes must exist before menu_items can reference them, so the
        // actual write happens after pass 2.
      } catch (err) {
        errors.push(`${hall.slug} ${date}: ${(err as Error).message}`);
      }
    }
  }

  // Pass 2 — nutrition, but only for recipes we've never seen. This is the step
  // that keeps daily volume near zero once the cache is warm.
  const known = new Set<number>();
  const ids = [...seenRecipeIds];
  const CHUNK = 500;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await db
      .from('recipes')
      .select('id')
      .in('id', ids.slice(i, i + CHUNK));
    if (error) throw new Error(`recipes lookup failed: ${error.message}`);
    for (const row of data ?? []) known.add(row.id);
  }

  const missing = ids.filter((id) => !known.has(id));
  let recipesAdded = 0;

  for (const id of missing) {
    try {
      const recipe = await fetchRecipe(id);
      const { error } = await db.from('recipes').upsert(recipeToRow(recipe, menuTags.get(id)));
      if (error) throw new Error(error.message);
      recipesAdded++;
    } catch (err) {
      errors.push(`recipe ${id}: ${(err as Error).message}`);
    }
  }

  // Pass 3 — write menus, now that their recipes exist. Items whose recipe
  // fetch failed are dropped so the FK stays satisfied.
  const usable = new Set([...known, ...missing]);
  let daysScraped = 0;

  for (const day of scrapedDays) {
    const hall = halls.find((h) => h.slug === day.hallSlug);
    if (!hall) continue;

    const filtered: ScrapedMenuDay = {
      ...day,
      mealPeriods: day.mealPeriods.map((p) => ({
        ...p,
        stations: p.stations
          .map((s) => ({ ...s, items: s.items.filter((i) => usable.has(i.recipeId)) }))
          .filter((s) => s.items.length > 0),
      })),
    };

    try {
      await writeMenuDay(db, hall.id, filtered);
      daysScraped++;
    } catch (err) {
      errors.push(`write ${day.hallSlug} ${day.serviceDate}: ${(err as Error).message}`);
    }
  }

  return { daysScraped, recipesAdded, errors };
}

/** Runs a sync and records the outcome in scraper_runs. */
export async function runSync(
  db: AdminClient,
  opts: { startDate?: string; days?: number } = {},
): Promise<SyncResult> {
  const { data: run } = await db
    .from('scraper_runs')
    .insert({ started_at: new Date().toISOString() })
    .select('id')
    .single();

  try {
    const result = await syncAll(db, opts);

    if (run) {
      await db
        .from('scraper_runs')
        .update({
          finished_at: new Date().toISOString(),
          days_scraped: result.daysScraped,
          recipes_added: result.recipesAdded,
          ok: result.errors.length === 0,
          error: result.errors.length ? result.errors.join('\n').slice(0, 5000) : null,
        })
        .eq('id', run.id);
    }

    return result;
  } catch (err) {
    if (run) {
      await db
        .from('scraper_runs')
        .update({
          finished_at: new Date().toISOString(),
          ok: false,
          error: (err as Error).message.slice(0, 5000),
        })
        .eq('id', run.id);
    }
    throw err;
  }
}
