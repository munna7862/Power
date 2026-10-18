import type {
  AgencyId,
  ApprovalFactor,
  DomainId,
  DrillKind,
  FacilityId,
  FuelId,
  GoodId,
  IndustryId,
  IntelKind,
  CountryId,
  RivalId,
  TreatyType,
  UnitId,
  IdeologyId,
  LogCategory,
  MinistryId,
  OperationKind,
  PlantId,
  PoliceUnitId,
  RegionId,
  ServiceId,
  SectorId,
  StrategyId,
  TaxId,
} from '../content/ids';
import type { GameDate } from '../engine/calendar';
import type { Modifier } from '../engine/modifiers';
import type { RngState } from '../engine/rng';

/** Bump when GameState changes shape, and register a migration in save/migrations.ts. */
export const SCHEMA_VERSION = 16;

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** A presidential term is five years. */
export const TERM_YEARS = 5;
/** Monthly snapshots kept for charts (10 years). */
export const HISTORY_LIMIT = 120;
/** Inbox entries kept before the oldest are dropped. */
export const LOG_LIMIT = 400;

/** Optional rules picked on the New Game screen, next to the difficulty. */
export interface GameOptions {
  /** No country ever goes to war with India, and India cannot declare war. */
  noWars: boolean;
  /** Unrest never boils over into riots. */
  noRiots: boolean;
  /** The guided tutorial runs: a practice decision arrives in the first week. */
  tutorial: boolean;
  /**
   * Regional play: the President builds and polices region by region. Off, they run one India: the six regions stay
   * in the simulation, but orders go where they are needed most and the game speaks only of India (Sprint 8.10).
   */
  regions: boolean;
}

export const DEFAULT_OPTIONS: GameOptions = { noWars: false, noRiots: false, tutorial: false, regions: true };

export interface GameMeta {
  seed: number;
  difficulty: Difficulty;
  options: GameOptions;
  presidentName: string;
  startDate: GameDate;
  /** True once a re-elected President chose to stay on with no further elections (endless mode). */
  endless: boolean;
}

export interface ClockState {
  /** Days elapsed since the start of the game. */
  tick: number;
  date: GameDate;
}

export const GAME_OVER_CAUSES = [
  'impeachment',
  'coup',
  'assassination',
  'bankruptcy',
  'defeat',
  'nuclear',
  'votedOut',
  'reelected',
] as const;
export type GameOverCause = (typeof GAME_OVER_CAUSES)[number];

/** Ways a game can end that count as a win. */
export const VICTORY_CAUSES: readonly GameOverCause[] = ['reelected'];
/** Ways a game can end that mean the President served the full term. */
export const TERM_COMPLETE_CAUSES: readonly GameOverCause[] = ['reelected', 'votedOut'];

export type GameStatus =
  { kind: 'playing' } | { kind: 'over'; cause: GameOverCause; date: GameDate; title: string; summary: string };

export interface NationState {
  name: string;
  /** Cash balance in ₹ crore. Deficits beyond it are borrowed (see economy.debt). */
  treasury: number;
  /** Public approval of the President, 0–100. */
  approval: number;
  population: number;
}

export interface SectorState {
  /** Annual real output in ₹ crore at start-of-game prices. */
  output: number;
  /** Real growth applied in the last month, annualised. */
  growth: number;
}

export const REVENUE_LINES = ['income', 'corporate', 'gst', 'customs', 'nonTax'] as const;
export type RevenueLine = (typeof REVENUE_LINES)[number];

export type ExpenditureLine = MinistryId | 'establishment' | 'interest';

/**
 * One-off money the treasury receives outside the revenue lines: licence fees from investors, Trade Market sales
 * (single trades, surplus sales and supply contracts), state plants sold to investors, refunds on cancelled
 * projects, windfalls from events and war reparations. Loans are borrowing, not receipts, and are not counted.
 */
export const RECEIPT_SOURCES = ['licenceFees', 'tradeSales', 'plantSales', 'refunds', 'events', 'reparations'] as const;
export type ReceiptSource = (typeof RECEIPT_SOURCES)[number];

/** The fiscal settlement of the most recently closed month, in ₹ crore. */
export interface FiscalMonth {
  revenue: Record<RevenueLine, number>;
  expenditure: Record<ExpenditureLine, number>;
  totalRevenue: number;
  totalExpenditure: number;
  /** totalRevenue − totalExpenditure */
  balance: number;
  borrowed: number;
  repaid: number;
  /** One-off receipts during the month, outside the revenue lines (not in totalRevenue or balance). */
  receipts: Record<ReceiptSource, number>;
}

