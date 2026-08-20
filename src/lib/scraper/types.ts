/** Canonical allergen keys, as they appear in `allergen-has_*` classes on the menu page. */
export const ALLERGENS = [
  'egg',
  'soy',
  'wheat',
  'milk',
  'fish',
  'shellfish',
  'sesame',
  'gluten',
  'peanut',
  'treenut',
] as const;

/** Canonical dietary property keys, as they appear in `prop-*` classes on the menu page. */
export const PROPERTIES = [
  'vegan',
  'vegetarian',
  'halal',
  'smart_choice',
  'local',
  'organic',
  'sustainable_seafood',
  'made_without_gluten',
  'cool_foods',
] as const;

export type Allergen = (typeof ALLERGENS)[number];
export type Property = (typeof PROPERTIES)[number];

/** A single dish within a station, as listed on a menu page. */
export interface ScrapedItem {
  recipeId: number;
  name: string;
  /** Allergen keys parsed off the anchor's class list. May be empty. */
  allergens: string[];
  /** Dietary property keys parsed off the anchor's class list. May be empty. */
  properties: string[];
  /** Free-text ingredient blob from `data-searchable`, used for text search. */
  searchable: string;
}

export interface ScrapedStation {
  name: string;
  description: string | null;
  items: ScrapedItem[];
}

/**
 * One meal period (Breakfast, Late Night, ...). Times are the raw display strings
 * split out of the tab label — `startTime`/`endTime` are normalized to 24h "HH:MM"
 * where parsing succeeds, and null where the label didn't follow the usual shape.
 */
export interface ScrapedMealPeriod {
  name: string;
  /** The original parenthetical, e.g. "7am-10:45am". Kept for display and debugging. */
  timeLabel: string | null;
  startTime: string | null;
  endTime: string | null;
  sortOrder: number;
  stations: ScrapedStation[];
}

export interface ScrapedMenuDay {
  hallSlug: string;
  serviceDate: string;
  mealPeriods: ScrapedMealPeriod[];
}

/** Full nutrition record for one recipe, from the recipe.php endpoint. */
export interface ScrapedRecipe {
  recipeId: number;
  name: string;
  /**
   * Display string exactly as UNC gives it: "1 each", "2 Tbsp", "½ cup", "4 oz".
   * Deliberately NOT parsed into a number — portions are tracked as a multiplier
   * of this serving, not as an absolute weight.
   */
  servingSize: string | null;
  ingredients: string | null;
  allergens: string[];
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  satFatG: number | null;
  transFatG: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
  fiberG: number | null;
  sugarsG: number | null;
  addedSugarG: number | null;
  calciumMg: number | null;
  ironMg: number | null;
  potassiumMg: number | null;
  vitaminDMcg: number | null;
}
