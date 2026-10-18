import { describe, expect, it } from 'vitest';
import {
  GOODS,
  nominalGdp,
  projectMonth,
  REVENUE_LINES,
  revenueBreakdown,
  type GameState,
  type RevenueAdditionId,
  type RevenueFactorId,
  type RevenueLine,
  type TaxId,
} from '../../src/sim';
import { FACILITY_CONTENT } from '../../src/sim/content/infrastructure';
import { NON_TAX_REVENUE_SHARE } from '../../src/sim/economy/constants';
import { averageTariff, complianceFactor, sectorMixFactor, taxAdministration } from '../../src/sim/economy/model';
import { DOMESTIC_POWER_MARGIN } from '../../src/sim/energy/constants';
import { consumption, production } from '../../src/sim/energy/grid';
import { newGame, withStars } from '../helpers';

const factor = (state: GameState, tax: TaxId, id: RevenueFactorId): number => {
  const found = revenueBreakdown(state, state.budget, tax).factors.find((f) => f.id === id);
  if (!found) throw new Error(`${tax} has no ${id} factor`);
  return found.value;
};

const addition = (state: GameState, line: RevenueLine, id: RevenueAdditionId): number => {
  const found = revenueBreakdown(state, state.budget, line).additions.find((a) => a.id === id);
  if (!found) throw new Error(`${line} has no ${id} addition`);
  return found.value;
};

const withTariffs = (
  state: GameState,
  control: (good: (typeof GOODS)[number]) => Partial<GameState['market']['controls'][(typeof GOODS)[number]]>,
): GameState => ({
  ...state,
  market: {
    ...state.market,
    controls: Object.fromEntries(
      GOODS.map((g) => [g, { ...state.market.controls[g], ...control(g) }]),
    ) as GameState['market']['controls'],
  },
});

const withEconomy = (state: GameState, economy: Partial<GameState['economy']>): GameState => ({
  ...state,
  economy: { ...state.economy, ...economy },
});

describe('tax breakdown', () => {
  it('is the revenue the fiscal settlement collects, line by line', () => {
    const state = newGame();
    const p = projectMonth(state, state.budget);
    for (const line of REVENUE_LINES)
      expect(revenueBreakdown(state, state.budget, line).total).toBeCloseTo(p.revenue[line]);
  });

  it('starts every new factor at 1, so a new game raises what it always did', () => {
    const state = newGame();
    for (const line of REVENUE_LINES) {
      const { factors, additions } = revenueBreakdown(state, state.budget, line);
      for (const f of factors)
        if (f.id !== 'compliance' && f.id !== 'trade') expect(f.value, `${line} ${f.id}`).toBeCloseTo(1, 12);
      for (const a of additions) expect(a.value, `${line} ${a.id}`).toBeCloseTo(0, 6);
    }
    // Customs at the opening 10% tariff and fees and dividends at their share of GDP, as before.
    expect(averageTariff(state.market)).toBeCloseTo(state.budget.taxRates.customs, 12);
    expect(projectMonth(state, state.budget).revenue.customs).toBeCloseTo(19_681.768568, 4);
    expect(projectMonth(state, state.budget).revenue.nonTax).toBeCloseTo(
      (nominalGdp(state.economy) / 12) * NON_TAX_REVENUE_SHARE,
      6,
    );
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

describe('customs and the tariff schedule', () => {
  it('raises more with higher tariffs, less than proportionally, and nothing past the avoidance ceiling', () => {
    const state = newGame();
    const customs = (s: GameState) => revenueBreakdown(s, s.budget, 'customs').total;
    const opening = customs(state);
    const doubled = customs(withTariffs(state, () => ({ tariff: 0.2 })));
    expect(doubled).toBeGreaterThan(opening * 1.6);
    expect(doubled).toBeLessThan(opening * 2);
    expect(customs(withTariffs(state, () => ({ tariff: 1 })))).toBe(0);
  });

  it('weights tariffs by the opening import bill and collects nothing on banned imports', () => {
    const state = newGame();
    // Crude oil is most of the opening import bill; grain is none of it.
    expect(averageTariff(withTariffs(state, (g) => ({ tariff: g === 'crudeOil' ? 0.3 : 0.1 })).market)).toBeGreaterThan(
      0.2,
    );
    expect(averageTariff(withTariffs(state, (g) => ({ tariff: g === 'grain' ? 0.5 : 0.1 })).market)).toBeCloseTo(0.1);
    const banned = withTariffs(state, (g) => (g === 'crudeOil' ? { ban: 'import' } : {}));
    expect(factor(banned, 'customs', 'avoidance')).toBeLessThan(0.4);
  });
});

describe('non-tax revenue', () => {
  it('earns from power sold at home beyond the opening sales, and loses it in power cuts', () => {
    const state = newGame();
    const grow = (by: number) =>
      withEconomy(state, {
        sectors: Object.fromEntries(
          Object.entries(state.economy.sectors).map(([k, v]) => [k, { ...v, output: v.output * by }]),
        ) as GameState['economy']['sectors'],
      });
    // Demand grows into the opening reserve: every extra GW sold earns the margin, up to what the grid makes.
    const busier = grow(1.03);
    expect(addition(busier, 'nonTax', 'powerSales')).toBeCloseTo(
      DOMESTIC_POWER_MARGIN * (Math.min(production(busier), consumption(busier)) - consumption(state)),
    );
    expect(addition(busier, 'nonTax', 'powerSales')).toBeGreaterThan(0);
    const north = state.energy.plants.north;
    const fewerPlants = {
      ...state,
      energy: { ...state.energy, plants: { ...state.energy.plants, north: { ...north, coal: 0 } } },
    };
    expect(addition(fewerPlants, 'nonTax', 'powerSales')).toBeLessThan(0);
  });

  it('collects tolls and fares on highways and rail links built beyond the opening network', () => {
    const state = newGame();
    const north = state.infrastructure.counts.north;
    const built = {
      ...state,
      infrastructure: {
        ...state.infrastructure,
        counts: {
          ...state.infrastructure.counts,
          north: { ...north, highway: north.highway + 10, railLink: north.railLink + 2, clinic: north.clinic + 50 },
        },
      },
    };
    expect(addition(built, 'nonTax', 'transportFees')).toBeCloseTo(
      10 * FACILITY_CONTENT.highway.fees + 2 * FACILITY_CONTENT.railLink.fees,
    );
    expect(FACILITY_CONTENT.highway.fees).toBeLessThan(FACILITY_CONTENT.highway.upkeep);
    expect(FACILITY_CONTENT.clinic.fees).toBe(0);
  });
});
