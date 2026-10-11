import { z } from 'zod';
import researchJson from '../../../content/research.json';
import rivalsJson from '../../../content/rivals.json';
import weaponsJson from '../../../content/weapons.json';
import { DOMAINS, REGIONS, RIVALS, TERRAINS, UNITS, type DomainId, type RivalId, type UnitId } from './ids';

/**
 * Military content: units (content/weapons.json), the defence research tree (research.json) and the
 * fictional rival states (rivals.json). Validated at load; a broken file fails `npm test`.
 */

const unitSchema = z.strictObject({
  id: z.enum(UNITS),
  domain: z.enum(DOMAINS),
  /** Generic class name; no trademarked products. */
  name: z.string().min(1),
  summary: z.string().min(1),
  /** Names of the generation 1, 2 and 3 equipment shown as the domain's technology advances. */
  generations: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  attack: z.number().positive(),
  defence: z.number().positive(),
  /** ₹ crore per unit at generation 1; later generations cost more (see TIER_COST). */
  cost: z.number().positive(),
  /** ₹ crore per unit per month. */
  upkeep: z.number().positive(),
  buildDays: z.number().int().positive(),
  /** Personnel per unit, used for casualty figures. */
  crew: z.number().int().positive(),
  /** Units in service at the start of the game. */
  start: z.number().int().min(0),
});
export type UnitContent = z.infer<typeof unitSchema>;

const researchSchema = z.strictObject({
  domain: z.enum(DOMAINS),
  tier: z.union([z.literal(2), z.literal(3)]),
  name: z.string().min(1),
  cost: z.number().positive(),
  days: z.number().int().positive(),
});
export type ResearchContent = z.infer<typeof researchSchema>;

const weightsSchema = z.strictObject({
  land: z.number().min(0),
  air: z.number().min(0),
  sea: z.number().min(0),
  strategic: z.number().min(0),
});

const frontSchema = z.strictObject({
  name: z.string().min(1),
  terrain: z.enum(TERRAINS),
  /** Share of the war effort fought on this front; shares of one rival sum to 1. */
  share: z.number().positive().max(1),
  /** How much each domain counts on this front; weights sum to 1. */
  weights: weightsSchema,
});
export type FrontContent = z.infer<typeof frontSchema>;

const rivalSchema = z.strictObject({
  id: z.enum(RIVALS),
  name: z.string().min(1),
  adjective: z.string().min(1),
  summary: z.string().min(1),
  /** Strength on the same index as India's (India starts near 80). */
  strength: z.number().positive(),
  /** Annual growth of strength when at peace. */
  growth: z.number().min(0).max(0.1),
  /** Starting relation with India, −100…+100. */
  relation: z.number().min(-100).max(100),
  /** 0–100: how readily this state picks a fight. */
  aggression: z.number().min(0).max(100),
  /** 0–100: how hard its secret services are to crack. */
  counterIntel: z.number().min(0).max(100),
  /** Annexation adds this share of India's GDP and population. */
  gdpShare: z.number().min(0).max(1),
  populationShare: z.number().min(0).max(1),
  /** The Indian region that borders it, which feels the unrest of an annexation. */
  region: z.enum(REGIONS),
  nuclear: z.boolean(),
  fronts: z.array(frontSchema).min(1),
});
export type RivalContent = z.infer<typeof rivalSchema>;

function parse<T>(file: string, schema: z.ZodType<T>, raw: unknown): T[] {
  const parsed = z.array(schema).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`content/${file}: ${issue?.path.join('.')}: ${issue?.message}`);
  }
  return parsed.data;
}

function indexById<T extends { id: K }, K extends string>(file: string, rows: T[], ids: readonly K[]): Record<K, T> {
  const found = rows.map((r) => r.id);
  if (found.length !== ids.length || ids.some((id) => !found.includes(id))) {
    throw new Error(`content/${file}: expected ids [${ids.join(', ')}], found [${found.join(', ')}]`);
  }
  return Object.fromEntries(rows.map((r) => [r.id, r])) as Record<K, T>;
}

export const UNIT_CONTENT: Record<UnitId, UnitContent> = indexById(
  'weapons.json',
  parse('weapons.json', unitSchema, weaponsJson),
  UNITS,
);

export const RESEARCH_LIST: readonly ResearchContent[] = parse('research.json', researchSchema, researchJson);

const researchKeys = new Set<string>();
for (const node of RESEARCH_LIST) {
  const key = `${node.domain}:${node.tier}`;
  if (researchKeys.has(key)) throw new Error(`content/research.json: duplicate node ${key}`);
  researchKeys.add(key);
}
for (const domain of DOMAINS) {
  for (const tier of [2, 3]) {
    if (!researchKeys.has(`${domain}:${tier}`))
      throw new Error(`content/research.json: missing ${domain} tier ${tier}`);
  }
}

export const RIVAL_CONTENT: Record<RivalId, RivalContent> = indexById(
  'rivals.json',
  parse('rivals.json', rivalSchema, rivalsJson),
  RIVALS,
);

for (const rival of Object.values(RIVAL_CONTENT)) {
  const shares = rival.fronts.reduce((s, f) => s + f.share, 0);
  if (Math.abs(shares - 1) > 1e-6) throw new Error(`content/rivals.json: ${rival.id} front shares sum to ${shares}`);
  for (const front of rival.fronts) {
    const w = front.weights;
    if (Math.abs(w.land + w.air + w.sea + w.strategic - 1) > 1e-6) {
      throw new Error(`content/rivals.json: ${rival.id} front "${front.name}" weights must sum to 1`);
    }
  }
}

/** The research node that unlocks `tier` in `domain`. */
export function researchNode(domain: DomainId, tier: 2 | 3): ResearchContent {
  const node = RESEARCH_LIST.find((n) => n.domain === domain && n.tier === tier);
  if (!node) throw new Error(`No research for ${domain} tier ${tier}`);
  return node;
}
