/**
 * Dietary properties, spelled out on a line of their own.
 *
 * These were bordered VG / GF / H boxes sitting beside the item name. Nearly
 * every item on a UNC menu carries at least one, so a boxed glyph on every row
 * became the loudest thing on the screen while telling you almost nothing —
 * the signal is in the rare item that *lacks* a tag, not the common one that
 * has three. As words on a quiet second line they read at a glance and stop
 * competing with the name.
 *
 * Spelled out, too, because the glyphs were ambiguous: V and VG differ by one
 * character and mean quite different things to someone avoiding animal
 * products.
 */

/** Fixed order: what you eat, then how it's prepared, then what's absent. */
const ORDER = ['vegan', 'vegetarian', 'halal', 'made_without_gluten'] as const;

const LABEL: Record<(typeof ORDER)[number], string> = {
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  halal: 'Halal',
  made_without_gluten: 'No gluten',
};

export function DietTags({ properties }: { properties: string[] }) {
  const has = new Set(properties);

  // Vegan already implies vegetarian, and the scraper tags both. "Vegan ·
  // Vegetarian" on one row is the kind of redundancy that teaches people to
  // stop reading the line at all.
  if (has.has('vegan')) has.delete('vegetarian');

  const shown = ORDER.filter((p) => has.has(p));

  // No line at all rather than an empty one — the row shouldn't reserve space
  // for something two thirds of items don't have.
  if (shown.length === 0) return null;

  return (
    <span className="mt-0.5 block truncate text-micro text-text-faint">
      {shown.map((p) => LABEL[p]).join(' · ')}
    </span>
  );
}
