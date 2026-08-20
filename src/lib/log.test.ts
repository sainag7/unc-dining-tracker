import { describe, it, expect } from 'vitest';
import { totalsFor, currentStreak } from './log';

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
