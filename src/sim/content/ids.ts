/** Stable identifiers shared by content files, state and UI. Content JSON must use exactly these ids. */

export const SECTORS = ['agriculture', 'industry', 'services', 'energy', 'tech'] as const;
export type SectorId = (typeof SECTORS)[number];

export const TAXES = ['income', 'corporate', 'gst', 'customs'] as const;
export type TaxId = (typeof TAXES)[number];

export const MINISTRIES = [
  'finance',
  'home',
  'defence',
  'external',
  'health',
  'education',
  'agriculture',
  'industry',
  'disaster',
  'intelligence',
  'antiCorruption',
] as const;
export type MinistryId = (typeof MINISTRIES)[number];

export const IDEOLOGIES = ['liberalism', 'socialism', 'conservatism', 'nationalism', 'technocracy'] as const;
export type IdeologyId = (typeof IDEOLOGIES)[number];

export const STRATEGIES = ['balanced', 'agrarian', 'industrial', 'servicesTech', 'defenceFirst'] as const;
export type StrategyId = (typeof STRATEGIES)[number];

export const REGIONS = ['north', 'south', 'east', 'west', 'central', 'northEast'] as const;
export type RegionId = (typeof REGIONS)[number];

/** Things voters judge the President on. Each is scored 0–100 every month. */
export const APPROVAL_FACTORS = [
  'jobs',
  'prices',
  'growth',
  'corruption',
  'livingStandards',
  'taxes',
  'services',
] as const;
export type ApprovalFactor = (typeof APPROVAL_FACTORS)[number];
