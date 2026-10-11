import { resolve } from '../engine/modifiers';
import type { System } from '../engine/system';

export const BASE_APPROVAL_TARGET = 55;
/** Applied to the approval target while the treasury is overdrawn. */
export const OVERDRAWN_TREASURY_PENALTY = -8;
/** Fraction of the gap to the target closed each month. */
const DRIFT_RATE = 0.15;

/**
 * Phase 1 placeholder: approval drifts toward a target with monthly noise.
 * Replaced by the weighted approval model in Sprint 2.4.
 */
export const approvalSystem: System = {
  id: 'approval',
  cadence: 'monthly',
  run(state, { rng }) {
    const { nation } = state;
    let target = resolve(state.modifiers, 'politics.approvalTarget', BASE_APPROVAL_TARGET).total;
    if (nation.treasury < 0) target += OVERDRAWN_TREASURY_PENALTY;
    const drifted = nation.approval + (target - nation.approval) * DRIFT_RATE + rng.range(-1.5, 1.5);
    const approval = Math.round(Math.min(100, Math.max(0, drifted)) * 10) / 10;
    return { ...state, nation: { ...nation, approval } };
  },
};
