import { describe, it, expect } from 'vitest';
import {
  campusToday,
  campusTimeOfDay,
  addDays,
  dateRange,
  currentMealPeriodIndex,
  servingMealPeriodIndex,
  formatClock,
  toHHMM,
} from './dates';

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

describe('servingMealPeriodIndex', () => {
  const chase = [
    { startTime: '07:00', endTime: '10:45' },
    { startTime: '11:00', endTime: '15:00' },
    { startTime: '21:00', endTime: '00:00' },
  ];

  it('reports the period actually being served', () => {
    expect(servingMealPeriodIndex(chase, '08:00')).toBe(0);
    expect(servingMealPeriodIndex(chase, '23:00')).toBe(2);
  });

  it('reports nothing between services, so no false "serving now" badge', () => {
    expect(servingMealPeriodIndex(chase, '05:00')).toBe(-1);
    expect(servingMealPeriodIndex(chase, '10:50')).toBe(-1);
    expect(servingMealPeriodIndex(chase, '17:00')).toBe(-1);
  });
});

describe('formatClock', () => {
  it('formats afternoon times', () => {
    expect(formatClock('17:00')).toBe('5:00pm');
    expect(formatClock('14:30')).toBe('2:30pm');
  });

  it('formats morning times', () => {
    expect(formatClock('07:00')).toBe('7:00am');
    expect(formatClock('10:45')).toBe('10:45am');
  });

  // 12 is the case every naive modulo gets wrong in one direction or the other.
  it('handles noon and midnight', () => {
    expect(formatClock('12:00')).toBe('12:00pm');
    expect(formatClock('00:00')).toBe('12:00am');
  });

  it('returns null rather than a broken time', () => {
    expect(formatClock(null)).toBeNull();
    expect(formatClock('5pm')).toBeNull();
    expect(formatClock('25:00')).toBeNull();
  });
});

describe('toHHMM', () => {
  // Postgres `time` columns come back with seconds. Everything that compares
  // against campusTimeOfDay() needs them without.
  it('drops the seconds Postgres adds', () => {
    expect(toHHMM('15:00:00')).toBe('15:00');
    expect(toHHMM('07:30:00')).toBe('07:30');
  });

  it('leaves an already-normalised time alone', () => {
    expect(toHHMM('15:00')).toBe('15:00');
  });

  it('returns null rather than a half-parsed time', () => {
    expect(toHHMM(null)).toBeNull();
    expect(toHHMM('3pm')).toBeNull();
    expect(toHHMM('')).toBeNull();
  });
});

describe('servingMealPeriodIndex, against database-shaped times', () => {
  // The regression this guards: fixtures were 'HH:MM' but the database returns
  // 'HH:MM:SS', and "15:00" >= "15:00:00" is false as a string comparison, so a
  // period did not count as started until a minute after it started.
  const raw = [
    { startTime: '15:00:00', endTime: '17:00:00' },
    { startTime: '17:00:00', endTime: '20:00:00' },
  ].map((p) => ({ startTime: toHHMM(p.startTime), endTime: toHHMM(p.endTime) }));

  it('counts a period as serving from its first minute', () => {
    expect(servingMealPeriodIndex(raw, '15:00')).toBe(0);
  });

  it('ends a period on its closing minute, not after', () => {
    expect(servingMealPeriodIndex(raw, '17:00')).toBe(1);
  });
});
