import { CASH_RESERVE_MONTHS } from '../economy/constants';
import { projectMonth } from '../economy/model';
import { groupIndian } from '../engine/numberFormat';
import { appendLog } from '../state/log';
import type { GameState } from '../state/types';

/** Smallest early repayment of public debt, ₹ crore. */
export const MIN_DEBT_REPAYMENT = 1_000;

/**
 * The cash the treasury keeps: half a month of this month's spending. Below it the fiscal settlement borrows; above
 * twice it, the settlement repays public debt by itself.
 */
export const cashReserve = (state: GameState): number =>
  projectMonth(state, state.budget).totalExpenditure * CASH_RESERVE_MONTHS;

/** The most public debt the President can repay now: cash above the reserve, and no more than is owed. */
export const maxDebtRepayment = (state: GameState): number =>
  Math.max(0, Math.min(state.economy.debt, Math.floor(state.nation.treasury - cashReserve(state))));

export function validateRepayDebt(state: GameState, amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Choose an amount above zero.';
  if (state.economy.debt <= 0) return 'India has no public debt to repay.';
  if (amount < MIN_DEBT_REPAYMENT && amount < state.economy.debt)
    return `Repay at least ₹${groupIndian(MIN_DEBT_REPAYMENT)} crore at a time.`;
  const most = maxDebtRepayment(state);
  if (amount > most + 1e-9)
    return most <= 0
      ? 'The treasury has no cash above its reserve of half a month of spending.'
      : `At most ₹${groupIndian(most)} crore can go to the debt; the rest is the treasury's reserve.`;
  return null;
}

/**
 * Repays public debt early from the treasury. Interest falls at once, by the debt's average rate on the amount;
 * the rate itself still drifts with the debt load at the next settlement.
 */
export function repayDebt(state: GameState, amount: number): GameState {
  const repaid = Math.min(amount, state.economy.debt);
  const saved = (repaid * state.economy.interestRate) / 12;
  return appendLog(
    {
      ...state,
      nation: { ...state.nation, treasury: state.nation.treasury - repaid },
      economy: { ...state.economy, debt: state.economy.debt - repaid },
    },
    {
      severity: 'good',
      title: 'Public debt repaid',
      body: `₹${groupIndian(Math.round(repaid))} crore of public debt is repaid early, saving about ₹${groupIndian(Math.round(saved))} crore a month in interest.`,
    },
  );
}
