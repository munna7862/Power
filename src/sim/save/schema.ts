import { z } from 'zod';
import {
  AGENCIES,
  APPROVAL_FACTORS,
  DOMAINS,
  DRILL_KINDS,
  FACILITIES,
  FUELS,
  GOODS,
  INDUSTRIES,
  IDEOLOGIES,
  INTEL_KINDS,
  LOG_CATEGORIES,
  MINISTRIES,
  OPERATION_KINDS,
  PLANTS,
  POLICE_UNITS,
  REGIONS,
  RIVALS,
  SERVICE_IDS,
  type ServiceId,
  SECTORS,
  STRATEGIES,
  TAXES,
  TREATY_TYPES,
  UNITS,
} from '../content/ids';
import { MODIFIER_TARGETS } from '../engine/modifiers';
import {
  AI_ACTIONS,
  DIFFICULTIES,
  GAME_OVER_CAUSES,
  NUCLEAR_DOCTRINES,
  REVENUE_LINES,
  SCHEMA_VERSION,
} from '../state/types';

const date = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

const uint32 = z.number().int().min(0).max(0xffffffff);
const finite = z.number().finite();
const score = z.number().min(0).max(100);

const expenditureLines = z.object({
  ...Object.fromEntries(MINISTRIES.map((m) => [m, finite])),
  establishment: finite,
  interest: finite,
});

const tick = z.number().int();
const keyed = <K extends readonly [string, ...string[]], V extends z.ZodType>(keys: K, value: V) =>
  z.record(z.enum(keys), value);

const countryId = z.string().regex(/^[A-Z]{3}$/);
const relationScore = z.number().min(-100).max(100);

