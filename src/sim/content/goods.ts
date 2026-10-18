import { z } from 'zod';
import goodsJson from '../../../content/goods.json';
import industriesJson from '../../../content/industries.json';
import { GOODS, INDUSTRIES, REGIONS, SECTORS, type GoodId, type IndustryId } from './ids';

/**
 * Goods (content/goods.json) and the plants that make them (content/industries.json). Validated at load; a
 * broken file fails `npm test`. Prices are ₹ crore per unit at the start of the game.
 */

const goodSchema = z.strictObject({
  id: z.enum(GOODS),
  name: z.string().min(1),
  summary: z.string().min(1),
  /** Unit of quantity, e.g. "Mt" (million tonnes). */
  unit: z.string().min(1),
  /** Base world price, ₹ crore per unit. */
  price: z.number().positive(),
  /** The sector of India's economy the good belongs to (partners strong in it trade it more cheaply). */
  sector: z.enum(SECTORS),
  /** Units the world trades in a month; a trade of this size moves the world price by about 2%. */
  market: z.number().positive(),
  /** Units imported each month at the start (the private market covers the gap between supply and demand). */
  openingImports: z.number().min(0),
});
export type GoodContent = z.infer<typeof goodSchema>;

const flows = z.partialRecord(z.enum(GOODS), z.number().positive());
const ownership = z.strictObject({ state: z.number().int().min(0), private: z.number().int().min(0) });

const industrySchema = z.strictObject({
  id: z.enum(INDUSTRIES),
  name: z.string().min(1),
  summary: z.string().min(1),
  /** The sector its value added counts toward. */
  sector: z.enum(SECTORS),
  /** Units of each good one plant uses and makes per month at full throughput. */
  inputs: flows,
  outputs: flows,
  /** ₹ crore to build one state plant. */
  cost: z.number().positive(),
  buildDays: z.number().int().min(7).max(400),
  /** ₹ crore per month to run one (wages, maintenance). */
  upkeep: z.number().positive(),
  /** GW of power one plant draws on average. */
  power: z.number().min(0),
  jobs: z.number().int().min(0),
  /** ₹ crore a private investor pays the treasury for a licence to build one. */
  licenceFee: z.number().positive(),
  /** State and private plants in each region at the start. */
  opening: z.strictObject(
    Object.fromEntries(REGIONS.map((r) => [r, ownership])) as Record<(typeof REGIONS)[number], typeof ownership>,
  ),
});
export type IndustryContent = z.infer<typeof industrySchema>;

function load<T extends { id: string }, K extends string>(
  file: string,
  schema: z.ZodType<T>,
  ids: readonly K[],
  raw: unknown,
) {
  const parsed = z.array(schema).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`content/${file}: ${issue?.path.join('.')}: ${issue?.message}`);
  }
  const found = parsed.data.map((x) => x.id);
  if (found.length !== ids.length || ids.some((id, i) => found[i] !== id)) {
    throw new Error(`content/${file}: expected ids [${ids.join(', ')}], found [${found.join(', ')}]`);
  }
  return Object.fromEntries(parsed.data.map((x) => [x.id, x])) as Record<K, T>;
}

export const GOOD_CONTENT: Record<GoodId, GoodContent> = load('goods.json', goodSchema, GOODS, goodsJson);

export const INDUSTRY_CONTENT: Record<IndustryId, IndustryContent> = (() => {
  const industries = load('industries.json', industrySchema, INDUSTRIES, industriesJson);
  // Production runs in list order, so every input must be made earlier in the list or not at all.
  const made = new Set<string>();
  for (const id of INDUSTRIES) {
    for (const g of Object.keys(industries[id].inputs)) {
      const later = INDUSTRIES.slice(INDUSTRIES.indexOf(id)).some((x) => x !== id && g in industries[x].outputs);
      if (later && !made.has(g)) throw new Error(`content/industries.json: ${id} uses ${g} before any plant makes it`);
    }
    for (const g of Object.keys(industries[id].outputs)) made.add(g);
  }
  return industries;
})();
