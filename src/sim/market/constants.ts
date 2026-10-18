/**
 * Trade-market tuning. A partner's price is the world price plus or minus a spread; the spread shrinks with a good
 * relation and reputation, and grows with distance. Partners strong in a good's sector sell it cheaply and pay less
 * for it.
 */
export const SPREAD = {
  base: 0.08,
  /** Per point of relation (−100…+100). */
  relation: -0.0006,
  /** Extra for partners that are not neighbours. */
  distance: 0.02,
  /** Per point of reputation above 50. */
  reputation: -0.0004,
  /** A partner strong in the good's sector: −this when India buys, +this when India sells. */
  strength: 0.03,
  min: 0,
  max: 0.3,
} as const;

/** Partners trade only with this relation or better, and without an embassy only from WARM_RELATION. */
export const MIN_TRADE_RELATION = -20;
export const WARM_RELATION = 20;

/** Share of a good's world market one partner can take or supply in a month, scaled by its power (0–100). */
export const PARTNER_CAPACITY = 0.25;

/** A trade of a good's whole monthly world market moves its world price by this share. */
export const PRICE_IMPACT = 0.02;
/** World prices stay within these multiples of the base price. */
export const PRICE_FLOOR = 0.4;
export const PRICE_CEILING = 2.5;
/** Monthly: share of the gap to the base price closed, and the largest random move either way. */
export const PRICE_REVERSION = 0.1;
export const PRICE_NOISE = 0.03;

/** Selling on the open world market: any quantity, at this share of the world price, with twice the price impact. */
export const WORLD_MARKET_DISCOUNT = 0.85;

/** Standing supply contracts with partners, separate from the sector contracts on the Diplomacy screen. */
export const MAX_SUPPLY_CONTRACTS = 6;
export const MAX_CONTRACT_YEARS = 5;
