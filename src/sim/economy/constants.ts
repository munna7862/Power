import type { MinistryId, SectorId, TaxId } from '../content/ids';

/**
 * Calibration constants. Starting values are rounded from public Indian macro
 * data (GDP ≈ ₹330 lakh crore, Union receipts and spending, debt ≈ 56% of GDP).
 * All money is in ₹ crore; rates are fractions per year.
 */

export const START_GDP = 33_000_000;
export const START_POPULATION = 1_441_700_000;
export const POPULATION_GROWTH = 0.008;

export const SECTOR_START_SHARE: Record<SectorId, number> = {
  agriculture: 0.17,
  industry: 0.25,
  services: 0.43,
  energy: 0.05,
  tech: 0.1,
};

/** Trend real growth of each sector before policy effects. */
export const SECTOR_BASE_GROWTH: Record<SectorId, number> = {
  agriculture: 0.035,
  industry: 0.06,
  services: 0.068,
  energy: 0.055,
  tech: 0.09,
};

/** How strongly each ministry's efficiency (1 = normal) lifts each sector's growth. */
export const SECTOR_MINISTRY_LINKS: Record<SectorId, Partial<Record<MinistryId, number>>> = {
  agriculture: { agriculture: 0.02 },
  industry: { industry: 0.025 },
  services: { industry: 0.01, education: 0.006 },
  energy: { industry: 0.02 },
  tech: { education: 0.015, industry: 0.005 },
};

export const DEFAULT_TAX_RATES: Record<TaxId, number> = {
  income: 0.2,
  corporate: 0.25,
  gst: 0.18,
  customs: 0.1,
};

export const TAX_LIMITS: Record<TaxId, { min: number; max: number }> = {
  income: { min: 0, max: 0.45 },
  corporate: { min: 0.1, max: 0.45 },
  gst: { min: 0.05, max: 0.28 },
  customs: { min: 0, max: 0.4 },
};

/** Largest change to any single tax rate in one budget. */
export const MAX_TAX_STEP = 0.05;

/**
 * Tax base as a share of GDP, calibrated so default rates raise roughly
 * income ₹12, corporate ₹10, GST ₹10 and customs ₹2.4 lakh crore a year.
 */
export const TAX_BASE_SHARE: Record<TaxId, number> = {
  income: 0.1818,
  corporate: 0.1212,
  gst: 0.1684,
  customs: 0.0727,
};

/** Rate at which avoidance makes a tax raise nothing; sets the shape of the Laffer curve. */
export const TAX_AVOIDANCE_CEILING: Record<TaxId, number> = {
  income: 0.6,
  corporate: 0.6,
  gst: 0.45,
  customs: 0.7,
};

/** Dividends, fees and other non-tax receipts, as a share of GDP. */
export const NON_TAX_REVENUE_SHARE = 0.015;
/** Pensions, salaries and other committed spending, as a share of GDP. */
export const ESTABLISHMENT_SHARE = 0.014;

export const START_DEBT_TO_GDP: Record<'easy' | 'normal' | 'hard', number> = {
  easy: 0.52,
  normal: 0.56,
  hard: 0.62,
};

/** Allocation limits as a multiple of the ministry's default share of GDP. */
export const ALLOCATION_LIMITS = { min: 0.25, max: 3 };
/** Days between budgets. */
export const BUDGET_COOLDOWN_DAYS = 30;
/** Cash buffer kept in the treasury, in months of spending. Below it the government borrows; above twice it, debt is repaid. */
export const CASH_RESERVE_MONTHS = 0.5;

export const START_INFLATION = 0.05;
export const START_UNEMPLOYMENT = 0.078;
export const START_CORRUPTION = 40;
export const START_HDI = 0.644;
export const START_REAL_GROWTH = 0.062;
