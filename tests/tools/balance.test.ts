import { describe, expect, it } from 'vitest';
import { DEFAULT_TAX_RATES, TAXES } from '../../src/sim';
import { balancedBot, BOTS, greedyBot, passiveBot } from '../../tools/balance/bots';
import { evaluate, simulate } from '../../tools/balance/simulate';

describe('balance harness', () => {
  it('plays whole years month by month and records one row per year', () => {
    const run = simulate(passiveBot, 3, 2);
    expect(run.years.map((y) => y.year)).toEqual([1, 2]);
    expect(run.final.clock.date).toEqual({ year: 2028, month: 1, day: 1 });
    expect(run.endedInYear).toBeNull();
  });

  it('greedy bot raises every tax through the budget command', () => {
    const run = simulate(greedyBot, 2, 1);
    for (const t of TAXES) expect(run.final.budget.taxRates[t]).toBeGreaterThan(DEFAULT_TAX_RATES[t]);
  });

  it('balanced bot upgrades department services', () => {
    const run = simulate(balancedBot, 3, 1);
    expect(run.final.departments.stars.defence.armyCommand).toBeGreaterThan(2);
  });

  it('meets the Normal-difficulty KPI bands on a small sample', () => {
    const results = BOTS.flatMap((bot) => [1, 2, 3, 4, 5].map((seed) => simulate(bot, seed, 3)));
    const failing = evaluate(results, 3).filter((k) => !k.pass);
    expect(failing).toEqual([]);
  });
});

describe('war balance', () => {
  it('meets the war KPI bands on a small sample', async () => {
    const { evaluateWars, probeWars } = await import('../../tools/balance/wars');
    const failing = evaluateWars(probeWars(8, 240)).filter((k) => !k.pass);
    expect(failing).toEqual([]);
  });
});

describe('release balance (Phase 6)', () => {
  it('never lets a random event repeat more than the rule allows, and the options hold', async () => {
    const { probeOptions, worstRepeat } = await import('../../tools/balance/release');
    const { MAX_REPEATS, NO_RIOTS_UNREST_CAP } = await import('../../src/sim');
    const runs = [1, 2, 3].map((seed) => simulate(balancedBot, seed, 5));
    expect(worstRepeat(runs).fires).toBeLessThanOrEqual(MAX_REPEATS);
    expect(runs.every((r) => r.endedInYear !== null || r.cause === 'reelected' || r.cause === 'votedOut')).toBe(true);
    const options = probeOptions(2, 2);
    expect(options.warsWithNoWars).toBe(0);
    expect(options.peakUnrestWithNoRiots).toBeLessThanOrEqual(NO_RIOTS_UNREST_CAP);
    expect(options.riotEventsWithNoRiots).toBe(0);
  });
});
