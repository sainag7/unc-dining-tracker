/**
 * Portions people actually take at a dining hall, rather than a free-text box.
 *
 * These are multipliers of the recipe's own serving size — "½ cup", "1 each" —
 * never absolute weights. UNC gives that size as display text and never as a
 * number, so 1.5 × "½ cup" is as far as the arithmetic can honestly go.
 */
export const SERVING_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4];

/** 1.5 → "1.5×" — trailing zeros just add noise in a 44px circle. */
export function formatServings(servings: number): string {
  const rounded = Math.round(servings * 100) / 100;
  return `${rounded}×`;
}
