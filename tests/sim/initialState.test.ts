import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IDEOLOGY,
  DEFAULT_PRESIDENT_NAME,
  DEFAULT_STRATEGY,
  MINISTRIES,
  SCHEMA_VERSION,
  debtToGdp,
  nominalGdp,
  resolve,
  type GameState,
} from '../../src/sim';
import { newGame } from '../helpers';

describe('createInitialState', () => {
  it('starts on 1 January of the requested year at tick 0', () => {
    const state = newGame({ startYear: 2031 });
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.clock).toEqual({ tick: 0, date: { year: 2031, month: 1, day: 1 } });
    expect(state.meta.startDate).toEqual({ year: 2031, month: 1, day: 1 });
  });

  it('posts a swearing-in message to the inbox', () => {
    const state = newGame();
    expect(state.log).toHaveLength(1);
    expect(state.log[0]).toMatchObject({ title: 'Sworn in as President', read: false, severity: 'info' });
  });

  it('scales starting conditions by difficulty', () => {
    const easy = newGame({ difficulty: 'easy' });
    const normal = newGame({ difficulty: 'normal' });
    const hard = newGame({ difficulty: 'hard' });
    expect(easy.nation.treasury).toBeGreaterThan(normal.nation.treasury);
    expect(normal.nation.treasury).toBeGreaterThan(hard.nation.treasury);
    expect(easy.nation.approval).toBeGreaterThan(hard.nation.approval);

    const revenue = (s: GameState) => resolve(s.modifiers, 'economy.revenue', 100).total;
    expect(revenue(easy)).toBeGreaterThan(revenue(normal));
    expect(revenue(hard)).toBeLessThan(revenue(normal));
    const approval = (s: GameState) => resolve(s.modifiers, 'politics.approvalTarget', 55).total;
    expect(approval(hard) - approval(normal)).toBe(-5);
    expect(debtToGdp(hard.economy)).toBeGreaterThan(debtToGdp(easy.economy));
  });

  it('opens with a calibrated economy close to India today', () => {
    const { economy } = newGame();
    expect(nominalGdp(economy)).toBe(33_000_000);
    expect(debtToGdp(economy)).toBeCloseTo(0.56);
    expect(economy.inflation).toBe(0.05);
    expect(economy.unemployment).toBe(0.078);
    expect(economy.lastMonth).toBeNull();
  });

  it('appoints a full, mediocre opening cabinet with three candidates per ministry', () => {
    const { cabinet } = newGame();
    for (const m of MINISTRIES) {
      const minister = cabinet.ministers[m];
      expect(minister).not.toBeNull();
      expect(minister?.competence).toBeGreaterThanOrEqual(35);
      expect(minister?.competence).toBeLessThanOrEqual(60);
      expect(cabinet.candidates[m]).toHaveLength(3);
    }
    const names = MINISTRIES.flatMap((m) => [cabinet.ministers[m]?.name, ...cabinet.candidates[m].map((c) => c.name)]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('applies the chosen ideology and strategy as permanent modifiers', () => {
    const state = newGame({ ideology: 'technocracy', strategy: 'industrial' });
    expect(state.politics).toMatchObject({ ideology: 'technocracy', strategy: 'industrial' });
    expect(
      state.modifiers.filter((m) => m.source === 'ideology').every((m) => m.label === 'Ideology: Technocracy'),
    ).toBe(true);
    expect(state.modifiers.some((m) => m.source === 'strategy' && m.target === 'economy.growth.industry')).toBe(true);
    expect(newGame().politics).toMatchObject({ ideology: DEFAULT_IDEOLOGY, strategy: DEFAULT_STRATEGY });
  });

  it('computes opening voter satisfaction instead of placeholders', () => {
    const { satisfaction } = newGame().politics;
    expect(satisfaction.jobs).toBeCloseTo(47.8, 0);
    expect(Object.values(satisfaction).some((v) => v !== 50)).toBe(true);
  });

  it('gives modifiers unique ids and keeps nextId ahead of them', () => {
    const state = newGame({ difficulty: 'hard' });
    const ids = state.modifiers.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.nextId).toBeGreaterThan(ids.length);
  });

  it('normalises the president name', () => {
    expect(newGame({ presidentName: '  Asha   Rao  ' }).meta.presidentName).toBe('Asha Rao');
    expect(newGame({ presidentName: '   ' }).meta.presidentName).toBe(DEFAULT_PRESIDENT_NAME);
    expect(newGame({ presidentName: 'x'.repeat(80) }).meta.presidentName).toHaveLength(40);
  });

  it('rejects non-integer seeds and years', () => {
    expect(() => newGame({ seed: 1.5 })).toThrow(/Seed/);
    expect(() => newGame({ startYear: Number.NaN })).toThrow(/Start year/);
  });

  it('stores the seed as an unsigned 32-bit integer', () => {
    expect(newGame({ seed: -1 }).meta.seed).toBe(0xffffffff);
  });
});
