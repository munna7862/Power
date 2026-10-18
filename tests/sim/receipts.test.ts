import { describe, expect, it } from 'vitest';
import {
  dispatch,
  noReceipts,
  parseSave,
  RECEIPT_SOURCES,
  serializeSave,
  totalReceipts,
  type Command,
  type GameState,
  type GoodId,
} from '../../src/sim';
import { Rng, seedRng } from '../../src/sim/engine/rng';
import { applyEffect } from '../../src/sim/events/effects';
import { licencePlant } from '../../src/sim/industry/build';
import { INDUSTRY_CONTENT } from '../../src/sim/content/goods';
import { quotes } from '../../src/sim/market/pricing';
import { sellOnWorldMarket } from '../../src/sim/market/trade';
import { MIGRATIONS } from '../../src/sim/save/migrations';
import { fiscalSystem } from '../../src/sim/systems/fiscal';
import { deepFreeze, newGame } from '../helpers';

const run = (state: GameState, command: Command): GameState => {
  const result = dispatch(state, command);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

const stocked = (good: GoodId, extra: number, state = newGame()): GameState => ({
  ...state,
  industry: { ...state.industry, stocks: { ...state.industry.stocks, [good]: state.industry.stocks[good] + extra } },
});

const ctx = { rng: new Rng(seedRng(1)), region: null, ref: null, label: 'Test' };

describe('one-off receipts', () => {
  it('start at zero in a new game', () => {
    const state = newGame();
    expect(state.economy.receipts).toEqual(noReceipts());
    expect(state.economy.lastMonth).toBeNull();
  });

  it('record licence fees as they reach the treasury', () => {
    const state = deepFreeze(newGame());
    const licensed = licencePlant(state, 'textileMill', 'south');
    const fee = INDUSTRY_CONTENT.textileMill.licenceFee;
    expect(licensed.economy.receipts.licenceFees).toBe(fee);
    expect(licensed.nation.treasury).toBe(state.nation.treasury + fee);
  });

  it('record Trade Market sales to partners and on the world market, but not purchases', () => {
    const state = deepFreeze(stocked('steel', 50));
    const best = quotes(state, 'steel', 'sell')[0]!;
    const sold = run(state, { type: 'SELL_GOODS', good: 'steel', partner: best.partner, quantity: 5 });
    const earned = sold.nation.treasury - state.nation.treasury;
    expect(earned).toBeGreaterThan(0);
    expect(sold.economy.receipts.tradeSales).toBe(earned);
    const world = sellOnWorldMarket(sold, 'steel', 5);
    expect(world.economy.receipts.tradeSales).toBe(earned + (world.nation.treasury - sold.nation.treasury));
    const buyer = quotes(state, 'steel', 'buy')[0]!;
    const bought = run(state, { type: 'BUY_GOODS', good: 'steel', partner: buyer.partner, quantity: 1 });
    expect(bought.economy.receipts).toEqual(noReceipts());
  });

  it('record refunds on cancelled projects', () => {
    const ordered = run(newGame(), { type: 'BUILD_FACILITY', facility: 'clinic', region: 'east', quantity: 10 });
    const order = ordered.infrastructure.queue[0]!;
    const cancelled = run(ordered, { type: 'CANCEL_BUILD', orderId: order.id });
    expect(cancelled.economy.receipts.refunds).toBe(cancelled.nation.treasury - ordered.nation.treasury);
    expect(cancelled.economy.receipts.refunds).toBeGreaterThan(0);
  });

  it('record windfalls from events, while event costs come straight out of the treasury', () => {
    const state = deepFreeze(newGame());
    const windfall = applyEffect(state, { type: 'treasury', amount: 5_000 }, ctx);
    expect(windfall.economy.receipts.events).toBe(5_000);
    const cost = applyEffect(state, { type: 'treasury', amount: -5_000 }, ctx);
    expect(cost.economy.receipts).toEqual(noReceipts());
    expect(cost.nation.treasury).toBe(state.nation.treasury - 5_000);
  });

  it('settle into last month at the fiscal settlement and start the new month at zero', () => {
    const state = applyEffect(licencePlant(newGame(), 'textileMill', 'south'), { type: 'treasury', amount: 700 }, ctx);
    const settled = fiscalSystem.run(state, { rng: new Rng(seedRng(7)) } as Parameters<typeof fiscalSystem.run>[1]);
    expect(settled.economy.lastMonth?.receipts).toEqual(state.economy.receipts);
    expect(totalReceipts(settled.economy.lastMonth!.receipts)).toBe(INDUSTRY_CONTENT.textileMill.licenceFee + 700);
    expect(settled.economy.receipts).toEqual(noReceipts());
    // Receipts were already in the treasury, so they stay outside the monthly revenue and balance.
    expect(settled.economy.lastMonth!.totalRevenue).toBe(
      fiscalSystem.run(newGame(), { rng: new Rng(seedRng(7)) } as Parameters<typeof fiscalSystem.run>[1]).economy
        .lastMonth!.totalRevenue,
    );
  });

  it('survive a save and load', () => {
    const state = licencePlant(newGame(), 'textileMill', 'south');
    const loaded = parseSave(serializeSave(state, '2026-10-18T00:00:00.000Z'));
    if (!loaded.ok) throw new Error(loaded.error);
    expect(loaded.save.state.economy.receipts).toEqual(state.economy.receipts);
  });
});

describe('v13 → v14 migration', () => {
  it('gives a game in progress empty receipts, this month and last', () => {
    const v13 = {
      schemaVersion: 13,
      economy: { debt: 1, lastMonth: { totalRevenue: 10, borrowed: 0, repaid: 0 } },
    };
    const v14 = MIGRATIONS[13]!(v13) as {
      schemaVersion: number;
      economy: {
        receipts: Record<string, number>;
        lastMonth: { receipts: Record<string, number>; totalRevenue: number };
      };
    };
    expect(v14.schemaVersion).toBe(14);
    expect(v14.economy.receipts).toEqual(noReceipts());
    expect(v14.economy.lastMonth.receipts).toEqual(noReceipts());
    expect(v14.economy.lastMonth.totalRevenue).toBe(10);
    expect(Object.keys(v14.economy.receipts)).toEqual([...RECEIPT_SOURCES]);
    const fresh = MIGRATIONS[13]!({ schemaVersion: 13, economy: { lastMonth: null } }) as {
      economy: { lastMonth: null };
    };
    expect(fresh.economy.lastMonth).toBeNull();
  });
});
