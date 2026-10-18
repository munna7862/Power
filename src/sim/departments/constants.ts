/** Every service starts at this rating; the department's average sets how well it is run. */
export const OPENING_STARS = 2;
export const MAX_STARS = 5;
export const MIN_STARS = 1;

/**
 * Department quality = QUALITY_BASE + QUALITY_PER_STAR × average stars. Two stars give 0.88, the quality of the
 * average v1.0 opening cabinet, so the economy starts where it always did; five stars give 1.24.
 */
export const QUALITY_BASE = 0.64;
export const QUALITY_PER_STAR = 0.12;

/** ₹ crore to raise a service to the given star rating. */
export const UPGRADE_COST_PER_STAR = 1_500;
export const UPGRADE_DAYS = 30;
/** Upgrades that may run at once across government. */
export const MAX_UPGRADES = 4;

/** Funding (allocation against the default, after spending modifiers) below which a department is underfunded. */
export const UNDERFUNDED_BELOW = 0.75;
/** Consecutive underfunded months after which the department's best service loses a star. */
export const UNDERFUNDED_MONTHS = 6;
