import type { Modifier } from '../engine/modifiers';
import { seedRng } from '../engine/rng';
import { appendLog } from './log';
import { SCHEMA_VERSION, type Difficulty, type GameState } from './types';

export interface NewGameOptions {
  seed: number;
  difficulty: Difficulty;
  presidentName: string;
  /** Calendar year the term starts in (1 January). Supplied by the caller so the sim stays clock-free. */
  startYear: number;
}

export const DEFAULT_PRESIDENT_NAME = 'The President';
export const PRESIDENT_NAME_MAX = 40;

interface DifficultyProfile {
  treasury: number;
  approval: number;
  modifiers: Omit<Modifier, 'id'>[];
}

// Placeholder fiscal figures in ₹ crore, roughly the scale of the Union budget.
const BASE_MONTHLY_REVENUE = 350_000;
const BASE_MONTHLY_EXPENDITURE = 345_000;

const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: {
    treasury: 300_000,
    approval: 62,
    modifiers: [
      {
        source: 'difficulty',
        label: 'Difficulty: Easy',
        target: 'economy.monthlyRevenue',
        kind: 'mult',
        value: 0.04,
        expiresAtTick: null,
      },
    ],
  },
  normal: { treasury: 200_000, approval: 55, modifiers: [] },
  hard: {
    treasury: 120_000,
    approval: 48,
    modifiers: [
      {
        source: 'difficulty',
        label: 'Difficulty: Hard',
        target: 'economy.monthlyRevenue',
        kind: 'mult',
        value: -0.03,
        expiresAtTick: null,
      },
      {
        source: 'difficulty',
        label: 'Difficulty: Hard',
        target: 'politics.approvalTarget',
        kind: 'add',
        value: -5,
        expiresAtTick: null,
      },
    ],
  },
};

export function normalisePresidentName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, PRESIDENT_NAME_MAX);
  return trimmed.length > 0 ? trimmed : DEFAULT_PRESIDENT_NAME;
}

export function createInitialState(options: NewGameOptions): GameState {
  if (!Number.isInteger(options.seed)) throw new Error(`Seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.startYear)) throw new Error(`Start year must be an integer, got ${options.startYear}`);

  const profile = DIFFICULTY_PROFILES[options.difficulty];
  const startDate = { year: options.startYear, month: 1, day: 1 };
  const presidentName = normalisePresidentName(options.presidentName);

  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    meta: { seed: options.seed >>> 0, difficulty: options.difficulty, presidentName, startDate },
    clock: { tick: 0, date: startDate },
    rng: seedRng(options.seed),
    nation: {
      name: 'India',
      treasury: profile.treasury,
      approval: profile.approval,
      baseMonthlyRevenue: BASE_MONTHLY_REVENUE,
      baseMonthlyExpenditure: BASE_MONTHLY_EXPENDITURE,
      lastMonthBalance: 0,
    },
    modifiers: profile.modifiers.map((m, i) => ({ ...m, id: `mod-${i}` })),
    history: [],
    log: [],
    nextId: profile.modifiers.length,
  };

  return appendLog(state, {
    severity: 'info',
    title: 'Sworn in as President',
    body: `${presidentName} takes the oath of office. The nation is watching your first decisions.`,
  });
}
