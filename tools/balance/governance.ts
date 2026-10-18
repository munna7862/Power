import {
  consumption,
  COVERAGE_AREAS,
  coverage,
  GOODS,
  nominalGdp,
  outstanding,
  policeRatio,
  production,
  REGIONS,
  type GameState,
} from '../../src/sim';
import type { Kpi, RunResult } from './simulate';

/** What the hands-on screens leave behind at the end of a run (Sprint 8.9). */
export interface GovernanceStats {
  /** Mean coverage over every region and area. */
  coverage: number;
  /** Production over demand, minus one: the grid's reserve margin. */
  powerMargin: number;
  /** Yearly value of private imports at today's world prices, as a share of GDP. */
  importShare: number;
  /** Monthly profit of state plants, ₹ crore. */
  stateProfit: number;
  /** The thinnest region's police presence against the opening force. */
  police: number;
  /** Loans outstanding over annual GDP. */
  loanBurden: number;
  /** Loan repayments missed, from the inbox. */
  missed: number;
}

export function governanceStats(state: GameState): GovernanceStats {
  const cells = REGIONS.flatMap((r) => COVERAGE_AREAS.map((a) => coverage(state, r, a)));
  return {
    coverage: cells.reduce((s, v) => s + v, 0) / cells.length,
    powerMargin: production(state) / consumption(state) - 1,
    importShare:
      (12 * GOODS.reduce((s, g) => s + state.industry.last.imports[g] * state.market.prices[g], 0)) /
      nominalGdp(state.economy),
    stateProfit: state.industry.last.stateProfit,
    police: Math.min(...REGIONS.map((r) => policeRatio(state, r))),
    loanBurden: outstanding(state) / nominalGdp(state.economy),
    missed: state.log.filter((e) => e.title === 'Loan repayment missed').length,
  };
}

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);

export function meanStats(runs: RunResult[]): GovernanceStats {
  const all = runs.map((r) => governanceStats(r.final));
  const field = (k: keyof GovernanceStats) => mean(all.map((s) => s[k]));
  return {
    coverage: field('coverage'),
    powerMargin: field('powerMargin'),
    importShare: field('importShare'),
    stateProfit: field('stateProfit'),
    police: field('police'),
    loanBurden: field('loanBurden'),
    missed: all.reduce((s, x) => s + x.missed, 0),
  };
}

const percent = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * Sprint 8.9 bands on the hands-on screens, over the balanced bot's completed terms on Normal: it must leave the
 * country better served, powered, supplied and policed than it found it, without leaning on loans.
 */
export function evaluateGovernance(results: RunResult[], opening: GovernanceStats): Kpi[] {
  const runs = results.filter((r) => r.bot === 'balanced' && r.endedInYear === null);
  const passive = results.filter((r) => r.bot === 'passive');
  const stats = runs.map((r) => governanceStats(r.final));
  const m = meanStats(runs);
  const share = (test: (s: GovernanceStats) => boolean) => stats.filter(test).length / Math.max(1, stats.length);
  const thinPolice = share((s) => s.police >= 0.95);
  const shortOfPower = stats.filter((s) => s.powerMargin < 0).length;
  const heavy = stats.filter((s) => s.loanBurden > 0.01).length;
  return [
    {
      id: 'coverage-grows',
      description:
        'Balanced terms end with mean coverage at least 1 point above the opening network, and above the passive bot',
      pass: runs.length > 0 && m.coverage >= opening.coverage + 0.01 && m.coverage > meanStats(passive).coverage,
      detail: `${percent(m.coverage)} vs ${percent(opening.coverage)} at the start, ${percent(meanStats(passive).coverage)} passive`,
    },
    {
      id: 'grid-positive',
      description: 'No balanced term ends with a power shortfall',
      pass: shortOfPower === 0,
      detail: `${shortOfPower} runs; mean reserve margin ${percent(m.powerMargin)}`,
    },
    {
      id: 'trade-balance',
      description: 'Balanced terms end with the goods import bill no larger a share of GDP than at the start',
      pass: m.importShare <= opening.importShare,
      detail: `${percent(m.importShare)} of GDP vs ${percent(opening.importShare)}`,
    },
    {
      id: 'industry-profit',
      description: "Balanced terms end with state plants' monthly profit at or above the opening",
      pass: m.stateProfit >= opening.stateProfit,
      detail: `₹${Math.round(m.stateProfit)} vs ₹${Math.round(opening.stateProfit)} crore a month`,
    },
    {
      id: 'police-per-capita',
      description: 'Every region keeps at least 95% of the opening police per head in ≥ 90% of balanced terms',
      pass: thinPolice >= 0.9,
      detail: `${(thinPolice * 100).toFixed(0)}% of runs; thinnest region ${percent(m.police)} on average`,
    },
    {
      id: 'loan-burden',
      description: 'Balanced terms end owing at most 1% of GDP in loans and never miss a repayment',
      pass: heavy === 0 && m.missed === 0,
      detail: `${heavy} runs above 1%, ${m.missed} missed repayments`,
    },
  ];
}
