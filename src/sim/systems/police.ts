import { REGIONS, type RegionId } from '../content/ids';
import type { System } from '../engine/system';
import { CRIME_DRIFT } from '../police/constants';
import { crimeTarget } from '../police/strength';
import { clamp } from '../security/unrest';

/** Monthly crime: each region drifts toward its target, set by jobs, corruption and policing. Runs before unrest. */
export const crimeSystem: System = {
  id: 'crime',
  cadence: 'monthly',
  run(state, { rng }) {
    const crime = {} as Record<RegionId, number>;
    for (const region of REGIONS) {
      const current = state.security.crime[region];
      const target = crimeTarget(state, region).total;
      crime[region] = clamp(current + (target - current) * CRIME_DRIFT + rng.range(-0.4, 0.4), 0, 100);
    }
    return { ...state, security: { ...state.security, crime } };
  },
};
