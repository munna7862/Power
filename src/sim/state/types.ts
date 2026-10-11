import type {
  ApprovalFactor,
  DomainId,
  DrillKind,
  IntelKind,
  RivalId,
  UnitId,
  IdeologyId,
  LogCategory,
  MinistryId,
  OperationKind,
  RegionId,
  SectorId,
  StrategyId,
  TaxId,
} from '../content/ids';
import type { GameDate } from '../engine/calendar';
import type { Modifier } from '../engine/modifiers';
import type { RngState } from '../engine/rng';

/** Bump when GameState changes shape, and register a migration in save/migrations.ts. */
export const SCHEMA_VERSION = 4;

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** A presidential term is five years. */
export const TERM_YEARS = 5;
/** Monthly snapshots kept for charts (10 years). */
export const HISTORY_LIMIT = 120;
/** Inbox entries kept before the oldest are dropped. */
export const LOG_LIMIT = 400;

export interface GameMeta {
  seed: number;
  difficulty: Difficulty;
  presidentName: string;
  startDate: GameDate;
}

export interface ClockState {
  /** Days elapsed since the start of the game. */
  tick: number;
  date: GameDate;
}

export const GAME_OVER_CAUSES = ['impeachment', 'coup', 'assassination', 'bankruptcy', 'defeat', 'nuclear'] as const;
export type GameOverCause = (typeof GAME_OVER_CAUSES)[number];

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
}

export interface BudgetState {
  /** Statutory tax rates (0.2 = 20%). */
  taxRates: Record<TaxId, number>;
  /** Ministry allocations as a share of nominal GDP (0.01 = 1% of GDP per year). */
  allocations: Record<MinistryId, number>;
  /** Tick of the last enacted budget, or null if the opening budget is unchanged. */
  lastEnactedTick: number | null;
}

export type Gender = 'female' | 'male';

export interface Minister {
  id: string;
  name: string;
  gender: Gender;
  region: RegionId;
  /** 0–100: how well the ministry is run. */
  competence: number;
  /** 0–100: loyalty to the President. Feeds coup risk from Phase 3. */
  loyalty: number;
  /** 0–100: share of the budget that goes missing, and scandal risk. */
  corruption: number;
  ideology: IdeologyId;
  /** Seed for the procedural portrait. */
  avatarSeed: number;
  appointedTick: number | null;
}

export interface CabinetState {
  /** The serving minister for each ministry, or null when vacant (run by a civil servant). */
  ministers: Record<MinistryId, Minister | null>;
  /** Candidates available for appointment, refreshed every 1 January. */
  candidates: Record<MinistryId, Minister[]>;
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
}

export interface Investigation {
  id: string;
  ministry: MinistryId;
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
  /** National terror threat, 0–100. */
  terrorThreat: number;
  /** Tension with neighbours, 0–100. Phase 5 diplomacy takes this over. */
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
  /** Relation with India, −100…+100. */
  relation: number;
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
  /** ₹ crore of Defence money left after upkeep, spent when equipment is ordered. */
  procurementFund: number;
  queue: ProductionOrder[];
  drills: Drill[];
  drillReports: DrillReport[];
  /** 0–100: how strongly rivals are put off attacking. Phase 5 diplomacy builds on it. */
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

export interface GameState {
  schemaVersion: typeof SCHEMA_VERSION;
  meta: GameMeta;
  clock: ClockState;
  rng: RngState;
  status: GameStatus;
  nation: NationState;
  economy: EconomyState;
  budget: BudgetState;
  cabinet: CabinetState;
  politics: PoliticsState;
  modifiers: Modifier[];
  security: SecurityState;
  military: MilitaryState;
  events: EventsState;
  history: MonthlySnapshot[];
  log: LogEntry[];
  /** Monotonic counter for generating stable ids. */
  nextId: number;
}
