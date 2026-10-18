import { describe, expect, it } from 'vitest';
import {
  activeTrade,
  dispatch,
  GOOD_CONTENT,
  MAX_SUPPLY_CONTRACTS,
  partnerCapacity,
  partnerPrice,
  partnerProblem,
  quotes,
  spreadOf,
  supplyContracts,
  surplus,
  WORLD_MARKET_DISCOUNT,
  type Command,
  type GameState,
  type GoodId,
} from '../../src/sim';
import { patchCountry } from '../../src/sim/diplomacy/relations';
import { calm, deepFreeze, newGame } from '../helpers';

const run = (state: GameState, command: Command): GameState => {
  const result = dispatch(state, command);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

/** A game with extra stock of a good, so there is a surplus to sell. */
const stocked = (good: GoodId, extra: number, state = newGame()): GameState => ({
  ...state,
  industry: { ...state.industry, stocks: { ...state.industry.stocks, [good]: state.industry.stocks[good] + extra } },
});

describe('partner prices', () => {
  it('buy below and sell above the world price, more cheaply for friends', () => {
    const state = newGame();
    const world = state.market.prices.steel;
    expect(partnerPrice(state, 'JPN', 'steel', 'sell')).toBeLessThan(world);
    expect(partnerPrice(state, 'JPN', 'steel', 'buy')).toBeGreaterThan(world);
    const friend = patchCountry(state, 'JPN', { relation: 90 });
    expect(partnerPrice(friend, 'JPN', 'steel', 'sell')).toBeGreaterThan(partnerPrice(state, 'JPN', 'steel', 'sell'));
    const lines = spreadOf(state, 'JPN', 'steel', 'sell').lines.map((l) => l.label);
    expect(lines).toContain('Relation');
    expect(lines).toContain('Distance');
  });

  it('let producers of a good sell it more cheaply than others', () => {
    const state = newGame();
    // Saudi Arabia is strong in energy; Japan is not.
    expect(spreadOf(state, 'SAU', 'crudeOil', 'buy').total).toBeLessThan(
      spreadOf(state, 'JPN', 'crudeOil', 'buy').total + 0.0001,
    );
  });

  it('exclude partners under sanctions, at war or on poor terms', () => {
    const state = newGame();
    expect(partnerProblem(state, 'JPN')).toBeNull();
    // Without an embassy, a partner needs warm relations: the US starts too cool.
    expect(partnerProblem(state, 'USA')).toMatch(/embassy/);
    expect(partnerProblem(patchCountry(state, 'USA', { embassy: true }), 'USA')).toBeNull();
    expect(partnerProblem(patchCountry(state, 'USA', { sanctioned: true }), 'USA')).toMatch(/sanctions/);
    expect(partnerProblem(patchCountry(state, 'USA', { relation: -50 }), 'USA')).toMatch(/too poor/);
    expect(partnerProblem(state, 'XXX')).toMatch(/not a trading partner/);
  });
});

describe('trading', () => {
  it('sells from stock to the treasury, moves the world price down and uses the partner’s capacity', () => {
    const state = stocked('steel', 50);
    const best = quotes(state, 'steel', 'sell')[0]!;
    const quantity = Math.min(5, best.capacity);
    const sold = run(state, { type: 'SELL_GOODS', good: 'steel', partner: best.partner, quantity });
    expect(sold.nation.treasury).toBe(state.nation.treasury + Math.round(quantity * best.price));
    expect(sold.industry.stocks.steel).toBeCloseTo(state.industry.stocks.steel - quantity, 9);
    expect(sold.market.prices.steel).toBeLessThan(state.market.prices.steel);
    expect(partnerCapacity(sold, best.partner, 'steel')).toBeCloseTo(best.capacity - quantity, 9);
    const tooMuch = partnerCapacity(sold, best.partner, 'steel') + 1;
    expect(
      dispatch(stocked('steel', 1000, sold), {
        type: 'SELL_GOODS',
        good: 'steel',
        partner: best.partner,
        quantity: tooMuch,
      }).ok,
    ).toBe(false);
    expect(dispatch(newGame(), { type: 'SELL_GOODS', good: 'steel', partner: best.partner, quantity: 10_000 }).ok).toBe(
      false,
    );
    // Stock below the private market's target is not for sale: selling it would only be imported again.
    expect(dispatch(newGame(), { type: 'SELL_GOODS', good: 'steel', partner: best.partner, quantity: 1 }).ok).toBe(
      false,
    );
    expect(dispatch(newGame(), { type: 'SELL_ON_WORLD_MARKET', good: 'steel', quantity: 1 }).ok).toBe(false);
  });

  it('buys into stock from the treasury and moves the world price up', () => {
    const state = newGame();
    const best = quotes(state, 'crudeOil', 'buy')[0]!;
    const bought = run(state, { type: 'BUY_GOODS', good: 'crudeOil', partner: best.partner, quantity: 2 });
    expect(bought.nation.treasury).toBe(state.nation.treasury - Math.round(2 * best.price));
    expect(bought.industry.stocks.crudeOil).toBeCloseTo(state.industry.stocks.crudeOil + 2, 9);
    expect(bought.market.prices.crudeOil).toBeGreaterThan(state.market.prices.crudeOil);
  });

  it('sells all surplus to the best buyers, and refuses when there is none', () => {
    expect(dispatch(newGame(), { type: 'SELL_ALL_SURPLUS' }).ok).toBe(false);
    const state = stocked('medicines', 40);
    expect(surplus(state, 'medicines')).toBeCloseTo(40, 6);
    const sold = run(state, { type: 'SELL_ALL_SURPLUS' });
    expect(sold.nation.treasury).toBeGreaterThan(state.nation.treasury);
    expect(surplus(sold, 'medicines')).toBeLessThan(40);
  });

  it('sells any quantity on the world market at a discount', () => {
    const state = stocked('vehicles', 100);
    const sold = run(state, { type: 'SELL_ON_WORLD_MARKET', good: 'vehicles', quantity: 100 });
    expect(sold.nation.treasury).toBe(
      state.nation.treasury + Math.round(100 * state.market.prices.vehicles * WORLD_MARKET_DISCOUNT),
    );
  });

  it('honours bans and rejects bad controls', () => {
    let state = stocked('grain', 20);
    state = run(state, {
      type: 'SET_TRADE_CONTROL',
      good: 'grain',
      control: { tariff: 0.1, quota: null, ban: 'export' },
    });
    expect(dispatch(state, { type: 'SELL_ON_WORLD_MARKET', good: 'grain', quantity: 1 }).ok).toBe(false);
    expect(dispatch(state, { type: 'SELL_ALL_SURPLUS' }).ok).toBe(false);
    state = run(state, {
      type: 'SET_TRADE_CONTROL',
      good: 'electronics',
      control: { tariff: 0.1, quota: null, ban: 'import' },
    });
    expect(dispatch(state, { type: 'BUY_GOODS', good: 'electronics', partner: 'JPN', quantity: 1 }).ok).toBe(false);
    for (const control of [
      { tariff: -0.1, quota: null, ban: null },
      { tariff: 1.5, quota: null, ban: null },
      { tariff: 0.1, quota: -1, ban: null },
    ]) {
      expect(dispatch(state, { type: 'SET_TRADE_CONTROL', good: 'grain', control }).ok).toBe(false);
    }
  });
});

describe('supply contracts', () => {
  it('are signed through the treaty path and deliver every month at the agreed price', () => {
    const state = stocked('steel', 30);
    const signed = run(state, {
      type: 'SIGN_SUPPLY_CONTRACT',
      good: 'steel',
      partner: 'JPN',
      side: 'sell',
      quantity: 1,
      years: 2,
    });
    const contract = supplyContracts(signed)[0]!;
    expect(contract.terms.price).toBeCloseTo(partnerPrice(state, 'JPN', 'steel', 'sell'), 9);
    // Goods contracts do not use up the Diplomacy screen's sector contracts.
    expect(activeTrade(signed)).toHaveLength(0);
    const later = calm(signed, 31);
    expect(later.diplomacy.treaties.some((t) => t.id === contract.id)).toBe(true);
    expect(later.industry.stocks.steel).toBeLessThan(calm(state, 31).industry.stocks.steel);
  });

  it('are limited, never duplicated and refused by cold partners', () => {
    let state = newGame();
    for (const partner of ['JPN', 'DEU', 'FRA', 'ARE', 'BRA', 'ZAF'].slice(0, MAX_SUPPLY_CONTRACTS)) {
      state = run(state, {
        type: 'SIGN_SUPPLY_CONTRACT',
        good: 'crudeOil',
        partner,
        side: 'buy',
        quantity: 0.5,
        years: 1,
      });
    }
    expect(
      dispatch(state, {
        type: 'SIGN_SUPPLY_CONTRACT',
        good: 'gas',
        partner: 'AUS',
        side: 'buy',
        quantity: 0.1,
        years: 1,
      }).ok,
    ).toBe(false);
    const fresh = newGame();
    const once = run(fresh, {
      type: 'SIGN_SUPPLY_CONTRACT',
      good: 'gas',
      partner: 'AUS',
      side: 'buy',
      quantity: 0.1,
      years: 1,
    });
    expect(
      dispatch(once, {
        type: 'SIGN_SUPPLY_CONTRACT',
        good: 'gas',
        partner: 'AUS',
        side: 'buy',
        quantity: 0.1,
        years: 1,
      }).ok,
    ).toBe(false);
    const cold = patchCountry(fresh, 'AUS', { relation: -5, embassy: true });
    expect(
      dispatch(cold, {
        type: 'SIGN_SUPPLY_CONTRACT',
        good: 'gas',
        partner: 'AUS',
        side: 'buy',
        quantity: 0.1,
        years: 1,
      }).ok,
    ).toBe(false);
    expect(
      dispatch(fresh, {
        type: 'SIGN_SUPPLY_CONTRACT',
        good: 'gas',
        partner: 'AUS',
        side: 'buy',
        quantity: 0.1,
        years: 9,
      }).ok,
    ).toBe(false);
  });
});

describe('world prices', () => {
  it('drift back toward their base each month, and partner capacity resets', () => {
    const state = stocked('steel', 50);
    const best = quotes(state, 'steel', 'sell')[0]!;
    const sold = run(state, {
      type: 'SELL_GOODS',
      good: 'steel',
      partner: best.partner,
      quantity: Math.min(10, best.capacity),
    });
    const later = calm(sold, 31 * 6);
    expect(Math.abs(later.market.prices.steel - GOOD_CONTENT.steel.price)).toBeLessThan(
      Math.abs(sold.market.prices.steel - GOOD_CONTENT.steel.price) + 0.1 * GOOD_CONTENT.steel.price,
    );
    expect(later.market.volumes).toEqual({});
  });

  it('never mutate the state they are given', () => {
    const state = deepFreeze(stocked('steel', 50));
    const best = quotes(state, 'steel', 'sell')[0]!;
    expect(() => run(state, { type: 'SELL_GOODS', good: 'steel', partner: best.partner, quantity: 1 })).not.toThrow();
    expect(() => run(state, { type: 'SELL_ALL_SURPLUS' })).not.toThrow();
    expect(() => calm(state, 31)).not.toThrow();
  });
});
