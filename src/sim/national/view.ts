import { REGIONS, type RegionId } from '../content/ids';
import { REGION_POPULATION_SHARE } from '../infrastructure/constants';
import { crimeTarget, headcountRatio, officersForRatio, policeRatio, stationsNeeded } from '../police/strength';
import type { Driver, Explained } from '../security/unrest';
import type { GameState } from '../state/types';

/**
 * National figures for national play (Sprint 8.10), read from the same regional formulas the systems use, so the
 * screens and the bots of both modes agree with the simulation. Riots fire region by region, so national unrest is the
 * highest region's; everything else is a population-weighted average.
 */

const weighted = (f: (r: RegionId) => number): number =>
  REGIONS.reduce((s, r) => s + REGION_POPULATION_SHARE[r] * f(r), 0);

/** The region closest to riots (ties: the first in `REGIONS`). */
export const hottestRegion = (state: Pick<GameState, 'security'>): RegionId =>
  REGIONS.reduce((worst, r) => (state.security.unrest[r] > state.security.unrest[worst] ? r : worst));

/** National unrest: the hottest region's, because that is where riots break out. */
export const nationalUnrest = (state: Pick<GameState, 'security'>): number =>
  state.security.unrest[hottestRegion(state)];

/** National crime, 0–100, weighted by population. */
export const nationalCrime = (state: Pick<GameState, 'security'>): number => weighted((r) => state.security.crime[r]);

/** The crime level India is heading toward, with each cause averaged over the regions by population. */
export function nationalCrimeTarget(state: Pick<GameState, 'police' | 'nation' | 'economy'>): Explained {
  const perRegion = REGIONS.map((r) => ({ share: REGION_POPULATION_SHARE[r], target: crimeTarget(state, r) }));
  const drivers: Driver[] = (perRegion[0]?.target.drivers ?? []).map((d, i) => ({
    label: d.label,
    value: perRegion.reduce((s, p) => s + p.share * (p.target.drivers[i]?.value ?? 0), 0),
  }));
  return { total: perRegion.reduce((s, p) => s + p.share * p.target.total, 0), drivers };
}

/** Effective policing of India against the opening force (1 at the start), weighted by population. */
export const nationalPoliceRatio = (state: Pick<GameState, 'police' | 'nation'>): number =>
  weighted((r) => policeRatio(state, r));

/** Officers per head against the opening force (1 at the start), weighted by population. */
export const nationalHeadcountRatio = (state: Pick<GameState, 'police' | 'nation'>): number =>
  weighted((r) => headcountRatio(state, r));

/** Officers in all of India. */
export const nationalOfficers = (state: Pick<GameState, 'police'>): number =>
  REGIONS.reduce((s, r) => s + state.police.officers[r], 0);

/** Police stations in all of India. */
export const nationalStations = (state: Pick<GameState, 'police'>): number =>
  REGIONS.reduce((s, r) => s + state.police.stations[r], 0);

/** Officers to recruit for every region to reach the opening strength: what a national order placed thinnest first needs. */
export const nationalOfficersForRatio = (state: Pick<GameState, 'police' | 'nation'>, ratio = 1): number =>
  REGIONS.reduce((s, r) => s + officersForRatio(state, r, ratio), 0);

/** Stations to build for every region to house its officers. */
export const nationalStationsNeeded = (state: Pick<GameState, 'police'>): number =>
  REGIONS.reduce((s, r) => s + stationsNeeded(state.police, r), 0);
