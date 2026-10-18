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

/**
 * The services each department runs. Each is rated 1–5 stars; investing in a service raises its rating, and the
 * department's average rating sets how well it is run (Phase 8 replaced ministers with this).
 */
export const DEPARTMENT_SERVICES = {
  finance: ['taxAdministration', 'treasuryManagement', 'statistics'],
  home: ['presidentialProtection', 'borderManagement', 'prisons', 'emergencyLine'],
  defence: ['armyCommand', 'logistics', 'militaryAcademies', 'veteransWelfare'],
  external: ['consularService', 'tradeDelegations', 'policyPlanning'],
  health: ['primaryCare', 'hospitalNetwork', 'diseaseControl', 'drugRegulation'],
  education: ['schoolSystem', 'higherEducation', 'vocationalTraining', 'research'],
  agriculture: ['irrigation', 'seedsAndFertiliser', 'cropInsurance', 'extensionService'],
  industry: ['industrialParks', 'standardsBureau', 'exportPromotion', 'smallBusiness'],
  disaster: ['searchAndRescue', 'engineeringUnits', 'hazardousMaterials', 'fireService'],
  intelligence: ['humanIntelligence', 'signalsIntelligence', 'analysis', 'counterIntelligence'],
  antiCorruption: ['audits', 'investigations', 'whistleblowerProtection'],
} as const satisfies Record<MinistryId, readonly string[]>;
export type ServiceId<M extends MinistryId = MinistryId> = (typeof DEPARTMENT_SERVICES)[M][number];
export const SERVICE_IDS = Object.values(DEPARTMENT_SERVICES).flat() as ServiceId[];

export const IDEOLOGIES = ['liberalism', 'socialism', 'conservatism', 'nationalism', 'technocracy'] as const;
export type IdeologyId = (typeof IDEOLOGIES)[number];

export const STRATEGIES = ['balanced', 'agrarian', 'industrial', 'servicesTech', 'defenceFirst'] as const;
export type StrategyId = (typeof STRATEGIES)[number];

export const REGIONS = ['north', 'south', 'east', 'west', 'central', 'northEast'] as const;
export type RegionId = (typeof REGIONS)[number];

/**
 * What public works provide. A region's coverage of an area is the people its facilities can serve against the
 * people who live there (Phase 8, Sprint 8.2).
 */
export const COVERAGE_AREAS = [
  'schools',
  'universities',
  'clinics',
  'hospitals',
  'water',
  'housing',
  'transport',
] as const;
export type CoverageArea = (typeof COVERAGE_AREAS)[number];

/** Public works the President can build in a region (content/facilities.json). */
export const FACILITIES = [
  'primarySchool',
  'secondarySchool',
  'university',
  'clinic',
  'districtHospital',
  'medicalCollege',
  'waterWorks',
  'housingBlock',
  'highway',
  'railLink',
] as const;
export type FacilityId = (typeof FACILITIES)[number];

/** National police formations the President can raise or disband (content/police.json). */
export const POLICE_UNITS = ['armedPolice', 'rapidResponse', 'cyberCell', 'counterTerror'] as const;
export type PoliceUnitId = (typeof POLICE_UNITS)[number];

/** Security agencies whose strength (0–100) the President funds directly. */
export const AGENCIES = [
  'intelligenceService',
  'antiCorruptionBureau',
  'borderPolice',
  'presidentialProtection',
] as const;
export type AgencyId = (typeof AGENCIES)[number];

/** Power plants the President can build in a region (content/power.json). */
export const PLANTS = ['solar', 'wind', 'coal', 'gas', 'hydro', 'nuclear'] as const;
export type PlantId = (typeof PLANTS)[number];

/** Fuels thermal and nuclear plants burn. From Sprint 8.5 they come from stocks; until then they are a running cost. */
export const FUELS = ['coal', 'gas', 'uranium'] as const;
export type FuelId = (typeof FUELS)[number];

/** Goods produced, stocked and traded (content/goods.json). */
export const GOODS = [
  'coal',
  'ironOre',
  'crudeOil',
  'gas',
  'uranium',
  'grain',
  'cotton',
  'steel',
  'textiles',
  'chemicals',
  'medicines',
  'electronics',
  'vehicles',
  'fuel',
  'food',
] as const;
export type GoodId = (typeof GOODS)[number];

/**
 * Factories, mines, fields and farms (content/industries.json), in production order: a plant's inputs are made
 * by plants earlier in the list (or imported).
 */
export const INDUSTRIES = [
  'coalMine',
  'ironMine',
  'oilField',
  'gasField',
  'uraniumMine',
  'grainFarm',
  'cottonFarm',
  'steelMill',
  'textileMill',
  'chemicalPlant',
  'gasChemicalPlant',
  'syntheticFibreMill',
  'pharmaPlant',
  'electronicsPlant',
  'vehiclePlant',
  'refinery',
  'foodPlant',
  'fertiliserPlant',
] as const;
export type IndustryId = (typeof INDUSTRIES)[number];

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
  'diplomacy',
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

/**
 * The neighbours India can go to war with, each with a military profile in content/rivals.json. They are
 * also ordinary countries in content/countries.json (the diplomacy layer), keyed by the same ISO code.
 */
export const RIVALS = ['CHN', 'PAK', 'MMR', 'BGD', 'LKA'] as const;
export type RivalId = (typeof RIVALS)[number];

/** ISO 3166 alpha-3 code from content/countries.json (validated at load in content/world.ts). */
export type CountryId = string;

/** What kind of country a diplomatic event is about. */
export const COUNTRY_PICKS = ['any', 'neighbour', 'focus', 'rival', 'friend', 'hostile', 'poor'] as const;
export type CountryPick = (typeof COUNTRY_PICKS)[number];

/** Kinds of treaty and measure between India and another country. */
export const TREATY_TYPES = ['trade', 'nonAggression', 'embassy', 'sanctions'] as const;
export type TreatyType = (typeof TREATY_TYPES)[number];

/** The ways a country can feel about India: why a relation is where it is. */
export const RELATION_DRIVERS = [
  'base',
  'ideology',
  'trade',
  'embassy',
  'pact',
  'sanctions',
  'reputation',
  'incidents',
  'war',
  'tension',
] as const;
export type RelationDriver = (typeof RELATION_DRIVERS)[number];

export const DRILL_KINDS = ['land', 'air', 'naval', 'joint'] as const;
export type DrillKind = (typeof DRILL_KINDS)[number];

export const INTEL_KINDS = ['recon', 'sabotage', 'counterIntel'] as const;
export type IntelKind = (typeof INTEL_KINDS)[number];

export const TERRAINS = ['plains', 'desert', 'jungle', 'mountains', 'coast'] as const;
export type TerrainId = (typeof TERRAINS)[number];
