import { SECTORS, type MinistryId, type SectorId } from '../content/ids';
import { sumAdd } from '../engine/modifiers';
import type { GameState } from '../state/types';
import { averageUnrest } from '../security/terror';
import { SECTOR_BASE_GROWTH, SECTOR_MINISTRY_LINKS } from './constants';
import { allEfficiencies, debtToGdp, lastDeficitRatio, sectorShare } from './model';

/**
 * Real growth drivers, shared by the monthly economy system and the "Why?"
 * explanation in the UI so the two can never disagree. Values are annual rates.
 */
export type GrowthDriver =
  | 'trend'
  | 'policy'
  | 'ministries'
  | 'taxes'
  | 'debt'
  | 'corruption'
  | 'inflation'
  | 'stimulus'
  | 'crowdingOut'
  | 'disorder';

export const GROWTH_DRIVER_LABELS: Record<GrowthDriver, string> = {
  trend: 'Trend growth',
  policy: 'Ideology & strategy',
  ministries: 'Ministry performance',
  taxes: 'Tax burden',
  debt: 'Debt overhang',
  corruption: 'Corruption',
  inflation: 'High inflation',
  stimulus: 'Fiscal stimulus',
  crowdingOut: 'Crowding out by deficits',
  disorder: 'Unrest and terror',
};

const capped = (efficiency: number) => Math.min(efficiency, 1.8);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Drivers that apply equally to every sector. */
export function sharedDrivers(
  state: Pick<GameState, 'economy' | 'budget' | 'modifiers' | 'security'>,
  efficiency: Record<MinistryId, number>,
): Record<Exclude<GrowthDriver, 'trend'>, number> {
  const { economy, budget, modifiers } = state;
  const t = budget.taxRates;
  const deficit = lastDeficitRatio(economy);
  return {
    policy: sumAdd(modifiers, 'economy.growth'),
    ministries: 0.01 * (capped(efficiency.finance) - 1),
    taxes: -0.04 * (t.corporate - 0.25) - 0.03 * (t.income - 0.2) - 0.02 * (t.gst - 0.18),
    debt: -0.05 * Math.max(0, debtToGdp(economy) - 0.7),
    corruption: -0.0004 * (economy.corruption - 40),
    inflation: -0.25 * Math.max(0, economy.inflation - 0.06),
    stimulus: 0.1 * clamp(deficit - 0.03, -0.05, 0.05),
    crowdingOut: -0.1 * Math.max(0, deficit - 0.05),
    disorder:
      -0.00025 * Math.max(0, averageUnrest(state) - 30) - 0.00015 * Math.max(0, state.security.terrorThreat - 30),
  };
}

/** Drivers specific to one sector: its trend, sector-targeted policy and the ministries that serve it. */
export function sectorDrivers(
  state: Pick<GameState, 'modifiers'>,
  efficiency: Record<MinistryId, number>,
  sector: SectorId,
): { trend: number; policy: number; ministries: number } {
  const links = Object.entries(SECTOR_MINISTRY_LINKS[sector]) as [MinistryId, number][];
  return {
    trend: SECTOR_BASE_GROWTH[sector],
    policy: sumAdd(state.modifiers, `economy.growth.${sector}`),
    ministries: links.reduce((sum, [ministry, weight]) => sum + weight * (capped(efficiency[ministry]) - 1), 0),
  };
}

/** Expected growth of a sector before random noise. */
export function expectedSectorGrowth(
  state: Pick<GameState, 'economy' | 'budget' | 'modifiers' | 'security'>,
  efficiency: Record<MinistryId, number>,
  sector: SectorId,
): number {
  const shared = Object.values(sharedDrivers(state, efficiency)).reduce((a, b) => a + b, 0);
  const own = sectorDrivers(state, efficiency, sector);
  return shared + own.trend + own.policy + own.ministries;
}

/** GDP-weighted breakdown of expected real growth, for the "Why?" tooltip. */
export function explainGrowth(state: GameState): { driver: GrowthDriver; value: number }[] {
  const efficiency = allEfficiencies(state);
  const shared = sharedDrivers(state, efficiency);
  const totals: Record<GrowthDriver, number> = { trend: 0, ...shared };
  for (const s of SECTORS) {
    const weight = sectorShare(state.economy, s);
    const own = sectorDrivers(state, efficiency, s);
    totals.trend += weight * own.trend;
    totals.policy += weight * own.policy;
    totals.ministries += weight * own.ministries;
  }
  return (Object.keys(GROWTH_DRIVER_LABELS) as GrowthDriver[]).map((driver) => ({ driver, value: totals[driver] }));
}
