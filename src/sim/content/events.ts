import { z } from 'zod';
import corruptionJson from '../../../content/events/corruption.json';
import disasterJson from '../../../content/events/disaster.json';
import economyJson from '../../../content/events/economy.json';
import personalJson from '../../../content/events/personal.json';
import securityJson from '../../../content/events/security.json';
import terrorJson from '../../../content/events/terror.json';
import militaryJson from '../../../content/events/military.json';
import diplomacyJson from '../../../content/events/diplomacy.json';
import unrestJson from '../../../content/events/unrest.json';
import groupsJson from '../../../content/groups.json';
import { MODIFIER_TARGETS } from '../engine/modifiers';
import { STAT_IDS, type StatId } from '../events/stats';
import { COUNTRY_PICKS, EVENT_CATEGORIES, MINISTRIES, OPERATION_KINDS, REGIONS, TREATY_TYPES } from './ids';
import { isCountryId } from './world';

/**
 * Event content: one JSON file per category in /content/events, validated here at load.
 * A broken event fails `npm test` (and CI) with the file, event id and field in the message.
 */

export const COMPARATORS = ['>', '>=', '<', '<=', '==', '!='] as const;
export type Comparator = (typeof COMPARATORS)[number];

export type Condition = { stat: StatId; op: Comparator; value: number } | { all: Condition[] } | { any: Condition[] };

const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({
      stat: z.enum(STAT_IDS as [StatId, ...StatId[]]),
      op: z.enum(COMPARATORS),
      value: z.number(),
    }),
    z.strictObject({ all: z.array(conditionSchema).min(1) }),
    z.strictObject({ any: z.array(conditionSchema).min(1) }),
  ]),
);

/** Scales an effect by how well a ministry is run: "mitigate" shrinks harm, "amplify" grows benefit. */
const scaleSchema = z.strictObject({ ministry: z.enum(MINISTRIES), mode: z.enum(['mitigate', 'amplify']) });
export type EffectScale = z.infer<typeof scaleSchema>;

const effectSchema = z.discriminatedUnion('type', [
  /** The default effect: a modifier shown in the matching "Why?" tooltip. `days: null` is permanent. */
  z.strictObject({
    type: z.literal('modifier'),
    target: z.enum(MODIFIER_TARGETS),
    kind: z.enum(['add', 'mult']),
    value: z.number(),
    days: z.number().int().positive().nullable(),
    label: z.string().min(1).optional(),
    scale: scaleSchema.optional(),
  }),
  /** One-off spending (negative) or windfall (positive), ₹ crore. */
  z.strictObject({ type: z.literal('treasury'), amount: z.number(), scale: scaleSchema.optional() }),
  /** Change in unrest in the event's region (or everywhere). */
  z.strictObject({
    type: z.literal('unrest'),
    delta: z.number(),
    where: z.enum(['event', 'all']).default('event'),
    scale: scaleSchema.optional(),
  }),
  z.strictObject({ type: z.literal('terror'), delta: z.number(), scale: scaleSchema.optional() }),
  z.strictObject({ type: z.literal('borderTension'), delta: z.number() }),
  z.strictObject({ type: z.literal('militaryLoyalty'), delta: z.number() }),
  /** Readiness and morale of the armed forces. */
  z.strictObject({ type: z.literal('readiness'), delta: z.number() }),
  z.strictObject({ type: z.literal('morale'), delta: z.number() }),
  /** Relation with a country: the one the event is about (its ref) unless a country is named. */
  z.strictObject({ type: z.literal('relation'), delta: z.number(), country: z.string().optional() }),
  /** Shifts every country’s relation with India (a global mood), or only the focus nations’ or the neighbours’. */
  z.strictObject({
    type: z.literal('worldRelation'),
    delta: z.number(),
    scope: z.enum(['all', 'focus', 'neighbours']).default('all'),
  }),
  /** India’s standing in the world. */
  z.strictObject({ type: z.literal('reputation'), delta: z.number() }),
  /** How tense the world is, 0–100. */
  z.strictObject({ type: z.literal('worldTension'), delta: z.number() }),
  /** A crisis between countries in the region of the one the event is about; it shows on the map. */
  z.strictObject({ type: z.literal('conflict'), days: z.number().int().positive() }),
  /** Signs a treaty with the country the event is about. */
  z.strictObject({
    type: z.literal('treaty'),
    kind: z.enum(TREATY_TYPES.filter((t) => t !== 'sanctions') as ['trade', 'nonAggression', 'embassy']),
    years: z.number().int().positive().default(3),
  }),
  /** Immediate nudge to the national corruption index. */
  z.strictObject({ type: z.literal('corruption'), delta: z.number() }),
  /** Loyalty of one minister, or of the whole cabinet. */
  z.strictObject({ type: z.literal('loyalty'), delta: z.number(), ministry: z.enum(MINISTRIES).optional() }),
  /** Exposes a minister: they resign and the government takes an approval hit. `random` favours the corrupt. */
  z.strictObject({ type: z.literal('scandal'), ministry: z.union([z.enum(MINISTRIES), z.literal('random')]) }),
  /** Orders a counter-terror operation (see security/operations.ts). */
  z.strictObject({ type: z.literal('operation'), kind: z.enum(OPERATION_KINDS) }),
]);
export type EventEffect = z.infer<typeof effectSchema>;

