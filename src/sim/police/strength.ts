import {
  AGENCY_CONTENT,
  EQUIPMENT_CONTENT,
  OFFICER_CONTENT,
  POLICE_UNIT_CONTENT,
  STATION_CONTENT,
} from '../content/police';
import {
  AGENCIES,
  MINISTRIES,
  POLICE_UNITS,
  REGIONS,
  type AgencyId,
  type MinistryId,
  type PoliceUnitId,
  type RegionId,
} from '../content/ids';
import { START_CORRUPTION, START_POPULATION, START_UNEMPLOYMENT } from '../economy/constants';
import { regionPopulation } from '../infrastructure/coverage';
import { REGION_POPULATION_SHARE } from '../infrastructure/constants';
import type { Driver, Explained } from '../security/unrest';
import type { GameState, PoliceState } from '../state/types';
import {
  CIVIL_LIBERTIES,
  OPENING_AGENCY_STRENGTH,
  POLICE_IMPACT,
  RATIO_FLOOR,
  START_CRIME,
  STATION_HEADROOM,
  UNHOUSED_EFFECT,
} from './constants';

/**
 * Police formulas shared by the monthly systems, the Police screen and the bots, so the "Why?" tooltips can never
 * drift from what the sim does. Every effect compares today's force with the opening one, so a new game plays as
 * before Sprint 8.3 at tick 0; after that, a growing population thins the police unless the President recruits.
 */

type WithPolice = Pick<GameState, 'police' | 'nation'>;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** The police every game starts with. */
export function openingPolice(): PoliceState {
  const officers = Object.fromEntries(
    REGIONS.map((r) => [r, Math.round((OFFICER_CONTENT.openingPer100k * regionPopulation(START_POPULATION, r)) / 1e5)]),
  ) as Record<RegionId, number>;
  return {
    officers,
    stations: Object.fromEntries(
      REGIONS.map((r) => [r, Math.ceil((officers[r] * STATION_HEADROOM) / STATION_CONTENT.capacity)]),
    ) as Record<RegionId, number>,
    equipment: 1,
    units: Object.fromEntries(POLICE_UNITS.map((u) => [u, POLICE_UNIT_CONTENT[u].opening])) as Record<
      PoliceUnitId,
      number
    >,
    agencies: Object.fromEntries(AGENCIES.map((a) => [a, OPENING_AGENCY_STRENGTH])) as Record<AgencyId, number>,
  };
}

const OPENING = openingPolice();

/** Officers the region's stations can house. */
export const stationCapacity = (police: PoliceState, region: RegionId): number =>
  police.stations[region] * STATION_CONTENT.capacity;

/** Officers counted at full strength: those housed, plus those beyond capacity at half strength. */
export function deployedOfficers(police: PoliceState, region: RegionId): number {
  const housed = Math.min(police.officers[region], stationCapacity(police, region));
  return housed + UNHOUSED_EFFECT * (police.officers[region] - housed);
}

export const equipmentEffect = (police: PoliceState): number => EQUIPMENT_CONTENT[police.equipment - 1]?.effect ?? 1;

/** Officers per 100,000 people in a region. */
export const officersPer100k = (state: WithPolice, region: RegionId): number =>
  (state.police.officers[region] / regionPopulation(state.nation.population, region)) * 1e5;

const presence = (police: PoliceState, population: number, region: RegionId): number =>
  ((deployedOfficers(police, region) * equipmentEffect(police)) / regionPopulation(population, region)) * 1e5;

const OPENING_PRESENCE = Object.fromEntries(REGIONS.map((r) => [r, presence(OPENING, START_POPULATION, r)])) as Record<
  RegionId,
  number
>;

/** Effective policing of a region against the opening force: deployed officers per head × equipment (1 at start). */
export const policeRatio = (state: WithPolice, region: RegionId): number =>
  presence(state.police, state.nation.population, region) / OPENING_PRESENCE[region];

/** Officers per head against the opening force, without equipment: what civil liberties feel. */
export const headcountRatio = (state: WithPolice, region: RegionId): number =>
  state.police.officers[region] /
  regionPopulation(state.nation.population, region) /
  (OPENING.officers[region] / regionPopulation(START_POPULATION, region));

export const unitRatio = (state: Pick<GameState, 'police'>, unit: PoliceUnitId): number =>
  state.police.units[unit] / OPENING.units[unit];

/** An agency's strength above (or below) where it starts. */
export const agencyDelta = (state: Pick<GameState, 'police'>, agency: AgencyId): number =>
  state.police.agencies[agency] - OPENING_AGENCY_STRENGTH;

/** ln of a ratio, floored, so effects show diminishing returns and stay finite. */
const lnRatio = (ratio: number): number => Math.log(Math.max(RATIO_FLOOR, ratio));

/** The crime level a region is heading toward, with its causes. Shared by the monthly system and "Why?". */
export function crimeTarget(state: Pick<GameState, 'police' | 'nation' | 'economy'>, region: RegionId): Explained {
  const w = POLICE_IMPACT.crime;
  const drivers: Driver[] = [
    { label: 'Regional baseline', value: START_CRIME[region] },
    { label: 'Unemployment', value: w.unemployment * (state.economy.unemployment - START_UNEMPLOYMENT) },
    { label: 'Corruption', value: w.corruption * (state.economy.corruption - START_CORRUPTION) },
    { label: 'Police on the street', value: w.police * lnRatio(policeRatio(state, region)) },
    { label: 'Armed police', value: w.armedPolice * lnRatio(unitRatio(state, 'armedPolice')) },
    { label: 'Cyber crime cells', value: w.cyberCell * lnRatio(unitRatio(state, 'cyberCell')) },
  ];
  return {
    total: clamp(
      drivers.reduce((s, d) => s + d.value, 0),
      0,
      100,
    ),
    drivers,
  };
}

