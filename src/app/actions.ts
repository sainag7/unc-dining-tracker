'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { campusToday } from '@/lib/dates';
import { servingsAfterRemoval } from '@/lib/log';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface LogResult extends ActionResult {
  /**
   * Id of the row written or incremented.
   *
   * Nothing reads this today — it existed for the menu screen's add-undo,
   * which the quantity stepper replaced. Kept because it is the natural
   * result of a write and costs nothing to return; delete it if a second
   * caller never appears.
   */
  logId?: number;
}

export interface RemoveResult extends ActionResult {
  /** How much came off — 1, or less when the line was a part serving. */
  removed?: number;
}

const NOT_SIGNED_IN = 'Sign in to keep track of what you eat.';

/**
 * One line on the tray: a recipe eaten at a particular hall, meal and date.
 *
 * This is the key `food_log` is unique on (migration 0002). Both halves of it
 * are nullable, and Postgres never matches a null with `=`, so the filters have
 * to switch to `is` — getting that wrong silently matches nothing and turns
 * every add back into an insert.
 */
interface Slot {
  serviceDate: string;
  mealPeriodName: string | null;
  hallId: number | null;
}

function slotQuery(
  db: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  recipeId: number,
  slot: Slot,
) {
  const query = db
    .from('food_log')
    .select('id, servings')
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
    .eq('service_date', slot.serviceDate);

  const withPeriod =
    slot.mealPeriodName === null
      ? query.is('meal_period_name', null)
      : query.eq('meal_period_name', slot.mealPeriodName);

  return slot.hallId === null
    ? withPeriod.is('hall_id', null)
    : withPeriod.eq('hall_id', slot.hallId);
}

/**
 * Records that the user ate something.
 *
 * Macros are snapshotted from the recipe at log time: UNC revises recipes, and
 * a day you already logged should never quietly change its totals afterwards.
 */
export async function logFood(input: {
  recipeId: number;
  servings: number;
  serviceDate?: string;
  mealPeriodName?: string | null;
  hallId?: number | null;
}): Promise<LogResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const servings = Number(input.servings);
  if (!Number.isFinite(servings) || servings <= 0 || servings > 50) {
    return { ok: false, error: 'Servings must be between 0 and 50.' };
  }

  const { data: recipe } = await supabase
    .from('recipes')
    .select('id, calories, protein_g, carbs_g, fat_g')
    .eq('id', input.recipeId)
    .maybeSingle();

  if (!recipe) return { ok: false, error: "That item isn't on the menu any more." };

  const slot = {
    serviceDate: input.serviceDate ?? campusToday(),
    mealPeriodName: input.mealPeriodName ?? null,
    hallId: input.hallId ?? null,
  };

  const { data: existing } = await slotQuery(supabase, user.id, recipe.id, slot).maybeSingle();

  // Second helping of something already on the tray: move the number, don't
  // add a line. The snapshot stays as it was — logFood's rule is that a day
  // already logged never quietly changes its totals, and UNC can revise a
  // recipe between the first plate and the second.
  if (existing) {
    const { error } = await supabase
      .from('food_log')
      .update({ servings: existing.servings + servings })
      .eq('id', existing.id)
      .eq('user_id', user.id);

    if (error) return { ok: false, error: `Could not save that: ${error.message}` };

    revalidatePath('/', 'layout');
    return { ok: true, logId: existing.id };
  }

  const { data: inserted, error } = await supabase
    .from('food_log')
    .insert({
      user_id: user.id,
      recipe_id: recipe.id,
      service_date: slot.serviceDate,
      meal_period_name: slot.mealPeriodName,
      hall_id: slot.hallId,
      servings,
      calories_snapshot: recipe.calories,
      protein_snapshot: recipe.protein_g,
      carbs_snapshot: recipe.carbs_g,
      fat_snapshot: recipe.fat_g,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: `Could not save that: ${error.message}` };

  // 'layout' so the tab bar's running total refreshes along with the pages.
  revalidatePath('/', 'layout');
  return { ok: true, logId: inserted?.id };
}

/**
 * Takes one serving back off a recipe for a given slot.
 *
 * The menu row knows a recipe, a date, a hall and a meal — not a log id — and
 * that set is exactly the slot key, so there is at most one row to find. It
 * either shrinks that row or deletes it, per `servingsAfterRemoval`: the
 * `servings > 0` check constraint means a 1× line can't be updated to zero.
 *
 * Scoped identically to `getLoggedServingsByRecipe`, which is what puts the
 * count on the button. Filtering differently here would take away something the
 * count never included.
 *
 * Read-modify-write, with no atomic decrement available: two overlapping calls
 * can read the same row and collapse into one subtraction. The caller's
 * router.refresh() settles it, so the worst case is a number that lands one
 * higher, never a corrupted row. A version guard would be worse — it would turn
 * deliberate fast tapping into error toasts.
 */