const followUpSchema = z.strictObject({
  eventId: z.string().min(1),
  delayDays: z.number().int().min(1),
  /** Probability the follow-up happens at all. Defaults to 1. */
  chance: z.number().min(0).max(1).default(1),
});
export type FollowUp = z.infer<typeof followUpSchema>;

const choiceSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  /** One line shown under the label. */
  description: z.string().min(1),
  /** What the player reads in the inbox after choosing. */
  outcome: z.string().min(1),
  /** ₹ crore, charged when the choice is made. */
  cost: z.number().min(0).default(0),
  /** The choice is applied automatically if the President does not decide in time. Exactly one per event. */
  default: z.boolean().default(false),
  effects: z.array(effectSchema).default([]),
  followUp: followUpSchema.optional(),
});
export type EventChoice = z.infer<typeof choiceSchema>;

const eventSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are kebab-case'),
  category: z.enum(EVENT_CATEGORIES),
  severity: z.enum(['info', 'good', 'warning', 'critical']),
  title: z.string().min(1),
  /** Placeholders: {region}, {president}, {group}, {rival}, {country}. */
  body: z.string().min(1),
  scope: z.enum(['national', 'region']).default('national'),
  /** For diplomatic events: the kind of country the event is about, picked when it fires (its ref). */
  countryPick: z.enum(COUNTRY_PICKS).optional(),
  /** Relative likelihood of each region for regional events (default 1 each). */
  regionWeights: z.record(z.enum(REGIONS), z.number().min(0)).optional(),
  /** All must hold for the event to be eligible. */
  conditions: z.array(conditionSchema).default([]),
  /** Expected occurrences per year while eligible. 0 means the event only happens as a follow-up. */
  weight: z.number().min(0),
  cooldownDays: z.number().int().min(0).default(0),
  /** Days the President has to decide before the default choice is applied. */
  deadlineDays: z.number().int().min(1).default(30),
  /** Applied immediately for events with no choices. */
  effects: z.array(effectSchema).default([]),
  choices: z.array(choiceSchema).default([]),
});

export type EventContent = z.infer<typeof eventSchema>;

/** Unrest stats that measure how close a region is to rioting. */
const UNREST_STATS: readonly StatId[] = ['regionUnrest', 'maxUnrest'];

/** The lowest unrest level an event requires (via "unrest above N" conditions), or null if it needs none. */
export function unrestTrigger(condition: Condition): number | null {
  if ('stat' in condition) {
    return UNREST_STATS.includes(condition.stat) && (condition.op === '>' || condition.op === '>=')
      ? condition.value
      : null;
  }
  const triggers = ('all' in condition ? condition.all : condition.any).map(unrestTrigger);
  // An "any" group is satisfied by its weakest branch, so it only demands unrest if every branch does.
  if ('any' in condition) return triggers.every((t) => t !== null) ? Math.min(...(triggers as number[])) : null;
  const set = triggers.filter((t): t is number => t !== null);
  return set.length > 0 ? Math.max(...set) : null;
}

