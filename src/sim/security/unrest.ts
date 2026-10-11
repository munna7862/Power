import type { MinistryId, RegionId } from '../content/ids';
import type { GameState } from '../state/types';
import { REGION_UNREST_BIAS } from './constants';

export interface Driver {
  label: string;
  value: number;
}

export interface Explained {
  total: number;
  drivers: Driver[];
}

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * The level of unrest a region is heading toward. Shared by the monthly system and the
 * Security screen's "Why?" tooltip. Causes are economic, regional and law-and-order only.
 */
export function unrestTarget(
  state: Pick<GameState, 'economy' | 'nation'>,
  region: RegionId,
  efficiency: Record<MinistryId, number>,
): Explained {
  const { economy, nation } = state;
  const drivers: Driver[] = [
    { label: 'Baseline', value: 18 },
    { label: 'Unemployment', value: (economy.unemployment - 0.06) * 250 },
    { label: 'Price rises', value: Math.max(0, economy.inflation - 0.04) * 180 },
    { label: 'Corruption', value: (economy.corruption - 40) * 0.25 },
    { label: 'Approval', value: (50 - nation.approval) * 0.45 },
    { label: 'Regional pressures', value: REGION_UNREST_BIAS[region] },
    { label: 'Policing and order', value: -14 * (Math.min(efficiency.home, 1.8) - 1) },
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
