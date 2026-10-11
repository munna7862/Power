import { groupIndian } from '../engine/numberFormat';
import type { System } from '../engine/system';
import { appendLog } from '../state/log';

/** Posts a year-end summary to the inbox on 1 January. */
export const annualReportSystem: System = {
  id: 'annual-report',
  cadence: 'yearly',
  run(state) {
    const closedYear = state.clock.date.year - 1;
    const months = state.history.filter((h) => h.month.year === closedYear);
    const net = months.reduce((sum, h) => sum + h.balance, 0);
    const approval = state.nation.approval;
    const severity = net >= 0 && approval >= 50 ? 'good' : approval < 35 ? 'critical' : 'warning';
    const netText = `${net >= 0 ? 'surplus' : 'deficit'} of ₹${groupIndian(Math.abs(net))} crore`;
    return appendLog(state, {
      severity,
      title: `Annual report ${closedYear}`,
      body: `The government closed ${closedYear} with a ${netText}. Approval stands at ${approval.toFixed(1)}%.`,
    });
  },
};