export interface EconomyState {
  sectors: Record<SectorId, SectorState>;
  /** Price level relative to the start of the game (1 = start). */
  priceIndex: number;
  /** Annual inflation rate (0.05 = 5%). */
  inflation: number;
  /** Unemployment rate (0.078 = 7.8%). */
  unemployment: number;
  /** Smoothed annual real GDP growth. */
  realGrowth: number;
  /** Public debt in ₹ crore. */
  debt: number;
  /** Average interest rate on public debt. */
  interestRate: number;
  /** National corruption index, 0 (clean) – 100 (rotten). */
  corruption: number;
  /** Human Development Index, 0–1. */
  hdi: number;
  lastMonth: FiscalMonth | null;
  /** One-off receipts so far this month; the fiscal settlement records them in lastMonth and clears them. */
  receipts: Record<ReceiptSource, number>;
  /** Loans from countries and the international lender (Sprint 8.8), outside public debt until they fall due. */
  loans: Loan[];
}

/** A country lends by ISO code; 'intl' is the international lender. */
export type LoanLender = CountryId | 'intl';

export interface Loan {
  id: string;
  lender: LoanLender;
  /** ₹ crore, repaid in full on the due date. */
  principal: number;
  /** Yearly interest rate, fixed when the loan is taken. */
  rate: number;
  startTick: number;
  dueTick: number;
}

export interface BudgetState {
  /** Statutory tax rates (0.2 = 20%). */
  taxRates: Record<TaxId, number>;
  /** Ministry allocations as a share of nominal GDP (0.01 = 1% of GDP per year). */
  allocations: Record<MinistryId, number>;
  /** Tick of the last enacted budget, or null if the opening budget is unchanged. */
  lastEnactedTick: number | null;
}

/** A service upgrade under way: the service gains a star when it completes. */
export interface ServiceUpgrade {
  id: string;
  department: MinistryId;
  service: ServiceId;
  endsTick: number;
}

/** How well each department is run: its services' star ratings (1–5), set by investment (Phase 8). */
export interface DepartmentsState {
  stars: Record<MinistryId, Partial<Record<ServiceId, number>>>;
  /** Consecutive monthly settlements a department has been badly underfunded; at the limit a star is lost. */
  underfundedMonths: Record<MinistryId, number>;
  upgrades: ServiceUpgrade[];
}

/** Facilities under construction: they open (and start costing upkeep) when the order completes. */
export interface BuildOrder {
  id: string;
  facility: FacilityId;
  /** Null for an order placed for all of India: it opens where coverage is thinnest (Sprint 8.10). */
  region: RegionId | null;
  quantity: number;
  /** ₹ crore paid when ordered, for the partial refund on cancelling. */
  cost: number;
  startedTick: number;
  endsTick: number;
}

/** Public works in each region (Phase 8): schools, hospitals, water, housing and transport. */
export interface InfrastructureState {
  counts: Record<RegionId, Record<FacilityId, number>>;
  queue: BuildOrder[];
}

/** Power plants under construction: they start generating when the order completes. */
export interface PlantOrder {
  id: string;
  plant: PlantId;
  region: RegionId;
  quantity: number;
  /** ₹ crore paid when ordered, for the partial refund on cancelling. */
  cost: number;
  startedTick: number;
  endsTick: number;
}

/** Power plants in each region (Phase 8). The grid is national: production and demand are derived. */
export interface EnergyState {
  plants: Record<RegionId, Record<PlantId, number>>;
  queue: PlantOrder[];
}

export type PlantOwner = 'state' | 'private';

/** A state plant being built, or a licensed private plant on its way. */
export interface IndustryOrder {
  id: string;
  industry: IndustryId;
  region: RegionId;
  owner: PlantOwner;
  quantity: number;
  /** ₹ crore paid (state builds), for the partial refund on cancelling; 0 for licences. */
  cost: number;
  startedTick: number;
  endsTick: number;
}

/** The goods market as last settled: what moved, what was missing and what it earned. Units a month. */
export interface SettledFlows {
  production: Record<GoodId, number>;
  use: Record<GoodId, number>;
  demand: Record<GoodId, number>;
  imports: Record<GoodId, number>;
  /** Demand that could not be met because imports were banned or over quota. */
  shortage: Record<GoodId, number>;
  /** Production that did not fit in storage. */
  waste: Record<GoodId, number>;
  /** Share of full output each industry ran at (inputs, power), 0–1. */
  throughput: Record<IndustryId, number>;
  /** Share of power stations' fuel that was available, 0–1. */
  fuelSupply: Record<FuelId, number>;
  /** Real value added by sector at start-of-game prices, ₹ crore a year. */
  valueAdded: Record<SectorId, number>;
  /** Operating profit at today's prices, ₹ crore a month. */
  stateProfit: number;
  privateProfit: number;
  /** Tariffs collected on imported goods, ₹ crore a month. */
  customs: number;
}

