import { allEfficiencies } from '../economy/model';
import { formatDate } from '../engine/calendar';
import type { System } from '../engine/system';
import { approvalTarget, computeSatisfaction, IMPEACHMENT_MONTHS, IMPEACHMENT_THRESHOLD } from '../politics/approval';
import { appendLog } from '../state/log';

/** Fraction of the gap to the target closed each month. */
const DRIFT_RATE = 0.15;

/**
 * Monthly approval: voters score each factor, the weighted score plus modifiers
 * sets a target, and approval drifts toward it. Three straight months below the
 * impeachment threshold end the presidency.
 */
export const approvalSystem: System = {
  id: 'approval',
  cadence: 'monthly',
  run(state, { rng }) {
    const satisfaction = computeSatisfaction(state, allEfficiencies(state));
    const target = approvalTarget(state, satisfaction).total;
    const drifted = state.nation.approval + (target - state.nation.approval) * DRIFT_RATE + rng.range(-1, 1);
    const approval = Math.round(Math.min(100, Math.max(0, drifted)) * 10) / 10;
    const lowApprovalMonths = approval < IMPEACHMENT_THRESHOLD ? state.politics.lowApprovalMonths + 1 : 0;

    const next = {
      ...state,
      nation: { ...state.nation, approval },
      politics: { ...state.politics, satisfaction, lowApprovalMonths },
    };
    if (lowApprovalMonths < IMPEACHMENT_MONTHS) return next;

    const summary = `With approval at ${approval.toFixed(1)}% for ${IMPEACHMENT_MONTHS} months, Parliament voted to impeach ${state.meta.presidentName} on ${formatDate(state.clock.date)}.`;
    return appendLog(
      { ...next, status: { kind: 'over', cause: 'impeachment', date: state.clock.date, title: 'Impeached', summary } },
      { severity: 'critical', title: 'Impeached', body: summary },
    );
  },
};
