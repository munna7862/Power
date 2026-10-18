import { describe, expect, it } from 'vitest';
import { advanceDays, DEFAULT_OPTIONS, MAX_RANDOM_EVENTS_PER_MONTH, type GameState } from '../../src/sim';
import { randomEventsThisMonth } from '../../src/sim/events/engine';
import { MIGRATIONS } from '../../src/sim/save/migrations';
import { newGame } from '../helpers';

/** Plays a year a day at a time and returns the most random events seen in one calendar month. */
function busiestMonth(state: GameState): number {
  let next = state;
  let most = 0;
  for (let day = 0; day < 365 && next.status.kind === 'playing'; day++) {
    next = advanceDays(next, 1);
    most = Math.max(most, randomEventsThisMonth(next));
  }
  return most;
}

describe('Calm months', () => {
  it('is off by default', () => {
    expect(DEFAULT_OPTIONS.calmMonths).toBe(false);
    expect(newGame().meta.options.calmMonths).toBe(false);
  });

  it('lets at most one random event fire in a calendar month', () => {
    for (const seed of [1, 2, 3])
      expect(busiestMonth(newGame({ seed, options: { calmMonths: true } }))).toBeLessThanOrEqual(
        MAX_RANDOM_EVENTS_PER_MONTH,
      );
  });

  it('leaves the standard game as busy as it was', () => {
    const busiest = Math.max(...[1, 2, 3].map((seed) => busiestMonth(newGame({ seed }))));
    expect(busiest).toBeGreaterThan(MAX_RANDOM_EVENTS_PER_MONTH);
  });

  it('counts only this calendar month', () => {
    const state = newGame();
    const tick = 40;
    const dated = {
      ...state,
      clock: { tick, date: { year: 2026, month: 2, day: 10 } },
      events: { ...state.events, fired: { a: [30, 31], b: [25], c: [40] } },
    };
    // The month began on tick 31 (day 1): ticks 31 and 40 count, 25 and 30 belong to January.
    expect(randomEventsThisMonth(dated)).toBe(2);
  });
});

describe('v16 → v17 migration', () => {
  it('starts a game in progress without Calm months', () => {
    const v17 = MIGRATIONS[16]!({
      schemaVersion: 16,
      meta: { options: { noWars: true, noRiots: false, tutorial: false, regions: true } },
    }) as { schemaVersion: number; meta: { options: Record<string, boolean> } };
    expect(v17.schemaVersion).toBe(17);
    expect(v17.meta.options).toEqual({
      noWars: true,
      noRiots: false,
      tutorial: false,
      regions: true,
      calmMonths: false,
    });
  });
});
