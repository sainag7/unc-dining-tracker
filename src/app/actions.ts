'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { campusToday } from '@/lib/dates';

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

/*
 * Why these revalidate '/log' and not '/'.
 *
 * revalidatePath('/', 'layout') makes Next re-render the current route and
 * stream the whole RSC payload back inside the action's own response — on the
 * menu screen that is all 272 recipes, invisibly, on every tap. The client then
 * called router.refresh() and rendered the identical tree a second time. Two
 * full renders, ~29 Supabase round trips, to move one integer.
 *
 * The refresh is the half worth keeping: it is the only one that re-renders the
 * root layout, where the tray's numbers live. So the actions no longer touch
 * the current route at all — they revalidate /log, which is the one place that
 * must be right on a later visit, and the tray moves optimistically in the
 * meantime. See tray-provider.tsx.
 */
/**
 * Records that the user ate something.
 *
 * The rules live in the database now (migration 0003, `log_food`) so the iOS
 * app shares them: macros are snapshotted at log time, and a second helping of
 * something already on the tray moves the number rather than adding a line.
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

  const { data: logId, error } = await supabase.rpc('log_food', {
    p_recipe_id: input.recipeId,
    p_servings: servings,
    p_service_date: input.serviceDate ?? campusToday(),
    p_meal_period_name: input.mealPeriodName ?? null,
    p_hall_id: input.hallId ?? null,
  });

  if (error) return { ok: false, error: `Could not save that: ${error.message}` };

  revalidatePath('/log');
  return { ok: true, logId: logId ?? undefined };
}

/**
 * Takes one serving back off a recipe for a given slot.
 *
 * The menu row knows a recipe, a date, a hall and a meal — not a log id — and
 * that set is exactly the slot key, so there is at most one row to find.
 * `remove_serving` either shrinks it or deletes it, per `servingsAfterRemoval`,
 * and locks the row while it does so overlapping taps can't collapse into one.
 *
 * Scoped identically to `getLoggedServingsByRecipe`, which is what puts the
 * count on the button. Filtering differently here would take away something the
 * count never included.
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

  const { data: removed, error } = await supabase.rpc('remove_serving', {
    p_recipe_id: input.recipeId,
    p_service_date: input.serviceDate ?? campusToday(),
    p_meal_period_name: input.mealPeriodName ?? null,
    p_hall_id: input.hallId ?? null,
  });

  if (error) return { ok: false, error: error.message };
  if (removed === null) return { ok: false, error: 'Nothing to remove.' };

  revalidatePath('/log');
  return { ok: true, removed };
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

  revalidatePath('/log');
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

  revalidatePath('/log');
  return { ok: true };
}

/**
 * Puts a deleted entry back exactly as it was.
 *
 * Not logFood: that re-reads the recipe and takes a fresh snapshot, so undoing
 * a delete could silently change the day's totals if UNC revised the recipe in
 * between. An undo has to restore, not re-log. `restore_log` also adds onto the
 * slot if it was re-logged before the undo toast timed out, rather than
 * tripping the unique index from migration 0002.
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

  const { data: logId, error } = await supabase.rpc('restore_log', {
    p_recipe_id: entry.recipeId,
    p_service_date: entry.serviceDate,
    p_meal_period_name: entry.mealPeriodName,
    p_hall_id: entry.hallId,
    p_servings: entry.servings,
    p_calories_snapshot: entry.caloriesSnapshot,
    p_protein_snapshot: entry.proteinSnapshot,
    p_carbs_snapshot: entry.carbsSnapshot,
    p_fat_snapshot: entry.fatSnapshot,
  });

  if (error) return { ok: false, error: `Could not restore that: ${error.message}` };

  revalidatePath('/log');
  return { ok: true, logId: logId ?? undefined };
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
