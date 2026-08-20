/** Display names for the tag keys the scraper pulls off the menu page. */

export const ALLERGEN_LABELS: Record<string, string> = {
  egg: 'Egg',
  soy: 'Soy',
  wheat: 'Wheat',
  milk: 'Milk',
  fish: 'Fish',
  shellfish: 'Shellfish',
  sesame: 'Sesame',
  gluten: 'Gluten',
  peanut: 'Peanut',
  treenut: 'Tree nut',
};

export const PROPERTY_LABELS: Record<string, string> = {
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  halal: 'Halal',
  smart_choice: 'Smart Choice',
  local: 'Local',
  organic: 'Organic',
  sustainable_seafood: 'Sustainable seafood',
  made_without_gluten: 'Made without gluten',
  cool_foods: 'Coolfood',
};

/** The dietary filters worth surfacing — the ones people actually eat by. */
export const FILTERABLE_PROPERTIES = [
  'vegan',
  'vegetarian',
  'halal',
  'made_without_gluten',
] as const;

export const allergenLabel = (key: string) => ALLERGEN_LABELS[key] ?? key;
export const propertyLabel = (key: string) => PROPERTY_LABELS[key] ?? key;

/** Allergens on this item that the user has said to avoid. */
export function conflictingAllergens(
  itemAllergens: string[],
  avoid: string[],
): string[] {
  if (avoid.length === 0) return [];
  const avoidSet = new Set(avoid);
  return itemAllergens.filter((a) => avoidSet.has(a));
}
