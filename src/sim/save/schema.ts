import { z } from 'zod';
import {
  APPROVAL_FACTORS,
  DOMAINS,
  DRILL_KINDS,
  IDEOLOGIES,
  INTEL_KINDS,
  LOG_CATEGORIES,
  MINISTRIES,
  OPERATION_KINDS,
  REGIONS,
  RIVALS,
  SECTORS,
  STRATEGIES,
  TAXES,
  UNITS,
} from '../content/ids';
import { MODIFIER_TARGETS } from '../engine/modifiers';
import { DIFFICULTIES, GAME_OVER_CAUSES, NUCLEAR_DOCTRINES, REVENUE_LINES, SCHEMA_VERSION } from '../state/types';

const date = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

const uint32 = z.number().int().min(0).max(0xffffffff);
const finite = z.number().finite();
const score = z.number().min(0).max(100);

const minister = z.object({
  id: z.string(),
  name: z.string().min(1),
  gender: z.enum(['female', 'male']),
  region: z.enum(REGIONS),
  competence: score,
  loyalty: score,
  corruption: score,
  ideology: z.enum(IDEOLOGIES),
  avatarSeed: z.number().int(),
  appointedTick: z.number().int().nullable(),
});

const expenditureLines = z.object({
  ...Object.fromEntries(MINISTRIES.map((m) => [m, finite])),
  establishment: finite,
  interest: finite,
});

const tick = z.number().int();
const keyed = <K extends readonly [string, ...string[]], V extends z.ZodType>(keys: K, value: V) =>
  z.record(z.enum(keys), value);

const front = z.object({ index: z.number().int().min(0), progress: z.number().min(-100).max(100) });

const war = z.object({
  id: z.string(),
  rival: z.enum(RIVALS),
  declaredBy: z.enum(['india', 'rival']),
  startedTick: tick,
  status: z.enum(['active', 'terms']),
  fronts: z.array(front).min(1),
  enemyStartStrength: z.number().positive(),
  weariness: score,
  casualties: z.object({ india: z.number().min(0), enemy: z.number().min(0) }),
  equipmentLost: z.number().min(0),
  ceasefireOffered: z.boolean(),
  termsDeadlineTick: tick.nullable(),
  report: z
    .object({
      tick,
      date,
      indiaLoss: finite,
      enemyLoss: finite,
      indiaCasualties: z.number().min(0),
      enemyCasualties: z.number().min(0),
      text: z.string(),
    })
    .nullable(),
});

const military = z.object({
  forces: keyed(UNITS, z.number().int().min(0)),
  readiness: score,
  morale: score,
  tech: keyed(DOMAINS, z.union([z.literal(1), z.literal(2), z.literal(3)])),
  research: z
    .object({ domain: z.enum(DOMAINS), tier: z.union([z.literal(2), z.literal(3)]), startedTick: tick, endsTick: tick })
    .nullable(),
  procurementFund: z.number().min(0),
  queue: z.array(
    z.object({
      id: z.string(),
      unit: z.enum(UNITS),
      quantity: z.number().int().min(1),
      startedTick: tick,
      endsTick: tick,
    }),
  ),
  drills: z.array(z.object({ id: z.string(), kind: z.enum(DRILL_KINDS), startedTick: tick, endsTick: tick })),
  drillReports: z.array(
    z.object({
      kind: z.enum(DRILL_KINDS),
      date,
      readiness: finite,
      morale: finite,
      deterrence: finite,
      accident: z.boolean(),
    }),
  ),
  deterrence: score,
  counterIntel: score,
  intelOps: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(INTEL_KINDS),
      target: z.enum(RIVALS).nullable(),
      startedTick: tick,
      endsTick: tick,
    }),
  ),
  fundingRatio: z.number().min(0),
  rivals: keyed(
    RIVALS,
    z.object({
      strength: z.number().min(0),
      readiness: score,
      relation: z.number().min(-100).max(100),
      recoverUntilTick: tick.nullable(),
      sighting: z.object({ tick, strength: z.number().min(0), readiness: score }).nullable(),
      annexed: z.boolean(),
    }),
  ),
  wars: z.array(war),
  warHistory: z.array(
    z.object({
      rival: z.enum(RIVALS),
      startedTick: tick,
      endedTick: tick,
      outcome: z.enum(['victory', 'ceasefire', 'peace', 'defeat', 'nuclear']),
      settlement: z.string(),
    }),
  ),
  nuclear: z.object({
    active: z.boolean(),
    research: score,
    enrichment: score,
    warheads: z.number().int().min(0),
    doctrine: z.enum(NUCLEAR_DOCTRINES),
    monthsSinceWarhead: z.number().int().min(0),
  }),
});

