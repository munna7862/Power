import { leakagePressure } from '../departments/quality';
import { START_GDP, START_HDI, START_POPULATION } from '../economy/constants';
import { allEfficiencies, realGdp } from '../economy/model';
import { sumAdd } from '../engine/modifiers';
import type { System } from '../engine/system';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Monthly drift of national corruption and the Human Development Index. */
export const societySystem: System = {
  id: 'society',
  cadence: 'monthly',
  run(state, { rng }) {
    const { economy, modifiers } = state;
    const eff = allEfficiencies(state);

    const corruptionTarget =
      25 +
      0.4 * leakagePressure(state) -
      12 * (Math.min(eff.antiCorruption, 2) - 1) +
      sumAdd(modifiers, 'politics.corruption');
    const corruption = clamp(
      economy.corruption + (corruptionTarget - economy.corruption) * 0.05 + rng.range(-0.3, 0.3),
      0,
      100,
    );

    const perCapitaGain = realGdp(economy) / state.nation.population / (START_GDP / START_POPULATION);
    const hdiTarget =
      START_HDI +
      0.1 * Math.log(perCapitaGain) +
      0.02 * (Math.min(eff.health, 1.8) - 1) +
      0.02 * (Math.min(eff.education, 1.8) - 1) +
      sumAdd(modifiers, 'society.hdi');
    const hdi = clamp(economy.hdi + (hdiTarget - economy.hdi) * 0.03, 0.2, 0.99);

    return { ...state, economy: { ...economy, corruption, hdi } };
  },
};