/** A riot: an event that needs unrest of at least 60 somewhere. The "no riots" option keeps unrest below that. */
export const RIOT_TRIGGER = 60;
export const isRiotEvent = (event: Pick<EventContent, 'conditions'>): boolean =>
  event.conditions.some((c) => (unrestTrigger(c) ?? 0) >= RIOT_TRIGGER);

function usesRegionStat(condition: Condition): boolean {
  if ('stat' in condition) return condition.stat === 'regionUnrest';
  return ('all' in condition ? condition.all : condition.any).some(usesRegionStat);
}

function validateEvents(file: string, raw: unknown, category: EventContent['category']): EventContent[] {
  const parsed = z.array(eventSchema).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`content/events/${file}: ${issue?.path.join('.')}: ${issue?.message}`);
  }
  for (const event of parsed.data) {
    const where = `content/events/${file}: event "${event.id}"`;
    if (event.category !== category) throw new Error(`${where} has category "${event.category}" but lives in ${file}`);
    if (event.conditions.some(usesRegionStat) && event.scope !== 'region') {
      throw new Error(`${where} uses regionUnrest, so it needs "scope": "region"`);
    }
    if (event.choices.length === 0) continue;
    const defaults = event.choices.filter((c) => c.default).length;
    if (defaults !== 1) throw new Error(`${where} must have exactly one default choice, found ${defaults}`);
    if (new Set(event.choices.map((c) => c.id)).size !== event.choices.length) {
      throw new Error(`${where} has duplicate choice ids`);
    }
    if (event.effects.length > 0) throw new Error(`${where} has choices, so top-level "effects" must be empty`);
  }
  return parsed.data;
}

const FILES: [string, unknown, EventContent['category']][] = [
  ['economy.json', economyJson, 'economy'],
  ['personal.json', personalJson, 'personal'],
  ['disaster.json', disasterJson, 'disaster'],
  ['corruption.json', corruptionJson, 'corruption'],
  ['unrest.json', unrestJson, 'unrest'],
  ['security.json', securityJson, 'security'],
  ['terror.json', terrorJson, 'terror'],
  ['military.json', militaryJson, 'military'],
  ['diplomacy.json', diplomacyJson, 'diplomacy'],
];

/** Every event, in file order (the order events are rolled in, which keeps games deterministic). */
export const EVENT_LIST: readonly EventContent[] = FILES.flatMap(([file, raw, category]) =>
  validateEvents(file, raw, category),
);

const ids = new Set<string>();
for (const event of EVENT_LIST) {
  if (ids.has(event.id)) throw new Error(`content/events: duplicate event id "${event.id}"`);
  ids.add(event.id);
}

export const EVENT_CONTENT: Readonly<Record<string, EventContent>> = Object.fromEntries(
  EVENT_LIST.map((e) => [e.id, e]),
);

// Named countries must exist, and text about “the country” needs a country to be about.
for (const event of EVENT_LIST) {
  const effects = [...event.effects, ...event.choices.flatMap((c) => c.effects)];
  for (const e of effects) {
    if (e.type === 'relation' && e.country !== undefined && !isCountryId(e.country)) {
      throw new Error(`content/events: event "${event.id}" names unknown country "${e.country}"`);
    }
    if (
      (e.type === 'treaty' || (e.type === 'relation' && e.country === undefined)) &&
      event.countryPick === undefined &&
      event.category === 'diplomacy'
    ) {
      throw new Error(`content/events: event "${event.id}" needs a countryPick for its ${e.type} effect`);
    }
  }
}

// Follow-ups must point at real events.
for (const event of EVENT_LIST) {
  for (const choice of event.choices) {
    const target = choice.followUp?.eventId;
    if (target !== undefined && !EVENT_CONTENT[target]) {
      throw new Error(`content/events: event "${event.id}" choice "${choice.id}" follows up unknown event "${target}"`);
    }
  }
}

const groupsParsed = z.array(z.string().min(3)).min(4).safeParse(groupsJson);
if (!groupsParsed.success) throw new Error(`content/groups.json: ${groupsParsed.error.issues[0]?.message}`);
/** Fictional groups used for terror plots. */
export const THREAT_GROUPS: readonly string[] = groupsParsed.data;
