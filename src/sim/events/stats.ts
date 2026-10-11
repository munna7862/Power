import { MINISTRIES, REGIONS, type MinistryId, type RegionId } from '../content/ids';
import { allEfficiencies, debtToGdp, ministryEfficiency } from '../economy/model';
import { coupRisk, presidentialSafety } from '../security/leadership';
import { averageUnrest } from '../security/terror';
import type { GameState } from '../state/types';

/**
 * Numbers an event condition can look at. Rates are in percent (unemployment 8 = 8%),
 * so content reads naturally: { "stat": "unemployment", "op": ">", "value": 8 }.
 */
export const BASE_STATS = [
  'approval',
  'unemployment',
  'inflation',
  'growth',
  'debtToGdp',
  'corruption',
  'hdi',
  'treasury',
  'terrorThreat',
  'borderTension',
  'militaryLoyalty',
  'presidentialSafety',
  'coupRisk',
  'maxUnrest',
  'avgUnrest',
  /** Unrest in the event's own region. Only valid for regional events. */
  'regionUnrest',
  /** Calendar month, 1–12, for seasonal events. */
  'month',
  /** Year of the term, 1-based. */
  'yearInOffice',
  'minLoyalty',
  'maxMinisterCorruption',
  'vacancies',
  'livePlots',
  'activeOperations',
] as const;
export type BaseStat = (typeof BASE_STATS)[number];

export const EFFICIENCY_STATS = MINISTRIES.map((m) => `efficiency.${m}` as const);
export type EfficiencyStat = `efficiency.${MinistryId}`;

export type StatId = BaseStat | EfficiencyStat;
export const STAT_IDS: readonly StatId[] = [...BASE_STATS, ...EFFICIENCY_STATS];

/** Value of a stat. `region` is the event's region; only `regionUnrest` needs it. */
export function statValue(state: GameState, stat: StatId, region: RegionId | null): number {
  const { economy, security, nation, cabinet } = state;
  switch (stat) {
    case 'approval':
      return nation.approval;
    case 'unemployment':
      return economy.unemployment * 100;
    case 'inflation':
      return economy.inflation * 100;
    case 'growth':
      return economy.realGrowth * 100;
    case 'debtToGdp':
      return debtToGdp(economy) * 100;
    case 'corruption':
      return economy.corruption;
    case 'hdi':
      return economy.hdi * 100;
    case 'treasury':
      return nation.treasury;
    case 'terrorThreat':
      return security.terrorThreat;
    case 'borderTension':
      return security.borderTension;
    case 'militaryLoyalty':
      return security.militaryLoyalty;
    case 'presidentialSafety':
      return presidentialSafety(state, allEfficiencies(state));
    case 'coupRisk':
      return coupRisk(state);
    case 'maxUnrest':
      return Math.max(...REGIONS.map((r) => security.unrest[r]));
    case 'avgUnrest':
      return averageUnrest(state);
    case 'regionUnrest':
      return region ? security.unrest[region] : 0;
    case 'month':
      return state.clock.date.month;
    case 'yearInOffice':
      return Math.floor(state.clock.tick / 365.25) + 1;
    case 'minLoyalty':
      return Math.min(...MINISTRIES.map((m) => cabinet.ministers[m]?.loyalty ?? 100));
    case 'maxMinisterCorruption':
      return Math.max(...MINISTRIES.map((m) => cabinet.ministers[m]?.corruption ?? 0));
    case 'vacancies':
      return MINISTRIES.filter((m) => cabinet.ministers[m] === null).length;
    case 'livePlots':
      return security.plots.length;
    case 'activeOperations':
      return security.operations.length;
    default:
      return ministryEfficiency(state, stat.slice('efficiency.'.length) as MinistryId);
  }
}
