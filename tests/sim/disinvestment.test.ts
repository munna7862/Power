import { describe, expect, it } from 'vitest';
import {
  advanceDays,
  dispatch,
  INDUSTRIES,
  industryJobs,
  noReceipts,
  ownedCount,
  plantCount,
  plantProfit,
  REGIONS,
  salePrice,
  validateSellPlant,
  type Command,
  type GameState,
  type IndustryId,
} from '../../src/sim';
import { SALE_MONTHS } from '../../src/sim/industry/constants';
import { MIGRATIONS } from '../../src/sim/save/migrations';
import { deepFreeze, newGame } from '../helpers';

const run = (state: GameState, command: Command): GameState => {
  const result = dispatch(state, command);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

/** A profitable industry with state plants in some region at the start. */
const pick = (state: GameState): IndustryId => {
  const found = INDUSTRIES.find(
    (i) => plantProfit(state, i) > 0 && REGIONS.some((r) => state.industry.plants[r][i].state >= 2),
  );
  if (!found) throw new Error('no profitable state industry');
  return found;
};

describe('selling state plants', () => {
  it('prices a plant at four years of after-tax profit, scaled by the business climate', () => {
    const state = newGame();
    const industry = pick(state);
    expect(salePrice(state, industry)).toBe(
      Math.round(SALE_MONTHS * plantProfit(state, industry) * (1 - state.budget.taxRates.corporate)),
    );
  });

  it('hands plants to investors for a one-off receipt, keeping output and jobs', () => {
    const state = deepFreeze(newGame());
    const industry = pick(state);
    const region = REGIONS.find((r) => state.industry.plants[r][industry].state >= 2)!;
    const sold = run(state, { type: 'SELL_STATE_PLANT', industry, region, quantity: 2 });
    const price = salePrice(state, industry) * 2;
    expect(sold.industry.plants[region][industry].state).toBe(state.industry.plants[region][industry].state - 2);
    expect(sold.industry.plants[region][industry].private).toBe(state.industry.plants[region][industry].private + 2);
    expect(plantCount(sold.industry.plants, industry)).toBe(plantCount(state.industry.plants, industry));
    expect(industryJobs(sold)).toBe(industryJobs(state));
    expect(sold.nation.treasury).toBe(state.nation.treasury + price);
    expect(sold.economy.receipts).toEqual({ ...noReceipts(), plantSales: price });
  });

  it('moves the profit from the treasury to private owners at the next settlement', () => {
    const state = newGame();
    const industry = pick(state);
    const quantity = Math.min(5, ownedCount(state.industry.plants, industry, 'state'));
    const sold = run(state, { type: 'SELL_STATE_PLANT', industry, quantity });
    const before = advanceDays(state, 31).industry.last;
    const after = advanceDays(sold, 31).industry.last;
    expect(after.stateProfit).toBeLessThan(before.stateProfit);
    expect(after.privateProfit).toBeGreaterThan(before.privateProfit);
  });

  it('in national play, sells where there are most state plants of that kind', () => {
    const state = newGame();
    const industry = pick(state);
    const most = [...REGIONS].sort(
      (a, b) => state.industry.plants[b][industry].state - state.industry.plants[a][industry].state,
    )[0]!;
    const sold = run(state, { type: 'SELL_STATE_PLANT', industry, quantity: 1 });
    expect(sold.industry.plants[most][industry].state).toBe(state.industry.plants[most][industry].state - 1);
  });

  it('needs plants to sell, an investor-friendly climate and a profitable plant', () => {
    const state = newGame();
    const industry = pick(state);
    const region = REGIONS.find((r) => state.industry.plants[r][industry].state < 20)!;
    const here = state.industry.plants[region][industry].state;
    expect(validateSellPlant(state, industry, region, here + 1)).toMatch(/not that many/);
    const corrupt = { ...state, economy: { ...state.economy, corruption: 100 } };
    expect(validateSellPlant(corrupt, industry, null, 1)).toMatch(/business climate/);
    const glut = {
      ...state,
      market: {
        ...state.market,
        prices: Object.fromEntries(
          Object.keys(state.market.prices).map((g) => [g, 0]),
        ) as GameState['market']['prices'],
      },
    };
    expect(validateSellPlant(glut, industry, null, 1)).toMatch(/loses money/);
    expect(validateSellPlant(state, industry, null, 1)).toBeNull();
  });
});

describe('v14 → v15 migration', () => {
  it('adds the plant-sales receipt line, empty, this month and last', () => {
    const none = { licenceFees: 0, tradeSales: 0, refunds: 0, events: 0, reparations: 0 };
    const v15 = MIGRATIONS[14]!({
      schemaVersion: 14,
      economy: { receipts: { ...none, refunds: 5 }, lastMonth: { totalRevenue: 1, receipts: { ...none, events: 2 } } },
    }) as {
      schemaVersion: number;
      economy: { receipts: Record<string, number>; lastMonth: { receipts: Record<string, number> } };
    };
    expect(v15.schemaVersion).toBe(15);
    expect(v15.economy.receipts).toEqual({ ...noReceipts(), refunds: 5 });
    expect(v15.economy.lastMonth.receipts).toEqual({ ...noReceipts(), events: 2 });
    const fresh = MIGRATIONS[14]!({ schemaVersion: 14, economy: { receipts: none, lastMonth: null } }) as {
      economy: { lastMonth: null };
    };
    expect(fresh.economy.lastMonth).toBeNull();
  });
});
