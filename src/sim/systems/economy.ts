import { SECTORS, type SectorId } from '../content/ids';
import { POPULATION_GROWTH } from '../economy/constants';
import { expectedSectorGrowth } from '../economy/growth';
import { allEfficiencies, lastDeficitRatio, realGdp } from '../economy/model';
import { sumAdd } from '../engine/modifiers';
import { facilityJobsEffect } from '../infrastructure/coverage';
import type { System } from '../engine/system';
import type { SectorState } from '../state/types';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const capped = (efficiency: number) => Math.min(efficiency, 1.8);

/**
 * Monthly macro update: sector growth (drivers in economy/growth.ts, plus noise), prices and jobs.
 */
export const economySystem: System = {
  id: 'economy',
  cadence: 'monthly',
  run(state, { rng }) {
    const { economy, budget, modifiers } = state;
    const t = budget.taxRates;
    const eff = allEfficiencies(state);
    const deficit = lastDeficitRatio(economy);

    const sectors = {} as Record<SectorId, SectorState>;
    for (const s of SECTORS) {
      const growth = clamp(expectedSectorGrowth(state, eff, s) + rng.range(-0.006, 0.006), -0.15, 0.2);
      sectors[s] = { output: economy.sectors[s].output * (1 + growth / 12), growth };
    }

    const before = realGdp(economy);
    const after = SECTORS.reduce((sum, s) => sum + sectors[s].output, 0);
    const monthlyAnnualised = (after / before) ** 12 - 1;
    const realGrowth = economy.realGrowth * 0.8 + monthlyAnnualised * 0.2;

    const inflationTarget =
      0.04 +
      0.8 * (deficit - 0.03) +
      0.8 * Math.max(0, deficit - 0.06) +
      0.5 * (realGrowth - 0.06) +
      0.15 * (t.gst - 0.18) +
      0.1 * (t.customs - 0.1) -
      0.01 * (capped(eff.agriculture) - 1) +
      sumAdd(modifiers, 'economy.inflation');
    const inflation = clamp(
      economy.inflation + (inflationTarget - economy.inflation) * 0.12 + rng.range(-0.001, 0.001),
      -0.05,
      0.5,
    );

    const unemploymentTarget = clamp(
      0.075 -
        0.5 * (realGrowth - 0.06) -
        0.01 * (capped(eff.industry) - 1) -
        0.005 * (capped(eff.agriculture) - 1) +
        0.05 * (t.corporate - 0.25) +
        facilityJobsEffect(state) +
        sumAdd(modifiers, 'economy.unemployment'),
      0.02,
      0.4,
    );
    const unemployment = clamp(
      economy.unemployment + (unemploymentTarget - economy.unemployment) * 0.08 + rng.range(-0.0005, 0.0005),
      0.02,
      0.4,
    );

    return {
      ...state,
      nation: { ...state.nation, population: state.nation.population * (1 + POPULATION_GROWTH / 12) },
      economy: {
        ...economy,
        sectors,
        realGrowth,
        inflation,
        unemployment,
        priceIndex: economy.priceIndex * (1 + inflation / 12),
      },
    };
  },
};