/** Runtime validation of a loaded GameState (current schema version). Keep in sync with state/types.ts. */
export const gameStateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  meta: z.object({
    seed: uint32,
    difficulty: z.enum(DIFFICULTIES),
    presidentName: z.string().min(1),
    startDate: date,
  }),
  clock: z.object({ tick: z.number().int().min(0), date }),
  rng: z.tuple([uint32, uint32, uint32, uint32]),
  status: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('playing') }),
    z.object({
      kind: z.literal('over'),
      cause: z.enum(GAME_OVER_CAUSES),
      date,
      title: z.string(),
      summary: z.string(),
    }),
  ]),
  nation: z.object({
    name: z.string(),
    treasury: finite,
    approval: score,
    population: z.number().positive(),
  }),
  economy: z.object({
    sectors: z.record(z.enum(SECTORS), z.object({ output: z.number().positive(), growth: finite })),
    priceIndex: z.number().positive(),
    inflation: finite,
    unemployment: z.number().min(0).max(1),
    realGrowth: finite,
    debt: z.number().min(0),
    interestRate: z.number().min(0),
    corruption: score,
    hdi: z.number().min(0).max(1),
    lastMonth: z
      .object({
        revenue: z.record(z.enum(REVENUE_LINES), finite),
        expenditure: expenditureLines,
        totalRevenue: finite,
        totalExpenditure: finite,
        balance: finite,
        borrowed: z.number().min(0),
        repaid: z.number().min(0),
      })
      .nullable(),
  }),
  budget: z.object({
    taxRates: z.record(z.enum(TAXES), z.number().min(0).max(1)),
    allocations: z.record(z.enum(MINISTRIES), z.number().min(0)),
    lastEnactedTick: z.number().int().nullable(),
  }),
  cabinet: z.object({
    ministers: z.record(z.enum(MINISTRIES), minister.nullable()),
    candidates: z.record(z.enum(MINISTRIES), z.array(minister)),
  }),
  politics: z.object({
    ideology: z.enum(IDEOLOGIES),
    strategy: z.enum(STRATEGIES),
    ideologyChangedTick: z.number().int().nullable(),
    strategyChangedTick: z.number().int().nullable(),
    lowApprovalMonths: z.number().int().min(0),
    satisfaction: z.record(z.enum(APPROVAL_FACTORS), score),
  }),
  modifiers: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      label: z.string(),
      target: z.enum(MODIFIER_TARGETS),
      kind: z.enum(['add', 'mult']),
      value: finite,
      expiresAtTick: z.number().int().nullable(),
    }),
  ),
  security: z.object({
    unrest: z.record(z.enum(REGIONS), score),
    terrorThreat: score,
    borderTension: score,
    militaryLoyalty: score,
    coupAlert: z.boolean(),
    bankruptMonths: z.number().int().min(0),
    investigations: z.array(
      z.object({
        id: z.string(),
        ministry: z.enum(MINISTRIES),
        startedTick: z.number().int(),
        resolvesTick: z.number().int(),
      }),
    ),
    operations: z.array(
      z.object({
        id: z.string(),
        kind: z.enum(OPERATION_KINDS),
        startedTick: z.number().int(),
        endsTick: z.number().int(),
      }),
    ),
    plots: z.array(
      z.object({
        id: z.string(),
        group: z.string(),
        region: z.enum(REGIONS),
        strikeTick: z.number().int(),
        mitigation: z.number().min(0).max(1),
      }),
    ),
    plotsFoiled: z.number().int().min(0),
    attacksSuffered: z.number().int().min(0),
  }),
  military,
  events: z.object({
    pending: z.array(
      z.object({
        id: z.string(),
        eventId: z.string(),
        region: z.enum(REGIONS).nullable(),
        ref: z.string().nullable(),
        raisedTick: z.number().int(),
        expiresTick: z.number().int(),
      }),
    ),
    scheduled: z.array(
      z.object({ eventId: z.string(), dueTick: z.number().int(), region: z.enum(REGIONS).nullable() }),
    ),
    cooldowns: z.record(z.string(), z.number().int()),
  }),
  history: z.array(
    z.object({
      month: date,
      treasury: finite,
      approval: z.number(),
      balance: finite,
      gdp: finite,
      realGrowth: finite,
      inflation: finite,
      unemployment: finite,
      debtToGdp: finite,
      revenue: finite,
      expenditure: finite,
      corruption: finite,
      hdi: finite,
    }),
  ),
  log: z.array(
    z.object({
      id: z.string(),
      tick: z.number().int(),
      date,
      severity: z.enum(['info', 'good', 'warning', 'critical']),
      category: z.enum(LOG_CATEGORIES),
      pendingId: z.string().nullable(),
      title: z.string(),
      body: z.string(),
      read: z.boolean(),
    }),
  ),
  nextId: z.number().int().min(0),
});
