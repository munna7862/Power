import { MINISTRY_CONTENT } from '../content';
import { MINISTRIES, TAXES, type MinistryId, type TaxId } from '../content/ids';
import { ALLOCATION_LIMITS, BUDGET_COOLDOWN_DAYS, MAX_TAX_STEP, TAX_LIMITS } from '../economy/constants';
import { addDays, formatDate, type GameDate } from '../engine/calendar';
import { addTimedModifier } from '../politics/policy';
import { appendLog } from '../state/log';
import type { BudgetState, GameState } from '../state/types';

export interface BudgetProposal {
  taxRates: Record<TaxId, number>;
  allocations: Record<MinistryId, number>;
}

const EPSILON = 1e-9;

/** Date on which the next budget may be enacted, or null if one can be enacted now. */
export function nextBudgetDate(state: GameState): GameDate | null {
  const last = state.budget.lastEnactedTick;
  if (last === null || state.clock.tick - last >= BUDGET_COOLDOWN_DAYS) return null;
  return addDays(state.clock.date, BUDGET_COOLDOWN_DAYS - (state.clock.tick - last));
}

export function allocationBounds(ministry: MinistryId): { min: number; max: number } {
  const d = MINISTRY_CONTENT[ministry].defaultAllocation;
  return { min: d * ALLOCATION_LIMITS.min, max: d * ALLOCATION_LIMITS.max };
}

/** Returns the first problem with a proposal, or null if it is valid. */
export function validateBudget(state: GameState, proposal: BudgetProposal): string | null {
  const next = nextBudgetDate(state);
  if (next) return `A budget was enacted recently. The next one can be enacted on ${formatDate(next)}.`;
  for (const tax of TAXES) {
    const rate = proposal.taxRates[tax];
    const { min, max } = TAX_LIMITS[tax];
    if (!Number.isFinite(rate) || rate < min - EPSILON || rate > max + EPSILON) {
      return `The ${tax} tax rate must be between ${Math.round(min * 100)}% and ${Math.round(max * 100)}%.`;
    }
    if (Math.abs(rate - state.budget.taxRates[tax]) > MAX_TAX_STEP + EPSILON) {
      return `The ${tax} tax can change by at most ${Math.round(MAX_TAX_STEP * 100)} points per budget.`;
    }
  }
  for (const m of MINISTRIES) {
    const value = proposal.allocations[m];
    const { min, max } = allocationBounds(m);
    if (!Number.isFinite(value) || value < min - EPSILON || value > max + EPSILON) {
      return `${MINISTRY_CONTENT[m].shortName} funding is outside the allowed range.`;
    }
  }
  return null;
}

/**
 * Immediate political reaction to the announcement: tax rises sting for six
 * months, tax cuts give a short honeymoon. The lasting effect comes through the
 * "Tax burden" approval factor.
 */
export function announcementEffect(before: BudgetState['taxRates'], after: BudgetState['taxRates']): number {
  const visible =
    (after.income - before.income) * 1.0 + (after.gst - before.gst) * 1.0 + (after.corporate - before.corporate) * 0.3;
  return visible > 0 ? -40 * visible : -20 * visible;
}

export function enactBudget(state: GameState, proposal: BudgetProposal): GameState {
  const effect = announcementEffect(state.budget.taxRates, proposal.taxRates);
  let next: GameState = {
    ...state,
    budget: {
      taxRates: { ...proposal.taxRates },
      allocations: { ...proposal.allocations },
      lastEnactedTick: state.clock.tick,
    },
  };
  if (Math.abs(effect) >= 0.05) {
    next = addTimedModifier(
      next,
      {
        source: 'budget',
        label: effect < 0 ? 'Tax rise backlash' : 'Tax cut goodwill',
        target: 'politics.approvalTarget',
        kind: 'add',
        value: Math.round(effect * 10) / 10,
      },
      effect < 0 ? 180 : 90,
    );
  }
  return appendLog(next, {
    severity: 'info',
    title: 'Budget enacted',
    body: 'The new tax rates and ministry allocations take effect from the next monthly settlement.',
  });
}
