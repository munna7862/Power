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

  it('balanced bot reshapes the cabinet in January', () => {
    const run = simulate(balancedBot, 3, 1);
    expect(run.final.log.some((e) => e.title.startsWith('New minister'))).toBe(true);
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
