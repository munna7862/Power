import { GOOD_CONTENT, INDUSTRY_CONTENT } from '../content/goods';
import { PLANT_CONTENT } from '../content/power';
import {
  FUELS,
  GOODS,
  INDUSTRIES,
  PLANTS,
  REGIONS,
  SECTORS,
  type FuelId,
  type GoodId,
  type IndustryId,
  type SectorId,
} from '../content/ids';
import { SECTOR_START_SHARE, START_CORRUPTION, START_GDP, START_POPULATION } from '../economy/constants';
import { openingEnergy, shortfall } from '../energy/grid';
import { openingInfrastructure } from '../infrastructure/coverage';
import type { Driver, Explained } from '../security/unrest';
import type { GameState, IndustryState, MarketState, SettledFlows } from '../state/types';
import {
  CLIMATE,
  DEFAULT_TARIFF,
  GOODS_DEMAND_ELASTICITY,
  GOODS_INFLATION,
  STOCK_TARGET_MONTHS,
  STORAGE_MONTHS,
} from './constants';
import { OPENING_DEMAND, OPENING_PLANTS, openingStocks, ownedCount, plantCount } from './opening';

/**
 * The goods economy, settled once a month by one pure function shared by the monthly system, the budget
 * projection, the Industry and Trade screens and the bots. Plants run in content order, drawing inputs and power;
 * power stations burn fuel; the country buys what it needs; the private market imports whatever stocks fall short
 * of their target (unless banned or over quota); value added feeds sector growth and profits feed the treasury.
 * Every effect is measured against the opening settlement, so a new game starts unchanged.
 */

type FlowInputs = Pick<GameState, 'industry' | 'market' | 'energy' | 'economy' | 'nation' | 'infrastructure'>;

const zero = <K extends string>(ids: readonly K[]) => Object.fromEntries(ids.map((k) => [k, 0])) as Record<K, number>;

export const realOutput = (state: Pick<GameState, 'economy'>): number =>
  Object.values(state.economy.sectors).reduce((s, x) => s + x.output, 0);

/** Domestic demand for a good, units a month: its opening level, growing with real GDP. */
export const goodDemand = (state: Pick<GameState, 'economy'>, good: GoodId): number =>
  OPENING_DEMAND[good] * (realOutput(state) / START_GDP) ** GOODS_DEMAND_ELASTICITY;

/** Units the private market may still import this month (Infinity without a quota; 0 when banned). */
const importRoom = (market: MarketState, good: GoodId, imported: number): number => {
  const c = market.controls[good];
  if (c.ban === 'import') return 0;
  return c.quota === null ? Infinity : Math.max(0, c.quota - imported);
};

/** One plant's output less inputs at the given prices, ₹ crore a month. */
export const unitMargin = (industry: IndustryId, price: (g: GoodId) => number): number => {
  const c = INDUSTRY_CONTENT[industry];
  const out = Object.entries(c.outputs).reduce((s, [g, q]) => s + q * price(g as GoodId), 0);
  const inp = Object.entries(c.inputs).reduce((s, [g, q]) => s + q * price(g as GoodId), 0);
  return out - inp;
};

/** One plant's monthly profit at today's world prices, at full throughput. */
export const plantProfit = (state: Pick<GameState, 'market'>, industry: IndustryId): number =>
  unitMargin(industry, (g) => state.market.prices[g]) - INDUSTRY_CONTENT[industry].upkeep;

