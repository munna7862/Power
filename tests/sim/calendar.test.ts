import { describe, expect, it } from 'vitest';
import {
  advanceDay,
  compareDates,
  daysInMonth,
  formatDate,
  formatMonth,
  isLeapYear,
  previousMonth,
} from '../../src/sim';

describe('calendar', () => {
  it.each([
    [2024, true],
    [2026, false],
    [1900, false],
    [2000, true],
  ])('isLeapYear(%i) is %s', (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });

  it('knows the length of every month', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => daysInMonth(2026, m))).toEqual([
      31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ]);
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it('advances within a month without closing it', () => {
    expect(advanceDay({ year: 2026, month: 3, day: 14 })).toEqual({
      date: { year: 2026, month: 3, day: 15 },
      monthChanged: false,
      yearChanged: false,
    });
  });

  it('closes a month on its last day, including leap February', () => {
    expect(advanceDay({ year: 2028, month: 2, day: 28 }).date).toEqual({ year: 2028, month: 2, day: 29 });
    expect(advanceDay({ year: 2028, month: 2, day: 29 })).toEqual({
      date: { year: 2028, month: 3, day: 1 },
      monthChanged: true,
      yearChanged: false,
    });
  });

  it('closes the year on 31 December', () => {
    expect(advanceDay({ year: 2026, month: 12, day: 31 })).toEqual({
      date: { year: 2027, month: 1, day: 1 },
      monthChanged: true,
      yearChanged: true,
    });
  });

  it('compares and formats dates', () => {
    expect(compareDates({ year: 2026, month: 1, day: 2 }, { year: 2026, month: 1, day: 1 })).toBeGreaterThan(0);
    expect(compareDates({ year: 2026, month: 1, day: 1 }, { year: 2026, month: 1, day: 1 })).toBe(0);
    expect(compareDates({ year: 2025, month: 12, day: 31 }, { year: 2026, month: 1, day: 1 })).toBeLessThan(0);
    expect(formatDate({ year: 2026, month: 1, day: 1 })).toBe('1 Jan 2026');
    expect(formatMonth({ year: 2027, month: 11, day: 5 })).toBe('Nov 2027');
  });

  it('finds the previous month across a year boundary', () => {
    expect(previousMonth({ year: 2027, month: 1, day: 1 })).toEqual({ year: 2026, month: 12, day: 1 });
    expect(previousMonth({ year: 2027, month: 6, day: 1 })).toEqual({ year: 2027, month: 5, day: 1 });
  });
});
