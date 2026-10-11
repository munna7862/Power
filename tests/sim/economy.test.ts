import { describe, expect, it } from 'vitest';
import {
  allEfficiencies,
  debtToGdp,
  DEFAULT_TAX_RATES,
  explainGrowth,
  GROWTH_DRIVER_LABELS,
  sectorShare,
  MINISTRIES,
  MINISTRY_CONTENT,
  nominalGdp,
  projectMonth,
  SECTORS,
  TAX_LIMITS,
  TAXES,
  type GameState,
  type TaxId,
} from '../../src/sim';
import { expectedSectorGrowth } from '../../src/sim/economy/growth';
import { interestRateFor, ministryEfficiencyFor, taxYieldFactor } from '../../src/sim/economy/model';
import { calm, newGame } from '../helpers';

const withTaxes = (state: GameState, rate: (t: TaxId) => number): GameState => ({
  ...state,
  budget: {
    ...state.budget,
    taxRates: Object.fromEntries(TAXES.map((t) => [t, rate(t)])) as GameState['budget']['taxRates'],
  },
});

const allNumbersFinite = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value && typeof value === 'object') return Object.values(value).every(allNumbersFinite);
  return true;
};

describe('fiscal model', () => {
  it('raises roughly India-scale revenue and spending at default policy', () => {
    const p = projectMonth(newGame(), newGame().budget);
    const lakhCrorePerYear = (v: number) => (v * 12) / 100_000;
    expect(lakhCrorePerYear(p.revenue.income)).toBeCloseTo(12, 0);
    expect(lakhCrorePerYear(p.revenue.corporate)).toBeCloseTo(10, 0);
    expect(lakhCrorePerYear(p.revenue.gst)).toBeCloseTo(10, 0);
    expect(lakhCrorePerYear(p.totalRevenue)).toBeGreaterThan(35);
    expect(lakhCrorePerYear(p.totalExpenditure)).toBeGreaterThan(45);
    expect(p.balanceToGdp).toBeLessThan(-0.02);
    expect(p.balanceToGdp).toBeGreaterThan(-0.04);
  });

  it('has a Laffer curve: yield is 1 at default rates and shrinks per point at high rates', () => {
    for (const t of TAXES) expect(taxYieldFactor(t, DEFAULT_TAX_RATES[t])).toBeCloseTo(1);
    const revenueAt = (r: number) => r * taxYieldFactor('income', r);
    expect(revenueAt(0.3)).toBeGreaterThan(revenueAt(0.2));
    expect(revenueAt(0.45)).toBeLessThan(revenueAt(0.38));
  });

  it('collects more when a budget raises taxes and spends more when it raises allocations', () => {
    const state = newGame();
    const base = projectMonth(state, state.budget);
    const higherTax = projectMonth(state, { ...state.budget, taxRates: { ...state.budget.taxRates, gst: 0.23 } });
    expect(higherTax.revenue.gst).toBeGreaterThan(base.revenue.gst);
    const moreHealth = projectMonth(state, {
      ...state.budget,
      allocations: { ...state.budget.allocations, health: state.budget.allocations.health * 2 },
    });
    expect(moreHealth.expenditure.health).toBeCloseTo(base.expenditure.health * 2);
  });

  it('rates ministry efficiency from funding, competence and corruption', () => {
    const state = newGame();
    const minister = state.cabinet.ministers.health!;
    const withMinister = (m: typeof minister | null): GameState => ({
      ...state,
      cabinet: { ...state.cabinet, ministers: { ...state.cabinet.ministers, health: m } },
    });
    const allocation = MINISTRY_CONTENT.health.defaultAllocation;
    const star = withMinister({ ...minister, competence: 95, corruption: 0 });
    const crook = withMinister({ ...minister, competence: 95, corruption: 100 });
    const vacant = withMinister(null);
    expect(ministryEfficiencyFor(allocation, star, 'health')).toBeCloseTo(1.27);
    expect(ministryEfficiencyFor(allocation, crook, 'health')).toBeLessThan(1);
    expect(ministryEfficiencyFor(allocation, vacant, 'health')).toBeCloseTo(0.91);
    expect(ministryEfficiencyFor(allocation * 2, star, 'health')).toBeGreaterThan(1.7);
    expect(ministryEfficiencyFor(0, star, 'health')).toBe(0);
  });

  it('prices debt higher when it is large, inflation is high or deficits are big', () => {
    expect(interestRateFor(0.5, 0.04)).toBeCloseTo(0.065);
    expect(interestRateFor(0.9, 0.04)).toBeGreaterThan(0.1);
    expect(interestRateFor(0.5, 0.15)).toBeGreaterThan(0.12);
    expect(interestRateFor(0.5, 0.04, 0.1)).toBeGreaterThan(0.08);
  });
});