export function computeFlows(state: FlowInputs): SettledFlows & { stocks: Record<GoodId, number> } {
  const { market } = state;
  const plants = state.industry.plants;
  const stock = { ...state.industry.stocks };
  const production = zero(GOODS);
  const use = zero(GOODS);
  const imports = zero(GOODS);
  const shortage = zero(GOODS);
  const waste = zero(GOODS);
  const throughput = zero(INDUSTRIES);
  const fuelSupply = Object.fromEntries(FUELS.map((f) => [f, 1])) as Record<FuelId, number>;
  const valueAdded = zero(SECTORS);
  let stateProfit = 0;
  let privateProfit = 0;

  /** Share of a need the stock and the import allowance can cover. */
  const coverable = (good: GoodId, need: number): number =>
    need <= 0 ? 1 : Math.min(1, (Math.max(0, stock[good]) + importRoom(market, good, imports[good])) / need);
  /** Takes goods from stock, importing what the stock lacks. The caller has checked it can be covered. */
  const draw = (good: GoodId, amount: number) => {
    use[good] += amount;
    const fromStock = Math.min(Math.max(0, stock[good]), amount);
    stock[good] -= fromStock;
    imports[good] += amount - fromStock;
  };

  const powerFactor = 1 - shortfall(state);
  for (const i of INDUSTRIES) {
    const c = INDUSTRY_CONTENT[i];
    const n = plantCount(plants, i);
    let factor = powerFactor;
    for (const [g, q] of Object.entries(c.inputs)) factor = Math.min(factor, coverable(g as GoodId, n * q));
    throughput[i] = factor;
    for (const [g, q] of Object.entries(c.inputs)) draw(g as GoodId, n * q * factor);
    for (const [g, q] of Object.entries(c.outputs)) {
      production[g as GoodId] += n * q * factor;
      stock[g as GoodId] += n * q * factor;
    }
    valueAdded[c.sector] += 12 * n * factor * unitMargin(i, (g) => GOOD_CONTENT[g].price);
    const margin = factor * unitMargin(i, (g) => market.prices[g]) - c.upkeep;
    stateProfit += ownedCount(plants, i, 'state') * margin;
    privateProfit += ownedCount(plants, i, 'private') * margin;
  }

  for (const p of PLANTS) {
    const c = PLANT_CONTENT[p];
    if (!c.fuel) continue;
    const need = REGIONS.reduce((s, r) => s + state.energy.plants[r][p], 0) * c.fuelUse;
    const share = coverable(c.fuel, need);
    fuelSupply[c.fuel] = Math.min(fuelSupply[c.fuel], share);
    draw(c.fuel, need * share);
  }

  const demand = Object.fromEntries(GOODS.map((g) => [g, goodDemand(state, g)])) as Record<GoodId, number>;
  for (const g of GOODS) {
    const served = demand[g] * coverable(g, demand[g]);
    shortage[g] = demand[g] - served;
    const fromStock = Math.min(Math.max(0, stock[g]), served);
    stock[g] -= fromStock;
    imports[g] += served - fromStock;
    // The private market restocks to its target, within the import allowance; storage caps the rest.
    const topUp = Math.min(Math.max(0, demand[g] * STOCK_TARGET_MONTHS - stock[g]), importRoom(market, g, imports[g]));
    imports[g] += topUp;
    stock[g] += topUp;
    const cap = demand[g] * STORAGE_MONTHS;
    if (stock[g] > cap) {
      waste[g] = stock[g] - cap;
      stock[g] = cap;
    }
  }

  const customs = GOODS.reduce((s, g) => s + imports[g] * market.prices[g] * market.controls[g].tariff, 0);
  return {
    stocks: stock,
    production,
    use,
    demand,
    imports,
    shortage,
    waste,
    throughput,
    fuelSupply,
    valueAdded,
    stateProfit,
    privateProfit,
    customs,
  };
}

/** The settlement as it is stored (without the new stocks). */
export function settled(flows: ReturnType<typeof computeFlows>): SettledFlows {
  const { stocks, ...rest } = flows;
  void stocks;
  return rest;
}

// --- The opening settlement every effect is measured against ------------------------------------------------

export const openingMarket = (): MarketState => ({
  prices: Object.fromEntries(GOODS.map((g) => [g, GOOD_CONTENT[g].price])) as Record<GoodId, number>,
  controls: Object.fromEntries(GOODS.map((g) => [g, { tariff: DEFAULT_TARIFF, quota: null, ban: null }])) as Record<
    GoodId,
    MarketState['controls'][GoodId]
  >,
  volumes: {},
});