/** What the police add to a region's unrest target: their presence (negative) and the region's crime. */
export function policingUnrest(
  state: Pick<GameState, 'police' | 'nation' | 'security'>,
  region: RegionId,
): { police: number; crime: number } {
  const w = POLICE_IMPACT.unrest;
  return {
    police:
      w.police * lnRatio(policeRatio(state, region)) +
      w.rapidResponse * lnRatio(unitRatio(state, 'rapidResponse')) +
      w.armedPolice * lnRatio(unitRatio(state, 'armedPolice')),
    crime: w.crime * (state.security.crime[region] - START_CRIME[region]),
  };
}

const START_AVERAGE_CRIME = REGIONS.reduce((s, r) => s + START_CRIME[r], 0) / REGIONS.length;

/** Change in "safety and order" satisfaction from crime against the start (negative when crime is up). */
export function crimeSafetyEffect(state: Pick<GameState, 'security'>): number {
  const average = REGIONS.reduce((s, r) => s + state.security.crime[r], 0) / REGIONS.length;
  return POLICE_IMPACT.safety * (average - START_AVERAGE_CRIME);
}

/** Approval points lost to over-policing (0 or more). */
export function civilLibertiesCost(state: WithPolice): number {
  const over = (ratio: number) => Math.max(0, ratio - 1) ** CIVIL_LIBERTIES.exponent;
  const officers = REGIONS.reduce((s, r) => s + REGION_POPULATION_SHARE[r] * over(headcountRatio(state, r)), 0);
  return CIVIL_LIBERTIES.officers * officers + CIVIL_LIBERTIES.armedPolice * over(unitRatio(state, 'armedPolice'));
}

/** What the police and agencies add to the terror target. */
export function policeTerrorDrivers(state: Pick<GameState, 'police'>): Driver[] {
  const w = POLICE_IMPACT.terror;
  return [
    { label: 'Counter-terror squads', value: w.counterTerror * lnRatio(unitRatio(state, 'counterTerror')) },
    { label: 'Intelligence service', value: w.intelligenceService * agencyDelta(state, 'intelligenceService') },
    { label: 'Border police', value: w.borderPolice * agencyDelta(state, 'borderPolice') },
  ];
}

export const foilBonus = (state: Pick<GameState, 'police'>): number =>
  POLICE_IMPACT.foilPerPoint * agencyDelta(state, 'intelligenceService');

export const plotSuccessShift = (state: Pick<GameState, 'police'>): number =>
  POLICE_IMPACT.plotSuccess * lnRatio(unitRatio(state, 'counterTerror'));

export const protectionBonus = (state: Pick<GameState, 'police'>): number =>
  POLICE_IMPACT.protectionPerPoint * agencyDelta(state, 'presidentialProtection');

export const bureauCorruptionShift = (state: Pick<GameState, 'police'>): number =>
  POLICE_IMPACT.corruptionPerPoint * agencyDelta(state, 'antiCorruptionBureau');

export const bureauExposureBonus = (state: Pick<GameState, 'police'>): number =>
  POLICE_IMPACT.exposurePerPoint * agencyDelta(state, 'antiCorruptionBureau');

/**
 * Monthly running costs of the police and agencies beyond the opening force, ₹ crore, by department. The opening
 * force is part of each department's allocation; cutting below it saves money.
 */
export function policeUpkeep(state: Pick<GameState, 'police'>): Record<MinistryId, number> {
  const upkeep = Object.fromEntries(MINISTRIES.map((m) => [m, 0])) as Record<MinistryId, number>;
  const { police } = state;
  for (const r of REGIONS) {
    upkeep.home += (police.officers[r] - OPENING.officers[r]) * OFFICER_CONTENT.upkeep;
    upkeep.home += (police.stations[r] - OPENING.stations[r]) * STATION_CONTENT.upkeep;
  }
  upkeep.home += EQUIPMENT_CONTENT[police.equipment - 1]?.upkeep ?? 0;
  for (const u of POLICE_UNITS) upkeep.home += (police.units[u] - OPENING.units[u]) * POLICE_UNIT_CONTENT[u].upkeep;
  for (const a of AGENCIES)
    upkeep[AGENCY_CONTENT[a].department] += agencyDelta(state, a) * AGENCY_CONTENT[a].upkeepPerPoint;
  return upkeep;
}

/** Officers a region needs to get back to (or reach) a policing ratio, at today's stations and equipment. */
export function officersForRatio(state: WithPolice, region: RegionId, ratio = 1): number {
  const per100k = (OPENING_PRESENCE[region] * ratio) / equipmentEffect(state.police);
  const wanted = Math.ceil((per100k * regionPopulation(state.nation.population, region)) / 1e5);
  return Math.max(0, wanted - state.police.officers[region]);
}

/** Stations a region needs to house all its officers. */
export const stationsNeeded = (police: PoliceState, region: RegionId): number =>
  Math.max(0, Math.ceil(police.officers[region] / STATION_CONTENT.capacity) - police.stations[region]);
