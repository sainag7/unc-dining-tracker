import { propertyLabel } from '@/lib/labels';

/**
 * Dietary properties, compressed to glyphs.
 *
 * These used to read "Vegan · Vegetarian · Made without gluten" in full, in a
 * grey that measured 2.67:1 — simultaneously too loud to ignore and too faint
 * to read. Two letters in a muted neutral is quiet enough to skip and legible
 * enough to check.
 *
 * The full word still goes to screen readers via the title/aria-label, so
 * nothing is actually lost.
 */
const GLYPH: Record<string, string> = {
  vegan: 'VG',
  vegetarian: 'V',
  halal: 'H',
  made_without_gluten: 'GF',
};

/** Fixed order, so the badges don't reshuffle between rows. */
const ORDER = ['vegan', 'vegetarian', 'made_without_gluten', 'halal'];

export function DietBadges({ properties }: { properties: string[] }) {
  const has = new Set(properties);

  // Vegan already implies vegetarian, and the scraper tags both. Showing
  // "VG V" on the same row is the kind of redundancy that makes a reader
  // stop reading the badges at all.
  if (has.has('vegan')) has.delete('vegetarian');

  const shown = ORDER.filter((p) => has.has(p));
  if (shown.length === 0) return null;

  return (
    <span className="flex shrink-0 items-center gap-1">
      {shown.map((p) => (
        <span
          key={p}
          title={propertyLabel(p)}
          aria-label={propertyLabel(p)}
          role="img"
          className="placard rounded-sm border border-border px-1 py-px text-text-muted"
        >
          {GLYPH[p]}
        </span>
      ))}
    </span>
  );
}
