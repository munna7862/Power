import { createOpeningCabinet } from '../cabinet/generate';
import { MINISTRY_CONTENT } from '../content';
import { MINISTRIES, SECTORS, type IdeologyId, type MinistryId, type SectorId, type StrategyId } from '../content/ids';
import {
  DEFAULT_TAX_RATES,
  SECTOR_BASE_GROWTH,
  SECTOR_START_SHARE,
  START_CORRUPTION,
  START_DEBT_TO_GDP,
  START_GDP,
  START_HDI,
  START_INFLATION,
  START_POPULATION,
  START_REAL_GROWTH,
  START_UNEMPLOYMENT,
} from '../economy/constants';
import { allEfficiencies, interestRateFor } from '../economy/model';
import type { Modifier } from '../engine/modifiers';
import { Rng, seedRng } from '../engine/rng';
import { computeSatisfaction } from '../politics/approval';
import { applyPolicy } from '../politics/policy';
import { appendLog } from './log';
import {
  SCHEMA_VERSION,
  type CabinetState,
  type Difficulty,
  type EconomyState,
  type GameState,
  type Minister,
  type PoliticsState,
  type SectorState,
} from './types';

export interface NewGameOptions {
  seed: number;
  difficulty: Difficulty;
  presidentName: string;
  /** Calendar year the term starts in (1 January). Supplied by the caller so the sim stays clock-free. */
  startYear: number;
  ideology?: IdeologyId;
  strategy?: StrategyId;
}

export const DEFAULT_PRESIDENT_NAME = 'The President';
export const PRESIDENT_NAME_MAX = 40;
export const DEFAULT_IDEOLOGY: IdeologyId = 'liberalism';
export const DEFAULT_STRATEGY: StrategyId = 'balanced';

interface DifficultyProfile {
  treasury: number;
  approval: number;
  modifiers: Omit<Modifier, 'id'>[];
}

const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: {
    treasury: 300_000,
    approval: 62,
    modifiers: [
      {
        source: 'difficulty',
        label: 'Difficulty: Easy',
        target: 'economy.revenue',
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
        target: 'economy.revenue',
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

export function createStartingEconomy(difficulty: Difficulty): EconomyState {
  const sectors = Object.fromEntries(
    SECTORS.map((s) => [s, { output: START_GDP * SECTOR_START_SHARE[s], growth: SECTOR_BASE_GROWTH[s] }]),
  ) as Record<SectorId, SectorState>;
  const ratio = START_DEBT_TO_GDP[difficulty];
  return {
    sectors,
    priceIndex: 1,
    inflation: START_INFLATION,
    unemployment: START_UNEMPLOYMENT,
    realGrowth: START_REAL_GROWTH,
    debt: START_GDP * ratio,
    interestRate: interestRateFor(ratio, START_INFLATION),
    corruption: START_CORRUPTION,
    hdi: START_HDI,
    lastMonth: null,
  };
}

export function defaultAllocations(): Record<MinistryId, number> {
  return Object.fromEntries(MINISTRIES.map((m) => [m, MINISTRY_CONTENT[m].defaultAllocation])) as Record<
    MinistryId,
    number
  >;
}

export function emptyCabinet(): CabinetState {
  return {
    ministers: Object.fromEntries(MINISTRIES.map((m) => [m, null])) as Record<MinistryId, Minister | null>,
    candidates: Object.fromEntries(MINISTRIES.map((m) => [m, [] as Minister[]])) as Record<MinistryId, Minister[]>,
  };
}

/** Politics before the first monthly settlement; satisfaction is recomputed once the cabinet exists. */
export function openingPolitics(ideology: IdeologyId, strategy: StrategyId): PoliticsState {
  return {
    ideology,
    strategy,
    ideologyChangedTick: null,
    strategyChangedTick: null,
    lowApprovalMonths: 0,
    satisfaction: { jobs: 50, prices: 50, growth: 50, corruption: 50, livingStandards: 50, taxes: 50, services: 50 },
  };
}

export function createInitialState(options: NewGameOptions): GameState {
  if (!Number.isInteger(options.seed)) throw new Error(`Seed must be an integer, got ${options.seed}`);
  if (!Number.isInteger(options.startYear)) throw new Error(`Start year must be an integer, got ${options.startYear}`);

  const profile = DIFFICULTY_PROFILES[options.difficulty];
  const startDate = { year: options.startYear, month: 1, day: 1 };
  const presidentName = normalisePresidentName(options.presidentName);
  const ideology = options.ideology ?? DEFAULT_IDEOLOGY;
  const strategy = options.strategy ?? DEFAULT_STRATEGY;
  const rng = new Rng(seedRng(options.seed));

  let state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    meta: { seed: options.seed >>> 0, difficulty: options.difficulty, presidentName, startDate },
    clock: { tick: 0, date: startDate },
    rng: rng.state,
    status: { kind: 'playing' },
    nation: { name: 'India', treasury: profile.treasury, approval: profile.approval, population: START_POPULATION },
    economy: createStartingEconomy(options.difficulty),
    budget: { taxRates: { ...DEFAULT_TAX_RATES }, allocations: defaultAllocations(), lastEnactedTick: null },
    cabinet: emptyCabinet(),
    politics: openingPolitics(ideology, strategy),
    modifiers: profile.modifiers.map((m, i) => ({ ...m, id: `mod-${i}` })),
    history: [],
    log: [],
    nextId: profile.modifiers.length,
  };

  state = applyPolicy(state, 'ideology', ideology);
  state = applyPolicy(state, 'strategy', strategy);
  state = createOpeningCabinet(state, rng);
  state = {
    ...state,
    rng: rng.state,
    politics: { ...state.politics, satisfaction: computeSatisfaction(state, allEfficiencies(state)) },
  };

  return appendLog(state, {
    severity: 'info',
    title: 'Sworn in as President',
    body: `${presidentName} takes the oath of office. Review the budget and your cabinet: the nation is watching your first decisions.`,
  });
}
