import { z } from 'zod';
import { DIFFICULTIES, SCHEMA_VERSION } from '../state/types';

const date = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

const uint32 = z.number().int().min(0).max(0xffffffff);

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
  nation: z.object({
    name: z.string(),
    treasury: z.number(),
    approval: z.number().min(0).max(100),
    baseMonthlyRevenue: z.number(),
    baseMonthlyExpenditure: z.number(),
    lastMonthBalance: z.number(),
  }),
  modifiers: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      label: z.string(),
      target: z.enum(['economy.monthlyRevenue', 'economy.monthlyExpenditure', 'politics.approvalTarget']),
      kind: z.enum(['add', 'mult']),
      value: z.number(),
      expiresAtTick: z.number().int().nullable(),
    }),
  ),
  history: z.array(
    z.object({
      month: date,
      treasury: z.number(),
      approval: z.number(),
      balance: z.number(),
    }),
  ),
  log: z.array(
    z.object({
      id: z.string(),
      tick: z.number().int(),
      date,
      severity: z.enum(['info', 'good', 'warning', 'critical']),
      title: z.string(),
      body: z.string(),
      read: z.boolean(),
    }),
  ),
  nextId: z.number().int().min(0),
});
