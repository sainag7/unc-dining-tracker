import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMenuPage, parseClock, parseMealPeriodLabel, MenuParseError } from './parse-menu';

const chaseHtml = readFileSync(join(__dirname, '__fixtures__/chase-menu.html'), 'utf-8');
const parsed = parseMenuPage(chaseHtml, 'chase', '2026-08-20');

describe('parseClock', () => {
  it('converts 12h display times to 24h', () => {
    expect(parseClock('7am')).toBe('07:00');
    expect(parseClock('10:45am')).toBe('10:45');
    expect(parseClock('3pm')).toBe('15:00');
    expect(parseClock('8:30pm')).toBe('20:30');
  });

  it('handles the 12 o clock edge cases', () => {
    expect(parseClock('12am')).toBe('00:00');
    expect(parseClock('12pm')).toBe('12:00');
  });

  it('returns null rather than guessing at junk', () => {
    expect(parseClock('noon')).toBeNull();
    expect(parseClock('25pm')).toBeNull();
    expect(parseClock('')).toBeNull();
  });
});

describe('parseMealPeriodLabel', () => {
  it('splits name from time range', () => {
    expect(parseMealPeriodLabel('Late Lunch (3pm-5pm)')).toEqual({
      name: 'Late Lunch',
      timeLabel: '3pm-5pm',
      startTime: '15:00',
      endTime: '17:00',
    });
  });

  it('tolerates the double space the site emits', () => {
    expect(parseMealPeriodLabel('Late Night  (9pm-12am)')).toMatchObject({
      name: 'Late Night',
      startTime: '21:00',
      endTime: '00:00',
    });
  });

  it('keeps the name when there is no time at all', () => {
    expect(parseMealPeriodLabel('Brunch')).toEqual({
      name: 'Brunch',
      timeLabel: null,
      startTime: null,
      endTime: null,
    });
  });
});

describe('parseMenuPage', () => {
  it("finds Chase's six meal periods in service order", () => {
    expect(parsed.mealPeriods.map((p) => p.name)).toEqual([
      'Breakfast',
      'Lunch',
      'Late Lunch',
      'Dinner',
      'Late Dinner',
      'Late Night',
    ]);
  });

  it('captures per-period times', () => {
    const breakfast = parsed.mealPeriods[0];
    expect(breakfast.startTime).toBe('07:00');
    expect(breakfast.endTime).toBe('10:45');
  });

  it('groups items under their station', () => {
    const breakfast = parsed.mealPeriods[0];
    expect(breakfast.stations.length).toBeGreaterThan(5);
    expect(breakfast.stations[0].name).toBe('Waffle Bar');
    expect(breakfast.stations[0].items[0]).toMatchObject({
      recipeId: 8260,
      name: 'Waffle',
    });
  });

  it('reads allergens and dietary properties off the class list', () => {
    const waffle = parsed.mealPeriods[0].stations[0].items[0];
    expect(waffle.allergens.sort()).toEqual(['gluten', 'milk', 'wheat']);
    expect(waffle.properties.sort()).toEqual(['halal', 'vegetarian']);
  });

  it('keeps the ingredient text for searching', () => {
    const waffle = parsed.mealPeriods[0].stations[0].items[0];
    expect(waffle.searchable).toContain('buttermilk');
  });

  it('finds a realistic number of items per period', () => {
    for (const period of parsed.mealPeriods) {
      const count = period.stations.reduce((n, s) => n + s.items.length, 0);
      expect(count).toBeGreaterThan(50);
    }
  });

  it('refuses to return an empty menu when the page has no tabs', () => {
    expect(() => parseMenuPage('<html><body>Closed</body></html>', 'chase', '2026-08-20')).toThrow(
      MenuParseError,
    );
  });

  it('refuses to return an empty menu when tabs exist but hold no items', () => {
    const html = `
      <button role="tab" aria-controls="tabinfo-1">
        <div class="c-tabs-nav__link-inner">Breakfast (7am-10am)</div>
      </button>
      <div id="tabinfo-1"></div>`;
    expect(() => parseMenuPage(html, 'chase', '2026-08-20')).toThrow(/zero items/);
  });
});
