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
  'safety',
] as const;
export type ApprovalFactor = (typeof APPROVAL_FACTORS)[number];

export const REGION_LABELS: Record<RegionId, string> = {
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
  central: 'Central',
  northEast: 'North-East',
};

/** What an event is about, for inbox filters. Unrest and terror are never framed by religion or caste. */
export const EVENT_CATEGORIES = [
  'economy',
  'personal',
  'disaster',
  'corruption',
  'unrest',
  'security',
  'terror',
  'military',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const LOG_CATEGORIES = ['general', ...EVENT_CATEGORIES] as const;
export type LogCategory = (typeof LOG_CATEGORIES)[number];

/** Counter-terror operations the President can order. */
export const OPERATION_KINDS = ['raid', 'surveillance', 'borderSeal'] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

/** Armed-forces domains. Each has its own technology tier. */
export const DOMAINS = ['land', 'air', 'sea', 'strategic'] as const;
export type DomainId = (typeof DOMAINS)[number];

export const DOMAIN_LABELS: Record<DomainId, string> = {
  land: 'Land',
  air: 'Air',
  sea: 'Sea',
  strategic: 'Strategic',
};

/** The twelve unit types: three per domain. Generic class names only. */
export const UNITS = [
  'infantry',
  'armour',
  'artillery',
  'fighter',
  'strike',
  'airDefence',
  'frigate',
  'submarine',
  'carrier',
  'missile',
  'cyber',
  'satellite',
] as const;
export type UnitId = (typeof UNITS)[number];

/** Fictional rival states. Phase 5 replaces them with the real world map. */
export const RIVALS = ['zarnak', 'tirhan', 'oruvan', 'velmora', 'haldrin'] as const;
export type RivalId = (typeof RIVALS)[number];

export const DRILL_KINDS = ['land', 'air', 'naval', 'joint'] as const;
export type DrillKind = (typeof DRILL_KINDS)[number];

export const INTEL_KINDS = ['recon', 'sabotage', 'counterIntel'] as const;
export type IntelKind = (typeof INTEL_KINDS)[number];

export const TERRAINS = ['plains', 'desert', 'jungle', 'mountains', 'coast'] as const;
export type TerrainId = (typeof TERRAINS)[number];