describe('economy over time', () => {
  it('grows at a plausible rate and keeps debt sustainable under default policy', () => {
    const later = calm(newGame(), 365 * 5 + 1);
    const growth = (nominalGdp(later.economy) / 33_000_000) ** (1 / 5) - 1;
    expect(growth).toBeGreaterThan(0.08);
    expect(growth).toBeLessThan(0.14);
    expect(later.economy.inflation).toBeLessThan(0.06);
    expect(debtToGdp(later.economy)).toBeLessThan(0.56);
    expect(later.nation.treasury).toBeGreaterThan(0);
  });

  it('turns permanent maximum taxes into a surplus with slower growth and more joblessness', () => {
    const start = withTaxes(newGame(), (t) => TAX_LIMITS[t].max);
    const later = calm(start, 365 * 2);
    expect(later.economy.lastMonth!.balance).toBeGreaterThan(0);
    expect(later.economy.realGrowth).toBeLessThan(0.055);
    expect(later.economy.unemployment).toBeGreaterThan(0.08);
  });

  it('turns permanent minimum taxes into deficits, inflation and dearer debt', () => {
    const start = withTaxes(newGame(), (t) => TAX_LIMITS[t].min);
    const later = calm(start, 365 * 2);
    expect(later.economy.lastMonth!.borrowed).toBeGreaterThan(0);
    expect(later.economy.inflation).toBeGreaterThan(0.1);
    expect(later.economy.interestRate).toBeGreaterThan(0.08);
  });

  it.each([
    ['maximum', (t: TaxId) => TAX_LIMITS[t].max],
    ['minimum', (t: TaxId) => TAX_LIMITS[t].min],
  ])('stays finite and within bounds after 50 years at %s taxes', (_label, rate) => {
    const start = withTaxes(newGame({ difficulty: 'hard' }), rate);
    const forced: GameState = { ...start, politics: { ...start.politics, lowApprovalMonths: -10_000 } };
    const later = calm(forced, 365 * 50);
    expect(allNumbersFinite(later)).toBe(true);
    expect(later.economy.inflation).toBeLessThanOrEqual(0.5);
    expect(later.economy.unemployment).toBeLessThanOrEqual(0.4);
    expect(later.economy.corruption).toBeLessThanOrEqual(100);
    expect(later.nation.approval).toBeGreaterThanOrEqual(0);
    for (const s of SECTORS) expect(later.economy.sectors[s].output).toBeGreaterThan(0);
  });

  it('repays debt once cash piles up above twice the reserve', () => {
    const start = newGame();
    const flush: GameState = { ...start, nation: { ...start.nation, treasury: 5_000_000 } };
    const feb1 = calm(flush, 31);
    expect(feb1.economy.lastMonth!.repaid).toBeGreaterThan(0);
    expect(feb1.economy.debt).toBeLessThan(start.economy.debt);
  });

  it('lowers corruption with a well-funded anti-corruption bureau and clean ministers', () => {
    const start = newGame();
    const ministers = Object.fromEntries(
      MINISTRIES.map((m) => [m, { ...start.cabinet.ministers[m]!, corruption: 0, competence: 90 }]),
    ) as GameState['cabinet']['ministers'];
    const clean: GameState = {
      ...start,
      cabinet: { ...start.cabinet, ministers },
      budget: {
        ...start.budget,
        allocations: { ...start.budget.allocations, antiCorruption: start.budget.allocations.antiCorruption * 3 },
      },
    };
    expect(allEfficiencies(clean).antiCorruption).toBeGreaterThan(1.5);
    expect(calm(clean, 365 * 2).economy.corruption).toBeLessThan(30);
  });
});

describe('growth explanation', () => {
  it('lists every driver and adds up to the expected growth the economy system uses', () => {
    const state = calm(newGame({ strategy: 'industrial' }), 200);
    const lines = explainGrowth(state);
    expect(lines.map((l) => l.driver)).toEqual(Object.keys(GROWTH_DRIVER_LABELS));
    const efficiency = allEfficiencies(state);
    const weighted = SECTORS.reduce(
      (sum, s) => sum + sectorShare(state.economy, s) * expectedSectorGrowth(state, efficiency, s),
      0,
    );
    expect(lines.reduce((s, l) => s + l.value, 0)).toBeCloseTo(weighted, 10);
    expect(lines.find((l) => l.driver === 'trend')!.value).toBeGreaterThan(0.05);
  });

  it('shows the tax burden dragging on growth when taxes rise', () => {
    const taxed = withTaxes(newGame(), (t) => TAX_LIMITS[t].max);
    expect(explainGrowth(taxed).find((l) => l.driver === 'taxes')!.value).toBeLessThan(-0.005);
  });
});
