import { GOOD_CONTENT, INDUSTRY_CONTENT } from '../content/goods';
import { PLANT_CONTENT } from '../content/power';
import { GOODS, INDUSTRIES, PLANTS, REGIONS, type GoodId, type IndustryId, type RegionId } from '../content/ids';
import type { IndustryState } from '../state/types';
import { STOCK_TARGET_MONTHS } from './constants';

/**
 * What every game starts with, from content alone: the opening plants, and the domestic demand that the opening
 * production, industrial use, power-station fuel and imports balance exactly. Kept apart from the flow formulas so
 * the energy grid can read the opening plants without a circular import.
 */

export type Plants = IndustryState['plants'];

export const openingPlants = (): Plants =>
  Object.fromEntries(
    REGIONS.map((r) => [r, Object.fromEntries(INDUSTRIES.map((i) => [i, { ...INDUSTRY_CONTENT[i].opening[r] }]))]),
  ) as Plants;

export const OPENING_PLANTS = openingPlants();

/** Plants of one type nationwide, state and private together. */
export const plantCount = (plants: Plants, industry: IndustryId): number =>
  REGIONS.reduce((s, r) => s + plants[r][industry].state + plants[r][industry].private, 0);

export const ownedCount = (plants: Plants, industry: IndustryId, owner: 'state' | 'private'): number =>
  REGIONS.reduce((s, r) => s + plants[r][industry][owner], 0);

/** Domestic demand for each good at the start, units a month: opening supply less industrial use, plus imports. */
export const OPENING_DEMAND: Record<GoodId, number> = (() => {
  const net = Object.fromEntries(GOODS.map((g) => [g, GOOD_CONTENT[g].openingImports])) as Record<GoodId, number>;
  for (const i of INDUSTRIES) {
    const n = plantCount(OPENING_PLANTS, i);
    for (const [g, q] of Object.entries(INDUSTRY_CONTENT[i].outputs)) net[g as GoodId] += n * q;
    for (const [g, q] of Object.entries(INDUSTRY_CONTENT[i].inputs)) net[g as GoodId] -= n * q;
  }
  for (const p of PLANTS) {
    const c = PLANT_CONTENT[p];
    if (!c.fuel) continue;
    const fleet = REGIONS.reduce((s, r) => s + c.opening[r], 0);
    net[c.fuel] -= fleet * c.fuelUse;
  }
  for (const g of GOODS) {
    if (!(net[g] > 0)) throw new Error(`content: opening demand for ${g} must be positive (got ${net[g]})`);
  }
  return net;
})();

export const openingStocks = (): Record<GoodId, number> =>
  Object.fromEntries(GOODS.map((g) => [g, OPENING_DEMAND[g] * STOCK_TARGET_MONTHS])) as Record<GoodId, number>;

/** GW drawn by plants beyond the opening ones (the opening plants' power is part of the grid's industry demand). */
export function extraPlantPower(plants: Plants): number {
  return INDUSTRIES.reduce(
    (s, i) => s + (plantCount(plants, i) - plantCount(OPENING_PLANTS, i)) * INDUSTRY_CONTENT[i].power,
    0,
  );
}

export const plantsIn = (plants: Plants, region: RegionId, industry: IndustryId) => plants[region][industry];