/** Factories, mines, fields and farms, and the goods they make (Phase 8). */
export interface IndustryState {
  plants: Record<RegionId, Record<IndustryId, Record<PlantOwner, number>>>;
  stocks: Record<GoodId, number>;
  queue: IndustryOrder[];
  last: SettledFlows;
  /** Value added already folded into sector output; the gap to `last.valueAdded` is the industry growth driver. */
  applied: Record<SectorId, number>;
}

export type TradeBan = 'export' | 'import';

export interface TradeControl {
  /** Tariff on imports, 0–1. */
  tariff: number;
  /** Most units the private market may import a month, or null for no limit. */
  quota: number | null;
  ban: TradeBan | null;
}

/** World prices and India's trade controls (Phase 8). */
export interface MarketState {
  /** World price of each good, ₹ crore per unit. */
  prices: Record<GoodId, number>;
  controls: Record<GoodId, TradeControl>;
  /** Units traded with each partner this month, keyed "<country>:<good>". Reset monthly. */
  volumes: Record<string, number>;
  /** What each supply contract delivered at the last monthly delivery, keyed by treaty id (v16). */
  deliveries: Record<string, ContractDelivery>;
}

/** One supply contract's last monthly delivery. */
export interface ContractDelivery {
  /** Units shipped (a sale) or received (a purchase). */
  quantity: number;
  /** Units the contract promised a month. */
  promised: number;
  /** ₹ crore earned (a sale) or paid (a purchase). */
  value: number;
}

export type EquipmentTier = 1 | 2 | 3;

/** The police and the security agencies, run directly by the President (Phase 8). */
export interface PoliceState {
  officers: Record<RegionId, number>;
  stations: Record<RegionId, number>;
  equipment: EquipmentTier;
  units: Record<PoliceUnitId, number>;
  /** Strength of each agency, 0–100 (50 at the start). */
  agencies: Record<AgencyId, number>;
}

export interface PoliticsState {
  ideology: IdeologyId;
  strategy: StrategyId;
  ideologyChangedTick: number | null;
  strategyChangedTick: number | null;
  /** Consecutive monthly settlements with approval below the impeachment threshold. */
  lowApprovalMonths: number;
  /** Voter satisfaction per factor (0–100) at the last monthly settlement. */
  satisfaction: Record<ApprovalFactor, number>;
}

export interface MonthlySnapshot {
  /** First day of the month the snapshot describes. */
  month: GameDate;
  treasury: number;
  approval: number;
  balance: number;
  /** Nominal GDP, annual rate, ₹ crore. */
  gdp: number;
  realGrowth: number;
  inflation: number;
  unemployment: number;
  debtToGdp: number;
  revenue: number;
  expenditure: number;
  corruption: number;
  hdi: number;
}

export type LogSeverity = 'info' | 'good' | 'warning' | 'critical';

export interface LogEntry {
  id: string;
  tick: number;
  date: GameDate;
  severity: LogSeverity;
  category: LogCategory;
  /** The pending decision this entry announces, if any. */
  pendingId: string | null;
  title: string;
  body: string;
  read: boolean;
}

/** A decision the President has not yet made. Text and choices come from the event's content. */
export interface PendingEvent {
  id: string;
  eventId: string;
  /** The region the event is happening in, for regional events. */
  region: RegionId | null;
  /** Extra reference, e.g. the id of the terror plot a warning is about. */
  ref: string | null;
  raisedTick: number;
  /** If undecided by this tick, the event's default choice is applied. */
  expiresTick: number;
}

/** A follow-up event waiting for its day. */
export interface ScheduledEvent {
  eventId: string;
  dueTick: number;
  region: RegionId | null;
}

export interface EventsState {
  pending: PendingEvent[];
  scheduled: ScheduledEvent[];
  /** Event id → first tick it may fire again. */
  cooldowns: Record<string, number>;
  /** Event id → ticks it fired on by random roll in the last five years, to keep repeats rare. */
  fired: Record<string, number[]>;
}

/** An audit of one department by the anti-corruption bureau. */
export interface Investigation {
  id: string;
  department: MinistryId;
  startedTick: number;
  resolvesTick: number;
}

export interface Operation {
  id: string;
  kind: OperationKind;
  startedTick: number;
  endsTick: number;
}

