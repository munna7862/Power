import {
  APPROVAL_FACTORS,
  COVERAGE_AREAS,
  GOODS,
  MINISTRIES,
  REGIONS,
  type ApprovalFactor,
  type CoverageArea,
  type GoodId,
  type MinistryId,
  type RegionId,
} from '../content/ids';
import { UNDERFUNDED_BELOW } from '../departments/constants';
import { departmentFunding } from '../departments/quality';
import { debtToGdp } from '../economy/model';
import { shortfall } from '../energy/grid';
import { coverage } from '../infrastructure/coverage';
import { policeRatio } from '../police/strength';
import type { GameState, LoanLender } from '../state/types';

/**
 * The advisor (Sprint 8.8): the most urgent problems, worst first, each read from the same formula that drives it
 * (approval satisfaction, department funding, the grid, the goods settlement, coverage, policing, forces' funding,
 * loans and debt). The simulation ranks them; the UI words them and opens the screen that fixes each.
 */

export type AdviceTopic =
  'approval' | 'department' | 'power' | 'shortage' | 'coverage' | 'police' | 'unrest' | 'forces' | 'loan' | 'debt';

export interface Advice {
  topic: AdviceTopic;
  /** Urgency, higher first. */
  score: number;
  /** The figure the warning is about (a share, a score or days, by topic). */
  value: number;
  factor?: ApprovalFactor;
  department?: MinistryId;
  good?: GoodId;
  area?: CoverageArea;
  region?: RegionId;
  lender?: LoanLender;
}

/** Thresholds below (or above) which the advisor speaks up; none is crossed at the start of a game. */
export const ADVICE = {
  satisfaction: 40,
  coverage: 0.45,
  police: 0.9,
  unrest: 55,
  forcesFunding: 0.95,
  loanDays: 90,
  debt: 0.8,
} as const;

const lowest = <T>(items: readonly T[], value: (item: T) => number): { item: T; value: number } => {
  let best = { item: items[0] as T, value: value(items[0] as T) };
  for (const item of items.slice(1)) {
    const v = value(item);
    if (v < best.value) best = { item, value: v };
  }
  return best;
};

export function advise(state: GameState): Advice[] {
  const out: Advice[] = [];

  const worst = lowest(APPROVAL_FACTORS, (f) => state.politics.satisfaction[f]);
  if (worst.value < ADVICE.satisfaction) {
    out.push({
      topic: 'approval',
      score: 50 + (ADVICE.satisfaction - worst.value),
      value: worst.value,
      factor: worst.item,
    });
  }

  for (const m of MINISTRIES) {
    const funding = departmentFunding(state, m);
    if (funding < UNDERFUNDED_BELOW) {
      const months = state.departments.underfundedMonths[m];
      out.push({ topic: 'department', score: 55 + 5 * months, value: funding, department: m });
    }
  }

  const short = shortfall(state);
  if (short > 0) out.push({ topic: 'power', score: 60 + 200 * short, value: short });

  for (const g of GOODS) {
    const missing = state.industry.last.shortage[g];
    if (missing > 0) {
      const share = missing / Math.max(missing, state.industry.last.demand[g]);
      out.push({ topic: 'shortage', score: 50 + 100 * share, value: share, good: g });
    }
  }

  for (const region of REGIONS) {
    const area = lowest(COVERAGE_AREAS, (a) => coverage(state, region, a));
    if (area.value < ADVICE.coverage) {
      out.push({
        topic: 'coverage',
        score: 40 + 100 * (ADVICE.coverage - area.value),
        value: area.value,
        area: area.item,
        region,
      });
    }
    const police = policeRatio(state, region);
    if (police < ADVICE.police) {
      out.push({ topic: 'police', score: 45 + 100 * (ADVICE.police - police), value: police, region });
    }
    const unrest = state.security.unrest[region];
    if (unrest > ADVICE.unrest) {
      out.push({ topic: 'unrest', score: 50 + (unrest - ADVICE.unrest), value: unrest, region });
    }
  }

  if (state.military.fundingRatio < ADVICE.forcesFunding) {
    const ratio = state.military.fundingRatio;
    out.push({ topic: 'forces', score: 45 + 100 * (ADVICE.forcesFunding - ratio), value: ratio });
  }

  for (const loan of state.economy.loans) {
    const days = loan.dueTick - state.clock.tick;
    if (days <= ADVICE.loanDays && loan.principal > state.nation.treasury) {
      out.push({ topic: 'loan', score: 80 + (ADVICE.loanDays - days) / 3, value: days, lender: loan.lender });
    }
  }

  const debt = debtToGdp(state.economy);
  if (debt > ADVICE.debt) out.push({ topic: 'debt', score: 45 + 100 * (debt - ADVICE.debt), value: debt });

  // A stable sort keeps the order above among equals, so the list never flickers.
  return out.sort((a, b) => b.score - a.score);
}
