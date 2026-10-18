import { FACILITY_CONTENT } from '../content/infrastructure';
import { STATION_CONTENT } from '../content/police';
import { REGION_LABELS, REGIONS, type FacilityId, type IndustryId, type PlantId, type RegionId } from '../content/ids';
import { START_POPULATION } from '../economy/constants';
import { coverage, regionPopulation } from '../infrastructure/coverage';
import { REGION_POPULATION_SHARE } from '../infrastructure/constants';
import { openingPolice } from '../police/strength';
import type { GameState } from '../state/types';

/**
 * National play (Sprint 8.10). With Regional play off the President gives orders for all of India and this module
 * decides where they go: worst region first, filling the gaps like water finding its level. The same functions serve
 * region-free orders in regional play, the screens' previews and the bots, so nobody gets a placement the others
 * could not. Every split is deterministic: ties go to the region that comes first in `REGIONS`.
 */

export interface Share {
  region: RegionId;
  quantity: number;
}

type PerRegion = Record<RegionId, number>;

const perRegion = (f: (r: RegionId) => number): PerRegion =>
  Object.fromEntries(REGIONS.map((r) => [r, f(r)])) as PerRegion;

/** Whether this game is played region by region. */
export const regionalPlay = (state: Pick<GameState, 'meta'>): boolean => state.meta.options.regions;

/** How the inbox names a place: "the North" in regional play, "India" for national play or a national order. */
export const placeName = (state: Pick<GameState, 'meta'>, region: RegionId | null): string =>
  region && regionalPlay(state) ? `the ${REGION_LABELS[region]}` : 'India';

/**
 * How event text names the place an event is about ("the {region}" in content): the region in regional play, "the
 * affected area" when the game speaks only of India, and "the country" for an event about no region.
 */
export function eventPlace(state: Pick<GameState, 'meta'>, region: RegionId | null): string {
  if (region === null) return 'the country';
  return regionalPlay(state) ? `the ${REGION_LABELS[region]}` : 'the affected area';
}

/**
 * Spreads `quantity` whole units over the regions, raising the lowest `level` first. One unit raises a region's level
 * by `step[r]`, and a region takes at most `cap[r]` units. Returns null when the caps cannot hold the quantity.
 */
export function fillLowest(level: PerRegion, step: PerRegion, quantity: number, cap?: PerRegion): Share[] | null {
  const limit = (r: RegionId) => (cap ? cap[r] : Infinity);
  if (REGIONS.reduce((s, r) => s + limit(r), 0) < quantity) return null;
  const units = (r: RegionId, water: number) => Math.min(limit(r), Math.max(0, (water - level[r]) / step[r]));
  const total = (water: number) => REGIONS.reduce((s, r) => s + units(r, water), 0);
  let lo = Math.min(...REGIONS.map((r) => level[r]));
  let hi = Math.max(...REGIONS.map((r) => level[r] + quantity * step[r]));
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (total(mid) < quantity) lo = mid;
    else hi = mid;
  }
  const exact = perRegion((r) => units(r, hi));
  const whole = perRegion((r) => Math.min(limit(r), Math.floor(exact[r])));
  let left = quantity - REGIONS.reduce((s, r) => s + whole[r], 0);
  // The last few units go to the largest remainders, then in REGIONS order, never past a cap.
  const order = [...REGIONS].sort((a, b) => exact[b] - whole[b] - (exact[a] - whole[a]));
  while (left > 0) {
    const before = left;
    for (const r of order) {
      if (left === 0) break;
      if (whole[r] < limit(r)) {
        whole[r] += 1;
        left -= 1;
      }
    }
    if (left === before) return null;
  }
  return REGIONS.filter((r) => whole[r] > 0).map((r) => ({ region: r, quantity: whole[r] }));
}

/** The same, taking units away from the highest level first. */
const takeHighest = (level: PerRegion, step: PerRegion, quantity: number, cap: PerRegion): Share[] | null =>
  fillLowest(
    perRegion((r) => -level[r]),
    step,
    quantity,
    cap,
  );

const areaStep = (state: Pick<GameState, 'nation'>, facility: FacilityId): PerRegion =>
  perRegion((r) => FACILITY_CONTENT[facility].capacity / regionPopulation(state.nation.population, r));

const areaLevel = (state: Pick<GameState, 'infrastructure' | 'nation'>, facility: FacilityId): PerRegion =>
  perRegion((r) => coverage(state, r, FACILITY_CONTENT[facility].area));

/** New facilities go where coverage of their area is thinnest. */
export const splitFacilities = (
  state: Pick<GameState, 'infrastructure' | 'nation'>,
  facility: FacilityId,
  quantity: number,
): Share[] => fillLowest(areaLevel(state, facility), areaStep(state, facility), quantity) ?? [];

/** Facilities are closed where coverage of their area is best, or null if there are not that many. */
export const splitDemolish = (
  state: Pick<GameState, 'infrastructure' | 'nation'>,
  facility: FacilityId,
  quantity: number,
): Share[] | null =>
  takeHighest(
    areaLevel(state, facility),
    areaStep(state, facility),
    quantity,
    perRegion((r) => state.infrastructure.counts[r][facility]),
  );

const OPENING_OFFICERS = openingPolice().officers;

/** Officers a region needs to match the opening force per head. */
const officersNeeded = (state: Pick<GameState, 'nation'>, r: RegionId): number =>
  (OPENING_OFFICERS[r] * state.nation.population) / START_POPULATION;

/**
 * Recruits go where the force per head is thinnest against the opening one; dismissals (a negative number) come from
 * where it is thickest. Null if there are not that many officers to dismiss.
 */
export function splitOfficers(state: Pick<GameState, 'police' | 'nation'>, officers: number): Share[] | null {
  const level = perRegion((r) => state.police.officers[r] / officersNeeded(state, r));
  const step = perRegion((r) => 1 / officersNeeded(state, r));
  if (officers >= 0) return fillLowest(level, step, officers);
  return takeHighest(level, step, -officers, state.police.officers);
}

/** New stations go where the most officers have no station to work from. */
export const splitStations = (state: Pick<GameState, 'police'>, quantity: number): Share[] =>
  fillLowest(
    perRegion((r) => state.police.stations[r] * STATION_CONTENT.capacity - state.police.officers[r]),
    perRegion(() => STATION_CONTENT.capacity),
    quantity,
  ) ?? [];

/**
 * Where a national power plant or factory is sited. The grid and the goods market are national, so the region does
 * not change what it does; national orders go to the most populous region.
 */
export const homeRegion = (): RegionId =>
  REGIONS.reduce((best, r) => (REGION_POPULATION_SHARE[r] > REGION_POPULATION_SHARE[best] ? r : best));

/** Power plants are closed where there are most of that kind, or null if there are not that many. */
export const splitDecommission = (
  state: Pick<GameState, 'energy'>,
  plant: PlantId,
  quantity: number,
): Share[] | null => {
  const count = perRegion((r) => state.energy.plants[r][plant]);
  return takeHighest(
    count,
    perRegion(() => 1),
    quantity,
    count,
  );
};

/** State plants are closed where there are most of that kind, or null if there are not that many. */
export function splitCloseIndustry(state: Pick<GameState, 'industry'>, industry: IndustryId, quantity: number) {
  const count = perRegion((r) => state.industry.plants[r][industry].state);
  return takeHighest(
    count,
    perRegion(() => 1),
    quantity,
    count,
  );
}
