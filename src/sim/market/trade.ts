import { GOOD_CONTENT } from '../content/goods';
import { GOODS, type CountryId, type GoodId } from '../content/ids';
import { COUNTRY_CONTENT } from '../content/world';
import { adjustRelation, relationOf } from '../diplomacy/relations';
import { signTreaty } from '../diplomacy/treaties';
import { groupIndian } from '../engine/numberFormat';
import type { Rng } from '../engine/rng';
import { surplus } from '../industry/flows';
import { appendLog } from '../state/log';
import { INDIA, type GameState, type TradeBan, type TradeControl, type Treaty } from '../state/types';
import {
  MAX_CONTRACT_YEARS,
  MAX_SUPPLY_CONTRACTS,
  PRICE_IMPACT,
  PRICE_NOISE,
  PRICE_REVERSION,
  WORLD_MARKET_DISCOUNT,
} from './constants';
import { partnerCapacity, partnerPrice, partnerProblem, priceAfterTrade, quotes, type TradeSide } from './pricing';
import { MAX_TARIFF } from '../industry/constants';

/**
 * The President's trades. Goods come from (or go into) the national stocks; money goes to (or comes from) the
 * treasury. Each trade moves the world price and uses up the partner's capacity for the month, so there is no way
 * to buy low and sell high within a month.
 */

const name = (id: CountryId) => COUNTRY_CONTENT[id]?.name ?? id;
const units = (good: GoodId, q: number) =>
  `${fmt(q)} ${GOOD_CONTENT[good].unit} of ${GOOD_CONTENT[good].name.toLowerCase()}`;
const fmt = (q: number) => (q >= 100 ? groupIndian(q) : String(Math.round(q * 100) / 100));
const crore = (v: number) => `₹${groupIndian(v)} crore`;

const positive = (q: number) => Number.isFinite(q) && q > 0;
const known = (good: GoodId) => GOODS.includes(good);

function record(
  state: GameState,
  partner: CountryId | null,
  good: GoodId,
  quantity: number,
  side: TradeSide,
  impact = PRICE_IMPACT,
): GameState {
  const key = partner ? `${partner}:${good}` : null;
  return {
    ...state,
    market: {
      ...state.market,
      prices: { ...state.market.prices, [good]: priceAfterTrade(state, good, quantity, side, impact) },
      volumes: key
        ? { ...state.market.volumes, [key]: (state.market.volumes[key] ?? 0) + quantity }
        : state.market.volumes,
    },
  };
}

const moveStock = (state: GameState, good: GoodId, delta: number): GameState => ({
  ...state,
  industry: {
    ...state.industry,
    stocks: { ...state.industry.stocks, [good]: Math.max(0, state.industry.stocks[good] + delta) },
  },
});

const moveTreasury = (state: GameState, delta: number): GameState => ({
  ...state,
  nation: { ...state.nation, treasury: state.nation.treasury + delta },
});

/** Why India cannot trade this good with this partner now (either way), or null. */
function tradeProblem(
  state: GameState,
  good: GoodId,
  partner: CountryId,
  quantity: number,
  side: TradeSide,
): string | null {
  if (!known(good)) return `Unknown good ${good}.`;
  if (!positive(quantity)) return 'Choose a quantity above zero.';
  const ban = state.market.controls[good].ban;
  if (ban === (side === 'sell' ? 'export' : 'import'))
    return `${side === 'sell' ? 'Exports' : 'Imports'} of ${GOOD_CONTENT[good].name.toLowerCase()} are banned.`;
  const problem = partnerProblem(state, partner);
  if (problem) return problem;
  if (quantity > partnerCapacity(state, partner, good) + 1e-9) {
    return `${name(partner)} can only ${side === 'sell' ? 'take' : 'supply'} ${fmt(partnerCapacity(state, partner, good))} ${GOOD_CONTENT[good].unit} more this month.`;
  }
  return null;
}

/**
 * Only the surplus (stock above the private market's target) can be sold: selling below it would just make the
 * market import the gap again, turning the national stocks into a free source of money.
 */
const beyondSurplus = (state: GameState, good: GoodId, quantity: number): string | null =>
  quantity > surplus(state, good) + 1e-9
    ? `Only the surplus can be sold (${fmt(surplus(state, good))} ${GOOD_CONTENT[good].unit}); the rest keeps the country supplied.`
    : null;

export function validateSell(state: GameState, good: GoodId, partner: CountryId, quantity: number): string | null {
  return tradeProblem(state, good, partner, quantity, 'sell') ?? beyondSurplus(state, good, quantity);
}

