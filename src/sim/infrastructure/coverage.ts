import { FACILITY_CONTENT } from '../content/infrastructure';
import {
  COVERAGE_AREAS,
  FACILITIES,
  MINISTRIES,
  REGIONS,
  type CoverageArea,
  type FacilityId,
  type MinistryId,
  type RegionId,
} from '../content/ids';
import { START_POPULATION } from '../economy/constants';
import type { GameState, InfrastructureState } from '../state/types';
import {
  AREA_WEIGHTS,
  COVERAGE_CEILING,
  COVERAGE_IMPACT,
  LABOUR_FORCE,
  REGION_POPULATION_SHARE,
  type CoverageEffect,
} from './constants';

/**
 * Coverage formulas shared by the monthly systems and the Construction screen, so the "Why?" tooltips can never
 * drift from what the sim does. Every effect is measured against the opening network, so a new game plays exactly
 * as before Sprint 8.2 at tick 0; after that, a growing population wears coverage down unless the President builds.
 */

type Counts = InfrastructureState['counts'];
type WithInfrastructure = Pick<GameState, 'infrastructure' | 'nation'>;

const FACILITIES_BY_AREA = Object.fromEntries(
  COVERAGE_AREAS.map((a) => [a, FACILITIES.filter((f) => FACILITY_CONTENT[f].area === a)]),
) as Record<CoverageArea, FacilityId[]>;

export const facilitiesIn = (area: CoverageArea): readonly FacilityId[] => FACILITIES_BY_AREA[area];

/** The facilities standing at the start of every game: enough for each content's opening share of each region. */
export function openingCounts(): Counts {
  return Object.fromEntries(
    REGIONS.map((r) => [
      r,
      Object.fromEntries(
        FACILITIES.map((f) => {
          const c = FACILITY_CONTENT[f];
          return [f, Math.round((c.opening[r] * START_POPULATION * REGION_POPULATION_SHARE[r]) / c.capacity)];
        }),
      ),
    ]),
  ) as Counts;
}

const OPENING_COUNTS = openingCounts();

export const openingInfrastructure = (): InfrastructureState => ({ counts: openingCounts(), queue: [] });

export const regionPopulation = (population: number, region: RegionId): number =>
  population * REGION_POPULATION_SHARE[region];

/** People served ÷ people living there, for one area of one region (1 = everyone is served). */
function rawCoverage(counts: Counts, population: number, region: RegionId, area: CoverageArea): number {
  const served = FACILITIES_BY_AREA[area].reduce((sum, f) => sum + counts[region][f] * FACILITY_CONTENT[f].capacity, 0);
  return served / regionPopulation(population, region);
}

export const coverage = (state: WithInfrastructure, region: RegionId, area: CoverageArea): number =>
  rawCoverage(state.infrastructure.counts, state.nation.population, region, area);

/** Coverage as the sim counts it: in full up to 100%, at half the rate beyond, capped at COVERAGE_CEILING. */
export const effectiveCoverage = (raw: number): number =>
  raw <= 1 ? raw : 1 + 0.5 * (Math.min(raw, COVERAGE_CEILING) - 1);

function regionIndex(counts: Counts, population: number, region: RegionId, effect: CoverageEffect): number {
  return COVERAGE_AREAS.reduce(
    (sum, a) => sum + AREA_WEIGHTS[effect][a] * effectiveCoverage(rawCoverage(counts, population, region, a)),
    0,
  );
}

const nationalIndex = (counts: Counts, population: number, effect: CoverageEffect): number =>
  REGIONS.reduce((sum, r) => sum + REGION_POPULATION_SHARE[r] * regionIndex(counts, population, r, effect), 0);

const OPENING_REGION = Object.fromEntries(
  (['hdi', 'services', 'unrest', 'growth'] as const).map((e) => [
    e,
    Object.fromEntries(REGIONS.map((r) => [r, regionIndex(OPENING_COUNTS, START_POPULATION, r, e)])),
  ]),
) as Record<CoverageEffect, Record<RegionId, number>>;

