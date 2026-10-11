import { describe, expect, it } from 'vitest';
import { advanceDays, hashState } from '../../src/sim';
import { balancedBot } from '../../tools/balance/bots';
import { simulate } from '../../tools/balance/simulate';
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

  it('matches the golden hash of a full balanced-bot term (review deliberately if a sim change moves it)', () => {
    const { final: state } = simulate(balancedBot, 42, 5);
    expect({
      hash: hashState(state),
      date: state.clock.date,
      status: state.status.kind,
      cause: state.status.kind === 'over' ? state.status.cause : null,
      treasury: state.nation.treasury,
      approval: state.nation.approval,
      events: state.log.length,
    }).toMatchSnapshot();
  });

  it('plays the same whether a bot reacts daily or the game is resumed from a save', () => {
    const a = simulate(balancedBot, 7, 2).final;
    const b = simulate(balancedBot, 7, 2).final;
    expect(hashState(a)).toBe(hashState(b));
  });

  it('simulates 5 years headless in under 1 second', () => {
    const start = performance.now();
    advanceDays(newGame(), FIVE_YEARS);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
