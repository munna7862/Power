/** Calendar maths for the in-game clock. Pure integer arithmetic — no Date objects. */
export interface GameDate {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
}

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export interface DayAdvance {
  date: GameDate;
  /** True when the new date is the first day of a month (the previous month has closed). */
  monthChanged: boolean;
  /** True when the new date is 1 January (the previous year has closed). */
  yearChanged: boolean;
}

export function advanceDay(date: GameDate): DayAdvance {
  if (date.day < daysInMonth(date.year, date.month)) {
    return { date: { ...date, day: date.day + 1 }, monthChanged: false, yearChanged: false };
  }
  if (date.month < 12) {
    return { date: { year: date.year, month: date.month + 1, day: 1 }, monthChanged: true, yearChanged: false };
  }
  return { date: { year: date.year + 1, month: 1, day: 1 }, monthChanged: true, yearChanged: true };
}

export function addDays(date: GameDate, days: number): GameDate {
  let next = date;
  for (let i = 0; i < days; i++) next = advanceDay(next).date;
  return next;
}

/** Negative if a < b, 0 if equal, positive if a > b. */
export function compareDates(a: GameDate, b: GameDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** "1 Jan 2026" */
export function formatDate(date: GameDate): string {
  return `${date.day} ${MONTH_NAMES[date.month - 1]} ${date.year}`;
}

/** "Jan 2026" */
export function formatMonth(date: GameDate): string {
  return `${MONTH_NAMES[date.month - 1]} ${date.year}`;
}

/** Returns the month before the given date's month, e.g. for labelling a just-closed month. */
export function previousMonth(date: GameDate): GameDate {
  return date.month === 1
    ? { year: date.year - 1, month: 12, day: 1 }
    : { year: date.year, month: date.month - 1, day: 1 };
}
