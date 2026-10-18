import { describe, expect, it } from 'vitest';
import {
  businessClimate,
  computeFlows,
  dispatch,
  explainGrowth,
  GOOD_CONTENT,
  GOODS,
  goodsInflation,
  INDUSTRY_CONTENT,
  industryJobs,
  LICENCE_DAYS,
  OPENING_SETTLEMENT,
  plantCount,
  plantProfit,
  production,
  projectMonth,
  SECTORS,
  statValue,
  type Command,
  type GameState,
  type GoodId,
} from '../../src/sim';
import { calm, deepFreeze, newGame } from '../helpers';

const run = (state: GameState, command: Command): GameState => {
  const result = dispatch(state, command);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

const rich = (state: GameState): GameState => ({ ...state, nation: { ...state.nation, treasury: 5_000_000 } });

const ban = (state: GameState, good: GoodId): GameState => ({
  ...state,
  market: {
    ...state.market,
    controls: { ...state.market.controls, [good]: { tariff: 0.1, quota: null, ban: 'import' } },
  },
});

describe('the goods economy at the start of a game', () => {
  it('balances: stocks stay at their target, imports match the content, nothing is short or wasted', () => {
    const state = newGame();
    const flows = computeFlows(state);
    for (const g of GOODS) {
      expect(flows.stocks[g]).toBeCloseTo(state.industry.stocks[g], 9);
      expect(flows.imports[g]).toBeCloseTo(GOOD_CONTENT[g].openingImports, 9);
      expect(flows.shortage[g]).toBe(0);
      expect(flows.waste[g]).toBe(0);
    }
    expect(Object.values(flows.throughput).every((v) => v === 1)).toBe(true);
    expect(Object.values(flows.fuelSupply).every((v) => v === 1)).toBe(true);
  });

  it('changes nothing at tick 0: no growth, inflation, revenue or jobs from industry, and a neutral climate', () => {
    const state = newGame();
    expect(state.industry.last).toEqual(OPENING_SETTLEMENT);
    expect(Math.abs(explainGrowth(state).find((g) => g.driver === 'industry')!.value)).toBe(0);
    expect(Math.abs(goodsInflation(state).total)).toBe(0);
    expect(industryJobs(state)).toBe(0);
    expect(businessClimate(state).total).toBeCloseTo(1, 12);
    expect(statValue(state, 'foodShortage', null)).toBe(0);
    expect(statValue(state, 'fuelShortage', null)).toBe(0);
  });

  it('keeps the economy steady month after month without a shock', () => {
    const later = calm(newGame(), 365);
    for (const g of GOODS) expect(later.industry.last.shortage[g]).toBe(0);
    expect(goodsInflation(later).total).toBeLessThan(0.002);
  });
});

describe('supply chains', () => {
  it('throttles the plants that need a banned import, and leaves the country short', () => {
    // Banning crude alone just shifts imports to refined fuel, so ban both. Stocks carry the country for a couple
    // of months; then the shortage shows.
    let s = ban(ban(newGame(), 'crudeOil'), 'fuel');
    for (let m = 0; m < 4; m++) s = { ...s, industry: { ...s.industry, ...settle(s) } };
    expect(s.industry.last.throughput.refinery).toBeLessThan(0.5);
    expect(s.industry.last.shortage.fuel).toBeGreaterThan(0);
    expect(statValue(s, 'fuelShortage', null)).toBeGreaterThan(5);
    expect(goodsInflation(s).drivers.find((d) => d.label === 'Shortages')!.value).toBeGreaterThan(0);
  });

  it('runs power stations short of fuel when they cannot get it', () => {
    // Close the uranium mines and ban uranium imports: the nuclear stations burn through the stock and slow down.
    const start = ban(newGame(), 'uranium');
    const plants = Object.fromEntries(
      Object.entries(start.industry.plants).map(([r, p]) => [r, { ...p, uraniumMine: { state: 0, private: 0 } }]),
    ) as GameState['industry']['plants'];
    let s: GameState = { ...start, industry: { ...start.industry, plants } };
    for (let m = 0; m < 3; m++) s = { ...s, industry: { ...s.industry, ...settle(s) } };
    expect(s.industry.last.fuelSupply.uranium).toBeLessThan(1);
    expect(production(s)).toBeLessThan(production(newGame()));
  });
});

/** One monthly settlement of the goods market, as the industry system does it. */
function settle(state: GameState): Pick<GameState['industry'], 'stocks' | 'last'> {
  const { stocks, ...last } = computeFlows(state);
  return { stocks, last };
}

describe('state plants', () => {
  it('cost money up front, open after their build time and lift output, profit and jobs', () => {
    let state = rich(newGame());
    const before = state.nation.treasury;
    state = run(state, { type: 'BUILD_INDUSTRY', industry: 'steelMill', region: 'east', quantity: 2 });
    expect(state.nation.treasury).toBe(before - 2 * INDUSTRY_CONTENT.steelMill.cost);
    const opened = calm(state, INDUSTRY_CONTENT.steelMill.buildDays);
    expect(opened.industry.plants.east.steelMill.state).toBe(newGame().industry.plants.east.steelMill.state + 2);
    expect(industryJobs(opened)).toBe(2 * INDUSTRY_CONTENT.steelMill.jobs);
    // The next settlement counts their output; the economy folds it into industry's growth once.
    const settled = calm(opened, 31);
    expect(settled.industry.last.valueAdded.industry).toBeGreaterThan(OPENING_SETTLEMENT.valueAdded.industry);
    expect(settled.industry.last.stateProfit).toBeGreaterThan(OPENING_SETTLEMENT.stateProfit);
    const preview = { ...settled, industry: { ...settled.industry, applied: OPENING_SETTLEMENT.valueAdded } };
    expect(explainGrowth(preview).find((g) => g.driver === 'industry')!.value).toBeGreaterThan(0);
    for (const s of SECTORS) expect(Number.isFinite(settled.industry.applied[s])).toBe(true);
  });

  it('pay their profit to the treasury through non-tax revenue', () => {
    const state = newGame();
    const richer = {
      ...state,
      industry: {
        ...state.industry,
        last: { ...state.industry.last, stateProfit: OPENING_SETTLEMENT.stateProfit + 1000 },
      },
    };
    expect(
      projectMonth(richer, richer.budget).revenue.nonTax - projectMonth(state, state.budget).revenue.nonTax,
    ).toBeCloseTo(1000, 6);
  });

  it('can be closed, never more than the state owns, and a state build can be cancelled for half its price', () => {
    let state = rich(newGame());
    const own = state.industry.plants.east.coalMine.state;
    const closed = run(state, { type: 'CLOSE_INDUSTRY', industry: 'coalMine', region: 'east', quantity: 1 });
    expect(closed.industry.plants.east.coalMine.state).toBe(own - 1);
    expect(
      dispatch(state, { type: 'CLOSE_INDUSTRY', industry: 'coalMine', region: 'east', quantity: own + 1 }).ok,
    ).toBe(false);
    state = run(state, { type: 'BUILD_INDUSTRY', industry: 'refinery', region: 'west', quantity: 1 });
    const order = state.industry.queue[0]!;
    const cancelled = run(state, { type: 'CANCEL_INDUSTRY', orderId: order.id });
    expect(cancelled.nation.treasury).toBe(state.nation.treasury + Math.round(order.cost / 2));
  });

  it('refuse orders the treasury cannot cover and bad quantities', () => {
    const state = newGame();
    const poor = { ...state, nation: { ...state.nation, treasury: 100 } };
    expect(dispatch(poor, { type: 'BUILD_INDUSTRY', industry: 'grainFarm', region: 'north', quantity: 1 }).ok).toBe(
      false,
    );
    for (const quantity of [0, -1, 1.5, 21]) {
      expect(
        dispatch(rich(state), { type: 'BUILD_INDUSTRY', industry: 'foodPlant', region: 'north', quantity }).ok,
      ).toBe(false);
    }
  });
});

describe('private plants', () => {
  it('can be licensed for a fee when an investor wants one, and open after a short build', () => {
    let state = newGame();
    const before = state.nation.treasury;
    state = run(state, { type: 'LICENSE_PLANT', industry: 'pharmaPlant', region: 'south' });
    expect(state.nation.treasury).toBe(before + INDUSTRY_CONTENT.pharmaPlant.licenceFee);
    state = run(state, { type: 'LICENSE_PLANT', industry: 'pharmaPlant', region: 'west' });
    // Only two licensed plants are built at once.
    expect(dispatch(state, { type: 'LICENSE_PLANT', industry: 'pharmaPlant', region: 'north' }).ok).toBe(false);
    const opened = calm(state, LICENCE_DAYS);
    expect(opened.industry.plants.south.pharmaPlant.private).toBe(
      newGame().industry.plants.south.pharmaPlant.private + 1,
    );
    expect(dispatch(state, { type: 'CANCEL_INDUSTRY', orderId: state.industry.queue[0]!.id }).ok).toBe(false);
  });

  it('are refused when the climate is poor or the plant would lose money', () => {
    const state = newGame();
    const taxed = { ...state, budget: { ...state.budget, taxRates: { ...state.budget.taxRates, corporate: 0.45 } } };
    expect(businessClimate(taxed).total).toBeLessThan(0.95);
    expect(dispatch(taxed, { type: 'LICENSE_PLANT', industry: 'pharmaPlant', region: 'south' }).ok).toBe(false);
    const glut = { ...state, market: { ...state.market, prices: { ...state.market.prices, medicines: 1 } } };
    expect(plantProfit(glut, 'pharmaPlant')).toBeLessThan(0);
    expect(dispatch(glut, { type: 'LICENSE_PLANT', industry: 'pharmaPlant', region: 'south' }).ok).toBe(false);
  });

  it('arrive on their own in a good climate and leave in a bad one', () => {
    const state = newGame();
    const climate = (corporate: number) => ({
      ...state,
      budget: { ...state.budget, taxRates: { ...state.budget.taxRates, corporate } },
    });
    const total = (s: GameState) =>
      GOODS.length && Object.keys(INDUSTRY_CONTENT).reduce((n, i) => n + plantCount(s.industry.plants, i as never), 0);
    expect(total(calm(climate(0.1), 365))).toBeGreaterThan(total(state));
    expect(total(calm(climate(0.45), 365))).toBeLessThan(total(state));
  });
});

describe('tariffs and imports', () => {
  it('raise customs revenue and prices when a tariff goes up', () => {
    let state = newGame();
    state = run(state, {
      type: 'SET_TRADE_CONTROL',
      good: 'crudeOil',
      control: { tariff: 0.3, quota: null, ban: null },
    });
    const settledOnce = { ...state, industry: { ...state.industry, ...settle(state) } };
    expect(settledOnce.industry.last.customs).toBeGreaterThan(OPENING_SETTLEMENT.customs);
    expect(projectMonth(settledOnce, settledOnce.budget).revenue.customs).toBeGreaterThan(
      projectMonth(newGame(), newGame().budget).revenue.customs,
    );
    expect(goodsInflation(settledOnce).drivers.find((d) => d.label === 'Tariffs')!.value).toBeGreaterThan(0);
  });

  it('cap private imports with a quota', () => {
    const state = newGame();
    const capped = {
      ...state,
      market: {
        ...state.market,
        controls: { ...state.market.controls, crudeOil: { tariff: 0.1, quota: 5, ban: null } },
      },
    };
    let s: GameState = capped;
    for (let m = 0; m < 3; m++) s = { ...s, industry: { ...s.industry, ...settle(s) } };
    expect(s.industry.last.imports.crudeOil).toBeLessThanOrEqual(5 + 1e-9);
  });

  it('never mutate the state they are given', () => {
    const state = deepFreeze(rich(newGame()));
    expect(() =>
      run(state, { type: 'BUILD_INDUSTRY', industry: 'textileMill', region: 'south', quantity: 1 }),
    ).not.toThrow();
    expect(() => run(state, { type: 'LICENSE_PLANT', industry: 'textileMill', region: 'south' })).not.toThrow();
    expect(() => computeFlows(state)).not.toThrow();
    expect(() => calm(state, 40)).not.toThrow();
  });
});
