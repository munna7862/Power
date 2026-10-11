import { describe, expect, it } from 'vitest';
import { advanceDays, hashState } from '../../src/sim';
import { newGame } from '../helpers';

const FIVE_YEARS = 365 * 5 + 1; // includes one leap day (2028)

describe('determinism', () => {
  it('produces an identical state for the same seed and inputs', () => {
    const a = advanceDays(newGame({ seed: 42 }), FIVE_YEARS);
    const b = advanceDays(newGame({ seed: 42 }), FIVE_YEARS);
    expect(hashState(a)).toBe(hashState(b));
  });

  it('diverges for a different seed', () => {
    const a = advanceDays(newGame({ seed: 42 }), 365);
    const b = advanceDays(newGame({ seed: 43 }), 365);
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('gives the same result whether played in one run or resumed from a mid-game state', () => {
    const straight = advanceDays(newGame(), 1000);
    const resumed = advanceDays(structuredClone(advanceDays(newGame(), 400)), 600);
    expect(hashState(resumed)).toBe(hashState(straight));
  });

  it('matches the 5-year golden hash (review deliberately if a sim change moves it)', () => {
    const state = advanceDays(newGame({ seed: 42 }), FIVE_YEARS);
    expect(state.clock.date).toEqual({ year: 2031, month: 1, day: 1 });
    expect({
      hash: hashState(state),
      treasury: state.nation.treasury,
      approval: state.nation.approval,
    }).toMatchSnapshot();
  });

  it('simulates 5 years headless in under 1 second', () => {
    const start = performance.now();
    advanceDays(newGame(), FIVE_YEARS);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
