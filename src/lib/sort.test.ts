import { describe, it, expect } from 'vitest';
import { applySort, nextSortMode, parseSortMode, sortLabel } from './sort';
import type { StationWithItems } from './menu';
import type { RecipeRow } from './supabase/database.types';

const item = (name: string, calories: number | null) =>
  ({ id: name.length, name, calories }) as RecipeRow;

const stations: StationWithItems[] = [
  { name: 'Simply Prepared', items: [item('Chicken', 100), item('Zucchini', 10)] },
  { name: 'The Griddle', items: [item('Waffle', 90), item('Unknown', null)] },
];

describe('nextSortMode', () => {
  it('cycles station to ascending to descending and back', () => {
    expect(nextSortMode('station')).toBe('cal-asc');
    expect(nextSortMode('cal-asc')).toBe('cal-desc');
    expect(nextSortMode('cal-desc')).toBe('station');
  });
});

describe('parseSortMode', () => {
  it('falls back to station order for anything unrecognised', () => {
    expect(parseSortMode(null)).toBe('station');
    expect(parseSortMode('')).toBe('station');
    expect(parseSortMode('calories')).toBe('station');
  });

  it('accepts the real modes', () => {
    expect(parseSortMode('cal-asc')).toBe('cal-asc');
    expect(parseSortMode('cal-desc')).toBe('cal-desc');
  });
});

describe('applySort', () => {
  it('leaves station order untouched', () => {
    expect(applySort(stations, 'station')).toBe(stations);
  });

  it('flattens to a single list when sorting by calories', () => {
    const result = applySort(stations, 'cal-asc');
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(4);
  });

  it('sorts ascending', () => {
    const names = applySort(stations, 'cal-asc')[0].items.map((i) => i.name);
    expect(names.slice(0, 3)).toEqual(['Zucchini', 'Waffle', 'Chicken']);
  });

  it('sorts descending', () => {
    const names = applySort(stations, 'cal-desc')[0].items.map((i) => i.name);
    expect(names.slice(0, 3)).toEqual(['Chicken', 'Waffle', 'Zucchini']);
  });

  // An unknown is not a low number. Treating null as 0 would put every item
  // UNC hasn't published data for at the top of "lightest first", which is
  // both wrong and the most misleading place to put it.
  it('sorts unknown calories last in both directions', () => {
    expect(applySort(stations, 'cal-asc')[0].items.at(-1)!.name).toBe('Unknown');
    expect(applySort(stations, 'cal-desc')[0].items.at(-1)!.name).toBe('Unknown');
  });

  it('returns nothing when there is nothing to sort', () => {
    expect(applySort([], 'cal-asc')).toEqual([]);
  });
});

describe('sortLabel', () => {
  it('shows direction only when sorting by calories', () => {
    expect(sortLabel('station')).toBe('Cal');
    expect(sortLabel('cal-asc')).toBe('Cal ↑');
    expect(sortLabel('cal-desc')).toBe('Cal ↓');
  });
});
