import { describe, it, expect } from 'vitest';
import { stationsToCollapse } from './stations';
import type { StationWithItems } from './menu';
import type { RecipeRow } from './supabase/database.types';

/** A station of `count` throwaway items — only the length matters here. */
function station(name: string, count: number): StationWithItems {
  return {
    name,
    items: Array.from({ length: count }, (_, i) => ({ id: i, name: `item ${i}` }) as RecipeRow),
  };
}

// Chase dinner on 2026-08-21, copied verbatim from the database — 22 stations
// and 272 items, in the order the menu presents them.
const chaseDinner = [
  station('Waffle Bar', 4),
  station('Ice Cream', 14),
  station('Bakery', 13),
  station('Simply Prepared', 6),
  station('Simply Prepared Griddle', 8),
  station('The Kitchen Table', 4),
  station('The Griddle', 9),
  station('Vegan Plant Forward', 5),
  station('International Flavors', 2),
  station('Pizza', 5),
  station('Sushi/Create', 10),
  station('Pasta', 4),
  station('Soups', 2),
  station('Build Your Own!', 11),
  station('Made-to-Order', 10),
  station('Deli', 36),
  station('Salad Bar', 45),
  station('Stress Less Cabinet', 16),
  station('Bagels and Breads', 12),
  station('Cereal', 9),
  station('Condiments and Spreads', 15),
  station('Beverages', 32),
];

describe('stationsToCollapse', () => {
  const collapsed = stationsToCollapse(chaseDinner);

  it('collapses the self-serve component bars', () => {
    for (const name of [
      'Salad Bar',
      'Deli',
      'Beverages',
      'Condiments and Spreads',
      'Cereal',
      'Bagels and Breads',
      'Stress Less Cabinet',
    ]) {
      expect(collapsed.has(name), `${name} should collapse`).toBe(true);
    }
  });

  it('leaves the stations that serve actual dishes open', () => {
    for (const name of [
      'Pizza',
      'Made-to-Order',
      'Sushi/Create',
      'The Griddle',
      'Waffle Bar',
      'Ice Cream',
      'Bakery',
    ]) {
      expect(collapsed.has(name), `${name} should stay open`).toBe(false);
    }
  });

  it('cuts a real menu roughly in half', () => {
    const total = chaseDinner.reduce((n, s) => n + s.items.length, 0);
    const visible = chaseDinner
      .filter((s) => !collapsed.has(s.name))
      .reduce((n, s) => n + s.items.length, 0);

    expect(total).toBe(272);
    expect(visible).toBe(107);
  });

  it('catches an unfamiliar station by its size', () => {
    // Not in the name list, but 30 items is not a set of dishes.
    const result = stationsToCollapse([station('Yogurt Parfait Station', 30), station('Pizza', 5)]);
    expect(result.has('Yogurt Parfait Station')).toBe(true);
    expect(result.has('Pizza')).toBe(false);
  });

  it('matches station names case-insensitively', () => {
    const result = stationsToCollapse([station('BEVERAGES', 5), station('Pizza', 5)]);
    expect(result.has('BEVERAGES')).toBe(true);
  });

  it('never collapses every station', () => {
    // A menu made entirely of component bars would otherwise open fully closed.
    const allBars = [
      station('Salad Bar', 40),
      station('Deli', 30),
      station('Beverages', 25),
      station('Cereal', 8),
      station('Condiments', 5),
    ];
    const result = stationsToCollapse(allBars);

    expect(result.size).toBeLessThan(allBars.length);
    // The smallest ones are the ones reopened.
    expect(result.has('Condiments')).toBe(false);
    expect(result.has('Cereal')).toBe(false);
    expect(result.has('Salad Bar')).toBe(true);
  });

  it('handles an empty menu', () => {
    expect(stationsToCollapse([]).size).toBe(0);
  });
});
