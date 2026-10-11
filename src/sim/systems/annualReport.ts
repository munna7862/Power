import { debtToGdp } from '../economy/model';
import { groupIndian } from '../engine/numberFormat';
import type { System } from '../engine/system';
import { appendLog } from '../state/log';

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Posts a year-end summary to the inbox on 1 January. */
export const annualReportSystem: System = {
  id: 'annual-report',
  cadence: 'yearly',
  run(state) {
    const closedYear = state.clock.date.year - 1;
    const net = state.history.filter((h) => h.month.year === closedYear).reduce((sum, h) => sum + h.balance, 0);
    const { approval } = state.nation;
    const { economy } = state;
    const severity =
      net >= 0 && approval >= 50 ? 'good' : approval < 35 ? 'critical' : approval >= 50 ? 'info' : 'warning';
    const netText = `${net >= 0 ? 'surplus' : 'deficit'} of ₹${groupIndian(Math.abs(net))} crore`;
    return appendLog(state, {
      severity,
      title: `Annual report ${closedYear}`,
      body:
        `The government closed ${closedYear} with a ${netText}. ` +
        `Growth ${pct(economy.realGrowth)}, inflation ${pct(economy.inflation)}, unemployment ${pct(economy.unemployment)}, ` +
        `debt ${pct(debtToGdp(economy))} of GDP. Approval stands at ${approval.toFixed(1)}%.`,
    });
  },
};
