import type { CoverageArea, RegionId } from '../content/ids';

/** Share of India's population living in each region. Sums to 1. */
export const REGION_POPULATION_SHARE: Record<RegionId, number> = {
  north: 0.24,
  south: 0.2,
  east: 0.21,
  west: 0.16,
  central: 0.15,
  northEast: 0.04,
};

/**
 * Coverage past 100% still helps, at half the rate, up to this much: spare places shorten queues but there are
 * only so many patients and pupils. Coverage counts as at most 1 + (COVERAGE_CEILING − 1) / 2.
 */
export const COVERAGE_CEILING = 1.5;

/** What coverage feeds. Each row weighs the areas and sums to 1. */
export type CoverageEffect = 'hdi' | 'services' | 'unrest' | 'growth';

export const AREA_WEIGHTS: Record<CoverageEffect, Record<CoverageArea, number>> = {
  hdi: { schools: 0.25, universities: 0.1, clinics: 0.2, hospitals: 0.15, water: 0.2, housing: 0.1, transport: 0 },
  services: {
    schools: 0.2,
    universities: 0.05,
    clinics: 0.2,
    hospitals: 0.15,
    water: 0.15,
    housing: 0.1,
    transport: 0.15,
  },
  unrest: {
    schools: 0.15,
    universities: 0.05,
    clinics: 0.15,
    hospitals: 0.1,
    water: 0.2,
    housing: 0.25,
    transport: 0.1,
  },
  growth: { schools: 0, universities: 0.25, clinics: 0, hospitals: 0, water: 0.15, housing: 0, transport: 0.6 },
};

/**
 * How strongly a change in coverage (against the opening network) moves each outcome. A rise of 0.1 (ten points
 * of coverage across the weighted areas) adds 0.01 to the HDI target, 8 points of "public services" satisfaction,
 * takes 3 points off a region's unrest target and adds 0.3 points to annual growth.
 */
export const COVERAGE_IMPACT: Record<CoverageEffect, number> = {
  hdi: 0.1,
  services: 80,
  unrest: -30,
  growth: 0.03,
};

/** People of working age in the labour force; new facilities' staff cut unemployment by jobs ÷ this. */
export const LABOUR_FORCE = 600_000_000;

/** Build orders that may run at once. */
export const MAX_BUILD_QUEUE = 12;
/** Most facilities of one type in one order. */
export const MAX_BUILD_QUANTITY = 100_000;
/** Share of the price refunded when an order is cancelled. */
export const CANCEL_REFUND = 0.5;
