import { createOpeningCabinet } from '../cabinet/generate';
import {
  DEFAULT_TAX_RATES,
  START_CORRUPTION,
  START_DEBT_TO_GDP,
  START_GDP,
  START_HDI,
  START_POPULATION,
} from '../economy/constants';
import { allEfficiencies } from '../economy/model';
import type { GameDate } from '../engine/calendar';
import type { Modifier, ModifierTarget } from '../engine/modifiers';
import { Rng, type RngState } from '../engine/rng';
import { computeSatisfaction } from '../politics/approval';
import { applyPolicy } from '../politics/policy';
import {
  createStartingEconomy,
  DEFAULT_IDEOLOGY,
  DEFAULT_STRATEGY,
  defaultAllocations,
  emptyCabinet,
  openingPolitics,
} from '../state/initialState';
import { appendLog } from '../state/log';
import { SCHEMA_VERSION, type Difficulty, type GameState, type LogEntry } from '../state/types';

/** Upgrades a raw state from version N to N + 1. */
export type Migration = (state: unknown) => unknown;

/** Shape of a schema v1 (Phase 1) save, as far as the migration needs it. */
interface StateV1 {
  meta: { seed: number; difficulty: Difficulty; presidentName: string; startDate: GameDate };
  clock: { tick: number; date: GameDate };
  rng: RngState;
  nation: { name: string; treasury: number; approval: number };
  modifiers: (Omit<Modifier, 'target'> & { target: string })[];
  history: { month: GameDate; treasury: number; approval: number; balance: number }[];
  log: LogEntry[];
  nextId: number;
}

const V1_TARGETS: Record<string, ModifierTarget> = {
  'economy.monthlyRevenue': 'economy.revenue',
  'economy.monthlyExpenditure': 'economy.expenditure',
  'politics.approvalTarget': 'politics.approvalTarget',
};

/**
 * v1 → v2 (Phase 2): adds the economy, budget, cabinet and politics. The
 * President, date, treasury, approval, inbox and history carry over; the new
 * systems start from opening values, with the cabinet rolled from the save's RNG.
 */
function migrateV1toV2(raw: unknown): GameState {
  const v1 = raw as StateV1;
  const rng = new Rng(v1.rng);
  const economy = createStartingEconomy(v1.meta.difficulty);
  let state: GameState = {
    schemaVersion: 2,
    meta: v1.meta,
    clock: v1.clock,
    rng: v1.rng,
    status: { kind: 'playing' },
    nation: {
      name: v1.nation.name,
      treasury: v1.nation.treasury,
      approval: v1.nation.approval,
      population: START_POPULATION,
    },
    economy,
    budget: { taxRates: { ...DEFAULT_TAX_RATES }, allocations: defaultAllocations(), lastEnactedTick: null },
    cabinet: emptyCabinet(),
    politics: openingPolitics(DEFAULT_IDEOLOGY, DEFAULT_STRATEGY),
    modifiers: v1.modifiers.flatMap((m) => {
      const target = V1_TARGETS[m.target];
      return target ? [{ ...m, target }] : [];
    }),
    history: v1.history.map((h) => ({
      ...h,
      gdp: START_GDP,
      realGrowth: economy.realGrowth,
      inflation: economy.inflation,
      unemployment: economy.unemployment,
      debtToGdp: START_DEBT_TO_GDP[v1.meta.difficulty],
      revenue: 0,
      expenditure: 0,
      corruption: START_CORRUPTION,
      hdi: START_HDI,
    })),
    log: v1.log,
    nextId: v1.nextId,
  };
  state = applyPolicy(state, 'ideology', DEFAULT_IDEOLOGY);
  state = applyPolicy(state, 'strategy', DEFAULT_STRATEGY);
  state = createOpeningCabinet(state, rng);
  state = {
    ...state,
    rng: rng.state,
    politics: { ...state.politics, satisfaction: computeSatisfaction(state, allEfficiencies(state)) },
  };
  return appendLog(state, {
    severity: 'info',
    title: 'Save upgraded',
    body: 'This game was started in an earlier version. The economy, budget and cabinet begin from their opening values today.',
  });
}

/**
 * Registry keyed by the version being migrated FROM.
 * When SCHEMA_VERSION goes up, add a step here and a golden fixture for the old version.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: migrateV1toV2,
};

export function migrate(
  state: unknown,
  fromVersion: number,
  toVersion: number = SCHEMA_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): unknown {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) throw new Error(`Invalid save version ${fromVersion}.`);
  if (fromVersion > toVersion) {
    throw new Error(`Save is from a newer version of the game (v${fromVersion}); please update the game.`);
  }
  let current = state;
  for (let v = fromVersion; v < toVersion; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`No migration registered from save version ${v} to ${v + 1}.`);
    current = step(current);
  }
  return current;
}
