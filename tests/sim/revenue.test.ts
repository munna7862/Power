import { describe, expect, it } from 'vitest';
import { GOODS, projectMonth, taxBreakdown, TAXES, type GameState, type TaxFactorId, type TaxId } from '../../src/sim';
import { complianceFactor, sectorMixFactor, taxAdministration } from '../../src/sim/economy/model';
import { newGame, withStars } from '../helpers';

const factor = (state: GameState, tax: TaxId, id: TaxFactorId): number => {
  const found = taxBreakdown(state, state.budget, tax).factors.find((f) => f.id === id);
  if (!found) throw new Error(`${tax} has no ${id} factor`);
  return found.value;
};

const withEconomy = (state: GameState, economy: Partial<GameState['economy']>): GameState => ({
  ...state,
  economy: { ...state.economy, ...economy },
});

describe('tax breakdown', () => {
  it('is the revenue the fiscal settlement collects, line by line', () => {
    const state = newGame();
    const p = projectMonth(state, state.budget);
    for (const tax of TAXES) expect(taxBreakdown(state, state.budget, tax).total).toBeCloseTo(p.revenue[tax]);
  });

  it('starts every new factor at 1, so a new game raises what it always did', () => {
    const state = newGame();
    for (const tax of TAXES) {
      const { factors, additions } = taxBreakdown(state, state.budget, tax);
      for (const f of factors)
        if (f.id !== 'compliance' && f.id !== 'trade') expect(f.value, `${tax} ${f.id}`).toBeCloseTo(1, 12);
      for (const a of additions) expect(a.value, `${tax} ${a.id}`).toBeCloseTo(0, 6);
    }
    // The opening compliance: Finance at 0.88 efficiency, as before the breakdown existed.
    expect(factor(state, 'income', 'compliance')).toBeCloseTo(0.92 + 0.08 * 0.88, 12);
    expect(projectMonth(state, state.budget).revenue.income * 12).toBeCloseTo(12 * 99_030.096, 0);
  });
});

describe('sector mix', () => {
  it('taxes a tech-heavy economy more and a farm-heavy one less than the opening mix', () => {
    const state = newGame();
    const sectors = state.economy.sectors;
    const scaled = (sector: keyof typeof sectors, by: number) =>
      withEconomy(state, {
        sectors: { ...sectors, [sector]: { ...sectors[sector], output: sectors[sector].output * by } },
      });
    expect(sectorMixFactor(scaled('tech', 2).economy, 'income')).toBeGreaterThan(1.05);
    expect(sectorMixFactor(scaled('agriculture', 2).economy, 'income')).toBeLessThan(0.9);
    expect(sectorMixFactor(scaled('industry', 2).economy, 'corporate')).toBeGreaterThan(1.03);
    // Growing every sector alike changes nothing: only the mix matters.
    const even = withEconomy(state, {
      sectors: Object.fromEntries(
        Object.entries(sectors).map(([k, v]) => [k, { ...v, output: v.output * 1.5 }]),
      ) as typeof sectors,
    });
    for (const tax of ['income', 'corporate', 'gst'] as const)
      expect(sectorMixFactor(even.economy, tax)).toBeCloseTo(1);
  });
});

describe('corporate tax and the business climate', () => {
  it('falls when corruption and unrest scare investors off, but not because of its own rate', () => {
    const state = newGame();
    expect(factor(withEconomy(state, { corruption: 80 }), 'corporate', 'climate')).toBeCloseTo(1 - 0.5 * 0.004 * 40);
    const riots = {
      ...state,
      security: {
        ...state.security,
        unrest: Object.fromEntries(
          Object.keys(state.security.unrest).map((r) => [r, 72]),
        ) as GameState['security']['unrest'],
      },
    };
    expect(factor(riots, 'corporate', 'climate')).toBeLessThan(0.95);
    const highRate = { ...state, budget: { ...state.budget, taxRates: { ...state.budget.taxRates, corporate: 0.35 } } };
    expect(factor(highRate, 'corporate', 'climate')).toBeCloseTo(1, 12);
  });
});

describe('GST and consumption', () => {
  it('shrinks with joblessness and with goods left unsold', () => {
    const state = newGame();
    expect(factor(withEconomy(state, { unemployment: state.economy.unemployment + 0.03 }), 'gst', 'jobs')).toBeCloseTo(
      0.97,
    );
    const last = state.industry.last;
    const short = {
      ...state,
      industry: {
        ...state.industry,
        last: {
          ...last,
          shortage: Object.fromEntries(GOODS.map((g) => [g, last.demand[g] * 0.5])) as typeof last.shortage,
        },
      },
    };
    expect(factor(short, 'gst', 'shortages')).toBeCloseTo(1 - 0.3 * 0.5);
  });
});

describe('compliance', () => {
  it('loses much more to corruption than before, and gains as corruption falls', () => {
    const at = (c: number) => complianceFactor(0.88, c) / complianceFactor(0.88, 40);
    expect(at(80)).toBeCloseTo(0.76 / 0.88);
    expect(at(0)).toBeCloseTo(1 / 0.88);
  });

  it('follows the Tax administration service, not the rest of the Finance department', () => {
    const state = newGame();
    const allocation = state.budget.allocations.finance;
    const opening = taxAdministration(state, allocation);
    const betterTaxOffice = {
      ...state,
      departments: {
        ...state.departments,
        stars: { ...state.departments.stars, finance: { ...state.departments.stars.finance, taxAdministration: 5 } },
      },
    };
    expect(taxAdministration(betterTaxOffice, allocation)).toBeCloseTo(opening * (1.24 / 0.88));
    const otherServices = withStars(state, 'finance', 5);
    const onlyOthers = {
      ...otherServices,
      departments: {
        ...otherServices.departments,
        stars: {
          ...otherServices.departments.stars,
          finance: { ...otherServices.departments.stars.finance, taxAdministration: 2 },
        },
      },
    };
    expect(taxAdministration(onlyOthers, allocation)).toBeCloseTo(opening);
  });
});
