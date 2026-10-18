import { describe, expect, it } from 'vitest';
import {
  dispatch,
  spareForContracts,
  supplyContracts,
  surplus,
  validateContract,
  type Command,
  type GameState,
  type GoodId,
} from '../../src/sim';
import { relationOf } from '../../src/sim/diplomacy/relations';
import { quotes } from '../../src/sim/market/pricing';
import { deliverContracts } from '../../src/sim/market/trade';
import { MIGRATIONS } from '../../src/sim/save/migrations';
import { deepFreeze, newGame } from '../helpers';

const run = (state: GameState, command: Command): GameState => {
  const result = dispatch(state, command);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

const withStock = (state: GameState, good: GoodId, extra: number): GameState => ({
  ...state,
  industry: { ...state.industry, stocks: { ...state.industry.stocks, [good]: state.industry.stocks[good] + extra } },
});

const partnerFor = (state: GameState, good: GoodId, n = 0) => quotes(state, good, 'sell')[n]!.partner;

describe('signing sale contracts', () => {
  it('refuses to promise more than the spare surplus', () => {
    const state = newGame();
    // A new game has no surplus: production only meets home demand.
    expect(surplus(state, 'steel')).toBe(0);
    expect(validateContract(state, 'steel', partnerFor(state, 'steel'), 'sell', 1, 1)).toMatch(/only 0 Mt of spare/);
    const stocked = withStock(state, 'steel', 5);
    expect(validateContract(stocked, 'steel', partnerFor(stocked, 'steel'), 'sell', 5, 1)).toBeNull();
    expect(validateContract(stocked, 'steel', partnerFor(stocked, 'steel'), 'sell', 6, 1)).toMatch(/spare/);
  });

  it('counts what other sale contracts already promise, but not purchases', () => {
    const state = withStock(newGame(), 'steel', 5);
    const first = run(state, {
      type: 'SIGN_SUPPLY_CONTRACT',
      good: 'steel',
      partner: partnerFor(state, 'steel'),
      side: 'sell',
      quantity: 3,
      years: 1,
    });
    expect(spareForContracts(first, 'steel')).toBeCloseTo(2);
    expect(validateContract(first, 'steel', partnerFor(state, 'steel', 1), 'sell', 3, 1)).toMatch(/already promised/);
    expect(validateContract(first, 'steel', partnerFor(state, 'steel', 1), 'sell', 2, 1)).toBeNull();
    // Buying needs no surplus.
    expect(validateContract(newGame(), 'steel', partnerFor(state, 'steel'), 'buy', 5, 1)).toBeNull();
  });
});

describe('contract deliveries', () => {
  it('records what each contract delivered and what it earned', () => {
    const state = withStock(newGame(), 'steel', 10);
    const signed = run(state, {
      type: 'SIGN_SUPPLY_CONTRACT',
      good: 'steel',
      partner: partnerFor(state, 'steel'),
      side: 'sell',
      quantity: 2,
      years: 1,
    });
    const contract = supplyContracts(signed)[0]!;
    const delivered = deliverContracts(deepFreeze(signed));
    expect(delivered.market.deliveries[contract.id]).toEqual({
      quantity: 2,
      promised: 2,
      value: Math.round(2 * contract.terms.price!),
    });
    expect(delivered.economy.receipts.tradeSales).toBe(Math.round(2 * contract.terms.price!));
    expect(delivered.log.length).toBe(signed.log.length);
  });

  it('notices a shortfall: records it, costs goodwill and tells the President', () => {
    const state = withStock(newGame(), 'steel', 10);
    const partner = partnerFor(state, 'steel');
    const signed = run(state, {
      type: 'SIGN_SUPPLY_CONTRACT',
      good: 'steel',
      partner,
      side: 'sell',
      quantity: 5,
      years: 1,
    });
    // The surplus is used up before the delivery: only 1 Mt is spare on the day.
    const drained = withStock(signed, 'steel', -(surplus(signed, 'steel') - 1));
    const contract = supplyContracts(drained)[0]!;
    const delivered = deliverContracts(drained);
    expect(delivered.market.deliveries[contract.id]!.quantity).toBeCloseTo(1);
    expect(delivered.market.deliveries[contract.id]!.promised).toBe(5);
    expect(relationOf(delivered, partner)).toBe(relationOf(drained, partner) - 1);
    const notice = delivered.log.at(-1)!;
    expect(notice.severity).toBe('warning');
    expect(notice.title).toBe('A supply contract fell short');
    expect(notice.body).toMatch(/shipped 1 of 5 Mt/);
  });

  it('records a purchase the treasury could not pay as nothing delivered', () => {
    const state = newGame();
    const partner = quotes(state, 'steel', 'buy')[0]!.partner;
    const signed = run(state, {
      type: 'SIGN_SUPPLY_CONTRACT',
      good: 'steel',
      partner,
      side: 'buy',
      quantity: 5,
      years: 1,
    });
    const broke = { ...signed, nation: { ...signed.nation, treasury: 0 } };
    const contract = supplyContracts(broke)[0]!;
    const delivered = deliverContracts(broke);
    expect(delivered.market.deliveries[contract.id]).toEqual({ quantity: 0, promised: 5, value: 0 });
    expect(delivered.log.at(-1)!.body).toMatch(/could not pay/);
  });

  it('keeps only the contracts that delivered this month', () => {
    const state = newGame();
    const stale = {
      ...state,
      market: { ...state.market, deliveries: { old: { quantity: 1, promised: 1, value: 1 } } },
    };
    expect(deliverContracts(stale).market.deliveries).toEqual({});
  });
});

describe('v15 → v16 migration', () => {
  it('starts a game in progress with no deliveries recorded', () => {
    const v16 = MIGRATIONS[15]!({ schemaVersion: 15, market: { volumes: { 'USA:steel': 2 } } }) as {
      schemaVersion: number;
      market: { volumes: Record<string, number>; deliveries: object };
    };
    expect(v16.schemaVersion).toBe(16);
    expect(v16.market.deliveries).toEqual({});
    expect(v16.market.volumes).toEqual({ 'USA:steel': 2 });
  });
});
