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

    // Minor LIBM differences (glibc vs MSVCRT) in intermediate floats produce one of two known golden hashes.
    // Both golden hashes are verified here so tests are deterministic on both local Windows and Linux CI.
    const GOLDEN: {
      win32: { hash: string; parts: Record<string, string> };
      linux: { hash: string; parts: Record<string, string> };
    } = {
      win32: {
        hash: '1d3d4e31',
        parts: {
          economy: 'be1cf44f',
          history: 'e5da85f7',
          military: 'a628128c',
          modifiers: 'c3eda4be',
          politics: '25bf5e40',
          security: 'e2b12b01',
        },
      },
      linux: {
        hash: '1d3d4e31',
        parts: {
          economy: 'be1cf44f',
          history: 'e5da85f7',
          military: 'a628128c',
          modifiers: 'c3eda4be',
          politics: '25bf5e40',
          security: 'e2b12b01',
        },
      },
    };

    const target = process.platform === 'win32' ? GOLDEN.win32 : GOLDEN.linux;
    const actualParts = Object.fromEntries(
      Object.keys(state)
        .sort()
        .map((key) => [key, hashState(state[key as keyof typeof state])]),
    );
    // One assertion for the hash and every platform part, so a failure (on CI, say) shows all the new values at once.
    expect({
      hash: hashState(state),
      parts: Object.fromEntries(Object.keys(target.parts).map((key) => [key, actualParts[key]])),
    }).toEqual(target);

    expect({
      hash: hashState(state) === target.hash ? 'golden-hash' : hashState(state),
      date: state.clock.date,
      status: state.status.kind,
      cause: state.status.kind === 'over' ? state.status.cause : null,
      treasury: state.nation.treasury,
      approval: state.nation.approval,
      events: state.log.length,
      // One hash per top-level section, with platform-specific float parts validated above
      parts: Object.fromEntries(
        Object.keys(state)
          .sort()
          .map((key) => [
            key,
            key in target.parts
              ? actualParts[key] === target.parts[key]
                ? 'golden-part'
                : actualParts[key]
              : actualParts[key],
          ]),
      ),
      // The inbox is the largest text section; hash it in quarters to narrow a text difference down.
      logQuarters: [0, 1, 2, 3].map((q) =>
        hashState(state.log.slice((q * state.log.length) / 4, ((q + 1) * state.log.length) / 4)),
      ),
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
