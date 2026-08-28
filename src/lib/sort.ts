import type { StationWithItems } from './menu';

/**
 * How the menu is ordered.
 *
 * 'station' is UNC's own sequence, reordered so mains lead — see stations.ts.
 * The two calorie modes flatten that entirely: once you're sorting by a number,
 * station boundaries stop meaning anything, and keeping them would produce
 * twenty-two separately-sorted lists rather than one answer to "what's light
 * here".
 */
export type SortMode = 'station' | 'cal-asc' | 'cal-desc';

export const SORT_MODES: SortMode[] = ['station', 'cal-asc', 'cal-desc'];

/** Cycles station → ascending → descending → station. */
export function nextSortMode(mode: SortMode): SortMode {
  const i = SORT_MODES.indexOf(mode);
  return SORT_MODES[(i + 1) % SORT_MODES.length];
}

export function parseSortMode(raw: string | null): SortMode {
  return SORT_MODES.includes(raw as SortMode) ? (raw as SortMode) : 'station';
}

/**
 * Applies a sort, returning stations to render.
 *
 * Calorie modes collapse everything into one pseudo-station so the list reads
 * as a single ranking. Items with no calorie data sort last in both directions
 * rather than counting as zero — an unknown is not a low number, and putting
 * them at the top of the ascending list would bury the actual lightest things.
 *
 * Pure, so the ordering can be tested without a database or a render.
 */
export function applySort(
  stations: StationWithItems[],
  mode: SortMode,
  flatLabel = 'By calories',
): StationWithItems[] {
  if (mode === 'station') return stations;

  const items = stations.flatMap((s) => s.items);
  const direction = mode === 'cal-asc' ? 1 : -1;

  const sorted = [...items].sort((a, b) => {
    const left = a.calories;
    const right = b.calories;
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return (left - right) * direction;
  });

  return sorted.length > 0 ? [{ name: flatLabel, items: sorted }] : [];
}

/** What the sort button reads as, for its label and its accessible name. */
export function sortLabel(mode: SortMode): string {
  if (mode === 'cal-asc') return 'Cal ↑';
  if (mode === 'cal-desc') return 'Cal ↓';
  return 'Cal';
}
