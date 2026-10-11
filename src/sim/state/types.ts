import type { GameDate } from '../engine/calendar';
import type { Modifier } from '../engine/modifiers';
import type { RngState } from '../engine/rng';

/** Bump when GameState changes shape, and register a migration in save/migrations.ts. */
export const SCHEMA_VERSION = 1;

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

/** Phase 1 placeholder nation. Phase 2 replaces the fiscal fields with the full economy model. */
export interface NationState {
  name: string;
  /** Cash balance in ₹ crore. May go negative until borrowing arrives in Phase 2. */
  treasury: number;
  /** Public approval of the President, 0–100. */
  approval: number;
  /** Base monthly revenue in ₹ crore, before modifiers. */
  baseMonthlyRevenue: number;
  /** Base monthly expenditure in ₹ crore, before modifiers. */
  baseMonthlyExpenditure: number;
  /** Revenue minus expenditure for the most recently closed month, in ₹ crore. */
  lastMonthBalance: number;
}

export interface MonthlySnapshot {
  /** First day of the month the snapshot describes. */
  month: GameDate;
  treasury: number;
  approval: number;
  balance: number;
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
  nation: NationState;
  modifiers: Modifier[];
  history: MonthlySnapshot[];
  log: LogEntry[];
  /** Monotonic counter for generating stable ids. */
  nextId: number;
}
