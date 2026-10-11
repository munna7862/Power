import type { ApprovalFactor, IdeologyId, MinistryId, RegionId, SectorId, StrategyId, TaxId } from '../content/ids';
import type { GameDate } from '../engine/calendar';
import type { Modifier } from '../engine/modifiers';
import type { RngState } from '../engine/rng';

/** Bump when GameState changes shape, and register a migration in save/migrations.ts. */
export const SCHEMA_VERSION = 2;

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** A presidential term is five years. */
export const TERM_YEARS = 5;
/** Monthly snapshots kept for charts (10 years). */
export const HISTORY_LIMIT = 120;
/** Inbox entries kept before the oldest are dropped. */
export const LOG_LIMIT = 200;

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

export const GAME_OVER_CAUSES = ['impeachment'] as const;
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
  title: string;
  body: string;
  read: boolean;
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
  history: MonthlySnapshot[];
  log: LogEntry[];
  /** Monotonic counter for generating stable ids. */
  nextId: number;
}
