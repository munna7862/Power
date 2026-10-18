import { daysInMonth } from '../engine/calendar';
import { projectMonth } from '../economy/model';
import type { ExpenditureLine, GameState, RevenueLine } from '../state/types';

export interface DailyFinance {
  /** Days in the current month: the month's figures are spread over them. */
  days: number;
  revenue: Record<RevenueLine, number>;
  expenditure: Record<ExpenditureLine, number>;
  totalRevenue: number;
  totalExpenditure: number;
  /** The treasury's change per day before borrowing, ₹ crore. */
  balance: number;
}

const perDay = <K extends string>(lines: Record<K, number>, days: number): Record<K, number> =>
  Object.fromEntries(Object.entries<number>(lines).map(([k, v]) => [k, v / days])) as Record<K, number>;

/**
 * Money per day (Sprint 8.8): this month's `projectMonth()` divided by the days in the month, so the top bar and
 * General Expenses always agree with the monthly settlement.
 */
export function dailyFinance(state: GameState): DailyFinance {
  const month = projectMonth(state, state.budget);
  const days = daysInMonth(state.clock.date.year, state.clock.date.month);
  return {
    days,
    revenue: perDay(month.revenue, days),
    expenditure: perDay(month.expenditure, days),
    totalRevenue: month.totalRevenue / days,
    totalExpenditure: month.totalExpenditure / days,
    balance: month.balance / days,
  };
}
