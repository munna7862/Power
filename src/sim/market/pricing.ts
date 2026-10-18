import { GOOD_CONTENT } from '../content/goods';
import type { CountryId, GoodId } from '../content/ids';
import { COUNTRY_CONTENT, FOCUS_IDS } from '../content/world';
import { atWarWithCountry, countryState, relationOf, sanctionsIndia } from '../diplomacy/relations';
import type { GameState } from '../state/types';
import {
  MIN_TRADE_RELATION,
  PARTNER_CAPACITY,
  PRICE_CEILING,
  PRICE_FLOOR,
  PRICE_IMPACT,
  SPREAD,
  WARM_RELATION,
} from './constants';

/**
 * Prices and partners, shared by the trades, the Trade Market screen and the bots, so the price shown is the price
 * paid. India sells at the world price less the partner's spread and buys at the world price plus it.
 */

export type TradeSide = 'sell' | 'buy';
type PriceInputs = Pick<GameState, 'diplomacy' | 'market'>;

/** The countries India can trade goods with: the focus nations. */
export const TRADE_PARTNERS: readonly CountryId[] = FOCUS_IDS;

/** Why a country will not trade goods with India now, or null. */
export function partnerProblem(state: Pick<GameState, 'diplomacy' | 'military'>, id: CountryId): string | null {
  const c = COUNTRY_CONTENT[id];
  if (!c || !TRADE_PARTNERS.includes(id)) return `${id} is not a trading partner.`;
  if (atWarWithCountry(state, id)) return `India is at war with ${c.name}.`;
  const cs = countryState(state, id);
  if (cs.sanctioned) return `India has sanctions on ${c.name}.`;
  if (sanctionsIndia(state, id)) return `${c.name} has sanctions on India.`;
  if (cs.relation < MIN_TRADE_RELATION) return `Relations with ${c.name} are too poor to trade.`;
  if (!cs.embassy && cs.relation < WARM_RELATION) return `Open an embassy in ${c.name} or improve relations to trade.`;
  return null;
}

export interface SpreadLine {
  label: string;
  value: number;
}

/** The partner's spread on a good and why: what it adds to (buying) or takes off (selling) the world price. */
export function spreadOf(
  state: PriceInputs,
  id: CountryId,
  good: GoodId,
  side: TradeSide,
): { total: number; lines: SpreadLine[] } {
  const c = COUNTRY_CONTENT[id];
  const strong = c?.strengths.includes(GOOD_CONTENT[good].sector) ?? false;
  const lines: SpreadLine[] = [
    { label: 'Trading margin', value: SPREAD.base },
    { label: 'Relation', value: SPREAD.relation * relationOf(state, id) },
    { label: 'Distance', value: c?.neighbour ? 0 : SPREAD.distance },
    { label: 'Reputation', value: SPREAD.reputation * (state.diplomacy.reputation - 50) },
    {
      label: strong ? 'Strong in this sector' : 'Not a producer',
      value: strong ? (side === 'buy' ? -1 : 1) * SPREAD.strength : 0,
    },
  ];
  const total = Math.max(
    SPREAD.min,
    Math.min(
      SPREAD.max,
      lines.reduce((s, l) => s + l.value, 0),
    ),
  );
  return { total, lines };
}

/** ₹ crore per unit the partner pays (India sells) or charges (India buys). */
export function partnerPrice(state: PriceInputs, id: CountryId, good: GoodId, side: TradeSide): number {
  const spread = spreadOf(state, id, good, side).total;
  return state.market.prices[good] * (side === 'sell' ? 1 - spread : 1 + spread);
}

/** Units of a good a partner can still take or supply this month. */
export function partnerCapacity(state: Pick<GameState, 'market'>, id: CountryId, good: GoodId): number {
  const power = COUNTRY_CONTENT[id]?.power ?? 0;
  const limit = GOOD_CONTENT[good].market * (power / 100) * PARTNER_CAPACITY;
  return Math.max(0, limit - (state.market.volumes[`${id}:${good}`] ?? 0));
}

export interface Quote {
  partner: CountryId;
  price: number;
  capacity: number;
}

/** Every partner willing to trade a good, best price first. */
export function quotes(
  state: Pick<GameState, 'diplomacy' | 'market' | 'military'>,
  good: GoodId,
  side: TradeSide,
): Quote[] {
  return TRADE_PARTNERS.filter((id) => !partnerProblem(state, id))
    .map((partner) => ({
      partner,
      price: partnerPrice(state, partner, good, side),
      capacity: partnerCapacity(state, partner, good),
    }))
    .filter((q) => q.capacity > 0)
    .sort((a, b) => (side === 'sell' ? b.price - a.price : a.price - b.price));
}

/** The world price after a trade: selling pushes it down, buying pushes it up. */
export function priceAfterTrade(
  state: Pick<GameState, 'market'>,
  good: GoodId,
  quantity: number,
  side: TradeSide,
  impact = PRICE_IMPACT,
): number {
  const base = GOOD_CONTENT[good].price;
  const moved =
    state.market.prices[good] * (1 + (side === 'buy' ? 1 : -1) * impact * (quantity / GOOD_CONTENT[good].market));
  return Math.max(base * PRICE_FLOOR, Math.min(base * PRICE_CEILING, moved));
}
