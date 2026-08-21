'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { campusToday } from '@/lib/dates';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface LogResult extends ActionResult {
  /** Id of the row just written, so the caller can offer an undo. */
  logId?: number;
}

const NOT_SIGNED_IN = 'Sign in to keep track of what you eat.';

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

  const { data: inserted, error } = await supabase
    .from('food_log')
    .insert({
      user_id: user.id,
      recipe_id: recipe.id,
      service_date: input.serviceDate ?? campusToday(),
      meal_period_name: input.mealPeriodName ?? null,
      hall_id: input.hallId ?? null,
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
