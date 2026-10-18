import { z } from 'zod';
import policeJson from '../../../content/police.json';
import { AGENCIES, MINISTRIES, POLICE_UNITS, type AgencyId, type PoliceUnitId } from './ids';

/**
 * Police and internal affairs (content/police.json): officers and stations per region, the equipment tiers, the
 * national police units and the security agencies. Validated at load; a broken file fails `npm test`.
 */

const text = { name: z.string().min(1), summary: z.string().min(1) };

const policeSchema = z.strictObject({
  officer: z.strictObject({
    ...text,
    /** ₹ crore to recruit and train one officer. */
    recruitCost: z.number().positive(),
    /** ₹ crore per officer per month. */
    upkeep: z.number().positive(),
    /** Officers per 100,000 people in every region at the start. */
    openingPer100k: z.number().positive(),
  }),
  station: z.strictObject({
    ...text,
    cost: z.number().positive(),
    upkeep: z.number().positive(),
    /** Officers one station can house and equip. */
    capacity: z.number().int().positive(),
  }),
  equipment: z
    .array(
      z.strictObject({
        tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        ...text,
        /** ₹ crore to reach this tier from the one below. */
        cost: z.number().min(0),
        /** ₹ crore per month above the basic kit. */
        upkeep: z.number().min(0),
        /** How much more effective every officer is. */
        effect: z.number().min(1),
      }),
    )
    .length(3),
  units: z.array(
    z.strictObject({
      id: z.enum(POLICE_UNITS),
      ...text,
      cost: z.number().positive(),
      upkeep: z.number().positive(),
      /** Units in service at the start. */
      opening: z.number().int().positive(),
    }),
  ),
  agencies: z.array(
    z.strictObject({
      id: z.enum(AGENCIES),
      /** The department whose budget pays for it. */
      department: z.enum(MINISTRIES),
      ...text,
      /** ₹ crore to raise its strength by one point. */
      costPerPoint: z.number().positive(),
      /** ₹ crore per month for each point above the opening strength. */
      upkeepPerPoint: z.number().positive(),
    }),
  ),
});

type Police = z.infer<typeof policeSchema>;
export type PoliceUnitContent = Police['units'][number];
export type AgencyContent = Police['agencies'][number];
export type EquipmentContent = Police['equipment'][number];

const parsed: Police = (() => {
  const result = policeSchema.safeParse(policeJson);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`content/police.json: ${issue?.path.join('.')}: ${issue?.message}`);
  }
  const { units, agencies, equipment } = result.data;
  const check = (what: string, found: string[], ids: readonly string[]) => {
    if (found.length !== ids.length || ids.some((id, i) => found[i] !== id)) {
      throw new Error(`content/police.json: ${what} must be [${ids.join(', ')}], found [${found.join(', ')}]`);
    }
  };
  check(
    'units',
    units.map((u) => u.id),
    POLICE_UNITS,
  );
  check(
    'agencies',
    agencies.map((a) => a.id),
    AGENCIES,
  );
  check(
    'equipment tiers',
    equipment.map((e) => String(e.tier)),
    ['1', '2', '3'],
  );
  return result.data;
})();

export const OFFICER_CONTENT = parsed.officer;
export const STATION_CONTENT = parsed.station;
export const EQUIPMENT_CONTENT: readonly EquipmentContent[] = parsed.equipment;
export const POLICE_UNIT_CONTENT = Object.fromEntries(parsed.units.map((u) => [u.id, u])) as Record<
  PoliceUnitId,
  PoliceUnitContent
>;
export const AGENCY_CONTENT = Object.fromEntries(parsed.agencies.map((a) => [a.id, a])) as Record<
  AgencyId,
  AgencyContent
>;
