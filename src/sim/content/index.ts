import { z } from 'zod';
import ideologiesJson from '../../../content/ideologies.json';
import departmentsJson from '../../../content/departments.json';
import ministriesJson from '../../../content/ministries.json';
import strategiesJson from '../../../content/strategies.json';
import { MODIFIER_TARGETS } from '../engine/modifiers';
import {
  DEPARTMENT_SERVICES,
  IDEOLOGIES,
  MINISTRIES,
  STRATEGIES,
  type IdeologyId,
  type MinistryId,
  type ServiceId,
  type StrategyId,
} from './ids';

/**
 * Game content lives in /content as JSON so it can be edited (and later modded)
 * without touching code. Everything is validated here at load time; invalid
 * content fails fast with a readable error, and `npm test` fails in CI.
 */

const contentModifier = z.object({
  target: z.enum(MODIFIER_TARGETS),
  kind: z.enum(['add', 'mult']),
  value: z.number(),
});
export type ContentModifier = z.infer<typeof contentModifier>;

const ministrySchema = z.object({
  id: z.enum(MINISTRIES),
  name: z.string().min(1),
  shortName: z.string().min(1),
  defaultAllocation: z.number().positive().max(0.1),
  role: z.string().min(1),
});
export type MinistryContent = z.infer<typeof ministrySchema>;

const policySchema = <T extends readonly [string, ...string[]]>(ids: T) =>
  z.object({
    id: z.enum(ids),
    name: z.string().min(1),
    summary: z.string().min(1),
    modifiers: z.array(contentModifier).min(1),
  });

/** Parses an array of content records and checks it covers every id exactly once, in id order. */
function byId<T extends { id: string }, K extends string>(
  file: string,
  schema: z.ZodType<T>,
  ids: readonly K[],
  raw: unknown,
): Record<K, T> {
  const parsed = z.array(schema).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`content/${file}: ${issue?.path.join('.')}: ${issue?.message}`);
  }
  const found = parsed.data.map((r) => r.id);
  if (found.length !== ids.length || ids.some((id) => !found.includes(id))) {
    throw new Error(`content/${file}: expected ids [${ids.join(', ')}], found [${found.join(', ')}]`);
  }
  return Object.fromEntries(parsed.data.map((r) => [r.id, r])) as Record<K, T>;
}

export interface PolicyContent<Id extends string> {
  id: Id;
  name: string;
  summary: string;
  modifiers: ContentModifier[];
}

export const MINISTRY_CONTENT: Record<MinistryId, MinistryContent> = byId(
  'ministries.json',
  ministrySchema,
  MINISTRIES,
  ministriesJson,
);

export const IDEOLOGY_CONTENT = byId('ideologies.json', policySchema(IDEOLOGIES), IDEOLOGIES, ideologiesJson) as Record<
  IdeologyId,
  PolicyContent<IdeologyId>
>;

export const STRATEGY_CONTENT = byId('strategies.json', policySchema(STRATEGIES), STRATEGIES, strategiesJson) as Record<
  StrategyId,
  PolicyContent<StrategyId>
>;

const serviceSchema = z.object({ id: z.string(), name: z.string().min(1), summary: z.string().min(1) });
const departmentSchema = z.object({ id: z.enum(MINISTRIES), services: z.array(serviceSchema).min(1) });
export interface ServiceContent {
  id: ServiceId;
  name: string;
  summary: string;
}

/** Each department's services, in the order of DEPARTMENT_SERVICES; the ids must match exactly. */
export const DEPARTMENT_CONTENT: Record<MinistryId, { id: MinistryId; services: ServiceContent[] }> = (() => {
  const parsed = byId('departments.json', departmentSchema, MINISTRIES, departmentsJson);
  for (const m of MINISTRIES) {
    const found = parsed[m].services.map((x) => x.id);
    const expected: readonly string[] = DEPARTMENT_SERVICES[m];
    if (found.length !== expected.length || expected.some((id, i) => found[i] !== id)) {
      throw new Error(
        `content/departments.json: ${m} services must be [${expected.join(', ')}], found [${found.join(', ')}]`,
      );
    }
  }
  return parsed as Record<MinistryId, { id: MinistryId; services: ServiceContent[] }>;
})();