export async function removeServing(input: {
  recipeId: number;
  serviceDate?: string;
  mealPeriodName?: string | null;
  hallId?: number | null;
}): Promise<RemoveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const { data: line } = await slotQuery(supabase, user.id, input.recipeId, {
    serviceDate: input.serviceDate ?? campusToday(),
    mealPeriodName: input.mealPeriodName ?? null,
    hallId: input.hallId ?? null,
  }).maybeSingle();

  if (!line) return { ok: false, error: 'Nothing to remove.' };

  const next = servingsAfterRemoval(line.servings);

  // The user_id filter is belt-and-braces; RLS already scopes this to the owner.
  const { error } =
    next === null
      ? await supabase.from('food_log').delete().eq('id', line.id).eq('user_id', user.id)
      : await supabase
          .from('food_log')
          .update({ servings: next })
          .eq('id', line.id)
          .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, removed: next === null ? line.servings : 1 };
}

export async function updateServings(logId: number, servings: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  if (!Number.isFinite(servings) || servings <= 0 || servings > 50) {
    return { ok: false, error: 'Servings must be between 0 and 50.' };
  }

  // The user_id filter is belt-and-braces; RLS already scopes this to the owner.
  const { error } = await supabase
    .from('food_log')
    .update({ servings })
    .eq('id', logId)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function removeLog(logId: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const { error } = await supabase
    .from('food_log')
    .delete()
    .eq('id', logId)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Puts a deleted entry back exactly as it was.
 *
 * Not logFood: that re-reads the recipe and takes a fresh snapshot, so undoing
 * a delete could silently change the day's totals if UNC revised the recipe in
 * between. An undo has to restore, not re-log.
 *
 * It adds to whatever is in the slot rather than inserting blindly. Migration
 * 0002 made (user, date, recipe, meal, hall) unique, so if you delete a line
 * and then log the same thing again before the undo toast times out, a bare
 * insert violates the index and the undo fails with a constraint error. The
 * line is the same line either way; restoring it means putting the servings
 * back onto it.
 */
export async function restoreLog(entry: {
  recipeId: number;
  serviceDate: string;
  mealPeriodName: string | null;
  hallId: number | null;
  servings: number;
  caloriesSnapshot: number | null;
  proteinSnapshot: number | null;
  carbsSnapshot: number | null;
  fatSnapshot: number | null;
}): Promise<LogResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const slot = {
    serviceDate: entry.serviceDate,
    mealPeriodName: entry.mealPeriodName,
    hallId: entry.hallId,
  };

  const { data: existing } = await slotQuery(supabase, user.id, entry.recipeId, slot).maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('food_log')
      .update({ servings: existing.servings + entry.servings })
      .eq('id', existing.id)
      .eq('user_id', user.id);

    if (error) return { ok: false, error: `Could not restore that: ${error.message}` };

    revalidatePath('/', 'layout');
    return { ok: true, logId: existing.id };
  }

  const { data: inserted, error } = await supabase
    .from('food_log')
    .insert({
      user_id: user.id,
      recipe_id: entry.recipeId,
      service_date: entry.serviceDate,
      meal_period_name: entry.mealPeriodName,
      hall_id: entry.hallId,
      servings: entry.servings,
      calories_snapshot: entry.caloriesSnapshot,
      protein_snapshot: entry.proteinSnapshot,
      carbs_snapshot: entry.carbsSnapshot,
      fat_snapshot: entry.fatSnapshot,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: `Could not restore that: ${error.message}` };

  revalidatePath('/', 'layout');
  return { ok: true, logId: inserted?.id };
}

export async function updateGoals(input: {
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
  dietaryPrefs: string[];
  allergensAvoid: string[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const positiveInt = (n: number) => Number.isFinite(n) && n > 0 && n < 100000;
  if (
    ![input.calorieGoal, input.proteinGoal, input.carbGoal, input.fatGoal].every(positiveInt)
  ) {
    return { ok: false, error: 'Goals need to be positive numbers.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      calorie_goal: Math.round(input.calorieGoal),
      protein_goal_g: Math.round(input.proteinGoal),
      carb_goal_g: Math.round(input.carbGoal),
      fat_goal_g: Math.round(input.fatGoal),
      dietary_prefs: input.dietaryPrefs,
      allergens_avoid: input.allergensAvoid,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings');
  revalidatePath('/');
  return { ok: true };
}
