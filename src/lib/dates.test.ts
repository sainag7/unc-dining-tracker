import { describe, it, expect } from 'vitest';
import { campusToday, campusTimeOfDay, addDays, dateRange, currentMealPeriodIndex } from './dates';

describe('campus date resolution', () => {
  it('uses Chapel Hill time, not UTC', () => {
    // 2026-08-21T02:30Z is still 10:30pm on the 20th in Chapel Hill.
    const lateNight = new Date('2026-08-21T02:30:00Z');
    expect(campusToday(lateNight)).toBe('2026-08-20');
    expect(campusTimeOfDay(lateNight)).toBe('22:30');
  });

  it('rolls over at local midnight', () => {
    expect(campusToday(new Date('2026-08-21T03:59:00Z'))).toBe('2026-08-20');
    expect(campusToday(new Date('2026-08-21T04:01:00Z'))).toBe('2026-08-21');
  });
});

describe('addDays / dateRange', () => {
  it('advances dates without timezone drift', () => {
    expect(addDays('2026-08-20', 1)).toBe('2026-08-21');
    expect(addDays('2026-08-20', -1)).toBe('2026-08-19');
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // leap year
  });

  it('builds an inclusive forward range', () => {
    expect(dateRange('2026-08-20', 3)).toEqual(['2026-08-20', '2026-08-21', '2026-08-22']);
  });
});

describe('currentMealPeriodIndex', () => {
  const chase = [
    { startTime: '07:00', endTime: '10:45' }, // Breakfast
    { startTime: '11:00', endTime: '15:00' }, // Lunch
    { startTime: '15:00', endTime: '17:00' }, // Late Lunch
    { startTime: '17:00', endTime: '20:00' }, // Dinner
    { startTime: '20:00', endTime: '21:00' }, // Late Dinner
    { startTime: '21:00', endTime: '00:00' }, // Late Night (crosses midnight)
  ];

  it('picks the period being served', () => {
    expect(currentMealPeriodIndex(chase, '08:00')).toBe(0);
    expect(currentMealPeriodIndex(chase, '12:30')).toBe(1);
    expect(currentMealPeriodIndex(chase, '18:00')).toBe(3);
  });

  it('serves Late Night up to its midnight close', () => {
    expect(currentMealPeriodIndex(chase, '21:00')).toBe(5);
    expect(currentMealPeriodIndex(chase, '23:59')).toBe(5);
  });

  it('treats after-midnight as closed, pointing at tomorrow morning', () => {
    // Late Night ends at 00:00, so 00:30 is not "still late night".
    expect(currentMealPeriodIndex(chase, '00:30')).toBe(0);
  });

  it('keeps serving a period that genuinely runs past midnight', () => {
    const lateBar = [
      { startTime: '11:00', endTime: '15:00' },
      { startTime: '21:00', endTime: '02:00' },
    ];
    expect(currentMealPeriodIndex(lateBar, '23:30')).toBe(1);
    expect(currentMealPeriodIndex(lateBar, '01:30')).toBe(1);
    expect(currentMealPeriodIndex(lateBar, '03:00')).toBe(0);
  });

  it('uses period boundaries exclusively at the end', () => {
    expect(currentMealPeriodIndex(chase, '15:00')).toBe(2); // Late Lunch, not Lunch
    expect(currentMealPeriodIndex(chase, '17:00')).toBe(3);
  });

  it('jumps to the next service when between periods', () => {
    // 10:50 is after breakfast, before lunch.
    expect(currentMealPeriodIndex(chase, '10:50')).toBe(1);
  });

  it('falls back to the first period before the day starts', () => {
    expect(currentMealPeriodIndex(chase, '05:00')).toBe(0);
  });

  it('does not crash on an empty menu', () => {
    expect(currentMealPeriodIndex([], '12:00')).toBe(0);
  });
});
