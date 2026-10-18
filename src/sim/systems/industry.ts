import type { System } from '../engine/system';
import { completeIndustry } from '../industry/build';
import { computeFlows, settled } from '../industry/flows';
import { privateInvestment } from '../industry/private';
import { deliverContracts, settleMarket } from '../market/trade';

/** Daily: state plants and licensed private plants open when their build is done. */
export const industryDailySystem: System = {
  id: 'industry-daily',
  cadence: 'daily',
  run: (state) => (state.status.kind === 'over' ? state : completeIndustry(state)),
};

/**
 * Monthly, after the economy and before the fiscal settlement: plants produce, the country uses goods, the private
 * market imports what stocks lack, then private investors react to the business climate.
 */
export const industryMonthlySystem: System = {
  id: 'industry-monthly',
  cadence: 'monthly',
  run(state, { rng }) {
    const flows = computeFlows(state);
    const next = { ...state, industry: { ...state.industry, stocks: flows.stocks, last: settled(flows) } };
    return privateInvestment(next, rng);
  },
};

/** Monthly: supply contracts deliver, then world prices drift and partners' monthly capacity resets. */
export const marketMonthlySystem: System = {
  id: 'market-monthly',
  cadence: 'monthly',
  run: (state, { rng }) => settleMarket(deliverContracts(state), rng),
};