const OPENING_NATIONAL = Object.fromEntries(
  (['hdi', 'services', 'unrest', 'growth'] as const).map((e) => [
    e,
    nationalIndex(OPENING_COUNTS, START_POPULATION, e),
  ]),
) as Record<CoverageEffect, number>;

/** The weighted coverage of a region (or the nation) for one effect: 1 = everyone served in every weighted area. */
export const coverageIndex = (state: WithInfrastructure, effect: CoverageEffect, region?: RegionId): number =>
  region === undefined
    ? nationalIndex(state.infrastructure.counts, state.nation.population, effect)
    : regionIndex(state.infrastructure.counts, state.nation.population, region, effect);

/**
 * How far coverage has moved an outcome from where the opening network leaves it, in that outcome's own units:
 * HDI, satisfaction points, unrest points or annual growth. 0 at the start of a game.
 */
export function coverageEffect(state: WithInfrastructure, effect: CoverageEffect, region?: RegionId): number {
  const opening = region === undefined ? OPENING_NATIONAL[effect] : OPENING_REGION[effect][region];
  return COVERAGE_IMPACT[effect] * (coverageIndex(state, effect, region) - opening);
}

/** Facilities built (or demolished) since the opening network, per region and type. */
const netBuilt = (state: Pick<GameState, 'infrastructure'>, region: RegionId, facility: FacilityId): number =>
  state.infrastructure.counts[region][facility] - OPENING_COUNTS[region][facility];

/**
 * Monthly running costs of facilities built beyond the opening network, ₹ crore, by department. The opening
 * network's running costs are part of each department's allocation; demolishing below it saves money.
 */
export function facilityUpkeep(state: Pick<GameState, 'infrastructure'>): Record<MinistryId, number> {
  const upkeep = Object.fromEntries(MINISTRIES.map((m) => [m, 0])) as Record<MinistryId, number>;
  for (const r of REGIONS) {
    for (const f of FACILITIES) {
      const c = FACILITY_CONTENT[f];
      upkeep[c.department] += netBuilt(state, r, f) * c.upkeep;
    }
  }
  return upkeep;
}

/** Change in unemployment from staffing facilities built beyond the opening network (negative = fewer jobless). */
export function facilityJobsEffect(state: Pick<GameState, 'infrastructure'>): number {
  let jobs = 0;
  for (const r of REGIONS) for (const f of FACILITIES) jobs += netBuilt(state, r, f) * FACILITY_CONTENT[f].jobs;
  return -jobs / LABOUR_FORCE;
}

export interface CoverageLine {
  facility: FacilityId;
  count: number;
  served: number;
}

/** Why a region's coverage of an area is what it is: who each facility type serves, against the population. */
export function explainCoverage(
  state: WithInfrastructure,
  region: RegionId,
  area: CoverageArea,
): { lines: CoverageLine[]; population: number; coverage: number; counted: number } {
  const lines = FACILITIES_BY_AREA[area].map((facility) => {
    const count = state.infrastructure.counts[region][facility];
    return { facility, count, served: count * FACILITY_CONTENT[facility].capacity };
  });
  const raw = coverage(state, region, area);
  return {
    lines,
    population: regionPopulation(state.nation.population, region),
    coverage: raw,
    counted: effectiveCoverage(raw),
  };
}

/** Facilities of one type needed for a region's coverage of their area to reach the target (0 if it already does). */
export function facilitiesForTarget(
  state: WithInfrastructure,
  region: RegionId,
  facility: FacilityId,
  target = 1,
): number {
  const c = FACILITY_CONTENT[facility];
  const gap = target - coverage(state, region, c.area);
  return gap <= 0 ? 0 : Math.ceil((gap * regionPopulation(state.nation.population, region)) / c.capacity);
}
