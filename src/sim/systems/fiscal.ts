import { resolve } from '../engine/modifiers';
import type { System } from '../engine/system';

/**
 * Phase 1 placeholder economy: settles a month of revenue and expenditure into the treasury,
 * with small random variation. Replaced by the full economy model in Sprint 2.1.
 */
export const fiscalSystem: System = {
  id: 'fiscal',
  cadence: 'monthly',
  run(state, { rng }) {
    const { nation, modifiers } = state;
    const revenue =
      resolve(modifiers, 'economy.monthlyRevenue', nation.baseMonthlyRevenue).total * rng.range(0.98, 1.02);
    const expenditure =
      resolve(modifiers, 'economy.monthlyExpenditure', nation.baseMonthlyExpenditure).total * rng.range(0.99, 1.01);
    const balance = Math.round(revenue - expenditure);
    return { ...state, nation: { ...nation, treasury: nation.treasury + balance, lastMonthBalance: balance } };
  },
};