/** A terror plot that slipped past intelligence and will strike unless stopped. */
export interface Plot {
  id: string;
  /** Fictional group name. */
  group: string;
  region: RegionId;
  strikeTick: number;
  /** 0–1 share of the plot's chance of success removed by surveillance, raids and border sealing. */
  mitigation: number;
}

export interface SecurityState {
  /** Unrest per region, 0 (calm) – 100 (uprising). */
  unrest: Record<RegionId, number>;
  /** Crime per region, 0 (safe) – 100 (lawless). Set by jobs, corruption and policing (Phase 8). */
  crime: Record<RegionId, number>;
  /** National terror threat, 0–100. */
  terrorThreat: number;
  /** Tension with neighbours, 0–100. Follows the most hostile rival (see military/rivals.ts). */
  borderTension: number;
  /** Loyalty of the armed forces to the President, 0–100. Phase 4 takes this over. */
  militaryLoyalty: number;
  /** True while coup risk is above the warning level, so the warning is raised once. */
  coupAlert: boolean;
  /** Consecutive monthly settlements with debt above the bankruptcy threshold. */
  bankruptMonths: number;
  investigations: Investigation[];
  operations: Operation[];
  plots: Plot[];
  plotsFoiled: number;
  attacksSuffered: number;
}

/** Equipment on order, paid for from the Defence procurement fund when ordered. */
export interface ProductionOrder {
  id: string;
  unit: UnitId;
  quantity: number;
  startedTick: number;
  endsTick: number;
}

export interface ResearchProject {
  domain: DomainId;
  /** The tier being unlocked (2 or 3). */
  tier: 2 | 3;
  startedTick: number;
  endsTick: number;
}

export interface Drill {
  id: string;
  kind: DrillKind;
  startedTick: number;
  endsTick: number;
}

/** The result card of a finished drill. */
export interface DrillReport {
  kind: DrillKind;
  date: GameDate;
  readiness: number;
  morale: number;
  deterrence: number;
  accident: boolean;
}

export interface IntelOp {
  id: string;
  kind: IntelKind;
  /** The country targeted; null for counter-intelligence, which protects India. */
  target: RivalId | null;
  startedTick: number;
  endsTick: number;
}

/** What a successful recon revealed about a rival, kept as a snapshot that ages. */
export interface Sighting {
  tick: number;
  strength: number;
  readiness: number;
}

export interface RivalState {
  /** True military strength on the same index as India's. Hidden from the player behind the fog of war. */
  strength: number;
  /** 0–100; low readiness cuts effective strength. */
  readiness: number;
  /** Ticks until which the state is quietly rebuilding after a war. */
  recoverUntilTick: number | null;
  sighting: Sighting | null;
  annexed: boolean;
}

export interface FrontState {
  /** Index into the rival's fronts in content/rivals.json. */
  index: number;
  /** −100 (India routed) … +100 (enemy routed). */
  progress: number;
}

export interface DailyReport {
  tick: number;
  date: GameDate;
  /** Share of each side's strength lost today, as a percentage. */
  indiaLoss: number;
  enemyLoss: number;
  /** Personnel casualties today. */
  indiaCasualties: number;
  enemyCasualties: number;
  text: string;
}

export type WarStatus = 'active' | 'terms';

export interface War {
  id: string;
  rival: RivalId;
  declaredBy: 'india' | 'rival';
  startedTick: number;
  status: WarStatus;
  fronts: FrontState[];
  /** The enemy's strength when the war began, to measure how much of it is left. */
  enemyStartStrength: number;
  /** 0–100: how tired the public is of the war. */
  weariness: number;
  casualties: { india: number; enemy: number };
  equipmentLost: number;
  /** The enemy has offered a ceasefire that the President can accept. */
  ceasefireOffered: boolean;
  /** For status "terms": the day the default settlement (reparations) applies. */
  termsDeadlineTick: number | null;
  report: DailyReport | null;
}

export interface WarRecord {
  rival: RivalId;
  startedTick: number;
  endedTick: number;
  outcome: 'victory' | 'ceasefire' | 'peace' | 'defeat' | 'nuclear';
  settlement: string;
}

export const NUCLEAR_DOCTRINES = ['noFirstUse', 'firstUse'] as const;
export type NuclearDoctrine = (typeof NUCLEAR_DOCTRINES)[number];

export interface NuclearProgram {
  active: boolean;
  /** 0–100 each; enrichment starts once research is complete. */
  research: number;
  enrichment: number;
  warheads: number;
  doctrine: NuclearDoctrine;
  /** Months since the last warhead was completed. */
  monthsSinceWarhead: number;
}