const OPENING_FLOWS: SettledFlows = (() => {
  const sectors = Object.fromEntries(
    SECTORS.map((s) => [s, { output: START_GDP * SECTOR_START_SHARE[s], growth: 0 }]),
  ) as GameState['economy']['sectors'];
  const placeholder = {
    production: zero(GOODS),
    use: zero(GOODS),
    demand: zero(GOODS),
    imports: zero(GOODS),
    shortage: zero(GOODS),
    waste: zero(GOODS),
    throughput: Object.fromEntries(INDUSTRIES.map((i) => [i, 1])) as Record<IndustryId, number>,
    fuelSupply: Object.fromEntries(FUELS.map((f) => [f, 1])) as Record<FuelId, number>,
    valueAdded: zero(SECTORS),
    stateProfit: 0,
    privateProfit: 0,
    customs: 0,
  };
  return settled(
    computeFlows({
      industry: {
        plants: OPENING_PLANTS,
        stocks: openingStocks(),
        queue: [],
        last: placeholder,
        applied: zero(SECTORS),
      },
      market: openingMarket(),
      energy: openingEnergy(),
      economy: { sectors } as GameState['economy'],
      nation: { name: '', treasury: 0, approval: 0, population: START_POPULATION },
      infrastructure: openingInfrastructure(),
    }),
  );
})();

/** The industry every game starts with: opening plants, stocks at target and the opening settlement. */
export const openingIndustry = (): IndustryState => ({
  plants: Object.fromEntries(
    REGIONS.map((r) => [r, Object.fromEntries(INDUSTRIES.map((i) => [i, { ...OPENING_PLANTS[r][i] }]))]),
  ) as IndustryState['plants'],
  stocks: openingStocks(),
  queue: [],
  last: structuredClone(OPENING_FLOWS),
  applied: { ...OPENING_FLOWS.valueAdded },
});

export const OPENING_SETTLEMENT: Readonly<SettledFlows> = OPENING_FLOWS;

// --- Effects ------------------------------------------------------------------------------------------------------

/** ₹ crore a month the treasury gains (or loses) from state plants' profits against the start. */
export const stateProfitDelta = (state: Pick<GameState, 'industry'>): number =>
  state.industry.last.stateProfit - OPENING_FLOWS.stateProfit;

/** Change in private plants' profit against the start; corporate tax applies to it. */
export const privateProfitDelta = (state: Pick<GameState, 'industry'>): number =>
  state.industry.last.privateProfit - OPENING_FLOWS.privateProfit;

/** Change in tariffs collected on imported goods against the start, ₹ crore a month. */
export const goodsCustomsDelta = (state: Pick<GameState, 'industry'>): number =>
  state.industry.last.customs - OPENING_FLOWS.customs;

/** Value of a set of quantities at base prices. */
const valueOf = (q: Record<GoodId, number>) => GOODS.reduce((s, g) => s + q[g] * GOOD_CONTENT[g].price, 0);

/** Share of domestic demand for goods (at base prices) that went unmet. */
export const shortageShareOf = (flows: SettledFlows): number =>
  valueOf(flows.demand) > 0 ? valueOf(flows.shortage) / valueOf(flows.demand) : 0;

/**
 * What each good's tariff counts for in customs on imports beyond the goods market: its share of the opening import
 * bill (crude oil above all). Fixed, so the average reflects tariff policy, not this month's volumes.
 */
export const OPENING_IMPORT_WEIGHTS: Readonly<Record<GoodId, number>> = (() => {
  const total = valueOf(OPENING_FLOWS.imports);
  return Object.fromEntries(
    GOODS.map((g) => [g, total > 0 ? (OPENING_FLOWS.imports[g] * GOOD_CONTENT[g].price) / total : 1 / GOODS.length]),
  ) as Record<GoodId, number>;
})();

/** Shortage share in the opening settlement, against which shortages are measured. */
export const OPENING_SHORTAGE_SHARE = shortageShareOf(OPENING_FLOWS);

