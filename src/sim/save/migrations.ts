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
import { openingDiplomacy } from '../diplomacy/opening';
import { openingMilitary } from '../military/opening';
import { computeSatisfaction } from '../politics/approval';
import { applyPolicy } from '../politics/policy';
import {
  createStartingEconomy,
  DEFAULT_IDEOLOGY,
  DEFAULT_STRATEGY,
  defaultAllocations,
  emptyCabinet,
  emptyEvents,
  openingPolitics,
  openingSecurity,
} from '../state/initialState';
import { appendLog } from '../state/log';
import {
  SCHEMA_VERSION,
  type Difficulty,
  type GameState,
  type LogEntry,
  type MilitaryState,
  type RivalState,
} from '../state/types';
import type { RivalId } from '../content/ids';

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
function migrateV1toV2(raw: unknown): unknown {
  const v1 = raw as StateV1;
  const rng = new Rng(v1.rng);
  const economy = createStartingEconomy(v1.meta.difficulty);
  let state: GameState = {
    schemaVersion: SCHEMA_VERSION,
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
    security: openingSecurity(),
    military: openingMilitary(),
    diplomacy: openingDiplomacy(),
    events: emptyEvents(),
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
    log: v1.log.map((e) => ({ ...e, category: 'general' as const, pendingId: null })),
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
  const upgraded = appendLog(state, {
    severity: 'info',
    title: 'Save upgraded',
    body: 'This game was started in an earlier version. The economy, budget and cabinet begin from their opening values today.',
  });
  return { ...upgraded, schemaVersion: 2 };
}

/** Shape of a schema v2 (Phase 2) log entry. */
interface LogEntryV2 extends Omit<LogEntry, 'category' | 'pendingId'> {
  category?: LogEntry['category'];
  pendingId?: string | null;
}

/**
 * v2 → v3 (Phase 3): adds regional unrest, terror, the army's mood, inquiries and the event engine, plus
 * inbox categories. Everything already in the save carries over unchanged.
 */
function migrateV2toV3(raw: unknown): unknown {
  const v2 = raw as Omit<GameState, 'log'> & { log: LogEntryV2[] };
  return {
    ...v2,
    schemaVersion: 3,
    politics: {
      ...v2.politics,
      satisfaction: { ...v2.politics.satisfaction, safety: v2.politics.satisfaction.safety ?? 65 },
    },
    security: v2.security ?? openingSecurity(),
    events: v2.events ?? emptyEvents(),
    log: v2.log.map((e) => ({ ...e, category: e.category ?? 'general', pendingId: e.pendingId ?? null })),
  };
}

/**
 * v3 → v4 (Phase 4): adds the armed forces, rivals, drills, intelligence, wars and the nuclear program.
 * Everything already in the save carries over; the military starts from its opening forces. The army’s
 * loyalty, which Phase 3 kept as a placeholder, is unchanged.
 */
function migrateV3toV4(raw: unknown): unknown {
  const v3 = raw as GameState;
  return { ...v3, schemaVersion: 4, military: openingMilitary() };
}

/** The Phase 4 fictional rivals and the countries that replaced them in Phase 5. */
const RIVAL_RENAMES: Record<string, RivalId> = {
  zarnak: 'CHN',
  tirhan: 'PAK',
  oruvan: 'MMR',
  velmora: 'BGD',
  haldrin: 'LKA',
};
const renamed = (id: string): string => RIVAL_RENAMES[id] ?? id;

/** Shape of a schema v4 rival (it still carried its own relation), as far as the migration needs it. */
interface RivalV4 extends Omit<RivalState, 'relation'> {
  /** Missing when the save was just upgraded from v3, whose military state is built fresh. */
  relation?: number;
}

/**
 * v4 → v5 (Phase 5): adds diplomacy (relations with every country, treaties, offers, reputation) and
 * replaces the five fictional rivals with their real-world stand-ins. Each rival keeps its strength, war and
 * relation; the relation moves into the diplomacy state. Treaties, offers and the AI start empty.
 */
function migrateV4toV5(raw: unknown): unknown {
  const v4 = raw as Omit<GameState, 'military' | 'diplomacy' | 'events'> & {
    military: Omit<MilitaryState, 'rivals'> & { rivals: Record<string, RivalV4> };
    events: GameState['events'];
  };
  const diplomacy = openingDiplomacy();
  const rivals: Record<string, RivalState> = {};
  for (const [oldId, { relation, ...rival }] of Object.entries(v4.military.rivals)) {
    const id = renamed(oldId);
    rivals[id] = rival;
    const country = diplomacy.countries[id];
    if (country && typeof relation === 'number') diplomacy.countries[id] = { ...country, relation };
  }
  return {
    ...v4,
    schemaVersion: 5,
    military: {
      ...v4.military,
      rivals,
      intelOps: v4.military.intelOps.map((o) => ({ ...o, target: o.target === null ? null : renamed(o.target) })),
      wars: v4.military.wars.map((w) => ({ ...w, rival: renamed(w.rival) })),
      warHistory: v4.military.warHistory.map((w) => ({ ...w, rival: renamed(w.rival) })),
    },
    diplomacy,
    events: {
      ...v4.events,
      pending: v4.events.pending.map((p) => ({ ...p, ref: p.ref === null ? null : renamed(p.ref) })),
    },
  };
}

/**
 * Registry keyed by the version being migrated FROM.
 * When SCHEMA_VERSION goes up, add a step here and a golden fixture for the old version.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
  4: migrateV4toV5,
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
