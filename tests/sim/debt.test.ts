import { describe, expect, it } from 'vitest';
import {
  cashReserve,
  dispatch,
  maxDebtRepayment,
  MIN_DEBT_REPAYMENT,
  projectMonth,
  validateRepayDebt,
  type GameState,
} from '../../src/sim';
import { CASH_RESERVE_MONTHS } from '../../src/sim/economy/constants';
import { deepFreeze, newGame } from '../helpers';

const withTreasury = (state: GameState, treasury: number): GameState => ({
  ...state,
  nation: { ...state.nation, treasury },
});

describe('repaying public debt early', () => {
  it('keeps the same reserve as the monthly settlement: half a month of spending', () => {
    const state = newGame();
    expect(cashReserve(state)).toBeCloseTo(projectMonth(state, state.budget).totalExpenditure * CASH_RESERVE_MONTHS);
    expect(maxDebtRepayment(state)).toBe(Math.max(0, Math.floor(state.nation.treasury - cashReserve(state))));
  });

  it('moves cash from the treasury to the debt, rupee for rupee', () => {
    const state = deepFreeze(withTreasury(newGame(), newGame().nation.treasury + 50_000));
    const result = dispatch(state, { type: 'REPAY_DEBT', amount: 20_000 });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.nation.treasury).toBe(state.nation.treasury - 20_000);
    expect(result.state.economy.debt).toBe(state.economy.debt - 20_000);
    expect(result.state.log.at(-1)!.title).toBe('Public debt repaid');
  });

  it('never dips into the reserve, and needs a real amount', () => {
    const state = withTreasury(newGame(), newGame().nation.treasury + 50_000);
    const most = maxDebtRepayment(state);
    expect(validateRepayDebt(state, most)).toBeNull();
    expect(validateRepayDebt(state, most + 1)).toMatch(/reserve/);
    expect(validateRepayDebt(state, MIN_DEBT_REPAYMENT - 1)).toMatch(/at least/);
    expect(validateRepayDebt(state, 0)).toMatch(/above zero/);
    const broke = withTreasury(state, cashReserve(state));
    expect(validateRepayDebt(broke, MIN_DEBT_REPAYMENT)).toMatch(/no cash above its reserve/);
    expect(dispatch(broke, { type: 'REPAY_DEBT', amount: MIN_DEBT_REPAYMENT }).ok).toBe(false);
  });

  it('cannot repay more than is owed, and lets the last small sum go', () => {
    const state = withTreasury(newGame(), 10_000_000);
    const almost = { ...state, economy: { ...state.economy, debt: 500 } };
    expect(maxDebtRepayment(almost)).toBe(500);
    expect(validateRepayDebt(almost, 500)).toBeNull();
    const none = { ...state, economy: { ...state.economy, debt: 0 } };
    expect(validateRepayDebt(none, 1_000)).toMatch(/no public debt/);
  });
});