export interface MilitaryState {
  /** Units in service. */
  forces: Record<UnitId, number>;
  /** 0–100: how quickly the forces could fight today. */
  readiness: number;
  /** 0–100: the troops' will to fight. */
  morale: number;
  /** Technology tier (1–3) of each domain. */
  tech: Record<DomainId, 1 | 2 | 3>;
  research: ResearchProject | null;
  queue: ProductionOrder[];
  drills: Drill[];
  drillReports: DrillReport[];
  /** 0–100: how strongly rivals are put off attacking. Feeds the AI nations’ utility in diplomacy/ai.ts. */
  deterrence: number;
  /** Counter-intelligence cover for India, 0–100. Rises while a counter-intelligence operation runs. */
  counterIntel: number;
  intelOps: IntelOp[];
  /** Funding of the forces against their upkeep last month (1 = exactly covered). */
  fundingRatio: number;
  rivals: Record<RivalId, RivalState>;
  wars: War[];
  warHistory: WarRecord[];
  nuclear: NuclearProgram;
}

/** The party code of India in a treaty. */
export const INDIA = 'IND';

/** How one country stands with India. The relation is the single source of truth, rivals included. */
export interface CountryState {
  /** −100 (hostile) … +100 (close friend). */
  relation: number;
  /** 0–100: lingering friction from incidents, threats, broken deals and exposed spies. Decays monthly. */
  incidents: number;
  embassy: boolean;
  /** India has imposed sanctions on this country. */
  sanctioned: boolean;
  /** Earliest tick a trade or pact proposal may be made again (after a refusal). */
  proposalReadyTick: number;
  /** Earliest tick more aid is welcome. */
  aidReadyTick: number;
}

export interface TradeTerms {
  /** The sector of India’s economy the contract boosts. */
  sector: SectorId;
  /** Annual value in ₹ crore. */
  value: number;
  /** Goods contracts (Phase 8): the good, which way it goes, units a month and the agreed price per unit. */
  good: GoodId;
  side: 'sell' | 'buy';
  quantity: number;
  price: number;
}

/** A treaty or measure between two parties: [imposer or first party, other]; India is "IND". */
export interface Treaty {
  id: string;
  type: TreatyType;
  parties: [CountryId, CountryId];
  startTick: number;
  /** Null for open-ended measures (embassies, sanctions). */
  endTick: number | null;
  terms: Partial<TradeTerms>;
}

/** A proposal from another country that waits for the President’s answer. */
export interface Offer {
  id: string;
  from: CountryId;
  type: 'trade' | 'nonAggression';
  years: number;
  terms: Partial<TradeTerms>;
  raisedTick: number;
  expiresTick: number;
}

/** A war or crisis between other countries, shown on the map. */
export interface Conflict {
  id: string;
  countries: CountryId[];
  startTick: number;
  endTick: number;
}

export const AI_ACTIONS = ['offerDeal', 'seekPact', 'threaten', 'sanction', 'declareWar', 'idle'] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

/** Why a focus nation did what it did last month, for the debug overlay. */
export interface AiDecision {
  tick: number;
  action: AiAction;
  /** True if the nation went through with the action (it only acts some months). */
  acted: boolean;
  utilities: Record<AiAction, number>;
  inputs: { relation: number; powerRatio: number; ideology: number; deterrence: number; noise: number };
}

export interface DiplomacyState {
  countries: Record<CountryId, CountryState>;
  treaties: Treaty[];
  offers: Offer[];
  conflicts: Conflict[];
  /** India’s standing in the world, 0–100. Broken treaties cost it; honoured deals and aid rebuild it. */
  reputation: number;
  /** 0–100: how tense the world is. Conflicts and shocks raise it; it decays. */
  worldTension: number;
  /** Last decision of each focus nation. */
  ai: Record<CountryId, AiDecision>;
}

export interface GameState {
  schemaVersion: typeof SCHEMA_VERSION;
  meta: GameMeta;
  clock: ClockState;
  rng: RngState;
  status: GameStatus;
  nation: NationState;
  economy: EconomyState;
  budget: BudgetState;
  departments: DepartmentsState;
  infrastructure: InfrastructureState;
  police: PoliceState;
  energy: EnergyState;
  industry: IndustryState;
  market: MarketState;
  politics: PoliticsState;
  modifiers: Modifier[];
  security: SecurityState;
  military: MilitaryState;
  diplomacy: DiplomacyState;
  events: EventsState;
  history: MonthlySnapshot[];
  log: LogEntry[];
  /** Monotonic counter for generating stable ids. */
  nextId: number;
}
