import { describe, it, expect } from 'vitest';
import {
  totalsFor,
  currentStreak,
  rankUsuals,
  servingsAfterRemoval,
  groupByMealPeriod,
} from './log';

const entry = (
  servings: number,
  calories: number,
  protein = 0,
  carbs = 0,
  fat = 0,
) => ({
  servings,
  calories_snapshot: calories,
  protein_snapshot: protein,
  carbs_snapshot: carbs,
  fat_snapshot: fat,
});

describe('totalsFor', () => {
  it('sums a plain day', () => {
    expect(totalsFor([entry(1, 90, 3, 20, 0.5), entry(1, 70, 0, 19, 0)])).toEqual({
      calories: 160,
      protein: 3,
      carbs: 39,
      fat: 1, // 0.5 rounds to 1
    });
  });

  it('scales by servings, including fractional ones', () => {
    expect(totalsFor([entry(2, 90, 3, 20, 0.5)]).calories).toBe(180);
    expect(totalsFor([entry(0.5, 90, 3, 20, 0.5)]).calories).toBe(45);
    expect(totalsFor([entry(1.5, 100)]).calories).toBe(150);
  });

  it('rounds once at the end rather than per entry', () => {
    // Three 0.4-cal rows are 1.2 total; per-entry rounding would give 0.
    expect(totalsFor([entry(1, 0.4), entry(1, 0.4), entry(1, 0.4)]).calories).toBe(1);
  });

  it('treats missing nutrition as zero rather than NaN', () => {
    const missing = { ...entry(2, 0), calories_snapshot: null };
    expect(totalsFor([missing]).calories).toBe(0);
  });

  it('returns zeros for an empty day', () => {
    expect(totalsFor([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('currentStreak', () => {
  it('counts consecutive days ending today', () => {
    const dates = new Set(['2026-08-18', '2026-08-19', '2026-08-20']);
    expect(currentStreak(dates, '2026-08-20')).toBe(3);
  });

  it('still counts when today has no entry yet', () => {
    // The day isn't over, so a streak through yesterday is intact.
    const dates = new Set(['2026-08-18', '2026-08-19']);
    expect(currentStreak(dates, '2026-08-20')).toBe(2);
  });

  it('breaks on a gap', () => {
    const dates = new Set(['2026-08-15', '2026-08-19', '2026-08-20']);
    expect(currentStreak(dates, '2026-08-20')).toBe(2);
  });

  it('is zero when nothing recent is logged', () => {
    expect(currentStreak(new Set(['2026-08-01']), '2026-08-20')).toBe(0);
    expect(currentStreak(new Set(), '2026-08-20')).toBe(0);
  });

  it('walks across a month boundary', () => {
    const dates = new Set(['2026-07-30', '2026-07-31', '2026-08-01']);
    expect(currentStreak(dates, '2026-08-01')).toBe(3);
  });
});

describe('rankUsuals', () => {
  const onMenu = new Set([1, 2, 3]);
  const row = (recipe_id: number, logged_at: string) => ({ recipe_id, logged_at });

  it('orders by how often something was logged', () => {
    const rows = [
      row(1, '2026-08-01T12:00:00Z'),
      row(2, '2026-08-01T12:00:00Z'),
      row(2, '2026-08-02T12:00:00Z'),
      row(2, '2026-08-03T12:00:00Z'),
      row(3, '2026-08-01T12:00:00Z'),
      row(3, '2026-08-02T12:00:00Z'),
    ];
    expect(rankUsuals(rows, onMenu)).toEqual([2, 3, 1]);
  });

  it('drops picks that are not on the menu right now', () => {
    const rows = [row(99, '2026-08-01T12:00:00Z'), row(1, '2026-08-01T12:00:00Z')];
    expect(rankUsuals(rows, onMenu)).toEqual([1]);
  });

  it('breaks ties toward the more recent pick', () => {
    const rows = [row(1, '2026-08-01T12:00:00Z'), row(2, '2026-08-09T12:00:00Z')];
    expect(rankUsuals(rows, onMenu)).toEqual([2, 1]);
  });

  it('respects the limit', () => {
    const rows = [row(1, '2026-08-01T12:00:00Z'), row(2, '2026-08-01T12:00:00Z')];
    expect(rankUsuals(rows, onMenu, 1)).toHaveLength(1);
  });

  it('returns nothing when there is no history', () => {
    expect(rankUsuals([], onMenu)).toEqual([]);
  });
});

describe('servingsAfterRemoval', () => {
  it('takes one off a whole-number entry', () => {
    expect(servingsAfterRemoval(3)).toBe(2);
  });

  it('takes one off a part serving without going negative', () => {
    expect(servingsAfterRemoval(2.5)).toBe(1.5);
    expect(servingsAfterRemoval(1.5)).toBe(0.5);
  });

  // A 1x row can't be updated to 0 — the DB check constraint rejects it — so
  // the caller has to delete instead.
  it('signals deletion at exactly one serving', () => {
    expect(servingsAfterRemoval(1)).toBeNull();
  });

  it('signals deletion for anything under one serving', () => {
    expect(servingsAfterRemoval(0.5)).toBeNull();
    expect(servingsAfterRemoval(0.25)).toBeNull();
  });
});

describe('groupByMealPeriod', () => {
  const at = (period: string | null, id: number) => ({ meal_period_name: period, id });

  it('orders meals by when they happen, not when they were logged', () => {
    const groups = groupByMealPeriod([at('Dinner', 1), at('Breakfast', 2), at('Lunch', 3)]);
    expect(groups.map((g) => g.period)).toEqual(['Breakfast', 'Lunch', 'Dinner']);
  });

  it('keeps every entry of a meal together, in the order given', () => {
    const groups = groupByMealPeriod([at('Lunch', 1), at('Dinner', 2), at('Lunch', 3)]);
    expect(groups[0].entries.map((e) => e.id)).toEqual([1, 3]);
    expect(groups[1].entries.map((e) => e.id)).toEqual([2]);
  });

  // Nothing on the menu screen writes a null period, but rows predating the
  // meal-period column exist and shouldn't be dropped or sorted into a meal.
  it('sorts entries with no meal period last, under Other', () => {
    const groups = groupByMealPeriod([at(null, 1), at('Breakfast', 2)]);
    expect(groups.map((g) => g.period)).toEqual(['Breakfast', 'Other']);
  });

  it('puts periods it does not know about after the ones it does', () => {
    const groups = groupByMealPeriod([at('Midnight Breakfast', 1), at('Dinner', 2)]);
    expect(groups.map((g) => g.period)).toEqual(['Dinner', 'Midnight Breakfast']);
  });

  it('returns nothing for an empty day', () => {
    expect(groupByMealPeriod([])).toEqual([]);
  });
});

describe('groupByMealPeriod, against UNC’s real period names', () => {
  const at = (period: string) => ({ meal_period_name: period });

  // Chase publishes six services a day. "Late Lunch" and "Late Dinner" sit
  // mid-sequence, not at the end, so they have to be named explicitly rather
  // than left to the unknown-period fallback.
  it('orders all six services correctly', () => {
    const shuffled = ['Late Night', 'Lunch', 'Late Dinner', 'Breakfast', 'Dinner', 'Late Lunch'];
    expect(groupByMealPeriod(shuffled.map(at)).map((g) => g.period)).toEqual([
      'Breakfast',
      'Lunch',
      'Late Lunch',
      'Dinner',
      'Late Dinner',
      'Late Night',
    ]);
  });
});
