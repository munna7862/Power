import { debtToGdp, nominalGdp } from '../economy/model';
import { previousMonth } from '../engine/calendar';
import type { System } from '../engine/system';
import { HISTORY_LIMIT } from '../state/types';

/** Records a snapshot of the month that just closed, for indicator charts and reports. */
export const historySystem: System = {
  id: 'history',
  cadence: 'monthly',
  run(state) {
    const { nation, economy } = state;
    const history = [
      ...state.history,
      {
        month: previousMonth(state.clock.date),
        treasury: nation.treasury,
        approval: nation.approval,
        balance: economy.lastMonth?.balance ?? 0,
        gdp: nominalGdp(economy),
        realGrowth: economy.realGrowth,
        inflation: economy.inflation,
        unemployment: economy.unemployment,
        debtToGdp: debtToGdp(economy),
        revenue: economy.lastMonth?.totalRevenue ?? 0,
        expenditure: economy.lastMonth?.totalExpenditure ?? 0,
        corruption: economy.corruption,
        hdi: economy.hdi,
      },
    ];
    return {
      ...state,
      history: history.length > HISTORY_LIMIT ? history.slice(history.length - HISTORY_LIMIT) : history,
    };
  },
};
