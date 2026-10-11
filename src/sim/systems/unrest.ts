import { REGIONS, type RegionId } from '../content/ids';
import { allEfficiencies } from '../economy/model';
import type { System } from '../engine/system';
import { capUnrest, clamp, unrestCeiling, unrestTarget } from '../security/unrest';

/**
 * With the "no riots" option, holds every region just below the riot level each day, before the day's
 * events roll, so riot events can never become eligible. Without the option it changes nothing.
 */
export const riotCapSystem: System = {
  id: 'riot-cap',
  cadence: 'daily',
  run: (state) => (state.meta.options.noRiots ? capUnrest(state) : state),
};

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
      unrest[region] = clamp(current + (target - current) * 0.12 + rng.range(-0.8, 0.8), 0, unrestCeiling(state));
    }
    return { ...state, security: { ...state.security, unrest } };
  },
};