export function sellGoods(state: GameState, good: GoodId, partner: CountryId, quantity: number): GameState {
  const revenue = Math.round(quantity * partnerPrice(state, partner, good, 'sell'));
  const next = moveTreasury(moveStock(record(state, partner, good, quantity, 'sell'), good, -quantity), revenue);
  return appendLog(next, {
    severity: 'good',
    category: 'diplomacy',
    title: `Sold to ${name(partner)}`,
    body: `${units(good, quantity)} sold for ${crore(revenue)}.`,
  });
}

export function validateBuy(state: GameState, good: GoodId, partner: CountryId, quantity: number): string | null {
  const problem = tradeProblem(state, good, partner, quantity, 'buy');
  if (problem) return problem;
  return state.nation.treasury < quantity * partnerPrice(state, partner, good, 'buy')
    ? 'The treasury cannot cover this purchase.'
    : null;
}

export function buyGoods(state: GameState, good: GoodId, partner: CountryId, quantity: number): GameState {
  const cost = Math.round(quantity * partnerPrice(state, partner, good, 'buy'));
  const next = moveTreasury(moveStock(record(state, partner, good, quantity, 'buy'), good, quantity), -cost);
  return appendLog(next, {
    severity: 'info',
    category: 'diplomacy',
    title: `Bought from ${name(partner)}`,
    body: `${units(good, quantity)} bought for ${crore(cost)} and added to the national stocks.`,
  });
}

/** What selling every good's surplus to its best buyers would raise, good by good, without changing anything. */
export function surplusPlan(state: GameState): { good: GoodId; partner: CountryId; quantity: number }[] {
  const plan: { good: GoodId; partner: CountryId; quantity: number }[] = [];
  for (const good of GOODS) {
    if (state.market.controls[good].ban === 'export') continue;
    let left = surplus(state, good);
    for (const q of quotes(state, good, 'sell')) {
      if (left <= 1e-9) break;
      const quantity = Math.min(left, q.capacity);
      plan.push({ good, partner: q.partner, quantity });
      left -= quantity;
    }
  }
  return plan;
}

export const validateSellAll = (state: GameState): string | null =>
  surplusPlan(state).length === 0 ? 'There is no surplus a partner will take this month.' : null;

/** Sells each good's surplus (stock above the private market's target) to the best-paying partners. */
export function sellAllSurplus(state: GameState): GameState {
  let next = state;
  let revenue = 0;
  for (const step of surplusPlan(state)) {
    const value = Math.round(step.quantity * partnerPrice(next, step.partner, step.good, 'sell'));
    revenue += value;
    next = moveTreasury(
      moveStock(record(next, step.partner, step.good, step.quantity, 'sell'), step.good, -step.quantity),
      value,
    );
  }
  return appendLog(next, {
    severity: 'good',
    category: 'diplomacy',
    title: 'Surplus sold',
    body: `The national stocks' surplus was sold to the best-paying partners for ${crore(revenue)}.`,
  });
}

export function validateWorldSale(state: GameState, good: GoodId, quantity: number): string | null {
  if (!known(good)) return `Unknown good ${good}.`;
  if (!positive(quantity)) return 'Choose a quantity above zero.';
  if (state.market.controls[good].ban === 'export')
    return `Exports of ${GOOD_CONTENT[good].name.toLowerCase()} are banned.`;
  return beyondSurplus(state, good, quantity);
}

/** Sells any quantity on the open world market, at a discount and with a larger effect on the price. */
export function sellOnWorldMarket(state: GameState, good: GoodId, quantity: number): GameState {
  const revenue = Math.round(quantity * state.market.prices[good] * WORLD_MARKET_DISCOUNT);
  const next = moveTreasury(
    moveStock(record(state, null, good, quantity, 'sell', 2 * PRICE_IMPACT), good, -quantity),
    revenue,
  );
  return appendLog(next, {
    severity: 'info',
    category: 'diplomacy',
    title: 'Sold on the world market',
    body: `${units(good, quantity)} sold to whoever would buy, for ${crore(revenue)}.`,
  });
}

export function validateControl(good: GoodId, control: TradeControl): string | null {
  if (!known(good)) return `Unknown good ${good}.`;
  if (!Number.isFinite(control.tariff) || control.tariff < 0 || control.tariff > MAX_TARIFF)
    return 'A tariff runs from 0% to 100%.';
  if (control.quota !== null && !(Number.isFinite(control.quota) && control.quota >= 0))
    return 'A quota must be zero or more.';
  if (control.ban !== null && !(['export', 'import'] as TradeBan[]).includes(control.ban))
    return 'A ban is on exports or imports.';
  return null;
}

