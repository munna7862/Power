import { REGIONS, type RegionId } from '../content/ids';
import { allEfficiencies } from '../economy/model';
import type { System } from '../engine/system';
import { clamp, unrestTarget } from '../security/unrest';

/** Monthly unrest: each region drifts toward its target, set by jobs, prices, corruption, approval and policing. */
export const unrestSystem: System = {
  id: 'unrest',
  cadence: 'monthly',
  run(state, { rng }) {
    const eff = allEfficiencies(state);
    const unrest = {} as Record<RegionId, number>;
    for (const region of REGIONS) {
      const current = state.security.unrest[region];
      const target = unrestTarget(state, region, eff).total;
      unrest[region] = clamp(current + (target - current) * 0.12 + rng.range(-0.8, 0.8), 0, 100);
    }
    return { ...state, security: { ...state.security, unrest } };
  },
};
