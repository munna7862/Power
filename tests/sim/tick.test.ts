import { describe, expect, it } from 'vitest';
import { advanceDays, HISTORY_LIMIT, LOG_LIMIT, tick, type GameState } from '../../src/sim';
import type { System } from '../../src/sim/engine/system';
import { appendLog } from '../../src/sim/state/log';
import { SYSTEMS } from '../../src/sim/systems';
import { calm, deepFreeze, newGame } from '../helpers';

const recorder = (calls: string[]): System[] =>
  (['daily', 'monthly', 'yearly'] as const).map((cadence) => ({
    id: cadence,
    cadence,
    run: (state: GameState) => {
      calls.push(`${cadence}@${state.clock.date.month}/${state.clock.date.day}`);
      return state;
    },
  }));

describe('engine.tick', () => {
  it('advances the clock by one day and does not mutate the input', () => {
    const start = deepFreeze(newGame());
    const next = tick(start);
    expect(next.clock).toEqual({ tick: 1, date: { year: 2026, month: 1, day: 2 } });
    expect(start.clock.tick).toBe(0);
  });

  it('runs daily systems every tick and monthly/yearly systems only when their period closes', () => {
    const calls: string[] = [];
    const state = newGame({ startYear: 2026 });
    advanceDays({ ...state, clock: { tick: 0, date: { year: 2026, month: 12, day: 30 } } }, 3, recorder(calls));
    expect(calls).toEqual(['daily@12/31', 'daily@1/1', 'monthly@1/1', 'yearly@1/1', 'daily@1/2']);
  });

  it('keeps the whole simulation immutable across months and years', () => {
    const start = deepFreeze(newGame());
    expect(() => advanceDays(start, 400)).not.toThrow();
  });

  it('settles the economy monthly, not daily', () => {
    const start = newGame();
    const day30 = advanceDays(start, 30);
    expect(day30.nation.treasury).toBe(start.nation.treasury);
    expect(day30.economy).toEqual(start.economy);
    const feb1 = tick(day30);
    expect(feb1.clock.date).toEqual({ year: 2026, month: 2, day: 1 });
    expect(feb1.economy.lastMonth?.balance).toBeLessThan(0);
    expect(feb1.economy.priceIndex).toBeGreaterThan(1);
  });

  it('stops time once the game is over', () => {
    const over: GameState = {
      ...newGame(),
      status: { kind: 'over', cause: 'impeachment', date: { year: 2026, month: 1, day: 1 }, title: 'x', summary: 'y' },
    };
    expect(tick(over)).toBe(over);
    expect(advanceDays(over, 100)).toBe(over);
  });

  it('records a monthly snapshot labelled with the month that closed', () => {
    const state = advanceDays(newGame(), 31);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.month).toEqual({ year: 2026, month: 1, day: 1 });
  });

  it('caps history at HISTORY_LIMIT months', () => {
    const state = calm(newGame(), 366 * 11);
    expect(state.history).toHaveLength(HISTORY_LIMIT);
  });

  it('posts an annual report every 1 January', () => {
    const state = advanceDays(newGame(), 365);
    const report = state.log.find((e) => e.title === 'Annual report 2026');
    expect(report).toBeDefined();
    expect(report?.date).toEqual({ year: 2027, month: 1, day: 1 });
    expect(report?.body).toMatch(/(surplus|deficit) of ₹[\d,]+ crore/);
  });

  it('caps the inbox at LOG_LIMIT entries, dropping the oldest', () => {
    let state = newGame();
    for (let i = 0; i < LOG_LIMIT + 5; i++) state = appendLog(state, { severity: 'info', title: `#${i}`, body: '' });
    expect(state.log).toHaveLength(LOG_LIMIT);
    expect(state.log[0]?.title).toBe('#5');
  });

  it('keeps approval within 0–100 and drags it down in a crisis', () => {
    const start = newGame();
    const crisis: GameState = {
      ...start,
      economy: { ...start.economy, inflation: 0.3, unemployment: 0.25, corruption: 90 },
    };
    const later = advanceDays(crisis, 120);
    expect(later.nation.approval).toBeGreaterThanOrEqual(0);
    expect(later.nation.approval).toBeLessThan(start.nation.approval - 10);
  });

  it('expires timed modifiers', () => {
    const base = newGame();
    const state: GameState = {
      ...base,
      modifiers: [
        ...base.modifiers,
        {
          id: 'temp',
          source: 'test',
          label: 'Temporary boost',
          target: 'economy.revenue',
          kind: 'mult',
          value: 0.5,
          expiresAtTick: 10,
        },
      ],
    };
    expect(advanceDays(state, 9).modifiers.some((m) => m.id === 'temp')).toBe(true);
    expect(advanceDays(state, 10).modifiers.some((m) => m.id === 'temp')).toBe(false);
  });

  it('registers systems in the documented order', () => {
    expect(SYSTEMS.map((s) => s.id)).toEqual([
      'modifier-expiry',
      'economy',
      'fiscal',
      'society',
      'unrest',
      'terror',
      'plots',
      'leadership',
      'investigations',
      'cabinet',
      'military-monthly',
      'military-daily',
      'diplomacy-monthly',
      'events',
      'approval',
      'history',
      'annual-report',
      'candidate-refresh',
    ]);
  });
});
