/** Production the opening fleet has over opening demand: the grid's reserve margin at the start. */
export const OPENING_MARGIN = 0.05;

/** Share of opening demand from homes, industry (industry and energy sectors), services (services and tech) and public facilities. */
export const DEMAND_SHARES = { homes: 0.33, industry: 0.42, services: 0.15, public: 0.1 } as const;
export type DemandSource = keyof typeof DEMAND_SHARES;

/**
 * How demand follows its driver (elasticities). Industry needs 0.7% more power for 1% more output; homes follow
 * population one for one and income per head at 0.4; services follow their output at 0.6; public facilities follow
 * public-works coverage one for one.
 */
export const DEMAND_ELASTICITY = { industry: 0.7, homesIncome: 0.4, services: 0.6 } as const;

/** Production above demand × (1 + this) is sold to neighbours. Below it, the surplus is kept as reserve. */
export const EXPORT_MARGIN = OPENING_MARGIN;
/** ₹ crore earned per month for each GW exported around the clock (about ₹4 a unit). */
export const EXPORT_PRICE = 290;
/**
 * ₹ crore the treasury keeps per month for each GW sold at home around the clock (about 50 paise a unit, after
 * generation costs and distribution losses). Counted with non-tax revenue against the opening sales.
 */
export const DOMESTIC_POWER_MARGIN = 36;
/** Exports smaller than this are not worth a contract. */
export const MIN_EXPORT_GW = 0.01;

/** Annual growth lost in every sector for each unit of shortfall (share of demand not met). */
export const SHORTFALL_GROWTH = -0.2;
/** Approval-target points lost for each unit of shortfall: a 10% shortfall costs 4 points. */
export const SHORTFALL_APPROVAL = -40;
/** Approval-target points per unit of emissions above the opening grid (a cleaner grid earns them back). */
export const POLLUTION_APPROVAL = -8;
/** Disaster events grow likelier by this share for each unit of emissions above the opening grid. */
export const POLLUTION_DISASTERS = 0.5;

/** Build orders that may run at once. */
export const MAX_PLANT_QUEUE = 8;
/** Most plants of one type in one order. */
export const MAX_PLANT_ORDER = 200;
/** Share of the price refunded when an order is cancelled. */
export const PLANT_CANCEL_REFUND = 0.5;
