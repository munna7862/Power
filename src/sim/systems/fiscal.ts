import { CASH_RESERVE_MONTHS } from '../economy/constants';
import { interestRateFor, nominalGdp, projectMonth } from '../economy/model';
import type { System } from '../engine/system';
import { settleLoans } from '../finance/loans';
import type { RevenueLine } from '../state/types';

/** Share of the gap between the average and market interest rate closed each month (~2-year average maturity). */
const REPRICING_RATE = 0.04;

/**
 * Monthly fiscal settlement: collect revenue, pay ministries, establishment and
 * interest. When cash falls below the reserve (half a month of spending) the
 * government borrows to restore it; cash above twice the reserve repays debt.
 * The interest rate then reprices with debt, inflation and the deficit.
 */
export const fiscalSystem: System = {
  id: 'fiscal',
  cadence: 'monthly',
  run(current, { rng }) {
    const state = settleLoans(current);
    const projection = projectMonth(state, state.budget);
    const noise = rng.range(0.985, 1.015);
    const revenue = Object.fromEntries(
      Object.entries(projection.revenue).map(([line, amount]) => [line, amount * noise]),
    ) as Record<RevenueLine, number>;
    const totalRevenue = projection.totalRevenue * noise;
    const balance = totalRevenue - projection.totalExpenditure;

    const reserve = projection.totalExpenditure * CASH_RESERVE_MONTHS;
    let treasury = state.nation.treasury + balance;
    let debt = state.economy.debt;
    let borrowed = 0;
    let repaid = 0;
    if (treasury < reserve) {
      borrowed = reserve - treasury;
      debt += borrowed;
      treasury = reserve;
    } else if (treasury > 2 * reserve && debt > 0) {
      repaid = Math.min(debt, treasury - 2 * reserve);
      debt -= repaid;
      treasury -= repaid;
    }

    const economy = { ...state.economy, debt };
    const gdp = nominalGdp(economy);
    // Debt matures over a few years, so the average rate only drifts toward the market rate.
    const marketRate = interestRateFor(debt / gdp, economy.inflation, (-balance * 12) / gdp);
    return {
      ...state,
      nation: { ...state.nation, treasury: Math.round(treasury) },
      economy: {
        ...economy,
        interestRate: economy.interestRate + (marketRate - economy.interestRate) * REPRICING_RATE,
        lastMonth: {
          revenue,
          expenditure: projection.expenditure,
          totalRevenue,
          totalExpenditure: projection.totalExpenditure,
          balance,
          borrowed,
          repaid,
        },
      },
    };
  },
};
