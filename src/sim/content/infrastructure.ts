import { z } from 'zod';
import facilitiesJson from '../../../content/facilities.json';
import { COVERAGE_AREAS, FACILITIES, MINISTRIES, REGIONS, type FacilityId } from './ids';

/**
 * Public works (content/facilities.json): what each facility costs, how long it takes to build, what it costs to
 * run and how many people it serves. Validated at load; a broken file fails `npm test`.
 */

const regionShares = z.strictObject(
  Object.fromEntries(REGIONS.map((r) => [r, z.number().min(0).max(1.5)])) as Record<
    (typeof REGIONS)[number],
    z.ZodNumber
  >,
);

const facilitySchema = z.strictObject({
  id: z.enum(FACILITIES),
  /** The department that runs it and pays its upkeep. */
  department: z.enum(MINISTRIES),
  area: z.enum(COVERAGE_AREAS),
  name: z.string().min(1),
  summary: z.string().min(1),
  /** ₹ crore to build one. */
  cost: z.number().positive(),
  /** In-game days from order to opening: weeks for small buildings, a few months for the largest. */
  buildDays: z.number().int().min(7).max(120),
  /** ₹ crore per month to run one. */
  upkeep: z.number().positive(),
  /** People one facility serves. */
  capacity: z.number().int().positive(),
  /** Staff one facility employs. */
  jobs: z.number().int().min(0),
  /** Share of each region's population the opening network of this facility serves. */
  opening: regionShares,
});
export type FacilityContent = z.infer<typeof facilitySchema>;

export const FACILITY_CONTENT: Record<FacilityId, FacilityContent> = (() => {
  const parsed = z.array(facilitySchema).safeParse(facilitiesJson);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`content/facilities.json: ${issue?.path.join('.')}: ${issue?.message}`);
  }
  const found = parsed.data.map((f) => f.id);
  if (found.length !== FACILITIES.length || FACILITIES.some((id, i) => found[i] !== id)) {
    throw new Error(`content/facilities.json: expected ids [${FACILITIES.join(', ')}], found [${found.join(', ')}]`);
  }
  return Object.fromEntries(parsed.data.map((f) => [f.id, f])) as Record<FacilityId, FacilityContent>;
})();