export function setControl(state: GameState, good: GoodId, control: TradeControl): GameState {
  const g = GOOD_CONTENT[good].name.toLowerCase();
  const parts = [
    `tariff ${Math.round(control.tariff * 100)}%`,
    control.quota === null
      ? 'no import quota'
      : `import quota ${fmt(control.quota)} ${GOOD_CONTENT[good].unit} a month`,
    control.ban === null ? 'no ban' : `${control.ban}s banned`,
  ];
  return appendLog(
    { ...state, market: { ...state.market, controls: { ...state.market.controls, [good]: { ...control } } } },
    {
      severity: 'info',
      category: 'economy',
      title: `Trade rules for ${g}`,
      body: `New rules for ${g}: ${parts.join(', ')}.`,
    },
  );
}

// --- Standing supply contracts --------------------------------------------------------------------------------

/** Goods contracts are trade treaties with a good in their terms (sector contracts have none). */
export const supplyContracts = (state: Pick<GameState, 'diplomacy'>): Treaty[] =>
  state.diplomacy.treaties.filter((t) => t.type === 'trade' && t.terms.good !== undefined);

export function validateContract(
  state: GameState,
  good: GoodId,
  partner: CountryId,
  side: TradeSide,
  quantity: number,
  years: number,
): string | null {
  const problem = tradeProblem(state, good, partner, quantity, side);
  if (problem) return problem;
  if (!Number.isInteger(years) || years < 1 || years > MAX_CONTRACT_YEARS)
    return `A contract runs 1 to ${MAX_CONTRACT_YEARS} years.`;
  if (supplyContracts(state).length >= MAX_SUPPLY_CONTRACTS)
    return `India can hold at most ${MAX_SUPPLY_CONTRACTS} supply contracts.`;
  if (supplyContracts(state).some((t) => t.parties.includes(partner) && t.terms.good === good)) {
    return `There is already a ${GOOD_CONTENT[good].name.toLowerCase()} contract with ${name(partner)}.`;
  }
  if (relationOf(state, partner) < 0) return `${name(partner)} will not commit to a contract while relations are cold.`;
  return null;
}

/** Signs a standing contract at today's partner price, through the one path every treaty takes. */
export function signContract(
  state: GameState,
  good: GoodId,
  partner: CountryId,
  side: TradeSide,
  quantity: number,
  years: number,
): GameState {
  const price = partnerPrice(state, partner, good, side);
  const next = signTreaty(state, {
    type: 'trade',
    parties: [INDIA, partner],
    years,
    terms: { good, side, quantity, price },
  });
  return appendLog(next, {
    severity: 'good',
    category: 'diplomacy',
    title: `Supply contract with ${name(partner)}`,
    body: `For ${years} year${years === 1 ? '' : 's'}, India ${side === 'sell' ? 'sells' : 'buys'} ${units(good, quantity)} a month at ₹${fmt(price)} crore per ${GOOD_CONTENT[good].unit}.`,
  });
}

/**
 * Monthly: every contract delivers. A sale ships what the stocks hold (up to the contracted amount); a purchase
 * arrives if the treasury can pay. A contract India cannot honour costs a little goodwill.
 */
export function deliverContracts(state: GameState): GameState {
  let next = state;
  for (const t of supplyContracts(state)) {
    const { good, side, quantity, price } = t.terms;
    if (!good || !side || !quantity || price === undefined) continue;
    const partner = t.parties[0] === INDIA ? t.parties[1] : t.parties[0];
    if (side === 'sell') {
      // A sale ships only surplus, like any other sale.
      const shipped = Math.min(quantity, surplus(next, good));
      next = moveTreasury(moveStock(next, good, -shipped), Math.round(shipped * price));
      if (shipped < quantity * 0.999) next = adjustRelation(next, partner, -1);
    } else if (next.nation.treasury >= quantity * price) {
      next = moveTreasury(moveStock(next, good, quantity), -Math.round(quantity * price));
    } else {
      next = adjustRelation(next, partner, -1);
    }
  }
  return next;
}

/** Monthly: world prices drift back toward their base with some noise (one draw per good), and capacities reset. */
export function settleMarket(state: GameState, rng: Rng): GameState {
  const prices = { ...state.market.prices };
  for (const g of GOODS) {
    const base = GOOD_CONTENT[g].price;
    const noise = rng.range(-PRICE_NOISE, PRICE_NOISE);
    prices[g] = (prices[g] + (base - prices[g]) * PRICE_REVERSION) * (1 + noise);
  }
  return { ...state, market: { ...state.market, prices, volumes: {} } };
}
