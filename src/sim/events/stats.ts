import { MINISTRIES, REGIONS, RIVALS, type GoodId, type MinistryId, type RegionId } from '../content/ids';
import { FOCUS_IDS } from '../content/world';
import { allEfficiencies, debtToGdp, ministryEfficiency } from '../economy/model';
import { militaryStrength } from '../military/strength';
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
  'livePlots',
  'activeOperations',
  /** Armed forces, 0-100. */
  'readiness',
  'morale',
  'deterrence',
  /** The military strength index (about 80 at the start). */
  'militaryStrength',
  /** Funding of the forces against their upkeep, in percent (100 = exactly covered). */
  'defenceFunding',
  /** Number of wars being fought. */
  'wars',
  /** Highest war weariness among current wars, 0-100. */
  'warWeariness',
  'warheads',
  /** Nuclear program research progress, 0-100. */
  'nuclearResearch',
  /** Worst relation with any rival state, -100 to +100. */
  'worstRelation',
  /** India's global reputation and the world's tension, 0-100. */
  'reputation',
  'worldTension',
  /** Active trade contracts and non-aggression pacts. */
  'tradeDeals',
  'pacts',
  /** Average relation with the focus nations, -100 to +100. */
  'avgRelation',
  /** Crises between other countries, and countries sanctioning India. */
  'conflicts',
  'sanctionsOnIndia',
  /** Share of demand for food and grain, and for fuel, coal and gas, left unmet last month (percent). */
  'foodShortage',
  'fuelShortage',
] as const;
export type BaseStat = (typeof BASE_STATS)[number];

export const EFFICIENCY_STATS = MINISTRIES.map((m) => `efficiency.${m}` as const);
export type EfficiencyStat = `efficiency.${MinistryId}`;

export type StatId = BaseStat | EfficiencyStat;
export const STAT_IDS: readonly StatId[] = [...BASE_STATS, ...EFFICIENCY_STATS];

/** Percent of demand for these goods the country could not meet last month. */
function unmetShare(state: GameState, goods: readonly GoodId[]): number {
  const { shortage, demand } = state.industry.last;
  const need = goods.reduce((s, g) => s + demand[g], 0);
  return need > 0 ? (100 * goods.reduce((s, g) => s + shortage[g], 0)) / need : 0;
}

/** Value of a stat. `region` is the event's region; only `regionUnrest` needs it. */
export function statValue(state: GameState, stat: StatId, region: RegionId | null): number {
  const { economy, security, nation } = state;
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
    case 'livePlots':
      return security.plots.length;
    case 'activeOperations':
      return security.operations.length;
    case 'readiness':
      return state.military.readiness;
    case 'morale':
      return state.military.morale;
    case 'deterrence':
      return state.military.deterrence;
    case 'militaryStrength':
      return militaryStrength(state.military);
    case 'defenceFunding':
      return state.military.fundingRatio * 100;
    case 'wars':
      return state.military.wars.length;
    case 'warWeariness':
      return Math.max(0, ...state.military.wars.map((w) => w.weariness));
    case 'warheads':
      return state.military.nuclear.warheads;
    case 'nuclearResearch':
      return state.military.nuclear.research;
    case 'worstRelation':
      return Math.min(...RIVALS.map((r) => state.diplomacy.countries[r]?.relation ?? 0));
    case 'reputation':
      return state.diplomacy.reputation;
    case 'worldTension':
      return state.diplomacy.worldTension;
    case 'tradeDeals':
      return state.diplomacy.treaties.filter((t) => t.type === 'trade').length;
    case 'pacts':
      return state.diplomacy.treaties.filter((t) => t.type === 'nonAggression').length;
    case 'avgRelation':
      return FOCUS_IDS.reduce((sum, id) => sum + (state.diplomacy.countries[id]?.relation ?? 0), 0) / FOCUS_IDS.length;
    case 'conflicts':
      return state.diplomacy.conflicts.length;
    case 'sanctionsOnIndia':
      return state.diplomacy.treaties.filter((t) => t.type === 'sanctions' && t.parties[1] === 'IND').length;
    case 'foodShortage':
      return unmetShare(state, ['food', 'grain']);
    case 'fuelShortage':
      return unmetShare(state, ['fuel', 'coal', 'gas']);
    default:
      return ministryEfficiency(state, stat.slice('efficiency.'.length) as MinistryId);
  }
}
