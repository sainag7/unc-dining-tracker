import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRecipe, RecipeParseError } from './parse-recipe';

function fixture(recipeId: number): string {
  const raw = readFileSync(join(__dirname, `__fixtures__/recipe-${recipeId}.json`), 'utf-8');
  return (JSON.parse(raw) as { html: string }).html;
}

describe('parseRecipe', () => {
  const waffle = parseRecipe(fixture(8260), 8260);

  it('reads the headline macros', () => {
    expect(waffle.name).toBe('Waffle');
    expect(waffle.calories).toBe(90);
    expect(waffle.proteinG).toBe(3);
    expect(waffle.carbsG).toBe(20);
    expect(waffle.fatG).toBe(0.5);
  });

  it('distinguishes nested rows from their parent rows', () => {
    // "Saturated Fat" must not be swallowed by "Total Fat", nor "Added Sugar" by "Sugars".
    expect(waffle.satFatG).toBe(0);
    expect(waffle.transFatG).toBe(0);
    expect(waffle.fiberG).toBe(0.63);
    expect(waffle.sugarsG).toBe(0);
    expect(waffle.addedSugarG).toBe(3);
  });

  it('reads micronutrients', () => {
    expect(waffle.sodiumMg).toBe(270);
    expect(waffle.cholesterolMg).toBe(0);
    expect(waffle.calciumMg).toBe(31);
    expect(waffle.ironMg).toBe(1);
    expect(waffle.potassiumMg).toBe(31);
    expect(waffle.vitaminDMcg).toBe(0);
  });

  it('keeps the serving size as a display string', () => {
    expect(waffle.servingSize).toBe('1 each');
  });

  it('splits allergens into normalized keys', () => {
    expect(waffle.allergens).toEqual(['wheat', 'milk', 'gluten']);
  });

  it('captures ingredients without the label', () => {
    expect(waffle.ingredients).toMatch(/^MIX PANCAKE BUTTERMILK/);
    expect(waffle.ingredients).not.toMatch(/Ingredients:/);
  });

  it('decodes HTML entities in serving sizes', () => {
    // Mixed Berries is served as "&frac12; cup" in the raw markup.
    const berries = parseRecipe(fixture(14533), 14533);
    expect(berries.servingSize).toBe('½ cup');
    expect(berries.servingSize).not.toContain('frac12');
  });

  it('returns an empty allergen list rather than null for allergen-free items', () => {
    const berries = parseRecipe(fixture(14533), 14533);
    expect(berries.allergens).toEqual([]);
  });

  it('throws when the endpoint stops returning a recipe', () => {
    expect(() => parseRecipe('<div>Not found</div>', 999999)).toThrow(RecipeParseError);
  });
});
