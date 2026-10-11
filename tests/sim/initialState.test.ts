import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESIDENT_NAME, SCHEMA_VERSION, resolve, type GameState } from '../../src/sim';
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

    const revenue = (s: GameState) => resolve(s.modifiers, 'economy.monthlyRevenue', 100).total;
    expect(revenue(easy)).toBeGreaterThan(revenue(normal));
    expect(revenue(hard)).toBeLessThan(revenue(normal));
    expect(resolve(hard.modifiers, 'politics.approvalTarget', 55).total).toBe(50);
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