const diplomacy = z.object({
  countries: z.record(
    countryId,
    z.object({
      relation: relationScore,
      incidents: score,
      embassy: z.boolean(),
      sanctioned: z.boolean(),
      proposalReadyTick: tick,
      aidReadyTick: tick,
    }),
  ),
  treaties: z.array(
    z.object({
      id: z.string(),
      type: z.enum(TREATY_TYPES),
      parties: z.tuple([z.string(), z.string()]),
      startTick: tick,
      endTick: tick.nullable(),
      terms: z.object({
        sector: z.enum(SECTORS).optional(),
        value: finite.optional(),
        good: z.enum(GOODS).optional(),
        side: z.enum(['sell', 'buy']).optional(),
        quantity: finite.optional(),
        price: finite.optional(),
      }),
    }),
  ),
  offers: z.array(
    z.object({
      id: z.string(),
      from: countryId,
      type: z.enum(['trade', 'nonAggression']),
      years: z.number().int().min(1),
      terms: z.object({ sector: z.enum(SECTORS).optional(), value: finite.optional() }),
      raisedTick: tick,
      expiresTick: tick,
    }),
  ),
  conflicts: z.array(z.object({ id: z.string(), countries: z.array(countryId), startTick: tick, endTick: tick })),
  reputation: score,
  worldTension: score,
  ai: z.record(
    countryId,
    z.object({
      tick,
      action: z.enum(AI_ACTIONS),
      acted: z.boolean(),
      utilities: z.record(z.enum(AI_ACTIONS), finite),
      inputs: z.object({
        relation: finite,
        powerRatio: finite,
        ideology: finite,
        deterrence: finite,
        noise: finite,
      }),
    }),
  ),
});

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
    options: z.object({ noWars: z.boolean(), noRiots: z.boolean(), tutorial: z.boolean() }),
    presidentName: z.string().min(1),
    startDate: date,
    endless: z.boolean(),
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
    loans: z.array(
      z.object({
        id: z.string(),
        lender: z.string().min(1),
        principal: z.number().positive(),
        rate: z.number().min(0),
        startTick: tick,
        dueTick: tick,
      }),
    ),
  }),
  budget: z.object({
    taxRates: z.record(z.enum(TAXES), z.number().min(0).max(1)),
    allocations: z.record(z.enum(MINISTRIES), z.number().min(0)),
    lastEnactedTick: z.number().int().nullable(),
  }),
  departments: z.object({
    stars: z.record(
      z.enum(MINISTRIES),
      z.partialRecord(z.enum(SERVICE_IDS as [ServiceId, ...ServiceId[]]), z.number().int().min(1).max(5)),
    ),
    underfundedMonths: z.record(z.enum(MINISTRIES), z.number().int().min(0)),
    upgrades: z.array(
      z.object({
        id: z.string(),
        department: z.enum(MINISTRIES),
        service: z.enum(SERVICE_IDS as [ServiceId, ...ServiceId[]]),
        endsTick: z.number().int(),
      }),
    ),
  }),
  infrastructure: z.object({
    counts: z.record(z.enum(REGIONS), z.record(z.enum(FACILITIES), z.number().int().min(0))),
    queue: z.array(
      z.object({
        id: z.string(),
        facility: z.enum(FACILITIES),
        region: z.enum(REGIONS),
        quantity: z.number().int().positive(),
        cost: z.number().min(0),
        startedTick: tick,
        endsTick: tick,
      }),
    ),
  }),
  energy: z.object({
    plants: z.record(z.enum(REGIONS), z.record(z.enum(PLANTS), z.number().int().min(0))),
    queue: z.array(
      z.object({
        id: z.string(),
        plant: z.enum(PLANTS),
        region: z.enum(REGIONS),
        quantity: z.number().int().positive(),
        cost: z.number().min(0),
        startedTick: tick,
        endsTick: tick,
      }),
    ),
  }),
  industry: z.object({
    plants: z.record(
      z.enum(REGIONS),
      z.record(z.enum(INDUSTRIES), z.object({ state: z.number().int().min(0), private: z.number().int().min(0) })),
    ),
    stocks: z.record(z.enum(GOODS), z.number().min(0)),
    queue: z.array(
      z.object({
        id: z.string(),
        industry: z.enum(INDUSTRIES),
        region: z.enum(REGIONS),
        owner: z.enum(['state', 'private']),
        quantity: z.number().int().positive(),
        cost: z.number().min(0),
        startedTick: tick,
        endsTick: tick,
      }),
    ),
    last: z.object({
      production: z.record(z.enum(GOODS), finite),
      use: z.record(z.enum(GOODS), finite),
      demand: z.record(z.enum(GOODS), finite),
      imports: z.record(z.enum(GOODS), finite),
      shortage: z.record(z.enum(GOODS), finite),
      waste: z.record(z.enum(GOODS), finite),
      throughput: z.record(z.enum(INDUSTRIES), z.number().min(0).max(1)),
      fuelSupply: z.record(z.enum(FUELS), z.number().min(0).max(1)),
      valueAdded: z.record(z.enum(SECTORS), finite),
      stateProfit: finite,
      privateProfit: finite,
      customs: finite,
    }),
    applied: z.record(z.enum(SECTORS), finite),
  }),
  market: z.object({
    prices: z.record(z.enum(GOODS), z.number().positive()),
    controls: z.record(
      z.enum(GOODS),
      z.object({
        tariff: z.number().min(0).max(1),
        quota: z.number().min(0).nullable(),
        ban: z.enum(['export', 'import']).nullable(),
      }),
    ),
    volumes: z.record(z.string(), z.number().min(0)),
  }),
  police: z.object({
    officers: z.record(z.enum(REGIONS), z.number().int().min(0)),
    stations: z.record(z.enum(REGIONS), z.number().int().min(0)),
    equipment: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    units: z.record(z.enum(POLICE_UNITS), z.number().int().min(0)),
    agencies: z.record(z.enum(AGENCIES), z.number().int().min(0).max(100)),
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
    crime: z.record(z.enum(REGIONS), score),
    terrorThreat: score,
    borderTension: score,
    militaryLoyalty: score,
    coupAlert: z.boolean(),
    bankruptMonths: z.number().int().min(0),
    investigations: z.array(
      z.object({
        id: z.string(),
        department: z.enum(MINISTRIES),
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
  diplomacy,
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
    fired: z.record(z.string(), z.array(z.number().int())),
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
