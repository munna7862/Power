import { RIVAL_CONTENT, UNIT_CONTENT, type FrontContent } from '../content/military';
import { DOMAINS, UNITS, type DomainId, type RivalId, type UnitId } from '../content/ids';
import type { MilitaryState, RivalState } from '../state/types';
import { POWER_SCALE, SIGHTING_STALE_DAYS, TIER_COST, TIER_POWER, TIER_UPKEEP } from './constants';

/**
 * Pure military formulas, shared by the monthly and daily systems, the war resolver, the UI and the bots,
 * so the Military screen can never disagree with what the simulation does.
 */

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Readiness 0–100 → 0.5–1: an unready army fights at half strength. */
export const readinessFactor = (readiness: number): number => 0.5 + 0.5 * (clamp(readiness, 0, 100) / 100);
/** Morale 0–100 → 0.6–1. */
export const moraleFactor = (morale: number): number => 0.6 + 0.4 * (clamp(morale, 0, 100) / 100);

export const unitsIn = (domain: DomainId): UnitId[] => UNITS.filter((u) => UNIT_CONTENT[u].domain === domain);

const rawPoints = (unit: UnitId, count: number): number =>
  (count * (UNIT_CONTENT[unit].attack + UNIT_CONTENT[unit].defence)) / 2;

/** Unit points of a domain before readiness, morale and technology. */
export function domainRaw(forces: Record<UnitId, number>, domain: DomainId): number {
  return unitsIn(domain).reduce((sum, u) => sum + rawPoints(u, forces[u]), 0);
}

/** Each domain’s share of India’s opening forces, the “balanced” composition that fights at full effect everywhere. */
export const REFERENCE_SHARE: Record<DomainId, number> = (() => {
  const start = Object.fromEntries(UNITS.map((u) => [u, UNIT_CONTENT[u].start])) as Record<UnitId, number>;
  const total = DOMAINS.reduce((s, d) => s + domainRaw(start, d), 0);
  return Object.fromEntries(DOMAINS.map((d) => [d, domainRaw(start, d) / total])) as Record<DomainId, number>;
})();

type Forces = Pick<MilitaryState, 'forces' | 'readiness' | 'morale' | 'tech'>;

/** Strength of one domain on the strength index, with readiness, morale and technology applied. */
export function domainStrength(m: Forces, domain: DomainId): number {
  return (
    domainRaw(m.forces, domain) *
    POWER_SCALE *
    TIER_POWER[m.tech[domain]] *
    readinessFactor(m.readiness) *
    moraleFactor(m.morale)
  );
}

/** India’s overall military strength index. */
export function militaryStrength(m: Forces): number {
  return DOMAINS.reduce((sum, d) => sum + domainStrength(m, d), 0);
}

/** A rival’s effective strength: its true strength cut by low readiness. */
export const rivalEffective = (rival: Pick<RivalState, 'strength' | 'readiness' | 'annexed'>): number =>
  rival.annexed ? 0 : rival.strength * readinessFactor(rival.readiness);

/**
 * India’s power on a front. A balanced force counts in full; a lopsided one is strong where the front
 * needs its strong domains and weak where it needs the ones it neglected.
 */
export function frontPower(m: Forces, front: FrontContent): number {
  const fit = DOMAINS.reduce((sum, d) => sum + (front.weights[d] * domainStrength(m, d)) / REFERENCE_SHARE[d], 0);
  return front.share * fit;
}

export const enemyFrontPower = (rival: Pick<RivalState, 'strength' | 'readiness' | 'annexed'>, front: FrontContent) =>
  front.share * rivalEffective(rival);

/** Price of one unit at a technology tier. */
export const unitCost = (unit: UnitId, tier: 1 | 2 | 3): number =>
  Math.round(UNIT_CONTENT[unit].cost * TIER_COST[tier]);

export const unitUpkeep = (unit: UnitId, tier: 1 | 2 | 3): number => UNIT_CONTENT[unit].upkeep * TIER_UPKEEP[tier];

/** Name of the equipment a domain fields at its current tier, e.g. "Multirole Fighter Gen 4". */
export const unitGeneration = (unit: UnitId, tier: 1 | 2 | 3): string =>
  UNIT_CONTENT[unit].generations[tier - 1] ?? UNIT_CONTENT[unit].name;

/** Monthly upkeep of all forces in service, ₹ crore. */
export function monthlyUpkeep(m: Pick<MilitaryState, 'forces' | 'tech'>): number {
  return UNITS.reduce((sum, u) => sum + m.forces[u] * unitUpkeep(u, m.tech[UNIT_CONTENT[u].domain]), 0);
}

/** Personnel in uniform. */
export const personnel = (forces: Record<UnitId, number>): number =>
  UNITS.reduce((sum, u) => sum + forces[u] * UNIT_CONTENT[u].crew, 0);

export type StrengthView =
  | { kind: 'unknown' }
  | { kind: 'estimate'; low: number; high: number }
  | { kind: 'sighted'; low: number; high: number; ageDays: number };

/**
 * What the President knows of a rival’s strength (the fog of war).
 * - A recon sighting gives a narrow range around what the scouts saw, widening as the picture ages.
 * - Without one, a well-funded intelligence ministry (efficiency ≥ 0.8) can still give a wide estimate;
 *   otherwise the strength is simply unknown.
 */
export function strengthView(
  state: { clock: { tick: number }; military: Pick<MilitaryState, 'rivals'> },
  rival: RivalId,
  intelligenceEfficiency: number,
): StrengthView {
  const r = state.military.rivals[rival];
  if (r.annexed) return { kind: 'estimate', low: 0, high: 0 };
  if (r.sighting) {
    const ageDays = state.clock.tick - r.sighting.tick;
    const spread = 0.05 + 0.25 * clamp(ageDays / SIGHTING_STALE_DAYS, 0, 1);
    return {
      kind: 'sighted',
      low: Math.round(r.sighting.strength * (1 - spread)),
      high: Math.round(r.sighting.strength * (1 + spread)),
      ageDays,
    };
  }
  if (intelligenceEfficiency < 0.8) return { kind: 'unknown' };
  return {
    kind: 'estimate',
    low: Math.round(RIVAL_CONTENT[rival].strength * 0.55),
    high: Math.round(RIVAL_CONTENT[rival].strength * 1.5),
  };
}