function inflationParts(flows: SettledFlows, market: MarketState) {
  const demandValue = valueOf(flows.demand) + valueOf(flows.use);
  const importShare = demandValue > 0 ? valueOf(flows.imports) / demandValue : 0;
  const shortageShare = shortageShareOf(flows);
  const importValue = valueOf(flows.imports);
  const tariff =
    importValue > 0
      ? GOODS.reduce((s, g) => s + flows.imports[g] * GOOD_CONTENT[g].price * market.controls[g].tariff, 0) /
        importValue
      : DEFAULT_TARIFF;
  return { importShare, shortageShare, tariff };
}

const OPENING_INFLATION = inflationParts(OPENING_FLOWS, openingMarket());

/** What the goods market adds to the inflation target, with its causes (0 at the start). */
export function goodsInflation(state: Pick<GameState, 'industry' | 'market'>): Explained {
  const now = inflationParts(state.industry.last, state.market);
  const drivers: Driver[] = [
    {
      label: 'Import dependence',
      value: GOODS_INFLATION.importShare * (now.importShare - OPENING_INFLATION.importShare),
    },
    { label: 'Shortages', value: GOODS_INFLATION.shortage * now.shortageShare },
    { label: 'Tariffs', value: GOODS_INFLATION.tariff * (now.tariff - OPENING_INFLATION.tariff) },
  ];
  return { total: drivers.reduce((s, d) => s + d.value, 0), drivers };
}

/** The growth each sector gets from plants opening, closing or running short since the last settlement. */
export const industryGrowth = (state: Pick<GameState, 'industry' | 'economy'>, sector: SectorId): number =>
  (12 * (state.industry.last.valueAdded[sector] - state.industry.applied[sector])) /
  state.economy.sectors[sector].output;

/** How attractive India is to private investors (1 = the start), with its causes. */
export function businessClimate(
  state: Pick<GameState, 'budget' | 'economy' | 'security' | 'energy' | 'industry' | 'nation' | 'infrastructure'>,
): Explained {
  const unrest = Object.values(state.security.unrest).reduce((a, b) => a + b, 0) / REGIONS.length;
  const drivers: Driver[] = [
    { label: 'Baseline', value: 1 },
    { label: 'Corporate tax', value: CLIMATE.corporateTax * (state.budget.taxRates.corporate - 0.25) },
    { label: 'Power cuts', value: CLIMATE.powerCuts * shortfall(state) },
    { label: 'Corruption', value: CLIMATE.corruption * (state.economy.corruption - START_CORRUPTION) },
    { label: 'Unrest', value: CLIMATE.unrest * (unrest - 22) },
  ];
  return {
    total: Math.max(
      0,
      drivers.reduce((s, d) => s + d.value, 0),
    ),
    drivers,
  };
}

/**
 * The business climate without its corporate-tax driver: how attractive India is for reasons other than the tax
 * rate (power, corruption, unrest). Corporate tax revenue follows it; the rate's own effect is the Laffer curve.
 */
export const climateBeyondTax = (state: Parameters<typeof businessClimate>[0]): number =>
  Math.max(0, businessClimate(state).total - CLIMATE.corporateTax * (state.budget.taxRates.corporate - 0.25));

/** Units of a good above the private market's target stock: what can be sold without causing a shortage. */
export const surplus = (state: Pick<GameState, 'industry' | 'economy'>, good: GoodId): number =>
  Math.max(0, state.industry.stocks[good] - goodDemand(state, good) * STOCK_TARGET_MONTHS);

/** Jobs in plants beyond the opening ones (negative when plants have closed). */
export function industryJobs(state: Pick<GameState, 'industry'>): number {
  return INDUSTRIES.reduce(
    (s, i) => s + (plantCount(state.industry.plants, i) - plantCount(OPENING_PLANTS, i)) * INDUSTRY_CONTENT[i].jobs,
    0,
  );
}

export { plantCount, ownedCount };
