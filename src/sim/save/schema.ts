import { z } from 'zod';
import {
  APPROVAL_FACTORS,
  IDEOLOGIES,
  LOG_CATEGORIES,
  MINISTRIES,
  OPERATION_KINDS,
  REGIONS,
  SECTORS,
  STRATEGIES,
  TAXES,
} from '../content/ids';
import { MODIFIER_TARGETS } from '../engine/modifiers';
import { DIFFICULTIES, GAME_OVER_CAUSES, REVENUE_LINES, SCHEMA_VERSION } from '../state/types';

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
