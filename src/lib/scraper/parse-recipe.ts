import * as cheerio from 'cheerio';
import type { ScrapedRecipe } from './types';

export class RecipeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeParseError';
  }
}

/** The nullable-number fields of ScrapedRecipe — the ones a nutrition row can fill. */
type NutrientField = {
  [K in keyof ScrapedRecipe]: null extends ScrapedRecipe[K]
    ? ScrapedRecipe[K] extends number | null
      ? K
      : never
    : never;
}[keyof ScrapedRecipe];

/**
 * Nutrition row labels, mapped to the field they populate.
 *
 * Order matters: rows are matched by longest label first, so "Total Carbohydrate"
 * is never shadowed by a shorter prefix and "Added Sugar" is never eaten by "Sugars".
 */
const NUTRIENT_ROWS: Array<[string, NutrientField]> = [
  ['Calories', 'calories'],
  ['Total Fat', 'fatG'],
  ['Saturated Fat', 'satFatG'],
  ['Trans Fat', 'transFatG'],
  ['Cholesterol', 'cholesterolMg'],
  ['Sodium', 'sodiumMg'],
  ['Total Carbohydrate', 'carbsG'],
  ['Dietary Fiber', 'fiberG'],
  ['Added Sugar', 'addedSugarG'],
  ['Sugars', 'sugarsG'],
  ['Protein', 'proteinG'],
  ['Calcium', 'calciumMg'],
  ['Iron', 'ironMg'],
  ['Potassium', 'potassiumMg'],
  ['Vitamin D', 'vitaminDMcg'],
].sort((a, b) => b[0].length - a[0].length) as Array<[string, NutrientField]>;

/**
 * Parses the HTML fragment returned by recipe.php into a nutrition record.
 *
 * Cheerio decodes HTML entities for us, which is what keeps serving sizes like
 * "&frac12; cup" from leaking raw entities into the database.
 */
export function parseRecipe(html: string, recipeId: number): ScrapedRecipe {
  const $ = cheerio.load(html);

  const name = $('h2').first().text().trim();
  if (!name) {
    throw new RecipeParseError(`Recipe ${recipeId}: no name found — endpoint may have changed`);
  }

  const recipe: ScrapedRecipe = {
    recipeId,
    name,
    servingSize: null,
    ingredients: null,
    allergens: [],
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    satFatG: null,
    transFatG: null,
    cholesterolMg: null,
    sodiumMg: null,
    fiberG: null,
    sugarsG: null,
    addedSugarG: null,
    calciumMg: null,
    ironMg: null,
    potassiumMg: null,
    vitaminDMcg: null,
  };

  // Allergens live in a <p> under an "Allergens" heading, comma separated.
  $('#nutrition-info-header h6').each((_, el) => {
    if ($(el).text().trim().toLowerCase() !== 'allergens') return;
    const raw = $(el).next('p').text().trim();
    if (raw) {
      recipe.allergens = raw
        .split(',')
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean);
    }
  });

  $('table.nutrition-facts-table tr').each((_, row) => {
    const text = $(row).text().replace(/\s+/g, ' ').trim();
    if (!text) return;

    if (recipe.servingSize === null) {
      const serving = text.match(/^Amount Per Serving\s+(.+)$/i);
      if (serving) {
        recipe.servingSize = serving[1].trim();
        return;
      }
    }

    for (const [label, field] of NUTRIENT_ROWS) {
      if (!text.startsWith(label)) continue;
      // Already filled means we hit a duplicate row; first occurrence wins.
      if (recipe[field] !== null) break;

      const value = text
        .slice(label.length)
        .match(/^\s*(?:less than\s*)?([\d.]+)\s*(?:g|mg|mcg)?/i);

      if (value) {
        const parsed = Number(value[1]);
        if (Number.isFinite(parsed)) {
          recipe[field] = parsed;
        }
      }
      break;
    }
  });

  const ingredientsEl = $('p:contains("Ingredients:")').first();
  if (ingredientsEl.length > 0) {
    const raw = ingredientsEl.text().replace(/\s+/g, ' ').trim();
    recipe.ingredients = raw.replace(/^Ingredients:\s*/i, '') || null;
  }

  return recipe;
}
