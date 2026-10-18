import type { MinistryId, RegionId } from '../content/ids';
import { coverageEffect } from '../infrastructure/coverage';
import { policingUnrest } from '../police/strength';
import type { GameState } from '../state/types';
import { NO_RIOTS_UNREST_CAP, REGION_UNREST_BIAS } from './constants';

export interface Driver {
  label: string;
  value: number;
}

export interface Explained {
  total: number;
  drivers: Driver[];
}

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** The highest unrest can go: with the "no riots" option it stays below every riot trigger. */
export const unrestCeiling = (state: Pick<GameState, 'meta'>): number =>
  state.meta.options.noRiots ? NO_RIOTS_UNREST_CAP : 100;

/** Holds every region at or below the ceiling. Returns the same state when nothing needs capping. */
export function capUnrest(state: GameState): GameState {
  const ceiling = unrestCeiling(state);
  const unrest = state.security.unrest;
  if (Object.values(unrest).every((v) => v <= ceiling)) return state;
  const capped = Object.fromEntries(Object.entries(unrest).map(([r, v]) => [r, Math.min(v, ceiling)])) as typeof unrest;
  return { ...state, security: { ...state.security, unrest: capped } };
}

/**
 * The level of unrest a region is heading toward. Shared by the monthly system and the
 * Security screen's "Why?" tooltip. Causes are economic, regional and law-and-order only.
 */
export function unrestTarget(
  state: Pick<GameState, 'economy' | 'nation' | 'infrastructure' | 'police' | 'security'>,
  region: RegionId,
  efficiency: Record<MinistryId, number>,
): Explained {
  const { economy, nation } = state;
  const policing = policingUnrest(state, region);
  const drivers: Driver[] = [
    { label: 'Baseline', value: 18 },
    { label: 'Unemployment', value: (economy.unemployment - 0.06) * 250 },
    { label: 'Price rises', value: Math.max(0, economy.inflation - 0.04) * 180 },
    { label: 'Corruption', value: (economy.corruption - 40) * 0.25 },
    { label: 'Approval', value: (50 - nation.approval) * 0.45 },
    { label: 'Regional pressures', value: REGION_UNREST_BIAS[region] },
    { label: 'Policing and order', value: -14 * (Math.min(efficiency.home, 1.8) - 1) },
    { label: 'Schools, clinics and housing', value: coverageEffect(state, 'unrest', region) },
    { label: 'Police on the street', value: policing.police },
    { label: 'Crime', value: policing.crime },
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
