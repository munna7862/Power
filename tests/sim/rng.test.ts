import { describe, expect, it } from 'vitest';
import { Rng, seedRng } from '../../src/sim/engine/rng';

const draw = (seed: number, n: number) => {
  const rng = new Rng(seedRng(seed));
  return Array.from({ length: n }, () => rng.next());
};

describe('seeded RNG', () => {
  it('produces the same sequence for the same seed', () => {
    expect(draw(42, 100)).toEqual(draw(42, 100));
  });

  it('produces different sequences for different seeds', () => {
    expect(draw(42, 10)).not.toEqual(draw(43, 10));
  });

  it('stays within [0, 1) and is roughly uniform', () => {
    const values = draw(7, 10_000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('resumes the sequence exactly from a captured state', () => {
    const rng = new Rng(seedRng(99));
    rng.next();
    rng.next();
    const resumed = new Rng(rng.state);
    expect(resumed.next()).toBe(rng.next());
  });

  it('does not mutate the state array it was created from', () => {
    const state = seedRng(1);
    const copy = [...state];
    new Rng(state).next();
    expect(state).toEqual(copy);
  });

  it('supports ranges, integers and chances', () => {
    const rng = new Rng(seedRng(5));
    for (let i = 0; i < 1000; i++) {
      const r = rng.range(-2, 3);
      expect(r).toBeGreaterThanOrEqual(-2);
      expect(r).toBeLessThan(3);
      const n = rng.int(1, 6);
      expect(Number.isInteger(n) && n >= 1 && n <= 6).toBe(true);
    }
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });
});
