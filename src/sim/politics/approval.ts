import { APPROVAL_FACTORS, type ApprovalFactor, type MinistryId } from '../content/ids';
import { DEFAULT_TAX_RATES } from '../economy/constants';
import { resolve, type Resolution } from '../engine/modifiers';
import { coverageEffect } from '../infrastructure/coverage';
import { rulesFor } from '../state/difficulty';
import type { GameState } from '../state/types';

/** How much each factor weighs in the approval target. Sums to 1. */
export const APPROVAL_WEIGHTS: Record<ApprovalFactor, number> = {
  jobs: 0.2,
  prices: 0.18,
  growth: 0.13,
  corruption: 0.11,
  livingStandards: 0.09,
  taxes: 0.1,
  services: 0.09,
  safety: 0.1,
};

export const APPROVAL_FACTOR_LABELS: Record<ApprovalFactor, string> = {
  jobs: 'Jobs',
  prices: 'Prices',
  growth: 'Economic growth',
  corruption: 'Clean government',
  livingStandards: 'Living standards',
  taxes: 'Tax burden',
  services: 'Public services',
  safety: 'Safety and order',
};

/** Ministries whose efficiency voters feel directly as "public services". */
export const SERVICE_MINISTRIES: readonly MinistryId[] = [
  'finance',
  'health',
  'education',
  'home',
  'agriculture',
  'disaster',
];

/** Approval below this for IMPEACHMENT_MONTHS consecutive months ends the game (on Normal; see impeachmentThreshold). */
export const IMPEACHMENT_THRESHOLD = 15;

/** The impeachment threshold for this game's difficulty. */
export const impeachmentThreshold = (state: Pick<GameState, 'meta'>): number => rulesFor(state).impeachmentThreshold;
export const IMPEACHMENT_MONTHS = 3;

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Voter satisfaction (0–100) with each factor, given the current state and ministry efficiencies. */
export function computeSatisfaction(
  state: Pick<GameState, 'economy' | 'budget' | 'security' | 'infrastructure' | 'nation'>,
  efficiency: Record<MinistryId, number>,
): Record<ApprovalFactor, number> {
  const { economy, budget, security } = state;
  const meanUnrest = Object.values(security.unrest).reduce((a, b) => a + b, 0) / Object.values(security.unrest).length;
  const t = budget.taxRates;
  const d = DEFAULT_TAX_RATES;
  const services =
    SERVICE_MINISTRIES.reduce((sum, m) => sum + Math.min(efficiency[m], 1.8), 0) / SERVICE_MINISTRIES.length;
  return {
    jobs: clamp(100 - (economy.unemployment - 0.02) * 900),
    prices: clamp(100 - Math.max(0, economy.inflation - 0.02) * 900),
    growth: clamp(50 + (economy.realGrowth - 0.05) * 1000),
    corruption: clamp(100 - economy.corruption),
    livingStandards: clamp(((economy.hdi - 0.45) / 0.35) * 100),
    taxes: clamp(
      60 -
        150 * (t.income - d.income) -
        50 * (t.corporate - d.corporate) -
        200 * (t.gst - d.gst) -
        30 * (t.customs - d.customs),
    ),
    // Ministries' efficiency and, since Phase 8, how much of the country its schools, clinics and roads reach.
    services: clamp(50 + 60 * (services - 1) + coverageEffect(state, 'services')),
    safety: clamp(100 - 0.8 * meanUnrest - 0.6 * security.terrorThreat),
  };
}

/** Weighted satisfaction plus modifiers (ideology, difficulty, scandals, reshuffles…). */
export function approvalTarget(
  state: Pick<GameState, 'modifiers'>,
  satisfaction: Record<ApprovalFactor, number>,
): Resolution {
  const base = APPROVAL_FACTORS.reduce((sum, f) => sum + APPROVAL_WEIGHTS[f] * satisfaction[f], 0);
  return resolve(state.modifiers, 'politics.approvalTarget', base);
}

/** The factors voters are least happy with, worst first. */
export function topIssues(satisfaction: Record<ApprovalFactor, number>, count = 3): ApprovalFactor[] {
  return [...APPROVAL_FACTORS].sort((a, b) => satisfaction[a] - satisfaction[b]).slice(0, count);
}
