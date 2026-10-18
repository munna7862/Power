/** Stocks the private market keeps of every good, in months of domestic demand; imports top them up to this. */
export const STOCK_TARGET_MONTHS = 2;
/** Most a good's stock can hold, in months of domestic demand; anything beyond it spoils or is dumped. */
export const STORAGE_MONTHS = 12;
/** How domestic demand for goods follows real GDP (elasticity). */
export const GOODS_DEMAND_ELASTICITY = 0.8;

/** Tariff on every good at the start, the same as the opening customs rate. */
export const DEFAULT_TARIFF = 0.1;
export const MAX_TARIFF = 1;

/**
 * Inflation from the goods market, measured against the start: imports' share of what the country uses
 * (import dependence), unmet demand (shortages) and tariffs above the opening level all raise prices.
 */
export const GOODS_INFLATION = { importShare: 0.05, shortage: 0.3, tariff: 0.05 } as const;

/** Business climate (1 = the start): what makes private investors build or close plants. */
export const CLIMATE = { corporateTax: -1.5, powerCuts: -1, corruption: -0.004, unrest: -0.004 } as const;
/**
 * Private plants opened (or closed) per year, as a share of each industry's opening private plants, for each
 * unit the climate is above (or below) 1. A climate of 1.1 adds about 5% a year.
 */
export const PRIVATE_RESPONSE = 0.5;
/** Investors ignore a climate within this much of the start: only a clear change moves them. */
export const CLIMATE_DEAD_BAND = 0.05;

/** In-game days from licence to a working private plant. */
export const LICENCE_DAYS = 45;
/** Licensed plants that may be under construction at once: investors come one or two at a time. */
export const MAX_LICENCES = 2;
/** Investors take licences only while the business climate is at least this good. */
export const LICENCE_MIN_CLIMATE = 0.95;
/**
 * Selling a state plant (disinvestment): an investor pays this many months of the plant's after-tax profit at
 * today's prices, scaled by the business climate (capped at SALE_MAX_CLIMATE). Four years is below the five of a
 * term, so a sale raises cash now and costs income later.
 */
export const SALE_MONTHS = 48;
export const SALE_MAX_CLIMATE = 1.5;

/** Build orders (state plants and licences together) that may run at once. */
export const MAX_INDUSTRY_QUEUE = 10;
/** Most state plants of one type in one order. */
export const MAX_INDUSTRY_ORDER = 20;
/** Share of the price refunded when a state build is cancelled. */
export const INDUSTRY_CANCEL_REFUND = 0.5;
