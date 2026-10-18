import { z } from 'zod';
import powerJson from '../../../content/power.json';
import { FUELS, PLANTS, REGIONS, type PlantId } from './ids';

/**
 * Power plants (content/power.json): price, build time, running and fuel costs, size, how much of the time they
 * generate, emissions and the opening fleet in each region. Validated at load; a broken file fails `npm test`.
 */

const regionCounts = z.strictObject(
  Object.fromEntries(REGIONS.map((r) => [r, z.number().int().min(0)])) as Record<(typeof REGIONS)[number], z.ZodNumber>,
);

const plantSchema = z.strictObject({
  id: z.enum(PLANTS),
  name: z.string().min(1),
  summary: z.string().min(1),
  /** ₹ crore to build one. */
  cost: z.number().positive(),
  /** In-game days to build: weeks for solar, about a year for nuclear. */
  buildDays: z.number().int().min(7).max(400),
  /** ₹ crore per month to run one, before fuel. */
  upkeep: z.number().positive(),
  fuel: z.enum(FUELS).nullable(),
  /** Units of its fuel good one plant burns per month, drawn from stock (Sprint 8.5). */
  fuelUse: z.number().min(0),
  /** Nameplate capacity of one plant, GW. */
  capacity: z.number().positive(),
  /** Share of the time it generates at full capacity. */
  capacityFactor: z.number().positive().max(1),
  /** Emissions per GW generated (coal = 1). */
  emissions: z.number().min(0),
  /** Plants standing in each region at the start. */
  opening: regionCounts,
});
export type PlantContent = z.infer<typeof plantSchema>;

export const PLANT_CONTENT: Record<PlantId, PlantContent> = (() => {
  const parsed = z.array(plantSchema).safeParse(powerJson);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`content/power.json: ${issue?.path.join('.')}: ${issue?.message}`);
  }
  const found = parsed.data.map((p) => p.id);
  if (found.length !== PLANTS.length || PLANTS.some((id, i) => found[i] !== id)) {
    throw new Error(`content/power.json: expected ids [${PLANTS.join(', ')}], found [${found.join(', ')}]`);
  }
  for (const p of parsed.data) {
    if ((p.fuel === null) !== (p.fuelUse === 0)) {
      throw new Error(`content/power.json: ${p.id} needs a fuel use exactly when it burns fuel`);
    }
  }
  return Object.fromEntries(parsed.data.map((p) => [p.id, p])) as Record<PlantId, PlantContent>;
})();
