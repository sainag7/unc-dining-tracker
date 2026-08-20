/**
 * Hand-maintained mirror of supabase/migrations.
 *
 * Once the Supabase project exists, this can be regenerated instead:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
 *
 * Everything here must stay a `type`, never an `interface`. postgrest-js
 * constrains table rows to Record<string, unknown>, and interfaces don't get
 * the implicit index signature that satisfies it — an interface row silently
 * collapses every query result to `never` instead of failing loudly.
 */

export type DiningHallRow = {
  id: number;
  slug: string;
  name: string;
  active: boolean;
  sort_order: number;
};

export type RecipeRow = {
  id: number;
  name: string;
  serving_size: string | null;
  ingredients: string | null;
  allergens: string[];
  properties: string[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  sat_fat_g: number | null;
  trans_fat_g: number | null;
  cholesterol_mg: number | null;
  sodium_mg: number | null;
  fiber_g: number | null;
  sugars_g: number | null;
  added_sugar_g: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  potassium_mg: number | null;
  vitamin_d_mcg: number | null;
  scraped_at: string;
};

export type MenuDayRow = {
  id: number;
  hall_id: number;
  service_date: string;
  scraped_at: string;
};

export type MealPeriodRow = {
  id: number;
  menu_day_id: number;
  name: string;
  time_label: string | null;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
};

export type MenuItemRow = {
  id: number;
  meal_period_id: number;
  recipe_id: number;
  station: string;
  station_order: number;
  sort_order: number;
  searchable: string | null;
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
  calorie_goal: number;
  protein_goal_g: number;
  carb_goal_g: number;
  fat_goal_g: number;
  dietary_prefs: string[];
  allergens_avoid: string[];
  created_at: string;
  updated_at: string;
};

export type FoodLogRow = {
  id: number;
  user_id: string;
  recipe_id: number;
  service_date: string;
  meal_period_name: string | null;
  hall_id: number | null;
  servings: number;
  calories_snapshot: number | null;
  protein_snapshot: number | null;
  carbs_snapshot: number | null;
  fat_snapshot: number | null;
  logged_at: string;
};

export type ScraperRunRow = {
  id: number;
  started_at: string;
  finished_at: string | null;
  days_scraped: number;
  recipes_added: number;
  ok: boolean;
  error: string | null;
}

/**
 * Identity columns and defaulted columns are optional on insert, so Insert and
 * Update are both Partial<Row> here. That's looser than what `gen types` would
 * emit, but it's honest about a hand-written mirror and never wrong.
 */
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

// Note the `{ [_ in never]: never }` shape for the empty members: postgrest-js
// constrains Views/Functions to Record<string, GenericView | GenericFunction>,
// and `Record<string, never>` fails that constraint, which silently collapses
// every query result to `never`.
export type Database = {
  public: {
    Tables: {
      dining_halls: Table<DiningHallRow>;
      recipes: Table<RecipeRow>;
      menu_days: Table<MenuDayRow>;
      meal_periods: Table<MealPeriodRow>;
      menu_items: Table<MenuItemRow>;
      profiles: Table<ProfileRow>;
      food_log: Table<FoodLogRow>;
      scraper_runs: Table<ScraperRunRow>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
