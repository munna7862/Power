import { previousMonth } from '../engine/calendar';
import type { System } from '../engine/system';
import { HISTORY_LIMIT } from '../state/types';

/** Records a snapshot of the month that just closed, for indicator charts. */
export const historySystem: System = {
  id: 'history',
  cadence: 'monthly',
  run(state) {
    const { nation } = state;
    const history = [
      ...state.history,
      {
        month: previousMonth(state.clock.date),
        treasury: nation.treasury,
        approval: nation.approval,
        balance: nation.lastMonthBalance,
      },
    ];
    return {
      ...state,
      history: history.length > HISTORY_LIMIT ? history.slice(history.length - HISTORY_LIMIT) : history,
    };
  },
};
