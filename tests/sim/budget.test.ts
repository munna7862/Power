import { describe, expect, it } from 'vitest';
import {
  advanceDays,
  allocationBounds,
  BUDGET_COOLDOWN_DAYS,
  dispatch,
  MAX_TAX_STEP,
  nextBudgetDate,
  type BudgetProposal,
  type GameState,
} from '../../src/sim';
import { announcementEffect } from '../../src/sim/commands/budget';
import { deepFreeze, newGame } from '../helpers';

const proposal = (state: GameState, change: Partial<BudgetProposal['taxRates']> = {}): BudgetProposal => ({
  taxRates: { ...state.budget.taxRates, ...change },
  allocations: { ...state.budget.allocations },
});

describe('ENACT_BUDGET', () => {
  it('applies new rates and allocations and records the date', () => {
    const state = deepFreeze(newGame());
    const p = proposal(state, { income: 0.22 });
    p.allocations.health = state.budget.allocations.health * 2;
    const result = dispatch(state, { type: 'ENACT_BUDGET', proposal: p });
    expect(result.ok).toBe(true);
    expect(result.state.budget).toEqual({ ...p, lastEnactedTick: 0 });
    expect(result.state.log.at(-1)?.title).toBe('Budget enacted');
  });

  it('charges a temporary approval backlash for tax rises and goodwill for cuts', () => {
    const state = newGame();
    const rise = dispatch(state, { type: 'ENACT_BUDGET', proposal: proposal(state, { gst: 0.23 }) }).state;
    expect(rise.modifiers.find((m) => m.source === 'budget')).toMatchObject({
      label: 'Tax rise backlash',
      value: -2,
      expiresAtTick: 180,
    });
    const cut = dispatch(state, { type: 'ENACT_BUDGET', proposal: proposal(state, { income: 0.15 }) }).state;
    expect(cut.modifiers.find((m) => m.source === 'budget')).toMatchObject({ label: 'Tax cut goodwill', value: 1 });
    const spendingOnly = dispatch(state, { type: 'ENACT_BUDGET', proposal: proposal(state) }).state;
    expect(spendingOnly.modifiers.some((m) => m.source === 'budget')).toBe(false);
  });

  it('weighs visible taxes more than corporate tax in the announcement effect', () => {
    const base = newGame().budget.taxRates;
    expect(announcementEffect(base, { ...base, corporate: base.corporate + 0.05 })).toBeCloseTo(-0.6);
    expect(announcementEffect(base, { ...base, income: base.income + 0.05 })).toBeCloseTo(-2);
  });

  it('allows one budget per month', () => {
    const first = dispatch(newGame(), { type: 'ENACT_BUDGET', proposal: proposal(newGame()) }).state;
    expect(nextBudgetDate(first)).toEqual({ year: 2026, month: 1, day: 31 });
    const tooSoon = dispatch(advanceDays(first, 10), { type: 'ENACT_BUDGET', proposal: proposal(first) });
    expect(tooSoon).toMatchObject({ ok: false, error: expect.stringContaining('31 Jan 2026') });
    const later = advanceDays(first, BUDGET_COOLDOWN_DAYS);
    expect(nextBudgetDate(later)).toBeNull();
    expect(dispatch(later, { type: 'ENACT_BUDGET', proposal: proposal(later) }).ok).toBe(true);
  });

  it.each([
    ['a tax above its legal maximum', { corporate: 0.5 }, /between 10% and 45%/],
    ['a tax below its minimum', { gst: 0.01 }, /between 5% and 28%/],
    ['a step larger than five points', { income: 0.2 + MAX_TAX_STEP + 0.01 }, /at most 5 points/],
    ['a non-number', { customs: Number.NaN }, /customs/],
  ])('rejects %s', (_label, change, message) => {
    const state = newGame();
    const result = dispatch(state, { type: 'ENACT_BUDGET', proposal: proposal(state, change) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
    expect(result.state).toBe(state);
  });

  it('rejects allocations outside 25%–300% of the default', () => {
    const state = newGame();
    const { min, max } = allocationBounds('defence');
    for (const value of [min * 0.9, max * 1.1]) {
      const p = proposal(state);
      p.allocations.defence = value;
      expect(dispatch(state, { type: 'ENACT_BUDGET', proposal: p })).toMatchObject({
        ok: false,
        error: expect.stringContaining('Defence'),
      });
    }
  });
});
