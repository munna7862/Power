import { describe, expect, it } from 'vitest';
import {
  advanceDays,
  allEfficiencies,
  APPROVAL_FACTORS,
  APPROVAL_WEIGHTS,
  approvalTarget,
  computeSatisfaction,
  dispatch,
  IMPEACHMENT_MONTHS,
  policyCooldownDays,
  POLICY_CHANGE_COST,
  topIssues,
  type GameState,
} from '../../src/sim';
import { newGame } from '../helpers';

describe('approval model', () => {
  it('has weights that sum to 1', () => {
    expect(APPROVAL_FACTORS.reduce((s, f) => s + APPROVAL_WEIGHTS[f], 0)).toBeCloseTo(1);
  });

  it('starts near the opening approval and lists the weakest factors as top issues', () => {
    const state = newGame();
    const satisfaction = computeSatisfaction(state, allEfficiencies(state));
    const target = approvalTarget(state, satisfaction).total;
    expect(target).toBeGreaterThan(50);
    expect(target).toBeLessThan(65);
    const issues = topIssues(satisfaction);
    expect(issues).toHaveLength(3);
    expect(satisfaction[issues[0]!]).toBe(Math.min(...Object.values(satisfaction)));
  });

  it('punishes inflation, unemployment and heavy taxes', () => {
    const state = newGame();
    const eff = allEfficiencies(state);
    const base = computeSatisfaction(state, eff);
    const bad = computeSatisfaction(
      {
        economy: { ...state.economy, inflation: 0.12, unemployment: 0.15 },
        budget: { ...state.budget, taxRates: { ...state.budget.taxRates, income: 0.35, gst: 0.25 } },
      },
      eff,
    );
    expect(bad.prices).toBeLessThan(base.prices - 40);
    expect(bad.jobs).toBeLessThan(base.jobs - 40);
    expect(bad.taxes).toBeLessThan(base.taxes - 30);
  });

  it('impeaches the President after three straight months below 15%', () => {
    const start = newGame();
    const doomed: GameState = {
      ...start,
      nation: { ...start.nation, approval: 5 },
      economy: { ...start.economy, inflation: 0.45, unemployment: 0.35, corruption: 100 },
    };
    const later = advanceDays(doomed, 365);
    expect(later.status).toMatchObject({ kind: 'over', cause: 'impeachment', title: 'Impeached' });
    expect(later.politics.lowApprovalMonths).toBe(IMPEACHMENT_MONTHS);
    expect(later.log.at(-1)).toMatchObject({ severity: 'critical', title: 'Impeached' });
    expect(dispatch(later, { type: 'SET_STRATEGY', strategy: 'agrarian' })).toMatchObject({ ok: false });
    expect(dispatch(later, { type: 'MARK_ALL_LOG_READ' }).ok).toBe(true);
  });

  it('resets the impeachment countdown when approval recovers', () => {
    const start = newGame();
    const later = advanceDays({ ...start, politics: { ...start.politics, lowApprovalMonths: 2 } }, 31);
    expect(later.politics.lowApprovalMonths).toBe(0);
    expect(later.status.kind).toBe('playing');
  });
});

describe('ideology and strategy', () => {
  it('swaps ideology modifiers and charges a temporary approval cost', () => {
    const state = newGame({ ideology: 'liberalism' });
    const result = dispatch(state, { type: 'SET_IDEOLOGY', ideology: 'socialism' });
    expect(result.ok).toBe(true);
    const next = result.state;
    expect(next.politics.ideology).toBe('socialism');
    expect(next.politics.ideologyChangedTick).toBe(0);
    const ideologyLabels = new Set(next.modifiers.filter((m) => m.source === 'ideology').map((m) => m.label));
    expect([...ideologyLabels]).toEqual(['Ideology: Socialism']);
    expect(next.modifiers.find((m) => m.source === 'ideology-change')).toMatchObject({
      value: POLICY_CHANGE_COST.ideology.value,
      expiresAtTick: POLICY_CHANGE_COST.ideology.days,
    });
  });

  it('allows one change of ideology per year', () => {
    const changed = dispatch(newGame(), { type: 'SET_IDEOLOGY', ideology: 'socialism' }).state;
    expect(policyCooldownDays(changed, 'ideology')).toBe(365);
    const soon = dispatch(advanceDays(changed, 100), { type: 'SET_IDEOLOGY', ideology: 'technocracy' });
    expect(soon).toMatchObject({ ok: false, error: expect.stringContaining('1 Jan 2027') });
    expect(dispatch(advanceDays(changed, 365), { type: 'SET_IDEOLOGY', ideology: 'technocracy' }).ok).toBe(true);
  });

  it('changes strategy independently of ideology', () => {
    const result = dispatch(newGame(), { type: 'SET_STRATEGY', strategy: 'industrial' });
    expect(result.state.politics.strategy).toBe('industrial');
    expect(policyCooldownDays(result.state, 'ideology')).toBe(0);
    expect(result.state.modifiers.some((m) => m.source === 'strategy' && m.target === 'economy.growth.energy')).toBe(
      true,
    );
  });

  it('rejects re-selecting the current ideology or an unknown one', () => {
    const state = newGame();
    expect(dispatch(state, { type: 'SET_IDEOLOGY', ideology: state.politics.ideology })).toMatchObject({ ok: false });
    expect(dispatch(state, { type: 'SET_STRATEGY', strategy: 'mercantile' as never })).toMatchObject({ ok: false });
  });

  it('makes an agrarian strategy grow farming faster than an industrial one', () => {
    const farm = advanceDays(newGame({ strategy: 'agrarian' }), 365 * 2).economy.sectors.agriculture.output;
    const factory = advanceDays(newGame({ strategy: 'industrial' }), 365 * 2).economy.sectors.agriculture.output;
    expect(farm).toBeGreaterThan(factory);
  });
});
